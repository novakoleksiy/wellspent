from __future__ import annotations

from datetime import UTC, datetime

import httpx

from app.ports.swiss_tourism import (
    AttractionRecord,
    DestinationRecord,
    FacetRecord,
    FacetSnapshotRecord,
    FacetValueRecord,
    GeoCoordinates,
    PageMeta,
    PaginatedResult,
    SwissImage,
    TourRecord,
)

BASE_URL = "https://opendata.myswitzerland.io/v1"

_DESTINATION_CATEGORY_LABEL_KEYS = (
    "categoryName",
    "categoryLabel",
    "categoryTitle",
    "categoryText",
    "categoryTranslation",
    "categoryTranslated",
)


class SwissTourismAuthError(Exception):
    """Raised when the upstream Swiss Tourism API rejects our credentials."""


class HttpxSwissTourismClient:
    """Adapter that talks to the MySwitzerland OpenData API via httpx."""

    def __init__(self, api_key: str, language: str = "en") -> None:
        self._api_key = api_key
        self._language = language

    def _headers(self) -> dict[str, str]:
        return {"x-api-key": self._api_key}

    def _base_params(self, language: str | None = None) -> dict[str, str]:
        return {
            "lang": language or self._language,
            "striphtml": "true",
            "expand": "true",
        }

    @staticmethod
    def _raise_for_status(resp: httpx.Response) -> None:
        if resp.status_code in {401, 403}:
            raise SwissTourismAuthError("Swiss Tourism API authentication failed")
        resp.raise_for_status()

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
        seen_urls: set[str] = set()

        photo = item.get("photo")
        if photo:
            images.append(SwissImage(url=photo, title=item.get("name", "")))
            seen_urls.add(photo)

        for img in item.get("image", []):
            url = img.get("url") or img.get("src") or ""
            if url and url not in seen_urls:
                images.append(SwissImage(url=url, title=img.get("name", "")))
                seen_urls.add(url)
        return images

    @staticmethod
    def _localized_text(value: object, language: str = "en") -> str | None:
        if isinstance(value, str):
            return value.strip() or None
        if isinstance(value, dict):
            preferred = value.get(language)
            if preferred:
                return HttpxSwissTourismClient._localized_text(preferred, language)
            for key in ("name", "title", "label", "value"):
                if value.get(key):
                    return HttpxSwissTourismClient._localized_text(value[key], language)
        if isinstance(value, list):
            for item in value:
                text = HttpxSwissTourismClient._localized_text(item, language)
                if text:
                    return text
        return None

    @staticmethod
    def _extract_destination_category(item: dict, language: str = "en") -> str | None:
        for key in _DESTINATION_CATEGORY_LABEL_KEYS:
            text = HttpxSwissTourismClient._localized_text(item.get(key), language)
            if text:
                return text

        category = item.get("category")
        if isinstance(category, str):
            # Plain category strings are taxonomy IDs, not localized display labels.
            return None
        return HttpxSwissTourismClient._localized_text(category, language)

    @staticmethod
    def _parse_page_meta(meta: dict) -> PageMeta:
        page = meta.get("page", {})
        return PageMeta(
            page_number=page.get("number", 1),
            page_size=page.get("size", 10),
            total_elements=page.get("totalElements", 0),
            total_pages=page.get("totalPages", 0),
        )

    def _parse_facet_snapshot(self, meta: dict) -> FacetSnapshotRecord:
        facets = meta.get("facets") or {}
        translations = meta.get("facetsTranslation") or {}
        records: list[FacetRecord] = []

        for facet_name, values in sorted(facets.items()):
            facet_translation = translations.get(facet_name) or {}
            value_translations = facet_translation.get("values") or {}
            records.append(
                FacetRecord(
                    name=facet_name,
                    title=facet_translation.get("title"),
                    values=[
                        FacetValueRecord(
                            name=value_name,
                            title=value_translations.get(value_name),
                            count=count,
                        )
                        for value_name, count in sorted(values.items())
                    ],
                )
            )

        return FacetSnapshotRecord(
            object_type="attractions",
            language=meta.get("language", self._language),
            fetched_at=datetime.now(UTC),
            facets=records,
        )

    # ── destinations ─────────────────────────────────────

    async def list_destinations(
        self,
        *,
        query: str | None = None,
        language: str | None = None,
        page: int = 1,
        page_size: int = 10,
    ) -> PaginatedResult[DestinationRecord]:
        params = {
            **self._base_params(language),
            "page": str(page - 1),
            "hitsPerPage": str(page_size),
        }
        if query:
            params["query"] = query

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BASE_URL}/destinations/",
                headers=self._headers(),
                params=params,
            )
            self._raise_for_status(resp)

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
            self._raise_for_status(resp)

        body = resp.json()
        data = body.get("data")
        if not data:
            return None
        return self._to_destination(data)

    def _to_destination(self, item: dict) -> DestinationRecord:
        return DestinationRecord(
            id=item.get("identifier", ""),
            name=item.get("name", ""),
            category=self._extract_destination_category(item),
            description=item.get("description") or item.get("abstract", ""),
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
        params = {
            **self._base_params(),
            "page": str(page - 1),
            "hitsPerPage": str(page_size),
        }
        if query:
            params["query"] = query
        if destination_id:
            params["placeId"] = destination_id
        if facets:
            params["facets"] = ",".join(facets)
        if facet_filter:
            params["facet.filter"] = facet_filter
        if facets_translate is not None:
            params["facets.translate"] = str(facets_translate).lower()
        if bbox:
            params["geo.bbox"] = ",".join(str(value) for value in bbox)
        elif latitude is not None and longitude is not None:
            values = [str(latitude), str(longitude)]
            if radius_m is not None:
                values.append(str(radius_m))
            params["geo.dist"] = ",".join(values)
        if top is not None:
            params["top"] = str(top).lower()

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BASE_URL}/attractions/",
                headers=self._headers(),
                params=params,
            )
            self._raise_for_status(resp)

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
            self._raise_for_status(resp)

        body = resp.json()
        data = body.get("data")
        if not data:
            return None
        return self._to_attraction(data)

    async def get_attraction_facets(self) -> FacetSnapshotRecord:
        params = {
            **self._base_params(),
            "page": "0",
            "hitsPerPage": "1",
            "facets": "*",
            "facets.translate": "true",
        }

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BASE_URL}/attractions/",
                headers=self._headers(),
                params=params,
            )
            self._raise_for_status(resp)

        return self._parse_facet_snapshot(resp.json().get("meta", {}))

    def _to_attraction(self, item: dict) -> AttractionRecord:
        return AttractionRecord(
            id=item.get("identifier") or item.get("id", ""),
            name=item.get("name", ""),
            description=item.get("description") or item.get("abstract", ""),
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
            "hitsPerPage": str(page_size),
        }
        if query:
            params["query"] = query

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{BASE_URL}/tours/",
                headers=self._headers(),
                params=params,
            )
            self._raise_for_status(resp)

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
            self._raise_for_status(resp)

        body = resp.json()
        data = body.get("data")
        if not data:
            return None
        return self._to_tour(data)

    def _to_tour(self, item: dict) -> TourRecord:
        return TourRecord(
            id=item.get("identifier") or item.get("id", ""),
            name=item.get("name", ""),
            description=item.get("description") or item.get("abstract", ""),
            distance_km=item.get("distance"),
            duration=item.get("duration", ""),
            geo=self._extract_geo(item),
            images=self._extract_images(item),
            url=item.get("url", ""),
        )
