# Backend

REST API for Progress Tracker.

**Planned stack:** Python 3.13, uv, FastAPI, SQLAlchemy 2 (async) + psycopg 3, Alembic, pytest, Ruff, PostgreSQL ([decisions §4](../.claude/docs/decisions.md)).

**Responsibilities:**
- Authentication and authorization (JWT access + rotating refresh tokens, Argon2id; [decisions §5](../.claude/docs/decisions.md))
- CRUD for trackers, sessions, entries, exercises, books, goals
- Business rules: weekly streaks, personal records, volume, goal progress, reading pace
- Statistics endpoints (weekly summary, streak, records)

> No source code yet.
