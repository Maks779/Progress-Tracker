"""Current time in one place, so tests can replace it."""

from datetime import UTC, date, datetime
from zoneinfo import ZoneInfo


def utcnow() -> datetime:
    return datetime.now(UTC)


def today_in(timezone: str) -> date:
    """Today's date for a user, in their IANA timezone."""
    return utcnow().astimezone(ZoneInfo(timezone)).date()
