from __future__ import annotations

from datetime import datetime, timezone

import pytest
from fastapi import HTTPException

from app.api.public_settings import public_settings
from app.api.waitlist import join
from app.core.config import settings
from app.schemas.schemas import JoinWaitlistRequest


class FakeWaitlistRepo:
    def __init__(self) -> None:
        self.entries: dict[str, dict[str, object]] = {}
        self.next_id = 1

    async def get_by_email(self, email: str):
        return self.entries.get(email)

    async def create(self, *, email: str, name: str | None = None):
        entry = {
            "id": self.next_id,
            "email": email,
            "name": name,
            "created_at": datetime.now(timezone.utc),
        }
        self.next_id += 1
        self.entries[email] = entry
        return entry


@pytest.mark.asyncio
async def test_join_waitlist_returns_created_message():
    repo = FakeWaitlistRepo()

    response = await join(
        JoinWaitlistRequest(email="traveler@example.com", name="Traveler"),
        repo,
    )

    assert response.message == "You're on the list! We'll be in touch."
    assert repo.entries["traveler@example.com"]["name"] == "Traveler"


@pytest.mark.asyncio
async def test_join_waitlist_rejects_duplicate_email():
    repo = FakeWaitlistRepo()
    await repo.create(email="traveler@example.com", name="Traveler")

    with pytest.raises(HTTPException) as exc_info:
        await join(JoinWaitlistRequest(email="traveler@example.com"), repo)

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail == "This email is already on the waitlist"


@pytest.mark.asyncio
async def test_public_settings_exposes_registration_flag(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(settings, "registration_open", False)

    response = await public_settings()

    assert response == {"registration_open": False}
