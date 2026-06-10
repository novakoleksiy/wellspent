from fastapi import APIRouter, HTTPException, Request

from app.core.config import settings
from app.core.db import UserRepo
from app.core.rate_limit import limiter
from app.core.security import create_token
from app.schemas.schemas import Token

router = APIRouter(prefix="/demo", tags=["demo"])


@router.post("/session", response_model=Token)
@limiter.limit("20/minute")
async def demo_session(request: Request, repo: UserRepo):
    """Mint a JWT for the shared demo user — no credentials required.

    Only available when DEMO_MODE is enabled; otherwise returns 404 so the
    endpoint is invisible in normal production.
    """
    if not settings.demo_mode:
        raise HTTPException(404, "Not found")
    user = await repo.get_by_email(settings.demo_user_email)
    if not user:
        raise HTTPException(503, "Demo user not provisioned")
    return Token(access_token=create_token(user.id))
