"""Personal records per exercise: max weight, max reps and estimated 1RM, as pure functions."""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from typing import Literal
from uuid import UUID

from app.sessions.rules import estimated_1rm

RecordType = Literal["max_weight", "max_reps", "estimated_1rm"]
RECORD_TYPES: tuple[RecordType, ...] = ("max_weight", "max_reps", "estimated_1rm")


@dataclass(frozen=True)
class LoggedSet:
    """A completed working set with where and when it happened."""

    weight_kg: Decimal | None
    reps: int
    session_id: UUID
    local_date: date


@dataclass(frozen=True)
class Record:
    record_type: RecordType
    value: Decimal
    set: LoggedSet


def _score(record_type: RecordType, logged: LoggedSet) -> tuple[Decimal, ...] | None:
    if record_type == "max_weight":
        return (logged.weight_kg,) if logged.weight_kg is not None else None
    if record_type == "max_reps":
        return (Decimal(logged.reps), logged.weight_kg or Decimal(0))
    if logged.weight_kg is None:
        return None
    estimate = estimated_1rm(logged.weight_kg, logged.reps)
    return (estimate,) if estimate is not None else None


def _value(record_type: RecordType, logged: LoggedSet) -> Decimal:
    if record_type == "max_weight":
        return logged.weight_kg or Decimal(0)
    if record_type == "max_reps":
        return Decimal(logged.reps)
    return estimated_1rm(logged.weight_kg or Decimal(0), logged.reps) or Decimal(0)


def best(record_type: RecordType, sets: Iterable[LoggedSet]) -> Record | None:
    """The best set for one record type. Ties keep the earliest set, so a tie is never new."""
    winner: LoggedSet | None = None
    winner_score: tuple[Decimal, ...] | None = None
    for logged in sets:
        score = _score(record_type, logged)
        if score is not None and (winner_score is None or score > winner_score):
            winner, winner_score = logged, score
    if winner is None:
        return None
    return Record(record_type, _value(record_type, winner), winner)


def bests(sets: Iterable[LoggedSet]) -> dict[RecordType, Record]:
    logged = list(sets)
    found = {record_type: best(record_type, logged) for record_type in RECORD_TYPES}
    return {record_type: record for record_type, record in found.items() if record is not None}


def new_records(earlier: Iterable[LoggedSet], current: Iterable[LoggedSet]) -> list[Record]:
    """Records the current session sets over everything earlier.

    The first session with an exercise is the baseline and sets no records.
    """
    earlier_sets = list(earlier)
    if not earlier_sets:
        return []
    previous = bests(earlier_sets)
    result = []
    for record_type, record in bests(current).items():
        before = previous.get(record_type)
        if before is None or _score(record_type, record.set) > _score(record_type, before.set):
            result.append(record)
    return result
