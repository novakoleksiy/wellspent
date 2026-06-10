from __future__ import annotations

import asyncio
import logging
import math
import re
from datetime import date, datetime

from app.ports.transport import (
    PublicTransportClient,
    TransportItinerary,
    TransportLeg,
    TransportPlace,
)
from app.services.recommendation.scoring import _distance_meters

_TRANSPORT_LABELS: dict[str, tuple[str, str]] = {
    "car": ("Drive to next stop", "Approx. 25 min by car"),
    "public_transport": (
        "Train or regional connection",
        "Approx. 35 min on public transport",
    ),
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
