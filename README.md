# Progress Tracker

A personal progress tracker focused on workouts and physical activity, with extra tracker types for other habits (reading, meditation, water, ...).

University project for the course **Programming Languages 2**.

> **Status:** research & architecture phase. No application code yet.

## Architecture at a glance (planned)

| Layer    | Technology (proposed)                         | Folder       |
|----------|-----------------------------------------------|--------------|
| Frontend | Flutter Web SPA (+ desktop build as a bonus)  | `frontend/`  |
| Backend  | Python, FastAPI, SQLAlchemy, Alembic          | `backend/`   |
| Database | PostgreSQL                                    | via Docker   |

Final choices and their reasons are recorded in [`docs/decisions/`](docs/decisions/).

## Repository layout

```
.
├── backend/          FastAPI service (REST API, business rules, auth)
├── frontend/         Flutter app (web SPA + desktop)
├── docs/             Product spec, architecture, API spec, ADRs, PDF outline
├── .env.example      Environment variables template
└── README.md
```

## Documentation

Start with [`docs/README.md`](docs/README.md). It lists every document and its status.

## Team

| Name | Role |
|------|------|
| TBD  | TBD  |
