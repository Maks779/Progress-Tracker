import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio

EVERYWHERE = {
    "strict-transport-security": "max-age=31536000; includeSubDomains",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    "x-frame-options": "DENY",
    "cache-control": "no-store",
}
API_POLICY = "default-src 'none'; frame-ancestors 'none'"


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("GET", "/api/v1/health"),
        ("GET", "/api/v1/me"),
        ("GET", "/api/v1/no-such-page"),
        ("POST", "/api/v1/auth/login"),
        ("GET", "/api/openapi.json"),
    ],
)
async def test_every_api_answer_carries_the_security_headers(
    client: AsyncClient, method: str, path: str
):
    response = await client.request(method, path)

    for name, value in EVERYWHERE.items():
        assert response.headers[name] == value
    assert response.headers["content-security-policy"] == API_POLICY


async def test_a_cors_preflight_carries_them_too(client: AsyncClient):
    response = await client.options(
        "/api/v1/me",
        headers={"Origin": "http://localhost:8081", "Access-Control-Request-Method": "GET"},
    )

    assert response.status_code == 200
    assert response.headers["strict-transport-security"] == EVERYWHERE["strict-transport-security"]


async def test_the_docs_page_keeps_its_scripts(client: AsyncClient):
    response = await client.get("/api/docs")

    assert response.status_code == 200
    assert "content-security-policy" not in response.headers
    assert response.headers["x-content-type-options"] == "nosniff"
