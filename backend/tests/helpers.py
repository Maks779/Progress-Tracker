from typing import Any
from uuid import uuid4

from httpx import AsyncClient

PASSWORD = "correct-horse-battery"

NATIVE = {"X-Client": "native"}
WEB = {"X-Client": "web"}


def bearer(access_token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {access_token}"}


async def register(
    client: AsyncClient,
    email: str = "alex@example.com",
    password: str = PASSWORD,
    **overrides: Any,
) -> dict[str, Any]:
    body = {
        "name": "Alex Morgan",
        "email": email,
        "password": password,
        "timezone": "Europe/Warsaw",
        "language": "en",
        **overrides,
    }
    response = await client.post("/api/v1/auth/register", json=body, headers=NATIVE)
    assert response.status_code == 201, response.text
    return response.json()


async def login(
    client: AsyncClient, email: str = "alex@example.com", password: str = PASSWORD
) -> dict[str, Any]:
    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}, headers=NATIVE
    )
    assert response.status_code == 200, response.text
    return response.json()


async def auth_headers(client: AsyncClient, email: str = "alex@example.com") -> dict[str, str]:
    tokens = await register(client, email=email)
    return bearer(tokens["access_token"])


TRACKER_DEFAULTS: dict[str, dict[str, Any]] = {
    "strength": {"name": "Gym", "color": "strength", "icon": "dumbbell"},
    "cardio": {"name": "Running", "color": "cardio", "icon": "activity"},
    "reading": {"name": "Reading", "color": "reading", "icon": "book-open"},
    "general": {
        "name": "Water",
        "color": "general",
        "icon": "droplet",
        "general_mode": "counter",
        "counter_unit": "glasses",
    },
}


async def create_tracker(
    client: AsyncClient, headers: dict[str, str], tracker_type: str = "strength", **overrides: Any
) -> dict[str, Any]:
    body = {"type": tracker_type, **TRACKER_DEFAULTS[tracker_type], **overrides}
    response = await client.post("/api/v1/trackers", json=body, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


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
