from fastapi import APIRouter

router = APIRouter(tags=["system"])


@router.get("/health", summary="Health check endpoint")
async def health() -> dict[str, str]:
    return {"status": "ok"}
