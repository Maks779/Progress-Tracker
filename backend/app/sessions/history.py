"""Strength history: prefill values and personal records, read from saved sessions."""

from collections import defaultdict
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.sessions.models import Session, StrengthEntry, StrengthSet
from app.sessions.records import RECORD_TYPES, LoggedSet, Record, bests, new_records
from app.sessions.schemas import LastSets, RecordOut, StrengthSetOut


@dataclass(frozen=True)
class TimedSet:
    order: tuple[datetime, UUID]
    logged: LoggedSet


History = dict[UUID, list[TimedSet]]


async def strength_history(
    db: AsyncSession, user_id: UUID, exercise_ids: set[UUID] | None = None
) -> History:
    """Completed working sets per exercise, oldest first."""
    query = (
        select(
            StrengthEntry.exercise_id,
            StrengthSet.weight_kg,
            StrengthSet.reps,
            Session.id,
            Session.local_date,
            Session.started_at,
        )
        .join(StrengthEntry, StrengthEntry.id == StrengthSet.strength_entry_id)
        .join(Session, Session.id == StrengthEntry.session_id)
        .where(
            Session.user_id == user_id,
            Session.deleted_at.is_(None),
            StrengthSet.kind == "working",
        )
        .order_by(Session.started_at, Session.id, StrengthEntry.position, StrengthSet.position)
    )
    if exercise_ids is not None:
        query = query.where(StrengthEntry.exercise_id.in_(exercise_ids))
    history: History = defaultdict(list)
    for exercise_id, weight, reps, session_id, local_date, started_at in await db.execute(query):
        logged = LoggedSet(weight, reps, session_id, local_date)
        history[exercise_id].append(TimedSet((started_at, session_id), logged))
    return history


def record_out(exercise_id: UUID, record: Record) -> RecordOut:
    return RecordOut(
        exercise_id=exercise_id,
        record_type=record.record_type,
        value=record.value,
        weight_kg=record.set.weight_kg,
        reps=record.set.reps,
        session_id=record.set.session_id,
        local_date=record.set.local_date,
    )


def session_records(history: History, session_id: UUID, started_at: datetime) -> list[RecordOut]:
    """Records a session set, compared with every earlier session (back-dated ones included)."""
    order = (started_at, session_id)
    result = []
    for exercise_id, sets in history.items():
        current = [timed.logged for timed in sets if timed.logged.session_id == session_id]
        if not current:
            continue
        earlier = [
            timed.logged
            for timed in sets
            if timed.order < order and timed.logged.session_id != session_id
        ]
        result.extend(record_out(exercise_id, record) for record in new_records(earlier, current))
    return result


def exercise_bests(history: History, exercise_id: UUID) -> dict[str, RecordOut]:
    sets = [timed.logged for timed in history.get(exercise_id, [])]
    return {kind: record_out(exercise_id, record) for kind, record in bests(sets).items()}


def all_records(history: History) -> list[tuple[RecordOut, bool]]:
    """Current records of every exercise, newest first, each flagged if it beat an earlier value."""
    result = []
    for exercise_id, sets in history.items():
        for record in bests(timed.logged for timed in sets).values():
            achieved = next(
                timed.order for timed in sets if timed.logged.session_id == record.set.session_id
            )
            beat_earlier = any(timed.order < achieved for timed in sets)
            result.append((record_out(exercise_id, record), beat_earlier))
    order = {kind: index for index, kind in enumerate(RECORD_TYPES)}
    result.sort(key=lambda item: (str(item[0].exercise_id), order[item[0].record_type]))
    result.sort(key=lambda item: item[0].local_date, reverse=True)
    return result


def new_this_week(records: list[tuple[RecordOut, bool]], today: date) -> int:
    week_start = today - timedelta(days=today.weekday())
    return sum(1 for record, beat in records if beat and record.local_date >= week_start)


async def last_sets(db: AsyncSession, user_id: UUID, exercise_id: UUID) -> LastSets:
    query = (
        select(StrengthEntry, Session.id, Session.local_date)
        .join(Session, Session.id == StrengthEntry.session_id)
        .where(
            Session.user_id == user_id,
            Session.deleted_at.is_(None),
            StrengthEntry.exercise_id == exercise_id,
        )
        .order_by(Session.started_at.desc(), Session.id.desc())
        .limit(1)
    )
    row = (await db.execute(query)).first()
    if row is None:
        return LastSets(exercise_id=exercise_id, session_id=None, local_date=None, sets=[])
    entry, session_id, local_date = row
    return LastSets(
        exercise_id=exercise_id,
        session_id=session_id,
        local_date=local_date,
        sets=[
            StrengthSetOut(position=s.position, weight_kg=s.weight_kg, reps=s.reps, kind=s.kind)
            for s in entry.sets
        ],
    )
