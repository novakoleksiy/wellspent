from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, EmailStr, Field, field_validator

MAX_REVIEW_COMMENT_LENGTH = 2000
MAX_REVIEW_IMAGE_URLS = 10
MAX_REVIEW_IMAGE_URL_LENGTH = 2048
MAX_ITINERARY_DAYS = 14
MAX_ITINERARY_ACTIVITIES_PER_DAY = 8
MAX_ITINERARY_TIMELINE_ITEMS_PER_DAY = 16

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
    id: str = Field(max_length=128)
    kind: Literal["activity", "transport"]
    time: str = Field(max_length=32)
    title: str = Field(max_length=255)
    category: str = Field(max_length=80)
    cost: float = Field(ge=0, le=100_000)
    duration_text: str | None = Field(default=None, max_length=120)
    transport_mode: str | None = Field(default=None, max_length=40)
    notes: str | None = Field(default=None, max_length=500)
    url: str | None = Field(default=None, max_length=2048)
    refreshable: bool = False


class ItineraryActivity(BaseModel):
    id: str | None = Field(default=None, max_length=128)
    time: str = Field(max_length=32)
    title: str = Field(max_length=255)
    category: str = Field(max_length=80)
    cost: float = Field(ge=0, le=100_000)
    url: str | None = Field(default=None, max_length=2048)


class ItineraryDay(BaseModel):
    day: int = Field(ge=1, le=MAX_ITINERARY_DAYS)
    date: str = Field(max_length=32)
    activities: list[ItineraryActivity] = Field(
        default_factory=list, max_length=MAX_ITINERARY_ACTIVITIES_PER_DAY
    )
    timeline_items: list[TimelineItem] = Field(
        default_factory=list, max_length=MAX_ITINERARY_TIMELINE_ITEMS_PER_DAY
    )


class RecommendationItinerary(BaseModel):
    days: list[ItineraryDay] = Field(max_length=MAX_ITINERARY_DAYS)
    estimated_total: float = Field(ge=0, le=1_000_000)
    currency: str = Field(min_length=3, max_length=3)


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
    folder_id: int | None = None
    completion_rating: int | None = None
    completion_comment: str | None = None
    completion_image_urls: list[str] = Field(default_factory=list)
    completed_at: datetime | None = None
    model_config = {"from_attributes": True}


class TripShareUpdate(BaseModel):
    shared: bool


class TripCompletionUpdate(BaseModel):
    rating: int = Field(ge=0, le=5)
    comment: str | None = Field(default=None, max_length=MAX_REVIEW_COMMENT_LENGTH)
    image_urls: list[str] = Field(
        default_factory=list, max_length=MAX_REVIEW_IMAGE_URLS
    )

    @field_validator("image_urls")
    @classmethod
    def validate_image_urls(cls, urls: list[str]) -> list[str]:
        for url in urls:
            if len(url) > MAX_REVIEW_IMAGE_URL_LENGTH:
                raise ValueError("Image URLs must be 2048 characters or fewer")
            if not (url.startswith("https://") or url.startswith("http://")):
                raise ValueError("Image URLs must use http or https")
        return urls


class TripFolderUpdate(BaseModel):
    folder_id: int | None = None


class FolderCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class FolderUpdate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    description: str | None = None


class FolderOut(BaseModel):
    id: int
    name: str
    description: str | None
    created_at: datetime
    model_config = {"from_attributes": True}


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
