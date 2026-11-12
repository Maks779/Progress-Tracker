from decimal import Decimal

import pytest

from app.sessions.rules import SetData, estimated_1rm, session_volume, working_set_count

BENCH = [
    SetData(Decimal("40"), 10, "warmup"),
    SetData(Decimal("62.5"), 8),
    SetData(Decimal("60"), 8),
    SetData(Decimal("60"), 10),
]


def test_volume_counts_working_sets_only():
    assert session_volume(BENCH) == Decimal("1580")


def test_volume_skips_bodyweight_sets():
    sets = [SetData(None, 12), SetData(Decimal("20"), 10)]
    assert session_volume(sets) == Decimal("200")


def test_volume_of_no_sets_is_zero():
    assert session_volume([]) == Decimal("0")


def test_volume_is_a_decimal():
    assert isinstance(session_volume([]), Decimal)


def test_working_set_count_skips_warmups():
    assert working_set_count(BENCH) == 3


def test_working_set_count_includes_bodyweight_sets():
    sets = [SetData(None, 12), SetData(Decimal("20"), 10, "warmup")]
    assert working_set_count(sets) == 1


@pytest.mark.parametrize(
    ("weight", "reps", "expected"),
    [
        ("60", 8, "76"),
        ("60", 10, "80"),
        ("100", 1, "100"),
    ],
)
def test_estimated_1rm_uses_epley(weight, reps, expected):
    assert estimated_1rm(Decimal(weight), reps) == Decimal(expected)


def test_estimated_1rm_keeps_full_precision():
    assert round(estimated_1rm(Decimal("62.5"), 8), 1) == Decimal("79.2")


def test_estimated_1rm_ignores_sets_above_ten_reps():
    assert estimated_1rm(Decimal("50"), 11) is None


@pytest.mark.parametrize("reps", [0, -1])
def test_estimated_1rm_rejects_reps_below_one(reps):
    with pytest.raises(ValueError):
        estimated_1rm(Decimal("50"), reps)
