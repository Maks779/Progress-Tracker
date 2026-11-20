from uuid import UUID

from fastapi import APIRouter, Response

from app.auth.dependencies import CurrentUser
from app.database import DbSession
from app.exercises import service
from app.exercises.schemas import ExerciseList, ExerciseOut, ExerciseWrite

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
