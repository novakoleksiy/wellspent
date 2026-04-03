from __future__ import annotations

import asyncio
from datetime import date, timedelta

from app.ports.swiss_tourism import SwissTourismClient

# Maps travel style → keywords to look for in names / descriptions
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

_ACTIVITIES_PER_DAY: dict[str, int] = {"relaxed": 2, "moderate": 3, "packed": 4}

_SLOT_TIMES: dict[int, list[str]] = {
    2: ["09:00", "15:00"],
    3: ["09:00", "13:00", "16:30"],
    4: ["09:00", "11:30", "14:00", "17:00"],
}

_COSTS: dict[str, dict[str, float]] = {
    "budget": {"activity": 15.0, "meals_per_day": 35.0, "hotel_per_night": 70.0},
    "mid": {"activity": 45.0, "meals_per_day": 70.0, "hotel_per_night": 170.0},
    "luxury": {"activity": 130.0, "meals_per_day": 180.0, "hotel_per_night": 450.0},
}

# (name, category, url, score)
_Item = tuple[str, str, str, float]


def _score_text(name: str, description: str, category: str, styles: list[str]) -> float:
    """Return a 0–1 score for how well this item matches the user's travel styles."""
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

    # Map 0–1 raw ratio → 0.35–1.0 so even generic items get surfaced
    raw = total_matched / total_possible
    return round(0.35 + 0.65 * raw, 3)


def _build_itinerary(
    items: list[_Item],
    start_date: date,
    end_date: date,
    pace: str,
    budget_tier: str,
) -> tuple[list[dict], float]:
    """Return (days, estimated_total_chf)."""
    num_days = max((end_date - start_date).days, 1)
    per_day = _ACTIVITIES_PER_DAY.get(pace, 3)
    times = _SLOT_TIMES.get(per_day, _SLOT_TIMES[3])
    costs = _COSTS.get(budget_tier, _COSTS["mid"])

    # Sort best matches first, then cycle if needed
    sorted_items = sorted(items, key=lambda x: x[3], reverse=True)
    needed = num_days * per_day
    if sorted_items:
        pool = (sorted_items * ((needed // len(sorted_items)) + 1))[:needed]
    else:
        pool = []

    days: list[dict] = []
    activity_total = 0.0
    idx = 0

    for day_num in range(num_days):
        current = start_date + timedelta(days=day_num)
        activities = []

        for time in times:
            if idx < len(pool):
                name, category, url, _ = pool[idx]
                idx += 1
            else:
                name, category, url = "Free exploration", "leisure", ""

            slot_cost = costs["activity"]
            activity_total += slot_cost
            entry: dict = {
                "time": time,
                "title": name,
                "category": category or "activity",
                "cost": slot_cost,
            }
            if url:
                entry["url"] = url
            activities.append(entry)

        days.append(
            {
                "day": day_num + 1,
                "date": current.isoformat(),
                "activities": activities,
            }
        )

    meals_total = costs["meals_per_day"] * num_days
    hotel_total = costs["hotel_per_night"] * num_days
    estimated_total = round(activity_total + meals_total + hotel_total, 2)

    return days, estimated_total


async def recommend(
    client: SwissTourismClient,
    preferences: dict | None,
    destination: str | None,
    start_date: date,
    end_date: date,
    travelers: int = 1,
) -> list[dict]:
    """Build personalised Swiss travel recommendations from real API data."""
    prefs = preferences or {}
    styles: list[str] = prefs.get("travel_styles", [])
    budget_tier: str = prefs.get("budget_tier", "mid")
    pace: str = prefs.get("pace", "moderate")

    # 1. Fetch candidate destinations
    dest_result = await client.list_destinations(query=destination, page=1, page_size=6)
    destinations = dest_result.data

    if not destinations and destination:
        # Retry without the query filter as a fallback
        dest_result = await client.list_destinations(page=1, page_size=6)
        destinations = dest_result.data

    if not destinations:
        return []

    # 2. Score & keep top 2 destinations
    def _dest_score(d) -> float:
        return _score_text(d.name, d.description, d.category or "", styles)

    top_dests = sorted(destinations, key=_dest_score, reverse=True)[:4]

    # 3. For each destination fetch attractions + tours concurrently
    recommendations: list[dict] = []

    for dest in top_dests:
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

        days, estimated_total = _build_itinerary(
            items, start_date, end_date, pace, budget_tier
        )

        top3 = sorted(items, key=lambda x: x[3], reverse=True)[:3]
        highlights = [name for name, *_ in top3]

        recommendations.append(
            {
                "title": f"Discover {dest.name}",
                "destination": dest.name,
                "description": (
                    f"{max((end_date - start_date).days, 1)}-day trip to {dest.name}, "
                    "tailored to your travel style."
                ),
                "itinerary": {
                    "days": days,
                    "estimated_total": round(estimated_total * travelers, 2),
                    "currency": "CHF",
                },
                "match_score": _dest_score(dest),
                "highlights": highlights,
            }
        )

    recommendations.sort(key=lambda r: r["match_score"], reverse=True)
    return recommendations
