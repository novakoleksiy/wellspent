from __future__ import annotations

import asyncio
import json
from types import SimpleNamespace

import pytest

from app.adapters.openai_itinerary_planner import OpenAIItineraryPlanner
from app.ports.itinerary_planner import CandidateItem, PlannerError, PlanRequest


def _plan_request() -> PlanRequest:
    return PlanRequest(
        destination_name="Lucerne",
        mood="culture_history",
        group_type="couple",
        trip_length="half_day",
        travelers=2,
        slot_count=2,
        season="summer",
        candidates=[
            CandidateItem(
                id="chapel-bridge",
                name="Chapel Bridge",
                category="museum",
                description="Historic covered bridge.",
                source="attraction",
                distance_m=420.0,
                score=0.9,
            ),
            CandidateItem(
                id="offer-boat-cruise",
                name="Lake cruise",
                category="offer",
                description="Scenic paddle-steamer cruise.",
                source="offer",
                distance_m=150.0,
                score=0.8,
            ),
        ],
        nonce="fixed-nonce",
    )


def _completion(content: str | None) -> SimpleNamespace:
    return SimpleNamespace(
        choices=[SimpleNamespace(message=SimpleNamespace(content=content))]
    )


def _planner(**kwargs) -> OpenAIItineraryPlanner:
    return OpenAIItineraryPlanner(api_key="test-key", model="gpt-4o-mini", **kwargs)


@pytest.mark.asyncio
async def test_plan_day_parses_structured_day_plan(monkeypatch):
    planner = _planner()
    captured_kwargs: dict = {}

    async def fake_create(**kwargs):
        captured_kwargs.update(kwargs)
        return _completion(
            json.dumps(
                {
                    "theme": "Bridges and water",
                    "description": "A gentle lakeside day.",
                    "stops": [
                        {"candidate_id": "offer-boat-cruise", "slot_index": 0},
                        {"candidate_id": "chapel-bridge", "slot_index": 1},
                    ],
                }
            )
        )

    monkeypatch.setattr(planner._client.chat.completions, "create", fake_create)

    plan = await planner.plan_day(_plan_request())

    assert plan.theme == "Bridges and water"
    assert plan.description == "A gentle lakeside day."
    assert [(stop.candidate_id, stop.slot_index) for stop in plan.stops] == [
        ("offer-boat-cruise", 0),
        ("chapel-bridge", 1),
    ]
    assert captured_kwargs["model"] == "gpt-4o-mini"
    assert captured_kwargs["temperature"] == 0.9
    assert captured_kwargs["response_format"]["json_schema"]["strict"] is True
    user_message = captured_kwargs["messages"][1]["content"]
    assert "fixed-nonce" in user_message
    assert "offer-boat-cruise" in user_message


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "content",
    [None, "not json", '{"theme": null}'],
    ids=["empty", "not-json", "missing-stops"],
)
async def test_plan_day_raises_planner_error_on_bad_content(monkeypatch, content):
    planner = _planner()

    async def fake_create(**kwargs):
        return _completion(content)

    monkeypatch.setattr(planner._client.chat.completions, "create", fake_create)

    with pytest.raises(PlannerError):
        await planner.plan_day(_plan_request())


@pytest.mark.asyncio
async def test_plan_day_raises_planner_error_on_api_failure(monkeypatch):
    planner = _planner()

    async def fake_create(**kwargs):
        raise RuntimeError("api unavailable")

    monkeypatch.setattr(planner._client.chat.completions, "create", fake_create)

    with pytest.raises(PlannerError):
        await planner.plan_day(_plan_request())


@pytest.mark.asyncio
async def test_plan_day_raises_planner_error_on_timeout(monkeypatch):
    planner = _planner(timeout_seconds=0.01)

    async def fake_create(**kwargs):
        await asyncio.sleep(1)
        return _completion("{}")

    monkeypatch.setattr(planner._client.chat.completions, "create", fake_create)

    with pytest.raises(PlannerError):
        await planner.plan_day(_plan_request())
