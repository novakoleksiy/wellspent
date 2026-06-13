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
from app.services.recommendation.scoring import _season_for_date, _text_is_food
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

# Quiz moods that trigger the food-slot quota. Only "Food & Markets" asks for a
# food-led day; the other moods keep the unconstrained selection.
_FOOD_MOODS: frozenset[str] = frozenset({"food_markets"})


def _is_food_item(item: RecommendationItem) -> bool:
    return _text_is_food(item.name, item.description, item.category)


def _food_slot_target(slot_count: int) -> int:
    """How many of ``slot_count`` stops to reserve for food on a Food & Markets trip.

    At least half, rounded up so odd counts still clear the 50% bar, but never every
    slot: one slot is always left for non-food variety so a food day doesn't read as
    several food stops back to back.
    """
    if slot_count <= 1:
        return slot_count
    half = -(-slot_count // 2)  # ceil(slot_count / 2)
    return min(half, slot_count - 1)


def _interleave_food(items: list[RecommendationItem]) -> list[RecommendationItem]:
    """Alternate food and non-food stops, each group ordered by score.

    Starting from the larger group and alternating keeps food stops from bunching
    (no "four food stops in a row") while still leading each group with its strongest
    options.
    """
    food = sorted(
        (item for item in items if _is_food_item(item)),
        key=lambda item: item.score,
        reverse=True,
    )
    other = sorted(
        (item for item in items if not _is_food_item(item)),
        key=lambda item: item.score,
        reverse=True,
    )
    arranged: list[RecommendationItem] = []
    take_food = len(food) >= len(other)
    while food or other:
        if take_food and food:
            arranged.append(food.pop(0))
        elif not take_food and other:
            arranged.append(other.pop(0))
        elif food:
            arranged.append(food.pop(0))
        else:
            arranged.append(other.pop(0))
        take_food = not take_food
    return arranged


def _apply_food_quota(
    sequence: list[RecommendationItem],
    pool: list[RecommendationItem],
) -> list[RecommendationItem]:
    """Reshape a chosen stop sequence so ~half its slots are food, then space them.

    Brings the food count to ``_food_slot_target`` by swapping the weakest non-food
    stops for the strongest unused food items in the pool (and trimming the other way
    if the planner over-picked food, so non-food variety is preserved). When the pool
    simply lacks enough food — a destination with thin food coverage — it fills as
    many food stops as exist and leaves the rest to the normal selection rather than
    padding. Finally it interleaves food and non-food so the stops don't bunch.
    """
    food_pool = [item for item in pool if _is_food_item(item)]
    if not food_pool:
        return sequence

    chosen = list(sequence)
    target = min(_food_slot_target(len(chosen)), len(food_pool))
    chosen_ids = {item.id for item in chosen}

    def food_count() -> int:
        return sum(1 for item in chosen if _is_food_item(item))

    if food_count() < target:
        spare_food = sorted(
            (item for item in food_pool if item.id not in chosen_ids),
            key=lambda item: item.score,
            reverse=True,
        )
        weak_non_food = sorted(
            (index for index, item in enumerate(chosen) if not _is_food_item(item)),
            key=lambda index: chosen[index].score,
        )
        for index in weak_non_food:
            if food_count() >= target or not spare_food:
                break
            replacement = spare_food.pop(0)
            chosen[index] = replacement
            chosen_ids.add(replacement.id)
    elif food_count() > target:
        spare_non_food = sorted(
            (
                item
                for item in pool
                if not _is_food_item(item) and item.id not in chosen_ids
            ),
            key=lambda item: item.score,
            reverse=True,
        )
        weak_food = sorted(
            (index for index, item in enumerate(chosen) if _is_food_item(item)),
            key=lambda index: chosen[index].score,
        )
        for index in weak_food:
            if food_count() <= target or not spare_non_food:
                break
            replacement = spare_non_food.pop(0)
            chosen[index] = replacement
            chosen_ids.add(replacement.id)

    return _interleave_food(chosen)


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


def _sample_candidates(
    items: list[RecommendationItem], food_floor: int = 0
) -> list[RecommendationItem]:
    ranked = sorted(items, key=lambda item: item.score, reverse=True)
    top = ranked[:_PLANNER_TOP_K]
    sample = _rng.sample(top, min(_PLANNER_SAMPLE_SIZE, len(top)))
    if food_floor <= 0:
        return sample

    # Food offers score below the facet-banded attractions, so the score-ranked top-K
    # often holds little food. Pull in the best food items the sample is missing —
    # evicting the weakest non-food picks — so the planner's theme/intro copy matches
    # the food-led stops the quota will enforce downstream.
    needed = food_floor - sum(1 for item in sample if _is_food_item(item))
    if needed <= 0:
        return sample
    sample_ids = {item.id for item in sample}
    spare_food = [
        item for item in ranked if _is_food_item(item) and item.id not in sample_ids
    ][:needed]
    if not spare_food:
        return sample
    evict_ids = {
        item.id
        for item in sorted(
            (item for item in sample if not _is_food_item(item)),
            key=lambda item: item.score,
        )[: len(spare_food)]
    }
    return [item for item in sample if item.id not in evict_ids] + spare_food


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

    food_floor = _food_slot_target(slot_count) if mood in _FOOD_MOODS else 0
    sampled = _sample_candidates(items, food_floor)
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

    # On a Food & Markets trip, guarantee at least half the stops are food-related.
    # Applied here (not inside the planner) so it holds for both the LLM and the
    # deterministic fallback, and can pull food from the whole pool — not just the
    # planner's sample, where lower-scoring food offers are usually crowded out.
    if mood in _FOOD_MOODS:
        sequence = _apply_food_quota(sequence, items)

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
