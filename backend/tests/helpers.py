from typing import Any

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
