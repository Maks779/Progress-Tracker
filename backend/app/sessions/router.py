from datetime import date
from uuid import UUID

from fastapi import APIRouter, Response

from app import clock
from app.auth.dependencies import CurrentUser
from app.database import DbSession
from app.pagination import Limit, decode_cursor, encode_cursor
from app.sessions import history, service
from app.sessions.schemas import RecordPage, SessionOut, SessionPage, SessionSaved, SessionWrite

router = APIRouter(prefix="/sessions", tags=["sessions"])
records_router = APIRouter(prefix="/records", tags=["exercises"])


@router.get("", response_model=SessionPage, summary="List sessions (History)")
async def list_sessions(
    user: CurrentUser,
    db: DbSession,
    tracker_id: UUID | None = None,
    from_date: date | None = None,
    to_date: date | None = None,
    limit: Limit = 20,
    cursor: str | None = None,
) -> SessionPage:
    return await service.list_sessions(db, user, tracker_id, from_date, to_date, limit, cursor)


@router.get("/{session_id}", response_model=SessionOut, summary="Session detail")
async def get_session(session_id: UUID, user: CurrentUser, db: DbSession) -> SessionOut:
    return await service.get_session(db, user, session_id)


@router.put(
    "/{session_id}",
    response_model=SessionSaved,
    responses={201: {"model": SessionSaved, "description": "Created."}},
    summary="Create or replace a session (idempotent)",
)
async def put_session(
    session_id: UUID, data: SessionWrite, user: CurrentUser, db: DbSession, response: Response
) -> SessionSaved:
    saved, created = await service.put_session(db, user, session_id, data)
    response.status_code = 201 if created else 200
    return saved


@router.delete("/{session_id}", status_code=204, summary="Delete a session (soft)")
async def delete_session(session_id: UUID, user: CurrentUser, db: DbSession) -> Response:
    await service.delete_session(db, user, session_id)
    return Response(status_code=204)


@router.post("/{session_id}/restore", response_model=SessionOut, summary="Undo a delete")
async def restore_session(session_id: UUID, user: CurrentUser, db: DbSession) -> SessionOut:
    return await service.restore_session(db, user, session_id)


@records_router.get("", response_model=RecordPage, summary="Records screen")
async def list_records(
    user: CurrentUser, db: DbSession, limit: Limit = 20, cursor: str | None = None
) -> RecordPage:
    records = history.all_records(await history.strength_history(db, user.id))
    offset = int(decode_cursor(cursor).get("o", 0)) if cursor else 0
    page = records[offset : offset + limit]
    more = offset + limit < len(records)
    return RecordPage(
        items=[record for record, _ in page],
        new_this_week=history.new_this_week(records, clock.today_in(user.timezone)),
        next_cursor=encode_cursor({"o": offset + limit}) if more else None,
    )
