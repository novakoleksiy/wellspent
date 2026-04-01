from __future__ import annotations

from app.ports.repositories import TripRecord, TripRepository
from app.services.recommendation_service import _score_text
from app.services.trip_service import TripNotFound


async def recommend(
    trip_repo: TripRepository,
    preferences: dict | None,
    destination: str | None,
    limit: int = 10,
) -> list[dict]:
    """Return community-shared trips scored against user preferences."""
    prefs = preferences or {}
    styles: list[str] = prefs.get("travel_styles", [])

    trips = await trip_repo.list_community(
        travel_styles=styles, limit=limit,
    )

    if destination:
        dest_lower = destination.lower()
        filtered = [t for t in trips if dest_lower in t.destination.lower()]
        if filtered:
            trips = filtered

    recommendations: list[dict] = []
    for trip in trips:
        score = _score_text(
            trip.title,
            trip.description or "",
            trip.destination,
            styles,
        )

        highlights: list[str] = []
        if trip.itinerary and "days" in trip.itinerary:
            for day in trip.itinerary["days"][:3]:
                for act in day.get("activities", [])[:1]:
                    if title := act.get("title"):
                        highlights.append(title)

        recommendations.append({
            "title": trip.title,
            "destination": trip.destination,
            "description": trip.description or f"Community trip to {trip.destination}.",
            "itinerary": trip.itinerary or {"days": [], "estimated_total": 0, "currency": "CHF"},
            "match_score": score,
            "highlights": highlights,
            "strategy": "community",
            "author": None,  # user info not available from TripRecord
        })

    recommendations.sort(key=lambda r: r["match_score"], reverse=True)
    return recommendations


async def share_trip(
    trip_repo: TripRepository, trip_id: int, user_id: int,
) -> TripRecord:
    return await trip_repo.set_shared(trip_id, user_id, shared=True)


async def unshare_trip(
    trip_repo: TripRepository, trip_id: int, user_id: int,
) -> TripRecord:
    return await trip_repo.set_shared(trip_id, user_id, shared=False)
