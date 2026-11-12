from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.auth.router import router as auth_router
from app.config import get_settings
from app.errors import register_error_handlers
from app.system.router import router as system_router
from app.users.router import router as users_router


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title="Ember API",
        version="0.1.0",
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
    )

    register_error_handlers(app)

    for router in (system_router, auth_router, users_router):
        app.include_router(router, prefix="/api/v1")

    return app


app = create_app()
