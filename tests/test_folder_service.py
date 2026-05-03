from __future__ import annotations

from dataclasses import replace
from datetime import datetime, timezone

import pytest

from app.ports.repositories import FolderRecord, NewFolder, TripRecord
from app.services import folder_service


class FakeTripRepo:
    def __init__(self, trips: list[TripRecord] | None = None) -> None:
        self.trips = {trip.id: trip for trip in trips or []}

    async def set_folder(
        self, trip_id: int, user_id: int, *, folder_id: int | None
    ) -> TripRecord | None:
        trip = self.trips.get(trip_id)
        if not trip or trip.user_id != user_id:
            return None

        updated = replace(trip, folder_id=folder_id)
        self.trips[trip_id] = updated
        return updated


class FakeFolderRepo:
    def __init__(
        self,
        folders: list[FolderRecord] | None = None,
        trip_repo: FakeTripRepo | None = None,
    ) -> None:
        self.folders = {folder.id: folder for folder in folders or []}
        self.next_id = max(self.folders, default=0) + 1
        self.trip_repo = trip_repo

    async def create(self, data: NewFolder) -> FolderRecord:
        folder = FolderRecord(
            id=self.next_id,
            user_id=data.user_id,
            name=data.name,
            description=data.description,
            created_at=datetime.now(timezone.utc),
        )
        self.next_id += 1
        self.folders[folder.id] = folder
        return folder

    async def list_by_user(self, user_id: int) -> list[FolderRecord]:
        return [folder for folder in self.folders.values() if folder.user_id == user_id]

    async def get_by_id_and_user(
        self, folder_id: int, user_id: int
    ) -> FolderRecord | None:
        folder = self.folders.get(folder_id)
        if folder and folder.user_id == user_id:
            return folder
        return None

    async def get_by_name_and_user(
        self, name: str, user_id: int
    ) -> FolderRecord | None:
        for folder in self.folders.values():
            if folder.user_id == user_id and folder.name == name:
                return folder
        return None

    async def update(
        self,
        folder_id: int,
        user_id: int,
        *,
        name: str,
        description: str | None,
    ) -> FolderRecord | None:
        folder = await self.get_by_id_and_user(folder_id, user_id)
        if not folder:
            return None

        updated = replace(folder, name=name, description=description)
        self.folders[folder_id] = updated
        return updated

    async def list_trips(self, folder_id: int, user_id: int) -> list[TripRecord]:
        if not self.trip_repo:
            return []

        return [
            trip
            for trip in self.trip_repo.trips.values()
            if trip.user_id == user_id and trip.folder_id == folder_id
        ]

    async def delete(self, folder_id: int, user_id: int) -> None:
        folder = await self.get_by_id_and_user(folder_id, user_id)
        if not folder:
            return

        if self.trip_repo:
            for trip_id, trip in list(self.trip_repo.trips.items()):
                if trip.user_id == user_id and trip.folder_id == folder_id:
                    self.trip_repo.trips[trip_id] = replace(trip, folder_id=None)

        del self.folders[folder_id]


def _folder_record(*, folder_id: int = 1, user_id: int = 1, name: str = "Saved"):
    return FolderRecord(
        id=folder_id,
        user_id=user_id,
        name=name,
        description="Trips to revisit",
        created_at=datetime.now(timezone.utc),
    )


def _trip_record(*, trip_id: int = 1, user_id: int = 1, folder_id: int | None = None):
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
        folder_id=folder_id,
    )


@pytest.mark.asyncio
async def test_create_folder_rejects_duplicate_name():
    repo = FakeFolderRepo(folders=[_folder_record(name="Favorites")])

    with pytest.raises(folder_service.FolderNameAlreadyExists):
        await folder_service.create_folder(repo, 1, name="Favorites")


@pytest.mark.asyncio
async def test_list_folders_returns_only_current_users_folders():
    repo = FakeFolderRepo(
        folders=[
            _folder_record(folder_id=1, user_id=1),
            _folder_record(folder_id=2, user_id=2),
        ]
    )

    folders = await folder_service.list_folders(repo, 1)

    assert [folder.id for folder in folders] == [1]


@pytest.mark.asyncio
async def test_move_trip_to_folder_updates_trip_folder_id():
    trip_repo = FakeTripRepo(trips=[_trip_record()])
    folder_repo = FakeFolderRepo(folders=[_folder_record()], trip_repo=trip_repo)

    trip = await folder_service.move_trip_to_folder(
        trip_repo,
        folder_repo,
        1,
        1,
        folder_id=1,
    )

    assert trip.folder_id == 1


@pytest.mark.asyncio
async def test_move_trip_to_folder_raises_when_folder_missing():
    trip_repo = FakeTripRepo(trips=[_trip_record()])
    folder_repo = FakeFolderRepo()

    with pytest.raises(folder_service.FolderNotFound):
        await folder_service.move_trip_to_folder(
            trip_repo,
            folder_repo,
            1,
            1,
            folder_id=999,
        )


@pytest.mark.asyncio
async def test_delete_folder_unassigns_existing_trips():
    trip_repo = FakeTripRepo(trips=[_trip_record(folder_id=1)])
    folder_repo = FakeFolderRepo(folders=[_folder_record()], trip_repo=trip_repo)

    await folder_service.delete_folder(folder_repo, 1, 1)

    assert 1 not in folder_repo.folders
    assert trip_repo.trips[1].folder_id is None
