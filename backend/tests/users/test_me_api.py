import pytest
from httpx import AsyncClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.models import RefreshToken
from app.users.models import UserAccount
from tests.helpers import NATIVE, PASSWORD, bearer, login, register

pytestmark = pytest.mark.anyio


async def test_me_requires_a_valid_access_token(client: AsyncClient):
    missing = await client.get("/api/v1/me")
    garbage = await client.get("/api/v1/me", headers=bearer("garbage"))

    assert missing.status_code == garbage.status_code == 401
    assert missing.headers["www-authenticate"] == "Bearer"


async def test_me_returns_profile_with_default_settings(client: AsyncClient):
    tokens = await register(client, email="Alex@Example.com", language="uk")

    response = await client.get("/api/v1/me", headers=bearer(tokens["access_token"]))

    assert response.status_code == 200
    me = response.json()
    assert me["email"] == "alex@example.com"
    assert me["name"] == "Alex Morgan"
    assert me["language"] == "uk"
    assert me["timezone"] == "Europe/Warsaw"
    assert (me["theme"], me["weight_unit"], me["distance_unit"]) == ("system", "kg", "km")
    assert me["notify_rest_timer"] is True
    assert me["notify_weekly_reminder"] is True
    assert "password_hash" not in me


async def test_update_me_changes_only_given_fields(client: AsyncClient):
    headers = bearer((await register(client))["access_token"])

    response = await client.patch(
        "/api/v1/me",
        json={"language": "pl", "weight_unit": "lb", "notify_weekly_reminder": False},
        headers=headers,
    )

    assert response.status_code == 200
    me = response.json()
    assert (me["language"], me["weight_unit"], me["notify_weekly_reminder"]) == ("pl", "lb", False)
    assert me["distance_unit"] == "km"


@pytest.mark.parametrize(
    "body",
    [{}, {"name": None}, {"timezone": "Nowhere/City"}, {"theme": "blue"}, {"email": "x@y.z"}],
)
async def test_update_me_rejects_invalid_bodies(client: AsyncClient, body: dict[str, object]):
    headers = bearer((await register(client))["access_token"])

    response = await client.patch("/api/v1/me", json=body, headers=headers)

    assert response.status_code == 422


async def test_change_password_keeps_this_device_and_signs_out_others(client: AsyncClient):
    this_device = await register(client)
    other_device = await login(client)

    response = await client.post(
        "/api/v1/me/password",
        json={"current_password": PASSWORD, "new_password": "brand-new-password"},
        headers=bearer(this_device["access_token"]),
    )

    assert response.status_code == 204
    keep = await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": this_device["refresh_token"]}, headers=NATIVE
    )
    drop = await client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": other_device["refresh_token"]},
        headers=NATIVE,
    )
    assert keep.status_code == 200
    assert drop.status_code == 401
    assert await login(client, password="brand-new-password")


async def test_change_password_requires_the_current_password(client: AsyncClient):
    headers = bearer((await register(client))["access_token"])

    response = await client.post(
        "/api/v1/me/password",
        json={"current_password": "wrong-password", "new_password": "brand-new-password"},
        headers=headers,
    )

    assert response.status_code == 401
    assert response.json()["code"] == "invalid_credentials"


async def test_delete_account_needs_the_password(client: AsyncClient):
    headers = bearer((await register(client))["access_token"])

    response = await client.post(
        "/api/v1/me/delete", json={"password": "wrong-password"}, headers=headers
    )

    assert response.status_code == 401


async def test_delete_account_removes_the_user_and_tokens(client: AsyncClient, db: AsyncSession):
    tokens = await register(client)

    response = await client.post(
        "/api/v1/me/delete", json={"password": PASSWORD}, headers=bearer(tokens["access_token"])
    )

    assert response.status_code == 204
    assert await db.scalar(select(func.count()).select_from(UserAccount)) == 0
    assert await db.scalar(select(func.count()).select_from(RefreshToken)) == 0
    after = await client.get("/api/v1/me", headers=bearer(tokens["access_token"]))
    assert after.status_code == 401
