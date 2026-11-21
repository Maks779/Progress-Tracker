"""Progress periods and chart buckets as pure functions."""

from datetime import date, timedelta
from decimal import Decimal
from typing import Literal

from app.goals.rules import week_start

Period = Literal["4w", "3m", "1y", "all"]
BucketKind = Literal["week", "month"]

PERIOD_WEEKS = {"4w": 4, "3m": 13, "1y": 52}


def period_range(period: Period, today: date, first_day: date | None) -> tuple[date, date]:
    """4W, 3M and 1Y end with the current week; All starts at the first session."""
    if period == "all":
        return min(first_day or today, today), today
    return week_start(today) - timedelta(weeks=PERIOD_WEEKS[period] - 1), today


def bucket_kind(period: Period) -> BucketKind:
    return "week" if period in ("4w", "3m") else "month"


def bucket_of(kind: BucketKind, day: date) -> date:
    return week_start(day) if kind == "week" else day.replace(day=1)


def bucket_starts(kind: BucketKind, start: date, end: date) -> list[date]:
    current, last = bucket_of(kind, start), bucket_of(kind, end)
    starts = []
    while current <= last:
        starts.append(current)
        if kind == "week":
            current += timedelta(days=7)
        else:
            current = date(current.year + current.month // 12, current.month % 12 + 1, 1)
    return starts


def previous_range(start: date, end: date) -> tuple[date, date]:
    length = (end - start).days + 1
    return start - timedelta(days=length), start - timedelta(days=1)


def change_percent(current: Decimal, previous: Decimal) -> Decimal | None:
    if previous == 0:
        return None
    return ((current - previous) * 100 / previous).quantize(Decimal("0.1"))


def month_bounds(year: int, month: int) -> tuple[date, date]:
    first = date(year, month, 1)
    following = date(year + month // 12, month % 12 + 1, 1)
    return first, following - timedelta(days=1)
