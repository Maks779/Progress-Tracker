from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import Depends, Header
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.schemas import ClientKind
from app.auth.security import decode_access_token
from app.database import DbSession
from app.errors import AppError
from app.users.models import UserAccount

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Auth:
    user: UserAccount
    family_id: UUID


async def get_auth(
    db: DbSession,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> Auth:
    claims = decode_access_token(credentials.credentials) if credentials else None
    user = await db.get(UserAccount, claims.user_id) if claims else None
    if claims is None or user is None:
        raise AppError(401, detail="Sign in to continue.", headers={"WWW-Authenticate": "Bearer"})
    return Auth(user=user, family_id=claims.family_id)


async def get_current_user(auth: Annotated[Auth, Depends(get_auth)]) -> UserAccount:
    return auth.user


CurrentAuth = Annotated[Auth, Depends(get_auth)]
CurrentUser = Annotated[UserAccount, Depends(get_current_user)]
Client = Annotated[ClientKind, Header(alias="X-Client")]
