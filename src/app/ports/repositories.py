from dataclasses import dataclass
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

    async def delete(self, trip_id: int, user_id: int) -> None: ...


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
