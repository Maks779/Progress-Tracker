from fastapi.testclient import TestClient

from app.main import app
from scripts.export_openapi import OUTPUT, render

client = TestClient(app)


def test_committed_schema_is_up_to_date():
    assert OUTPUT.read_text(encoding="utf-8") == render(), (
        "openapi.json is outdated; run: uv run python -m scripts.export_openapi"
    )


def schema() -> dict:
    response = client.get("/api/openapi.json")
    assert response.status_code == 200
    return response.json()


def operations():
    for path, methods in schema()["paths"].items():
        for method, operation in methods.items():
            yield path, method, operation


def test_docs_describe_authentication_and_limits():
    description = schema()["info"]["description"]

    for topic in ("Bearer", "X-Client", "429", "problem details", "cursor"):
        assert topic in description


def test_every_operation_has_a_summary_and_a_tag():
    for path, method, operation in operations():
        assert operation.get("summary"), f"{method} {path}"
        assert operation.get("tags"), f"{method} {path}"


def test_errors_are_documented_as_problem_details():
    for path, method, operation in operations():
        for status, response in operation["responses"].items():
            if status.startswith(("4", "5")):
                assert list(response.get("content", {})) == ["application/problem+json"], (
                    f"{method} {path} {status}"
                )


def test_operation_ids_are_the_endpoint_names():
    ids = [operation["operationId"] for _, _, operation in operations()]

    assert len(ids) == len(set(ids))
    assert "list_sessions" in ids
    assert all(operation_id.isidentifier() for operation_id in ids)


def test_default_validation_schema_is_replaced():
    schemas = schema()["components"]["schemas"]

    assert "Problem" in schemas
    assert "HTTPValidationError" not in schemas


def test_protected_operations_declare_bearer_auth():
    protected = [
        operation
        for path, _, operation in operations()
        if path.startswith(("/api/v1/me", "/api/v1/sessions", "/api/v1/goals"))
    ]

    assert protected
    assert all(op.get("security") == [{"HTTPBearer": []}] for op in protected)
