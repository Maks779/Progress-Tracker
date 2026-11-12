from fastapi import APIRouter, Response

from app.auth.dependencies import CurrentAuth, CurrentUser
from app.auth.router import clear_refresh_cookie
from app.database import DbSession
from app.users import service
from app.users.models import UserAccount
from app.users.schemas import AccountDeletion, Me, MeUpdate, PasswordChange

router = APIRouter(prefix="/me", tags=["me"])


@router.get("", response_model=Me, summary="Current user with settings")
async def read_me(user: CurrentUser) -> UserAccount:
    return user


@router.patch("", response_model=Me, summary="Update profile and settings")
async def update_me(data: MeUpdate, user: CurrentUser, db: DbSession) -> UserAccount:
    return await service.update_me(db, user, data)


@router.post("/password", status_code=204, summary="Change password")
async def change_password(data: PasswordChange, auth: CurrentAuth, db: DbSession) -> Response:
    await service.change_password(db, auth, data)
    return Response(status_code=204)


@router.post("/delete", status_code=204, summary="Permanently delete the account")
async def delete_account(data: AccountDeletion, user: CurrentUser, db: DbSession) -> Response:
    await service.delete_account(db, user, data.password)
    response = Response(status_code=204)
    clear_refresh_cookie(response)
    return response
