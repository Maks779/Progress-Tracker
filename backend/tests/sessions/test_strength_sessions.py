from uuid import uuid4

import pytest

from app.exercises.catalog import builtin_id
from tests.helpers import auth_headers, create_tracker
from tests.sessions.conftest import Api, entry, sets, strength

pytestmark = pytest.mark.anyio

BENCH = str(builtin_id("bench_press"))


async def test_strength_session_stats_and_default_name(api: Api, gym: dict):
    body = strength(
        gym["id"],
        [entry("bench_press", sets(("62.5", 8), ("60", 8), ("60", 10), warmup=("40", 10)))],
    )

    saved = await api.put(body)

    session = saved["session"]
    assert session["tracker_type"] == "strength"
    assert session["name"] == "Gym"
    assert session["stats"]["volume_kg"] == 1580
    assert session["stats"]["working_sets"] == 3
    assert session["record_count"] == 0
    assert saved["new_records"] == []
    assert session["strength"]["exercises"][0]["sets"][1]["weight_kg"] == 62.5


async def test_retrying_the_same_put_does_not_duplicate(api: Api, gym: dict):
    session_id = str(uuid4())
    body = strength(gym["id"], [entry("bench_press", sets(("60", 8)))])

    await api.put(body, session_id)
    again = await api.put(body, session_id, status=200)

    page = await api.get("/sessions")
    assert [item["id"] for item in page["items"]] == [session_id]
    assert again["session"]["id"] == session_id


async def test_put_replaces_the_whole_session(api: Api, gym: dict):
    session_id = str(uuid4())
    await api.put(strength(gym["id"], [entry("bench_press", sets(("60", 8)))]), session_id)
    replacement = strength(
        gym["id"], [entry("squat", sets(("100", 5), ("100", 5)))], name="Leg day"
    )

    saved = await api.put(replacement, session_id, status=200)

    exercises = saved["session"]["strength"]["exercises"]
    assert [e["exercise_id"] for e in exercises] == [str(builtin_id("squat"))]
    assert saved["session"]["name"] == "Leg day"
    assert saved["session"]["stats"]["volume_kg"] == 1000


async def test_spec_example_sets_three_records(api: Api, gym: dict):
    await api.put(strength(gym["id"], [entry("bench_press", sets(("60", 8)))], days_ago=5))

    saved = await api.put(
        strength(gym["id"], [entry("bench_press", sets(("62.5", 8), ("60", 10)))], days_ago=1)
    )

    records = {record["record_type"]: record for record in saved["new_records"]}
    assert set(records) == {"max_weight", "max_reps", "estimated_1rm"}
    assert records["max_weight"]["value"] == 62.5
    assert records["estimated_1rm"]["value"] == 80
    detail = await api.get(f"/sessions/{saved['session']['id']}")
    assert detail["record_count"] == 3


async def test_back_dated_session_is_compared_with_earlier_ones_only(api: Api, gym: dict):
    await api.put(strength(gym["id"], [entry("bench_press", sets(("60", 8)))], days_ago=10))
    later = await api.put(strength(gym["id"], [entry("bench_press", sets(("70", 8)))], days_ago=2))

    back_dated = await api.put(
        strength(gym["id"], [entry("bench_press", sets(("65", 8)))], days_ago=6)
    )

    assert {r["record_type"] for r in back_dated["new_records"]} >= {"max_weight"}
    later_detail = await api.get(f"/sessions/{later['session']['id']}")
    assert later_detail["record_count"] >= 1


async def test_supersets_must_be_consecutive_groups(api: Api, gym: dict):
    good = [
        entry("lateral_raise", sets(("10", 12)), 0, superset_group=1),
        entry("cable_curl", sets(("20", 10)), 1, superset_group=1),
        entry("squat", sets(("100", 5)), 2),
    ]
    split = [
        entry("lateral_raise", sets(("10", 12)), 0, superset_group=1),
        entry("squat", sets(("100", 5)), 1),
        entry("cable_curl", sets(("20", 10)), 2, superset_group=1),
    ]
    alone = [entry("lateral_raise", sets(("10", 12)), 0, superset_group=1)]

    saved = await api.put(strength(gym["id"], good))
    split_error = await api.put(strength(gym["id"], split), status=422)
    alone_error = await api.put(strength(gym["id"], alone), status=422)

    groups = [e["superset_group"] for e in saved["session"]["strength"]["exercises"]]
    assert groups == [1, 1, None]
    assert split_error["errors"][0]["code"] == "superset_split"
    assert alone_error["errors"][0]["code"] == "superset_too_small"


@pytest.mark.parametrize(
    ("change", "field", "code"),
    [
        ({"strength": None}, "strength", "required"),
        ({"cardio": {"distance_m": 5000}}, "cardio", "not_allowed"),
        ({"duration_s": None}, "duration_s", "required"),
        ({"local_date": "2001-01-01"}, "local_date", "mismatch"),
        (
            {"started_at": "2999-01-01T10:00:00+00:00", "local_date": "2999-01-01"},
            "started_at",
            "in_future",
        ),
    ],
)
async def test_strength_session_validation(
    api: Api, gym: dict, change: dict, field: str, code: str
):
    body = {**strength(gym["id"], [entry("bench_press", sets(("60", 8)))]), **change}

    problem = await api.put(body, status=422)

    assert problem["errors"][0]["field"] == field
    assert problem["errors"][0]["code"] == code


async def test_duplicate_set_positions_are_rejected(api: Api, gym: dict):
    duplicated = [{"position": 0, "weight_kg": "60", "reps": 8}] * 2

    problem = await api.put(strength(gym["id"], [entry("bench_press", duplicated)]), status=422)

    assert problem["errors"][0]["code"] == "duplicate_position"


async def test_weights_have_at_most_four_decimals(api: Api, gym: dict):
    body = strength(gym["id"], [entry("bench_press", sets(("61.23456", 8)))])

    await api.put(body, status=422)


async def test_unknown_and_foreign_exercises_are_rejected(api: Api, gym: dict):
    stranger = await auth_headers(api.client, "stranger@example.com")
    foreign_id = str(uuid4())
    await api.client.put(
        f"/api/v1/exercises/{foreign_id}",
        json={"name": "Secret move", "muscle_group": "core", "equipment": "other"},
        headers=stranger,
    )

    for exercise_id in (str(uuid4()), foreign_id):
        bad = {**entry("bench_press", sets(("60", 8))), "exercise_id": exercise_id}
        problem = await api.put(strength(gym["id"], [bad]), status=422)
        assert problem["errors"][0]["field"] == "strength.exercises[0].exercise_id"


async def test_entry_ids_cannot_be_reused_by_another_session(api: Api, gym: dict):
    shared = entry("bench_press", sets(("60", 8)))
    await api.put(strength(gym["id"], [shared]))

    problem = await api.put(strength(gym["id"], [shared]), status=422)

    assert problem["errors"][0]["code"] == "id_taken"


async def test_custom_exercise_can_be_logged(api: Api, gym: dict):
    custom_id = str(uuid4())
    await api.client.put(
        f"/api/v1/exercises/{custom_id}",
        json={"name": "Landmine press", "muscle_group": "shoulders", "equipment": "barbell"},
        headers=api.headers,
    )
    custom = {**entry("bench_press", sets(("30", 10))), "exercise_id": custom_id}

    saved = await api.put(strength(gym["id"], [custom]))

    assert saved["session"]["strength"]["exercises"][0]["exercise_id"] == custom_id


async def test_last_sets_prefill_from_the_newest_session(api: Api, gym: dict):
    await api.put(strength(gym["id"], [entry("bench_press", sets(("50", 10)))], days_ago=7))
    await api.put(
        strength(gym["id"], [entry("bench_press", sets(("60", 8), warmup=("40", 10)))], days_ago=2)
    )

    prefill = await api.get(f"/exercises/{BENCH}/last-sets")
    never = await api.get(f"/exercises/{builtin_id('deadlift')}/last-sets")

    assert [(s["weight_kg"], s["reps"], s["kind"]) for s in prefill["sets"]] == [
        (40, 10, "warmup"),
        (60, 8, "working"),
    ]
    assert never["sets"] == [] and never["session_id"] is None


async def test_exercise_records_and_records_screen(api: Api, gym: dict):
    await api.put(strength(gym["id"], [entry("bench_press", sets(("60", 8)))], days_ago=20))
    await api.put(strength(gym["id"], [entry("bench_press", sets(("62.5", 8), ("60", 10)))]))

    records = await api.get(f"/exercises/{BENCH}/records")
    screen = await api.get("/records?limit=2")

    assert records["max_weight"]["value"] == 62.5
    assert records["max_reps"]["reps"] == 10
    assert records["estimated_1rm"]["value"] == 80
    assert len(screen["items"]) == 2
    assert screen["next_cursor"] is not None
    assert screen["new_this_week"] == 3
    rest = await api.get(f"/records?cursor={screen['next_cursor']}")
    assert len(rest["items"]) == 1 and rest["next_cursor"] is None


async def test_used_exercises_come_first_in_the_list(api: Api, gym: dict):
    await api.put(strength(gym["id"], [entry("squat", sets(("100", 5)))], days_ago=3))

    items = await api.get("/exercises")

    assert items["items"][0]["key"] == "squat"
    assert items["items"][0]["last_used_date"] is not None


async def test_sessions_of_other_users_are_not_found(api: Api, gym: dict):
    session_id = str(uuid4())
    body = strength(gym["id"], [entry("bench_press", sets(("60", 8)))])
    await api.put(body, session_id)
    stranger = await auth_headers(api.client, "stranger@example.com")
    stranger_gym = await create_tracker(api.client, stranger, "strength")

    taken = await api.client.put(
        f"/api/v1/sessions/{session_id}",
        json={**body, "tracker_id": stranger_gym["id"]},
        headers=stranger,
    )
    read = await api.client.get(f"/api/v1/sessions/{session_id}", headers=stranger)

    assert taken.status_code == read.status_code == 404
