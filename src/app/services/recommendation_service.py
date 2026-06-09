from __future__ import annotations

import asyncio
import logging
import math
import random
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Literal

from app.ports.swiss_tourism import (
    AttractionRecord,
    DestinationRecord,
    FacetRecord,
    FacetSnapshotRecord,
    FacetValueRecord,
    OfferRecord,
    SwissTourismClient,
)
from app.ports.transport import (
    PublicTransportClient,
    TransportItinerary,
    TransportLeg,
    TransportPlace,
)
from app.services.recommendation_facets import get_attraction_facets_snapshot

_STYLE_KEYWORDS: dict[str, list[str]] = {
    "adventure": [
        "hiking",
        "hike",
        "ski",
        "skiing",
        "climbing",
        "outdoor",
        "sport",
        "bike",
        "mountain",
        "adventure",
        "trail",
        "trekking",
        "rafting",
        "paragliding",
    ],
    "cultural": [
        "museum",
        "history",
        "historic",
        "heritage",
        "art",
        "castle",
        "cathedral",
        "architecture",
        "culture",
        "gallery",
        "monument",
        "old town",
        "roman",
        "medieval",
    ],
    "relaxation": [
        "spa",
        "wellness",
        "lake",
        "nature",
        "thermal",
        "calm",
        "relax",
        "garden",
        "scenic",
        "panorama",
        "viewpoint",
        "peaceful",
    ],
    "foodie": [
        "restaurant",
        "wine",
        "cheese",
        "food",
        "culinary",
        "gourmet",
        "taste",
        "market",
        "chocolate",
        "fondue",
        "brewery",
    ],
    "family": [
        "family",
        "children",
        "kids",
        "zoo",
        "park",
        "playground",
        "aquarium",
        "theme",
        "fun",
    ],
}

_MOOD_TO_STYLES: dict[str, list[str]] = {
    "culture_history": ["cultural"],
    "nature_outdoors": ["adventure", "relaxation"],
    "food_markets": ["foodie", "cultural"],
    "slow_relaxing": ["relaxation"],
}

_GROUP_TO_STYLES: dict[str, list[str]] = {
    "solo": [],
    "couple": ["relaxation", "cultural"],
    "family": ["family", "relaxation"],
    "friends": ["adventure", "foodie"],
}

_STYLE_FACET_TERMS: dict[str, list[str]] = {
    "adventure": [
        "adventure",
        "active",
        "outdoor",
        "nature",
        "mountain",
        "hiking",
        "hike",
        "trail",
        "climbing",
        "ski",
        "snow",
        "sport",
        "bike",
        "cycling",
    ],
    "cultural": [
        "culture",
        "cultural",
        "museum",
        "history",
        "historic",
        "heritage",
        "art",
        "architecture",
        "castle",
        "monument",
        "old town",
        "sightseeing",
    ],
    "relaxation": [
        "relax",
        "relaxation",
        "wellness",
        "spa",
        "thermal",
        "nature",
        "lake",
        "water",
        "scenic",
        "panorama",
        "viewpoint",
        "garden",
        "park",
    ],
    "foodie": [
        "food",
        "culinary",
        "gastronomy",
        "restaurant",
        "wine",
        "cheese",
        "chocolate",
        "market",
        "taste",
        "gourmet",
    ],
    "family": [
        "family",
        "children",
        "child",
        "kids",
        "kid",
        "zoo",
        "animal",
        "playground",
        "theme park",
        "park",
        "fun",
    ],
}

_TRIP_LENGTH_SLOTS: dict[str, list[str]] = {
    "2_3_hours": ["10:00", "12:00"],
    "half_day": ["09:30", "12:30", "15:30"],
    "full_day": ["09:00", "11:30", "14:00", "16:30"],
}

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

_TRANSPORT_LABELS: dict[str, tuple[str, str]] = {
    "car": ("Drive to next stop", "Approx. 25 min by car"),
    "public_transport": (
        "Train or regional connection",
        "Approx. 35 min on public transport",
    ),
}

# Estimated trip-total ranges in CHF, keyed by budget tier and itinerary length.
# The total shown to the user is a (seeded) random pick within the matching range,
# so it depends only on the budget choice and trip length — not on per-item pricing.
_ESTIMATED_TOTAL_RANGES: dict[str, dict[str, tuple[float, float]]] = {
    "budget": {
        "2_3_hours": (70.0, 120.0),
        "half_day": (110.0, 190.0),
        "full_day": (170.0, 280.0),
    },
    "mid": {
        "2_3_hours": (130.0, 210.0),
        "half_day": (210.0, 330.0),
        "full_day": (320.0, 480.0),
    },
    "luxury": {
        "2_3_hours": (260.0, 400.0),
        "half_day": (430.0, 650.0),
        "full_day": (650.0, 950.0),
    },
}

logger = logging.getLogger(__name__)
_PUBLIC_TRANSPORT_ROUTE_TIMEOUT_SECONDS = 8.0
_MAX_PUBLIC_TRANSPORT_LEGS = 20
_CAR_ROUTE_DISTANCE_MULTIPLIER = 1.3
_CAR_AVERAGE_SPEED_KMH = 35.0
_CAR_MIN_DURATION_MINUTES = 5
_CAR_DURATION_ROUNDING_MINUTES = 5
_TRANSPORT_MIN_ACTIVITY_VISIT_MINUTES = 45
_TRANSPORT_MAX_ACTIVITY_VISIT_MINUTES = 120
_TRANSPORT_NEXT_ACTIVITY_BUFFER_MINUTES = 45
_MAX_ATTRACTION_FACET_FILTERS = 3
_DESTINATION_ATTRACTION_RADIUS_M = 30_000
_DESTINATION_OFFER_RADIUS_M = _DESTINATION_ATTRACTION_RADIUS_M
_ATTRACTION_FETCH_PAGE_SIZE = 50
_MAX_ATTRACTION_FETCH_PAGES = 3
_OFFER_FETCH_PAGE_SIZE = 30
_ATTRACTION_TEXT_SCORE_WEIGHT = 0.55
_ATTRACTION_PROXIMITY_SCORE_WEIGHT = 0.45
_WORD_RE = re.compile(r"[a-z0-9]+")
_DESCRIPTION_MAX_CHARS = 220

# Varied free-time copy so unfilled slots don't all read "Free exploration".
_FREE_TIME_LABELS: list[str] = [
    "Free exploration",
    "Wander {destination}",
    "Local discovery time",
    "Cafe stop and people-watching",
]


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


@dataclass
class AttractionMatchSignals:
    facet_rank: int | None = None
    season_match: bool = False


def _clean_description(text: str | None) -> str | None:
    if not text:
        return None
    collapsed = " ".join(text.split())
    if not collapsed:
        return None
    if len(collapsed) <= _DESCRIPTION_MAX_CHARS:
        return collapsed
    truncated = collapsed[:_DESCRIPTION_MAX_CHARS].rsplit(" ", 1)[0].rstrip(",.;:")
    return f"{truncated}…"


def _score_text(name: str, description: str, category: str, styles: list[str]) -> float:
    if not styles:
        return 0.5

    text = f"{name} {description} {category}".lower()
    total_possible = 0
    total_matched = 0

    for style in styles:
        keywords = _STYLE_KEYWORDS.get(style, [])
        total_possible += len(keywords)
        total_matched += sum(1 for kw in keywords if kw in text)

    if total_possible == 0:
        return 0.5

    raw = total_matched / total_possible
    return round(0.35 + 0.65 * raw, 3)


def _effective_styles(
    mood: str,
    group_type: str,
) -> list[str]:
    ordered_styles = [
        *_MOOD_TO_STYLES.get(mood, []),
        *_GROUP_TO_STYLES.get(group_type, []),
    ]
    seen: set[str] = set()
    unique_styles: list[str] = []
    for style in ordered_styles:
        if style not in seen:
            seen.add(style)
            unique_styles.append(style)
    return unique_styles


def _tokens(text: str) -> set[str]:
    return set(_WORD_RE.findall(text.lower()))


def _matches_term(text: str, tokens: set[str], term: str) -> bool:
    normalized = term.lower().strip()
    if not normalized:
        return False
    if " " in normalized:
        return normalized in text
    return any(token == normalized or token.startswith(normalized) for token in tokens)


def _facet_value_match_score(
    facet: FacetRecord,
    value: FacetValueRecord,
    styles: list[str],
) -> int:
    value_text = f"{value.name} {value.title or ''}".lower()
    full_text = f"{facet.name} {facet.title or ''} {value_text}".lower()
    value_tokens = _tokens(value_text)
    full_tokens = _tokens(full_text)
    score = 0

    for index, style in enumerate(styles):
        weight = max(len(styles) - index, 1)
        terms = _STYLE_FACET_TERMS.get(style, [style.replace("_", " ")])
        for term in terms:
            if _matches_term(value_text, value_tokens, term):
                score += weight * 2
            elif _matches_term(full_text, full_tokens, term):
                score += weight

    return score


_METEOROLOGICAL_SEASONS: dict[int, str] = {
    12: "winter",
    1: "winter",
    2: "winter",
    3: "spring",
    4: "spring",
    5: "spring",
    6: "summer",
    7: "summer",
    8: "summer",
    9: "autumn",
    10: "autumn",
    11: "autumn",
}


def _season_for_date(value: date) -> str:
    return _METEOROLOGICAL_SEASONS[value.month]


def _season_facet_filter(value: date) -> str | None:
    """Resolve the ``seasons`` facet filter for the trip's season, if available.

    Returns a ``"<facet>:<value>"`` filter only when the live facet snapshot actually
    exposes a season facet with a matching value, so we never guess a facet/value name
    the API doesn't recognise. Returns None otherwise (no season constraint applied).
    """
    snapshot = get_attraction_facets_snapshot()
    if snapshot is None:
        return None

    season = _season_for_date(value)
    for facet in snapshot.facets:
        if "season" not in f"{facet.name} {facet.title or ''}".lower():
            continue
        for facet_value in facet.values:
            label = f"{facet_value.name} {facet_value.title or ''}".lower()
            if season in label:
                return f"{facet.name}:{facet_value.name}"
    return None


def _ranked_filters_for_style(snapshot: FacetSnapshotRecord, style: str) -> list[str]:
    candidates: list[tuple[int, int, str]] = []
    for facet in snapshot.facets:
        for value in facet.values:
            if value.count <= 0:
                continue
            score = _facet_value_match_score(facet, value, [style])
            if score <= 0:
                continue
            candidates.append((score, value.count, f"{facet.name}:{value.name}"))

    candidates.sort(key=lambda candidate: (candidate[0], candidate[1]), reverse=True)
    return [facet_filter for _, _, facet_filter in candidates]


def _facet_filters_for_styles(styles: list[str]) -> list[str]:
    snapshot = get_attraction_facets_snapshot()
    if snapshot is None or not styles:
        return []

    # Rank facet values per individual style, then round-robin across styles so the
    # chosen filters span different experience types (nature + culture + food) instead
    # of clustering on one. Filters earlier in the list are the higher-priority picks.
    ranked_by_style = [_ranked_filters_for_style(snapshot, style) for style in styles]

    filters: list[str] = []
    seen: set[str] = set()
    max_depth = max((len(ranked) for ranked in ranked_by_style), default=0)
    for depth in range(max_depth):
        for ranked in ranked_by_style:
            if depth >= len(ranked):
                continue
            facet_filter = ranked[depth]
            if facet_filter in seen:
                continue
            seen.add(facet_filter)
            filters.append(facet_filter)
            if len(filters) >= _MAX_ATTRACTION_FACET_FILTERS:
                return filters
    return filters


def _distance_meters(
    origin_latitude: float,
    origin_longitude: float,
    target_latitude: float,
    target_longitude: float,
) -> float:
    earth_radius_m = 6_371_000
    origin_lat = math.radians(origin_latitude)
    target_lat = math.radians(target_latitude)
    delta_lat = math.radians(target_latitude - origin_latitude)
    delta_lon = math.radians(target_longitude - origin_longitude)

    haversine = (
        math.sin(delta_lat / 2) ** 2
        + math.cos(origin_lat) * math.cos(target_lat) * math.sin(delta_lon / 2) ** 2
    )
    return (
        earth_radius_m * 2 * math.atan2(math.sqrt(haversine), math.sqrt(1 - haversine))
    )


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


def _proximity_blended_score(base_score: float, distance_m: float | None) -> float:
    if distance_m is None:
        return base_score

    proximity_score = 1.0 - min(distance_m / _DESTINATION_ATTRACTION_RADIUS_M, 1.0)
    return round(
        base_score * _ATTRACTION_TEXT_SCORE_WEIGHT
        + proximity_score * _ATTRACTION_PROXIMITY_SCORE_WEIGHT,
        3,
    )


def _estimated_total(budget_tier: str, trip_length: str, *seed_parts: object) -> float:
    """A single trip-total estimate driven only by budget tier and trip length.

    Picks a (seeded) value within the matching range so the same itinerary stays
    stable across refreshes while different destinations vary.
    """
    by_length = _ESTIMATED_TOTAL_RANGES.get(budget_tier, _ESTIMATED_TOTAL_RANGES["mid"])
    low, high = by_length.get(trip_length, by_length["half_day"])
    seed = "|".join(
        str(part) for part in ("estimate", budget_tier, trip_length, *seed_parts)
    )
    value = random.Random(seed).uniform(low, high)
    return float(round(value / 5) * 5)


def _car_route_estimate(activity: dict, next_activity: dict) -> tuple[str, str]:
    origin_latitude = activity.get("_latitude")
    origin_longitude = activity.get("_longitude")
    target_latitude = next_activity.get("_latitude")
    target_longitude = next_activity.get("_longitude")
    if (
        origin_latitude is None
        or origin_longitude is None
        or target_latitude is None
        or target_longitude is None
    ):
        return _TRANSPORT_LABELS["car"][
            1
        ], "Estimated car route unavailable without stop coordinates."

    direct_distance_km = (
        _distance_meters(
            origin_latitude,
            origin_longitude,
            target_latitude,
            target_longitude,
        )
        / 1000
    )
    route_distance_km = direct_distance_km * _CAR_ROUTE_DISTANCE_MULTIPLIER
    raw_minutes = route_distance_km / _CAR_AVERAGE_SPEED_KMH * 60
    rounded_minutes = max(
        _CAR_MIN_DURATION_MINUTES,
        math.ceil(raw_minutes / _CAR_DURATION_ROUNDING_MINUTES)
        * _CAR_DURATION_ROUNDING_MINUTES,
    )
    return (
        f"Approx. {rounded_minutes} min by car",
        f"Estimated from about {route_distance_km:.1f} km between stops.",
    )


def _time_to_minutes(value: str) -> int | None:
    match = re.fullmatch(r"(\d{1,2}):(\d{2})", value.strip())
    if match is None:
        return None

    hours = int(match.group(1))
    minutes = int(match.group(2))
    if hours > 23 or minutes > 59:
        return None
    return hours * 60 + minutes


def _minutes_to_time(value: int) -> str:
    minutes_in_day = 24 * 60
    normalized = value % minutes_in_day
    return f"{normalized // 60:02d}:{normalized % 60:02d}"


def _transport_departure_time(activity_time: str, next_activity_time: str) -> str:
    activity_minutes = _time_to_minutes(activity_time)
    next_activity_minutes = _time_to_minutes(next_activity_time)
    if activity_minutes is None:
        return activity_time
    if next_activity_minutes is None or next_activity_minutes <= activity_minutes:
        return _minutes_to_time(
            activity_minutes + _TRANSPORT_MIN_ACTIVITY_VISIT_MINUTES
        )

    gap_minutes = next_activity_minutes - activity_minutes
    if gap_minutes <= _TRANSPORT_MIN_ACTIVITY_VISIT_MINUTES:
        visit_minutes = max(1, gap_minutes // 2)
    else:
        visit_minutes = max(
            _TRANSPORT_MIN_ACTIVITY_VISIT_MINUTES,
            gap_minutes - _TRANSPORT_NEXT_ACTIVITY_BUFFER_MINUTES,
        )
        visit_minutes = min(visit_minutes, _TRANSPORT_MAX_ACTIVITY_VISIT_MINUTES)

    return _minutes_to_time(activity_minutes + visit_minutes)


def _build_day_timeline(
    day_num: int,
    activity_entries: list[dict],
    transport_mode: str,
    travelers: int,
) -> list[dict]:
    transport_title, transport_note = _TRANSPORT_LABELS[transport_mode]
    timeline_items: list[dict] = []

    for index, activity in enumerate(activity_entries):
        activity_id = activity.get("id") or f"activity-{day_num}-{index}"
        timeline_items.append(
            {
                "id": activity_id,
                "kind": "activity",
                "time": activity["time"],
                "title": activity["title"],
                "category": activity["category"],
                "url": activity.get("url"),
                "image_url": activity.get("image_url"),
                "description": activity.get("description"),
                "refreshable": True,
            }
        )

        if index == len(activity_entries) - 1:
            continue

        next_activity = activity_entries[index + 1]
        duration_text = transport_note
        notes = None
        transport_time = _transport_departure_time(
            activity["time"], next_activity["time"]
        )
        if transport_mode == "car":
            duration_text, notes = _car_route_estimate(activity, next_activity)
        timeline_items.append(
            {
                "id": f"transport-{day_num}-{index}",
                "kind": "transport",
                "time": transport_time,
                "title": transport_title,
                "category": "transport",
                "duration_text": duration_text,
                "transport_mode": transport_mode,
                "notes": notes,
                "refreshable": False,
            }
        )

    return timeline_items


def _transport_place(activity: dict) -> TransportPlace:
    return TransportPlace(
        name=activity["title"],
        latitude=activity.get("_latitude"),
        longitude=activity.get("_longitude"),
    )


def _has_transport_coordinates(activity: dict) -> bool:
    return (
        activity.get("_latitude") is not None and activity.get("_longitude") is not None
    )


def _format_route_note_time(value: str | None) -> str | None:
    if not value:
        return None

    normalized = value.strip()
    try:
        parsed = datetime.fromisoformat(normalized.replace("Z", "+00:00"))
    except ValueError:
        time_match = re.fullmatch(r"(\d{1,2}):(\d{2})(?::\d{2})?", normalized)
        if time_match is None:
            return normalized
        return f"{int(time_match.group(1)):02d}:{time_match.group(2)}"
    return parsed.strftime("%H:%M")


def _summarize_transport_route(route: TransportItinerary) -> tuple[str, str, str]:
    public_legs = [leg for leg in route.legs if leg.mode != "walk"]
    named_legs = [leg for leg in public_legs if leg.line]
    if named_legs:
        title = ", then ".join(f"{leg.mode} {leg.line}" for leg in named_legs[:2])
        if len(named_legs) > 2:
            title += f", +{len(named_legs) - 2} more"
    elif public_legs:
        title = "Public transport connection"
    else:
        title = "Walk to next stop"

    duration_text = "Live public transport route"
    if route.duration_minutes is not None:
        transfer_label = "transfer" if route.transfers == 1 else "transfers"
        duration_text = (
            f"{route.duration_minutes} min, {route.transfers or 0} {transfer_label}"
        )

    first_departure = next(
        (leg.departure_time for leg in route.legs if leg.departure_time), None
    )
    last_arrival = next(
        (leg.arrival_time for leg in reversed(route.legs) if leg.arrival_time), None
    )
    origin = route.legs[0].origin
    destination = route.legs[-1].destination
    notes_parts = []
    if first_departure:
        notes_parts.append(f"Depart {_format_route_note_time(first_departure)}")
    if origin:
        notes_parts.append(f"from {origin}")
    if last_arrival:
        notes_parts.append(f"arrive {_format_route_note_time(last_arrival)}")
    if destination:
        notes_parts.append(f"at {destination}")
    notes = " ".join(notes_parts) or "Live route from OpenTransportData Swiss."
    return title, duration_text, notes


def _transport_leg_details(route: TransportItinerary) -> list[dict]:
    legs = _important_transport_legs(route.legs)
    return [
        {
            "mode": leg.mode,
            "line": leg.line,
            "departure_time": leg.departure_time,
            "arrival_time": leg.arrival_time,
            "duration_minutes": leg.duration_minutes,
            "origin": leg.origin,
            "destination": leg.destination,
            "direction": leg.direction,
            "notes": leg.notes,
        }
        for leg in legs
    ]


def _important_transport_legs(legs: list[TransportLeg]) -> list[TransportLeg]:
    """Return user-facing route legs: transit legs plus only edge walks."""
    if not legs:
        return []

    edge_walk_indices: list[int] = []
    if legs[0].mode == "walk":
        edge_walk_indices.append(0)
    if len(legs) > 1 and legs[-1].mode == "walk":
        edge_walk_indices.append(len(legs) - 1)

    public_indices = [index for index, leg in enumerate(legs) if leg.mode != "walk"]
    important_indices = sorted({*edge_walk_indices, *public_indices})
    if len(important_indices) <= _MAX_PUBLIC_TRANSPORT_LEGS:
        return [legs[index] for index in important_indices]

    edge_walk_set = set(edge_walk_indices)
    public_slots = _MAX_PUBLIC_TRANSPORT_LEGS - len(edge_walk_set)
    capped_indices = sorted({*edge_walk_set, *public_indices[:public_slots]})
    return [legs[index] for index in capped_indices]


async def _enrich_public_transport_timeline(
    days: list[dict],
    transport_client: PublicTransportClient,
    travelers: int,
) -> None:
    async def _route_for_pair(
        day: dict, index: int, activity: dict, next_activity: dict
    ):
        if not _has_transport_coordinates(activity) or not _has_transport_coordinates(
            next_activity
        ):
            logger.info(
                "Skipping public transport route without coordinates from %s to %s",
                activity.get("title"),
                next_activity.get("title"),
            )
            return None

        try:
            return await asyncio.wait_for(
                transport_client.plan_route(
                    origin=_transport_place(activity),
                    destination=_transport_place(next_activity),
                    departure_date=date.fromisoformat(day["date"]),
                    departure_time=_transport_departure_time(
                        activity["time"], next_activity["time"]
                    ),
                    travelers=travelers,
                ),
                timeout=_PUBLIC_TRANSPORT_ROUTE_TIMEOUT_SECONDS,
            )
        except Exception:
            logger.exception(
                "Failed to enrich public transport route from %s to %s",
                activity.get("title"),
                next_activity.get("title"),
            )
            return None

    for day in days:
        activities = day.get("activities", [])
        if len(activities) < 2:
            continue

        routes = await asyncio.gather(
            *[
                _route_for_pair(day, index, activities[index], activities[index + 1])
                for index in range(len(activities) - 1)
            ]
        )
        route_by_transport_id = {
            f"transport-{day.get('day', 1)}-{index}": route
            for index, route in enumerate(routes)
            if route is not None
        }

        for timeline_item in day.get("timeline_items", []):
            route = route_by_transport_id.get(timeline_item.get("id"))
            if route is None:
                continue
            title, duration_text, notes = _summarize_transport_route(route)
            timeline_item["title"] = title
            timeline_item["duration_text"] = duration_text
            timeline_item["notes"] = notes
            timeline_item["transport_legs"] = _transport_leg_details(route)


def _remove_internal_activity_fields(days: list[dict]) -> None:
    for day in days:
        for activity in day.get("activities", []):
            activity.pop("_latitude", None)
            activity.pop("_longitude", None)


def _interleave_by_category(
    items: list[RecommendationItem],
) -> list[RecommendationItem]:
    """Order unique items by score while avoiding back-to-back same-category stops.

    Items are bucketed by category; each step picks the highest-scoring head from a
    bucket whose category differs from the previous pick (falling back to any bucket
    when all that remain share the last category). No item is repeated.
    """
    buckets: dict[str, list[RecommendationItem]] = {}
    for item in sorted(items, key=lambda i: i.score, reverse=True):
        buckets.setdefault(item.category or "activity", []).append(item)

    bucket_list = list(buckets.values())
    arranged: list[RecommendationItem] = []
    last_category: str | None = None
    while any(bucket_list):
        available = [bucket for bucket in bucket_list if bucket]
        preferred = [
            bucket
            for bucket in available
            if (bucket[0].category or "activity") != last_category
        ]
        chosen = max(preferred or available, key=lambda bucket: bucket[0].score)
        item = chosen.pop(0)
        arranged.append(item)
        last_category = item.category or "activity"
    return arranged


def _day_theme(activities: list[dict]) -> str | None:
    counts: dict[str, int] = {}
    for activity in activities:
        category = activity.get("category")
        if not category or category in {"leisure", "transport"}:
            continue
        counts[category] = counts.get(category, 0) + 1
    if not counts:
        return None
    dominant = max(counts, key=lambda category: counts[category])
    return dominant.replace("_", " ").capitalize()


def _build_itinerary(
    items: list[RecommendationItem],
    start_date: date,
    end_date: date,
    budget_tier: str,
    trip_length: str,
    group_type: str,
    transport_mode: str,
    travelers: int,
    destination_name: str = "the area",
) -> tuple[list[dict], float]:
    num_days = 1
    times = _TRIP_LENGTH_SLOTS.get(trip_length, _TRIP_LENGTH_SLOTS["half_day"])

    needed = num_days * len(times)
    # No repeats: take as many unique, category-interleaved items as there are slots.
    sequence = _interleave_by_category(items)[:needed]

    days: list[dict] = []
    idx = 0
    fallback_idx = 0

    for day_num in range(num_days):
        current = start_date + timedelta(days=day_num)
        activities: list[dict] = []

        for slot_index, time in enumerate(times):
            description = None
            if idx < len(sequence):
                item = sequence[idx]
                idx += 1
                name, category, url = item.name, item.category, item.url
                latitude, longitude = item.latitude, item.longitude
                image_url = item.image_url
                description = item.description
            else:
                label = _FREE_TIME_LABELS[fallback_idx % len(_FREE_TIME_LABELS)]
                fallback_idx += 1
                name = label.format(destination=destination_name)
                category, url = "leisure", ""
                latitude, longitude = None, None
                image_url = None

            activities.append(
                {
                    "id": f"activity-{day_num + 1}-{slot_index}",
                    "time": time,
                    "title": name,
                    "category": category or "activity",
                    "url": url or None,
                    "image_url": image_url,
                    "description": description,
                    "_latitude": latitude,
                    "_longitude": longitude,
                }
            )

        timeline_items = _build_day_timeline(
            day_num + 1, activities, transport_mode, travelers
        )
        days.append(
            {
                "day": day_num + 1,
                "date": current.isoformat(),
                "theme": _day_theme(activities),
                "activities": activities,
                "timeline_items": timeline_items,
            }
        )

    estimated_total = _estimated_total(budget_tier, trip_length, destination_name)

    return days, estimated_total


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

    if not items:
        items = [
            RecommendationItem(
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


async def _collect_offer_items(
    client: SwissTourismClient,
    dest: DestinationRecord,
    styles: list[str],
) -> list[RecommendationItem]:
    """Fetch destination offers and convert them into scored recommendation items.

    Offers are searched by destination name (the only filter ``list_offers`` supports),
    scoped by proximity, and given the stable ``"offer"`` category so they interleave with
    attractions. A failed fetch degrades gracefully to no offers rather than breaking the
    whole recommendation.
    """
    try:
        result = await client.list_offers(
            query=dest.name, page=1, page_size=_OFFER_FETCH_PAGE_SIZE
        )
    except Exception:
        logger.warning(
            "Failed to fetch Swiss Tourism offers for %s",
            dest.name,
            exc_info=True,
        )
        return []

    offers = _scope_offers_to_destination(dest, result.data)
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


def _quiz_blended_score(text_score: float, signals: AttractionMatchSignals) -> float:
    score = _facet_blended_score(text_score, signals.facet_rank)
    if signals.season_match:
        score = min(1.0, score + 0.04)
    return round(score, 3)


def _facet_blended_score(text_score: float, facet_rank: int | None) -> float:
    """Blend the keyword text score with the facet match priority.

    Facet-matched attractions sit in a high score band (floor ~0.84) so they rank
    above generic keyword matches, but higher-priority facets (rank 0) score above
    lower-priority ones, and the text score breaks ties within a band — so ordering
    stays meaningful instead of every facet hit collapsing onto a single value.
    """
    if facet_rank is None:
        return text_score
    rank_weight = max(_MAX_ATTRACTION_FACET_FILTERS - facet_rank, 1)
    return round(min(1.0, 0.78 + 0.04 * rank_weight + 0.08 * text_score), 3)


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


async def recommend(
    client: SwissTourismClient,
    destination: str | None,
    start_date: date,
    end_date: date,
    travelers: int = 1,
    mood: Literal[
        "culture_history",
        "nature_outdoors",
        "food_markets",
        "slow_relaxing",
    ] = "culture_history",
    transport_mode: Literal["car", "public_transport"] = "public_transport",
    trip_length: Literal["2_3_hours", "half_day", "full_day"] | None = None,
    group_type: Literal["solo", "couple", "family", "friends"] = "solo",
    budget_tier: Literal["budget", "mid", "luxury"] | None = None,
    public_transport_client: PublicTransportClient | None = None,
) -> list[dict]:
    selected_budget_tier: str = budget_tier or "mid"
    styles = _effective_styles(mood, group_type)
    facet_filters = _facet_filters_for_styles(styles)
    season_filter = _season_facet_filter(start_date)
    selected_trip_length = trip_length or "half_day"

    top_dests = await _pick_destinations(client, destination, styles)
    if not top_dests:
        return []

    recommendations: list[dict] = []

    for dest in top_dests:
        items = await _collect_destination_items(
            client, dest, styles, facet_filters, season_filter
        )
        days, estimated_total = _build_itinerary(
            items,
            start_date,
            end_date,
            selected_budget_tier,
            selected_trip_length,
            group_type,
            transport_mode,
            travelers,
            destination_name=dest.name,
        )
        if transport_mode == "public_transport" and public_transport_client is not None:
            await _enrich_public_transport_timeline(
                days, public_transport_client, travelers
            )
        _remove_internal_activity_fields(days)

        top3 = sorted(items, key=lambda item: item.score, reverse=True)[:3]
        highlights = [item.name for item in top3]
        match_score = _score_text(
            dest.name, dest.description, dest.category or "", styles
        )

        recommendations.append(
            {
                "title": f"{dest.name} {selected_trip_length.replace('_', ' ')} plan",
                "destination": dest.name,
                "description": (
                    f"A {selected_trip_length.replace('_', ' ')} itinerary in {dest.name}, tuned for "
                    f"{group_type} travel and {transport_mode.replace('_', ' ')}."
                ),
                "itinerary": {
                    "days": days,
                    "estimated_total": estimated_total,
                    "currency": "CHF",
                },
                "match_score": match_score,
                "highlights": highlights,
            }
        )

    recommendations.sort(key=lambda rec: rec["match_score"], reverse=True)
    return recommendations


def _replace_activity_in_itinerary(
    itinerary: dict,
    item_id: str,
    replacement: RecommendationItem,
    transport_mode: str,
    travelers: int,
) -> dict:
    next_itinerary = {
        **itinerary,
        "days": [dict(day) for day in itinerary.get("days", [])],
    }

    for day in next_itinerary["days"]:
        activities = [dict(activity) for activity in day.get("activities", [])]
        replaced = False
        for activity in activities:
            if activity.get("id") != item_id:
                continue
            activity["title"] = replacement.name
            activity["category"] = replacement.category or "activity"
            activity["url"] = replacement.url or None
            activity["image_url"] = replacement.image_url
            activity["description"] = replacement.description
            activity["_latitude"] = replacement.latitude
            activity["_longitude"] = replacement.longitude
            replaced = True
            break
        if not replaced:
            continue

        day["activities"] = activities
        day["timeline_items"] = _build_day_timeline(
            day.get("day", 1), activities, transport_mode, travelers
        )
        return next_itinerary

    return next_itinerary


async def refresh_recommendation_item(
    client: SwissTourismClient,
    destination: str | None,
    start_date: date,
    end_date: date,
    travelers: int,
    mood: str,
    transport_mode: str,
    trip_length: str | None,
    group_type: str,
    itinerary: dict,
    item_id: str,
    public_transport_client: PublicTransportClient | None = None,
) -> dict:
    styles = _effective_styles(mood, group_type)
    facet_filters = _facet_filters_for_styles(styles)
    season_filter = _season_facet_filter(start_date)
    selected_trip_length = trip_length or "half_day"
    top_dests = await _pick_destinations(client, destination, styles)
    if not top_dests:
        return {
            "title": f"{destination or 'Swiss'} {selected_trip_length.replace('_', ' ')} plan",
            "destination": destination or "Switzerland",
            "description": "Updated itinerary",
            "itinerary": itinerary,
            "match_score": 0.5,
            "highlights": [],
        }

    target_dest = next(
        (dest for dest in top_dests if dest.name == destination), top_dests[0]
    )
    items = await _collect_destination_items(
        client, target_dest, styles, facet_filters, season_filter
    )

    current_titles = {
        activity.get("title")
        for day in itinerary.get("days", [])
        for activity in day.get("activities", [])
    }
    replacement = next(
        (
            item
            for item in sorted(items, key=lambda item: item.score, reverse=True)
            if item.name not in current_titles
        ),
        None,
    )
    if replacement is None and items:
        replacement = sorted(items, key=lambda item: item.score, reverse=True)[0]

    next_itinerary = (
        _replace_activity_in_itinerary(
            itinerary, item_id, replacement, transport_mode, travelers
        )
        if replacement is not None
        else itinerary
    )
    if transport_mode == "public_transport" and public_transport_client is not None:
        await _enrich_public_transport_timeline(
            next_itinerary.get("days", []), public_transport_client, travelers
        )
    _remove_internal_activity_fields(next_itinerary.get("days", []))
    # Estimated total is budget/length-based and already set on the itinerary; a single
    # item swap doesn't change it, so the existing value is preserved as-is.

    top3 = sorted(items, key=lambda item: item.score, reverse=True)[:3]
    return {
        "title": f"{target_dest.name} {selected_trip_length.replace('_', ' ')} plan",
        "destination": target_dest.name,
        "description": (
            f"A {selected_trip_length.replace('_', ' ')} itinerary in {target_dest.name}, tuned for "
            f"{group_type} travel and {transport_mode.replace('_', ' ')}."
        ),
        "itinerary": next_itinerary,
        "match_score": _score_text(
            target_dest.name,
            target_dest.description,
            target_dest.category or "",
            styles,
        ),
        "highlights": [item.name for item in top3],
    }
