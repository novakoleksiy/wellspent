from __future__ import annotations

import asyncio
import logging
import random
from dataclasses import dataclass

from app.ports.swiss_tourism import (
    AttractionRecord,
    DestinationRecord,
    OfferRecord,
    SwissTourismClient,
)
from app.services.recommendation.scoring import (
    _DESTINATION_ATTRACTION_RADIUS_M,
    AttractionMatchSignals,
    _clean_description,
    _distance_meters,
    _proximity_blended_score,
    _quiz_blended_score,
    _score_text,
    _tokens,
)

logger = logging.getLogger(__name__)

_SURPRISE_SWISS_DESTINATIONS: list[str] = [
    "Zurich",
    "Geneva",
    "Lucerne",
    "Interlaken",
    "Zermatt",
    "Bern",
    "Lausanne",
    "Lugano",
    "Basel",
    "St. Moritz",
]

_DESTINATION_OFFER_RADIUS_M = _DESTINATION_ATTRACTION_RADIUS_M
_ATTRACTION_FETCH_PAGE_SIZE = 50
_MAX_ATTRACTION_FETCH_PAGES = 6
_OFFER_FETCH_PAGE_SIZE = 30
_MAX_OFFER_FETCH_PAGES = 4


@dataclass
class RecommendationItem:
    name: str
    category: str
    url: str
    score: float
    distance_m: float | None = None
    latitude: float | None = None
    longitude: float | None = None
    image_url: str | None = None
    description: str | None = None
    # Stable candidate id used to reference items across the planner boundary.
    # Attractions use the upstream id, offers an "offer-" prefixed one (the two
    # upstream namespaces are unrelated and could collide unprefixed).
    id: str = ""


def _normalized_name(name: str) -> str:
    return " ".join(name.lower().split())


def _offer_candidate_id(offer: OfferRecord) -> str:
    if offer.id:
        return f"offer-{offer.id}"
    return f"offer-{_normalized_name(offer.name).replace(' ', '-')}"


def _scope_attractions_to_destination(
    dest: DestinationRecord,
    attractions: list[AttractionRecord],
) -> list[AttractionRecord]:
    if dest.geo is None:
        return attractions

    scoped: list[AttractionRecord] = []
    for attraction in attractions:
        if attraction.geo is None:
            scoped.append(attraction)
            continue
        distance_m = _distance_meters(
            dest.geo.latitude,
            dest.geo.longitude,
            attraction.geo.latitude,
            attraction.geo.longitude,
        )
        if distance_m <= _DESTINATION_ATTRACTION_RADIUS_M:
            scoped.append(attraction)
    return scoped


def _attraction_distance_m(
    dest: DestinationRecord, attraction: AttractionRecord
) -> float | None:
    if dest.geo is None or attraction.geo is None:
        return None
    return _distance_meters(
        dest.geo.latitude,
        dest.geo.longitude,
        attraction.geo.latitude,
        attraction.geo.longitude,
    )


def _scope_offers_to_destination(
    dest: DestinationRecord,
    offers: list[OfferRecord],
) -> list[OfferRecord]:
    """Keep offers that plausibly belong to the destination.

    ``list_offers`` is query-only, so results matched the destination name but may be
    geographically far. Offers carrying the destination's ``area_id`` are always kept;
    offers with coordinates are kept only within the radius; offers with neither signal
    are kept since they cannot be filtered (mirrors the attraction scoper's leniency).
    """
    scoped: list[OfferRecord] = []
    for offer in offers:
        if offer.area_id and offer.area_id == dest.id:
            scoped.append(offer)
            continue
        if dest.geo is None or offer.geo is None:
            scoped.append(offer)
            continue
        distance_m = _distance_meters(
            dest.geo.latitude,
            dest.geo.longitude,
            offer.geo.latitude,
            offer.geo.longitude,
        )
        if distance_m <= _DESTINATION_OFFER_RADIUS_M:
            scoped.append(offer)
    return scoped


def _offer_distance_m(dest: DestinationRecord, offer: OfferRecord) -> float | None:
    if dest.geo is None or offer.geo is None:
        return None
    return _distance_meters(
        dest.geo.latitude,
        dest.geo.longitude,
        offer.geo.latitude,
        offer.geo.longitude,
    )


def _offer_description(offer: OfferRecord) -> str | None:
    """Compose a short offer blurb, leading with the offer type when available."""
    body = offer.abstract or offer.description
    cleaned = _clean_description(body)
    offer_type = (offer.offer_type or "").strip()
    if offer_type and cleaned:
        return _clean_description(f"{offer_type} · {cleaned}")
    return cleaned or (offer_type or None)


async def _collect_destination_items(
    client: SwissTourismClient,
    dest: DestinationRecord,
    styles: list[str],
    facet_filters: list[str],
    season_filter: str | None = None,
) -> list[RecommendationItem]:
    # Attractions and offers are independent upstream calls — fetch them together.
    (attraction_records, signals_by_id), offer_items = await asyncio.gather(
        _list_matching_attractions(client, dest, facet_filters, season_filter),
        _collect_offer_items(client, dest, styles),
    )

    items: list[RecommendationItem] = []
    fallback_image_url = dest.images[0].url if dest.images else None
    for attr in attraction_records:
        distance_m = _attraction_distance_m(dest, attr)
        signals = signals_by_id.get(attr.id, AttractionMatchSignals())
        text_score = _score_text(attr.name, attr.description, attr.category, styles)
        base_score = _quiz_blended_score(text_score, signals)
        score = _proximity_blended_score(base_score, distance_m)
        items.append(
            RecommendationItem(
                id=attr.id,
                name=attr.name,
                category=attr.category or "attraction",
                url=attr.url,
                score=score,
                distance_m=distance_m,
                latitude=attr.geo.latitude if attr.geo else None,
                longitude=attr.geo.longitude if attr.geo else None,
                image_url=attr.images[0].url if attr.images else fallback_image_url,
                description=_clean_description(attr.description),
            )
        )

    items.extend(offer_items)
    items = _dedupe_items(sorted(items, key=lambda item: item.score, reverse=True))

    if not items:
        items = [
            RecommendationItem(
                id=f"explore-{dest.id}",
                name=f"Explore {dest.name}",
                category="sightseeing",
                url=dest.url,
                score=0.7,
                latitude=dest.geo.latitude if dest.geo else None,
                longitude=dest.geo.longitude if dest.geo else None,
                image_url=fallback_image_url,
                description=_clean_description(dest.description),
            )
        ]

    return items


def _dedupe_items(items: list[RecommendationItem]) -> list[RecommendationItem]:
    """Drop pool duplicates, keeping the first (highest-scoring) occurrence.

    Dedupes by candidate id, then by normalized name so an offer that mirrors an
    attraction (or vice versa) doesn't occupy two slots in the same day.
    """
    seen_ids: set[str] = set()
    seen_names: set[str] = set()
    deduped: list[RecommendationItem] = []
    for item in items:
        name_key = _normalized_name(item.name)
        if item.id in seen_ids or name_key in seen_names:
            continue
        seen_ids.add(item.id)
        seen_names.add(name_key)
        deduped.append(item)
    return deduped


async def _collect_offer_items(
    client: SwissTourismClient,
    dest: DestinationRecord,
    styles: list[str],
) -> list[RecommendationItem]:
    """Fetch destination offers and convert them into scored recommendation items.

    Offers are searched by destination name (the only filter ``list_offers`` supports)
    and paginated up to a page budget so most in-radius offers join the pool, then
    scoped by proximity. A failed fetch degrades gracefully to no offers rather than
    breaking the whole recommendation.
    """
    fetched: list[OfferRecord] = []
    try:
        for page in range(1, _MAX_OFFER_FETCH_PAGES + 1):
            result = await client.list_offers(
                query=dest.name, page=page, page_size=_OFFER_FETCH_PAGE_SIZE
            )
            fetched.extend(result.data)
            if result.meta.total_pages <= page:
                break
    except Exception:
        logger.warning(
            "Failed to fetch Swiss Tourism offers for %s",
            dest.name,
            exc_info=True,
        )
        return []

    offers = _scope_offers_to_destination(dest, fetched)
    fallback_image_url = dest.images[0].url if dest.images else None
    items: list[RecommendationItem] = []
    for offer in offers:
        if not offer.name:
            continue
        distance_m = _offer_distance_m(dest, offer)
        text_score = _score_text(
            offer.name,
            offer.abstract or offer.description,
            offer.offer_type or "",
            styles,
        )
        score = _proximity_blended_score(text_score, distance_m)
        items.append(
            RecommendationItem(
                id=_offer_candidate_id(offer),
                name=offer.name,
                category="offer",
                url=offer.booking_url or offer.info_url,
                score=score,
                distance_m=distance_m,
                latitude=offer.geo.latitude if offer.geo else None,
                longitude=offer.geo.longitude if offer.geo else None,
                image_url=offer.images[0].url if offer.images else fallback_image_url,
                description=_offer_description(offer),
            )
        )
    return items


async def _list_matching_attractions(
    client: SwissTourismClient,
    dest: DestinationRecord,
    facet_filters: list[str],
    season_filter: str | None = None,
) -> tuple[list[AttractionRecord], dict[str, AttractionMatchSignals]]:
    """Fetch broad destination candidates and use facets only as ranking signals.

    The unfiltered destination query is the primary candidate pool, so sparse or
    overly narrow style/season facets do not starve the itinerary. Facet-filtered
    queries are still issued as soft signals: matching attractions get score boosts,
    and facet-only hits can supplement the pool when the broad query misses them.
    """
    geo_filters = (
        {
            "latitude": dest.geo.latitude,
            "longitude": dest.geo.longitude,
            "radius_m": _DESTINATION_ATTRACTION_RADIUS_M,
        }
        if dest.geo is not None
        else {}
    )

    async def _fetch_page(
        facet_filter: str | None,
        *,
        page: int = 1,
        page_size: int = _ATTRACTION_FETCH_PAGE_SIZE,
    ) -> tuple[list[AttractionRecord], int]:
        try:
            result = await client.list_attractions(
                destination_id=dest.id,
                facet_filter=facet_filter,
                **geo_filters,
                page=page,
                page_size=page_size,
            )
        except Exception:
            logger.warning(
                "Failed to fetch Swiss Tourism attractions with facet filter %s",
                facet_filter,
                exc_info=True,
            )
            return [], 0
        return _scope_attractions_to_destination(
            dest, result.data
        ), result.meta.total_pages

    async def _fetch_broad_candidates() -> list[AttractionRecord]:
        candidates: list[AttractionRecord] = []
        for page in range(1, _MAX_ATTRACTION_FETCH_PAGES + 1):
            attractions, total_pages = await _fetch_page(None, page=page)
            candidates.extend(attractions)
            if total_pages <= page:
                break
        return candidates

    def _add_attractions(
        by_id: dict[str, AttractionRecord], attractions: list[AttractionRecord]
    ) -> None:
        for attraction in attractions:
            if not attraction.id or attraction.id in by_id:
                continue
            by_id[attraction.id] = attraction

    candidates_by_id: dict[str, AttractionRecord] = {}
    signals_by_id: dict[str, AttractionMatchSignals] = {}
    broad_candidates = await _fetch_broad_candidates()
    _add_attractions(candidates_by_id, broad_candidates)

    signal_filters = [*facet_filters]
    if season_filter:
        signal_filters.append(season_filter)

    if signal_filters:
        signal_results = await asyncio.gather(
            *[
                _fetch_page(facet_filter, page_size=20)
                for facet_filter in signal_filters
            ]
        )
        for rank, (attractions, _) in enumerate(signal_results):
            facet_filter = signal_filters[rank]
            _add_attractions(candidates_by_id, attractions)
            for attraction in attractions:
                if not attraction.id:
                    continue
                signals = signals_by_id.setdefault(
                    attraction.id, AttractionMatchSignals()
                )
                if facet_filter == season_filter:
                    signals.season_match = True
                    continue
                if signals.facet_rank is None or rank < signals.facet_rank:
                    signals.facet_rank = rank

    logger.debug(
        "Attraction candidates for %s: broad=%s total=%s facet_signals=%s season_signals=%s",
        dest.id,
        len(broad_candidates),
        len(candidates_by_id),
        sum(1 for signals in signals_by_id.values() if signals.facet_rank is not None),
        sum(1 for signals in signals_by_id.values() if signals.season_match),
    )
    return list(candidates_by_id.values()), signals_by_id


async def _pick_destinations(
    client: SwissTourismClient,
    destination: str | None,
    styles: list[str],
) -> list[DestinationRecord]:
    destination_query = destination.strip() if destination else ""
    if not destination_query:
        destination_query = random.choice(_SURPRISE_SWISS_DESTINATIONS)

    dest_result = await client.list_destinations(
        query=destination_query, page=1, page_size=6
    )
    destinations = dest_result.data

    if not destinations and destination_query in _SURPRISE_SWISS_DESTINATIONS:
        dest_result = await client.list_destinations(query=None, page=1, page_size=6)
        destinations = dest_result.data

    if not destinations:
        return []

    def _dest_score(dest: DestinationRecord) -> float:
        return _score_text(dest.name, dest.description, dest.category or "", styles)

    return sorted(
        destinations,
        key=lambda dest: (
            _destination_query_score(dest, destination_query),
            _dest_score(dest),
        ),
        reverse=True,
    )[:1]


def _destination_query_score(dest: DestinationRecord, query: str) -> int:
    normalized_query = query.lower().strip()
    normalized_name = dest.name.lower().strip()
    if normalized_name == normalized_query:
        return 100
    if normalized_name in normalized_query:
        return 90
    if normalized_name.startswith(normalized_query):
        return 80
    if normalized_query in normalized_name:
        return 70

    query_words = _tokens(normalized_query)
    name_words = _tokens(normalized_name)
    if query_words and query_words.issubset(name_words):
        return 60
    return 0
