from datetime import datetime, timedelta
from typing import Any
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest
from httpx import AsyncClient

from app import clock
from app.exercises.catalog import builtin_id
from tests.helpers import auth_headers, create_tracker

WARSAW = ZoneInfo("Europe/Warsaw")


def at(days_ago: int, hour: int = 18) -> dict[str, str]:
    """started_at and local_date for a session days_ago days back, at a given Warsaw hour."""
    day = clock.utcnow().astimezone(WARSAW).date() - timedelta(days=days_ago)
    started = datetime(day.year, day.month, day.day, hour, tzinfo=WARSAW)
    return {"started_at": started.isoformat(), "local_date": day.isoformat()}


def sets(*pairs: tuple[str | None, int], warmup: tuple[str, int] | None = None) -> list[dict]:
    result = []
    if warmup:
        result.append({"position": 0, "weight_kg": warmup[0], "reps": warmup[1], "kind": "warmup"})
    for weight, reps in pairs:
        result.append({"position": len(result), "weight_kg": weight, "reps": reps})
    return result


def entry(key: str, set_list: list[dict], position: int = 0, **extra: Any) -> dict[str, Any]:
    return {
        "id": str(uuid4()),
        "exercise_id": str(builtin_id(key)),
        "position": position,
        "sets": set_list,
        **extra,
    }


def strength(tracker_id: str, entries: list[dict], days_ago: int = 0, **extra: Any) -> dict:
    return {
        "tracker_id": tracker_id,
        **at(days_ago),
        "duration_s": 2892,
        "strength": {"exercises": entries},
        **extra,
    }


class Api:
    def __init__(self, client: AsyncClient, headers: dict[str, str]) -> None:
        self.client = client
        self.headers = headers

    async def put(self, body: dict[str, Any], session_id: str | None = None, status: int = 201):
        response = await self.client.put(
            f"/api/v1/sessions/{session_id or uuid4()}", json=body, headers=self.headers
        )
        assert response.status_code == status, response.text
        return response.json()

    async def get(self, path: str, status: int = 200) -> Any:
        response = await self.client.get(f"/api/v1{path}", headers=self.headers)
        assert response.status_code == status, response.text
        return response.json()


@pytest.fixture
async def api(client: AsyncClient) -> Api:
    return Api(client, await auth_headers(client))


@pytest.fixture
async def gym(api: Api) -> dict[str, Any]:
    return await create_tracker(api.client, api.headers, "strength")
