from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field

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
    travel_styles: list[str] = Field(default_factory=list)
    accommodation_types: list[str] = Field(default_factory=lambda: ["hotel"])
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
    mood: Literal[
        "culture_history",
        "nature_outdoors",
        "food_markets",
        "slow_relaxing",
    ] = "culture_history"
    transport_mode: Literal["car", "public_transport"] = "public_transport"
    trip_length: Literal["2_3_hours", "half_day", "full_day"] | None = None
    group_type: Literal["solo", "couple", "family", "friends"] = "solo"


class TimelineItem(BaseModel):
    id: str
    kind: Literal["activity", "transport"]
    time: str
    title: str
    category: str
    cost: float
    duration_text: str | None = None
    transport_mode: str | None = None
    notes: str | None = None
    url: str | None = None
    refreshable: bool = False


class ItineraryActivity(BaseModel):
    id: str | None = None
    time: str
    title: str
    category: str
    cost: float
    url: str | None = None


class ItineraryDay(BaseModel):
    day: int
    date: str
    activities: list[ItineraryActivity] = Field(default_factory=list)
    timeline_items: list[TimelineItem] = Field(default_factory=list)


class RecommendationItinerary(BaseModel):
    days: list[ItineraryDay]
    estimated_total: float
    currency: str


class RefreshRecommendationItemRequest(RecommendRequest):
    itinerary: RecommendationItinerary
    item_id: str


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
    shared_at: datetime | None = None
    model_config = {"from_attributes": True}


class TripShareUpdate(BaseModel):
    shared: bool


class CommunityTripOut(BaseModel):
    id: int
    title: str
    destination: str
    description: str | None
    itinerary: dict[str, Any] | None
    created_at: datetime
    shared_at: datetime
    owner_name: str


class Recommendation(BaseModel):
    title: str
    destination: str
    description: str
    itinerary: RecommendationItinerary
    match_score: float
    highlights: list[str]


# ── Waitlist ────────────────────────────────────────


class JoinWaitlistRequest(BaseModel):
    email: EmailStr
    name: str | None = None


class WaitlistResponse(BaseModel):
    message: str


# ── Swiss Tourism ───────────────────────────────────


class GeoOut(BaseModel):
    latitude: float
    longitude: float


class ImageOut(BaseModel):
    url: str
    title: str = ""


class PaginationOut(BaseModel):
    page_number: int
    page_size: int
    total_elements: int
    total_pages: int


class DestinationOut(BaseModel):
    id: str
    name: str
    category: str | None = None
    description: str
    geo: GeoOut | None = None
    images: list[ImageOut] = Field(default_factory=list)
    url: str = ""


class DestinationListOut(BaseModel):
    data: list[DestinationOut]
    pagination: PaginationOut


class AttractionOut(BaseModel):
    id: str
    name: str
    description: str
    category: str = ""
    geo: GeoOut | None = None
    images: list[ImageOut] = Field(default_factory=list)
    url: str = ""


class AttractionListOut(BaseModel):
    data: list[AttractionOut]
    pagination: PaginationOut


class TourOut(BaseModel):
    id: str
    name: str
    description: str
    distance_km: float | None = None
    duration: str = ""
    geo: GeoOut | None = None
    images: list[ImageOut] = Field(default_factory=list)
    url: str = ""


class TourListOut(BaseModel):
    data: list[TourOut]
    pagination: PaginationOut
