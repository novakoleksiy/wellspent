from __future__ import annotations

import pytest
import respx
from httpx import Response

from app.adapters.swiss_tourism_client import BASE_URL, HttpxSwissTourismClient
from app.ports.swiss_tourism import (
    AttractionRecord,
    DestinationRecord,
    GeoCoordinates,
    SwissImage,
    TourRecord,
)

# ── fixtures ─────────────────────────────────────────────────────────────────

@pytest.fixture
def client() -> HttpxSwissTourismClient:
    return HttpxSwissTourismClient(api_key="test-key", language="en")


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
        "image": [
            {"url": "https://example.com/a.jpg", "name": "Alpine view"},
            {"src": "https://example.com/b.jpg"},
            {},  # no url/src — should be skipped
        ]
    }
    result = HttpxSwissTourismClient._extract_images(item)
    assert result == [
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
                "category": "city",
                "description": "The largest city.",
                "geo": {"latitude": "47.3769", "longitude": "8.5417"},
                "image": [{"url": "https://img.example.com/zurich.jpg", "name": "Zurich"}],
                "url": "https://myswitzerland.com/zurich",
            }
        ],
        "meta": {"page": {"number": 1, "size": 10, "totalElements": 1, "totalPages": 1}},
    }
    respx.get(f"{BASE_URL}/destinations/").mock(return_value=Response(200, json=payload))

    result = await client.list_destinations()

    assert len(result.data) == 1
    dest = result.data[0]
    assert isinstance(dest, DestinationRecord)
    assert dest.id == "zurich"
    assert dest.name == "Zurich"
    assert dest.category == "city"
    assert dest.geo == GeoCoordinates(latitude=47.3769, longitude=8.5417)
    assert dest.images == [SwissImage(url="https://img.example.com/zurich.jpg", title="Zurich")]
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
    assert request.url.params["page"] == "1"   # 0-indexed
    assert request.url.params["size"] == "5"
    assert request.url.params["lang"] == "en"


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
    respx.get(f"{BASE_URL}/destinations/geneva").mock(return_value=Response(200, json=payload))

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
                "id": "chillon",
                "name": "Château de Chillon",
                "description": "Medieval castle.",
                "category": "castle",
                "url": "https://myswitzerland.com/chillon",
            }
        ],
        "meta": {"page": {"number": 1, "size": 10, "totalElements": 1, "totalPages": 1}},
    }
    respx.get(f"{BASE_URL}/attractions/").mock(return_value=Response(200, json=payload))

    result = await client.list_attractions()

    assert len(result.data) == 1
    attr = result.data[0]
    assert isinstance(attr, AttractionRecord)
    assert attr.id == "chillon"
    assert attr.category == "castle"


@pytest.mark.asyncio
@respx.mock
async def test_list_attractions_passes_destination_id(client: HttpxSwissTourismClient):
    respx.get(f"{BASE_URL}/attractions/").mock(
        return_value=Response(200, json={"data": [], "meta": {}})
    )

    await client.list_attractions(destination_id="zurich")

    assert respx.calls.last.request.url.params["placeId"] == "zurich"


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
                "id": "tour-1",
                "name": "Rhine Falls Loop",
                "description": "Scenic loop.",
                "distance": 12.5,
                "duration": "3h",
                "url": "https://myswitzerland.com/tours/1",
            }
        ],
        "meta": {"page": {"number": 1, "size": 10, "totalElements": 1, "totalPages": 1}},
    }
    respx.get(f"{BASE_URL}/tours/").mock(return_value=Response(200, json=payload))

    result = await client.list_tours()

    assert len(result.data) == 1
    tour = result.data[0]
    assert isinstance(tour, TourRecord)
    assert tour.id == "tour-1"
    assert tour.distance_km == 12.5
    assert tour.duration == "3h"


# ── get_tour ──────────────────────────────────────────────────────────────────

@pytest.mark.asyncio
@respx.mock
async def test_get_tour_not_found(client: HttpxSwissTourismClient):
    respx.get(f"{BASE_URL}/tours/missing").mock(return_value=Response(404))

    assert await client.get_tour("missing") is None
