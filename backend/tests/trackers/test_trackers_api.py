from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.helpers import Api, auth_headers, create_tracker
from tests.sessions.conftest import at, entry, sets, strength

pytestmark = pytest.mark.anyio


async def me(client: AsyncClient, headers: dict[str, str]) -> dict[str, object]:
    return (await client.get("/api/v1/me", headers=headers)).json()


async def test_trackers_require_sign_in(client: AsyncClient):
    assert (await client.get("/api/v1/trackers")).status_code == 401


@pytest.mark.parametrize("tracker_type", ["strength", "cardio", "reading", "general"])
async def test_create_each_tracker_type(client: AsyncClient, tracker_type: str):
    headers = await auth_headers(client)

    tracker = await create_tracker(client, headers, tracker_type)

    assert tracker["type"] == tracker_type
    assert tracker["archived"] is False
    assert tracker["position"] == 0
    assert "archived_at" not in tracker


async def test_counter_tracker_keeps_its_unit(client: AsyncClient):
    headers = await auth_headers(client)

    tracker = await create_tracker(client, headers, "general", counter_unit_note="250 ml each")

    assert (tracker["general_mode"], tracker["counter_unit"]) == ("counter", "glasses")
    assert tracker["counter_unit_note"] == "250 ml each"


@pytest.mark.parametrize(
    "body",
    [
        {"type": "general", "name": "Meditation", "color": "general", "icon": "sparkles"},
        {
            "type": "general",
            "name": "Water",
            "color": "general",
            "icon": "droplet",
            "general_mode": "counter",
        },
        {
            "type": "general",
            "name": "Meditation",
            "color": "general",
            "icon": "sparkles",
            "general_mode": "duration",
            "counter_unit": "minutes",
        },
        {
            "type": "strength",
            "name": "Gym",
            "color": "strength",
            "icon": "dumbbell",
            "general_mode": "duration",
        },
        {"type": "strength", "name": "Gym", "color": "strength", "icon": "rocket"},
        {"type": "strength", "name": "  ", "color": "strength", "icon": "dumbbell"},
        {"type": "yoga", "name": "Yoga", "color": "general", "icon": "heart"},
    ],
)
async def test_create_rejects_invalid_trackers(client: AsyncClient, body: dict[str, str]):
    headers = await auth_headers(client)

    response = await client.post("/api/v1/trackers", json=body, headers=headers)

    assert response.status_code == 422


async def test_list_is_ordered_and_hides_archived(client: AsyncClient):
    headers = await auth_headers(client)
    gym = await create_tracker(client, headers, "strength")
    run = await create_tracker(client, headers, "cardio")
    book = await create_tracker(client, headers, "reading")
    await client.patch(f"/api/v1/trackers/{run['id']}", json={"archived": True}, headers=headers)

    active = (await client.get("/api/v1/trackers", headers=headers)).json()["items"]
    everything = (
        await client.get("/api/v1/trackers?include_archived=true", headers=headers)
    ).json()["items"]

    assert [t["id"] for t in active] == [gym["id"], book["id"]]
    assert [t["position"] for t in everything] == [0, 1, 2]
    assert [t["archived"] for t in everything] == [False, True, False]


async def test_update_changes_editable_fields(client: AsyncClient):
    headers = await auth_headers(client)
    tracker = await create_tracker(client, headers, "general")

    response = await client.patch(
        f"/api/v1/trackers/{tracker['id']}",
        json={"name": "Hydration", "icon": "waves", "counter_unit": "cups", "description": None},
        headers=headers,
    )

    assert response.status_code == 200
    updated = response.json()
    assert (updated["name"], updated["icon"], updated["counter_unit"]) == (
        "Hydration",
        "waves",
        "cups",
    )


@pytest.mark.parametrize("body", [{"type": "cardio"}, {"general_mode": "duration"}, {}])
async def test_type_and_mode_cannot_change(client: AsyncClient, body: dict[str, str]):
    headers = await auth_headers(client)
    tracker = await create_tracker(client, headers, "general")

    response = await client.patch(f"/api/v1/trackers/{tracker['id']}", json=body, headers=headers)

    assert response.status_code == 422


async def test_unit_is_only_for_counter_trackers(client: AsyncClient):
    headers = await auth_headers(client)
    tracker = await create_tracker(client, headers, "strength")

    response = await client.patch(
        f"/api/v1/trackers/{tracker['id']}", json={"counter_unit": "kg"}, headers=headers
    )

    assert response.status_code == 422
    assert response.json()["errors"][0]["field"] == "counter_unit"


async def test_delete_is_soft_and_hides_the_tracker(client: AsyncClient):
    headers = await auth_headers(client)
    tracker = await create_tracker(client, headers, "cardio")

    deleted = await client.delete(f"/api/v1/trackers/{tracker['id']}", headers=headers)

    assert deleted.status_code == 204
    assert (
        await client.get(f"/api/v1/trackers/{tracker['id']}", headers=headers)
    ).status_code == 404
    assert (await client.get("/api/v1/trackers", headers=headers)).json()["items"] == []


async def test_other_users_trackers_are_not_found(client: AsyncClient):
    owner = await auth_headers(client, "owner@example.com")
    stranger = await auth_headers(client, "stranger@example.com")
    tracker = await create_tracker(client, owner, "strength")
    url = f"/api/v1/trackers/{tracker['id']}"

    assert (await client.get(url, headers=stranger)).status_code == 404
    assert (await client.patch(url, json={"name": "Mine"}, headers=stranger)).status_code == 404
    assert (await client.delete(url, headers=stranger)).status_code == 404


async def test_first_strength_tracker_becomes_the_main_tracker(client: AsyncClient):
    headers = await auth_headers(client)
    await create_tracker(client, headers, "reading")
    assert (await me(client, headers))["main_tracker_id"] is None

    gym = await create_tracker(client, headers, "strength")
    await create_tracker(client, headers, "strength", name="Home gym")

    assert (await me(client, headers))["main_tracker_id"] == gym["id"]


async def test_main_tracker_moves_on_when_it_is_deleted_or_archived(client: AsyncClient):
    headers = await auth_headers(client)
    gym = await create_tracker(client, headers, "strength")
    home = await create_tracker(client, headers, "strength", name="Home gym")

    await client.delete(f"/api/v1/trackers/{gym['id']}", headers=headers)
    assert (await me(client, headers))["main_tracker_id"] == home["id"]

    await client.patch(f"/api/v1/trackers/{home['id']}", json={"archived": True}, headers=headers)
    assert (await me(client, headers))["main_tracker_id"] is None


async def test_main_tracker_can_be_chosen_among_strength_trackers(client: AsyncClient):
    headers = await auth_headers(client)
    await create_tracker(client, headers, "strength")
    home = await create_tracker(client, headers, "strength", name="Home gym")
    book = await create_tracker(client, headers, "reading")

    chosen = await client.patch("/api/v1/me", json={"main_tracker_id": home["id"]}, headers=headers)
    not_strength = await client.patch(
        "/api/v1/me", json={"main_tracker_id": book["id"]}, headers=headers
    )

    assert chosen.json()["main_tracker_id"] == home["id"]
    assert not_strength.status_code == 422
    assert not_strength.json()["errors"][0]["code"] == "not_strength"


async def test_main_tracker_must_belong_to_the_user(client: AsyncClient):
    owner = await auth_headers(client, "owner@example.com")
    stranger = await auth_headers(client, "stranger@example.com")
    tracker = await create_tracker(client, owner, "strength")

    response = await client.patch(
        "/api/v1/me", json={"main_tracker_id": tracker["id"]}, headers=stranger
    )

    assert response.status_code == 422
    assert response.json()["errors"][0]["code"] == "not_found"


async def test_list_counts_the_saved_sessions_of_each_tracker(api: Api, gym: dict):
    running = await create_tracker(api.client, api.headers, "cardio")
    await api.put(strength(gym["id"], [entry("squat", sets(("100", 5)))], days_ago=1))
    removed = await api.put(strength(gym["id"], [entry("squat", sets(("100", 5)))], days_ago=2))
    await api.put(strength(gym["id"], [entry("bench_press", sets(("60", 8)))], days_ago=3))
    await api.client.delete(f"/api/v1/sessions/{removed['session']['id']}", headers=api.headers)

    items = (await api.get("/trackers"))["items"]

    counts = {item["id"]: item["session_count"] for item in items}
    assert counts == {gym["id"]: 2, running["id"]: 0}


async def test_deleting_a_tracker_deletes_its_goals(api: Api, gym: dict):
    running = await create_tracker(api.client, api.headers, "cardio")
    weekly = {"kind": "frequency", "period": "week", "metric": "sessions", "target": 3}
    for tracker in (gym, running):
        response = await api.client.post(
            "/api/v1/goals", json={"tracker_id": tracker["id"], **weekly}, headers=api.headers
        )
        assert response.status_code == 201, response.text

    await api.client.delete(f"/api/v1/trackers/{gym['id']}", headers=api.headers)

    goals = (await api.get("/goals"))["items"]
    assert [goal["tracker_id"] for goal in goals] == [running["id"]]
    assert (await api.get(f"/goals?tracker_id={gym['id']}"))["items"] == []


async def test_deleting_a_tracker_deletes_its_sessions(api: Api, gym: dict):
    reading = await create_tracker(api.client, api.headers, "reading")
    book = (
        await api.client.put(
            f"/api/v1/books/{uuid4()}",
            json={"title": "Atomic Habits", "total_pages": 320},
            headers=api.headers,
        )
    ).json()
    finished = await api.put(
        {"tracker_id": reading["id"], **at(0), "reading": {"book_id": book["id"], "end_page": 320}}
    )
    await api.put(strength(gym["id"], [entry("squat", sets(("100", 5)))], days_ago=1))
    before = await api.get(f"/books/{book['id']}")

    await api.client.delete(f"/api/v1/trackers/{reading['id']}", headers=api.headers)

    sessions = (await api.get("/sessions"))["items"]
    assert before["finished_date"] == finished["session"]["local_date"]
    assert [session["tracker_id"] for session in sessions] == [gym["id"]]
    assert (await api.get(f"/books/{book['id']}"))["finished_date"] is None
