from uuid import uuid4

import pytest
from httpx import AsyncClient

from app.exercises.catalog import CATALOG, builtin_id
from tests.helpers import auth_headers

pytestmark = pytest.mark.anyio

CUSTOM = {"name": "Landmine press", "muscle_group": "shoulders", "equipment": "barbell"}


async def exercise_list(client: AsyncClient, headers: dict[str, str]) -> list[dict[str, object]]:
    response = await client.get("/api/v1/exercises", headers=headers)
    assert response.status_code == 200
    return response.json()["items"]


async def test_catalog_matches_the_seeded_exercises(client: AsyncClient):
    items = await exercise_list(client, await auth_headers(client))

    assert {item["key"] for item in items} == set(CATALOG)
    assert all(item["id"] == str(builtin_id(item["key"])) for item in items)
    assert all(item["is_custom"] is False and item["name"] is None for item in items)


async def test_catalog_is_alphabetical_without_history(client: AsyncClient):
    keys = [item["key"] for item in await exercise_list(client, await auth_headers(client))]

    assert keys == sorted(keys)


async def test_put_creates_then_updates_a_custom_exercise(client: AsyncClient):
    headers = await auth_headers(client)
    exercise_id = str(uuid4())
    url = f"/api/v1/exercises/{exercise_id}"

    created = await client.put(url, json=CUSTOM, headers=headers)
    updated = await client.put(url, json={**CUSTOM, "name": "Landmine row"}, headers=headers)

    assert created.status_code == 201
    assert created.json()["id"] == exercise_id
    assert created.json()["is_custom"] is True
    assert updated.status_code == 200
    assert updated.json()["name"] == "Landmine row"
    names = [item["name"] for item in await exercise_list(client, headers)]
    assert names.count("Landmine row") == 1


async def test_custom_exercises_are_private(client: AsyncClient):
    owner = await auth_headers(client, "owner@example.com")
    stranger = await auth_headers(client, "stranger@example.com")
    exercise_id = str(uuid4())
    await client.put(f"/api/v1/exercises/{exercise_id}", json=CUSTOM, headers=owner)

    visible = [item["id"] for item in await exercise_list(client, stranger)]
    overwrite = await client.put(f"/api/v1/exercises/{exercise_id}", json=CUSTOM, headers=stranger)

    assert exercise_id not in visible
    assert overwrite.status_code == 404


async def test_built_in_exercises_are_read_only(client: AsyncClient):
    headers = await auth_headers(client)
    url = f"/api/v1/exercises/{builtin_id('bench_press')}"

    assert (await client.put(url, json=CUSTOM, headers=headers)).status_code == 403
    assert (await client.delete(url, headers=headers)).status_code == 403


async def test_delete_hides_a_custom_exercise(client: AsyncClient):
    headers = await auth_headers(client)
    exercise_id = str(uuid4())
    await client.put(f"/api/v1/exercises/{exercise_id}", json=CUSTOM, headers=headers)

    response = await client.delete(f"/api/v1/exercises/{exercise_id}", headers=headers)

    assert response.status_code == 204
    assert exercise_id not in [item["id"] for item in await exercise_list(client, headers)]
    again = await client.delete(f"/api/v1/exercises/{exercise_id}", headers=headers)
    assert again.status_code == 404


@pytest.mark.parametrize(
    "body",
    [
        {**CUSTOM, "name": " "},
        {**CUSTOM, "muscle_group": "neck"},
        {**CUSTOM, "equipment": "rope"},
        {**CUSTOM, "mechanic": "hybrid"},
        {**CUSTOM, "key": "my_press"},
    ],
)
async def test_custom_exercise_validation(client: AsyncClient, body: dict[str, str]):
    headers = await auth_headers(client)

    response = await client.put(f"/api/v1/exercises/{uuid4()}", json=body, headers=headers)

    assert response.status_code == 422
