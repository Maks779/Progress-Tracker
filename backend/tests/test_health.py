from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_returns_ok():
    response = client.get("/api/v1/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_docs_are_served_under_api():
    response = client.get("/api/docs")

    assert response.status_code == 200


def test_unknown_route_returns_404():
    response = client.get("/api/v1/does-not-exist")

    assert response.status_code == 404
