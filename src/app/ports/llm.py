from __future__ import annotations

from datetime import date
from typing import Protocol

from app.ports.repositories import TripRecord
from app.ports.swiss_tourism import AttractionRecord, DestinationRecord, TourRecord


class LlmClient(Protocol):
    async def generate_itinerary(
        self,
        *,
        destinations: list[DestinationRecord],
        attractions: list[AttractionRecord],
        tours: list[TourRecord],
        preferences: dict,
        past_trips: list[TripRecord],
        start_date: date,
        end_date: date,
        travelers: int,
    ) -> dict: ...
