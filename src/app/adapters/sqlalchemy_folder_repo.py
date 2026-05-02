from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import Folder, Trip
from app.ports.repositories import FolderRecord, NewFolder, TripRecord


def _to_folder_record(folder: Folder) -> FolderRecord:
    return FolderRecord(
        id=folder.id,
        user_id=folder.user_id,
        name=folder.name,
        description=folder.description,
        created_at=folder.created_at,
    )


def _to_trip_record(trip: Trip) -> TripRecord:
    return TripRecord(
        id=trip.id,
        user_id=trip.user_id,
        title=trip.title,
        destination=trip.destination,
        status=trip.status.value,
        description=trip.description,
        itinerary=trip.itinerary,
        created_at=trip.created_at,
        shared_at=trip.shared_at,
        folder_id=trip.folder_id,
    )


class SqlAlchemyFolderRepo:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def create(self, data: NewFolder) -> FolderRecord:
        folder = Folder(
            user_id=data.user_id,
            name=data.name,
            description=data.description,
        )
        self._session.add(folder)
        await self._session.flush()
        await self._session.refresh(folder)
        return _to_folder_record(folder)

    async def list_by_user(self, user_id: int) -> list[FolderRecord]:
        result = await self._session.execute(
            select(Folder)
            .where(Folder.user_id == user_id)
            .order_by(Folder.created_at.desc())
        )
        return [_to_folder_record(folder) for folder in result.scalars().all()]

    async def get_by_id_and_user(
        self, folder_id: int, user_id: int
    ) -> FolderRecord | None:
        result = await self._session.execute(
            select(Folder).where(Folder.id == folder_id, Folder.user_id == user_id)
        )
        folder = result.scalar_one_or_none()
        return _to_folder_record(folder) if folder else None

    async def get_by_name_and_user(
        self, name: str, user_id: int
    ) -> FolderRecord | None:
        result = await self._session.execute(
            select(Folder).where(Folder.name == name, Folder.user_id == user_id)
        )
        folder = result.scalar_one_or_none()
        return _to_folder_record(folder) if folder else None

    async def update(
        self,
        folder_id: int,
        user_id: int,
        *,
        name: str,
        description: str | None,
    ) -> FolderRecord | None:
        result = await self._session.execute(
            select(Folder).where(Folder.id == folder_id, Folder.user_id == user_id)
        )
        folder = result.scalar_one_or_none()
        if not folder:
            return None

        folder.name = name
        folder.description = description
        await self._session.flush()
        await self._session.refresh(folder)
        return _to_folder_record(folder)

    async def list_trips(self, folder_id: int, user_id: int) -> list[TripRecord]:
        result = await self._session.execute(
            select(Trip)
            .where(Trip.folder_id == folder_id, Trip.user_id == user_id)
            .order_by(Trip.created_at.desc())
        )
        return [_to_trip_record(trip) for trip in result.scalars().all()]

    async def delete(self, folder_id: int, user_id: int) -> None:
        folder_result = await self._session.execute(
            select(Folder).where(Folder.id == folder_id, Folder.user_id == user_id)
        )
        folder = folder_result.scalar_one_or_none()
        if not folder:
            return

        trips_result = await self._session.execute(
            select(Trip).where(Trip.folder_id == folder_id, Trip.user_id == user_id)
        )
        for trip in trips_result.scalars().all():
            trip.folder_id = None

        await self._session.flush()
        await self._session.delete(folder)
