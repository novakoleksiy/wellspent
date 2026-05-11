from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Protocol


@dataclass
class TransportPlace:
    name: str
    latitude: float | None = None
    longitude: float | None = None
    stop_point_ref: str | None = None


@dataclass
class TransportLeg:
    mode: str
    line: str | None
    departure_time: str | None
    arrival_time: str | None
    duration_minutes: int | None
    origin: str
    destination: str
    direction: str | None = None
    notes: str = ""


@dataclass
class TransportItinerary:
    duration_minutes: int | None
    transfers: int | None
    legs: list[TransportLeg]
    provider_url: str | None = None
    price: float | None = None


class PublicTransportClient(Protocol):
    async def plan_route(
        self,
        *,
        origin: TransportPlace,
        destination: TransportPlace,
        departure_date: date,
        departure_time: str,
        travelers: int = 1,
    ) -> TransportItinerary | None: ...
