from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

SetKind = Literal["working", "warmup"]

EPLEY_DIVISOR = 30
EPLEY_MAX_REPS = 10


@dataclass(frozen=True)
class SetData:
    weight_kg: Decimal | None
    reps: int
    kind: SetKind = "working"


def session_volume(sets: list[SetData]) -> Decimal:
    """Sum of weight × reps over working sets that have a weight.

    Warm-ups and bodyweight-only sets (no weight) are left out.
    """
    return sum(
        (s.weight_kg * s.reps for s in sets if s.kind == "working" and s.weight_kg is not None),
        Decimal(0),
    )


def working_set_count(sets: list[SetData]) -> int:
    """Number of working sets, bodyweight-only ones included."""
    return sum(1 for s in sets if s.kind == "working")


def estimated_1rm(weight_kg: Decimal, reps: int) -> Decimal | None:
    """Epley estimate of the one-rep max: weight × (1 + reps / 30).

    One rep returns the weight itself; more than 10 reps returns None;
    fewer than one rep raises ValueError.
    """
    if reps < 1:
        raise ValueError("reps must be at least 1")
    if reps == 1:
        return weight_kg
    if reps > EPLEY_MAX_REPS:
        return None
    return weight_kg * (EPLEY_DIVISOR + reps) / EPLEY_DIVISOR
