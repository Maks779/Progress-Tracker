from uuid import UUID

from fastapi import APIRouter, Response

from app.auth.dependencies import CurrentUser
from app.database import DbSession
from app.exercises import service
from app.exercises.schemas import ExerciseList, ExerciseOut, ExerciseWrite
from app.sessions import history
from app.sessions.schemas import ExerciseRecords, LastSets
from app.stats import service as stats
from app.stats.rules import Period
from app.stats.schemas import ExerciseProgress

router = APIRouter(prefix="/exercises", tags=["exercises"])


@router.get("", response_model=ExerciseList, summary="Full exercise list (built-in + custom)")
async def list_exercises(user: CurrentUser, db: DbSession) -> ExerciseList:
    return ExerciseList(items=await service.list_exercises(db, user.id))


@router.put(
    "/{exercise_id}",
    response_model=ExerciseOut,
    responses={201: {"model": ExerciseOut, "description": "Created."}},
    summary="Create or update a custom exercise (idempotent)",
)
async def put_exercise(
    exercise_id: UUID, data: ExerciseWrite, user: CurrentUser, db: DbSession, response: Response
) -> ExerciseOut:
    exercise, created = await service.put_custom(db, user.id, exercise_id, data)
    response.status_code = 201 if created else 200
    return exercise


@router.delete("/{exercise_id}", status_code=204, summary="Delete a custom exercise (soft)")
async def delete_exercise(exercise_id: UUID, user: CurrentUser, db: DbSession) -> Response:
    await service.delete_custom(db, user.id, exercise_id)
    return Response(status_code=204)


@router.get(
    "/{exercise_id}/last-sets",
    response_model=LastSets,
    summary="Sets from the most recent session with this exercise (prefill)",
)
async def last_sets(exercise_id: UUID, user: CurrentUser, db: DbSession) -> LastSets:
    await service.get_available(db, user.id, exercise_id)
    return await history.last_sets(db, user.id, exercise_id)


@router.get(
    "/{exercise_id}/records",
    response_model=ExerciseRecords,
    summary="Current personal records of one exercise",
)
async def exercise_records(exercise_id: UUID, user: CurrentUser, db: DbSession) -> ExerciseRecords:
    await service.get_available(db, user.id, exercise_id)
    found = history.exercise_bests(
        await history.strength_history(db, user.id, {exercise_id}), exercise_id
    )
    return ExerciseRecords(
        exercise_id=exercise_id,
        max_weight=found.get("max_weight"),
        max_reps=found.get("max_reps"),
        estimated_1rm=found.get("estimated_1rm"),
    )


@router.get(
    "/{exercise_id}/progress", response_model=ExerciseProgress, summary="Exercise line chart"
)
async def exercise_progress(
    exercise_id: UUID, user: CurrentUser, db: DbSession, period: Period = "4w"
) -> ExerciseProgress:
    await service.get_available(db, user.id, exercise_id)
    return await stats.exercise_progress(db, user, exercise_id, period)
