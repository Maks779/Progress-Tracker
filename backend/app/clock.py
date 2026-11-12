"""Current time in one place, so tests can replace it."""

from datetime import UTC, datetime


def utcnow() -> datetime:
    return datetime.now(UTC)
