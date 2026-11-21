from datetime import UTC, datetime
from uuid import uuid4

import pytest

from tests.helpers import Api, auth_headers, create_tracker
from tests.sessions.conftest import at, entry, sets, strength

pytestmark = pytest.mark.anyio

THURSDAY = datetime(2026, 10, 29, 20, tzinfo=UTC)
THREE_WEEKS_EARLIER = datetime(2026, 10, 8, 20, tzinfo=UTC)


async def create_goal(api: Api, status: int = 201, **body) -> dict:
    response = await api.client.post("/api/v1/goals", json=body, headers=api.headers)
    assert response.status_code == status, response.text
    return response.json()


async def workout(api: Api, gym: dict, days_ago: int) -> dict:
    return await api.put(strength(gym["id"], [entry("squat", sets(("100", 5)))], days_ago))


async def test_weekly_frequency_goal_counts_this_weeks_sessions(api: Api, gym: dict, freeze):
    freeze(THURSDAY)
    goal = await create_goal(
        api, tracker_id=gym["id"], kind="frequency", period="week", metric="sessions", target=3
    )
    await workout(api, gym, days_ago=1)
    await workout(api, gym, days_ago=7)

    current = await api.get(f"/goals/{goal['id']}")

    assert goal["is_pinned"] is True
    assert current["progress"]["period_start"] == "2026-10-26"
    assert current["progress"]["period_end"] == "2026-11-01"
    assert current["progress"]["value"] == 1
    assert current["progress"]["status"] == "on_track"
    assert current["streak_weeks"] == 0


async def test_saving_a_session_returns_the_trackers_goals(api: Api, gym: dict, freeze):
    freeze(THURSDAY)
    await create_goal(
        api, tracker_id=gym["id"], kind="frequency", period="week", metric="sessions", target=1
    )

    saved = await workout(api, gym, days_ago=0)

    [goal] = saved["goals"]
    assert goal["progress"]["status"] == "done"
    assert goal["streak_weeks"] == 1


async def test_streak_counts_weeks_since_the_goal_started(api: Api, gym: dict, freeze):
    freeze(THREE_WEEKS_EARLIER)
    goal = await create_goal(
        api, tracker_id=gym["id"], kind="frequency", period="week", metric="sessions", target=1
    )
    freeze(THURSDAY)
    for days_ago in (4, 11, 18, 30):
        await workout(api, gym, days_ago)

    before = await api.get(f"/goals/{goal['id']}")
    await workout(api, gym, days_ago=0)
    after = await api.get(f"/goals/{goal['id']}")

    assert before["streak_weeks"] == 3
    assert after["streak_weeks"] == 4


async def test_a_new_target_applies_from_the_current_week(api: Api, gym: dict, freeze):
    freeze(THREE_WEEKS_EARLIER)
    goal = await create_goal(
        api, tracker_id=gym["id"], kind="frequency", period="week", metric="sessions", target=1
    )
    freeze(THURSDAY)
    for days_ago in (3, 10, 17):
        await workout(api, gym, days_ago)

    response = await api.client.patch(
        f"/api/v1/goals/{goal['id']}", json={"target": 2}, headers=api.headers
    )

    updated = response.json()
    assert updated["target"] == 2
    assert updated["progress"]["status"] == "on_track"
    assert updated["streak_weeks"] == 2


async def test_weekly_amount_of_pages(api: Api, freeze):
    freeze(THURSDAY)
    reading = await create_tracker(api.client, api.headers, "reading")
    book_id = str(uuid4())
    await api.client.put(
        f"/api/v1/books/{book_id}",
        json={"title": "Atomic Habits", "total_pages": 320},
        headers=api.headers,
    )
    goal = await create_goal(
        api, tracker_id=reading["id"], kind="amount", period="week", metric="pages", target=60
    )
    for days_ago, end_page in ((5, 100), (2, 130), (0, 148)):
        await api.put(
            {
                "tracker_id": reading["id"],
                **at(days_ago),
                "reading": {"book_id": book_id, "end_page": end_page},
            }
        )

    current = await api.get(f"/goals/{goal['id']}")

    assert current["progress"]["value"] == 48
    assert round(current["progress"]["expected"], 1) == 25.7
    assert current["progress"]["status"] == "on_track"


async def test_daily_counter_goal_is_never_at_risk(api: Api, freeze):
    freeze(THURSDAY)
    water = await create_tracker(api.client, api.headers, "general")
    goal = await create_goal(
        api, tracker_id=water["id"], kind="amount", period="day", metric="count", target=8
    )
    await api.put({"tracker_id": water["id"], **at(0), "general": {"count": 6}})

    current = await api.get(f"/goals/{goal['id']}")

    assert (current["progress"]["value"], current["progress"]["status"]) == (6, "in_progress")
    assert current["streak_weeks"] is None
    assert current["is_pinned"] is False


async def test_cumulative_books_goal(api: Api, freeze):
    freeze(THURSDAY)
    reading = await create_tracker(api.client, api.headers, "reading")
    book_id = str(uuid4())
    await api.client.put(
        f"/api/v1/books/{book_id}",
        json={"title": "Short", "total_pages": 50},
        headers=api.headers,
    )
    await api.put(
        {"tracker_id": reading["id"], **at(1), "reading": {"book_id": book_id, "end_page": 50}}
    )

    goal = await create_goal(
        api,
        tracker_id=reading["id"],
        kind="cumulative",
        metric="books",
        target=20,
        start_date="2026-01-01",
        end_date="2026-12-31",
        name="20 books this year",
    )

    assert goal["progress"]["value"] == 1
    assert goal["progress"]["status"] == "at_risk"
    assert goal["streak_weeks"] is None


async def test_duplicate_goal_is_a_conflict(api: Api, gym: dict):
    body = {
        "tracker_id": gym["id"],
        "kind": "frequency",
        "period": "week",
        "metric": "sessions",
        "target": 3,
    }
    await create_goal(api, **body)

    problem = await create_goal(api, status=409, **body)

    assert problem["code"] == "goal_exists"


@pytest.mark.parametrize(
    ("kind", "period", "metric"),
    [("amount", "week", "sessions"), ("amount", "week", "distance"), ("cumulative", None, "books")],
)
async def test_metric_must_fit_the_tracker(api: Api, gym: dict, kind, period, metric):
    body = {"tracker_id": gym["id"], "kind": kind, "period": period, "metric": metric, "target": 5}
    if kind == "cumulative":
        body["end_date"] = "2026-12-31"

    problem = await create_goal(api, status=422, **body)

    assert problem["errors"][0]["field"] == "metric"


@pytest.mark.parametrize(
    "body",
    [
        {"kind": "frequency", "period": "day", "metric": "sessions", "target": 3},
        {"kind": "amount", "metric": "sessions", "target": 3},
        {"kind": "cumulative", "metric": "sessions", "target": 3},
        {"kind": "frequency", "period": "week", "metric": "sessions", "target": 0},
        {
            "kind": "frequency",
            "period": "week",
            "metric": "sessions",
            "target": 3,
            "start_date": "2026-01-01",
        },
        {"kind": "amount", "period": "day", "metric": "sessions", "target": 3, "is_pinned": True},
    ],
)
async def test_goal_validation(api: Api, gym: dict, body: dict):
    await create_goal(api, status=422, tracker_id=gym["id"], **body)


async def test_pinning_moves_and_follows_deletion(api: Api):
    run = await create_tracker(api.client, api.headers, "cardio")
    sessions_goal = await create_goal(
        api, tracker_id=run["id"], kind="frequency", period="week", metric="sessions", target=3
    )
    distance_goal = await create_goal(
        api, tracker_id=run["id"], kind="amount", period="week", metric="distance", target=15000
    )
    assert (sessions_goal["is_pinned"], distance_goal["is_pinned"]) == (True, False)

    await api.client.patch(
        f"/api/v1/goals/{distance_goal['id']}", json={"is_pinned": True}, headers=api.headers
    )
    pinned = [g["id"] for g in (await api.get("/goals"))["items"] if g["is_pinned"]]
    assert pinned == [distance_goal["id"]]

    await api.client.delete(f"/api/v1/goals/{distance_goal['id']}", headers=api.headers)
    remaining = (await api.get("/goals"))["items"]
    assert [(g["id"], g["is_pinned"]) for g in remaining] == [(sessions_goal["id"], True)]


async def test_cumulative_goals_cannot_be_pinned(api: Api):
    run = await create_tracker(api.client, api.headers, "cardio")
    goal = await create_goal(
        api,
        tracker_id=run["id"],
        kind="cumulative",
        metric="distance",
        target=500000,
        end_date="2026-12-31",
    )

    response = await api.client.patch(
        f"/api/v1/goals/{goal['id']}", json={"is_pinned": True}, headers=api.headers
    )

    assert response.status_code == 422


async def test_goals_are_private(api: Api, gym: dict):
    goal = await create_goal(
        api, tracker_id=gym["id"], kind="frequency", period="week", metric="sessions", target=3
    )
    stranger = await auth_headers(api.client, "stranger@example.com")

    read = await api.client.get(f"/api/v1/goals/{goal['id']}", headers=stranger)
    foreign_tracker = await api.client.post(
        "/api/v1/goals",
        json={
            "tracker_id": gym["id"],
            "kind": "frequency",
            "period": "week",
            "metric": "sessions",
            "target": 1,
        },
        headers=stranger,
    )

    assert read.status_code == 404
    assert foreign_tracker.status_code == 422
