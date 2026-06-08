from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
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
    id: str
    name: str
    category: str | None = None
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
class TourProvider:
    name: str
    url: str | None = None
    email: str | None = None
    phone: str | None = None
    locality: str | None = None


@dataclass
class TourRecord:
    id: str
    name: str
    description: str = ""
    distance_km: float | None = None
    duration_minutes: int | None = None
    ascent_m: int | None = None
    descent_m: int | None = None
    route_type: str | None = None
    difficulty: str | None = None
    waypoints: list[str] = field(default_factory=list)
    tourist_types: list[str] = field(default_factory=list)
    provider: TourProvider | None = None
    geo: GeoCoordinates | None = None
    images: list[SwissImage] = field(default_factory=list)
    url: str = ""


@dataclass
class OfferRecord:
    id: str
    name: str
    abstract: str = ""
    description: str = ""
    price_amount: float | None = None
    price_currency: str | None = None
    price_note: str | None = None
    valid_from: str | None = None
    valid_through: str | None = None
    offer_type: str | None = None
    area_id: str | None = None
    area_name: str | None = None
    geo: GeoCoordinates | None = None
    images: list[SwissImage] = field(default_factory=list)
    info_url: str = ""
    booking_url: str | None = None


@dataclass
class PageMeta:
    page_number: int
    page_size: int
    total_elements: int
    total_pages: int


@dataclass
class FacetValueRecord:
    name: str
    count: int
    title: str | None = None


@dataclass
class FacetRecord:
    name: str
    title: str | None = None
    values: list[FacetValueRecord] = field(default_factory=list)


@dataclass
class FacetSnapshotRecord:
    object_type: str
    language: str
    fetched_at: datetime
    facets: list[FacetRecord] = field(default_factory=list)


@dataclass
class PaginatedResult[T]:
    data: list[T]
    meta: PageMeta


class SwissTourismClient(Protocol):
    async def list_destinations(
        self,
        *,
        query: str | None = None,
        language: str | None = None,
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
        facets: list[str] | None = None,
        facet_filter: str | None = None,
        facets_translate: bool | None = None,
        latitude: float | None = None,
        longitude: float | None = None,
        radius_m: int | None = None,
        bbox: tuple[float, float, float, float] | None = None,
        top: bool | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> PaginatedResult[AttractionRecord]: ...

    async def get_attraction(self, attraction_id: str) -> AttractionRecord | None: ...

    async def get_attraction_facets(self) -> FacetSnapshotRecord: ...

    async def list_tours(
        self,
        *,
        query: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> PaginatedResult[TourRecord]: ...

    async def get_tour(self, tour_id: str) -> TourRecord | None: ...

    async def list_offers(
        self,
        *,
        query: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> PaginatedResult[OfferRecord]: ...

    async def get_offer(self, offer_id: str) -> OfferRecord | None: ...
