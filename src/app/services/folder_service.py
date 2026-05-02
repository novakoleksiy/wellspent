from app.ports.repositories import (
    FolderRecord,
    FolderRepository,
    NewFolder,
    TripRecord,
    TripRepository,
)
from app.services.trip_service import TripNotFound


class FolderNotFound(Exception):
    pass


class FolderNameAlreadyExists(Exception):
    pass


async def create_folder(
    repo: FolderRepository,
    user_id: int,
    *,
    name: str,
    description: str | None = None,
) -> FolderRecord:
    existing = await repo.get_by_name_and_user(name, user_id)
    if existing:
        raise FolderNameAlreadyExists

    return await repo.create(
        NewFolder(user_id=user_id, name=name, description=description)
    )


async def list_folders(repo: FolderRepository, user_id: int) -> list[FolderRecord]:
    return await repo.list_by_user(user_id)


async def get_folder(
    repo: FolderRepository, user_id: int, folder_id: int
) -> FolderRecord:
    folder = await repo.get_by_id_and_user(folder_id, user_id)
    if not folder:
        raise FolderNotFound
    return folder


async def update_folder(
    repo: FolderRepository,
    user_id: int,
    folder_id: int,
    *,
    name: str,
    description: str | None = None,
) -> FolderRecord:
    folder = await repo.get_by_id_and_user(folder_id, user_id)
    if not folder:
        raise FolderNotFound

    existing = await repo.get_by_name_and_user(name, user_id)
    if existing and existing.id != folder_id:
        raise FolderNameAlreadyExists

    updated = await repo.update(
        folder_id,
        user_id,
        name=name,
        description=description,
    )
    if not updated:
        raise FolderNotFound
    return updated


async def list_folder_trips(
    repo: FolderRepository, user_id: int, folder_id: int
) -> list[TripRecord]:
    folder = await repo.get_by_id_and_user(folder_id, user_id)
    if not folder:
        raise FolderNotFound
    return await repo.list_trips(folder_id, user_id)


async def move_trip_to_folder(
    trip_repo: TripRepository,
    folder_repo: FolderRepository,
    user_id: int,
    trip_id: int,
    *,
    folder_id: int | None,
) -> TripRecord:
    if folder_id is not None:
        folder = await folder_repo.get_by_id_and_user(folder_id, user_id)
        if not folder:
            raise FolderNotFound

    trip = await trip_repo.set_folder(trip_id, user_id, folder_id=folder_id)
    if not trip:
        raise TripNotFound
    return trip


async def delete_folder(repo: FolderRepository, user_id: int, folder_id: int) -> None:
    folder = await repo.get_by_id_and_user(folder_id, user_id)
    if not folder:
        raise FolderNotFound
    await repo.delete(folder_id, user_id)
