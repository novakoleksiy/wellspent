from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone

import pytest

from app.ports.repositories import NewTrip, TripRecord
from app.services import trip_service


class FakeTripRepo:
    def __init__(self, trips: list[TripRecord] | None = None) -> None:
        self.trips = {trip.id: trip for trip in trips or []}
        self.next_id = max(self.trips, default=0) + 1

    async def create(self, data: NewTrip) -> TripRecord:
        trip = TripRecord(
            id=self.next_id,
            user_id=data.user_id,
            title=data.title,
            destination=data.destination,
            status=data.status,
            description=data.description,
            itinerary=data.itinerary,
            created_at=datetime.now(timezone.utc),
        )
        self.next_id += 1
        self.trips[trip.id] = trip
        return trip

    async def list_by_user(self, user_id: int) -> list[TripRecord]:
        return [trip for trip in self.trips.values() if trip.user_id == user_id]

    async def get_by_id_and_user(self, trip_id: int, user_id: int) -> TripRecord | None:
        trip = self.trips.get(trip_id)
        if trip and trip.user_id == user_id:
            return trip
        return None

    async def delete(self, trip_id: int, user_id: int) -> None:
        trip = await self.get_by_id_and_user(trip_id, user_id)
        if trip:
            del self.trips[trip.id]


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
    )


@pytest.mark.asyncio
async def test_create_trip_sets_new_trips_to_draft():
    repo = FakeTripRepo()

    trip = await trip_service.create_trip(
        repo,
        7,
        title="Lake Escape",
        destination="Lucerne",
        description="Relaxed weekend",
        itinerary={"days": []},
    )

    assert trip.user_id == 7
    assert trip.status == "draft"
    assert trip.destination == "Lucerne"


@pytest.mark.asyncio
async def test_list_trips_returns_only_user_trips():
    repo = FakeTripRepo(
        trips=[_trip_record(trip_id=1, user_id=1), _trip_record(trip_id=2, user_id=2)]
    )

    trips = await trip_service.list_trips(repo, 1)

    assert [trip.id for trip in trips] == [1]


@pytest.mark.asyncio
async def test_get_trip_returns_matching_trip():
    repo = FakeTripRepo(trips=[_trip_record()])

    trip = await trip_service.get_trip(repo, 1, 1)

    assert trip.title == "Weekend in Zurich"


@pytest.mark.asyncio
async def test_get_trip_raises_when_trip_missing():
    repo = FakeTripRepo()

    with pytest.raises(trip_service.TripNotFound):
        await trip_service.get_trip(repo, 1, 999)


@pytest.mark.asyncio
async def test_delete_trip_removes_matching_trip():
    repo = FakeTripRepo(trips=[_trip_record()])

    await trip_service.delete_trip(repo, 1, 1)

    assert 1 not in repo.trips


@pytest.mark.asyncio
async def test_delete_trip_raises_when_trip_missing():
    repo = FakeTripRepo(trips=[replace(_trip_record(), user_id=2)])

    with pytest.raises(trip_service.TripNotFound):
        await trip_service.delete_trip(repo, 1, 1)
