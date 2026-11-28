# Ember

A personal progress tracker focused on workouts (strength and cardio), with optional trackers for reading and other habits. One codebase for the web, Android and iOS.


> **Status:** the backend API is in place (accounts, trackers, sessions, records, goals, statistics, export). The frontend is not started yet.

## Stack

| Layer | Technology | Folder |
|---|---|---|
| Frontend | Expo (React Native + TypeScript): web SPA, Android, iOS | `frontend/` |
| Backend | Python 3.13, FastAPI, SQLAlchemy, Alembic, pytest | `backend/` |
| Database | PostgreSQL | Docker locally, Neon in production |
| Hosting | Cloudflare (web), Google Cloud Run (API), Neon (database) | |

## Quick start

Requirements: [Docker Desktop](https://www.docker.com/products/docker-desktop/).

```bash
cp .env.example .env
docker compose up --build
```

On Windows PowerShell use `Copy-Item .env.example .env`. Then open the interactive API docs at http://localhost:8000/api/docs.

Password reset emails go to Mailpit, a local test mailbox: http://localhost:8025. Live, the API sends them through Gmail's SMTP server (see `.env.example`).

Backend development without Docker, tests and linting: [backend/README.md](backend/README.md).

## Repository layout

```
.
├── backend/              FastAPI service: REST API, business rules, auth
├── frontend/             Expo app (not started yet)
├── docker-compose.yml    Local API + PostgreSQL
├── .env.example          Environment variables template
└── README.md
```

## Author

Maksym Bodnar
