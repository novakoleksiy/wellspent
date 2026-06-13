from __future__ import annotations

import math
import random
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import date

import pytest

from app.ports.itinerary_planner import DayPlan, PlannedStop, PlannerError, PlanRequest
from app.ports.swiss_tourism import (
    AttractionRecord,
    DestinationRecord,
    GeoCoordinates,
    OfferRecord,
    PageMeta,
    PaginatedResult,
    TourRecord,
)
from app.ports.transport import TransportItinerary, TransportLeg, TransportPlace
from app.services import recommendation_service
from app.services.recommendation import candidates as recommendation_candidates
from app.services.recommendation import planning as recommendation_planning


@dataclass
class FakeSwissClient:
    destinations: list[DestinationRecord]
    attractions_by_destination: dict[str, list[AttractionRecord]]
    tours_by_query: dict[str, list[TourRecord]]
    fail_unfiltered_attractions: bool = False
    failing_tour_queries: set[str] = field(default_factory=set)
    offers_by_query: dict[str, list[OfferRecord]] = field(default_factory=dict)
    failing_offer_queries: set[str] = field(default_factory=set)

    def __post_init__(self) -> None:
        self.destination_queries: list[str | None] = []
        self.attraction_filter_calls: list[str | None] = []
        self.attraction_geo_calls: list[
            tuple[float | None, float | None, int | None]
        ] = []
        self.tour_queries: list[str | None] = []
        self.offer_queries: list[str | None] = []

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
    ) -> PaginatedResult[AttractionRecord]:
        self.attraction_filter_calls.append(facet_filter)
        self.attraction_geo_calls.append((latitude, longitude, radius_m))
        if self.fail_unfiltered_attractions:
            raise RuntimeError("upstream rate limited")
        attractions = self.attractions_by_destination.get(destination_id or "", [])
        # Simulate the live API's season facet: a "seasons:<x>" filter returns only the
        # attractions tagged with that season (the broad, unfiltered query returns all).
        if facet_filter and facet_filter.startswith("seasons:"):
            season = facet_filter.split(":", 1)[1].lower()
            attractions = [
                attraction
                for attraction in attractions
                if season in {value.lower() for value in attraction.seasons}
            ]
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
        self.tour_queries.append(query)
        if query in self.failing_tour_queries:
            raise RuntimeError("upstream rate limited")
        tours = self.tours_by_query.get(query or "", [])
        return PaginatedResult(data=tours[:page_size], meta=_page_meta(len(tours)))

    async def get_tour(self, tour_id: str) -> TourRecord | None:
        for tours in self.tours_by_query.values():
            for tour in tours:
                if tour.id == tour_id:
                    return tour
        return None

    async def list_offers(
        self,
        *,
        query: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> PaginatedResult[OfferRecord]:
        self.offer_queries.append(query)
        if query in self.failing_offer_queries:
            raise RuntimeError("upstream rate limited")
        offers = self.offers_by_query.get(query or "", [])
        start = (page - 1) * page_size
        total_pages = max(1, math.ceil(len(offers) / page_size))
        return PaginatedResult(
            data=offers[start : start + page_size],
            meta=PageMeta(
                page_number=page,
                page_size=page_size,
                total_elements=len(offers),
                total_pages=total_pages,
            ),
        )

    async def get_offer(self, offer_id: str) -> OfferRecord | None:
        for offers in self.offers_by_query.values():
            for offer in offers:
                if offer.id == offer_id:
                    return offer
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


@dataclass
class FakeItineraryPlanner:
    """Planner fake returning a fixed plan, a request-derived plan, or an error."""

    plan: DayPlan | None = None
    build: Callable[[PlanRequest], DayPlan] | None = None
    error: Exception | None = None

    def __post_init__(self) -> None:
        self.requests: list[PlanRequest] = []

    async def plan_day(self, request: PlanRequest) -> DayPlan:
        self.requests.append(request)
        if self.error is not None:
            raise self.error
        if self.build is not None:
            return self.build(request)
        assert self.plan is not None
        return self.plan


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
    seasons: list[str] | None = None,
    experiencetype: list[str] | None = None,
) -> AttractionRecord:
    return AttractionRecord(
        id=attraction_id,
        name=name,
        category=category,
        description=description,
        geo=GeoCoordinates(*geo) if geo else None,
        url=f"https://example.com/attractions/{attraction_id}",
        seasons=seasons or [],
        experiencetype=experiencetype or [],
    )


def _tour(
    tour_id: str, name: str, *, description: str, duration_minutes: int | None = None
) -> TourRecord:
    return TourRecord(
        id=tour_id,
        name=name,
        description=description,
        duration_minutes=duration_minutes,
        url=f"https://example.com/tours/{tour_id}",
    )


def _offer(
    offer_id: str,
    name: str,
    *,
    abstract: str = "",
    offer_type: str | None = None,
    price_amount: float | None = None,
    price_currency: str | None = None,
    area_id: str | None = None,
    geo: tuple[float, float] | None = None,
) -> OfferRecord:
    return OfferRecord(
        id=offer_id,
        name=name,
        abstract=abstract,
        offer_type=offer_type,
        price_amount=price_amount,
        price_currency=price_currency,
        area_id=area_id,
        geo=GeoCoordinates(*geo) if geo else None,
        info_url=f"https://example.com/offers/{offer_id}",
    )


@pytest.mark.asyncio
async def test_recommend_returns_empty_list_when_no_destinations_found():
    client = FakeSwissClient(
        destinations=[], attractions_by_destination={}, tours_by_query={}
    )

    recommendations = await recommendation_service.recommend(
        client,
        destination="Anywhere",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 4),
    )

    assert recommendations == []
    assert client.destination_queries == ["Anywhere"]


@pytest.mark.asyncio
async def test_recommend_prioritizes_typed_destination_over_style_match():
    client = FakeSwissClient(
        destinations=[
            _destination(
                "bern",
                "Bern",
                description="Historic old town and museums.",
            ),
            _destination(
                "bernese-oberland",
                "Bernese Oberland",
                description="Mountain adventure with hiking and skiing.",
            ),
        ],
        attractions_by_destination={
            "bern": [
                _attraction(
                    "bern-museum",
                    "Bern History Museum",
                    category="museum",
                    description="A cultural collection in the historic center.",
                )
            ],
            "bernese-oberland": [
                _attraction(
                    "alpine-trail",
                    "Alpine Trail",
                    category="trail",
                    description="Mountain hiking route.",
                )
            ],
        },
        tours_by_query={"Bern": [], "Bernese Oberland": []},
    )

    recommendations = await recommendation_service.recommend(
        client,
        destination="Bern",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 2),
        mood="nature_outdoors",
        trip_length="half_day",
    )

    assert len(recommendations) == 1
    assert recommendations[0]["destination"] == "Bern"
    assert recommendations[0]["itinerary"]["days"][0]["activities"][0]["title"] == (
        "Bern History Museum"
    )


@pytest.mark.asyncio
async def test_recommend_scores_destinations_and_builds_itinerary(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(
        recommendation_service.random, "choice", lambda choices: "Zermatt"
    )
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
                    duration_minutes=240,
                )
            ],
            "Bern": [],
        },
    )

    recommendations = await recommendation_service.recommend(
        client,
        destination=None,
        start_date=date(2026, 7, 1),
        end_date=date(2026, 7, 3),
        travelers=2,
        mood="nature_outdoors",
        trip_length="full_day",
        budget_tier="budget",
    )

    assert len(recommendations) == 1
    assert recommendations[0]["destination"] == "Zermatt"
    assert client.destination_queries == ["Zermatt"]
    assert client.tour_queries == []
    assert len(recommendations[0]["itinerary"]["days"]) == 1
    assert len(recommendations[0]["itinerary"]["days"][0]["activities"]) == 4
    titles = {
        activity["title"]
        for day in recommendations[0]["itinerary"]["days"]
        for activity in day["activities"]
    }
    assert "Alpine Loop (4h)" not in titles
    # Itinerary items no longer carry any per-item cost field.
    items = [
        item
        for day in recommendations[0]["itinerary"]["days"]
        for item in (*day["activities"], *day["timeline_items"])
    ]
    assert all("cost" not in item for item in items)
    # Estimated total scales the "budget" + "full_day" baseline by group size with
    # shared-cost dampening. Derive the expected band from the live range table and
    # the scaling formula so this stays correct if the baseline ranges are retuned.
    travelers = 2
    low, high = recommendation_planning._ESTIMATED_TOTAL_RANGES["budget"]["full_day"]
    multiplier = recommendation_planning._VARIABLE_COST_SHARE * travelers + (
        1 - recommendation_planning._VARIABLE_COST_SHARE
    ) * (1 + recommendation_planning._GROUP_OVERHEAD_PREMIUM * (travelers - 1))
    estimated_total = recommendations[0]["itinerary"]["estimated_total"]
    assert low * multiplier - 5 <= estimated_total <= high * multiplier + 5
    assert estimated_total % 5 == 0
    assert recommendations[0]["highlights"]


@pytest.mark.asyncio
async def test_recommend_boosts_attractions_with_matching_experiencetype():
    # Each attraction carries its own experiencetype classification, so the nature item
    # is boosted into the high band for a nature_outdoors trip without any extra query.
    client = FakeSwissClient(
        destinations=[
            _destination(
                "zurich",
                "Zurich",
                description="A city with lake views and museums.",
            )
        ],
        attractions_by_destination={
            "zurich": [
                _attraction(
                    "lake-promenade",
                    "Lake Zurich Promenade",
                    category="viewpoint",
                    description="Relaxed nature and lake scenery.",
                    experiencetype=["Nature"],
                ),
                _attraction(
                    "kunsthaus",
                    "Kunsthaus Zurich",
                    category="museum",
                    description="Major art museum.",
                    experiencetype=["Museum"],
                ),
            ]
        },
        tours_by_query={"Zurich": []},
    )

    recommendations = await recommendation_service.recommend(
        client,
        destination="Zurich",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 2),
        mood="nature_outdoors",
        trip_length="half_day",
    )

    activities = recommendations[0]["itinerary"]["days"][0]["activities"]
    # Only the broad, unfiltered query is issued — no facet-filtered signal queries.
    assert client.attraction_filter_calls == [None, "seasons:summer"]
    assert activities[0]["title"] == "Lake Zurich Promenade"
    assert recommendations[0]["highlights"][0] == "Lake Zurich Promenade"
    assert "Kunsthaus Zurich" in recommendations[0]["highlights"]


@pytest.mark.asyncio
async def test_recommend_uses_broad_pool_when_classification_is_sparse():
    # Only one item carries a classification tag; the rest are untagged (neutral). The
    # broad query is the pool, so all of them are still available to fill the day.
    client = FakeSwissClient(
        destinations=[
            _destination("zurich", "Zurich", description="City with local culture.")
        ],
        attractions_by_destination={
            "zurich": [
                _attraction(
                    "lake-promenade",
                    "Lake Zurich Promenade",
                    category="viewpoint",
                    description="Relaxed nature and lake scenery.",
                    experiencetype=["Nature"],
                ),
                _attraction(
                    "kunsthaus",
                    "Kunsthaus Zurich",
                    category="museum",
                    description="Major art museum.",
                ),
                _attraction(
                    "old-town",
                    "Zurich Old Town Walk",
                    category="sightseeing",
                    description="Historic lanes and architecture.",
                ),
                _attraction(
                    "market",
                    "Local Market Hall",
                    category="market",
                    description="Food stalls and local makers.",
                ),
            ]
        },
        tours_by_query={"Zurich": []},
    )

    recommendations = await recommendation_service.recommend(
        client,
        destination="Zurich",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 2),
        mood="nature_outdoors",
        trip_length="full_day",
    )

    activities = recommendations[0]["itinerary"]["days"][0]["activities"]
    assert client.attraction_filter_calls == [None, "seasons:summer"]
    assert all(activity["category"] != "leisure" for activity in activities)
    assert {activity["title"] for activity in activities} == {
        "Lake Zurich Promenade",
        "Kunsthaus Zurich",
        "Zurich Old Town Walk",
        "Local Market Hall",
    }


@pytest.mark.asyncio
async def test_recommend_scopes_broad_pool_to_destination_radius():
    # The broad query can return items beyond the destination radius; those are scoped
    # out before scoring so a far-away trail never lands in a city itinerary.
    zurich_lake = _attraction(
        "zurich-lake",
        "Lake Zurich Promenade",
        category="viewpoint",
        description="Relaxed lake scenery.",
        geo=(47.3667, 8.5433),
    )
    bern_garden = _attraction(
        "bern-garden",
        "Rose Garden Bern",
        category="park",
        description="Garden views over the old town.",
        geo=(46.9480, 7.4590),
    )
    farinet_trail = _attraction(
        "farinet-trail",
        "Farinet's Trail",
        category="attraction",
        description="A trail in Valais.",
        geo=(46.1719, 7.1908),
    )
    client = FakeSwissClient(
        destinations=[
            _destination(
                "zurich",
                "Zurich",
                description="Lake city.",
                geo=(47.3769, 8.5417),
            ),
            _destination(
                "bern",
                "Bern",
                description="Historic city.",
                geo=(46.9481, 7.4474),
            ),
        ],
        attractions_by_destination={
            "zurich": [zurich_lake, farinet_trail],
            "bern": [bern_garden, farinet_trail],
        },
        tours_by_query={"Zurich": [], "Bern": []},
    )

    zurich_recommendations = await recommendation_service.recommend(
        client,
        destination="Zurich",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 2),
        mood="nature_outdoors",
        trip_length="half_day",
    )
    bern_recommendations = await recommendation_service.recommend(
        client,
        destination="Bern",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 2),
        mood="nature_outdoors",
        trip_length="half_day",
    )

    zurich_activities = zurich_recommendations[0]["itinerary"]["days"][0]["activities"]
    bern_activities = bern_recommendations[0]["itinerary"]["days"][0]["activities"]
    assert zurich_activities[0]["title"] == "Lake Zurich Promenade"
    assert bern_activities[0]["title"] == "Rose Garden Bern"
    assert "Farinet's Trail" not in {
        activity["title"] for activity in [*zurich_activities, *bern_activities]
    }
    assert client.attraction_geo_calls[0] == (
        47.3769,
        8.5417,
        recommendation_service._DESTINATION_ATTRACTION_RADIUS_M,
    )


@pytest.mark.asyncio
async def test_recommend_prefers_nearby_attractions_over_farther_text_match():
    client = FakeSwissClient(
        destinations=[
            _destination(
                "zurich",
                "Zurich",
                description="A city with museums and galleries.",
                geo=(47.3769, 8.5417),
            )
        ],
        attractions_by_destination={
            "zurich": [
                _attraction(
                    "winterthur-museum",
                    "Winterthur Castle History Museum",
                    category="museum",
                    description="Cultural art, architecture, and heritage gallery.",
                    geo=(47.4988, 8.7237),
                ),
                _attraction(
                    "neighborhood-gallery",
                    "Neighborhood Gallery",
                    category="gallery",
                    description="Small local art space near the old town.",
                    geo=(47.3760, 8.5450),
                ),
            ]
        },
        tours_by_query={"Zurich": []},
    )

    recommendations = await recommendation_service.recommend(
        client,
        destination="Zurich",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 2),
        mood="culture_history",
        trip_length="half_day",
    )

    activities = recommendations[0]["itinerary"]["days"][0]["activities"]
    assert activities[0]["title"] == "Neighborhood Gallery"


@pytest.mark.asyncio
async def test_recommend_uses_fallback_activity_when_swiss_activity_calls_fail():
    client = FakeSwissClient(
        destinations=[
            _destination(
                "zurich",
                "Zurich",
                description="A city with lake views.",
            )
        ],
        attractions_by_destination={"zurich": []},
        tours_by_query={"Zurich": []},
        fail_unfiltered_attractions=True,
        failing_tour_queries={"Zurich"},
    )

    recommendations = await recommendation_service.recommend(
        client,
        destination="Zurich",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 2),
        mood="nature_outdoors",
        trip_length="half_day",
    )

    activities = recommendations[0]["itinerary"]["days"][0]["activities"]
    # The broad attractions query fails, so only that single call is recorded.
    assert client.attraction_filter_calls == [None, "seasons:summer"]
    assert activities[0]["title"] == "Explore Zurich"


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
        destination=None,
        start_date=date(2026, 8, 10),
        end_date=date(2026, 8, 11),
        mood="slow_relaxing",
        trip_length="half_day",
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
            price=120.0,
            legs=[
                TransportLeg(
                    mode="tram",
                    line="4",
                    departure_time="2026-06-01T11:35:00Z",
                    arrival_time="2026-06-01T11:53:00Z",
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
        destination="Zurich",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 2),
        mood="culture_history",
        trip_length="half_day",
        transport_mode="public_transport",
        public_transport_client=transport,
    )

    timeline = recommendations[0]["itinerary"]["days"][0]["timeline_items"]
    transport_items = [item for item in timeline if item["kind"] == "transport"]
    assert transport.calls
    assert transport.calls[0][0].latitude == 47.3701
    assert transport.calls[0][3] == "11:30"
    assert transport_items[0]["title"] == "tram 4"
    assert transport_items[0]["time"] == "11:30"
    assert transport_items[0]["duration_text"] == "18 min, 0 transfers"
    assert "cost" not in transport_items[0]
    assert transport_items[0]["transport_legs"] == [
        {
            "mode": "tram",
            "line": "4",
            "departure_time": "2026-06-01T11:35:00Z",
            "arrival_time": "2026-06-01T11:53:00Z",
            "duration_minutes": 18,
            "origin": "Kunsthaus",
            "destination": "Bellevue",
            "direction": "Bahnhof Tiefenbrunnen",
            "notes": "",
        }
    ]
    assert "Kunsthaus" in transport_items[0]["notes"]
    assert "Depart 11:35" in transport_items[0]["notes"]
    assert "arrive 11:53" in transport_items[0]["notes"]
    assert "2026-06-01" not in transport_items[0]["notes"]
    assert (
        "_latitude" not in recommendations[0]["itinerary"]["days"][0]["activities"][0]
    )


def test_transport_leg_details_keeps_only_public_legs_and_edge_walks():
    route = TransportItinerary(
        duration_minutes=42,
        transfers=2,
        legs=[
            TransportLeg("walk", None, None, None, 5, "Attraction", "Stop A"),
            TransportLeg("bus", "2", "09:30", "09:40", 10, "Stop A", "Stop B"),
            TransportLeg("walk", None, None, None, 3, "Stop B", "Stop C"),
            TransportLeg("train", "S10", "09:45", "10:05", 20, "Stop C", "Stop D"),
            TransportLeg("walk", None, None, None, 4, "Stop D", "Next attraction"),
        ],
    )

    details = recommendation_service._transport_leg_details(route)

    assert [leg["mode"] for leg in details] == ["walk", "bus", "train", "walk"]
    assert {leg["origin"] for leg in details} == {
        "Attraction",
        "Stop A",
        "Stop C",
        "Stop D",
    }
    assert "Stop B" not in [leg["origin"] for leg in details]


def test_transport_leg_details_caps_long_public_routes_to_schema_limit():
    route = TransportItinerary(
        duration_minutes=120,
        transfers=24,
        legs=[
            TransportLeg("walk", None, None, None, 5, "Attraction", "Stop 0"),
            *[
                TransportLeg(
                    "bus",
                    str(index),
                    None,
                    None,
                    3,
                    f"Stop {index}",
                    f"Stop {index + 1}",
                )
                for index in range(25)
            ],
            TransportLeg("walk", None, None, None, 5, "Stop 25", "Next attraction"),
        ],
    )

    details = recommendation_service._transport_leg_details(route)

    assert len(details) == 20
    assert details[0]["mode"] == "walk"
    assert details[-1]["mode"] == "walk"
    assert sum(1 for leg in details if leg["mode"] == "walk") == 2


def test_build_day_timeline_estimates_car_duration_from_activity_coordinates():
    timeline = recommendation_service._build_day_timeline(
        1,
        [
            {
                "id": "activity-1-0",
                "time": "09:00",
                "title": "First stop",
                "category": "museum",
                "_latitude": 0.0,
                "_longitude": 0.0,
            },
            {
                "id": "activity-1-1",
                "time": "11:00",
                "title": "Second stop",
                "category": "viewpoint",
                "_latitude": 0.0,
                "_longitude": 0.2,
            },
        ],
        "car",
        travelers=2,
    )

    transport_item = next(item for item in timeline if item["kind"] == "transport")
    assert transport_item["time"] == "10:15"
    assert transport_item["duration_text"] == "Approx. 50 min by car"
    assert transport_item["notes"] == "Estimated from about 28.9 km between stops."


def test_build_day_timeline_uses_car_placeholder_when_coordinates_are_missing():
    timeline = recommendation_service._build_day_timeline(
        1,
        [
            {
                "id": "activity-1-0",
                "time": "09:00",
                "title": "First stop",
                "category": "museum",
            },
            {
                "id": "activity-1-1",
                "time": "11:00",
                "title": "Second stop",
                "category": "viewpoint",
                "_latitude": 47.0,
                "_longitude": 8.0,
            },
        ],
        "car",
        travelers=2,
    )

    transport_item = next(item for item in timeline if item["kind"] == "transport")
    assert transport_item["time"] == "10:15"
    assert transport_item["duration_text"] == "Approx. 25 min by car"
    assert (
        transport_item["notes"]
        == "Estimated car route unavailable without stop coordinates."
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
        destination="Zurich",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 2),
        mood="culture_history",
        trip_length="half_day",
        transport_mode="car",
        public_transport_client=transport,
    )

    assert transport.calls == []


@pytest.mark.asyncio
async def test_recommend_blends_attractions_across_experience_types():
    # Two items match different styles via their own experiencetype tags, so the plan
    # mixes experience types from the single broad pool — no per-facet queries.
    client = FakeSwissClient(
        destinations=[
            _destination("zurich", "Zurich", description="Lake views and museums.")
        ],
        attractions_by_destination={
            "zurich": [
                _attraction(
                    "lake-promenade",
                    "Lake Zurich Promenade",
                    category="viewpoint",
                    description="Relaxed nature and lake scenery.",
                    experiencetype=["Nature"],
                ),
                _attraction(
                    "kunsthaus",
                    "Kunsthaus Zurich",
                    category="museum",
                    description="Major art museum and cultural collection.",
                    experiencetype=["Culture"],
                ),
            ]
        },
        tours_by_query={"Zurich": []},
    )

    recommendations = await recommendation_service.recommend(
        client,
        destination="Zurich",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 2),
        mood="culture_history",
        group_type="friends",
        trip_length="half_day",
    )

    assert client.attraction_filter_calls == [None, "seasons:summer"]
    titles = {
        activity["title"]
        for day in recommendations[0]["itinerary"]["days"]
        for activity in day["activities"]
    }
    assert {"Lake Zurich Promenade", "Kunsthaus Zurich"} <= titles


@pytest.mark.asyncio
async def test_recommend_does_not_repeat_attractions_across_slots():
    client = FakeSwissClient(
        destinations=[
            _destination("zurich", "Zurich", description="City with culture.")
        ],
        attractions_by_destination={
            "zurich": [
                _attraction(
                    "kunsthaus",
                    "Kunsthaus Zurich",
                    category="museum",
                    description="Major art museum.",
                ),
                _attraction(
                    "lake",
                    "Lake Zurich Promenade",
                    category="viewpoint",
                    description="Relaxed lake walk.",
                ),
            ]
        },
        tours_by_query={"Zurich": []},
    )

    recommendations = await recommendation_service.recommend(
        client,
        destination="Zurich",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 3),
        mood="culture_history",
        trip_length="full_day",
    )

    real_titles = [
        activity["title"]
        for day in recommendations[0]["itinerary"]["days"]
        for activity in day["activities"]
        if activity["category"] != "leisure"
    ]
    # The two unique attractions never repeat; remaining slots become varied free time.
    assert sorted(real_titles) == ["Kunsthaus Zurich", "Lake Zurich Promenade"]
    leisure_titles = [
        activity["title"]
        for day in recommendations[0]["itinerary"]["days"]
        for activity in day["activities"]
        if activity["category"] == "leisure"
    ]
    assert leisure_titles
    assert any(title != "Free exploration" for title in leisure_titles)


@pytest.mark.asyncio
async def test_recommend_surfaces_attraction_description_and_day_theme():
    client = FakeSwissClient(
        destinations=[
            _destination("zurich", "Zurich", description="City with culture.")
        ],
        attractions_by_destination={
            "zurich": [
                _attraction(
                    "kunsthaus",
                    "Kunsthaus Zurich",
                    category="museum",
                    description="A major art museum with an outstanding collection.",
                )
            ]
        },
        tours_by_query={"Zurich": []},
    )

    recommendations = await recommendation_service.recommend(
        client,
        destination="Zurich",
        start_date=date(2026, 6, 1),
        end_date=date(2026, 6, 2),
        mood="culture_history",
        trip_length="half_day",
    )

    first_day = recommendations[0]["itinerary"]["days"][0]
    assert first_day["activities"][0]["description"] == (
        "A major art museum with an outstanding collection."
    )
    assert first_day["theme"] == "Museum"


def test_season_for_date_maps_months_to_meteorological_seasons():
    assert recommendation_service._season_for_date(date(2026, 6, 3)) == "summer"
    assert recommendation_service._season_for_date(date(2026, 4, 15)) == "spring"
    assert recommendation_service._season_for_date(date(2026, 10, 1)) == "autumn"
    assert recommendation_service._season_for_date(date(2026, 1, 20)) == "winter"


@pytest.mark.asyncio
async def test_recommend_boosts_in_season_attraction():
    # A summer-tagged item is boosted in-season above an untagged neutral one.
    client = FakeSwissClient(
        destinations=[
            _destination("zurich", "Zurich", description="Lake views and nature.")
        ],
        attractions_by_destination={
            "zurich": [
                _attraction(
                    "lake-promenade",
                    "Lake Zurich Promenade",
                    category="viewpoint",
                    description="Relaxed lake scenery.",
                    seasons=["Summer"],
                    experiencetype=["Nature"],
                ),
                _attraction(
                    "indoor-hall",
                    "Indoor Exhibition Hall",
                    category="viewpoint",
                    description="Relaxed lake scenery.",
                    experiencetype=["Nature"],
                ),
            ]
        },
        tours_by_query={"Zurich": []},
    )

    recommendations = await recommendation_service.recommend(
        client,
        destination="Zurich",
        start_date=date(2026, 6, 3),
        end_date=date(2026, 6, 4),
        mood="nature_outdoors",
        trip_length="half_day",
    )

    assert client.attraction_filter_calls == [None, "seasons:summer"]
    activities = recommendations[0]["itinerary"]["days"][0]["activities"]
    # Identical text/facet match; the summer tag is the only differentiator in June.
    assert activities[0]["title"] == "Lake Zurich Promenade"


@pytest.mark.asyncio
async def test_recommend_surfaces_season_only_tagged_attraction():
    # An item with only a season tag (no experiencetype) still comes from the broad
    # pool and lands in the plan — local scoring never needs a season query.
    client = FakeSwissClient(
        destinations=[
            _destination("zurich", "Zurich", description="Lake views and nature.")
        ],
        attractions_by_destination={
            "zurich": [
                _attraction(
                    "lake-promenade",
                    "Lake Zurich Promenade",
                    category="viewpoint",
                    description="Relaxed summer lake scenery.",
                    seasons=["Summer"],
                )
            ]
        },
        tours_by_query={"Zurich": []},
    )

    recommendations = await recommendation_service.recommend(
        client,
        destination="Zurich",
        start_date=date(2026, 6, 3),
        end_date=date(2026, 6, 4),
        mood="slow_relaxing",
        trip_length="half_day",
    )

    assert client.attraction_filter_calls == [None, "seasons:summer"]
    titles = {
        activity["title"]
        for day in recommendations[0]["itinerary"]["days"]
        for activity in day["activities"]
    }
    assert "Lake Zurich Promenade" in titles


@pytest.mark.asyncio
async def test_recommend_demotes_off_season_attraction_from_local_tags():
    # The hard case: a winter ski run that ALSO matches the style (experiencetype) and
    # is right next to the resort. From its own seasons tag alone it must still be
    # demoted below an in-season lakeside walk — proving the off-season cut clears the
    # facet score band and survives the proximity blend, with no facet queries needed.
    ski_run = _attraction(
        "ski-run",
        "Alpine Ski Run",
        category="trail",
        description="A thrilling ski and snow mountain slope for skiing in winter.",
        geo=(46.501, 9.841),
        seasons=["Winter"],
        experiencetype=["Mountains"],
    )
    lakeside = _attraction(
        "lakeside",
        "Lakeside Promenade",
        category="viewpoint",
        description="A relaxed lake and garden scenic walk.",
        geo=(46.490, 9.832),
        seasons=["Summer"],
    )
    # Tagged both summer and winter: a genuine year-round attraction that must NOT be
    # demoted despite carrying a winter tag, because it also carries the trip's season.
    year_round = _attraction(
        "spa",
        "Engadin Thermal Spa",
        category="spa",
        description="A relaxing wellness spa open all year round.",
        geo=(46.495, 9.838),
        seasons=["Summer", "Winter"],
    )
    client = FakeSwissClient(
        destinations=[
            _destination(
                "stmoritz",
                "St. Moritz",
                description="Alpine resort town.",
                geo=(46.497, 9.838),
            )
        ],
        attractions_by_destination={"stmoritz": [ski_run, lakeside, year_round]},
        tours_by_query={"St. Moritz": []},
    )

    recommendations = await recommendation_service.recommend(
        client,
        destination="St. Moritz",
        start_date=date(2026, 6, 13),
        end_date=date(2026, 6, 14),
        mood="nature_outdoors",
        trip_length="full_day",
    )

    assert client.attraction_filter_calls == [None, "seasons:summer"]
    activities = recommendations[0]["itinerary"]["days"][0]["activities"]
    real_titles = [a["title"] for a in activities if a["category"] != "leisure"]
    # In-season lakeside and the year-round spa both outrank the off-season ski run,
    # even though the ski run matched the style and sits closest to the resort.
    assert "Lakeside Promenade" in real_titles
    assert real_titles.index("Alpine Ski Run") == max(
        real_titles.index("Alpine Ski Run"),
        real_titles.index("Lakeside Promenade"),
        real_titles.index("Engadin Thermal Spa"),
    )


def test_season_signals_flag_trip_and_opposite_seasons():
    # Summer trip: a winter-tagged item is off-season, a summer item is in-season.
    assert recommendation_service._season_signals(["Winter"], date(2026, 7, 1)) == (
        False,
        True,
    )
    assert recommendation_service._season_signals(["Summer"], date(2026, 7, 1)) == (
        True,
        False,
    )
    # A year-round item carries both; an untagged item is neutral on both.
    assert recommendation_service._season_signals(
        ["Summer", "Winter"], date(2026, 7, 1)
    ) == (True, True)
    assert recommendation_service._season_signals([], date(2026, 7, 1)) == (
        False,
        False,
    )
    # Spring and autumn oppose each other symmetrically.
    assert recommendation_service._season_signals(["Autumn"], date(2026, 4, 1)) == (
        False,
        True,
    )
    assert recommendation_service._season_signals(["Spring"], date(2026, 10, 1)) == (
        False,
        True,
    )


def test_quiz_blended_score_boosts_in_season_only():
    from app.services.recommendation.scoring import AttractionMatchSignals

    neutral = recommendation_service._quiz_blended_score(0.5, AttractionMatchSignals())
    in_season = recommendation_service._quiz_blended_score(
        0.5, AttractionMatchSignals(season_match=True)
    )
    # The in-season boost is additive; the off-season cut is NOT applied here (it runs
    # after the proximity blend), so a bare season_mismatch leaves the score untouched.
    off_season = recommendation_service._quiz_blended_score(
        0.5, AttractionMatchSignals(season_mismatch=True)
    )
    assert in_season > neutral
    assert off_season == neutral


def test_demote_off_season_halves_only_unmatched_off_season():
    from app.services.recommendation.scoring import AttractionMatchSignals

    # Off-season content is halved.
    assert (
        recommendation_service._demote_off_season(
            0.9, AttractionMatchSignals(season_mismatch=True)
        )
        == 0.45
    )
    # A current-season tag overrides the demotion (year-round attractions).
    assert (
        recommendation_service._demote_off_season(
            0.9, AttractionMatchSignals(season_match=True, season_mismatch=True)
        )
        == 0.9
    )
    # Neutral and in-season-only scores are untouched.
    assert recommendation_service._demote_off_season(0.9, AttractionMatchSignals()) == (
        0.9
    )
    assert (
        recommendation_service._demote_off_season(
            0.9, AttractionMatchSignals(season_match=True)
        )
        == 0.9
    )


def test_facet_blended_score_orders_by_rank_and_preserves_text_tiebreak():
    # No facet match returns the raw text score untouched.
    assert recommendation_service._facet_blended_score(0.5, None) == 0.5

    rank0 = recommendation_service._facet_blended_score(0.5, 0)
    rank1 = recommendation_service._facet_blended_score(0.5, 1)
    rank2 = recommendation_service._facet_blended_score(0.5, 2)
    # Higher-priority facets score higher, and none collapse onto a single value.
    assert rank0 > rank1 > rank2
    # Facet matches sit in a high band above generic keyword matches.
    assert rank2 >= 0.8
    # Text score breaks ties within a rank band.
    assert recommendation_service._facet_blended_score(
        0.9, 0
    ) > recommendation_service._facet_blended_score(0.4, 0)


@pytest.mark.asyncio
async def test_recommend_mixes_offers_with_attractions():
    travelers = 3
    offer = _offer(
        "lucerne-boat",
        "Lake Lucerne boat cruise",
        abstract="Scenic paddle-steamer cruise across the lake.",
        offer_type="Day trip",
        price_amount=40.0,
        price_currency="CHF",
        area_id="lucerne",
        geo=(47.05, 8.31),
    )
    client = FakeSwissClient(
        destinations=[
            _destination(
                "lucerne",
                "Lucerne",
                description="Lakeside town with a historic old town.",
                geo=(47.05, 8.31),
            )
        ],
        attractions_by_destination={
            "lucerne": [
                _attraction(
                    "chapel-bridge",
                    "Chapel Bridge",
                    category="museum",
                    description="Historic covered bridge in the old town.",
                    geo=(47.0517, 8.3076),
                ),
                _attraction(
                    "lion-monument",
                    "Lion Monument",
                    category="museum",
                    description="Carved cultural heritage monument.",
                    geo=(47.0585, 8.3115),
                ),
            ]
        },
        tours_by_query={"Lucerne": []},
        offers_by_query={"Lucerne": [offer]},
    )

    recommendations = await recommendation_service.recommend(
        client,
        destination="Lucerne",
        start_date=date(2026, 6, 3),
        end_date=date(2026, 6, 4),
        travelers=travelers,
        mood="culture_history",
        trip_length="half_day",
    )

    assert client.offer_queries == ["Lucerne"]
    activities = recommendations[0]["itinerary"]["days"][0]["activities"]
    offer_activities = [a for a in activities if a["category"] == "offer"]
    # The offer is interleaved into the plan alongside the attractions.
    assert offer_activities, "expected at least one offer activity in the itinerary"
    assert offer_activities[0]["title"] == "Lake Lucerne boat cruise"
    # Offers carry no per-item cost; pricing is not surfaced on the itinerary.
    assert "cost" not in offer_activities[0]
    # Attractions still appear, so the plan is a genuine mix.
    assert any(a["category"] != "offer" for a in activities)


@pytest.mark.asyncio
async def test_collect_offers_paginates_beyond_first_page():
    dest = _destination(
        "lucerne",
        "Lucerne",
        description="Lakeside town.",
        geo=(47.05, 8.31),
    )
    offers = [
        _offer(f"offer-{index}", f"Lucerne experience {index}", area_id="lucerne")
        for index in range(35)
    ]
    client = FakeSwissClient(
        destinations=[dest],
        attractions_by_destination={},
        tours_by_query={},
        offers_by_query={"Lucerne": offers},
    )

    items = await recommendation_candidates._collect_offer_items(client, dest, [])

    # 35 offers at page size 30 span two pages; both are fetched.
    assert client.offer_queries == ["Lucerne", "Lucerne"]
    assert len(items) == 35


@pytest.mark.asyncio
async def test_collect_offers_respects_page_budget():
    dest = _destination("lucerne", "Lucerne", description="Lakeside town.")
    offers = [
        _offer(f"offer-{index}", f"Lucerne experience {index}", area_id="lucerne")
        for index in range(200)
    ]
    client = FakeSwissClient(
        destinations=[dest],
        attractions_by_destination={},
        tours_by_query={},
        offers_by_query={"Lucerne": offers},
    )

    items = await recommendation_candidates._collect_offer_items(client, dest, [])

    # 200 offers span 7 pages, but fetching stops at the page budget.
    budget = recommendation_candidates._MAX_OFFER_FETCH_PAGES
    assert client.offer_queries == ["Lucerne"] * budget
    assert len(items) == budget * recommendation_candidates._OFFER_FETCH_PAGE_SIZE


@pytest.mark.asyncio
async def test_candidate_pool_ids_are_stable_and_deduped_by_name():
    dest = _destination(
        "lucerne",
        "Lucerne",
        description="Lakeside town.",
        geo=(47.05, 8.31),
    )
    client = FakeSwissClient(
        destinations=[dest],
        attractions_by_destination={
            "lucerne": [
                _attraction(
                    "chapel-bridge",
                    "Chapel Bridge",
                    category="museum",
                    description="Historic covered bridge.",
                    geo=(47.0517, 8.3076),
                ),
            ]
        },
        tours_by_query={},
        offers_by_query={
            "Lucerne": [
                # Mirrors the attraction by name, so it must be deduped away.
                _offer("bridge-tour", "Chapel  Bridge", area_id="lucerne"),
                _offer("boat-cruise", "Lake cruise", area_id="lucerne"),
            ]
        },
    )

    items = await recommendation_candidates._collect_destination_items(
        client, dest, [], date(2026, 6, 3)
    )

    ids = [item.id for item in items]
    assert "chapel-bridge" in ids
    assert "offer-boat-cruise" in ids
    # The name-duplicate offer was dropped, not added under its own id.
    assert "offer-bridge-tour" not in ids
    assert len(items) == 2
    # The pool is sorted by score, best first.
    assert [item.score for item in items] == sorted(
        (item.score for item in items), reverse=True
    )


def _lucerne_planner_client() -> FakeSwissClient:
    return FakeSwissClient(
        destinations=[
            _destination(
                "lucerne",
                "Lucerne",
                description="Lakeside town with a historic old town.",
                geo=(47.05, 8.31),
            )
        ],
        attractions_by_destination={
            "lucerne": [
                _attraction(
                    "chapel-bridge",
                    "Chapel Bridge",
                    category="museum",
                    description="Historic covered bridge in the old town.",
                    geo=(47.0517, 8.3076),
                ),
                _attraction(
                    "lion-monument",
                    "Lion Monument",
                    category="monument",
                    description="Carved cultural heritage monument.",
                    geo=(47.0585, 8.3115),
                ),
            ]
        },
        tours_by_query={},
    )


async def _recommend_lucerne(client: FakeSwissClient, planner=None) -> list[dict]:
    return await recommendation_service.recommend(
        client,
        destination="Lucerne",
        start_date=date(2026, 6, 3),
        end_date=date(2026, 6, 4),
        mood="culture_history",
        trip_length="2_3_hours",
        itinerary_planner=planner,
    )


@pytest.mark.asyncio
async def test_recommend_with_planner_honors_stop_order_and_rehydrates_data():
    transport = FakePublicTransportClient(route=None)
    planner = FakeItineraryPlanner(
        plan=DayPlan(
            theme="Lions before bridges",
            description="A custom planner intro.",
            stops=[
                PlannedStop(candidate_id="lion-monument", slot_index=0),
                PlannedStop(candidate_id="chapel-bridge", slot_index=1),
            ],
        )
    )

    recommendations = await recommendation_service.recommend(
        _lucerne_planner_client(),
        destination="Lucerne",
        start_date=date(2026, 6, 3),
        end_date=date(2026, 6, 4),
        mood="culture_history",
        trip_length="2_3_hours",
        itinerary_planner=planner,
        public_transport_client=transport,
    )

    rec = recommendations[0]
    day = rec["itinerary"]["days"][0]
    assert [a["title"] for a in day["activities"]] == [
        "Lion Monument",
        "Chapel Bridge",
    ]
    # Planner copy is used for the theme and the recommendation intro.
    assert day["theme"] == "Lions before bridges"
    assert rec["description"] == "A custom planner intro."
    # Coordinates were rehydrated from the original pool item, not planner output:
    # the transport route starts at the Lion Monument.
    assert transport.calls[0][0].latitude == 47.0585
    assert all("cost" not in activity for activity in day["activities"])

    request = planner.requests[0]
    assert request.destination_name == "Lucerne"
    assert request.slot_count == 2
    assert request.season == "summer"
    assert request.nonce
    assert {candidate.source for candidate in request.candidates} == {"attraction"}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "error",
    [PlannerError("upstream model unavailable"), TimeoutError()],
    ids=["planner-error", "timeout"],
)
async def test_recommend_falls_back_when_planner_fails(error):
    baseline = await _recommend_lucerne(_lucerne_planner_client())

    failing_planner = FakeItineraryPlanner(error=error)
    recommendations = await _recommend_lucerne(
        _lucerne_planner_client(), planner=failing_planner
    )

    assert failing_planner.requests, "planner should have been consulted"
    assert recommendations == baseline


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "build",
    [
        lambda request: DayPlan(
            theme=None,
            description=None,
            stops=[
                PlannedStop(candidate_id="invented-1", slot_index=0),
                PlannedStop(candidate_id="invented-2", slot_index=1),
            ],
        ),
        lambda request: DayPlan(
            theme=None,
            description=None,
            stops=[
                PlannedStop(candidate_id=request.candidates[0].id, slot_index=0),
                PlannedStop(candidate_id=request.candidates[0].id, slot_index=1),
            ],
        ),
        lambda request: DayPlan(
            theme=None,
            description=None,
            stops=[PlannedStop(candidate_id=request.candidates[0].id, slot_index=0)],
        ),
        lambda request: DayPlan(
            theme=None,
            description=None,
            stops=[
                PlannedStop(candidate_id=request.candidates[0].id, slot_index=0),
                PlannedStop(candidate_id=request.candidates[1].id, slot_index=2),
            ],
        ),
    ],
    ids=["unknown-ids", "duplicate-ids", "wrong-count", "bad-slot-indices"],
)
async def test_recommend_falls_back_on_invalid_planner_output(build):
    baseline = await _recommend_lucerne(_lucerne_planner_client())

    recommendations = await _recommend_lucerne(
        _lucerne_planner_client(), planner=FakeItineraryPlanner(build=build)
    )

    assert recommendations == baseline


@pytest.mark.asyncio
async def test_recommend_truncates_long_planner_theme_to_schema_limit():
    long_theme = "Scenic lakeside wanderings between bridges and monuments " * 5
    planner = FakeItineraryPlanner(
        build=lambda request: DayPlan(
            theme=long_theme,
            description=None,
            stops=[
                PlannedStop(candidate_id=candidate.id, slot_index=index)
                for index, candidate in enumerate(request.candidates[:2])
            ],
        )
    )

    recommendations = await _recommend_lucerne(
        _lucerne_planner_client(), planner=planner
    )

    theme = recommendations[0]["itinerary"]["days"][0]["theme"]
    assert theme == long_theme.strip()[:80]


@pytest.mark.asyncio
async def test_recommend_fills_free_time_when_planner_returns_fewer_stops():
    client = FakeSwissClient(
        destinations=[
            _destination(
                "lucerne",
                "Lucerne",
                description="Lakeside town.",
                geo=(47.05, 8.31),
            )
        ],
        attractions_by_destination={
            "lucerne": [
                _attraction(
                    "chapel-bridge",
                    "Chapel Bridge",
                    category="museum",
                    description="Historic covered bridge.",
                    geo=(47.0517, 8.3076),
                ),
            ]
        },
        tours_by_query={},
    )
    planner = FakeItineraryPlanner(
        build=lambda request: DayPlan(
            theme=None,
            description=None,
            stops=[PlannedStop(candidate_id=request.candidates[0].id, slot_index=0)],
        )
    )

    recommendations = await recommendation_service.recommend(
        client,
        destination="Lucerne",
        start_date=date(2026, 6, 3),
        end_date=date(2026, 6, 4),
        trip_length="full_day",
        itinerary_planner=planner,
    )

    activities = recommendations[0]["itinerary"]["days"][0]["activities"]
    assert len(activities) == 4
    assert activities[0]["title"] == "Chapel Bridge"
    # Remaining slots fall back to free-time leisure entries.
    assert [activity["category"] for activity in activities[1:]] == ["leisure"] * 3


def test_planner_candidate_sampling_is_seeded_and_deterministic(monkeypatch):
    items = [
        recommendation_candidates.RecommendationItem(
            id=f"item-{index}",
            name=f"Item {index}",
            category="museum",
            url="",
            score=round(1.0 - index * 0.05, 3),
        )
        for index in range(15)
    ]

    monkeypatch.setattr(recommendation_planning, "_rng", random.Random(7))
    first = recommendation_planning._sample_candidates(items)
    monkeypatch.setattr(recommendation_planning, "_rng", random.Random(7))
    second = recommendation_planning._sample_candidates(items)

    assert first == second
    assert len(first) == recommendation_planning._PLANNER_SAMPLE_SIZE
    top_k_ids = {
        f"item-{index}" for index in range(recommendation_planning._PLANNER_TOP_K)
    }
    assert {item.id for item in first} <= top_k_ids
