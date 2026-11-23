from fastapi import APIRouter, Response

from app.auth.dependencies import CurrentAuth, CurrentUser
from app.auth.router import clear_refresh_cookie
from app.database import DbSession
from app.exports import service as exports
from app.exports.service import Export
from app.rate_limit import RateLimiter
from app.users import service
from app.users.models import UserAccount
from app.users.schemas import AccountDeletion, Me, MeUpdate, PasswordChange

router = APIRouter(prefix="/me", tags=["me"])

password_checks_by_user = RateLimiter(limit=5, window_seconds=15 * 60)


@router.get("", response_model=Me, summary="Current user with settings")
async def read_me(user: CurrentUser) -> UserAccount:
    return user


@router.patch("", response_model=Me, summary="Update profile and settings")
async def update_me(data: MeUpdate, user: CurrentUser, db: DbSession) -> UserAccount:
    return await service.update_me(db, user, data)


@router.post("/password", status_code=204, summary="Change password")
async def change_password(data: PasswordChange, auth: CurrentAuth, db: DbSession) -> Response:
    password_checks_by_user.hit(f"password:{auth.user.id}")
    await service.change_password(db, auth, data)
    return Response(status_code=204)


@router.post("/delete", status_code=204, summary="Permanently delete the account")
async def delete_account(data: AccountDeletion, user: CurrentUser, db: DbSession) -> Response:
    password_checks_by_user.hit(f"delete:{user.id}")
    await service.delete_account(db, user, data.password)
    response = Response(status_code=204)
    clear_refresh_cookie(response)
    return response


@router.get("/export.json", response_model=Export, summary="Export everything as JSON")
async def export_json(user: CurrentUser, db: DbSession) -> Response:
    export = await exports.export_json(db, user)
    return Response(
        export.model_dump_json(indent=2),
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="ember-export.json"'},
    )
