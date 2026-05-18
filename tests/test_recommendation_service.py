from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import pytest

from app.ports.swiss_tourism import (
    AttractionRecord,
    DestinationRecord,
    GeoCoordinates,
    PageMeta,
    PaginatedResult,
    TourRecord,
)
from app.ports.transport import TransportItinerary, TransportLeg, TransportPlace
from app.services import recommendation_service


@dataclass
class FakeSwissClient:
    destinations: list[DestinationRecord]
    attractions_by_destination: dict[str, list[AttractionRecord]]
    tours_by_query: dict[str, list[TourRecord]]

    def __post_init__(self) -> None:
        self.destination_queries: list[str | None] = []

    async def list_destinations(
        self,
        *,
        query: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> PaginatedResult[DestinationRecord]:
        self.destination_queries.append(query)
        if query:
            matches = [
                dest for dest in self.destinations if query.lower() in dest.name.lower()
            ]
        else:
            matches = self.destinations
        return PaginatedResult(data=matches[:page_size], meta=_page_meta(len(matches)))

    async def get_destination(self, destination_id: str) -> DestinationRecord | None:
        for destination in self.destinations:
            if destination.id == destination_id:
                return destination
        return None

    async def list_attractions(
        self,
        *,
        query: str | None = None,
        destination_id: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> PaginatedResult[AttractionRecord]:
        attractions = self.attractions_by_destination.get(destination_id or "", [])
        return PaginatedResult(
            data=attractions[:page_size], meta=_page_meta(len(attractions))
        )

    async def get_attraction(self, attraction_id: str) -> AttractionRecord | None:
        for attractions in self.attractions_by_destination.values():
            for attraction in attractions:
                if attraction.id == attraction_id:
                    return attraction
        return None

    async def list_tours(
        self,
        *,
        query: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> PaginatedResult[TourRecord]:
        tours = self.tours_by_query.get(query or "", [])
        return PaginatedResult(data=tours[:page_size], meta=_page_meta(len(tours)))

    async def get_tour(self, tour_id: str) -> TourRecord | None:
        for tours in self.tours_by_query.values():
            for tour in tours:
                if tour.id == tour_id:
                    return tour
        return None


@dataclass
class FakePublicTransportClient:
    route: TransportItinerary | None

    def __post_init__(self) -> None:
        self.calls: list[tuple[TransportPlace, TransportPlace, date, str, int]] = []

    async def plan_route(
        self,
        *,
        origin: TransportPlace,
        destination: TransportPlace,
        departure_date: date,
        departure_time: str,
        travelers: int = 1,
    ) -> TransportItinerary | None:
        self.calls.append(
            (origin, destination, departure_date, departure_time, travelers)
        )
        return self.route


def _page_meta(total_elements: int) -> PageMeta:
    return PageMeta(
        page_number=1,
        page_size=max(total_elements, 1),
        total_elements=total_elements,
        total_pages=1,
    )


def _destination(
    destination_id: str,
    name: str,
    *,
    category: str = "city",
    description: str,
    geo: tuple[float, float] | None = None,
) -> DestinationRecord:
    return DestinationRecord(
        id=destination_id,
        name=name,
        category=category,
        description=description,
        geo=GeoCoordinates(*geo) if geo else None,
        url=f"https://example.com/{destination_id}",
    )


def _attraction(
    attraction_id: str,
    name: str,
    *,
    category: str,
    description: str,
    geo: tuple[float, float] | None = None,
) -> AttractionRecord:
    return AttractionRecord(
        id=attraction_id,
        name=name,
        category=category,
        description=description,
        geo=GeoCoordinates(*geo) if geo else None,
        url=f"https://example.com/attractions/{attraction_id}",
    )


def _tour(
    tour_id: str, name: str, *, description: str, duration: str = ""
) -> TourRecord:
    return TourRecord(
        id=tour_id,
        name=name,
        description=description,
        duration=duration,
        url=f"https://example.com/tours/{tour_id}",
    )


@pytest.mark.asyncio
async def test_recommend_returns_empty_list_when_no_destinations_found():
    client = FakeSwissClient(
        destinations=[], attractions_by_destination={}, tours_by_query={}
    )

    recommendations = await recommendation_service.recommend(
        client,
        preferences=None,
        destination="Anywhere",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 4),
    )

    assert recommendations == []
    assert client.destination_queries == ["Anywhere", None]


@pytest.mark.asyncio
async def test_recommend_scores_destinations_and_builds_itinerary():
    client = FakeSwissClient(
        destinations=[
            _destination(
                "zermatt",
                "Zermatt",
                description="Mountain adventure with hiking and skiing.",
            ),
            _destination(
                "bern",
                "Bern",
                description="Historic old town, museums, and medieval streets.",
            ),
        ],
        attractions_by_destination={
            "zermatt": [
                _attraction(
                    "matterhorn-trail",
                    "Matterhorn Hiking Trail",
                    category="trail",
                    description="A scenic mountain hiking route.",
                )
            ],
            "bern": [
                _attraction(
                    "bern-museum",
                    "Bern History Museum",
                    category="museum",
                    description="A cultural collection in the historic center.",
                )
            ],
        },
        tours_by_query={
            "Zermatt": [
                _tour(
                    "alpine-loop",
                    "Alpine Loop",
                    description="A high-altitude adventure tour.",
                    duration="4h",
                )
            ],
            "Bern": [],
        },
    )

    recommendations = await recommendation_service.recommend(
        client,
        preferences={
            "travel_styles": ["adventure"],
            "pace": "packed",
            "budget_tier": "budget",
        },
        destination=None,
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 3),
        travelers=2,
    )

    assert len(recommendations) == 2
    assert recommendations[0]["destination"] == "Zermatt"
    assert recommendations[0]["match_score"] >= recommendations[1]["match_score"]
    assert len(recommendations[0]["itinerary"]["days"]) == 2
    assert len(recommendations[0]["itinerary"]["days"][0]["activities"]) == 4
    assert recommendations[0]["itinerary"]["estimated_total"] == 660.0
    assert recommendations[0]["highlights"]


@pytest.mark.asyncio
async def test_recommend_adds_fallback_activity_when_destination_has_no_items():
    client = FakeSwissClient(
        destinations=[
            _destination(
                "lucerne",
                "Lucerne",
                description="Lake views and relaxed scenery.",
            )
        ],
        attractions_by_destination={"lucerne": []},
        tours_by_query={"Lucerne": []},
    )

    recommendations = await recommendation_service.recommend(
        client,
        preferences={"travel_styles": ["relaxation"]},
        destination=None,
        start_date=date(2026, 8, 10),
        end_date=date(2026, 8, 11),
    )

    activities = recommendations[0]["itinerary"]["days"][0]["activities"]
    assert activities[0]["title"] == "Explore Lucerne"
    assert recommendations[0]["highlights"] == ["Explore Lucerne"]


@pytest.mark.asyncio
async def test_recommend_enriches_public_transport_timeline_with_live_route():
    client = FakeSwissClient(
        destinations=[
            _destination(
                "zurich",
                "Zurich",
                description="Museums, lake views, and city culture.",
                geo=(47.3769, 8.5417),
            )
        ],
        attractions_by_destination={
            "zurich": [
                _attraction(
                    "kunsthaus",
                    "Kunsthaus Zurich",
                    category="museum",
                    description="Major art museum.",
                    geo=(47.3701, 8.5480),
                ),
                _attraction(
                    "lake",
                    "Lake Zurich Promenade",
                    category="viewpoint",
                    description="Relaxed lake walk.",
                    geo=(47.3667, 8.5433),
                ),
            ]
        },
        tours_by_query={"Zurich": []},
    )
    transport = FakePublicTransportClient(
        TransportItinerary(
            duration_minutes=18,
            transfers=0,
            legs=[
                TransportLeg(
                    mode="tram",
                    line="4",
                    departure_time="2026-06-01T09:30:00",
                    arrival_time="2026-06-01T09:48:00",
                    duration_minutes=18,
                    origin="Kunsthaus",
                    destination="Bellevue",
                    direction="Bahnhof Tiefenbrunnen",
                )
            ],
        )
    )

    recommendations = await recommendation_service.recommend(
        client,
        preferences={"travel_styles": ["cultural"], "pace": "moderate"},
        destination="Zurich",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 2),
        transport_mode="public_transport",
        public_transport_client=transport,
    )

    timeline = recommendations[0]["itinerary"]["days"][0]["timeline_items"]
    transport_items = [item for item in timeline if item["kind"] == "transport"]
    assert transport.calls
    assert transport.calls[0][0].latitude == 47.3701
    assert transport_items[0]["title"] == "tram 4"
    assert transport_items[0]["duration_text"] == "18 min, 0 transfers"
    assert "Kunsthaus" in transport_items[0]["notes"]
    assert (
        "_latitude" not in recommendations[0]["itinerary"]["days"][0]["activities"][0]
    )


@pytest.mark.asyncio
async def test_recommend_does_not_call_public_transport_for_car_mode():
    client = FakeSwissClient(
        destinations=[_destination("zurich", "Zurich", description="City culture.")],
        attractions_by_destination={
            "zurich": [
                _attraction(
                    "kunsthaus",
                    "Kunsthaus Zurich",
                    category="museum",
                    description="Major art museum.",
                )
            ]
        },
        tours_by_query={"Zurich": []},
    )
    transport = FakePublicTransportClient(route=None)

    await recommendation_service.recommend(
        client,
        preferences={"travel_styles": ["cultural"], "pace": "moderate"},
        destination="Zurich",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 2),
        transport_mode="car",
        public_transport_client=transport,
    )

    assert transport.calls == []
