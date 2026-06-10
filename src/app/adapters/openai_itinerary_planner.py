from __future__ import annotations

import asyncio
import json
import logging

from openai import AsyncOpenAI

from app.ports.itinerary_planner import (
    DayPlan,
    PlannedStop,
    PlannerError,
    PlanRequest,
)

logger = logging.getLogger(__name__)

_CANDIDATE_DESCRIPTION_MAX_CHARS = 160

_DAY_PLAN_RESPONSE_FORMAT = {
    "type": "json_schema",
    "json_schema": {
        "name": "day_plan",
        "strict": True,
        "schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["theme", "description", "stops"],
            "properties": {
                "theme": {
                    "type": ["string", "null"],
                    "description": "Short day theme, at most six words.",
                },
                "description": {
                    "type": ["string", "null"],
                    "description": "One- to two-sentence intro for the day.",
                },
                "stops": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "additionalProperties": False,
                        "required": ["candidate_id", "slot_index"],
                        "properties": {
                            "candidate_id": {"type": "string"},
                            "slot_index": {"type": "integer"},
                        },
                    },
                },
            },
        },
    },
}

_SYSTEM_PROMPT = (
    "You are a Swiss day-trip planner. From the provided candidate list, choose "
    "exactly slot_count stops and order them into a sensible day: respect geography "
    "(distance_m is metres from the destination centre) and daypart fit, and vary the "
    "kinds of stops. Assign slot_index 0..slot_count-1 in visit order. Write a short "
    "day theme (at most six words) and a one- to two-sentence intro tuned to the "
    "traveller's mood and group type. Only reference candidates by their candidate "
    "ids; never invent stops."
)


def _request_payload(request: PlanRequest) -> dict:
    return {
        "destination": request.destination_name,
        "mood": request.mood,
        "group_type": request.group_type,
        "trip_length": request.trip_length,
        "travelers": request.travelers,
        "season": request.season,
        "slot_count": request.slot_count,
        "nonce": request.nonce,
        "candidates": [
            {
                "id": candidate.id,
                "name": candidate.name,
                "category": candidate.category,
                "description": (candidate.description or "")[
                    :_CANDIDATE_DESCRIPTION_MAX_CHARS
                ],
                "distance_m": candidate.distance_m,
                "source": candidate.source,
            }
            for candidate in request.candidates
        ],
    }


def _parse_day_plan(content: str) -> DayPlan:
    payload = json.loads(content)
    theme = payload.get("theme")
    description = payload.get("description")
    stops = [
        PlannedStop(
            candidate_id=str(stop["candidate_id"]),
            slot_index=int(stop["slot_index"]),
        )
        for stop in payload["stops"]
    ]
    return DayPlan(
        theme=theme if isinstance(theme, str) else None,
        description=description if isinstance(description, str) else None,
        stops=stops,
    )


class OpenAIItineraryPlanner:
    """Plans a day with an OpenAI chat model returning a strict JSON day plan.

    Any failure — timeout, API error, malformed response — surfaces as PlannerError
    so callers can fall back to the deterministic planner.
    """

    def __init__(
        self,
        api_key: str,
        model: str,
        *,
        temperature: float = 0.9,
        timeout_seconds: float = 12.0,
    ) -> None:
        self._client = AsyncOpenAI(api_key=api_key)
        self._model = model
        self._temperature = temperature
        self._timeout_seconds = timeout_seconds

    async def plan_day(self, request: PlanRequest) -> DayPlan:
        try:
            response = await asyncio.wait_for(
                self._client.chat.completions.create(
                    model=self._model,
                    temperature=self._temperature,
                    messages=[
                        {"role": "system", "content": _SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": json.dumps(
                                _request_payload(request), ensure_ascii=False
                            ),
                        },
                    ],
                    response_format=_DAY_PLAN_RESPONSE_FORMAT,
                ),
                timeout=self._timeout_seconds,
            )
            content = response.choices[0].message.content
            if not content:
                raise ValueError("empty completion content")
            return _parse_day_plan(content)
        except Exception as exc:
            logger.warning(
                "OpenAI itinerary planner failed for %s",
                request.destination_name,
                exc_info=True,
            )
            raise PlannerError("OpenAI itinerary planner failed") from exc
