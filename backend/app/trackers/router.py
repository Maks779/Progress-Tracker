from uuid import UUID

from fastapi import APIRouter, Response
from pydantic import BaseModel

from app.auth.dependencies import CurrentUser
from app.database import DbSession
from app.exports import service as exports
from app.trackers import service
from app.trackers.models import Tracker
from app.trackers.schemas import TrackerCreate, TrackerOut, TrackerUpdate

router = APIRouter(prefix="/trackers", tags=["trackers"])


class TrackerList(BaseModel):
    items: list[TrackerOut]


@router.get("", response_model=TrackerList, summary="List trackers")
async def list_trackers(
    user: CurrentUser, db: DbSession, include_archived: bool = False
) -> dict[str, list[Tracker]]:
    return {"items": await service.list_trackers(db, user.id, include_archived)}


@router.post("", status_code=201, response_model=TrackerOut, summary="Create a tracker")
async def create_tracker(data: TrackerCreate, user: CurrentUser, db: DbSession) -> Tracker:
    return await service.create_tracker(db, user, data)


@router.get("/{tracker_id}", response_model=TrackerOut, summary="Get a tracker")
async def get_tracker(tracker_id: UUID, user: CurrentUser, db: DbSession) -> Tracker:
    return await service.get_tracker(db, user.id, tracker_id)


@router.patch("/{tracker_id}", response_model=TrackerOut, summary="Update or archive a tracker")
async def update_tracker(
    tracker_id: UUID, data: TrackerUpdate, user: CurrentUser, db: DbSession
) -> Tracker:
    return await service.update_tracker(db, user, tracker_id, data)


@router.delete("/{tracker_id}", status_code=204, summary="Delete a tracker (soft)")
async def delete_tracker(tracker_id: UUID, user: CurrentUser, db: DbSession) -> Response:
    await service.delete_tracker(db, user, tracker_id)
    return Response(status_code=204)


@router.get(
    "/{tracker_id}/export.csv",
    response_class=Response,
    responses={200: {"content": {"text/csv": {}}, "description": "CSV file."}},
    summary="Export one tracker as CSV",
)
async def export_csv(tracker_id: UUID, user: CurrentUser, db: DbSession) -> Response:
    content = await exports.export_csv(db, user, tracker_id)
    tracker = await service.get_tracker(db, user.id, tracker_id)
    return Response(
        content,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": exports.content_disposition(tracker)},
    )
