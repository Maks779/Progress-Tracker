from datetime import date
from uuid import UUID

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import clock
from app.errors import AppError, not_found
from app.exercises.models import Exercise
from app.exercises.schemas import ExerciseOut, ExerciseWrite


def builtin_is_read_only() -> AppError:
    return AppError(403, detail="Built-in exercises cannot be changed.")


def available_exercises(user_id: UUID):
    return select(Exercise).where(
        or_(Exercise.user_id.is_(None), Exercise.user_id == user_id),
        Exercise.deleted_at.is_(None),
    )


async def last_used_dates(db: AsyncSession, user_id: UUID) -> dict[UUID, date]:
    """Latest session date per exercise. Empty until strength sessions exist."""
    return {}


def to_out(exercise: Exercise, last_used: date | None) -> ExerciseOut:
    return ExerciseOut(
        id=exercise.id,
        key=exercise.key,
        name=exercise.name,
        is_custom=exercise.user_id is not None,
        muscle_group=exercise.muscle_group,
        equipment=exercise.equipment,
        mechanic=exercise.mechanic,
        last_used_date=last_used,
    )


async def list_exercises(db: AsyncSession, user_id: UUID) -> list[ExerciseOut]:
    """Recently used first (newest on top), then the rest alphabetically."""
    exercises = (await db.scalars(available_exercises(user_id))).all()
    used = await last_used_dates(db, user_id)
    items = [to_out(exercise, used.get(exercise.id)) for exercise in exercises]
    recent = sorted(
        (item for item in items if item.last_used_date is not None),
        key=lambda item: item.last_used_date,
        reverse=True,
    )
    rest = sorted(
        (item for item in items if item.last_used_date is None),
        key=lambda item: (item.name or item.key or "").lower(),
    )
    return recent + rest


async def get_available(db: AsyncSession, user_id: UUID, exercise_id: UUID) -> Exercise:
    exercise = await db.get(Exercise, exercise_id)
    visible = exercise is not None and exercise.deleted_at is None
    if not visible or exercise.user_id not in (None, user_id):
        raise not_found()
    return exercise


async def put_custom(
    db: AsyncSession, user_id: UUID, exercise_id: UUID, data: ExerciseWrite
) -> tuple[ExerciseOut, bool]:
    """Create or update a custom exercise under a client-generated ID; also says if it was new."""
    exercise = await db.get(Exercise, exercise_id)
    created = exercise is None
    if created:
        exercise = Exercise(id=exercise_id, user_id=user_id, **data.model_dump())
        db.add(exercise)
    elif exercise.user_id is None:
        raise builtin_is_read_only()
    elif exercise.user_id != user_id or exercise.deleted_at is not None:
        raise not_found()
    else:
        for field, value in data.model_dump().items():
            setattr(exercise, field, value)
    await db.commit()
    await db.refresh(exercise)
    used = await last_used_dates(db, user_id)
    return to_out(exercise, used.get(exercise.id)), created


async def delete_custom(db: AsyncSession, user_id: UUID, exercise_id: UUID) -> None:
    exercise = await get_available(db, user_id, exercise_id)
    if exercise.user_id is None:
        raise builtin_is_read_only()
    exercise.deleted_at = clock.utcnow()
    await db.commit()
