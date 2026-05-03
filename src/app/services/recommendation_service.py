from __future__ import annotations

import asyncio
from datetime import date, timedelta
from typing import Literal

from app.ports.swiss_tourism import DestinationRecord, SwissTourismClient

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

_Item = tuple[str, str, str, float]


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


def _build_itinerary(
    items: list[_Item],
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

    sorted_items = sorted(items, key=lambda x: x[3], reverse=True)
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
                name, category, url, _ = pool[idx]
                idx += 1
            else:
                name, category, url = "Free exploration", "leisure", ""

            activity_total += slot_cost
            activities.append(
                {
                    "id": f"activity-{day_num + 1}-{slot_index}",
                    "time": time,
                    "title": name,
                    "category": category or "activity",
                    "cost": slot_cost,
                    "url": url or None,
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
) -> list[_Item]:
    attractions_result, tours_result = await asyncio.gather(
        client.list_attractions(destination_id=dest.id, page=1, page_size=20),
        client.list_tours(query=dest.name, page=1, page_size=10),
    )

    items: list[_Item] = []
    for attr in attractions_result.data:
        score = _score_text(attr.name, attr.description, attr.category, styles)
        items.append((attr.name, attr.category or "attraction", attr.url, score))

    for tour in tours_result.data:
        score = _score_text(tour.name, tour.description, "tour", styles)
        label = tour.name + (f" ({tour.duration})" if tour.duration else "")
        items.append((label, "tour", tour.url, score))

    if not items:
        items = [(f"Explore {dest.name}", "sightseeing", dest.url, 0.7)]

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
) -> list[dict]:
    prefs = preferences or {}
    budget_tier: str = prefs.get("budget_tier", "mid")
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
            budget_tier,
            selected_trip_length,
            group_type,
            transport_mode,
            travelers,
            trip_length is not None,
        )

        top3 = sorted(items, key=lambda x: x[3], reverse=True)[:3]
        highlights = [name for name, *_ in top3]
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
    replacement: _Item,
    transport_mode: str,
    travelers: int,
) -> dict:
    replacement_name, replacement_category, replacement_url, _ = replacement
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
            activity["title"] = replacement_name
            activity["category"] = replacement_category or "activity"
            activity["url"] = replacement_url or None
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
            for item in sorted(items, key=lambda x: x[3], reverse=True)
            if item[0] not in current_titles
        ),
        None,
    )
    if replacement is None and items:
        replacement = sorted(items, key=lambda x: x[3], reverse=True)[0]

    next_itinerary = (
        _replace_activity_in_itinerary(
            itinerary, item_id, replacement, transport_mode, travelers
        )
        if replacement is not None
        else itinerary
    )

    top3 = sorted(items, key=lambda x: x[3], reverse=True)[:3]
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
        "highlights": [name for name, *_ in top3],
    }
