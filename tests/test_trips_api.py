from __future__ import annotations

from dataclasses import replace
from datetime import date, datetime, timezone

import pytest
from httpx import ASGITransport, AsyncClient

from app.adapters.swiss_tourism_client import SwissTourismAuthError
from app.core.db import get_current_user, get_swiss_tourism_client, get_trip_repo
from app.main import app
from app.ports.repositories import TripRecord, UserRecord


class FakeTripRepo:
    def __init__(self, trips: list[TripRecord] | None = None) -> None:
        self.trips = {trip.id: trip for trip in trips or []}

    async def set_status(
        self, trip_id: int, user_id: int, *, status: str
    ) -> TripRecord | None:
        trip = self.trips.get(trip_id)
        if not trip or trip.user_id != user_id:
            return None

        updated = replace(trip, status=status)
        self.trips[trip_id] = updated
        return updated

    async def complete(
        self,
        trip_id: int,
        user_id: int,
        *,
        rating: int,
        comment: str | None,
        image_urls: list[str],
    ) -> TripRecord | None:
        trip = self.trips.get(trip_id)
        if not trip or trip.user_id != user_id:
            return None

        updated = replace(
            trip,
            status="completed",
            completion_rating=rating,
            completion_comment=comment,
            completion_image_urls=image_urls,
            completed_at=datetime.now(timezone.utc),
        )
        self.trips[trip_id] = updated
        return updated


def _user_record(user_id: int = 1) -> UserRecord:
    return UserRecord(
        id=user_id,
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


def _trip_record(*, trip_id: int = 1, user_id: int = 1) -> TripRecord:
    return TripRecord(
        id=trip_id,
        user_id=user_id,
        title="Weekend in Zurich",
        destination="Zurich",
        status="draft",
        description="A short city break",
        itinerary={"days": []},
        created_at=datetime.now(timezone.utc),
        shared_at=None,
    )


class FailingSwissTourismClient:
    async def list_destinations(self, **kwargs):
        raise SwissTourismAuthError("Swiss Tourism API authentication failed")


@pytest.mark.asyncio
async def test_recommend_returns_503_when_swiss_tourism_auth_fails():
    app.dependency_overrides[get_current_user] = lambda: _user_record()
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


@pytest.mark.asyncio
async def test_patch_trip_status_marks_trip_as_completed():
    trip_repo = FakeTripRepo(trips=[_trip_record()])
    app.dependency_overrides[get_current_user] = lambda: _user_record()
    app.dependency_overrides[get_trip_repo] = lambda: trip_repo

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            response = await client.patch(
                "/api/trips/1/status",
                json={"status": "completed"},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "completed"


@pytest.mark.asyncio
async def test_patch_trip_complete_saves_review_details():
    trip_repo = FakeTripRepo(trips=[_trip_record()])
    app.dependency_overrides[get_current_user] = lambda: _user_record()
    app.dependency_overrides[get_trip_repo] = lambda: trip_repo

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            response = await client.patch(
                "/api/trips/1/complete",
                json={
                    "rating": 4,
                    "comment": "Great train connections.",
                    "image_urls": ["https://example.com/train.jpg"],
                },
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()["status"] == "completed"
    assert response.json()["completion_rating"] == 4
    assert response.json()["completion_comment"] == "Great train connections."
    assert response.json()["completion_image_urls"] == ["https://example.com/train.jpg"]
    assert response.json()["completed_at"] is not None


@pytest.mark.asyncio
async def test_patch_trip_complete_rejects_invalid_rating():
    trip_repo = FakeTripRepo(trips=[_trip_record()])
    app.dependency_overrides[get_current_user] = lambda: _user_record()
    app.dependency_overrides[get_trip_repo] = lambda: trip_repo

    try:
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://testserver"
        ) as client:
            response = await client.patch(
                "/api/trips/1/complete",
                json={"rating": 6, "comment": None, "image_urls": []},
            )
    finally:
        app.dependency_overrides.clear()

    assert response.status_code == 422
