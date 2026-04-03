from fastapi import APIRouter, HTTPException

from app.core.db import WaitlistRepo
from app.schemas.schemas import JoinWaitlistRequest, WaitlistResponse
from app.services.waitlist_service import AlreadyOnWaitlist, join_waitlist

router = APIRouter(prefix="/waitlist", tags=["waitlist"])


@router.post("", response_model=WaitlistResponse, status_code=201)
async def join(body: JoinWaitlistRequest, repo: WaitlistRepo):
    try:
        await join_waitlist(repo, email=body.email, name=body.name)
    except AlreadyOnWaitlist:
        raise HTTPException(409, "This email is already on the waitlist")
    return WaitlistResponse(message="You're on the list! We'll be in touch.")
