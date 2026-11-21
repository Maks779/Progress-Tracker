from collections import defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import clock
from app.books.models import Book
from app.errors import conflict, field_error
from app.goals import rules
from app.goals.models import Goal, GoalTarget
from app.goals.schemas import GoalCreate, GoalOut, GoalProgressOut, GoalUpdate
from app.ownership import get_owned
from app.sessions.models import ReadingEntry, Session
from app.sessions.reading import reading_rows
from app.trackers.models import Tracker
from app.users.models import UserAccount

AMOUNT_METRICS = {
    "cardio": {"distance", "duration"},
    "reading": {"pages", "duration"},
}
CUMULATIVE_METRICS = {
    "strength": {"sessions"},
    "cardio": {"sessions", "distance", "duration"},
    "reading": {"books", "pages", "duration"},
}


def allowed_metrics(tracker: Tracker, kind: str) -> set[str]:
    general_metric = "count" if tracker.general_mode == "counter" else "duration"
    if kind == "frequency":
        return {"sessions"}
    if kind == "amount":
        return (
            {general_metric}
            if tracker.type == "general"
            else AMOUNT_METRICS.get(tracker.type, set())
        )
    if tracker.type == "general":
        return {"sessions", general_metric}
    return CUMULATIVE_METRICS[tracker.type]


@dataclass(frozen=True)
class Fact:
    local_date: date
    values: dict[str, int]


@dataclass(frozen=True)
class TrackerHistory:
    facts: list[Fact]
    finished_books: list[date]

    def total(self, metric: str, start: date, end: date) -> Decimal:
        if metric == "books":
            return Decimal(sum(1 for day in self.finished_books if start <= day <= end))
        return Decimal(
            sum(fact.values[metric] for fact in self.facts if start <= fact.local_date <= end)
        )


async def tracker_histories(
    db: AsyncSession, user_id: UUID, tracker_ids: set[UUID]
) -> dict[UUID, TrackerHistory]:
    """Per-session metric values and book finish dates of the given trackers."""
    if not tracker_ids:
        return {}
    pages = {row.session_id: row.pages_read for row in await reading_rows(db, user_id)}
    sessions = await db.scalars(
        select(Session).where(
            Session.user_id == user_id,
            Session.deleted_at.is_(None),
            Session.tracker_id.in_(tracker_ids),
        )
    )
    facts: dict[UUID, list[Fact]] = defaultdict(list)
    for session in sessions:
        cardio, general = session.cardio_entry, session.general_entry
        facts[session.tracker_id].append(
            Fact(
                session.local_date,
                {
                    "sessions": 1,
                    "distance": (cardio.distance_m or 0) if cardio else 0,
                    "duration": session.duration_s or 0,
                    "pages": pages.get(session.id, 0),
                    "count": general.count if general else 0,
                },
            )
        )
    finished = await db.execute(
        select(Session.tracker_id, Book.id, Book.finished_date)
        .distinct()
        .join(ReadingEntry, ReadingEntry.session_id == Session.id)
        .join(Book, Book.id == ReadingEntry.book_id)
        .where(
            Session.user_id == user_id,
            Session.deleted_at.is_(None),
            Session.tracker_id.in_(tracker_ids),
            Book.deleted_at.is_(None),
            Book.finished_date.is_not(None),
        )
    )
    books: dict[UUID, list[date]] = defaultdict(list)
    for tracker_id, _, finished_date in finished:
        books[tracker_id].append(finished_date)
    return {
        tracker_id: TrackerHistory(facts.get(tracker_id, []), books.get(tracker_id, []))
        for tracker_id in tracker_ids
    }


def _versions(goal: Goal) -> list[tuple[date, Decimal]]:
    return [(version.effective_from, Decimal(version.target)) for version in goal.targets]


def goal_out(goal: Goal, history: TrackerHistory, today: date) -> GoalOut:
    versions = _versions(goal)
    start, end = rules.current_period(goal.kind, goal.period, today, goal.start_date, goal.end_date)
    target = versions[-1][1] if goal.kind == "cumulative" else rules.target_on(versions, start)
    value = history.total(goal.metric, start, end)
    progress = rules.status(goal.kind, goal.period, value, target, start, end, today)
    streak = None
    if goal.period == "week":
        streak = rules.weekly_streak(
            rules.week_start(goal.start_date),
            today,
            lambda monday: history.total(goal.metric, monday, monday + timedelta(days=6)),
            lambda monday: rules.target_on(versions, monday),
        )
    return GoalOut(
        id=goal.id,
        tracker_id=goal.tracker_id,
        kind=goal.kind,
        period=goal.period,
        metric=goal.metric,
        name=goal.name,
        start_date=goal.start_date,
        end_date=goal.end_date,
        is_pinned=goal.is_pinned,
        target=target,
        progress=GoalProgressOut(
            period_start=progress.period_start,
            period_end=progress.period_end,
            value=progress.value,
            target=progress.target,
            expected=progress.expected,
            status=progress.status,
        ),
        streak_weeks=streak,
        created_at=goal.created_at,
        updated_at=goal.updated_at,
    )


async def describe(db: AsyncSession, user: UserAccount, goals: list[Goal]) -> list[GoalOut]:
    histories = await tracker_histories(db, user.id, {goal.tracker_id for goal in goals})
    today = clock.today_in(user.timezone)
    return [goal_out(goal, histories[goal.tracker_id], today) for goal in goals]


def active_goals(user_id: UUID):
    return select(Goal).where(Goal.user_id == user_id, Goal.deleted_at.is_(None))


async def list_goals(db: AsyncSession, user: UserAccount, tracker_id: UUID | None) -> list[GoalOut]:
    query = active_goals(user.id).order_by(Goal.created_at)
    if tracker_id is not None:
        query = query.where(Goal.tracker_id == tracker_id)
    return await describe(db, user, list((await db.scalars(query)).all()))


async def goals_for_tracker(db: AsyncSession, user: UserAccount, tracker_id: UUID) -> list[GoalOut]:
    return await list_goals(db, user, tracker_id)


async def get_goal(db: AsyncSession, user: UserAccount, goal_id: UUID) -> GoalOut:
    goal = await get_owned(db, Goal, goal_id, user.id)
    return (await describe(db, user, [goal]))[0]


async def _weekly_goals(db: AsyncSession, tracker_id: UUID) -> list[Goal]:
    query = (
        select(Goal)
        .where(Goal.tracker_id == tracker_id, Goal.deleted_at.is_(None), Goal.period == "week")
        .order_by(Goal.created_at)
    )
    return list((await db.scalars(query)).all())


async def _pin(db: AsyncSession, goal: Goal) -> None:
    for other in await _weekly_goals(db, goal.tracker_id):
        if other.id != goal.id and other.is_pinned:
            other.is_pinned = False
    await db.flush()
    goal.is_pinned = True


def _effective_from(goal_period: str | None, today: date, start: date) -> date:
    if goal_period == "week":
        return rules.week_start(today)
    if goal_period == "day":
        return today
    return min(start, today)


async def create_goal(db: AsyncSession, user: UserAccount, data: GoalCreate) -> GoalOut:
    tracker = await db.get(Tracker, data.tracker_id)
    if tracker is None or tracker.user_id != user.id or tracker.deleted_at is not None:
        raise field_error("tracker_id", "not_found", "Tracker not found.")
    if data.metric not in allowed_metrics(tracker, data.kind):
        raise field_error("metric", "not_allowed", f"Not available for this {tracker.type} goal.")
    if data.kind != "cumulative":
        duplicate = await db.scalar(
            select(Goal.id).where(
                Goal.tracker_id == tracker.id,
                Goal.deleted_at.is_(None),
                Goal.kind == data.kind,
                Goal.period == data.period,
                Goal.metric == data.metric,
            )
        )
        if duplicate is not None:
            raise conflict("goal_exists", "This tracker already has a goal like this.")
    today = clock.today_in(user.timezone)
    start = data.start_date or today
    goal = Goal(
        user_id=user.id,
        tracker_id=tracker.id,
        kind=data.kind,
        period=data.period,
        metric=data.metric,
        name=data.name,
        start_date=start,
        end_date=data.end_date,
        is_pinned=False,
        targets=[
            GoalTarget(
                target=data.target, effective_from=_effective_from(data.period, today, start)
            )
        ],
    )
    db.add(goal)
    await db.flush()
    if data.period == "week":
        no_pin = not any(other.is_pinned for other in await _weekly_goals(db, tracker.id))
        if data.is_pinned or no_pin:
            await _pin(db, goal)
    await db.commit()
    await db.refresh(goal)
    return (await describe(db, user, [goal]))[0]


async def update_goal(
    db: AsyncSession, user: UserAccount, goal_id: UUID, data: GoalUpdate
) -> GoalOut:
    goal = await get_owned(db, Goal, goal_id, user.id)
    fields = data.model_fields_set
    if "name" in fields:
        goal.name = data.name
    if data.end_date is not None:
        if goal.kind != "cumulative":
            raise field_error("end_date", "not_allowed", "Only cumulative goals have an end date.")
        if data.end_date < goal.start_date:
            raise field_error("end_date", "before_start", "The end date is before the start.")
        goal.end_date = data.end_date
    if data.target is not None:
        today = clock.today_in(user.timezone)
        effective = _effective_from(goal.period, today, today)
        current = next((v for v in goal.targets if v.effective_from == effective), None)
        if current is not None:
            current.target = data.target
        else:
            goal.targets.append(GoalTarget(target=data.target, effective_from=effective))
    if data.is_pinned is not None:
        if goal.period != "week":
            raise field_error("is_pinned", "not_weekly", "Only weekly goals can be pinned.")
        if data.is_pinned:
            await _pin(db, goal)
        else:
            goal.is_pinned = False
    await db.commit()
    await db.refresh(goal)
    return (await describe(db, user, [goal]))[0]


async def delete_goal(db: AsyncSession, user: UserAccount, goal_id: UUID) -> None:
    goal = await get_owned(db, Goal, goal_id, user.id)
    was_pinned = goal.is_pinned
    goal.deleted_at = clock.utcnow()
    goal.is_pinned = False
    await db.flush()
    if was_pinned:
        remaining = await _weekly_goals(db, goal.tracker_id)
        if remaining:
            remaining[0].is_pinned = True
    await db.commit()
