from __future__ import annotations

from dataclasses import dataclass
from datetime import date

import pytest

from app.ports.swiss_tourism import (
    AttractionRecord,
    DestinationRecord,
    PageMeta,
    PaginatedResult,
    TourRecord,
)
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
) -> DestinationRecord:
    return DestinationRecord(
        id=destination_id,
        name=name,
        category=category,
        description=description,
        url=f"https://example.com/{destination_id}",
    )


def _attraction(
    attraction_id: str, name: str, *, category: str, description: str
) -> AttractionRecord:
    return AttractionRecord(
        id=attraction_id,
        name=name,
        category=category,
        description=description,
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
