from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Literal

from app.ports.swiss_tourism import DestinationRecord, SwissTourismClient
from app.ports.transport import (
    PublicTransportClient,
    TransportItinerary,
    TransportPlace,
)

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

_GROUP_ACTIVITY_COST_MULTIPLIER: dict[str, float] = {
    "solo": 1.0,
    "couple": 0.95,
    "family": 0.85,
    "friends": 1.05,
}

_TRIP_LENGTH_SLOTS: dict[str, list[str]] = {
    "2_3_hours": ["10:00", "12:00"],
    "half_day": ["09:30", "12:30", "15:30"],
    "full_day": ["09:00", "11:30", "14:00", "16:30"],
}

_PACE_TO_TRIP_LENGTH: dict[str, str] = {
    "relaxed": "2_3_hours",
    "moderate": "half_day",
    "packed": "full_day",
}

_TRANSPORT_LABELS: dict[str, tuple[str, str]] = {
    "car": ("Drive to next stop", "Approx. 25 min by car"),
    "public_transport": (
        "Train or regional connection",
        "Approx. 35 min on public transport",
    ),
}

_COSTS: dict[str, dict[str, float]] = {
    "budget": {"activity": 15.0, "meals_per_day": 35.0, "hotel_per_night": 70.0},
    "mid": {"activity": 45.0, "meals_per_day": 70.0, "hotel_per_night": 170.0},
    "luxury": {"activity": 130.0, "meals_per_day": 180.0, "hotel_per_night": 450.0},
}

logger = logging.getLogger(__name__)
_PUBLIC_TRANSPORT_ROUTE_TIMEOUT_SECONDS = 8.0


@dataclass
class RecommendationItem:
    name: str
    category: str
    url: str
    score: float
    latitude: float | None = None
    longitude: float | None = None
    image_url: str | None = None


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
    preferences: dict | None,
    mood: str,
    group_type: str,
) -> list[str]:
    prefs = preferences or {}
    preferred_styles = prefs.get("travel_styles", [])
    ordered_styles = [
        *preferred_styles,
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


def _activity_cost(costs: dict[str, float], group_type: str, travelers: int) -> float:
    multiplier = _GROUP_ACTIVITY_COST_MULTIPLIER.get(group_type, 1.0)
    return round(costs["activity"] * multiplier * max(travelers, 1), 2)


def _transport_cost(transport_mode: str, travelers: int) -> float:
    per_traveler = 18.0 if transport_mode == "car" else 12.0
    return round(per_traveler * max(travelers, 1), 2)


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
                "cost": activity["cost"],
                "url": activity.get("url"),
                "image_url": activity.get("image_url"),
                "refreshable": True,
            }
        )

        if index == len(activity_entries) - 1:
            continue

        timeline_items.append(
            {
                "id": f"transport-{day_num}-{index}",
                "kind": "transport",
                "time": activity["time"],
                "title": transport_title,
                "category": "transport",
                "cost": _transport_cost(transport_mode, travelers),
                "duration_text": transport_note,
                "transport_mode": transport_mode,
                "notes": "Placeholder routing for v1. Live transport data will plug in later.",
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
        notes_parts.append(f"Depart {first_departure}")
    if origin:
        notes_parts.append(f"from {origin}")
    if last_arrival:
        notes_parts.append(f"arrive {last_arrival}")
    if destination:
        notes_parts.append(f"at {destination}")
    notes = " ".join(notes_parts) or "Live route from OpenTransportData Swiss."
    return title, duration_text, notes


def _transport_leg_details(route: TransportItinerary) -> list[dict]:
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
        for leg in route.legs
    ]


async def _enrich_public_transport_timeline(
    days: list[dict],
    transport_client: PublicTransportClient,
    travelers: int,
) -> None:
    async def _route_for_pair(
        day: dict, index: int, activity: dict, next_activity: dict
    ):
        try:
            return await asyncio.wait_for(
                transport_client.plan_route(
                    origin=_transport_place(activity),
                    destination=_transport_place(next_activity),
                    departure_date=date.fromisoformat(day["date"]),
                    departure_time=activity["time"],
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
            if route.price is not None:
                timeline_item["cost"] = route.price


def _remove_internal_activity_fields(days: list[dict]) -> None:
    for day in days:
        for activity in day.get("activities", []):
            activity.pop("_latitude", None)
            activity.pop("_longitude", None)


def _build_itinerary(
    items: list[RecommendationItem],
    start_date: date,
    end_date: date,
    budget_tier: str,
    trip_length: str,
    group_type: str,
    transport_mode: str,
    travelers: int,
    include_transport_costs: bool,
) -> tuple[list[dict], float]:
    num_days = max((end_date - start_date).days, 1)
    times = _TRIP_LENGTH_SLOTS.get(trip_length, _TRIP_LENGTH_SLOTS["half_day"])
    costs = _COSTS.get(budget_tier, _COSTS["mid"])
    slot_cost = _activity_cost(costs, group_type, travelers)

    sorted_items = sorted(items, key=lambda item: item.score, reverse=True)
    needed = num_days * len(times)
    pool = (
        (sorted_items * ((needed // len(sorted_items)) + 1))[:needed]
        if sorted_items
        else []
    )

    days: list[dict] = []
    activity_total = 0.0
    transport_total = 0.0
    idx = 0

    for day_num in range(num_days):
        current = start_date + timedelta(days=day_num)
        activities: list[dict] = []

        for slot_index, time in enumerate(times):
            if idx < len(pool):
                item = pool[idx]
                idx += 1
                name, category, url = item.name, item.category, item.url
                latitude, longitude = item.latitude, item.longitude
                image_url = item.image_url
            else:
                name, category, url = "Free exploration", "leisure", ""
                latitude, longitude = None, None
                image_url = None

            activity_total += slot_cost
            activities.append(
                {
                    "id": f"activity-{day_num + 1}-{slot_index}",
                    "time": time,
                    "title": name,
                    "category": category or "activity",
                    "cost": slot_cost,
                    "url": url or None,
                    "image_url": image_url,
                    "_latitude": latitude,
                    "_longitude": longitude,
                }
            )

        day_transport_total = (
            max(len(activities) - 1, 0) * _transport_cost(transport_mode, travelers)
            if include_transport_costs
            else 0.0
        )
        transport_total += day_transport_total
        days.append(
            {
                "day": day_num + 1,
                "date": current.isoformat(),
                "activities": activities,
                "timeline_items": _build_day_timeline(
                    day_num + 1, activities, transport_mode, travelers
                ),
            }
        )

    meals_total = costs["meals_per_day"] * num_days * max(travelers, 1)
    hotel_total = costs["hotel_per_night"] * num_days * max(travelers, 1)
    estimated_total = round(
        activity_total + meals_total + hotel_total + transport_total, 2
    )

    return days, estimated_total


async def _collect_destination_items(
    client: SwissTourismClient,
    dest: DestinationRecord,
    styles: list[str],
) -> list[RecommendationItem]:
    attractions_result, tours_result = await asyncio.gather(
        client.list_attractions(destination_id=dest.id, page=1, page_size=20),
        client.list_tours(query=dest.name, page=1, page_size=10),
    )

    items: list[RecommendationItem] = []
    fallback_image_url = dest.images[0].url if dest.images else None
    for attr in attractions_result.data:
        score = _score_text(attr.name, attr.description, attr.category, styles)
        items.append(
            RecommendationItem(
                name=attr.name,
                category=attr.category or "attraction",
                url=attr.url,
                score=score,
                latitude=attr.geo.latitude if attr.geo else None,
                longitude=attr.geo.longitude if attr.geo else None,
                image_url=attr.images[0].url if attr.images else fallback_image_url,
            )
        )

    for tour in tours_result.data:
        score = _score_text(tour.name, tour.description, "tour", styles)
        label = tour.name + (f" ({tour.duration})" if tour.duration else "")
        items.append(
            RecommendationItem(
                name=label,
                category="tour",
                url=tour.url,
                score=score,
                latitude=tour.geo.latitude if tour.geo else None,
                longitude=tour.geo.longitude if tour.geo else None,
                image_url=tour.images[0].url if tour.images else fallback_image_url,
            )
        )

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
            )
        ]

    return items


async def _pick_destinations(
    client: SwissTourismClient,
    destination: str | None,
    styles: list[str],
) -> list[DestinationRecord]:
    dest_result = await client.list_destinations(query=destination, page=1, page_size=6)
    destinations = dest_result.data

    if not destinations and destination:
        dest_result = await client.list_destinations(page=1, page_size=6)
        destinations = dest_result.data

    if not destinations:
        return []

    def _dest_score(dest: DestinationRecord) -> float:
        return _score_text(dest.name, dest.description, dest.category or "", styles)

    return sorted(destinations, key=_dest_score, reverse=True)[:4]


async def recommend(
    client: SwissTourismClient,
    preferences: dict | None,
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
    prefs = preferences or {}
    selected_budget_tier: str = budget_tier or prefs.get("budget_tier", "mid")
    pace: str = prefs.get("pace", "moderate")
    styles = _effective_styles(preferences, mood, group_type)
    selected_trip_length = trip_length or _PACE_TO_TRIP_LENGTH.get(pace, "half_day")

    top_dests = await _pick_destinations(client, destination, styles)
    if not top_dests:
        return []

    recommendations: list[dict] = []

    for dest in top_dests:
        items = await _collect_destination_items(client, dest, styles)
        days, estimated_total = _build_itinerary(
            items,
            start_date,
            end_date,
            selected_budget_tier,
            selected_trip_length,
            group_type,
            transport_mode,
            travelers,
            trip_length is not None,
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
    preferences: dict | None,
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
    styles = _effective_styles(preferences, mood, group_type)
    pace = (preferences or {}).get("pace", "moderate")
    selected_trip_length = trip_length or _PACE_TO_TRIP_LENGTH.get(pace, "half_day")
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
    items = await _collect_destination_items(client, target_dest, styles)

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
