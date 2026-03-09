from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Trip, TripStatus
from app.ports.repositories import NewTrip, TripRecord


def _to_record(trip: Trip) -> TripRecord:
    return TripRecord(
        id=trip.id,
        user_id=trip.user_id,
        title=trip.title,
        destination=trip.destination,
        status=trip.status.value
        if isinstance(trip.status, TripStatus)
        else trip.status,
        description=trip.description,
        itinerary=trip.itinerary,
        created_at=trip.created_at,
    )


class SqlAlchemyTripRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, data: NewTrip) -> TripRecord:
        trip = Trip(
            user_id=data.user_id,
            title=data.title,
            destination=data.destination,
            description=data.description,
            itinerary=data.itinerary,
            status=TripStatus(data.status),
        )
        self._session.add(trip)
        await self._session.flush()
        await self._session.refresh(trip)
        return _to_record(trip)

    async def list_by_user(self, user_id: int) -> list[TripRecord]:
        result = await self._session.execute(
            select(Trip).where(Trip.user_id == user_id).order_by(Trip.created_at.desc())
        )
        return [_to_record(t) for t in result.scalars().all()]

    async def get_by_id_and_user(self, trip_id: int, user_id: int) -> TripRecord | None:
        result = await self._session.execute(
            select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id)
        )
        trip = result.scalar_one_or_none()
        return _to_record(trip) if trip else None

    async def delete(self, trip_id: int, user_id: int) -> None:
        result = await self._session.execute(
            select(Trip).where(Trip.id == trip_id, Trip.user_id == user_id)
        )
        trip = result.scalar_one_or_none()
        if trip:
            await self._session.delete(trip)
