from uuid import uuid4

import pytest

from tests.helpers import Api, create_tracker
from tests.sessions.conftest import at, entry, sets, strength

pytestmark = pytest.mark.anyio

ATOMIC_HABITS = {"title": "Atomic Habits", "author": "James Clear", "total_pages": 320}


@pytest.fixture
async def book(api: Api) -> dict:
    book_id = str(uuid4())
    response = await api.client.put(
        f"/api/v1/books/{book_id}", json=ATOMIC_HABITS, headers=api.headers
    )
    return response.json()


@pytest.fixture
async def reading(api: Api) -> dict:
    return await create_tracker(api.client, api.headers, "reading")


def read(tracker: dict, book: dict, end_page: int, days_ago: int = 0, **extra) -> dict:
    return {
        "tracker_id": tracker["id"],
        **at(days_ago),
        "reading": {"book_id": book["id"], "end_page": end_page},
        **extra,
    }


async def test_cardio_session_has_pace(api: Api):
    run = await create_tracker(api.client, api.headers, "cardio")

    saved = await api.put(
        {"tracker_id": run["id"], **at(0), "duration_s": 1920, "cardio": {"distance_m": 5200}}
    )

    assert saved["session"]["stats"]["pace_s_per_km"] == 369
    assert saved["session"]["cardio"] == {"distance_m": 5200}


async def test_cardio_distance_is_optional(api: Api):
    run = await create_tracker(api.client, api.headers, "cardio")

    saved = await api.put({"tracker_id": run["id"], **at(0), "duration_s": 1800, "cardio": {}})

    assert saved["session"]["stats"]["pace_s_per_km"] is None


async def test_reading_sessions_track_pages_and_book_progress(api: Api, reading: dict, book: dict):
    first = await api.put(read(reading, book, 144, days_ago=3, duration_s=2400))
    second = await api.put(read(reading, book, 168, days_ago=0))

    progress = await api.get(f"/books/{book['id']}")

    assert first["session"]["stats"]["pages_read"] == 144
    assert second["session"]["stats"]["pages_read"] == 24
    assert (progress["current_page"], progress["progress_percent"]) == (168, 53)
    assert progress["estimated_finish_date"] is not None


@pytest.mark.parametrize(
    ("end_page", "code"),
    [(144, "not_after_previous"), (100, "not_after_previous"), (321, "after_last_page")],
)
async def test_reading_end_page_must_move_forward(
    api: Api, reading: dict, book: dict, end_page: int, code: str
):
    await api.put(read(reading, book, 144, days_ago=1))

    problem = await api.put(read(reading, book, end_page), status=422)

    assert problem["errors"][0] == {
        "field": "reading.end_page",
        "code": code,
        "message": problem["errors"][0]["message"],
    }


async def test_back_dated_reading_cannot_pass_a_later_session(api: Api, reading: dict, book: dict):
    await api.put(read(reading, book, 100, days_ago=5))
    await api.put(read(reading, book, 168, days_ago=1))

    problem = await api.put(read(reading, book, 170, days_ago=3), status=422)
    fits = await api.put(read(reading, book, 140, days_ago=3))

    assert problem["errors"][0]["code"] == "conflicts_with_later"
    assert fits["session"]["stats"]["pages_read"] == 40


async def test_reaching_the_last_page_finishes_the_book(api: Api, reading: dict, book: dict):
    await api.put(read(reading, book, 300, days_ago=2))
    finished = await api.put(read(reading, book, 320, days_ago=0))
    session_id = finished["session"]["id"]

    done = await api.get(f"/books/{book['id']}")
    await api.client.delete(f"/api/v1/sessions/{session_id}", headers=api.headers)
    undone = await api.get(f"/books/{book['id']}")
    await api.client.post(f"/api/v1/sessions/{session_id}/restore", headers=api.headers)
    redone = await api.get(f"/books/{book['id']}")

    assert done["finished_date"] == finished["session"]["local_date"]
    assert done["estimated_finish_date"] is None
    assert undone["finished_date"] is None
    assert redone["finished_date"] == finished["session"]["local_date"]
    assert len((await api.get("/books?status=finished"))["items"]) == 1


async def test_reading_needs_an_owned_book(api: Api, reading: dict):
    problem = await api.put(read(reading, {"id": str(uuid4())}, 10), status=422)

    assert problem["errors"][0]["field"] == "reading.book_id"


async def test_counter_session(api: Api):
    water = await create_tracker(api.client, api.headers, "general")

    saved = await api.put({"tracker_id": water["id"], **at(0), "general": {"count": 6}})
    duration = await api.put(
        {"tracker_id": water["id"], **at(0), "duration_s": 60, "general": {"count": 1}}, status=422
    )

    assert saved["session"]["general"] == {"count": 6}
    assert duration["errors"][0]["field"] == "duration_s"
    item = (await api.get("/sessions"))["items"][0]
    assert item["headline"] == {"metric": "count", "value": 6, "unit_label": "glasses"}


async def test_duration_general_session_has_no_general_part(api: Api):
    meditation = await create_tracker(
        api.client,
        api.headers,
        "general",
        name="Meditation",
        icon="sparkles",
        general_mode="duration",
        counter_unit=None,
    )

    saved = await api.put({"tracker_id": meditation["id"], **at(0), "duration_s": 600})
    with_part = await api.put(
        {"tracker_id": meditation["id"], **at(0), "duration_s": 600, "general": {"count": 1}},
        status=422,
    )

    assert saved["session"]["general"] is None
    assert with_part["errors"][0]["field"] == "general"


async def test_session_list_is_newest_first_with_cursor_and_filters(
    api: Api, gym: dict, reading: dict, book: dict
):
    oldest = await api.put(strength(gym["id"], [entry("squat", sets(("100", 5)))], days_ago=9))
    middle = await api.put(read(reading, book, 24, days_ago=4))
    newest = await api.put(strength(gym["id"], [entry("squat", sets(("100", 6)))], days_ago=1))

    first = await api.get("/sessions?limit=2")
    second = await api.get(f"/sessions?limit=2&cursor={first['next_cursor']}")
    only_gym = await api.get(f"/sessions?tracker_id={gym['id']}")
    recent = await api.get(f"/sessions?from_date={at(5)['local_date']}")

    assert [i["id"] for i in first["items"]] == [
        newest["session"]["id"],
        middle["session"]["id"],
    ]
    assert [i["id"] for i in second["items"]] == [oldest["session"]["id"]]
    assert second["next_cursor"] is None
    assert len(only_gym["items"]) == 2
    assert len(recent["items"]) == 2
    reading_item = first["items"][1]
    assert reading_item["name"] == "Atomic Habits"
    assert reading_item["headline"] == {"metric": "pages", "value": 24, "unit_label": None}
    assert first["items"][0]["headline"]["value"] == 600


async def test_bad_cursor_is_a_validation_error(api: Api):
    problem = await api.get("/sessions?cursor=not-a-cursor", status=422)

    assert problem["errors"][0]["field"] == "cursor"


async def test_delete_and_restore(api: Api, gym: dict):
    saved = await api.put(strength(gym["id"], [entry("squat", sets(("100", 5)))]))
    session_id = saved["session"]["id"]

    deleted = await api.client.delete(f"/api/v1/sessions/{session_id}", headers=api.headers)
    await api.get(f"/sessions/{session_id}", status=404)
    assert (await api.get("/sessions"))["items"] == []

    restored = await api.client.post(f"/api/v1/sessions/{session_id}/restore", headers=api.headers)

    assert deleted.status_code == 204
    assert restored.status_code == 200
    assert (await api.get(f"/sessions/{session_id}"))["id"] == session_id


async def test_put_on_a_deleted_session_is_not_found(api: Api, gym: dict):
    session_id = str(uuid4())
    body = strength(gym["id"], [entry("squat", sets(("100", 5)))])
    await api.put(body, session_id)
    await api.client.delete(f"/api/v1/sessions/{session_id}", headers=api.headers)

    await api.put(body, session_id, status=404)


async def test_tracker_must_be_owned(api: Api, gym: dict):
    body = strength(str(uuid4()), [entry("squat", sets(("100", 5)))])

    problem = await api.put(body, status=422)

    assert problem["errors"][0]["field"] == "tracker_id"
