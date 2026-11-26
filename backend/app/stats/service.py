from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import clock
from app.books.models import Book
from app.goals import service as goals
from app.goals.models import Goal
from app.goals.rules import week_start
from app.sessions import rules as session_rules
from app.sessions import service as sessions
from app.sessions.models import Session, StrengthEntry, StrengthSet
from app.sessions.reading import reading_rows
from app.stats import rules
from app.stats.schemas import (
    Bucket,
    CalendarDay,
    CalendarMonth,
    Consistency,
    ExercisePoint,
    ExerciseProgress,
    HomeStats,
    ProgressStats,
    ProgressTotals,
    UpNext,
    WeekDay,
)
from app.trackers.models import Tracker
from app.users.models import UserAccount


async def sessions_between(
    db: AsyncSession, user_id: UUID, start: date, end: date, tracker_id: UUID | None = None
) -> list[Session]:
    query = select(Session).where(
        Session.user_id == user_id,
        Session.deleted_at.is_(None),
        Session.local_date >= start,
        Session.local_date <= end,
    )
    if tracker_id is not None:
        query = query.where(Session.tracker_id == tracker_id)
    return list((await db.scalars(query)).all())


def volume(session: Session) -> Decimal:
    return session_rules.session_volume(
        [
            session_rules.SetData(s.weight_kg, s.reps, s.kind)
            for entry in session.strength_entries
            for s in entry.sets
        ]
    )


def week_days(week: list[Session]) -> list[WeekDay]:
    """Each day of the week with sessions, with its trackers in the order they were logged."""
    trackers: dict[date, list[UUID]] = defaultdict(list)
    for session in sorted(week, key=lambda s: (s.started_at, s.id)):
        if session.tracker_id not in trackers[session.local_date]:
            trackers[session.local_date].append(session.tracker_id)
    return [WeekDay(local_date=day, tracker_ids=ids) for day, ids in sorted(trackers.items())]


async def home(db: AsyncSession, user: UserAccount) -> HomeStats:
    today = clock.today_in(user.timezone)
    monday = week_start(today)
    week = await sessions_between(db, user.id, monday, monday + timedelta(days=6))
    pages = {row.session_id: row.pages_read for row in await reading_rows(db, user.id)}

    pinned = None
    up_next = None
    if user.main_tracker_id is not None:
        goal = await db.scalar(
            select(Goal).where(
                Goal.tracker_id == user.main_tracker_id,
                Goal.deleted_at.is_(None),
                Goal.is_pinned,
            )
        )
        if goal is not None:
            pinned = (await goals.describe(db, user, [goal]))[0]
        last = await db.scalar(
            select(Session)
            .where(
                Session.tracker_id == user.main_tracker_id,
                Session.deleted_at.is_(None),
            )
            .order_by(Session.started_at.desc(), Session.id.desc())
            .limit(1)
        )
        if last is not None:
            up_next = UpNext(
                session_id=last.id,
                name=last.name or "",
                exercise_count=len(last.strength_entries),
                estimated_duration_s=last.duration_s,
            )

    recent = await sessions.list_sessions(db, user, None, None, None, 3, None)
    return HomeStats(
        week_start=monday,
        main_tracker_id=user.main_tracker_id,
        pinned_goal=pinned,
        active_time_s=sum(s.duration_s or 0 for s in week),
        volume_kg=sum((volume(s) for s in week), Decimal(0)),
        pages_read=sum(pages.get(s.id, 0) for s in week),
        recent_sessions=recent.items,
        up_next=up_next,
        week_days=week_days(week),
    )


async def calendar(
    db: AsyncSession, user: UserAccount, month: str, tracker_id: UUID | None
) -> CalendarMonth:
    year, number = (int(part) for part in month.split("-"))
    start, end = rules.month_bounds(year, number)
    rows = await db.execute(
        select(Session.local_date, Tracker.type, Session.duration_s)
        .join(Tracker, Tracker.id == Session.tracker_id)
        .where(
            Session.user_id == user.id,
            Session.deleted_at.is_(None),
            Session.local_date >= start,
            Session.local_date <= end,
            *([Session.tracker_id == tracker_id] if tracker_id else []),
        )
    )
    types: dict[date, set[str]] = defaultdict(set)
    count, active = 0, 0
    for local_date, tracker_type, duration in rows:
        types[local_date].add(tracker_type)
        count += 1
        active += duration or 0
    order = ("strength", "cardio", "reading", "general")
    return CalendarMonth(
        month=month,
        days=[
            CalendarDay(local_date=day, tracker_types=[t for t in order if t in types[day]])
            for day in sorted(types)
        ],
        session_count=count,
        active_time_s=active,
    )


async def _first_session_date(
    db: AsyncSession, user_id: UUID, tracker_id: UUID | None
) -> date | None:
    query = select(func.min(Session.local_date)).where(
        Session.user_id == user_id, Session.deleted_at.is_(None)
    )
    if tracker_id is not None:
        query = query.where(Session.tracker_id == tracker_id)
    return await db.scalar(query)


async def progress(
    db: AsyncSession, user: UserAccount, period: rules.Period, tracker_id: UUID | None
) -> ProgressStats:
    today = clock.today_in(user.timezone)
    first = await _first_session_date(db, user.id, tracker_id)
    start, end = rules.period_range(period, today, first)
    kind = rules.bucket_kind(period)
    in_period = await sessions_between(db, user.id, start, end, tracker_id)
    pages = {row.session_id: row.pages_read for row in await reading_rows(db, user.id)}

    volume_buckets = {day: Decimal(0) for day in rules.bucket_starts(kind, start, end)}
    page_buckets = dict.fromkeys(volume_buckets, Decimal(0))
    for session in in_period:
        bucket = rules.bucket_of(kind, session.local_date)
        volume_buckets[bucket] += volume(session)
        page_buckets[bucket] += pages.get(session.id, 0)

    total_volume = sum(volume_buckets.values(), Decimal(0))
    change = None
    if period != "all":
        previous_start, previous_end = rules.previous_range(start, end)
        previous = await sessions_between(db, user.id, previous_start, previous_end, tracker_id)
        change = rules.change_percent(total_volume, sum((volume(s) for s in previous), Decimal(0)))

    books_query = (
        select(func.count())
        .select_from(Book)
        .where(
            Book.user_id == user.id,
            Book.deleted_at.is_(None),
            Book.finished_date >= start,
            Book.finished_date <= end,
        )
    )
    active_days = sorted({session.local_date for session in in_period})
    return ProgressStats(
        period=period,
        bucket=kind,
        volume_kg=[Bucket(start_date=day, value=value) for day, value in volume_buckets.items()],
        pages=[Bucket(start_date=day, value=value) for day, value in page_buckets.items()],
        consistency=Consistency(active_days=len(active_days), days=active_days),
        totals=ProgressTotals(
            volume_kg=total_volume,
            volume_change_percent=change,
            pages_read=int(sum(page_buckets.values())),
            books_read=await db.scalar(books_query) or 0,
        ),
    )


async def exercise_progress(
    db: AsyncSession, user: UserAccount, exercise_id: UUID, period: rules.Period
) -> ExerciseProgress:
    """One point per session: the heaviest completed working set of the exercise."""
    today = clock.today_in(user.timezone)
    base = (
        select(
            Session.id,
            Session.local_date,
            func.max(StrengthSet.weight_kg),
        )
        .join(StrengthEntry, StrengthEntry.session_id == Session.id)
        .join(StrengthSet, StrengthSet.strength_entry_id == StrengthEntry.id)
        .where(
            Session.user_id == user.id,
            Session.deleted_at.is_(None),
            StrengthEntry.exercise_id == exercise_id,
            StrengthSet.kind == "working",
            StrengthSet.weight_kg.is_not(None),
        )
        .group_by(Session.id, Session.local_date, Session.started_at)
        .order_by(Session.started_at)
    )
    rows = (await db.execute(base)).all()
    first = rows[0][1] if rows else None
    start, end = rules.period_range(period, today, first)
    points = [
        ExercisePoint(session_id=session_id, local_date=local_date, weight_kg=weight)
        for session_id, local_date, weight in rows
        if start <= local_date <= end
    ]
    change = points[-1].weight_kg - points[0].weight_kg if len(points) >= 2 else None
    return ExerciseProgress(exercise_id=exercise_id, period=period, change_kg=change, points=points)
