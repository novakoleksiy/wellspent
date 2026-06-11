from __future__ import annotations

import logging
import random
import secrets
from datetime import date, timedelta

from app.ports.itinerary_planner import (
    CandidateItem,
    DayPlan,
    ItineraryPlanner,
    PlannedStop,
    PlannerError,
    PlanRequest,
)
from app.services.recommendation.candidates import RecommendationItem
from app.services.recommendation.scoring import _season_for_date
from app.services.recommendation.timeline import _build_day_timeline

logger = logging.getLogger(__name__)

# Candidate sampling for the planner prompt: take the top-K pool by score, then a
# random window of it, so identical quiz answers still produce different prompts.
# Module-level RNG/nonce so tests can seed or stub them; a dedicated Random instance
# keeps planner sampling independent from the stdlib `random` (whose `choice` is
# patched by surprise-destination tests).
_rng = random.Random()
_PLANNER_TOP_K = 12
_PLANNER_SAMPLE_SIZE = 8

# Day themes render into ItineraryDay.theme, which caps at 80 characters.
_MAX_THEME_CHARS = 80


def _make_nonce() -> str:
    return secrets.token_hex(8)


_TRIP_LENGTH_SLOTS: dict[str, list[str]] = {
    "2_3_hours": ["10:00", "12:00"],
    "half_day": ["09:30", "12:30", "15:30"],
    "full_day": ["09:00", "11:30", "14:00", "16:30"],
}

# Estimated trip-total ranges in CHF, keyed by budget tier and itinerary length.
# The total shown to the user is a (seeded) random pick within the matching range,
# so it depends only on the budget choice and trip length — not on per-item pricing.
_ESTIMATED_TOTAL_RANGES: dict[str, dict[str, tuple[float, float]]] = {
    "budget": {
        "2_3_hours": (30.0, 50.0),
        "half_day": (40.0, 70.0),
        "full_day": (60.0, 110.0),
    },
    "mid": {
        "2_3_hours": (60.0, 80.0),
        "half_day": (70.0, 100.0),
        "full_day": (90.0, 140.0),
    },
    "luxury": {
        "2_3_hours": (100.0, 140.0),
        "half_day": (120.0, 180.0),
        "full_day": (140.0, 200.0),
    },
}

# Varied free-time copy so unfilled slots don't all read "Free exploration".
_FREE_TIME_LABELS: list[str] = [
    "Free exploration",
    "Wander {destination}",
    "Local discovery time",
    "Cafe stop and people-watching",
]


# Share of the per-trip baseline that scales with each traveler (tickets, meals,
# activities); the remainder is treated as shared overhead (lodging, transport hire)
# that grows only modestly with group size.
_VARIABLE_COST_SHARE = 0.7
# Mild premium added to the shared portion per extra traveler, so groups still trend
# up without the shared cost being duplicated in full per head.
_GROUP_OVERHEAD_PREMIUM = 0.15


def _estimated_total(
    budget_tier: str, trip_length: str, travelers: int, *seed_parts: object
) -> float:
    """A trip-total estimate from budget tier, trip length, and group size.

    The seeded base value is the solo-traveler cost; it is then scaled with
    shared-cost dampening so additional travelers add their variable share plus a
    small overhead premium rather than multiplying the whole total. Stays stable
    across refreshes (seeded) while different destinations vary.
    """
    by_length = _ESTIMATED_TOTAL_RANGES.get(budget_tier, _ESTIMATED_TOTAL_RANGES["mid"])
    low, high = by_length.get(trip_length, by_length["half_day"])
    seed = "|".join(
        str(part) for part in ("estimate", budget_tier, trip_length, *seed_parts)
    )
    base = random.Random(seed).uniform(low, high)

    headcount = max(1, travelers)
    variable = base * _VARIABLE_COST_SHARE * headcount
    fixed = (
        base
        * (1 - _VARIABLE_COST_SHARE)
        * (1 + _GROUP_OVERHEAD_PREMIUM * (headcount - 1))
    )
    return float(round((variable + fixed) / 5) * 5)


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


def _sample_candidates(items: list[RecommendationItem]) -> list[RecommendationItem]:
    top = sorted(items, key=lambda item: item.score, reverse=True)[:_PLANNER_TOP_K]
    return _rng.sample(top, min(_PLANNER_SAMPLE_SIZE, len(top)))


def _to_candidate_item(item: RecommendationItem) -> CandidateItem:
    return CandidateItem(
        id=item.id,
        name=item.name,
        category=item.category,
        description=item.description,
        source="offer" if item.id.startswith("offer-") else "attraction",
        distance_m=item.distance_m,
        score=item.score,
    )


def _validate_day_plan(
    plan: DayPlan,
    candidate_ids: set[str],
    expected_stops: int,
) -> DayPlan:
    stop_ids = [stop.candidate_id for stop in plan.stops]
    if len(plan.stops) != expected_stops:
        raise PlannerError(
            f"planner returned {len(plan.stops)} stops, expected {expected_stops}"
        )
    if len(set(stop_ids)) != len(stop_ids):
        raise PlannerError("planner returned duplicate candidate ids")
    unknown = [stop_id for stop_id in stop_ids if stop_id not in candidate_ids]
    if unknown:
        raise PlannerError(f"planner returned unknown candidate ids: {unknown}")
    if {stop.slot_index for stop in plan.stops} != set(range(expected_stops)):
        raise PlannerError("planner slot indices are not 0..N-1")

    theme = plan.theme.strip()[:_MAX_THEME_CHARS] if plan.theme else None
    description = plan.description.strip() if plan.description else None
    return DayPlan(
        theme=theme or None,
        description=description or None,
        stops=sorted(plan.stops, key=lambda stop: stop.slot_index),
    )


def _fallback_day_plan(items: list[RecommendationItem], stop_count: int) -> DayPlan:
    """Deterministic plan: category-interleaved top items, no theme/intro override."""
    sequence = _interleave_by_category(items)[:stop_count]
    return DayPlan(
        theme=None,
        description=None,
        stops=[
            PlannedStop(candidate_id=item.id, slot_index=index)
            for index, item in enumerate(sequence)
        ],
    )


async def _plan_day(
    items: list[RecommendationItem],
    planner: ItineraryPlanner | None,
    slot_count: int,
    *,
    destination_name: str,
    mood: str,
    group_type: str,
    trip_length: str,
    travelers: int,
    start_date: date,
) -> DayPlan:
    if planner is None:
        return _fallback_day_plan(items, slot_count)

    sampled = _sample_candidates(items)
    expected_stops = min(slot_count, len(sampled))
    request = PlanRequest(
        destination_name=destination_name,
        mood=mood,
        group_type=group_type,
        trip_length=trip_length,
        travelers=travelers,
        slot_count=expected_stops,
        season=_season_for_date(start_date),
        candidates=[_to_candidate_item(item) for item in sampled],
        nonce=_make_nonce(),
    )
    try:
        plan = await planner.plan_day(request)
        return _validate_day_plan(
            plan, {candidate.id for candidate in request.candidates}, expected_stops
        )
    except Exception:
        logger.warning(
            "Itinerary planner failed for %s; using deterministic fallback",
            destination_name,
            exc_info=True,
        )
        return _fallback_day_plan(items, slot_count)


async def build_itinerary_days(
    items: list[RecommendationItem],
    *,
    planner: ItineraryPlanner | None,
    start_date: date,
    budget_tier: str,
    trip_length: str,
    mood: str,
    group_type: str,
    transport_mode: str,
    travelers: int,
    destination_name: str = "the area",
) -> tuple[list[dict], float, str | None]:
    """Build the single-day itinerary, via the LLM planner when available.

    The planner only chooses and orders stops (plus theme/intro copy); every stop is
    rehydrated from the original pool item by candidate id, so coordinates, images,
    urls, and descriptions always come from upstream data.
    """
    num_days = 1
    times = _TRIP_LENGTH_SLOTS.get(trip_length, _TRIP_LENGTH_SLOTS["half_day"])

    day_plan = await _plan_day(
        items,
        planner,
        len(times),
        destination_name=destination_name,
        mood=mood,
        group_type=group_type,
        trip_length=trip_length,
        travelers=travelers,
        start_date=start_date,
    )
    item_by_id = {item.id: item for item in items}
    sequence = [item_by_id[stop.candidate_id] for stop in day_plan.stops]

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
                "theme": day_plan.theme or _day_theme(activities),
                "activities": activities,
                "timeline_items": timeline_items,
            }
        )

    estimated_total = _estimated_total(
        budget_tier, trip_length, travelers, destination_name
    )

    return days, estimated_total, day_plan.description
