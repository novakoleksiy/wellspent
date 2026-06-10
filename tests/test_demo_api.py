from __future__ import annotations

from datetime import datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.core.db import get_user_repo
from app.core.rate_limit import limiter
from app.core.security import decode_token
from app.main import app
from app.ports.repositories import UserRecord


class FakeUserRepo:
    def __init__(self, users: list[UserRecord] | None = None) -> None:
        self.users = {user.email: user for user in users or []}

    async def get_by_email(self, email: str) -> UserRecord | None:
        return self.users.get(email)


def _demo_user() -> UserRecord:
    return UserRecord(
        id=42,
        email=settings.demo_user_email,
        hashed_password="hashed",
        full_name=settings.demo_user_name,
        preferences={"budget_tier": "mid", "pace": "moderate"},
        created_at=datetime.now(timezone.utc),
    )


async def _post_session() -> tuple[int, dict]:
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://testserver"
    ) as client:
        resp = await client.post("/api/demo/session")
    return resp.status_code, (resp.json() if resp.content else {})


@pytest.mark.asyncio
async def test_demo_session_404_when_disabled(monkeypatch):
    monkeypatch.setattr(settings, "demo_mode", False)
    status_code, _ = await _post_session()
    assert status_code == 404


@pytest.mark.asyncio
async def test_demo_session_mints_token_when_enabled(monkeypatch):
    monkeypatch.setattr(settings, "demo_mode", True)
    app.dependency_overrides[get_user_repo] = lambda: FakeUserRepo([_demo_user()])
    try:
        status_code, body = await _post_session()
    finally:
        app.dependency_overrides.clear()

    assert status_code == 200
    assert body["token_type"] == "bearer"
    assert decode_token(body["access_token"]) == 42


@pytest.mark.asyncio
async def test_demo_session_503_when_user_missing(monkeypatch):
    monkeypatch.setattr(settings, "demo_mode", True)
    app.dependency_overrides[get_user_repo] = lambda: FakeUserRepo([])
    try:
        status_code, _ = await _post_session()
    finally:
        app.dependency_overrides.clear()

    assert status_code == 503


@pytest.mark.asyncio
async def test_demo_session_rate_limited(monkeypatch):
    monkeypatch.setattr(settings, "demo_mode", True)
    monkeypatch.setattr(limiter, "enabled", True)  # tests disable it by default
    app.dependency_overrides[get_user_repo] = lambda: FakeUserRepo([_demo_user()])
    # A distinct client IP isolates this test's bucket from the 20/minute limit.
    headers = {"X-Forwarded-For": "203.0.113.7"}
    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            statuses = [
                (await client.post("/api/demo/session", headers=headers)).status_code
                for _ in range(22)
            ]
    finally:
        app.dependency_overrides.clear()

    assert statuses[:20] == [200] * 20
    assert 429 in statuses[20:]
