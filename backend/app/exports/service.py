import csv
import io
import re
from datetime import UTC, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import clock
from app.books import service as books
from app.books.models import Book
from app.books.schemas import BookOut
from app.exercises.catalog import CATALOG
from app.exercises.models import Exercise
from app.exercises.schemas import ExerciseOut
from app.exercises.service import to_out as exercise_out
from app.goals import service as goals
from app.goals.schemas import GoalOut
from app.sessions import service as sessions
from app.sessions.history import session_records, strength_history
from app.sessions.models import Session
from app.sessions.reading import reading_rows
from app.sessions.schemas import SessionOut
from app.trackers.models import Tracker
from app.trackers.schemas import TrackerOut
from app.trackers.service import get_tracker
from app.users.models import UserAccount
from app.users.schemas import Me


class Export(BaseModel):
    exported_at: datetime
    user: Me
    trackers: list[TrackerOut]
    exercises: list[ExerciseOut]
    books: list[BookOut]
    sessions: list[SessionOut]
    goals: list[GoalOut]


async def _active_sessions(
    db: AsyncSession, user_id: UUID, tracker_id: UUID | None = None
) -> list[Session]:
    query = (
        select(Session)
        .where(Session.user_id == user_id, Session.deleted_at.is_(None))
        .order_by(Session.started_at, Session.id)
    )
    if tracker_id is not None:
        query = query.where(Session.tracker_id == tracker_id)
    return list((await db.scalars(query)).all())


async def export_json(db: AsyncSession, user: UserAccount) -> Export:
    """Everything the user owns, deleted rows excluded."""
    trackers = list(
        (
            await db.scalars(
                select(Tracker)
                .where(Tracker.user_id == user.id, Tracker.deleted_at.is_(None))
                .order_by(Tracker.position)
            )
        ).all()
    )
    tracker_by_id = {tracker.id: tracker for tracker in trackers}
    all_sessions = await _active_sessions(db, user.id)
    pages = {row.session_id: row.pages_read for row in await reading_rows(db, user.id)}
    used_ids = {entry.exercise_id for session in all_sessions for entry in session.strength_entries}
    exercises = (
        await db.scalars(
            select(Exercise).where(
                or_(
                    and_(Exercise.user_id == user.id, Exercise.deleted_at.is_(None)),
                    Exercise.id.in_(used_ids),
                )
            )
        )
    ).all()
    owned_books = list(
        (
            await db.scalars(select(Book).where(Book.user_id == user.id, Book.deleted_at.is_(None)))
        ).all()
    )
    goal_rows = list((await db.scalars(goals.active_goals(user.id))).all())
    history = await strength_history(db, user.id)

    def record_count(session: Session) -> int:
        if not session.strength_entries:
            return 0
        return len(session_records(history, session.id, session.started_at))

    return Export(
        exported_at=clock.utcnow(),
        user=Me.model_validate(user),
        trackers=[TrackerOut.model_validate(tracker) for tracker in trackers],
        exercises=[exercise_out(exercise, None) for exercise in exercises],
        books=await books.describe(db, user, owned_books),
        sessions=[
            sessions.session_out(
                session,
                tracker_by_id[session.tracker_id],
                pages.get(session.id),
                record_count(session),
            )
            for session in all_sessions
            if session.tracker_id in tracker_by_id
        ],
        goals=await goals.describe(db, user, goal_rows),
    )


def _number(value: Decimal | int | None) -> str:
    if value is None:
        return ""
    if isinstance(value, Decimal):
        return format(value.normalize(), "f")
    return str(value)


def _text(value: str | None) -> str:
    return value or ""


def filename(tracker: Tracker) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", tracker.name.lower()).strip("-") or "tracker"
    return f"ember-{slug}.csv"


async def export_csv(db: AsyncSession, user: UserAccount, tracker_id: UUID) -> str:
    """One tracker as CSV: a row per set for strength, a row per session otherwise."""
    tracker = await get_tracker(db, user.id, tracker_id)
    rows = await _active_sessions(db, user.id, tracker.id)
    output = io.StringIO()
    output.write("﻿")
    writer = csv.writer(output, lineterminator="\n")
    base = ["session_id", "local_date", "started_at_utc", "duration_s"]

    def common(session: Session) -> list[str]:
        started = session.started_at.astimezone(UTC).isoformat()
        return [
            str(session.id),
            session.local_date.isoformat(),
            started,
            _number(session.duration_s),
        ]

    if tracker.type == "strength":
        names = await _exercise_names(db, rows)
        writer.writerow(
            [
                *base,
                "session_name",
                "exercise",
                "superset_group",
                "set",
                "kind",
                "weight_kg",
                "reps",
                "note",
            ]
        )
        for session in rows:
            for entry in session.strength_entries:
                for s in entry.sets:
                    writer.writerow(
                        [
                            *common(session),
                            _text(session.name),
                            names.get(entry.exercise_id, ""),
                            _number(entry.superset_group),
                            s.position + 1,
                            s.kind,
                            _number(s.weight_kg),
                            s.reps,
                            _text(session.note),
                        ]
                    )
    elif tracker.type == "cardio":
        writer.writerow([*base, "distance_m", "note"])
        for session in rows:
            distance = session.cardio_entry.distance_m if session.cardio_entry else None
            writer.writerow([*common(session), _number(distance), _text(session.note)])
    elif tracker.type == "reading":
        pages = {row.session_id: row.pages_read for row in await reading_rows(db, user.id)}
        titles = await _book_titles(db, rows)
        writer.writerow([*base, "book", "end_page", "pages_read", "note"])
        for session in rows:
            entry = session.reading_entry
            writer.writerow(
                [
                    *common(session),
                    titles.get(entry.book_id, "") if entry else "",
                    _number(entry.end_page if entry else None),
                    _number(pages.get(session.id)),
                    _text(session.note),
                ]
            )
    else:
        writer.writerow([*base, "count", "unit", "note"])
        for session in rows:
            count = session.general_entry.count if session.general_entry else None
            writer.writerow(
                [
                    *common(session),
                    _number(count),
                    _text(tracker.counter_unit),
                    _text(session.note),
                ]
            )
    return output.getvalue()


async def _exercise_names(db: AsyncSession, rows: list[Session]) -> dict[UUID, str]:
    ids = {entry.exercise_id for session in rows for entry in session.strength_entries}
    if not ids:
        return {}
    exercises = await db.scalars(select(Exercise).where(Exercise.id.in_(ids)))
    return {e.id: e.name or CATALOG.get(e.key or "", e.key or "") for e in exercises}


async def _book_titles(db: AsyncSession, rows: list[Session]) -> dict[UUID, str]:
    ids = {session.reading_entry.book_id for session in rows if session.reading_entry}
    if not ids:
        return {}
    found = await db.scalars(select(Book).where(Book.id.in_(ids)))
    return {book.id: book.title for book in found}
