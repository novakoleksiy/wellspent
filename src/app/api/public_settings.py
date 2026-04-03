from fastapi import APIRouter

from app.core.config import settings

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("/public")
async def public_settings():
    return {"registration_open": settings.registration_open}
