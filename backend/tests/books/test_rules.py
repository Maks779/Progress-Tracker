from datetime import date

import pytest

from app.books.rules import estimated_finish, pace_window_start, pages_read, progress_percent


@pytest.mark.parametrize(
    ("current", "total", "expected"),
    [(168, 320, 53), (0, 320, 0), (320, 320, 100), (1, 3, 33), (1, 200, 1), (1, 400, 0)],
)
def test_progress_rounds_half_up(current: int, total: int, expected: int):
    assert progress_percent(current, total) == expected


def test_estimated_finish_uses_the_last_14_days():
    assert estimated_finish(168, 320, 304, date(2026, 10, 26)) == date(2026, 11, 2)


def test_estimated_finish_rounds_days_up():
    assert estimated_finish(100, 110, 14, date(2026, 10, 26)) == date(2026, 11, 5)


@pytest.mark.parametrize(("current", "pages_in_window"), [(320, 50), (100, 0)])
def test_no_estimate_when_finished_or_idle(current: int, pages_in_window: int):
    assert estimated_finish(current, 320, pages_in_window, date(2026, 10, 26)) is None


def test_pace_window_includes_today_and_13_days_before():
    assert pace_window_start(date(2026, 10, 26)) == date(2026, 10, 13)


def test_pages_read_is_the_difference_of_end_pages():
    assert pages_read(168, 144) == 24
