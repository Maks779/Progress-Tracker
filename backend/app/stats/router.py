from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Query

from app.auth.dependencies import CurrentUser
from app.database import DbSession
from app.stats import service
from app.stats.rules import Period
from app.stats.schemas import CalendarMonth, HomeStats, ProgressStats

router = APIRouter(prefix="/stats", tags=["stats"])

Month = Annotated[str, Query(pattern=r"^\d{4}-(0[1-9]|1[0-2])$", examples=["2026-10"])]


@router.get("/home", response_model=HomeStats, summary="Home screen data for the current week")
async def home(user: CurrentUser, db: DbSession) -> HomeStats:
    return await service.home(db, user)


@router.get("/calendar", response_model=CalendarMonth, summary="History month calendar")
async def calendar(
    user: CurrentUser, db: DbSession, month: Month, tracker_id: UUID | None = None
) -> CalendarMonth:
    return await service.calendar(db, user, month, tracker_id)


@router.get("/progress", response_model=ProgressStats, summary="Progress overview")
async def progress(
    user: CurrentUser,
    db: DbSession,
    period: Period = Period.FOUR_WEEKS,
    tracker_id: UUID | None = None,
) -> ProgressStats:
    return await service.progress(db, user, period, tracker_id)
