import pytest
from alembic import command
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from tests.conftest import alembic_config, database_url_for, drop_database, recreate_database

pytestmark = pytest.mark.anyio


def test_models_match_migrations(database_url: str):
    command.check(alembic_config(database_url))


def test_migrations_downgrade_and_upgrade_cleanly():
    url = database_url_for("migrations")
    recreate_database(url)
    config = alembic_config(url)
    try:
        command.upgrade(config, "head")
        command.downgrade(config, "base")
        command.upgrade(config, "head")
    finally:
        drop_database(url)


async def test_test_database_is_reachable(db: AsyncSession):
    result = await db.execute(text("SELECT current_database()"))

    assert result.scalar_one().endswith("_test")


async def test_migrations_are_applied(db: AsyncSession):
    result = await db.execute(text("SELECT count(*) FROM alembic_version"))

    assert result.scalar_one() == 1
