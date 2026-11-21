from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4
from zoneinfo import ZoneInfo

from app import clock
from app.exercises.catalog import builtin_id

WARSAW = ZoneInfo("Europe/Warsaw")


def at(days_ago: int, hour: int = 18) -> dict[str, str]:
    """started_at and local_date for a session days_ago days back, at a given Warsaw hour."""
    day = clock.utcnow().astimezone(WARSAW).date() - timedelta(days=days_ago)
    started = datetime(day.year, day.month, day.day, hour, tzinfo=WARSAW)
    return {"started_at": started.isoformat(), "local_date": day.isoformat()}


def sets(*pairs: tuple[str | None, int], warmup: tuple[str, int] | None = None) -> list[dict]:
    result = []
    if warmup:
        result.append({"position": 0, "weight_kg": warmup[0], "reps": warmup[1], "kind": "warmup"})
    for weight, reps in pairs:
        result.append({"position": len(result), "weight_kg": weight, "reps": reps})
    return result


def entry(key: str, set_list: list[dict], position: int = 0, **extra: Any) -> dict[str, Any]:
    return {
        "id": str(uuid4()),
        "exercise_id": str(builtin_id(key)),
        "position": position,
        "sets": set_list,
        **extra,
    }


def strength(tracker_id: str, entries: list[dict], days_ago: int = 0, **extra: Any) -> dict:
    return {
        "tracker_id": tracker_id,
        **at(days_ago),
        "duration_s": 2892,
        "strength": {"exercises": entries},
        **extra,
    }
