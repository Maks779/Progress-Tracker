import csv
import io
from uuid import uuid4

import pytest

from tests.helpers import Api, auth_headers, create_tracker
from tests.sessions.conftest import at, entry, sets, strength

pytestmark = pytest.mark.anyio


def parse_csv(text: str) -> list[dict[str, str]]:
    assert text.startswith("﻿")
    return list(csv.DictReader(io.StringIO(text.removeprefix("﻿"))))


async def test_json_export_contains_everything_the_user_owns(api: Api, gym: dict):
    await api.put(strength(gym["id"], [entry("bench_press", sets(("60", 8)))], 3))
    await api.put(strength(gym["id"], [entry("bench_press", sets(("62.5", 8)))], 0))
    book_id = str(uuid4())
    await api.client.put(
        f"/api/v1/books/{book_id}",
        json={"title": "Atomic Habits", "total_pages": 320},
        headers=api.headers,
    )
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
    stranger = await auth_headers(api.client, "stranger@example.com")
    await create_tracker(api.client, stranger, "cardio")

    response = await api.client.get("/api/v1/me/export.json", headers=api.headers)

    assert response.status_code == 200
    assert "ember-export.json" in response.headers["content-disposition"]
    export = response.json()
    assert export["user"]["email"] == "alex@example.com"
    assert [t["id"] for t in export["trackers"]] == [gym["id"]]
    assert [e["key"] for e in export["exercises"]] == ["bench_press"]
    assert [b["id"] for b in export["books"]] == [book_id]
    assert len(export["sessions"]) == 2
    assert [s["record_count"] for s in export["sessions"]] == [0, 3]
    assert len(export["goals"]) == 1


async def test_strength_csv_has_a_row_per_set(api: Api, gym: dict):
    await api.put(
        strength(
            gym["id"],
            [entry("bench_press", sets(("62.5", 8), ("100", 5), warmup=("40", 10)))],
            0,
            note="Felt strong",
        )
    )

    response = await api.client.get(f"/api/v1/trackers/{gym['id']}/export.csv", headers=api.headers)

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert 'filename="ember-gym.csv"' in response.headers["content-disposition"]
    rows = parse_csv(response.text)
    assert [(r["exercise"], r["kind"], r["weight_kg"], r["reps"]) for r in rows] == [
        ("Bench press", "warmup", "40", "10"),
        ("Bench press", "working", "62.5", "8"),
        ("Bench press", "working", "100", "5"),
    ]
    assert rows[0]["note"] == "Felt strong"
    assert rows[0]["started_at_utc"].endswith("+00:00")


async def test_reading_csv_has_pages(api: Api):
    reading = await create_tracker(api.client, api.headers, "reading", name="Książki")
    book_id = str(uuid4())
    await api.client.put(
        f"/api/v1/books/{book_id}",
        json={"title": "Atomic Habits", "total_pages": 320},
        headers=api.headers,
    )
    for days_ago, end_page in ((2, 144), (0, 168)):
        await api.put(
            {
                "tracker_id": reading["id"],
                **at(days_ago),
                "reading": {"book_id": book_id, "end_page": end_page},
            }
        )

    response = await api.client.get(
        f"/api/v1/trackers/{reading['id']}/export.csv", headers=api.headers
    )

    rows = parse_csv(response.text)
    assert [(r["book"], r["end_page"], r["pages_read"]) for r in rows] == [
        ("Atomic Habits", "144", "144"),
        ("Atomic Habits", "168", "24"),
    ]
    assert 'filename="ember-ksi-ki.csv"' in response.headers["content-disposition"]


async def test_counter_and_cardio_csv(api: Api):
    water = await create_tracker(api.client, api.headers, "general")
    run = await create_tracker(api.client, api.headers, "cardio")
    await api.put({"tracker_id": water["id"], **at(0), "general": {"count": 6}})
    await api.put(
        {"tracker_id": run["id"], **at(0), "duration_s": 1920, "cardio": {"distance_m": 5200}}
    )

    water_rows = parse_csv(
        (
            await api.client.get(f"/api/v1/trackers/{water['id']}/export.csv", headers=api.headers)
        ).text
    )
    run_rows = parse_csv(
        (await api.client.get(f"/api/v1/trackers/{run['id']}/export.csv", headers=api.headers)).text
    )

    assert (water_rows[0]["count"], water_rows[0]["unit"]) == ("6", "glasses")
    assert (run_rows[0]["duration_s"], run_rows[0]["distance_m"]) == ("1920", "5200")


async def test_csv_of_a_foreign_tracker_is_not_found(api: Api, gym: dict):
    stranger = await auth_headers(api.client, "stranger@example.com")

    response = await api.client.get(f"/api/v1/trackers/{gym['id']}/export.csv", headers=stranger)

    assert response.status_code == 404
