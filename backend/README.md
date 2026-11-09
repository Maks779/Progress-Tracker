# Backend

REST API for Ember.

## Stack

- Python 3.13, managed with [uv](https://docs.astral.sh/uv/)
- FastAPI (served by Uvicorn), pydantic-settings
- pytest, Ruff
- PostgreSQL through Docker Compose
- Planned: SQLAlchemy 2 (async) with psycopg 3, Alembic, PyJWT, pwdlib (Argon2id)

## Layout

```
backend/
├── app/
│   ├── main.py        app factory: CORS, docs at /api/docs, routers under /api/v1
│   ├── config.py      settings from environment variables and ../.env
│   ├── system/        health check
│   └── <domain>/      one package per business area
├── tests/             unit tests, mirroring app/
├── Dockerfile
├── pyproject.toml     dependencies and tool settings (pytest, Ruff)
└── uv.lock
```

Business rules are pure functions without database access, so they are unit-tested directly.

## Run

With Docker, from the repository root:

```bash
docker compose up --build
```

Without Docker, from `backend/`:

```bash
uv sync
uv run fastapi dev app/main.py
```

API docs: http://localhost:8000/api/docs

## Tests and linting

From `backend/`:

```bash
uv run pytest
uv run ruff check .
uv run ruff format .
```
