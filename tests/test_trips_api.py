from __future__ import annotations

from datetime import date, datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from app.adapters.swiss_tourism_client import SwissTourismAuthError
from app.core.db import get_current_user, get_swiss_tourism_client
from app.main import app
from app.ports.repositories import UserRecord


class FailingSwissTourismClient:
    async def list_destinations(self, **kwargs):
        raise SwissTourismAuthError("Swiss Tourism API authentication failed")


@pytest.mark.asyncio
async def test_recommend_returns_503_when_swiss_tourism_auth_fails():
    app.dependency_overrides[get_current_user] = lambda: UserRecord(
        id=1,
        email="user@example.com",
        hashed_password="hashed",
        full_name="Test User",
        preferences={
            "travel_styles": ["city"],
            "budget_tier": "mid",
            "pace": "moderate",
        },
        created_at=datetime.now(timezone.utc),
    )
    app.dependency_overrides[get_swiss_tourism_client] = lambda: (
        FailingSwissTourismClient()
    )

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            response = await client.post(
                "/api/trips/recommend",
                json={
                    "destination": "Zurich",
                    "start_date": date(2026, 4, 20).isoformat(),
                    "end_date": date(2026, 4, 22).isoformat(),
                    "travelers": 2,
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 503
    assert response.json() == {"detail": "Swiss Tourism API authentication failed"}
