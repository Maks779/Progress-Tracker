from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import RefreshToken
from app.auth.schemas import ClientKind
from app.auth.security import AccessClaims, decode_access_token
from app.database import DbSession
from app.errors import AppError
from app.users.models import UserAccount

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Auth:
    user: UserAccount
    family_id: UUID


async def _signed_in_user(db: AsyncSession, claims: AccessClaims) -> UserAccount | None:
    """The token's user, while the sign-in it belongs to is still on.

    Logging out, changing or resetting the password and reusing a refresh token revoke the
    sign-in's refresh tokens; from then on its access tokens stop working too, not 15 minutes later.
    """
    active = (
        select(RefreshToken.id)
        .where(
            RefreshToken.family_id == claims.family_id,
            RefreshToken.user_id == claims.user_id,
            RefreshToken.revoked_at.is_(None),
        )
        .exists()
    )
    return await db.scalar(select(UserAccount).where(UserAccount.id == claims.user_id, active))


async def get_auth(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> Auth:
    claims = decode_access_token(credentials.credentials) if credentials else None
    user = await _signed_in_user(db, claims) if claims else None
    if claims is None or user is None:
        raise AppError(401, detail="Sign in to continue.", headers={"WWW-Authenticate": "Bearer"})
    return Auth(user=user, family_id=claims.family_id)


async def get_current_user(auth: Annotated[Auth, Depends(get_auth)]) -> UserAccount:
    return auth.user


CurrentAuth = Annotated[Auth, Depends(get_auth)]
CurrentUser = Annotated[UserAccount, Depends(get_current_user)]
Client = Annotated[ClientKind, Header(alias="X-Client")]
