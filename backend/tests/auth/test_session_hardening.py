import pytest
from httpx import AsyncClient, Response
from pydantic import SecretStr

from app.config import get_settings
from tests.conftest import CapturedEmails
from tests.helpers import NATIVE, PASSWORD, bearer, login, register

pytestmark = pytest.mark.anyio

PROXY_SECRET = "a-proxy-secret-for-the-cloudflare-worker"
NEW_PASSWORD = "brand-new-password"


async def me(client: AsyncClient, tokens: dict[str, str]) -> int:
    return (await client.get("/api/v1/me", headers=bearer(tokens["access_token"]))).status_code


async def refresh(client: AsyncClient, tokens: dict[str, str]) -> Response:
    return await client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}, headers=NATIVE
    )


async def logout(client: AsyncClient, tokens: dict[str, str]) -> None:
    response = await client.post(
        "/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]}, headers=NATIVE
    )
    assert response.status_code == 204


async def reset_password(client: AsyncClient, emails: CapturedEmails, ip: str) -> None:
    headers = {"CF-Connecting-IP": ip, "X-Proxy-Secret": PROXY_SECRET}
    forgot = await client.post(
        "/api/v1/auth/password/forgot", json={"email": "alex@example.com"}, headers=headers
    )
    assert forgot.status_code == 202
    token = emails.links[-1][1].split("token=", 1)[1]
    reset = await client.post(
        "/api/v1/auth/password/reset",
        json={"token": token, "new_password": NEW_PASSWORD},
        headers=headers,
    )
    assert reset.status_code == 204


def login_from(client: AsyncClient, ip: str, password: str, secret: str | None = PROXY_SECRET):
    headers = {**NATIVE, "CF-Connecting-IP": ip}
    if secret is not None:
        headers["X-Proxy-Secret"] = secret
    return client.post(
        "/api/v1/auth/login",
        json={"email": "alex@example.com", "password": password},
        headers=headers,
    )


def check_link_from(client: AsyncClient, ip: str, secret: str | None = None):
    headers = {"CF-Connecting-IP": ip}
    if secret is not None:
        headers["X-Proxy-Secret"] = secret
    return client.post("/api/v1/auth/password/reset/check", json={"token": "x"}, headers=headers)


@pytest.fixture
def behind_the_worker(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "proxy_secret", SecretStr(PROXY_SECRET))


async def test_logging_out_ends_the_access_token_at_once(client: AsyncClient):
    tokens = await register(client)

    await logout(client, tokens)

    assert await me(client, tokens) == 401


async def test_logging_out_on_one_device_leaves_the_others(client: AsyncClient):
    phone = await register(client)
    laptop = await login(client)

    await logout(client, laptop)

    assert await me(client, phone) == 200
    assert await me(client, laptop) == 401


async def test_a_password_change_ends_the_other_devices_at_once(client: AsyncClient):
    this_device = await register(client)
    other_device = await login(client)

    response = await client.post(
        "/api/v1/me/password",
        json={"current_password": PASSWORD, "new_password": NEW_PASSWORD},
        headers=bearer(this_device["access_token"]),
    )

    assert response.status_code == 204
    assert await me(client, this_device) == 200
    assert await me(client, other_device) == 401


async def test_a_password_reset_ends_every_access_token(
    client: AsyncClient, emails: CapturedEmails, behind_the_worker: None
):
    phone = await register(client)
    laptop = await login(client)

    await reset_password(client, emails, "203.0.113.9")

    assert await me(client, phone) == 401
    assert await me(client, laptop) == 401


async def test_a_reused_refresh_token_ends_the_access_tokens_of_its_sign_in(client: AsyncClient):
    tokens = await register(client)
    rotated = (await refresh(client, tokens)).json()

    reuse = await refresh(client, tokens)

    assert reuse.status_code == 401
    assert await me(client, rotated) == 401


async def test_a_made_up_client_address_does_not_reset_the_ip_limit(client: AsyncClient):
    statuses = [(await check_link_from(client, f"203.0.113.{n}")).status_code for n in range(21)]

    assert statuses == [400] * 20 + [429]


async def test_a_wrong_proxy_secret_counts_as_no_secret(
    client: AsyncClient, behind_the_worker: None
):
    statuses = [
        (await check_link_from(client, f"203.0.113.{n}", secret="wrong")).status_code
        for n in range(21)
    ]

    assert statuses == [400] * 20 + [429]


async def test_the_worker_names_each_caller(client: AsyncClient, behind_the_worker: None):
    statuses = [
        (await check_link_from(client, f"203.0.113.{n}", secret=PROXY_SECRET)).status_code
        for n in range(25)
    ]

    assert statuses == [400] * 25


async def test_ipv6_callers_count_per_64_network(client: AsyncClient, behind_the_worker: None):
    statuses = [
        (await check_link_from(client, f"2001:db8:1:2::{n:x}", secret=PROXY_SECRET)).status_code
        for n in range(1, 22)
    ]

    assert statuses == [400] * 20 + [429]


async def test_wrong_passwords_from_one_network_do_not_lock_out_another(
    client: AsyncClient, behind_the_worker: None
):
    await register(client)

    attacker = [
        (await login_from(client, "198.51.100.7", "wrong-password")).status_code for _ in range(6)
    ]
    owner = await login_from(client, "203.0.113.9", PASSWORD)

    assert attacker == [401] * 5 + [429]
    assert owner.status_code == 200


async def test_many_networks_together_are_limited_and_a_reset_lifts_it(
    client: AsyncClient, emails: CapturedEmails, behind_the_worker: None
):
    await register(client)
    for network in range(4):
        for _ in range(5):
            wrong = await login_from(client, f"198.51.100.{network}", "wrong-password")
            assert wrong.status_code == 401

    blocked = await login_from(client, "203.0.113.9", PASSWORD)
    await reset_password(client, emails, "203.0.113.10")
    after_reset = await login_from(client, "203.0.113.9", NEW_PASSWORD)

    assert blocked.status_code == 429
    assert after_reset.status_code == 200


async def test_a_reset_also_lifts_the_limit_of_the_owners_own_network(
    client: AsyncClient, emails: CapturedEmails, behind_the_worker: None
):
    await register(client)
    for _ in range(5):
        assert (await login_from(client, "203.0.113.9", "wrong-password")).status_code == 401
    blocked = await login_from(client, "203.0.113.9", PASSWORD)

    await reset_password(client, emails, "203.0.113.9")
    after_reset = await login_from(client, "203.0.113.9", NEW_PASSWORD)

    assert blocked.status_code == 429
    assert after_reset.status_code == 200


async def test_right_passwords_do_not_use_up_the_account_limit(
    client: AsyncClient, behind_the_worker: None
):
    await register(client)
    for _ in range(8):
        assert (await login_from(client, "203.0.113.9", PASSWORD)).status_code == 200

    wrong = [
        (await login_from(client, "203.0.113.9", "wrong-password")).status_code for _ in range(6)
    ]

    assert wrong == [401] * 5 + [429]
