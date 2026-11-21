# Backend

REST API for Ember.

## Stack

- Python 3.13, managed with [uv](https://docs.astral.sh/uv/)
- FastAPI (served by Uvicorn), Pydantic, pydantic-settings
- PostgreSQL through SQLAlchemy 2 (async) with psycopg 3; migrations with Alembic
- PyJWT for access tokens, pwdlib with Argon2id for passwords
- pytest, Ruff

## Layout

```
backend/
├── app/
│   ├── main.py        app factory: CORS, API docs, routers under /api/v1
│   ├── config.py      settings from environment variables and ../.env
│   ├── database.py    engine, sessions, base model
│   ├── errors.py      problem details error responses
│   ├── auth/ users/ trackers/ exercises/ books/ sessions/ goals/ stats/ exports/
│   │                  one package per business area: router, schemas, models, service,
│   │                  and rules.py with business rules as pure functions
│   └── system/        health check
├── migrations/        Alembic migrations (0001_accounts, 0002_trackers, …)
├── scripts/           export_openapi.py
├── tests/             tests per area, mirroring app/
├── openapi.json       generated API schema
├── Dockerfile
└── pyproject.toml     dependencies and tool settings (pytest, Ruff)
```

## Run

With Docker, from the repository root (migrations run on start):

```bash
docker compose up --build
```

Without Docker, from `backend/`, with the database container running:

```bash
uv sync
uv run alembic upgrade head
uv run fastapi dev app/main.py
```

API docs: http://localhost:8000/api/docs

## Tests and linting

From `backend/`, with the database container running (tests create their own `_test` database):

```bash
uv run pytest
uv run ruff check .
uv run ruff format .
```

## API schema

`openapi.json` is generated from the code and used to generate the app's API client. After changing endpoints, regenerate it (a test fails while it is outdated):

```bash
uv run python -m scripts.export_openapi
```
