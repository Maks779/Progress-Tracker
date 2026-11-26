from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app import clock
from app.errors import field_error
from app.goals.models import Goal
from app.ownership import get_owned
from app.sessions.models import ReadingEntry, Session
from app.sessions.reading import refresh_finished
from app.trackers.models import Tracker
from app.trackers.schemas import TrackerCreate, TrackerOut, TrackerSummary, TrackerUpdate
from app.users.models import UserAccount


def active_trackers(user_id: UUID):
    return select(Tracker).where(Tracker.user_id == user_id, Tracker.deleted_at.is_(None))


async def list_trackers(
    db: AsyncSession, user_id: UUID, include_archived: bool = False
) -> list[Tracker]:
    query = active_trackers(user_id).order_by(Tracker.position, Tracker.created_at)
    if not include_archived:
        query = query.where(Tracker.archived_at.is_(None))
    return list((await db.scalars(query)).all())


async def summaries(
    db: AsyncSession, user_id: UUID, trackers: list[Tracker]
) -> list[TrackerSummary]:
    """The trackers with the number of saved sessions in each."""
    rows = await db.execute(
        select(Session.tracker_id, func.count())
        .where(Session.user_id == user_id, Session.deleted_at.is_(None))
        .group_by(Session.tracker_id)
    )
    counts = {tracker_id: count for tracker_id, count in rows}
    return [
        TrackerSummary(
            **dict(TrackerOut.model_validate(tracker)), session_count=counts.get(tracker.id, 0)
        )
        for tracker in trackers
    ]


async def get_tracker(db: AsyncSession, user_id: UUID, tracker_id: UUID) -> Tracker:
    return await get_owned(db, Tracker, tracker_id, user_id)


async def _first_strength_tracker(db: AsyncSession, user_id: UUID) -> Tracker | None:
    query = (
        active_trackers(user_id)
        .where(Tracker.type == "strength", Tracker.archived_at.is_(None))
        .order_by(Tracker.position, Tracker.created_at)
        .limit(1)
    )
    return await db.scalar(query)


async def ensure_main_tracker(db: AsyncSession, user: UserAccount) -> None:
    """Keep the main tracker valid: an active strength tracker, else the first one, else none."""
    if user.main_tracker_id is not None:
        current = await db.get(Tracker, user.main_tracker_id)
        if current and current.deleted_at is None and current.archived_at is None:
            return
    first = await _first_strength_tracker(db, user.id)
    user.main_tracker_id = first.id if first else None


async def create_tracker(db: AsyncSession, user: UserAccount, data: TrackerCreate) -> Tracker:
    last_position = await db.scalar(
        select(func.max(Tracker.position)).where(
            Tracker.user_id == user.id, Tracker.deleted_at.is_(None)
        )
    )
    tracker = Tracker(
        user_id=user.id,
        position=0 if last_position is None else last_position + 1,
        **data.model_dump(),
    )
    db.add(tracker)
    await db.flush()
    await ensure_main_tracker(db, user)
    await db.commit()
    return tracker


async def update_tracker(
    db: AsyncSession, user: UserAccount, tracker_id: UUID, data: TrackerUpdate
) -> Tracker:
    tracker = await get_tracker(db, user.id, tracker_id)
    changes = data.model_dump(exclude_unset=True)
    unit_fields = {"counter_unit", "counter_unit_note"} & changes.keys()
    if unit_fields and tracker.general_mode != "counter":
        field = sorted(unit_fields)[0]
        raise field_error(field, "not_allowed", "Only counter trackers have a unit.")
    archived = changes.pop("archived", None)
    if archived is not None:
        tracker.archived_at = (tracker.archived_at or clock.utcnow()) if archived else None
    for field, value in changes.items():
        setattr(tracker, field, value)
    await db.flush()
    await ensure_main_tracker(db, user)
    await db.commit()
    await db.refresh(tracker)
    return tracker


async def delete_tracker(db: AsyncSession, user: UserAccount, tracker_id: UUID) -> None:
    """Soft-delete the tracker with its sessions and goals; archiving is the way to keep history.

    Books read in its sessions get their finished date recomputed, as when one session goes.
    """
    tracker = await get_tracker(db, user.id, tracker_id)
    now = clock.utcnow()
    live_sessions = (Session.tracker_id == tracker.id, Session.deleted_at.is_(None))
    books = set(
        (
            await db.scalars(
                select(ReadingEntry.book_id)
                .join(Session, Session.id == ReadingEntry.session_id)
                .where(*live_sessions)
            )
        ).all()
    )
    tracker.deleted_at = now
    await db.execute(update(Session).where(*live_sessions).values(deleted_at=now))
    await db.execute(
        update(Goal)
        .where(Goal.tracker_id == tracker.id, Goal.deleted_at.is_(None))
        .values(deleted_at=now, is_pinned=False)
    )
    await db.flush()
    await refresh_finished(db, user.id, books)
    await ensure_main_tracker(db, user)
    await db.commit()


async def set_main_tracker(db: AsyncSession, user: UserAccount, tracker_id: UUID) -> None:
    tracker = await db.get(Tracker, tracker_id)
    usable = (
        tracker is not None
        and tracker.user_id == user.id
        and tracker.deleted_at is None
        and tracker.archived_at is None
    )
    if not usable:
        raise field_error("main_tracker_id", "not_found", "Tracker not found.")
    if tracker.type != "strength":
        raise field_error("main_tracker_id", "not_strength", "The main tracker must be strength.")
    user.main_tracker_id = tracker.id
