from __future__ import annotations

import asyncio
import logging
from datetime import date

from app.ports.llm import LlmClient
from app.ports.repositories import TripRepository
from app.ports.swiss_tourism import SwissTourismClient
from app.services.recommendation_service import (
    _build_itinerary,
    _score_text,
)

logger = logging.getLogger(__name__)

# (name, category, url, score)
_Item = tuple[str, str, str, float]


async def recommend(
    client: SwissTourismClient,
    llm: LlmClient,
    trip_repo: TripRepository,
    user_id: int,
    preferences: dict | None,
    destination: str | None,
    start_date: date,
    end_date: date,
    travelers: int = 1,
) -> list[dict]:
    """Build AI-powered recommendations using LLM for intelligent activity pairing."""
    prefs = preferences or {}
    styles: list[str] = prefs.get("travel_styles", [])
    budget_tier: str = prefs.get("budget_tier", "mid")
    pace: str = prefs.get("pace", "moderate")

    # 1. Fetch candidate destinations
    dest_result = await client.list_destinations(query=destination, page=1, page_size=6)
    destinations = dest_result.data

    if not destinations and destination:
        dest_result = await client.list_destinations(page=1, page_size=6)
        destinations = dest_result.data

    if not destinations:
        return []

    # 2. Score & keep top 2
    def _dest_score(d) -> float:
        return _score_text(d.name, d.description, d.category or "", styles)

    top_dests = sorted(destinations, key=_dest_score, reverse=True)[:2]

    # 3. Fetch past trips
    past_trips = await trip_repo.list_by_user(user_id)

    # 4. For each destination, fetch data and use LLM
    recommendations: list[dict] = []

    for dest in top_dests:
        attractions_result, tours_result = await asyncio.gather(
            client.list_attractions(destination_id=dest.id, page=1, page_size=20),
            client.list_tours(query=dest.name, page=1, page_size=10),
        )

        all_attractions = attractions_result.data
        all_tours = tours_result.data

        # Try LLM-powered itinerary
        try:
            itinerary = await llm.generate_itinerary(
                destinations=[dest],
                attractions=all_attractions,
                tours=all_tours,
                preferences=prefs,
                past_trips=past_trips,
                start_date=start_date,
                end_date=end_date,
                travelers=travelers,
            )
        except Exception:
            logger.warning(
                "LLM itinerary generation failed for %s, falling back",
                dest.name,
                exc_info=True,
            )
            # Fallback to keyword-based itinerary
            items: list[_Item] = []
            for attr in all_attractions:
                score = _score_text(attr.name, attr.description, attr.category, styles)
                items.append(
                    (attr.name, attr.category or "attraction", attr.url, score)
                )
            for tour in all_tours:
                score = _score_text(tour.name, tour.description, "tour", styles)
                label = tour.name + (f" ({tour.duration})" if tour.duration else "")
                items.append((label, "tour", tour.url, score))

            if not items:
                items = [(f"Explore {dest.name}", "sightseeing", dest.url, 0.7)]

            days, estimated_total = _build_itinerary(
                items,
                start_date,
                end_date,
                pace,
                budget_tier,
            )
            itinerary = {
                "days": days,
                "estimated_total": round(estimated_total * travelers, 2),
                "currency": "CHF",
            }

        # Extract highlights from the itinerary
        highlights: list[str] = []
        for day in itinerary.get("days", [])[:3]:
            for act in day.get("activities", [])[:1]:
                if title := act.get("title"):
                    highlights.append(title)

        recommendations.append(
            {
                "title": f"AI-Curated: {dest.name}",
                "destination": dest.name,
                "description": (
                    f"{max((end_date - start_date).days, 1)}-day AI-curated trip "
                    f"to {dest.name}, with intelligently paired activities."
                ),
                "itinerary": itinerary,
                "match_score": _dest_score(dest),
                "highlights": highlights,
                "strategy": "ai",
            }
        )

    recommendations.sort(key=lambda r: r["match_score"], reverse=True)
    return recommendations
