from typing import Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import not_found


async def get_owned[Model](
    db: AsyncSession, model: type[Model], object_id: UUID, user_id: UUID
) -> Model:
    """Load a row the user owns. Missing, deleted and foreign rows all answer 404."""
    obj: Any = await db.get(model, object_id)
    if obj is None or obj.user_id != user_id or getattr(obj, "deleted_at", None) is not None:
        raise not_found()
    return obj
