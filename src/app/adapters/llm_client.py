from __future__ import annotations

import json
import logging
from datetime import date

import anthropic

from app.ports.repositories import TripRecord
from app.ports.swiss_tourism import AttractionRecord, DestinationRecord, TourRecord

logger = logging.getLogger(__name__)

_SYSTEM_PROMPT = """\
You are a Swiss travel itinerary planner. Given a list of real destinations, \
attractions, and tours from the Swiss Tourism API, plus the traveler's \
preferences and past trips, create an optimized day-by-day itinerary.

Key goals:
- Pair activities that complement each other (e.g. wine tasting + museum visit, \
  not wine tasting + kayaking). Group thematically similar experiences within \
  each day.
- Avoid recommending activities the traveler has already done in past trips.
- Respect the traveler's pace preference for how many activities per day.
- Only use activities from the provided lists — do not invent new ones.

Respond with ONLY valid JSON matching this schema:
{
  "days": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "activities": [
        {
          "time": "HH:MM",
          "title": "Activity name",
          "category": "category",
          "cost": 0.0
        }
      ]
    }
  ],
  "estimated_total": 0.0,
  "currency": "CHF"
}
"""


class AnthropicLlmClient:
    def __init__(self, api_key: str, model: str = "claude-sonnet-4-20250514") -> None:
        self._client = anthropic.AsyncAnthropic(api_key=api_key)
        self._model = model

    async def generate_itinerary(
        self,
        *,
        destinations: list[DestinationRecord],
        attractions: list[AttractionRecord],
        tours: list[TourRecord],
        preferences: dict,
        past_trips: list[TripRecord],
        start_date: date,
        end_date: date,
        travelers: int,
    ) -> dict:
        user_message = self._build_user_message(
            destinations=destinations,
            attractions=attractions,
            tours=tours,
            preferences=preferences,
            past_trips=past_trips,
            start_date=start_date,
            end_date=end_date,
            travelers=travelers,
        )

        response = await self._client.messages.create(
            model=self._model,
            max_tokens=4096,
            system=_SYSTEM_PROMPT,
            messages=[{"role": "user", "content": user_message}],
        )

        text = response.content[0].text
        return json.loads(text)

    def _build_user_message(
        self,
        *,
        destinations: list[DestinationRecord],
        attractions: list[AttractionRecord],
        tours: list[TourRecord],
        preferences: dict,
        past_trips: list[TripRecord],
        start_date: date,
        end_date: date,
        travelers: int,
    ) -> str:
        dest_info = [
            {"name": d.name, "category": d.category, "description": d.description[:200]}
            for d in destinations
        ]
        attr_info = [
            {"name": a.name, "category": a.category, "description": a.description[:200]}
            for a in attractions
        ]
        tour_info = [
            {"name": t.name, "duration": t.duration, "description": t.description[:200]}
            for t in tours
        ]
        past_info = [
            {"destination": t.destination, "title": t.title}
            for t in past_trips[:10]
        ]

        data = {
            "destinations": dest_info,
            "attractions": attr_info,
            "tours": tour_info,
            "preferences": preferences,
            "past_trips": past_info,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "travelers": travelers,
            "num_days": max((end_date - start_date).days, 1),
        }
        return json.dumps(data, indent=2)
