from datetime import date, timedelta

PACE_WINDOW_DAYS = 14


def progress_percent(current_page: int, total_pages: int) -> int:
    """Share of the book read, as a whole percentage rounded half up."""
    return (current_page * 200 + total_pages) // (total_pages * 2)


def estimated_finish(
    current_page: int, total_pages: int, pages_in_window: int, today: date
) -> date | None:
    """Finish date at the pace of the last 14 days (today included); None if finished or idle."""
    remaining = total_pages - current_page
    if remaining <= 0 or pages_in_window <= 0:
        return None
    days_left = -(-remaining * PACE_WINDOW_DAYS // pages_in_window)
    return today + timedelta(days=days_left)


def pace_window_start(today: date) -> date:
    return today - timedelta(days=PACE_WINDOW_DAYS - 1)


def pages_read(end_page: int, previous_end_page: int) -> int:
    return end_page - previous_end_page
