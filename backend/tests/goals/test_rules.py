from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.goals.rules import current_period, status, target_on, week_start, weekly_streak

MONDAY = date(2026, 10, 26)
SATURDAY = date(2026, 10, 31)
SUNDAY = date(2026, 11, 1)
THURSDAY = date(2026, 10, 29)


def weekly(value: str, target: str, today: date, kind="frequency", period="week"):
    start, end = current_period(kind, period, today, today, None)
    return status(kind, period, Decimal(value), Decimal(target), start, end, today)


def test_week_runs_monday_to_sunday():
    assert current_period("frequency", "week", THURSDAY, THURSDAY, None) == (MONDAY, SUNDAY)
    assert week_start(SUNDAY) == MONDAY


def test_frequency_on_track_while_enough_days_are_left():
    assert weekly("1", "3", SATURDAY).status == "on_track"


def test_frequency_at_risk_when_days_run_out():
    assert weekly("1", "3", SUNDAY).status == "at_risk"


def test_reaching_the_target_is_done():
    assert weekly("3", "3", MONDAY).status == "done"
    assert weekly("4", "3", MONDAY).status == "done"


def test_weekly_amount_is_pro_rata():
    progress = weekly("8.4", "12", THURSDAY, kind="amount")

    assert progress.status == "on_track"
    assert round(progress.expected, 1) == Decimal("5.1")
    assert weekly("4", "12", THURSDAY, kind="amount").status == "at_risk"


def test_monday_morning_is_never_at_risk():
    assert weekly("0", "12", MONDAY, kind="amount").status == "on_track"


def test_daily_amount_is_never_at_risk():
    progress = status("amount", "day", Decimal(6), Decimal(8), SUNDAY, SUNDAY, SUNDAY)

    assert progress.status == "in_progress"


def test_spec_example_twenty_books_is_at_risk_on_october_26():
    progress = status(
        "cumulative", None, Decimal(14), Decimal(20), date(2026, 1, 1), date(2026, 12, 31), MONDAY
    )

    assert round(progress.expected, 1) == Decimal("16.3")
    assert progress.status == "at_risk"


def test_finished_cumulative_period_is_missed_or_done():
    end = date(2026, 6, 30)
    args = ("cumulative", None)

    missed = status(*args, Decimal(5), Decimal(20), date(2026, 1, 1), end, MONDAY)
    done = status(*args, Decimal(20), Decimal(20), date(2026, 1, 1), end, MONDAY)

    assert (missed.status, done.status) == ("missed", "done")


def weeks_met(*met: bool):
    """value_in_week for weeks counted back from the current one (index 0 = current week)."""

    def value(monday: date) -> Decimal:
        index = (week_start(SUNDAY) - monday).days // 7
        return Decimal(1 if index < len(met) and met[index] else 0)

    return value


@pytest.mark.parametrize(
    ("met", "expected"),
    [
        ((False, True, True, False, True), 2),
        ((True, True, True, False, True), 3),
        ((False, False, True, True), 0),
        ((True,), 1),
    ],
)
def test_streak_counts_back_from_the_last_completed_week(met, expected):
    first_week = week_start(SUNDAY) - timedelta(weeks=10)

    streak = weekly_streak(first_week, SUNDAY, weeks_met(*met), lambda _: Decimal(1))

    assert streak == expected


def test_weeks_before_the_goal_do_not_count():
    always = weekly_streak(
        week_start(SUNDAY) - timedelta(weeks=2), SUNDAY, lambda _: 5, lambda _: 1
    )

    assert always == 3


def test_target_versions():
    versions = [(date(2026, 10, 5), Decimal(3)), (date(2026, 10, 19), Decimal(4))]

    assert target_on(versions, date(2026, 10, 12)) == 3
    assert target_on(versions, date(2026, 10, 19)) == 4
    assert target_on(versions, date(2026, 9, 28)) == 3
