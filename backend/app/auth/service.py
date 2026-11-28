from dataclasses import dataclass
from datetime import timedelta
from uuid import UUID, uuid4

from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app import clock
from app.auth.email import ResetEmail
from app.auth.models import PasswordResetToken, RefreshToken
from app.auth.schemas import ClientKind, RegisterRequest
from app.auth.security import (
    create_access_token,
    hash_password,
    hash_token,
    new_opaque_token,
    verify_password,
)
from app.config import get_settings
from app.errors import AppError, conflict
from app.users.models import UserAccount


@dataclass(frozen=True)
class IssuedTokens:
    access_token: str
    refresh_token: str
    expires_in: int


def normalize_email(email: str) -> str:
    return email.strip().lower()


def invalid_credentials() -> AppError:
    return AppError(401, code="invalid_credentials", detail="Email or password is incorrect.")


def _no_session() -> AppError:
    """No refresh token was sent: the user never signed in here, or signed out."""
    return AppError(401, code="no_session", detail="Sign in to continue.")


def _session_expired() -> AppError:
    """A refresh token was sent but no longer works: expired, revoked or reused."""
    return AppError(401, code="session_expired", detail="Your session has expired. Sign in again.")


async def get_user_by_email(db: AsyncSession, email: str) -> UserAccount | None:
    result = await db.execute(
        select(UserAccount).where(UserAccount.email == normalize_email(email))
    )
    return result.scalar_one_or_none()


async def _issue_tokens(
    db: AsyncSession, user_id: UUID, client: str, family_id: UUID | None = None
) -> IssuedTokens:
    now = clock.utcnow()
    family_id = family_id or uuid4()
    raw_token = new_opaque_token()
    db.add(
        RefreshToken(
            user_id=user_id,
            family_id=family_id,
            token_hash=hash_token(raw_token),
            client=client,
            issued_at=now,
            expires_at=now + timedelta(days=get_settings().refresh_token_ttl_days),
        )
    )
    access_token, expires_in = create_access_token(user_id, family_id)
    return IssuedTokens(access_token=access_token, refresh_token=raw_token, expires_in=expires_in)


async def revoke_families(
    db: AsyncSession,
    user_id: UUID,
    *,
    family_id: UUID | None = None,
    keep_family_id: UUID | None = None,
) -> None:
    """Revoke the user's active refresh tokens: one family, all but one, or all of them."""
    statement = (
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=clock.utcnow())
    )
    if family_id is not None:
        statement = statement.where(RefreshToken.family_id == family_id)
    if keep_family_id is not None:
        statement = statement.where(RefreshToken.family_id != keep_family_id)
    await db.execute(statement)


async def register(db: AsyncSession, data: RegisterRequest, client: ClientKind) -> IssuedTokens:
    email = normalize_email(data.email)
    taken = conflict("email_taken", "An account with this email already exists.")
    if await get_user_by_email(db, email) is not None:
        raise taken
    user = UserAccount(
        email=email,
        name=data.name,
        password_hash=hash_password(data.password),
        timezone=data.timezone,
        language=data.language,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as error:
        await db.rollback()
        raise taken from error
    tokens = await _issue_tokens(db, user.id, client)
    await db.commit()
    return tokens


async def login(db: AsyncSession, email: str, password: str, client: ClientKind) -> IssuedTokens:
    user = await get_user_by_email(db, email)
    password_ok = verify_password(password, user.password_hash if user else None)
    if user is None or not password_ok:
        raise invalid_credentials()
    tokens = await _issue_tokens(db, user.id, client)
    await db.commit()
    return tokens


async def refresh(db: AsyncSession, raw_token: str | None) -> IssuedTokens:
    """Rotate a refresh token. Reusing an already used token revokes its whole family."""
    if not raw_token:
        raise _no_session()
    result = await db.execute(
        select(RefreshToken)
        .where(RefreshToken.token_hash == hash_token(raw_token))
        .with_for_update()
    )
    token = result.scalar_one_or_none()
    now = clock.utcnow()
    if token is None or token.revoked_at is not None or token.expires_at <= now:
        raise _session_expired()
    if token.used_at is not None:
        await revoke_families(db, token.user_id, family_id=token.family_id)
        await db.commit()
        raise _session_expired()
    token.used_at = now
    tokens = await _issue_tokens(db, token.user_id, token.client, token.family_id)
    await db.commit()
    return tokens


async def logout(db: AsyncSession, raw_token: str | None) -> None:
    if not raw_token:
        return
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == hash_token(raw_token))
    )
    token = result.scalar_one_or_none()
    if token is not None:
        await revoke_families(db, token.user_id, family_id=token.family_id)
        await db.commit()


RESET_EMAIL_COOLDOWN = timedelta(minutes=1)


def _invalid_reset_link() -> AppError:
    return AppError(
        400, code="invalid_reset_link", detail="The reset link is invalid or has expired."
    )


async def request_password_reset(db: AsyncSession, email: str) -> ResetEmail | None:
    """A reset link to email, at most once a minute per account, so repeated clicks send one."""
    user = await db.scalar(
        select(UserAccount).where(UserAccount.email == normalize_email(email)).with_for_update()
    )
    if user is None:
        return None
    settings = get_settings()
    now = clock.utcnow()
    recent = await db.scalar(
        select(PasswordResetToken.id)
        .where(
            PasswordResetToken.user_id == user.id,
            PasswordResetToken.created_at > now - RESET_EMAIL_COOLDOWN,
        )
        .limit(1)
    )
    if recent is not None:
        await db.rollback()
        return None
    raw_token = new_opaque_token()
    db.add(
        PasswordResetToken(
            user_id=user.id,
            token_hash=hash_token(raw_token),
            created_at=now,
            expires_at=now + timedelta(minutes=settings.password_reset_ttl_minutes),
        )
    )
    await db.commit()
    link = f"{settings.web_app_url}/reset-password#token={raw_token}"
    return ResetEmail(to=user.email, name=user.name, link=link, language=user.language)


async def _usable_reset_token(
    db: AsyncSession, raw_token: str, for_update: bool = False
) -> PasswordResetToken:
    query = select(PasswordResetToken).where(PasswordResetToken.token_hash == hash_token(raw_token))
    if for_update:
        query = query.with_for_update()
    token = await db.scalar(query)
    if token is None or token.used_at is not None or token.expires_at <= clock.utcnow():
        raise _invalid_reset_link()
    return token


async def check_reset_token(db: AsyncSession, raw_token: str) -> None:
    """Fail early when a link was already used or has expired, before the user types a password."""
    await _usable_reset_token(db, raw_token)


async def reset_password(db: AsyncSession, raw_token: str, new_password: str) -> str:
    """Set the new password, use up the reset links, sign out everywhere; returns the email."""
    token = await _usable_reset_token(db, raw_token, for_update=True)
    user = await db.get(UserAccount, token.user_id)
    if user is None:
        raise _invalid_reset_link()
    now = clock.utcnow()
    user.password_hash = hash_password(new_password)
    await db.execute(
        update(PasswordResetToken)
        .where(PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None))
        .values(used_at=now)
    )
    await revoke_families(db, user.id)
    await db.commit()
    return user.email
