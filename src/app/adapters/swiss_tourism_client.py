from __future__ import annotations

import httpx

from app.ports.swiss_tourism import (
    AttractionRecord,
    DestinationRecord,
    GeoCoordinates,
    PageMeta,
    PaginatedResult,
    SwissImage,
    TourRecord,
)

BASE_URL = "https://opendata.myswitzerland.io/v1"


class HttpxSwissTourismClient:
    """Adapter that talks to the MySwitzerland OpenData API via httpx."""

    def __init__(self, api_key: str, language: str = "en") -> None:
        self._api_key = api_key
        self._language = language

    def _headers(self) -> dict[str, str]:
        return {"x-api-key": self._api_key}

    def _base_params(self) -> dict[str, str]:
        return {"language": self._language, "striphtml": "true", "expand": "true"}

    # ── helpers ──────────────────────────────────────────

    @staticmethod
    def _extract_geo(item: dict) -> GeoCoordinates | None:
        geo = item.get("geo")
        if geo and "latitude" in geo and "longitude" in geo:
            return GeoCoordinates(
                latitude=float(geo["latitude"]),
                longitude=float(geo["longitude"]),
            )
        return None

    @staticmethod
    def _extract_images(item: dict) -> list[SwissImage]:
        images: list[SwissImage] = []
        for img in item.get("image", []):
            url = img.get("url") or img.get("src") or ""
            if url:
                images.append(SwissImage(url=url, title=img.get("name", "")))
        return images

    @staticmethod
    def _parse_page_meta(meta: dict) -> PageMeta:
        page = meta.get("page", {})
        return PageMeta(
            page_number=page.get("number", 1),
            page_size=page.get("size", 10),
            total_elements=page.get("totalElements", 0),
            total_pages=page.get("totalPages", 0),
        )

    # ── destinations ─────────────────────────────────────

    async def list_destinations(
        self,
        *,
        query: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> PaginatedResult[DestinationRecord]:
        params = {
            **self._base_params(),
            "page": str(page - 1),
            "size": str(page_size),
        }
        if query:
            params["query"] = query

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BASE_URL}/destinations/",
                headers=self._headers(),
                params=params,
            )
            resp.raise_for_status()

        body = resp.json()
        destinations = [self._to_destination(d) for d in body.get("data", [])]
        return PaginatedResult(
            data=destinations, meta=self._parse_page_meta(body.get("meta", {}))
        )

    async def get_destination(self, destination_id: str) -> DestinationRecord | None:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BASE_URL}/destinations/{destination_id}",
                headers=self._headers(),
                params=self._base_params(),
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()

        body = resp.json()
        data = body.get("data")
        if not data:
            return None
        return self._to_destination(data)

    def _to_destination(self, item: dict) -> DestinationRecord:
        return DestinationRecord(
            identifier=item.get("identifier", ""),
            name=item.get("name", ""),
            category=item.get("category"),
            description=item.get("description", ""),
            geo=self._extract_geo(item),
            images=self._extract_images(item),
            url=item.get("url", ""),
        )

    # ── attractions ──────────────────────────────────────

    async def list_attractions(
        self,
        *,
        query: str | None = None,
        destination_id: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> PaginatedResult[AttractionRecord]:
        params = {
            **self._base_params(),
            "page": str(page - 1),
            "size": str(page_size),
        }
        if query:
            params["query"] = query
        if destination_id:
            params["placeId"] = destination_id

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BASE_URL}/attractions/",
                headers=self._headers(),
                params=params,
            )
            resp.raise_for_status()

        body = resp.json()
        attractions = [self._to_attraction(a) for a in body.get("data", [])]
        return PaginatedResult(
            data=attractions, meta=self._parse_page_meta(body.get("meta", {}))
        )

    async def get_attraction(self, attraction_id: str) -> AttractionRecord | None:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BASE_URL}/attractions/{attraction_id}",
                headers=self._headers(),
                params=self._base_params(),
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()

        body = resp.json()
        data = body.get("data")
        if not data:
            return None
        return self._to_attraction(data)

    def _to_attraction(self, item: dict) -> AttractionRecord:
        return AttractionRecord(
            id=item.get("id", ""),
            name=item.get("name", ""),
            description=item.get("description", ""),
            category=item.get("category", ""),
            geo=self._extract_geo(item),
            images=self._extract_images(item),
            url=item.get("url", ""),
        )

    # ── tours ────────────────────────────────────────────

    async def list_tours(
        self,
        *,
        query: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> PaginatedResult[TourRecord]:
        params = {
            **self._base_params(),
            "page": str(page - 1),
            "size": str(page_size),
        }
        if query:
            params["query"] = query

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BASE_URL}/tours/",
                headers=self._headers(),
                params=params,
            )
            resp.raise_for_status()

        body = resp.json()
        tours = [self._to_tour(t) for t in body.get("data", [])]
        return PaginatedResult(
            data=tours, meta=self._parse_page_meta(body.get("meta", {}))
        )

    async def get_tour(self, tour_id: str) -> TourRecord | None:
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BASE_URL}/tours/{tour_id}",
                headers=self._headers(),
                params=self._base_params(),
            )
            if resp.status_code == 404:
                return None
            resp.raise_for_status()

        body = resp.json()
        data = body.get("data")
        if not data:
            return None
        return self._to_tour(data)

    def _to_tour(self, item: dict) -> TourRecord:
        return TourRecord(
            id=item.get("id", ""),
            name=item.get("name", ""),
            description=item.get("description", ""),
            distance_km=item.get("distance"),
            duration=item.get("duration", ""),
            geo=self._extract_geo(item),
            images=self._extract_images(item),
            url=item.get("url", ""),
        )
