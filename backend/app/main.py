from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.openapi.utils import get_openapi

from app.auth.router import router as auth_router
from app.books.router import router as books_router
from app.config import get_settings
from app.errors import problem_docs, register_error_handlers, use_problem_media_type
from app.exercises.router import router as exercises_router
from app.goals.router import router as goals_router
from app.sessions.router import records_router
from app.sessions.router import router as sessions_router
from app.stats.router import router as stats_router
from app.system.router import router as system_router
from app.trackers.router import router as trackers_router
from app.users.router import router as users_router

DESCRIPTION = """
REST API of **Ember**, a personal progress tracker for workouts, reading and habits.

## Authentication

- Sign up or log in with `POST /api/v1/auth/register` or `/auth/login` and send the header
  `X-Client: web` or `X-Client: native`.
- Send the access token as `Authorization: Bearer <token>`. It lives 15 minutes.
- Get a new one with `POST /api/v1/auth/refresh`. Web clients send the `refresh_token`
  cookie (httpOnly); native clients send the refresh token in the body. Refresh tokens rotate:
  reusing an old one signs out that device.

## Usage limits

Log in, sign up and password reset requests are limited to 5 per 15 minutes per email and
20 per 15 minutes per IP address. Over the limit the API answers `429` with `Retry-After`.

## Conventions

- Errors use RFC 9457 problem details (`application/problem+json`) with a stable `code`;
  validation errors list each invalid `field`.
- Units are canonical: weight in kg, distance in metres, durations in seconds.
- Times are ISO 8601 in UTC; `local_date` is the date in the user's timezone.
- Sessions, custom exercises and books are created with `PUT` under a client-generated UUID,
  so retries from an offline outbox never create duplicates.
- Lists that can grow use cursor pagination: `limit` and `cursor`, answered with `next_cursor`.
- Every resource belongs to the signed-in user; another user's ID answers `404`.
"""

TAGS = [
    {"name": "system", "description": "Health check."},
    {"name": "auth", "description": "Accounts, tokens and password reset."},
    {"name": "me", "description": "Profile, settings, password, deletion and export."},
    {"name": "trackers", "description": "Strength, cardio, reading and general trackers."},
    {"name": "exercises", "description": "Exercise catalog, prefill and personal records."},
    {"name": "books", "description": "Books with progress and estimated finish date."},
    {"name": "sessions", "description": "Logged sessions of every tracker type."},
    {"name": "goals", "description": "Goals with status and weekly streaks."},
    {"name": "stats", "description": "Data for Home, History and Progress."},
]

ROUTERS = (
    auth_router,
    users_router,
    trackers_router,
    exercises_router,
    books_router,
    sessions_router,
    records_router,
    goals_router,
    stats_router,
)


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Ember API",
        version="0.1.0",
        description=DESCRIPTION,
        openapi_tags=TAGS,
        generate_unique_id_function=lambda route: route.name,
        docs_url="/api/docs",
        redoc_url=None,
        openapi_url="/api/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["Content-Disposition"],
    )

    register_error_handlers(app)

    app.include_router(system_router, prefix="/api/v1")
    for router in ROUTERS:
        app.include_router(router, prefix="/api/v1", responses=problem_docs(401, 404, 422))

    def openapi() -> dict[str, Any]:
        if app.openapi_schema is None:
            schema = get_openapi(
                title=app.title,
                version=app.version,
                description=app.description,
                routes=app.routes,
                tags=app.openapi_tags,
            )
            app.openapi_schema = use_problem_media_type(schema)
        return app.openapi_schema

    app.openapi = openapi
    return app


app = create_app()
