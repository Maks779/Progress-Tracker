from datetime import date
from decimal import Decimal
from uuid import uuid4

from app.sessions.records import LoggedSet, best, bests, new_records

EARLIER = uuid4()
CURRENT = uuid4()


def logged(weight: str | None, reps: int, session=EARLIER, day: int = 1) -> LoggedSet:
    return LoggedSet(Decimal(weight) if weight else None, reps, session, date(2026, 10, day))


def test_spec_example_sets_three_new_records():
    earlier = [logged("60", 8)]
    current = [logged("62.5", 8, CURRENT, 25), logged("60", 10, CURRENT, 25)]

    records = {record.record_type: record for record in new_records(earlier, current)}

    assert set(records) == {"max_weight", "max_reps", "estimated_1rm"}
    assert records["max_weight"].value == Decimal("62.5")
    assert (records["max_reps"].value, records["max_reps"].set.weight_kg) == (10, Decimal("60"))
    assert records["estimated_1rm"].value == Decimal("80")


def test_first_session_is_the_baseline():
    assert new_records([], [logged("100", 5, CURRENT)]) == []


def test_ties_are_not_records():
    earlier = [logged("60", 8)]

    assert new_records(earlier, [logged("60", 8, CURRENT, 2)]) == []


def test_heavier_set_with_equal_reps_beats_max_reps():
    earlier = [logged("60", 10)]

    records = new_records(earlier, [logged("65", 10, CURRENT, 2)])

    assert {record.record_type for record in records} == {"max_weight", "max_reps", "estimated_1rm"}


def test_more_reps_beats_a_heavier_set_for_max_reps():
    best_reps = best("max_reps", [logged("100", 5), logged("60", 12, day=2)])

    assert best_reps is not None
    assert (best_reps.value, best_reps.set.weight_kg) == (12, Decimal("60"))


def test_sets_above_ten_reps_do_not_count_for_1rm():
    result = bests([logged("60", 12)])

    assert "estimated_1rm" not in result
    assert result["max_weight"].value == Decimal("60")


def test_bodyweight_sets_only_have_max_reps():
    result = bests([logged(None, 12), logged(None, 15, day=2)])

    assert set(result) == {"max_reps"}
    assert result["max_reps"].value == 15


def test_ties_keep_the_earliest_set():
    result = best("max_weight", [logged("100", 5, day=1), logged("100", 3, CURRENT, day=9)])

    assert result is not None
    assert result.set.session_id == EARLIER
