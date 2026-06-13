from __future__ import annotations

import pytest
import respx
from httpx import Response

from app.adapters.swiss_tourism_client import (
    BASE_URL,
    HttpxSwissTourismClient,
    SwissTourismAuthError,
    _offer_cache,
    _tour_cache,
)
from app.ports.swiss_tourism import (
    AttractionRecord,
    DestinationRecord,
    GeoCoordinates,
    OfferRecord,
    SwissImage,
    TourRecord,
)

# ── fixtures ─────────────────────────────────────────────────────────────────


@pytest.fixture
def client() -> HttpxSwissTourismClient:
    return HttpxSwissTourismClient(api_key="test-key", language="en")


@pytest.fixture(autouse=True)
def _clear_tour_cache():
    # The tour cache is process-wide, so isolate it between tests.
    _tour_cache.clear()
    yield
    _tour_cache.clear()


@pytest.fixture(autouse=True)
def _clear_offer_cache():
    # The offer cache is process-wide, so isolate it between tests.
    _offer_cache.clear()
    yield
    _offer_cache.clear()


# ── static helper tests ───────────────────────────────────────────────────────


def test_extract_geo_returns_coordinates():
    item = {"geo": {"latitude": "47.3769", "longitude": "8.5417"}}
    result = HttpxSwissTourismClient._extract_geo(item)
    assert result == GeoCoordinates(latitude=47.3769, longitude=8.5417)


def test_extract_geo_missing_returns_none():
    assert HttpxSwissTourismClient._extract_geo({}) is None
    assert HttpxSwissTourismClient._extract_geo({"geo": {}}) is None


def test_extract_images_uses_url_then_src():
    item = {
        "name": "Matterhorn",
        "photo": "https://example.com/hero.jpg",
        "image": [
            {"url": "https://example.com/a.jpg", "name": "Alpine view"},
            {"src": "https://example.com/b.jpg"},
            {"url": "https://example.com/hero.jpg"},
            {},  # no url/src — should be skipped
        ],
    }
    result = HttpxSwissTourismClient._extract_images(item)
    assert result == [
        SwissImage(url="https://example.com/hero.jpg", title="Matterhorn"),
        SwissImage(url="https://example.com/a.jpg", title="Alpine view"),
        SwissImage(url="https://example.com/b.jpg", title=""),
    ]


def test_parse_page_meta():
    meta = {"page": {"number": 2, "size": 20, "totalElements": 100, "totalPages": 5}}
    result = HttpxSwissTourismClient._parse_page_meta(meta)
    assert result.page_number == 2
    assert result.page_size == 20
    assert result.total_elements == 100
    assert result.total_pages == 5


def test_parse_page_meta_defaults():
    result = HttpxSwissTourismClient._parse_page_meta({})
    assert result.page_number == 1
    assert result.page_size == 10
    assert result.total_elements == 0
    assert result.total_pages == 0


# ── list_destinations ─────────────────────────────────────────────────────────


@pytest.mark.asyncio
@respx.mock
async def test_list_destinations(client: HttpxSwissTourismClient):
    payload = {
        "data": [
            {
                "identifier": "zurich",
                "name": "Zurich",
                "category": "staedte",
                "categoryName": {"en": "City", "de": "Städte"},
                "description": "The largest city.",
                "geo": {"latitude": "47.3769", "longitude": "8.5417"},
                "image": [
                    {"url": "https://img.example.com/zurich.jpg", "name": "Zurich"}
                ],
                "url": "https://myswitzerland.com/zurich",
            }
        ],
        "meta": {
            "page": {"number": 1, "size": 10, "totalElements": 1, "totalPages": 1}
        },
    }
    respx.get(f"{BASE_URL}/destinations/").mock(
        return_value=Response(200, json=payload)
    )

    result = await client.list_destinations()

    assert len(result.data) == 1
    dest = result.data[0]
    assert isinstance(dest, DestinationRecord)
    assert dest.id == "zurich"
    assert dest.name == "Zurich"
    assert dest.category == "City"
    assert dest.geo == GeoCoordinates(latitude=47.3769, longitude=8.5417)
    assert dest.images == [
        SwissImage(url="https://img.example.com/zurich.jpg", title="Zurich")
    ]
    assert result.meta.total_elements == 1


@pytest.mark.asyncio
@respx.mock
async def test_list_destinations_passes_query(client: HttpxSwissTourismClient):
    respx.get(f"{BASE_URL}/destinations/").mock(
        return_value=Response(200, json={"data": [], "meta": {}})
    )

    await client.list_destinations(query="alps", page=2, page_size=5)

    request = respx.calls.last.request
    assert request.url.params["query"] == "alps"
    assert request.url.params["page"] == "1"  # 0-indexed
    assert request.url.params["hitsPerPage"] == "5"
    assert request.url.params["lang"] == "en"


@pytest.mark.asyncio
@respx.mock
async def test_list_destinations_allows_language_override(
    client: HttpxSwissTourismClient,
):
    respx.get(f"{BASE_URL}/destinations/").mock(
        return_value=Response(200, json={"data": [], "meta": {}})
    )

    await client.list_destinations(query="zurich", language="fr")

    request = respx.calls.last.request
    assert request.url.params["lang"] == "fr"


@pytest.mark.asyncio
@respx.mock
async def test_list_destinations_does_not_expose_raw_category_ids(
    client: HttpxSwissTourismClient,
):
    payload = {
        "data": [
            {
                "identifier": "zurich",
                "name": "Zurich",
                "category": "staedte",
                "description": "The largest city.",
            }
        ],
        "meta": {},
    }
    respx.get(f"{BASE_URL}/destinations/").mock(
        return_value=Response(200, json=payload)
    )

    result = await client.list_destinations()

    assert result.data[0].category is None


@pytest.mark.asyncio
@respx.mock
async def test_list_destinations_raises_auth_error_on_unauthorized(
    client: HttpxSwissTourismClient,
):
    respx.get(f"{BASE_URL}/destinations/").mock(return_value=Response(401))

    with pytest.raises(SwissTourismAuthError, match="authentication failed"):
        await client.list_destinations(query="zurich")


# ── get_destination ───────────────────────────────────────────────────────────


@pytest.mark.asyncio
@respx.mock
async def test_get_destination(client: HttpxSwissTourismClient):
    payload = {
        "data": {
            "identifier": "geneva",
            "name": "Geneva",
            "category": None,
            "description": "Lake city.",
            "url": "https://myswitzerland.com/geneva",
        }
    }
    respx.get(f"{BASE_URL}/destinations/geneva").mock(
        return_value=Response(200, json=payload)
    )

    result = await client.get_destination("geneva")

    assert isinstance(result, DestinationRecord)
    assert result.id == "geneva"
    assert result.category is None


@pytest.mark.asyncio
@respx.mock
async def test_get_destination_not_found(client: HttpxSwissTourismClient):
    respx.get(f"{BASE_URL}/destinations/nope").mock(return_value=Response(404))

    result = await client.get_destination("nope")

    assert result is None


# ── list_attractions ──────────────────────────────────────────────────────────


@pytest.mark.asyncio
@respx.mock
async def test_list_attractions(client: HttpxSwissTourismClient):
    payload = {
        "data": [
            {
                "identifier": "chillon",
                "name": "Château de Chillon",
                "abstract": "Medieval castle.",
                "category": "castle",
                "photo": "https://img.example.com/chillon.jpg",
                "url": "https://myswitzerland.com/chillon",
                "classification": [
                    {
                        "name": "seasons",
                        "values": [
                            {"name": "spring", "title": "Spring"},
                            {"name": "summer", "title": "Summer"},
                        ],
                    },
                    {
                        "name": "experiencetype",
                        "values": [{"name": "culture", "title": "Culture"}],
                    },
                ],
            }
        ],
        "meta": {
            "page": {"number": 1, "size": 10, "totalElements": 1, "totalPages": 1}
        },
    }
    respx.get(f"{BASE_URL}/attractions/").mock(return_value=Response(200, json=payload))

    result = await client.list_attractions()

    assert len(result.data) == 1
    attr = result.data[0]
    assert isinstance(attr, AttractionRecord)
    assert attr.id == "chillon"
    assert attr.description == "Medieval castle."
    assert attr.category == "castle"
    assert attr.images == [
        SwissImage(
            url="https://img.example.com/chillon.jpg", title="Château de Chillon"
        )
    ]
    # Classification groups are surfaced as per-item title lists for local scoring;
    # multi-value groups keep every value and absent groups stay empty.
    assert attr.seasons == ["Spring", "Summer"]
    assert attr.experiencetype == ["Culture"]


@pytest.mark.asyncio
@respx.mock
async def test_list_attractions_without_classification_yields_empty_tags(
    client: HttpxSwissTourismClient,
):
    payload = {
        "data": [
            {
                "identifier": "chillon",
                "name": "Château de Chillon",
                "category": "castle",
            }
        ],
        "meta": {
            "page": {"number": 1, "size": 10, "totalElements": 1, "totalPages": 1}
        },
    }
    respx.get(f"{BASE_URL}/attractions/").mock(return_value=Response(200, json=payload))

    result = await client.list_attractions()

    attr = result.data[0]
    assert attr.seasons == []
    assert attr.experiencetype == []


@pytest.mark.asyncio
@respx.mock
async def test_list_attractions_passes_destination_id(client: HttpxSwissTourismClient):
    respx.get(f"{BASE_URL}/attractions/").mock(
        return_value=Response(200, json={"data": [], "meta": {}})
    )

    await client.list_attractions(destination_id="zurich")

    assert respx.calls.last.request.url.params["placeId"] == "zurich"


@pytest.mark.asyncio
@respx.mock
async def test_list_attractions_passes_geo_filters(client: HttpxSwissTourismClient):
    respx.get(f"{BASE_URL}/attractions/").mock(
        return_value=Response(200, json={"data": [], "meta": {}})
    )

    await client.list_attractions(
        latitude=47.3769, longitude=8.5417, radius_m=1000, top=True
    )

    params = respx.calls.last.request.url.params
    assert params["geo.dist"] == "47.3769,8.5417,1000"
    assert params["top"] == "true"


@pytest.mark.asyncio
@respx.mock
async def test_list_attractions_passes_facet_filter(client: HttpxSwissTourismClient):
    respx.get(f"{BASE_URL}/attractions/").mock(
        return_value=Response(200, json={"data": [], "meta": {}})
    )

    await client.list_attractions(facet_filter="experiencetype:nature")

    assert respx.calls.last.request.url.params["facet.filter"] == (
        "experiencetype:nature"
    )


@pytest.mark.asyncio
@respx.mock
async def test_list_attractions_passes_facets(client: HttpxSwissTourismClient):
    respx.get(f"{BASE_URL}/attractions/").mock(
        return_value=Response(200, json={"data": [], "meta": {}})
    )

    await client.list_attractions(
        facets=["seasons", "experiencetype"], facets_translate=True
    )

    params = respx.calls.last.request.url.params
    assert params["facets"] == "seasons,experiencetype"
    assert params["facets.translate"] == "true"


@pytest.mark.asyncio
@respx.mock
async def test_get_attraction_facets_returns_snapshot(client: HttpxSwissTourismClient):
    payload = {
        "meta": {
            "language": "en",
            "facets": {
                "experiencetype": {"nature": 3, "culture": 2},
                "seasons": {"winter": 4},
            },
            "facetsTranslation": {
                "experiencetype": {
                    "title": "Experience Type",
                    "values": {"nature": "Nature", "culture": "Culture"},
                },
                "seasons": {"values": {"winter": "Winter"}},
            },
        }
    }
    respx.get(f"{BASE_URL}/attractions/").mock(return_value=Response(200, json=payload))

    result = await client.get_attraction_facets()

    params = respx.calls.last.request.url.params
    assert params["facets"] == "*"
    assert params["facets.translate"] == "true"
    assert params["hitsPerPage"] == "1"
    assert result.object_type == "attractions"
    assert result.language == "en"
    assert result.facets[0].name == "experiencetype"
    assert result.facets[0].title == "Experience Type"
    assert result.facets[0].values[1].name == "nature"
    assert result.facets[0].values[1].title == "Nature"
    assert result.facets[0].values[1].count == 3


# ── get_attraction ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@respx.mock
async def test_get_attraction_not_found(client: HttpxSwissTourismClient):
    respx.get(f"{BASE_URL}/attractions/missing").mock(return_value=Response(404))

    assert await client.get_attraction("missing") is None


# ── list_tours ────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@respx.mock
async def test_list_tours(client: HttpxSwissTourismClient):
    payload = {
        "data": [
            {
                "identifier": "tour-1",
                "name": "Rhine Route, Stage 4/9",
                "abstract": "Scenic loop.",
                "url": "https://myswitzerland.com/tours/1",
                "specs": {
                    "distance": 43,
                    "duration": 350,
                    "ascent": 150,
                    "descent": 190,
                },
                "itinerary": [
                    {"@type": "Place", "name": "Buchs"},
                    {"@type": "Place", "name": "St. Margrethen"},
                ],
                "touristType": ["Outdoor Enthusiast - Biker and Cyclist"],
                "classification": [
                    {
                        "name": "routestypes",
                        "values": [{"name": "bicycle", "title": "Bicycle"}],
                    },
                    {
                        "name": "requirementconditions",
                        "values": [{"name": "medium", "title": "Medium"}],
                    },
                ],
                "provider": {
                    "@type": "Organization",
                    "name": "Lungern Turren Bahn AG",
                    "email": "info@ltb-ag.ch",
                    "url": "https://www.turren.ch/",
                    "address": {
                        "telephone": "+41 (0)41 679 01 11",
                        "addressLocality": "Lungern",
                    },
                },
            }
        ],
        "meta": {
            "page": {"number": 1, "size": 10, "totalElements": 1, "totalPages": 1}
        },
    }
    respx.get(f"{BASE_URL}/tours/").mock(return_value=Response(200, json=payload))

    result = await client.list_tours()

    assert len(result.data) == 1
    tour = result.data[0]
    assert isinstance(tour, TourRecord)
    assert tour.id == "tour-1"
    assert tour.distance_km == 43
    assert tour.duration_minutes == 350
    assert tour.ascent_m == 150
    assert tour.descent_m == 190
    assert tour.waypoints == ["Buchs", "St. Margrethen"]
    assert tour.route_type == "Bicycle"
    assert tour.difficulty == "Medium"
    assert tour.tourist_types == ["Outdoor Enthusiast - Biker and Cyclist"]
    assert tour.provider is not None
    assert tour.provider.name == "Lungern Turren Bahn AG"
    assert tour.provider.url == "https://www.turren.ch/"
    assert tour.provider.phone == "+41 (0)41 679 01 11"
    assert tour.provider.locality == "Lungern"


@pytest.mark.asyncio
@respx.mock
async def test_list_tours_provider_as_list(client: HttpxSwissTourismClient):
    # The live API returns `provider` (and `address`) as either a dict or a list.
    payload = {
        "data": [
            {
                "identifier": "tour-3",
                "name": "Lungern Loop",
                "abstract": "Provider given as a list.",
                "url": "https://myswitzerland.com/tours/3",
                "provider": [
                    {
                        "@type": "Organization",
                        "name": "Lungern Turren Bahn AG",
                        "url": "https://www.turren.ch/",
                        "address": [
                            {
                                "telephone": "+41 41 679 01 11",
                                "addressLocality": "Lungern",
                            }
                        ],
                    }
                ],
            }
        ],
        "meta": {
            "page": {"number": 1, "size": 10, "totalElements": 1, "totalPages": 1}
        },
    }
    respx.get(f"{BASE_URL}/tours/").mock(return_value=Response(200, json=payload))

    result = await client.list_tours()

    tour = result.data[0]
    assert tour.provider is not None
    assert tour.provider.name == "Lungern Turren Bahn AG"
    assert tour.provider.phone == "+41 41 679 01 11"
    assert tour.provider.locality == "Lungern"


@pytest.mark.asyncio
@respx.mock
async def test_list_tours_without_provider_or_specs(client: HttpxSwissTourismClient):
    payload = {
        "data": [
            {
                "identifier": "tour-2",
                "name": "Minimal Tour",
                "abstract": "No specs or provider.",
                "url": "https://myswitzerland.com/tours/2",
            }
        ],
        "meta": {
            "page": {"number": 1, "size": 10, "totalElements": 1, "totalPages": 1}
        },
    }
    respx.get(f"{BASE_URL}/tours/").mock(return_value=Response(200, json=payload))

    result = await client.list_tours()

    tour = result.data[0]
    assert tour.distance_km is None
    assert tour.duration_minutes is None
    assert tour.waypoints == []
    assert tour.tourist_types == []
    assert tour.route_type is None
    assert tour.difficulty is None
    assert tour.provider is None


# ── get_tour ──────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@respx.mock
async def test_get_tour_not_found(client: HttpxSwissTourismClient):
    respx.get(f"{BASE_URL}/tours/missing").mock(return_value=Response(404))

    assert await client.get_tour("missing") is None


# ── caching ───────────────────────────────────────────────────────────────────


def _single_tour_list_payload() -> dict:
    return {
        "data": [
            {
                "identifier": "tour-1",
                "name": "Rhine Route, Stage 1/9",
                "abstract": "Scenic loop.",
                "url": "https://myswitzerland.com/tours/1",
            }
        ],
        "meta": {
            "page": {"number": 1, "size": 10, "totalElements": 1, "totalPages": 1}
        },
    }


@pytest.mark.asyncio
@respx.mock
async def test_list_tours_served_from_cache_within_ttl():
    cached_client = HttpxSwissTourismClient(
        api_key="test-key", language="en", cache_ttl=300
    )
    route = respx.get(f"{BASE_URL}/tours/").mock(
        return_value=Response(200, json=_single_tour_list_payload())
    )

    first = await cached_client.list_tours()
    second = await cached_client.list_tours()

    # The upstream API is hit once; the second call is served from cache.
    assert route.call_count == 1
    assert second is first


@pytest.mark.asyncio
@respx.mock
async def test_list_tours_not_cached_when_ttl_disabled(
    client: HttpxSwissTourismClient,
):
    # The default fixture client has cache_ttl=0 (caching disabled).
    route = respx.get(f"{BASE_URL}/tours/").mock(
        return_value=Response(200, json=_single_tour_list_payload())
    )

    await client.list_tours()
    await client.list_tours()

    assert route.call_count == 2


@pytest.mark.asyncio
@respx.mock
async def test_list_tours_cache_key_varies_by_query():
    cached_client = HttpxSwissTourismClient(
        api_key="test-key", language="en", cache_ttl=300
    )
    route = respx.get(f"{BASE_URL}/tours/").mock(
        return_value=Response(200, json=_single_tour_list_payload())
    )

    await cached_client.list_tours(query="Rhine Route")
    await cached_client.list_tours(query="Jura Route")

    # Different queries are distinct cache entries, so both hit the API.
    assert route.call_count == 2


@pytest.mark.asyncio
@respx.mock
async def test_get_tour_served_from_cache_within_ttl():
    cached_client = HttpxSwissTourismClient(
        api_key="test-key", language="en", cache_ttl=300
    )
    payload = {
        "data": {
            "identifier": "tour-1",
            "name": "Rhine Route, Stage 1/9",
            "abstract": "Scenic loop.",
            "url": "https://myswitzerland.com/tours/1",
        }
    }
    route = respx.get(f"{BASE_URL}/tours/tour-1").mock(
        return_value=Response(200, json=payload)
    )

    first = await cached_client.get_tour("tour-1")
    second = await cached_client.get_tour("tour-1")

    assert route.call_count == 1
    assert second is first


# ── offers ────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
@respx.mock
async def test_list_offers(client: HttpxSwissTourismClient):
    payload = {
        "data": [
            {
                "identifier": "offer-1",
                "name": "From Zurich: Day trip to Lucerne incl. boat tour",
                "abstract": "Take a coach trip to Lucerne and enjoy a boat ride.",
                "image": [
                    {"url": "https://example.com/lucerne.jpg"},
                ],
                "areaServed": {
                    "@type": "TouristDestination",
                    "identifier": "dest-1",
                    "geo": {"latitude": 47.380652, "longitude": 8.537228},
                },
                "priceSpecification": {
                    "minPrice": 92,
                    "priceCurrency": "CHF",
                },
                "validFrom": "2026-05-13",
                "validThrough": "2026-10-18",
                "url": "https://myswitzerland.com/offers/lucerne-day-trip/",
                "mainEntityOfPage": "https://api.openbooking.ch/offers/sa-370/url",
                "classification": [
                    {
                        "name": "offertype",
                        "values": [
                            {
                                "name": "hotelpartneroffers",
                                "title": "Hotel - Partner Offers",
                            }
                        ],
                    },
                ],
            }
        ],
        "meta": {
            "page": {"number": 1, "size": 10, "totalElements": 1, "totalPages": 1}
        },
    }
    respx.get(f"{BASE_URL}/offers/").mock(return_value=Response(200, json=payload))

    result = await client.list_offers()

    assert len(result.data) == 1
    offer = result.data[0]
    assert isinstance(offer, OfferRecord)
    assert offer.id == "offer-1"
    assert offer.price_amount == 92
    assert offer.price_currency == "CHF"
    assert offer.valid_from == "2026-05-13"
    assert offer.valid_through == "2026-10-18"
    assert offer.offer_type == "Hotel - Partner Offers"
    assert offer.area_id == "dest-1"
    assert offer.geo == GeoCoordinates(latitude=47.380652, longitude=8.537228)
    assert offer.images[0].url == "https://example.com/lucerne.jpg"
    assert offer.info_url == "https://myswitzerland.com/offers/lucerne-day-trip/"
    assert offer.booking_url == "https://api.openbooking.ch/offers/sa-370/url"


@pytest.mark.asyncio
@respx.mock
async def test_list_offers_minimal(client: HttpxSwissTourismClient):
    payload = {
        "data": [
            {
                "identifier": "offer-2",
                "name": "Minimal Offer",
            }
        ],
        "meta": {
            "page": {"number": 1, "size": 10, "totalElements": 1, "totalPages": 1}
        },
    }
    respx.get(f"{BASE_URL}/offers/").mock(return_value=Response(200, json=payload))

    offer = (await client.list_offers()).data[0]

    assert offer.price_amount is None
    assert offer.price_currency is None
    assert offer.valid_from is None
    assert offer.offer_type is None
    assert offer.area_id is None
    assert offer.geo is None
    assert offer.images == []
    assert offer.booking_url is None


@pytest.mark.asyncio
@respx.mock
async def test_get_offer_resolves_area_name(client: HttpxSwissTourismClient):
    offer_payload = {
        "data": {
            "identifier": "offer-1",
            "name": "Day trip to Lucerne",
            "abstract": "A boat ride.",
            "areaServed": {
                "identifier": "dest-1",
                "geo": {"latitude": 47.05, "longitude": 8.30},
            },
            "url": "https://myswitzerland.com/offers/lucerne/",
        }
    }
    destination_payload = {
        "data": {
            "identifier": "dest-1",
            "name": "Lucerne",
        }
    }
    respx.get(f"{BASE_URL}/offers/offer-1").mock(
        return_value=Response(200, json=offer_payload)
    )
    respx.get(f"{BASE_URL}/destinations/dest-1").mock(
        return_value=Response(200, json=destination_payload)
    )

    offer = await client.get_offer("offer-1")

    assert offer is not None
    assert offer.area_id == "dest-1"
    assert offer.area_name == "Lucerne"


@pytest.mark.asyncio
@respx.mock
async def test_get_offer_not_found(client: HttpxSwissTourismClient):
    respx.get(f"{BASE_URL}/offers/missing").mock(return_value=Response(404))

    assert await client.get_offer("missing") is None


@pytest.mark.asyncio
@respx.mock
async def test_list_offers_served_from_cache_within_ttl():
    cached_client = HttpxSwissTourismClient(
        api_key="test-key", language="en", offers_cache_ttl=300
    )
    payload = {
        "data": [{"identifier": "offer-1", "name": "Day trip"}],
        "meta": {
            "page": {"number": 1, "size": 10, "totalElements": 1, "totalPages": 1}
        },
    }
    route = respx.get(f"{BASE_URL}/offers/").mock(
        return_value=Response(200, json=payload)
    )

    first = await cached_client.list_offers()
    second = await cached_client.list_offers()

    assert route.call_count == 1
    assert second is first
