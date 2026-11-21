from uuid import UUID

from fastapi import APIRouter, Response

from app.auth.dependencies import CurrentUser
from app.database import DbSession
from app.goals import service
from app.goals.schemas import GoalCreate, GoalList, GoalOut, GoalUpdate

router = APIRouter(prefix="/goals", tags=["goals"])


@router.get("", response_model=GoalList, summary="List goals with progress, status and streak")
async def list_goals(user: CurrentUser, db: DbSession, tracker_id: UUID | None = None) -> GoalList:
    return GoalList(items=await service.list_goals(db, user, tracker_id))


@router.post("", status_code=201, response_model=GoalOut, summary="Create a goal")
async def create_goal(data: GoalCreate, user: CurrentUser, db: DbSession) -> GoalOut:
    return await service.create_goal(db, user, data)


@router.get("/{goal_id}", response_model=GoalOut, summary="Get a goal")
async def get_goal(goal_id: UUID, user: CurrentUser, db: DbSession) -> GoalOut:
    return await service.get_goal(db, user, goal_id)


@router.patch("/{goal_id}", response_model=GoalOut, summary="Update a goal")
async def update_goal(goal_id: UUID, data: GoalUpdate, user: CurrentUser, db: DbSession) -> GoalOut:
    return await service.update_goal(db, user, goal_id, data)


@router.delete("/{goal_id}", status_code=204, summary="Delete a goal (soft)")
async def delete_goal(goal_id: UUID, user: CurrentUser, db: DbSession) -> Response:
    await service.delete_goal(db, user, goal_id)
    return Response(status_code=204)
