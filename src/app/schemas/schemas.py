from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, EmailStr


# ── Auth ─────────────────────────────────────────────


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── User ─────────────────────────────────────────────


class Preferences(BaseModel):
    budget_tier: str = "mid"  # budget | mid | luxury
    travel_styles: list[str] = []  # adventure, cultural, relaxation, foodie
    accommodation_types: list[str] = ["hotel"]  # hotel, airbnb, hostel
    pace: str = "moderate"  # relaxed | moderate | packed
    notes: str = ""  # free text for future LLM processing


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    preferences: dict[str, Any] | None
    created_at: datetime
    model_config = {"from_attributes": True}


# ── Trip ─────────────────────────────────────────────


class RecommendRequest(BaseModel):
    destination: str | None = None  # None = surprise me
    start_date: date
    end_date: date
    travelers: int = 1
    budget_max: float | None = None
    notes: str = ""


class TripCreate(BaseModel):
    title: str
    destination: str
    description: str | None = None
    itinerary: dict[str, Any] | None = None


class TripOut(BaseModel):
    id: int
    title: str
    destination: str
    status: str
    description: str | None
    itinerary: dict[str, Any] | None
    created_at: datetime
    model_config = {"from_attributes": True}


class Recommendation(BaseModel):
    title: str
    destination: str
    description: str
    itinerary: dict[str, Any]
    match_score: float
    highlights: list[str]
