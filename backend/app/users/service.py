from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import Auth
from app.auth.security import hash_password, verify_password
from app.auth.service import invalid_credentials, revoke_families
from app.users.models import UserAccount
from app.users.schemas import MeUpdate, PasswordChange


async def update_me(db: AsyncSession, user: UserAccount, data: MeUpdate) -> UserAccount:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    await db.commit()
    await db.refresh(user)
    return user


async def change_password(db: AsyncSession, auth: Auth, data: PasswordChange) -> None:
    """Set a new password and sign out every other device."""
    if not verify_password(data.current_password, auth.user.password_hash):
        raise invalid_credentials()
    auth.user.password_hash = hash_password(data.new_password)
    await revoke_families(db, auth.user.id, keep_family_id=auth.family_id)
    await db.commit()


async def delete_account(db: AsyncSession, user: UserAccount, password: str) -> None:
    """Hard-delete the user; every owned row goes with it through ON DELETE CASCADE."""
    if not verify_password(password, user.password_hash):
        raise invalid_credentials()
    await db.delete(user)
    await db.commit()
