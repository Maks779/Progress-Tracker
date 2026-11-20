from uuid import uuid4

import pytest
from httpx import AsyncClient

from tests.helpers import auth_headers

pytestmark = pytest.mark.anyio

ATOMIC_HABITS = {"title": "Atomic Habits", "author": "James Clear", "total_pages": 320}


async def test_put_creates_a_book_with_progress_fields(client: AsyncClient):
    headers = await auth_headers(client)
    book_id = str(uuid4())

    response = await client.put(f"/api/v1/books/{book_id}", json=ATOMIC_HABITS, headers=headers)

    assert response.status_code == 201
    book = response.json()
    assert book["id"] == book_id
    assert (book["current_page"], book["progress_percent"]) == (0, 0)
    assert book["finished_date"] is None
    assert book["estimated_finish_date"] is None


async def test_start_page_counts_as_progress(client: AsyncClient):
    headers = await auth_headers(client)

    response = await client.put(
        f"/api/v1/books/{uuid4()}", json={**ATOMIC_HABITS, "start_page": 160}, headers=headers
    )

    assert (response.json()["current_page"], response.json()["progress_percent"]) == (160, 50)


async def test_put_again_updates_the_book(client: AsyncClient):
    headers = await auth_headers(client)
    url = f"/api/v1/books/{uuid4()}"
    await client.put(url, json=ATOMIC_HABITS, headers=headers)

    response = await client.put(url, json={**ATOMIC_HABITS, "author": None}, headers=headers)

    assert response.status_code == 200
    assert response.json()["author"] is None


async def test_list_filters_by_status(client: AsyncClient):
    headers = await auth_headers(client)
    await client.put(f"/api/v1/books/{uuid4()}", json=ATOMIC_HABITS, headers=headers)

    reading = await client.get("/api/v1/books?status=reading", headers=headers)
    finished = await client.get("/api/v1/books?status=finished", headers=headers)

    assert len(reading.json()["items"]) == 1
    assert finished.json()["items"] == []


async def test_books_are_private(client: AsyncClient):
    owner = await auth_headers(client, "owner@example.com")
    stranger = await auth_headers(client, "stranger@example.com")
    url = f"/api/v1/books/{uuid4()}"
    await client.put(url, json=ATOMIC_HABITS, headers=owner)

    assert (await client.get(url, headers=stranger)).status_code == 404
    assert (await client.put(url, json=ATOMIC_HABITS, headers=stranger)).status_code == 404
    assert (await client.delete(url, headers=stranger)).status_code == 404
    assert (await client.get("/api/v1/books", headers=stranger)).json()["items"] == []


async def test_delete_hides_the_book(client: AsyncClient):
    headers = await auth_headers(client)
    url = f"/api/v1/books/{uuid4()}"
    await client.put(url, json=ATOMIC_HABITS, headers=headers)

    assert (await client.delete(url, headers=headers)).status_code == 204
    assert (await client.get(url, headers=headers)).status_code == 404


@pytest.mark.parametrize(
    "body",
    [
        {**ATOMIC_HABITS, "title": "  "},
        {**ATOMIC_HABITS, "total_pages": 0},
        {**ATOMIC_HABITS, "total_pages": 10001},
        {**ATOMIC_HABITS, "start_page": 320},
        {**ATOMIC_HABITS, "start_page": -1},
    ],
)
async def test_book_validation(client: AsyncClient, body: dict[str, object]):
    headers = await auth_headers(client)

    response = await client.put(f"/api/v1/books/{uuid4()}", json=body, headers=headers)

    assert response.status_code == 422
