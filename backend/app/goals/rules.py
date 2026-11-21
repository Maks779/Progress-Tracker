"""Goal periods, status and weekly streaks as pure functions."""

from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Literal

GoalKind = Literal["frequency", "amount", "cumulative"]
GoalPeriod = Literal["day", "week"]
GoalStatus = Literal["on_track", "at_risk", "done", "in_progress", "missed"]


@dataclass(frozen=True)
class Progress:
    period_start: date
    period_end: date
    value: Decimal
    target: Decimal
    expected: Decimal | None
    status: GoalStatus


def week_start(day: date) -> date:
    return day - timedelta(days=day.weekday())


def current_period(
    kind: GoalKind, period: GoalPeriod | None, today: date, start: date, end: date | None
) -> tuple[date, date]:
    if kind == "cumulative":
        assert end is not None
        return start, end
    if period == "day":
        return today, today
    monday = week_start(today)
    return monday, monday + timedelta(days=6)


def expected_by(target: Decimal, period_start: date, period_end: date, today: date) -> Decimal:
    """Pro-rata target for the days of the period that are already over (today not counted)."""
    days = (period_end - period_start).days + 1
    completed = min(max((today - period_start).days, 0), days)
    return target * completed / days


def status(
    kind: GoalKind,
    period: GoalPeriod | None,
    value: Decimal,
    target: Decimal,
    period_start: date,
    period_end: date,
    today: date,
) -> Progress:
    def result(goal_status: GoalStatus, expected: Decimal | None = None) -> Progress:
        return Progress(period_start, period_end, value, target, expected, goal_status)

    if value >= target:
        return result("done")
    if today > period_end:
        return result("missed")
    if kind == "amount" and period == "day":
        return result("in_progress")
    if kind == "frequency":
        days_left = (period_end - today).days + 1
        return result("at_risk" if target - value > days_left else "on_track")
    expected = expected_by(target, period_start, period_end, today)
    return result("at_risk" if value < expected else "on_track", expected)


def weekly_streak(
    first_week: date,
    today: date,
    value_in_week: Callable[[date], Decimal],
    target_in_week: Callable[[date], Decimal],
) -> int:
    """Consecutive met weeks back from the last completed week, plus the current one if met.

    An unmet current week never breaks the streak. Weeks before the goal existed do not count.
    """
    current = week_start(today)

    def met(monday: date) -> bool:
        return value_in_week(monday) >= target_in_week(monday)

    streak = 1 if met(current) else 0
    monday = current - timedelta(days=7)
    while monday >= first_week and met(monday):
        streak += 1
        monday -= timedelta(days=7)
    return streak


def target_on(versions: Sequence[tuple[date, Decimal]], day: date) -> Decimal:
    """The target valid on a day: the latest version that started on or before it."""
    ordered = sorted(versions)
    valid = [target for start, target in ordered if start <= day]
    return valid[-1] if valid else ordered[0][1]
