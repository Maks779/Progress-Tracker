import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.anyio

WEB_APP = "http://localhost:8081"


async def test_the_web_app_may_read_the_name_of_a_downloaded_file(client: AsyncClient):
    response = await client.get("/api/v1/health", headers={"Origin": WEB_APP})

    assert response.headers["access-control-allow-origin"] == WEB_APP
    exposed = response.headers["access-control-expose-headers"].lower()
    assert "content-disposition" in exposed


async def test_other_sites_get_no_cors_access(client: AsyncClient):
    response = await client.get("/api/v1/health", headers={"Origin": "https://evil.example"})

    assert "access-control-allow-origin" not in response.headers
