from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class CandidateItem:
    id: str
    name: str
    category: str
    description: str | None
    source: str  # "attraction" | "offer"
    distance_m: float | None
    score: float


@dataclass
class PlanRequest:
    destination_name: str
    mood: str
    group_type: str
    trip_length: str
    travelers: int
    slot_count: int
    season: str
    candidates: list[CandidateItem] = field(default_factory=list)
    # Random token included in every prompt so identical requests still vary.
    nonce: str = ""


@dataclass
class PlannedStop:
    candidate_id: str
    slot_index: int


@dataclass
class DayPlan:
    theme: str | None
    description: str | None
    stops: list[PlannedStop] = field(default_factory=list)


class PlannerError(Exception):
    """Raised when the planner cannot produce a usable day plan."""


class ItineraryPlanner(Protocol):
    async def plan_day(self, request: PlanRequest) -> DayPlan: ...
