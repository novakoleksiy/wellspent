from __future__ import annotations

from datetime import date, timedelta

from app.ports.repositories import PremadeTemplateRepository
from app.services.recommendation_service import _COSTS


async def recommend(
    template_repo: PremadeTemplateRepository,
    preferences: dict | None,
    destination: str | None,
    start_date: date,
    end_date: date,
    travelers: int = 1,
) -> list[dict]:
    """Return premade trip recommendations matched to user preferences."""
    prefs = preferences or {}
    styles: list[str] = prefs.get("travel_styles", [])
    budget_tier: str = prefs.get("budget_tier", "mid")
    pace: str = prefs.get("pace", "moderate")

    templates = await template_repo.list_matching(
        travel_styles=styles,
        budget_tier=budget_tier,
        pace=pace,
    )

    if destination:
        dest_lower = destination.lower()
        templates = [
            t for t in templates if dest_lower in t.destination.lower()
        ] or templates  # fall back to all if none match destination

    recommendations: list[dict] = []
    for tpl in templates:
        days = _adapt_itinerary_dates(tpl.itinerary, start_date, end_date)
        num_days = max((end_date - start_date).days, 1)

        costs = _COSTS.get(budget_tier, _COSTS["mid"])
        activity_count = sum(len(d.get("activities", [])) for d in days)
        activity_total = activity_count * costs["activity"]
        meals_total = costs["meals_per_day"] * num_days
        hotel_total = costs["hotel_per_night"] * num_days
        estimated_total = round(
            (activity_total + meals_total + hotel_total) * travelers, 2
        )

        style_overlap = len(set(tpl.travel_styles) & set(styles))
        max_styles = max(len(tpl.travel_styles), len(styles), 1)
        match_score = round(0.5 + 0.5 * (style_overlap / max_styles), 3)

        highlights = [
            a.get("title", "")
            for d in days
            for a in d.get("activities", [])
            if a.get("title")
        ][:3]

        recommendations.append(
            {
                "title": tpl.title,
                "destination": tpl.destination,
                "description": tpl.description
                or (f"{num_days}-day curated trip to {tpl.destination}."),
                "itinerary": {
                    "days": days,
                    "estimated_total": estimated_total,
                    "currency": "CHF",
                },
                "match_score": match_score,
                "highlights": highlights,
                "strategy": "premade",
            }
        )

    recommendations.sort(key=lambda r: r["match_score"], reverse=True)
    return recommendations


def _adapt_itinerary_dates(
    itinerary: dict,
    start_date: date,
    end_date: date,
) -> list[dict]:
    """Shift template itinerary days to the requested date range."""
    template_days: list[dict] = itinerary.get("days", [])
    num_days = max((end_date - start_date).days, 1)

    adapted: list[dict] = []
    for day_num in range(num_days):
        current = start_date + timedelta(days=day_num)
        if day_num < len(template_days):
            source = template_days[day_num]
        else:
            # Cycle through template days if trip is longer than template
            source = (
                template_days[day_num % len(template_days)] if template_days else {}
            )

        adapted.append(
            {
                "day": day_num + 1,
                "date": current.isoformat(),
                "activities": source.get("activities", []),
            }
        )

    return adapted
