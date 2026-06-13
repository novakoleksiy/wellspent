from __future__ import annotations

import logging
import time
from datetime import date
from typing import Literal

from app.ports.itinerary_planner import ItineraryPlanner
from app.ports.swiss_tourism import SwissTourismClient
from app.ports.transport import PublicTransportClient
from app.services.recommendation.candidates import (
    RecommendationItem,
    _collect_destination_items,
    _pick_destinations,
)
from app.services.recommendation.planning import build_itinerary_days
from app.services.recommendation.scoring import (
    _effective_styles,
    _score_text,
)
from app.services.recommendation.timeline import (
    _build_day_timeline,
    _enrich_public_transport_timeline,
    _remove_internal_activity_fields,
)

logger = logging.getLogger(__name__)


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
    itinerary_planner: ItineraryPlanner | None = None,
) -> list[dict]:
    started = time.monotonic()
    logger.info(
        "recommend: destination=%r mood=%s group=%s transport=%s length=%s "
        "planner=%s public_transport=%s",
        destination or "(surprise)",
        mood,
        group_type,
        transport_mode,
        trip_length or "half_day",
        "on" if itinerary_planner is not None else "off",
        "on" if public_transport_client is not None else "off",
    )

    selected_budget_tier: str = budget_tier or "mid"
    styles = _effective_styles(mood, group_type)
    selected_trip_length = trip_length or "half_day"

    top_dests = await _pick_destinations(client, destination, styles)
    if not top_dests:
        logger.warning(
            "recommend: no destinations found for %r — returning empty result "
            "(check Swiss Tourism connectivity above)",
            destination or "(surprise)",
        )
        return []

    logger.info(
        "recommend: picked %s (id=%s) in %.0f ms",
        top_dests[0].name,
        top_dests[0].id,
        (time.monotonic() - started) * 1000,
    )

    recommendations: list[dict] = []

    for dest in top_dests:
        items = await _collect_destination_items(client, dest, styles, start_date)
        logger.info(
            "recommend: collected %d candidate items for %s", len(items), dest.name
        )
        days, estimated_total, plan_description = await build_itinerary_days(
            items,
            planner=itinerary_planner,
            start_date=start_date,
            budget_tier=selected_budget_tier,
            trip_length=selected_trip_length,
            mood=mood,
            group_type=group_type,
            transport_mode=transport_mode,
            travelers=travelers,
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
                "description": plan_description
                or (
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
    logger.info(
        "recommend: returning %d recommendation(s) for %r in %.0f ms",
        len(recommendations),
        destination or "(surprise)",
        (time.monotonic() - started) * 1000,
    )
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
    items = await _collect_destination_items(client, target_dest, styles, start_date)

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
