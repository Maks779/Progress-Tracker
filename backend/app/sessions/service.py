from datetime import date, datetime, timedelta
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import clock
from app.books.models import Book
from app.errors import AppError, field_error, not_found
from app.exercises.models import Exercise
from app.goals.service import goals_for_tracker
from app.ownership import get_owned
from app.pagination import decode_cursor, encode_cursor
from app.sessions import rules
from app.sessions.history import session_records, strength_history
from app.sessions.models import (
    CardioEntry,
    GeneralEntry,
    ReadingEntry,
    Session,
    StrengthEntry,
    StrengthSet,
)
from app.sessions.reading import ReadingRow, reading_rows, refresh_finished
from app.sessions.schemas import (
    CardioIn,
    GeneralIn,
    Headline,
    ReadingIn,
    SessionListItem,
    SessionOut,
    SessionPage,
    SessionSaved,
    SessionStats,
    SessionWrite,
    StrengthEntryIn,
    StrengthEntryOut,
    StrengthOut,
    StrengthSetOut,
)
from app.trackers.models import Tracker
from app.users.models import UserAccount

PARTS = ("strength", "cardio", "reading", "general")
CLOCK_SKEW = timedelta(minutes=5)


def expected_part(tracker: Tracker) -> str | None:
    if tracker.type == "general":
        return "general" if tracker.general_mode == "counter" else None
    return tracker.type


def needs_duration(tracker: Tracker) -> bool:
    return tracker.type in ("strength", "cardio") or tracker.general_mode == "duration"


async def _tracker_for(db: AsyncSession, user: UserAccount, tracker_id: UUID) -> Tracker:
    tracker = await db.get(Tracker, tracker_id)
    if tracker is None or tracker.user_id != user.id or tracker.deleted_at is not None:
        raise field_error("tracker_id", "not_found", "Tracker not found.")
    return tracker


def _check_shape(tracker: Tracker, data: SessionWrite) -> None:
    expected = expected_part(tracker)
    for part in PARTS:
        given = getattr(data, part) is not None
        if given and part != expected:
            raise field_error(part, "not_allowed", f"A {tracker.type} session has no {part} part.")
        if not given and part == expected:
            raise field_error(part, "required", f"A {tracker.type} session needs a {part} part.")
    if needs_duration(tracker) and data.duration_s is None:
        raise field_error("duration_s", "required", "This session needs a duration.")
    if tracker.general_mode == "counter" and data.duration_s is not None:
        raise field_error("duration_s", "not_allowed", "Counter sessions have no duration.")


def _check_time(user: UserAccount, data: SessionWrite) -> None:
    if data.started_at > clock.utcnow() + CLOCK_SKEW:
        raise field_error("started_at", "in_future", "A session cannot start in the future.")
    local = data.started_at.astimezone(ZoneInfo(user.timezone)).date()
    if abs((data.local_date - local).days) > 1:
        raise field_error("local_date", "mismatch", "local_date does not match started_at.")


async def _check_strength(
    db: AsyncSession, user: UserAccount, session_id: UUID, data: SessionWrite
) -> None:
    entries = data.strength.exercises if data.strength else []
    if len({entry.position for entry in entries}) != len(entries):
        raise field_error("strength.exercises", "duplicate_position", "Positions must be unique.")
    if len({entry.id for entry in entries}) != len(entries):
        raise field_error("strength.exercises", "duplicate_id", "Entry IDs must be unique.")
    for index, entry in enumerate(entries):
        if len({s.position for s in entry.sets}) != len(entry.sets):
            raise field_error(
                f"strength.exercises[{index}].sets",
                "duplicate_position",
                "Positions must be unique.",
            )
    exercise_ids = {entry.exercise_id for entry in entries}
    found = await db.scalars(
        select(Exercise.id).where(
            Exercise.id.in_(exercise_ids),
            or_(Exercise.user_id.is_(None), Exercise.user_id == user.id),
        )
    )
    known = set(found.all())
    for index, entry in enumerate(entries):
        if entry.exercise_id not in known:
            raise field_error(
                f"strength.exercises[{index}].exercise_id", "not_found", "Exercise not found."
            )
    taken = await db.scalars(
        select(StrengthEntry.id).where(
            StrengthEntry.id.in_({entry.id for entry in entries}),
            StrengthEntry.session_id != session_id,
        )
    )
    if taken.first() is not None:
        raise field_error(
            "strength.exercises", "id_taken", "An entry ID belongs to another session."
        )
    _check_supersets(entries)


def _check_supersets(entries: list[StrengthEntryIn]) -> None:
    ordered = sorted(entries, key=lambda entry: entry.position)
    groups = [entry.superset_group for entry in ordered]
    seen: set[int] = set()
    for index, group in enumerate(groups):
        if group is None:
            continue
        starts_run = index == 0 or groups[index - 1] != group
        if starts_run and group in seen:
            raise field_error(
                "strength.exercises", "superset_split", "Superset exercises must be consecutive."
            )
        seen.add(group)
    for group in seen:
        if groups.count(group) < 2:
            raise field_error(
                "strength.exercises",
                "superset_too_small",
                "A superset needs two or more exercises.",
            )


def _neighbours(
    rows: list[ReadingRow], session_id: UUID, started_at: datetime
) -> tuple[ReadingRow | None, ReadingRow | None]:
    others = [row for row in rows if row.session_id != session_id]
    before = [row for row in others if (row.started_at, row.session_id) < (started_at, session_id)]
    after = [row for row in others if (row.started_at, row.session_id) > (started_at, session_id)]
    return (before[-1] if before else None), (after[0] if after else None)


async def _check_reading(
    db: AsyncSession,
    user: UserAccount,
    session_id: UUID,
    started_at: datetime,
    reading: ReadingIn,
) -> None:
    book = await db.get(Book, reading.book_id)
    if book is None or book.user_id != user.id or book.deleted_at is not None:
        raise field_error("reading.book_id", "not_found", "Book not found.")
    if reading.end_page > book.total_pages:
        raise field_error("reading.end_page", "after_last_page", "The book has fewer pages.")
    rows = await reading_rows(db, user.id, {book.id})
    previous, following = _neighbours(rows, session_id, started_at)
    previous_end = previous.end_page if previous else book.start_page
    if reading.end_page <= previous_end:
        raise field_error(
            "reading.end_page", "not_after_previous", f"Must be after page {previous_end}."
        )
    if following is not None and following.end_page <= reading.end_page:
        raise field_error(
            "reading.end_page",
            "conflicts_with_later",
            f"A later session already ended on page {following.end_page}.",
        )


def _build_parts(session: Session, data: SessionWrite) -> None:
    if data.strength is not None:
        session.strength_entries = [
            StrengthEntry(
                id=entry.id,
                exercise_id=entry.exercise_id,
                position=entry.position,
                superset_group=entry.superset_group,
                sets=[
                    StrengthSet(
                        position=s.position, weight_kg=s.weight_kg, reps=s.reps, kind=s.kind
                    )
                    for s in entry.sets
                ],
            )
            for entry in data.strength.exercises
        ]
    if data.cardio is not None:
        session.cardio_entry = CardioEntry(distance_m=data.cardio.distance_m)
    if data.reading is not None:
        session.reading_entry = ReadingEntry(
            book_id=data.reading.book_id, end_page=data.reading.end_page
        )
    if data.general is not None:
        session.general_entry = GeneralEntry(count=data.general.count)


async def _clear_parts(db: AsyncSession, session: Session) -> None:
    session.strength_entries.clear()
    session.cardio_entry = None
    session.reading_entry = None
    session.general_entry = None
    await db.flush()


def _set_data(session: Session) -> list[rules.SetData]:
    return [
        rules.SetData(s.weight_kg, s.reps, s.kind)
        for entry in session.strength_entries
        for s in entry.sets
    ]


def stats_for(session: Session, pages_read: int | None) -> SessionStats:
    stats = SessionStats()
    if session.strength_entries:
        sets = _set_data(session)
        stats.volume_kg = rules.session_volume(sets)
        stats.working_sets = rules.working_set_count(sets)
    if session.reading_entry is not None:
        stats.pages_read = pages_read
    distance = session.cardio_entry.distance_m if session.cardio_entry else None
    if distance and session.duration_s:
        stats.pace_s_per_km = round(session.duration_s * 1000 / distance)
    return stats


def headline_for(session: Session, tracker: Tracker, pages_read: int | None) -> Headline:
    if tracker.type == "strength":
        volume = rules.session_volume(_set_data(session))
        return Headline(metric="volume_kg", value=float(volume))
    if session.cardio_entry is not None and session.cardio_entry.distance_m:
        return Headline(metric="distance_m", value=session.cardio_entry.distance_m)
    if session.reading_entry is not None:
        return Headline(metric="pages", value=pages_read or 0)
    if session.general_entry is not None:
        return Headline(
            metric="count", value=session.general_entry.count, unit_label=tracker.counter_unit
        )
    return Headline(metric="duration_s", value=session.duration_s or 0)


async def _pages_by_session(db: AsyncSession, user_id: UUID) -> dict[UUID, int]:
    return {row.session_id: row.pages_read for row in await reading_rows(db, user_id)}


def session_out(
    session: Session, tracker: Tracker, pages_read: int | None, record_count: int
) -> SessionOut:
    strength = None
    if session.strength_entries:
        strength = StrengthOut(
            exercises=[
                StrengthEntryOut(
                    id=entry.id,
                    exercise_id=entry.exercise_id,
                    position=entry.position,
                    superset_group=entry.superset_group,
                    sets=[
                        StrengthSetOut(
                            position=s.position, weight_kg=s.weight_kg, reps=s.reps, kind=s.kind
                        )
                        for s in entry.sets
                    ],
                )
                for entry in session.strength_entries
            ]
        )
    return SessionOut(
        id=session.id,
        tracker_id=session.tracker_id,
        tracker_type=tracker.type,
        started_at=session.started_at,
        local_date=session.local_date,
        duration_s=session.duration_s,
        name=session.name,
        note=session.note,
        strength=strength,
        cardio=CardioIn(distance_m=session.cardio_entry.distance_m)
        if session.cardio_entry
        else None,
        reading=ReadingIn(
            book_id=session.reading_entry.book_id, end_page=session.reading_entry.end_page
        )
        if session.reading_entry
        else None,
        general=GeneralIn(count=session.general_entry.count) if session.general_entry else None,
        stats=stats_for(session, pages_read),
        record_count=record_count,
        created_at=session.created_at,
        updated_at=session.updated_at,
    )


async def describe(db: AsyncSession, user: UserAccount, session: Session) -> SessionSaved:
    tracker = await db.get(Tracker, session.tracker_id)
    pages = (await _pages_by_session(db, user.id)).get(session.id)
    records = []
    if session.strength_entries:
        exercise_ids = {entry.exercise_id for entry in session.strength_entries}
        history = await strength_history(db, user.id, exercise_ids)
        records = session_records(history, session.id, session.started_at)
    return SessionSaved(
        session=session_out(session, tracker, pages, len(records)),
        new_records=records,
        goals=await goals_for_tracker(db, user, tracker.id),
    )


async def put_session(
    db: AsyncSession, user: UserAccount, session_id: UUID, data: SessionWrite
) -> tuple[SessionSaved, bool]:
    """Create or replace a session as a whole under a client-generated ID."""
    existing = await db.get(Session, session_id)
    if existing is not None and (existing.user_id != user.id or existing.deleted_at is not None):
        raise not_found()
    tracker = await _tracker_for(db, user, data.tracker_id)
    _check_shape(tracker, data)
    _check_time(user, data)
    if data.strength is not None:
        await _check_strength(db, user, session_id, data)
    if data.reading is not None:
        await _check_reading(db, user, session_id, data.started_at, data.reading)

    touched_books = {data.reading.book_id} if data.reading else set()
    if existing is None:
        session = Session(id=session_id, user_id=user.id)
        db.add(session)
    else:
        session = existing
        if session.reading_entry is not None:
            touched_books.add(session.reading_entry.book_id)
        await _clear_parts(db, session)

    session.tracker_id = tracker.id
    session.started_at = data.started_at
    session.local_date = data.local_date
    session.duration_s = data.duration_s
    session.name = data.name or (tracker.name if tracker.type == "strength" else None)
    session.note = data.note
    _build_parts(session, data)
    await db.flush()
    await refresh_finished(db, user.id, touched_books)
    await db.commit()
    await db.refresh(session)
    return await describe(db, user, session), existing is None


async def get_session(db: AsyncSession, user: UserAccount, session_id: UUID) -> SessionOut:
    session = await get_owned(db, Session, session_id, user.id)
    return (await describe(db, user, session)).session


async def delete_session(db: AsyncSession, user: UserAccount, session_id: UUID) -> None:
    session = await get_owned(db, Session, session_id, user.id)
    session.deleted_at = clock.utcnow()
    await db.flush()
    if session.reading_entry is not None:
        await refresh_finished(db, user.id, {session.reading_entry.book_id})
    await db.commit()


async def restore_session(db: AsyncSession, user: UserAccount, session_id: UUID) -> SessionOut:
    session = await db.get(Session, session_id)
    if session is None or session.user_id != user.id:
        raise not_found()
    if session.deleted_at is not None:
        if session.reading_entry is not None:
            reading = ReadingIn(
                book_id=session.reading_entry.book_id, end_page=session.reading_entry.end_page
            )
            try:
                await _check_reading(db, user, session.id, session.started_at, reading)
            except AppError as error:
                raise AppError(
                    409, detail="Later reading sessions conflict with this one."
                ) from error
        session.deleted_at = None
        await db.flush()
        if session.reading_entry is not None:
            await refresh_finished(db, user.id, {session.reading_entry.book_id})
        await db.commit()
        await db.refresh(session)
    return (await describe(db, user, session)).session


async def list_sessions(
    db: AsyncSession,
    user: UserAccount,
    tracker_id: UUID | None,
    from_date: date | None,
    to_date: date | None,
    limit: int,
    cursor: str | None,
) -> SessionPage:
    query = (
        select(Session, Tracker)
        .join(Tracker, Tracker.id == Session.tracker_id)
        .where(Session.user_id == user.id, Session.deleted_at.is_(None))
        .order_by(Session.started_at.desc(), Session.id.desc())
        .limit(limit + 1)
    )
    if tracker_id is not None:
        query = query.where(Session.tracker_id == tracker_id)
    if from_date is not None:
        query = query.where(Session.local_date >= from_date)
    if to_date is not None:
        query = query.where(Session.local_date <= to_date)
    if cursor is not None:
        position = decode_cursor(cursor)
        try:
            started_at = datetime.fromisoformat(position["t"])
            last_id = UUID(position["id"])
        except (KeyError, TypeError, ValueError) as error:
            raise field_error("cursor", "invalid", "The cursor is not valid.") from error
        query = query.where(
            or_(
                Session.started_at < started_at,
                (Session.started_at == started_at) & (Session.id < last_id),
            )
        )
    rows = (await db.execute(query)).all()
    page, more = rows[:limit], len(rows) > limit
    pages = await _pages_by_session(db, user.id)
    book_ids = {s.reading_entry.book_id for s, _ in page if s.reading_entry is not None}
    titles = {}
    if book_ids:
        books = await db.scalars(select(Book).where(Book.id.in_(book_ids)))
        titles = {book.id: book.title for book in books}
    items = [
        SessionListItem(
            id=session.id,
            tracker_id=tracker.id,
            tracker_type=tracker.type,
            name=session.name
            or (titles.get(session.reading_entry.book_id) if session.reading_entry else None)
            or tracker.name,
            started_at=session.started_at,
            local_date=session.local_date,
            duration_s=session.duration_s,
            headline=headline_for(session, tracker, pages.get(session.id)),
        )
        for session, tracker in page
    ]
    next_cursor = None
    if more and page:
        last = page[-1][0]
        next_cursor = encode_cursor({"t": last.started_at.isoformat(), "id": str(last.id)})
    return SessionPage(items=items, next_cursor=next_cursor)
