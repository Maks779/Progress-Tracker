from datetime import UTC, datetime
from uuid import uuid4

import pytest

from app.exercises.catalog import builtin_id
from tests.helpers import Api, create_tracker
from tests.sessions.conftest import at, entry, sets, strength

pytestmark = pytest.mark.anyio

THURSDAY = datetime(2026, 10, 29, 20, tzinfo=UTC)


async def lift(api: Api, gym: dict, days_ago: int, weight: str = "100", reps: int = 5) -> dict:
    return await api.put(strength(gym["id"], [entry("squat", sets((weight, reps)))], days_ago))


async def read_book(api: Api) -> tuple[dict, str]:
    reading = await create_tracker(api.client, api.headers, "reading")
    book_id = str(uuid4())
    await api.client.put(
        f"/api/v1/books/{book_id}",
        json={"title": "Atomic Habits", "total_pages": 320},
        headers=api.headers,
    )
    return reading, book_id


async def test_home_for_a_new_user_is_empty(api: Api, freeze):
    freeze(THURSDAY)

    home = await api.get("/stats/home")

    assert home == {
        "week_start": "2026-10-26",
        "main_tracker_id": None,
        "pinned_goal": None,
        "active_time_s": 0,
        "volume_kg": 0,
        "pages_read": 0,
        "recent_sessions": [],
        "up_next": None,
    }


async def test_home_sums_the_current_week(api: Api, gym: dict, freeze):
    freeze(THURSDAY)
    await api.client.post(
        "/api/v1/goals",
        json={
            "tracker_id": gym["id"],
            "kind": "frequency",
            "period": "week",
            "metric": "sessions",
            "target": 3,
        },
        headers=api.headers,
    )
    await lift(api, gym, days_ago=10)
    await lift(api, gym, days_ago=2)
    latest = await lift(api, gym, days_ago=0, weight="110")
    reading, book_id = await read_book(api)
    await api.put(
        {
            "tracker_id": reading["id"],
            **at(1),
            "duration_s": 1200,
            "reading": {"book_id": book_id, "end_page": 24},
        }
    )

    home = await api.get("/stats/home")

    assert home["main_tracker_id"] == gym["id"]
    assert home["pinned_goal"]["progress"]["value"] == 2
    assert home["volume_kg"] == 500 + 550
    assert home["active_time_s"] == 2892 * 2 + 1200
    assert home["pages_read"] == 24
    assert [s["id"] for s in home["recent_sessions"]][0] == latest["session"]["id"]
    assert len(home["recent_sessions"]) == 3
    assert home["up_next"] == {
        "session_id": latest["session"]["id"],
        "name": "Gym",
        "exercise_count": 1,
        "estimated_duration_s": 2892,
    }


async def test_calendar_lists_logged_days_with_types(api: Api, gym: dict, freeze):
    freeze(THURSDAY)
    await lift(api, gym, days_ago=3)
    reading, book_id = await read_book(api)
    await api.put(
        {"tracker_id": reading["id"], **at(3), "reading": {"book_id": book_id, "end_page": 30}}
    )
    await lift(api, gym, days_ago=40)

    october = await api.get("/stats/calendar?month=2026-10")
    only_gym = await api.get(f"/stats/calendar?month=2026-10&tracker_id={gym['id']}")

    assert october["days"] == [
        {"local_date": "2026-10-26", "tracker_types": ["strength", "reading"]}
    ]
    assert october["session_count"] == 2
    assert only_gym["days"][0]["tracker_types"] == ["strength"]


async def test_calendar_validates_the_month(api: Api):
    await api.get("/stats/calendar?month=2026-13", status=422)


async def test_progress_buckets_totals_and_change(api: Api, gym: dict, freeze):
    freeze(THURSDAY)
    await lift(api, gym, days_ago=0)
    await lift(api, gym, days_ago=8)
    await lift(api, gym, days_ago=8)
    await lift(api, gym, days_ago=35)
    reading, book_id = await read_book(api)
    await api.put(
        {"tracker_id": reading["id"], **at(1), "reading": {"book_id": book_id, "end_page": 40}}
    )

    stats = await api.get("/stats/progress?period=4w")

    assert stats["bucket"] == "week"
    assert [b["start_date"] for b in stats["volume_kg"]] == [
        "2026-10-05",
        "2026-10-12",
        "2026-10-19",
        "2026-10-26",
    ]
    assert [b["value"] for b in stats["volume_kg"]] == [0, 0, 1000, 500]
    assert stats["pages"][-1]["value"] == 40
    assert stats["consistency"]["active_days"] == 3
    assert stats["totals"]["volume_kg"] == 1500
    assert stats["totals"]["volume_change_percent"] == 200
    assert stats["totals"]["pages_read"] == 40


async def test_progress_all_uses_monthly_bars_from_the_first_session(api: Api, gym: dict, freeze):
    freeze(THURSDAY)
    await lift(api, gym, days_ago=70)
    await lift(api, gym, days_ago=0)

    stats = await api.get("/stats/progress?period=all")

    assert stats["bucket"] == "month"
    assert [b["start_date"] for b in stats["volume_kg"]] == [
        "2026-08-01",
        "2026-09-01",
        "2026-10-01",
    ]
    assert stats["totals"]["volume_change_percent"] is None


async def test_exercise_line_uses_the_heaviest_set(api: Api, gym: dict, freeze):
    freeze(THURSDAY)
    await api.put(strength(gym["id"], [entry("squat", sets(("90", 5), ("95", 3)))], 20))
    await api.put(strength(gym["id"], [entry("squat", sets(("100", 5), ("97.5", 5)))], 6))
    await api.put(strength(gym["id"], [entry("squat", sets(("102.5", 3)))], 0))

    line = await api.get(f"/exercises/{builtin_id('squat')}/progress?period=4w")

    assert [p["weight_kg"] for p in line["points"]] == [95, 100, 102.5]
    assert line["change_kg"] == 7.5
