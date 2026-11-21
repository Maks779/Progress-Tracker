from datetime import date
from decimal import Decimal

import pytest

from app.stats.rules import (
    bucket_kind,
    bucket_starts,
    change_percent,
    month_bounds,
    period_range,
    previous_range,
)

THURSDAY = date(2026, 10, 29)


def test_four_weeks_end_with_the_current_week():
    assert period_range("4w", THURSDAY, None) == (date(2026, 10, 5), THURSDAY)


def test_all_starts_at_the_first_session():
    assert period_range("all", THURSDAY, date(2025, 3, 14)) == (date(2025, 3, 14), THURSDAY)
    assert period_range("all", THURSDAY, None) == (THURSDAY, THURSDAY)


@pytest.mark.parametrize(
    ("period", "kind"), [("4w", "week"), ("3m", "week"), ("1y", "month"), ("all", "month")]
)
def test_long_periods_use_monthly_bars(period, kind):
    assert bucket_kind(period) == kind


def test_weekly_buckets_are_mondays():
    assert bucket_starts("week", date(2026, 10, 5), THURSDAY) == [
        date(2026, 10, 5),
        date(2026, 10, 12),
        date(2026, 10, 19),
        date(2026, 10, 26),
    ]


def test_monthly_buckets_cross_the_year():
    assert bucket_starts("month", date(2025, 11, 20), date(2026, 2, 3)) == [
        date(2025, 11, 1),
        date(2025, 12, 1),
        date(2026, 1, 1),
        date(2026, 2, 1),
    ]


def test_previous_range_has_the_same_length():
    assert previous_range(date(2026, 10, 5), date(2026, 11, 1)) == (
        date(2026, 9, 7),
        date(2026, 10, 4),
    )


def test_change_percent():
    assert change_percent(Decimal(32480), Decimal(27525)) == Decimal("18.0")
    assert change_percent(Decimal(5), Decimal(0)) is None


def test_month_bounds_handle_december():
    assert month_bounds(2026, 12) == (date(2026, 12, 1), date(2026, 12, 31))
    assert month_bounds(2026, 2) == (date(2026, 2, 1), date(2026, 2, 28))
