from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, date, datetime

import pytest

from app.ports.swiss_tourism import (
    AttractionRecord,
    DestinationRecord,
    FacetRecord,
    FacetSnapshotRecord,
    FacetValueRecord,
    GeoCoordinates,
    OfferRecord,
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
    facet_attractions_by_filter: dict[str, list[AttractionRecord]] = field(
        default_factory=dict
    )
    facet_filters_by_attraction: dict[str, set[str]] = field(default_factory=dict)
    failing_facet_filters: set[str] = field(default_factory=set)
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
        if facet_filter in self.failing_facet_filters:
            raise RuntimeError("upstream rate limited")
        if facet_filter is None and self.fail_unfiltered_attractions:
            raise RuntimeError("upstream rate limited")
        if facet_filter and facet_filter in self.facet_attractions_by_filter:
            attractions = self.facet_attractions_by_filter[facet_filter]
        else:
            attractions = self.attractions_by_destination.get(destination_id or "", [])
        if facet_filter and facet_filter not in self.facet_attractions_by_filter:
            attractions = [
                attraction
                for attraction in attractions
                if facet_filter
                in self.facet_filters_by_attraction.get(attraction.id, set())
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
        return PaginatedResult(data=offers[:page_size], meta=_page_meta(len(offers)))

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
    # Attractions (no real offer price) no longer carry a fabricated per-item cost.
    activity_costs = [
        activity["cost"]
        for day in recommendations[0]["itinerary"]["days"]
        for activity in day["activities"]
    ]
    assert all(cost is None for cost in activity_costs)
    transport_costs = [
        item["cost"]
        for day in recommendations[0]["itinerary"]["days"]
        for item in day["timeline_items"]
        if item["kind"] == "transport"
    ]
    assert all(cost is None for cost in transport_costs)
    # Estimated total is budget/length-based: "budget" + "full_day" range, rounded to 5.
    estimated_total = recommendations[0]["itinerary"]["estimated_total"]
    assert 170 <= estimated_total <= 280
    assert estimated_total % 5 == 0
    assert recommendations[0]["highlights"]


@pytest.mark.asyncio
async def test_recommend_boosts_attractions_with_matching_facets(
    monkeypatch: pytest.MonkeyPatch,
):
    snapshot = FacetSnapshotRecord(
        object_type="attractions",
        language="en",
        fetched_at=datetime(2026, 6, 1, tzinfo=UTC),
        facets=[
            FacetRecord(
                name="experiencetype",
                title="Experience Type",
                values=[
                    FacetValueRecord(name="nature", title="Nature", count=12),
                    FacetValueRecord(name="museum", title="Museum", count=8),
                ],
            )
        ],
    )
    monkeypatch.setattr(
        recommendation_service,
        "get_attraction_facets_snapshot",
        lambda: snapshot,
    )
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
                ),
                _attraction(
                    "kunsthaus",
                    "Kunsthaus Zurich",
                    category="museum",
                    description="Major art museum.",
                ),
            ]
        },
        tours_by_query={"Zurich": []},
        facet_filters_by_attraction={
            "lake-promenade": {"experiencetype:nature"},
            "kunsthaus": {"experiencetype:museum"},
        },
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
    assert None in client.attraction_filter_calls
    assert "experiencetype:nature" in client.attraction_filter_calls
    assert activities[0]["title"] == "Lake Zurich Promenade"
    assert recommendations[0]["highlights"][0] == "Lake Zurich Promenade"
    assert "Kunsthaus Zurich" in recommendations[0]["highlights"]


@pytest.mark.asyncio
async def test_recommend_uses_broad_attractions_when_facets_are_sparse(
    monkeypatch: pytest.MonkeyPatch,
):
    snapshot = FacetSnapshotRecord(
        object_type="attractions",
        language="en",
        fetched_at=datetime(2026, 6, 1, tzinfo=UTC),
        facets=[
            FacetRecord(
                name="experiencetype",
                title="Experience Type",
                values=[FacetValueRecord(name="nature", title="Nature", count=1)],
            )
        ],
    )
    monkeypatch.setattr(
        recommendation_service,
        "get_attraction_facets_snapshot",
        lambda: snapshot,
    )
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
        facet_filters_by_attraction={
            "lake-promenade": {"experiencetype:nature"},
        },
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
    assert None in client.attraction_filter_calls
    assert "experiencetype:nature" in client.attraction_filter_calls
    assert all(activity["category"] != "leisure" for activity in activities)
    assert {activity["title"] for activity in activities} == {
        "Lake Zurich Promenade",
        "Kunsthaus Zurich",
        "Zurich Old Town Walk",
        "Local Market Hall",
    }


@pytest.mark.asyncio
async def test_recommend_scopes_global_facet_results_to_typed_destination(
    monkeypatch: pytest.MonkeyPatch,
):
    snapshot = FacetSnapshotRecord(
        object_type="attractions",
        language="en",
        fetched_at=datetime(2026, 6, 1, tzinfo=UTC),
        facets=[
            FacetRecord(
                name="experiencetype",
                title="Experience Type",
                values=[FacetValueRecord(name="nature", title="Nature", count=12)],
            )
        ],
    )
    monkeypatch.setattr(
        recommendation_service,
        "get_attraction_facets_snapshot",
        lambda: snapshot,
    )
    global_nature_attractions = [
        _attraction(
            "zurich-lake",
            "Lake Zurich Promenade",
            category="viewpoint",
            description="Relaxed lake scenery.",
            geo=(47.3667, 8.5433),
        ),
        _attraction(
            "bern-garden",
            "Rose Garden Bern",
            category="park",
            description="Garden views over the old town.",
            geo=(46.9480, 7.4590),
        ),
        _attraction(
            "farinet-trail",
            "Farinet's Trail",
            category="attraction",
            description="A trail in Valais.",
            geo=(46.1719, 7.1908),
        ),
    ]
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
        attractions_by_destination={"zurich": [], "bern": []},
        tours_by_query={"Zurich": [], "Bern": []},
        facet_attractions_by_filter={
            "experiencetype:nature": global_nature_attractions
        },
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
async def test_recommend_prefers_nearby_attractions_over_farther_text_match(
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setattr(
        recommendation_service,
        "get_attraction_facets_snapshot",
        lambda: None,
    )
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
async def test_recommend_falls_back_when_facet_attraction_request_fails(
    monkeypatch: pytest.MonkeyPatch,
):
    snapshot = FacetSnapshotRecord(
        object_type="attractions",
        language="en",
        fetched_at=datetime(2026, 6, 1, tzinfo=UTC),
        facets=[
            FacetRecord(
                name="experiencetype",
                title="Experience Type",
                values=[FacetValueRecord(name="nature", title="Nature", count=12)],
            )
        ],
    )
    monkeypatch.setattr(
        recommendation_service,
        "get_attraction_facets_snapshot",
        lambda: snapshot,
    )
    client = FakeSwissClient(
        destinations=[
            _destination(
                "zurich",
                "Zurich",
                description="A city with lake views.",
            )
        ],
        attractions_by_destination={
            "zurich": [
                _attraction(
                    "lake-promenade",
                    "Lake Zurich Promenade",
                    category="viewpoint",
                    description="Relaxed nature and lake scenery.",
                )
            ]
        },
        tours_by_query={"Zurich": []},
        failing_facet_filters={"experiencetype:nature"},
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
    assert client.attraction_filter_calls == [None, "experiencetype:nature"]
    assert activities[0]["title"] == "Lake Zurich Promenade"


@pytest.mark.asyncio
async def test_recommend_uses_fallback_activity_when_swiss_activity_calls_fail(
    monkeypatch: pytest.MonkeyPatch,
):
    snapshot = FacetSnapshotRecord(
        object_type="attractions",
        language="en",
        fetched_at=datetime(2026, 6, 1, tzinfo=UTC),
        facets=[
            FacetRecord(
                name="experiencetype",
                title="Experience Type",
                values=[FacetValueRecord(name="nature", title="Nature", count=12)],
            )
        ],
    )
    monkeypatch.setattr(
        recommendation_service,
        "get_attraction_facets_snapshot",
        lambda: snapshot,
    )
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
        failing_facet_filters={"experiencetype:nature"},
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
    assert client.attraction_filter_calls == [None, "experiencetype:nature"]
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
    assert transport_items[0]["cost"] is None
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
                "cost": 20.0,
                "_latitude": 0.0,
                "_longitude": 0.0,
            },
            {
                "id": "activity-1-1",
                "time": "11:00",
                "title": "Second stop",
                "category": "viewpoint",
                "cost": 20.0,
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
                "cost": 20.0,
            },
            {
                "id": "activity-1-1",
                "time": "11:00",
                "title": "Second stop",
                "category": "viewpoint",
                "cost": 20.0,
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


def _experiencetype_snapshot(
    *values: tuple[str, str, int],
) -> FacetSnapshotRecord:
    return FacetSnapshotRecord(
        object_type="attractions",
        language="en",
        fetched_at=datetime(2026, 6, 1, tzinfo=UTC),
        facets=[
            FacetRecord(
                name="experiencetype",
                title="Experience Type",
                values=[
                    FacetValueRecord(name=name, title=title, count=count)
                    for name, title, count in values
                ],
            )
        ],
    )


@pytest.mark.asyncio
async def test_recommend_blends_attractions_from_multiple_facets(
    monkeypatch: pytest.MonkeyPatch,
):
    snapshot = _experiencetype_snapshot(
        ("nature", "Nature", 12),
        ("culture", "Culture", 10),
    )
    monkeypatch.setattr(
        recommendation_service,
        "get_attraction_facets_snapshot",
        lambda: snapshot,
    )
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
                ),
                _attraction(
                    "kunsthaus",
                    "Kunsthaus Zurich",
                    category="museum",
                    description="Major art museum and cultural collection.",
                ),
            ]
        },
        tours_by_query={"Zurich": []},
        facet_filters_by_attraction={
            "lake-promenade": {"experiencetype:nature"},
            "kunsthaus": {"experiencetype:culture"},
        },
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

    # Both distinct facet filters are queried and both source an attraction, so the
    # itinerary mixes experience types instead of clustering on one facet.
    assert None in client.attraction_filter_calls
    assert "experiencetype:nature" in client.attraction_filter_calls
    assert "experiencetype:culture" in client.attraction_filter_calls
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
async def test_recommend_uses_current_season_facet_as_soft_signal(
    monkeypatch: pytest.MonkeyPatch,
):
    snapshot = FacetSnapshotRecord(
        object_type="attractions",
        language="en",
        fetched_at=datetime(2026, 6, 1, tzinfo=UTC),
        facets=[
            FacetRecord(
                name="experiencetype",
                title="Experience Type",
                values=[FacetValueRecord(name="nature", title="Nature", count=8)],
            ),
            FacetRecord(
                name="seasons",
                title="Seasons",
                values=[
                    FacetValueRecord(name="summer", title="Summer", count=20),
                    FacetValueRecord(name="winter", title="Winter", count=14),
                ],
            ),
        ],
    )
    monkeypatch.setattr(
        recommendation_service,
        "get_attraction_facets_snapshot",
        lambda: snapshot,
    )
    client = FakeSwissClient(
        destinations=[
            _destination("zurich", "Zurich", description="Lake views and nature.")
        ],
        attractions_by_destination={"zurich": []},
        tours_by_query={"Zurich": []},
        facet_attractions_by_filter={
            "experiencetype:nature": [
                _attraction(
                    "lake-promenade",
                    "Lake Zurich Promenade",
                    category="viewpoint",
                    description="Relaxed summer lake scenery.",
                )
            ],
            "seasons:summer": [
                _attraction(
                    "lake-promenade",
                    "Lake Zurich Promenade",
                    category="viewpoint",
                    description="Relaxed summer lake scenery.",
                )
            ],
        },
    )

    recommendations = await recommendation_service.recommend(
        client,
        destination="Zurich",
        start_date=date(2026, 6, 3),
        end_date=date(2026, 6, 4),
        mood="nature_outdoors",
        trip_length="half_day",
    )

    # The broad destination query stays unfiltered; style and season facets are soft
    # signal queries that can supplement or boost candidates.
    assert None in client.attraction_filter_calls
    assert "experiencetype:nature" in client.attraction_filter_calls
    assert "seasons:summer" in client.attraction_filter_calls
    titles = {
        activity["title"]
        for day in recommendations[0]["itinerary"]["days"]
        for activity in day["activities"]
    }
    assert "Lake Zurich Promenade" in titles


@pytest.mark.asyncio
async def test_recommend_uses_season_signal_when_no_style_facets_match(
    monkeypatch: pytest.MonkeyPatch,
):
    snapshot = FacetSnapshotRecord(
        object_type="attractions",
        language="en",
        fetched_at=datetime(2026, 6, 1, tzinfo=UTC),
        facets=[
            FacetRecord(
                name="seasons",
                title="Seasons",
                values=[FacetValueRecord(name="summer", title="Summer", count=20)],
            )
        ],
    )
    monkeypatch.setattr(
        recommendation_service,
        "get_attraction_facets_snapshot",
        lambda: snapshot,
    )
    client = FakeSwissClient(
        destinations=[
            _destination("zurich", "Zurich", description="Lake views and nature.")
        ],
        attractions_by_destination={"zurich": []},
        tours_by_query={"Zurich": []},
        facet_attractions_by_filter={
            "seasons:summer": [
                _attraction(
                    "lake-promenade",
                    "Lake Zurich Promenade",
                    category="viewpoint",
                    description="Relaxed summer lake scenery.",
                )
            ]
        },
    )

    recommendations = await recommendation_service.recommend(
        client,
        destination="Zurich",
        start_date=date(2026, 6, 3),
        end_date=date(2026, 6, 4),
        mood="slow_relaxing",
        trip_length="half_day",
    )

    # No style facet matched, so season is used as a soft signal beside the broad query.
    assert client.attraction_filter_calls == [None, "seasons:summer"]
    titles = {
        activity["title"]
        for day in recommendations[0]["itinerary"]["days"]
        for activity in day["activities"]
    }
    assert "Lake Zurich Promenade" in titles


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
async def test_recommend_mixes_offers_with_attractions_and_uses_real_price():
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
    # Real CHF price is used as the cost, scaled per traveler, not a demo price.
    assert offer_activities[0]["cost"] == 40.0 * travelers
    # Attractions still appear, so the plan is a genuine mix.
    assert any(a["category"] != "offer" for a in activities)
