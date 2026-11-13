from datetime import timedelta

import pytest
from httpx import AsyncClient, Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import clock
from app.auth.models import RefreshToken
from tests.conftest import CapturedEmails
from tests.helpers import NATIVE, PASSWORD, WEB, bearer, login, register

pytestmark = pytest.mark.anyio


def refresh_cookie(response: Response) -> str:
    header = response.headers["set-cookie"]
    assert header.startswith("refresh_token=")
    return header.split(";", 1)[0].removeprefix("refresh_token=")


async def refresh_native(client: AsyncClient, token: str) -> Response:
    return await client.post("/api/v1/auth/refresh", json={"refresh_token": token}, headers=NATIVE)


async def test_register_native_returns_both_tokens(client: AsyncClient):
    tokens = await register(client)

    assert tokens["token_type"] == "bearer"
    assert tokens["expires_in"] == 900
    assert tokens["access_token"]
    assert tokens["refresh_token"]


async def test_register_web_puts_refresh_token_in_a_strict_httponly_cookie(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Alex",
            "email": "web@example.com",
            "password": PASSWORD,
            "timezone": "Europe/Warsaw",
            "language": "pl",
        },
        headers=WEB,
    )

    assert response.status_code == 201
    assert "refresh_token" not in response.json()
    cookie = response.headers["set-cookie"].lower()
    for attribute in ("httponly", "secure", "samesite=strict", "path=/api/v1/auth"):
        assert attribute in cookie
    assert refresh_cookie(response)


async def test_register_rejects_a_taken_email_case_insensitively(client: AsyncClient):
    await register(client, email="alex@example.com")

    response = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Other",
            "email": "ALEX@Example.com",
            "password": PASSWORD,
            "timezone": "Europe/Warsaw",
            "language": "en",
        },
        headers=NATIVE,
    )

    assert response.status_code == 409
    assert response.json()["code"] == "email_taken"


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("password", "short"),
        ("timezone", "Mars/Olympus"),
        ("language", "de"),
        ("email", "not-an-email"),
        ("name", "   "),
    ],
)
async def test_register_validates_fields(client: AsyncClient, field: str, value: str):
    body = {
        "name": "Alex",
        "email": "alex@example.com",
        "password": PASSWORD,
        "timezone": "Europe/Warsaw",
        "language": "en",
        field: value,
    }

    response = await client.post("/api/v1/auth/register", json=body, headers=NATIVE)

    assert response.status_code == 422
    problem = response.json()
    assert problem["code"] == "validation_error"
    assert [error["field"] for error in problem["errors"]] == [field]


async def test_register_requires_the_client_header(client: AsyncClient):
    response = await client.post("/api/v1/auth/register", json={})

    assert response.status_code == 422
    assert "X-Client" in [error["field"] for error in response.json()["errors"]]


async def test_login_succeeds_with_any_email_case(client: AsyncClient):
    await register(client)

    tokens = await login(client, email="Alex@Example.COM")

    assert tokens["access_token"]


@pytest.mark.parametrize(
    ("email", "password"),
    [("alex@example.com", "wrong-password"), ("nobody@example.com", PASSWORD)],
)
async def test_login_failure_does_not_reveal_which_field_is_wrong(
    client: AsyncClient, email: str, password: str
):
    await register(client)

    response = await client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}, headers=NATIVE
    )

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_credentials"


async def test_login_is_rate_limited_per_email(client: AsyncClient):
    await register(client)
    body = {"email": "alex@example.com", "password": "wrong-password"}

    statuses = [
        (await client.post("/api/v1/auth/login", json=body, headers=NATIVE)).status_code
        for _ in range(6)
    ]

    assert statuses == [401] * 5 + [429]
    blocked = await client.post("/api/v1/auth/login", json=body, headers=NATIVE)
    assert blocked.json()["code"] == "rate_limited"
    assert int(blocked.headers["retry-after"]) > 0


async def test_refresh_rotates_the_token(client: AsyncClient):
    tokens = await register(client)

    response = await refresh_native(client, tokens["refresh_token"])

    assert response.status_code == 200
    rotated = response.json()
    assert rotated["refresh_token"] != tokens["refresh_token"]
    assert (await client.get("/api/v1/me", headers=bearer(rotated["access_token"]))).is_success


async def test_reusing_a_refresh_token_revokes_the_whole_family(client: AsyncClient):
    tokens = await register(client)
    rotated = (await refresh_native(client, tokens["refresh_token"])).json()

    reuse = await refresh_native(client, tokens["refresh_token"])
    after_theft = await refresh_native(client, rotated["refresh_token"])

    assert reuse.status_code == 401
    assert after_theft.status_code == 401


async def test_web_refresh_reads_the_cookie(client: AsyncClient):
    registered = await client.post(
        "/api/v1/auth/register",
        json={
            "name": "Alex",
            "email": "web@example.com",
            "password": PASSWORD,
            "timezone": "Europe/Warsaw",
            "language": "uk",
        },
        headers=WEB,
    )

    response = await client.post(
        "/api/v1/auth/refresh",
        headers={**WEB, "Cookie": f"refresh_token={refresh_cookie(registered)}"},
    )

    assert response.status_code == 200
    assert refresh_cookie(response) != refresh_cookie(registered)


async def test_refresh_without_a_token_is_unauthorized(client: AsyncClient):
    response = await client.post("/api/v1/auth/refresh", headers=WEB)

    assert response.status_code == 401
    assert response.json()["code"] == "unauthorized"


async def test_expired_refresh_token_is_rejected(
    client: AsyncClient, monkeypatch: pytest.MonkeyPatch
):
    tokens = await register(client)
    later = clock.utcnow() + timedelta(days=31)
    monkeypatch.setattr(clock, "utcnow", lambda: later)

    response = await refresh_native(client, tokens["refresh_token"])

    assert response.status_code == 401


async def test_logout_revokes_the_family_and_clears_the_cookie(client: AsyncClient):
    tokens = await register(client)

    response = await client.post(
        "/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]}, headers=NATIVE
    )

    assert response.status_code == 204
    assert 'refresh_token=""' in response.headers["set-cookie"]
    assert (await refresh_native(client, tokens["refresh_token"])).status_code == 401


async def test_password_reset_flow(client: AsyncClient, emails: CapturedEmails):
    first = await register(client)
    second = await login(client)

    forgot = await client.post("/api/v1/auth/password/forgot", json={"email": "Alex@example.com"})
    assert forgot.status_code == 202
    [(email, link)] = emails.links
    assert email == "alex@example.com"
    token = link.split("token=", 1)[1]

    reset = await client.post(
        "/api/v1/auth/password/reset",
        json={"token": token, "new_password": "brand-new-password"},
    )

    assert reset.status_code == 204
    for old in (first, second):
        assert (await refresh_native(client, old["refresh_token"])).status_code == 401
    old_login = await client.post(
        "/api/v1/auth/login",
        json={"email": "alex@example.com", "password": PASSWORD},
        headers=NATIVE,
    )
    assert old_login.status_code == 401
    assert await login(client, password="brand-new-password")
    reuse = await client.post(
        "/api/v1/auth/password/reset", json={"token": token, "new_password": "another-password"}
    )
    assert reuse.status_code == 400


async def test_forgot_password_for_unknown_email_looks_the_same(
    client: AsyncClient, emails: CapturedEmails
):
    response = await client.post(
        "/api/v1/auth/password/forgot", json={"email": "nobody@example.com"}
    )

    assert response.status_code == 202
    assert emails.links == []


async def test_expired_reset_link_is_rejected(
    client: AsyncClient, emails: CapturedEmails, monkeypatch: pytest.MonkeyPatch
):
    await register(client)
    await client.post("/api/v1/auth/password/forgot", json={"email": "alex@example.com"})
    token = emails.links[0][1].split("token=", 1)[1]
    later = clock.utcnow() + timedelta(minutes=31)
    monkeypatch.setattr(clock, "utcnow", lambda: later)

    response = await client.post(
        "/api/v1/auth/password/reset", json={"token": token, "new_password": "brand-new-password"}
    )

    assert response.status_code == 400
    assert response.json()["code"] == "bad_request"


async def test_refresh_tokens_are_stored_only_as_hashes(client: AsyncClient, db: AsyncSession):
    tokens = await register(client)

    stored = await db.scalar(
        select(func.count())
        .select_from(RefreshToken)
        .where(RefreshToken.token_hash == tokens["refresh_token"])
    )

    assert stored == 0
