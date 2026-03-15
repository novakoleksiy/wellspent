from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class GeoCoordinates:
    latitude: float
    longitude: float


@dataclass
class SwissImage:
    url: str
    title: str = ""


@dataclass
class DestinationRecord:
    identifier: str
    name: str
    category: str
    description: str = ""
    geo: GeoCoordinates | None = None
    images: list[SwissImage] = field(default_factory=list)
    url: str = ""


@dataclass
class AttractionRecord:
    id: str
    name: str
    description: str = ""
    category: str = ""
    geo: GeoCoordinates | None = None
    images: list[SwissImage] = field(default_factory=list)
    url: str = ""


@dataclass
class TourRecord:
    id: str
    name: str
    description: str = ""
    distance_km: float | None = None
    duration: str = ""
    geo: GeoCoordinates | None = None
    images: list[SwissImage] = field(default_factory=list)
    url: str = ""


@dataclass
class PageMeta:
    page_number: int
    page_size: int
    total_elements: int
    total_pages: int


@dataclass
class PaginatedResult[T]:
    data: list[T]
    meta: PageMeta


class SwissTourismClient(Protocol):
    async def list_destinations(
        self,
        *,
        query: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> PaginatedResult[DestinationRecord]: ...

    async def get_destination(
        self, destination_id: str
    ) -> DestinationRecord | None: ...

    async def list_attractions(
        self,
        *,
        query: str | None = None,
        destination_id: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> PaginatedResult[AttractionRecord]: ...

    async def get_attraction(self, attraction_id: str) -> AttractionRecord | None: ...

    async def list_tours(
        self,
        *,
        query: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> PaginatedResult[TourRecord]: ...

    async def get_tour(self, tour_id: str) -> TourRecord | None: ...
