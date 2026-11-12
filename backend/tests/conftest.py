import asyncio
from collections.abc import AsyncIterator
from pathlib import Path

import psycopg
import pytest
from alembic import command
from alembic.config import Config
from httpx import ASGITransport, AsyncClient
from sqlalchemy import make_url
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, create_async_engine
from sqlalchemy.pool import NullPool

from app.auth.email import get_email_sender
from app.config import Settings
from app.database import get_db
from app.main import app
from app.rate_limit import reset_all

BACKEND_DIR = Path(__file__).resolve().parents[1]


def database_url_for(suffix: str = "test") -> str:
    url = make_url(Settings().database_url)
    return url.set(database=f"{url.database}_{suffix}").render_as_string(hide_password=False)


def _admin_execute(database_url: str, *statements: str) -> None:
    url = make_url(database_url)
    admin_url = url.set(drivername="postgresql", database="postgres")
    with psycopg.connect(admin_url.render_as_string(hide_password=False), autocommit=True) as conn:
        for statement in statements:
            conn.execute(statement.format(name=url.database))


def recreate_database(database_url: str) -> None:
    _admin_execute(
        database_url, 'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)', 'CREATE DATABASE "{name}"'
    )


def drop_database(database_url: str) -> None:
    _admin_execute(database_url, 'DROP DATABASE IF EXISTS "{name}" WITH (FORCE)')


def alembic_config(database_url: str) -> Config:
    config = Config(BACKEND_DIR / "alembic.ini")
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    return config


@pytest.fixture(scope="session")
def anyio_backend() -> tuple[str, dict[str, object]]:
    return "asyncio", {"loop_factory": asyncio.SelectorEventLoop}


@pytest.fixture(scope="session")
def database_url() -> str:
    url = database_url_for()
    recreate_database(url)
    command.upgrade(alembic_config(url), "head")
    return url


@pytest.fixture(scope="session")
async def engine(database_url: str) -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(database_url, poolclass=NullPool)
    yield engine
    await engine.dispose()


@pytest.fixture
async def db(engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    async with engine.connect() as connection:
        transaction = await connection.begin()
        session = AsyncSession(
            bind=connection, join_transaction_mode="create_savepoint", expire_on_commit=False
        )
        try:
            yield session
        finally:
            await session.close()
            await transaction.rollback()


class CapturedEmails:
    def __init__(self) -> None:
        self.links: list[tuple[str, str]] = []

    async def send_password_reset(self, email: str, link: str) -> None:
        self.links.append((email, link))


@pytest.fixture(autouse=True)
def _fresh_rate_limits() -> None:
    reset_all()


@pytest.fixture
def emails() -> CapturedEmails:
    captured = CapturedEmails()
    app.dependency_overrides[get_email_sender] = lambda: captured
    return captured


@pytest.fixture
async def client(db: AsyncSession) -> AsyncIterator[AsyncClient]:
    async def override_get_db() -> AsyncIterator[AsyncSession]:
        yield db

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client
    app.dependency_overrides.clear()
