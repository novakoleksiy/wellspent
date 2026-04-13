from __future__ import annotations

from app.ports.repositories import (
    CommunityTripRecord,
    NewTrip,
    TripRecord,
    TripRepository,
)


class TripNotFound(Exception):
    pass


async def create_trip(
    repo: TripRepository,
    user_id: int,
    *,
    title: str,
    destination: str,
    description: str | None = None,
    itinerary: dict | None = None,
) -> TripRecord:
    data = NewTrip(
        user_id=user_id,
        title=title,
        destination=destination,
        status="draft",
        description=description,
        itinerary=itinerary,
    )
    return await repo.create(data)


async def list_trips(repo: TripRepository, user_id: int) -> list[TripRecord]:
    return await repo.list_by_user(user_id)


async def get_trip(repo: TripRepository, user_id: int, trip_id: int) -> TripRecord:
    trip = await repo.get_by_id_and_user(trip_id, user_id)
    if not trip:
        raise TripNotFound
    return trip


async def list_shared_trips(
    repo: TripRepository, user_id: int, *, limit: int = 6
) -> list[CommunityTripRecord]:
    return await repo.list_shared(viewer_user_id=user_id, limit=limit)


async def set_trip_shared(
    repo: TripRepository, user_id: int, trip_id: int, *, shared: bool
) -> TripRecord:
    trip = await repo.set_shared(trip_id, user_id, shared=shared)
    if not trip:
        raise TripNotFound
    return trip


async def delete_trip(repo: TripRepository, user_id: int, trip_id: int) -> None:
    trip = await repo.get_by_id_and_user(trip_id, user_id)
    if not trip:
        raise TripNotFound
    await repo.delete(trip_id, user_id)
