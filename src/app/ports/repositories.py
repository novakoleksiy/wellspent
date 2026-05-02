from dataclasses import dataclass
from datetime import datetime
from typing import Protocol


@dataclass
class UserRecord:
    """Domain representation of a user — decoupled from ORM."""

    id: int
    email: str
    hashed_password: str
    full_name: str
    preferences: dict | None
    created_at: object  # datetime, kept generic to avoid coupling


@dataclass
class NewTrip:
    """Data needed to create a trip — no DB-generated fields."""

    user_id: int
    title: str
    destination: str
    status: str
    description: str | None = None
    itinerary: dict | None = None
    folder_id: int | None = None


@dataclass
class TripRecord:
    """Domain representation of a trip — decoupled from ORM."""

    id: int
    user_id: int
    title: str
    destination: str
    status: str
    description: str | None
    itinerary: dict | None
    created_at: object
    shared_at: datetime | None = None
    folder_id: int | None = None


@dataclass
class NewFolder:
    user_id: int
    name: str
    description: str | None = None


@dataclass
class FolderRecord:
    id: int
    user_id: int
    name: str
    description: str | None
    created_at: object


@dataclass
class CommunityTripRecord:
    id: int
    title: str
    destination: str
    description: str | None
    itinerary: dict | None
    created_at: object
    shared_at: datetime
    owner_name: str


class UserRepository(Protocol):
    async def get_by_id(self, user_id: int) -> UserRecord | None: ...

    async def get_by_email(self, email: str) -> UserRecord | None: ...

    async def create(
        self, *, email: str, hashed_password: str, full_name: str
    ) -> UserRecord: ...

    async def update_preferences(
        self, user_id: int, preferences: dict
    ) -> UserRecord: ...


class TripRepository(Protocol):
    async def create(self, data: NewTrip) -> TripRecord: ...

    async def list_by_user(self, user_id: int) -> list[TripRecord]: ...

    async def get_by_id_and_user(
        self, trip_id: int, user_id: int
    ) -> TripRecord | None: ...

    async def list_shared(
        self, *, viewer_user_id: int, limit: int = 6
    ) -> list[CommunityTripRecord]: ...

    async def set_shared(
        self, trip_id: int, user_id: int, *, shared: bool
    ) -> TripRecord | None: ...

    async def set_status(
        self, trip_id: int, user_id: int, *, status: str
    ) -> TripRecord | None: ...

    async def set_folder(
        self, trip_id: int, user_id: int, *, folder_id: int | None
    ) -> TripRecord | None: ...

    async def delete(self, trip_id: int, user_id: int) -> None: ...


class FolderRepository(Protocol):
    async def create(self, data: NewFolder) -> FolderRecord: ...

    async def list_by_user(self, user_id: int) -> list[FolderRecord]: ...

    async def get_by_id_and_user(
        self, folder_id: int, user_id: int
    ) -> FolderRecord | None: ...

    async def get_by_name_and_user(
        self, name: str, user_id: int
    ) -> FolderRecord | None: ...

    async def update(
        self,
        folder_id: int,
        user_id: int,
        *,
        name: str,
        description: str | None,
    ) -> FolderRecord | None: ...

    async def list_trips(self, folder_id: int, user_id: int) -> list[TripRecord]: ...

    async def delete(self, folder_id: int, user_id: int) -> None: ...


@dataclass
class WaitlistEntryRecord:
    """Domain representation of a waitlist entry — decoupled from ORM."""

    id: int
    email: str
    name: str | None
    created_at: object


class WaitlistRepository(Protocol):
    async def get_by_email(self, email: str) -> WaitlistEntryRecord | None: ...

    async def create(
        self, *, email: str, name: str | None = None
    ) -> WaitlistEntryRecord: ...
