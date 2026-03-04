from datetime import timedelta

from fastapi import APIRouter, HTTPException
from sqlalchemy import select

from app.core.db import CurrentUser, Db
from app.models.user import Trip, TripStatus
from app.schemas.schemas import Recommendation, RecommendRequest, TripCreate, TripOut

router = APIRouter(prefix="/trips", tags=["trips"])


@router.post("/recommend", response_model=list[Recommendation])
async def recommend(body: RecommendRequest, user: CurrentUser):
    """
    Returns mock recommendations for now.
    Will be replaced by LLM agent + real provider searches.
    """
    dest = body.destination or "Barcelona, Spain"
    num_days = (body.end_date - body.start_date).days or 1

    days = []
    for i in range(num_days):
        d = body.start_date + timedelta(days=i)
        days.append(
            {
                "day": i + 1,
                "date": d.isoformat(),
                "activities": [
                    {
                        "time": "09:00",
                        "title": f"Morning in {dest}",
                        "category": "activity",
                        "cost": 30,
                    },
                    {
                        "time": "12:30",
                        "title": "Local lunch",
                        "category": "meal",
                        "cost": 20,
                    },
                    {
                        "time": "15:00",
                        "title": f"Explore {dest}",
                        "category": "activity",
                        "cost": 40,
                    },
                ],
            }
        )

    return [
        Recommendation(
            title=f"Discover {dest}",
            destination=dest,
            description=f"{num_days}-day trip to {dest}, tailored to your style.",
            itinerary={
                "days": days,
                "estimated_total": num_days * 90 + 400,
                "currency": "USD",
            },
            match_score=0.85,
            highlights=["Great food scene", "Walkable city", "Rich culture"],
        )
    ]


@router.post("/", response_model=TripOut, status_code=201)
async def create_trip(body: TripCreate, user: CurrentUser, db: Db):
    trip = Trip(
        user_id=user.id,
        title=body.title,
        destination=body.destination,
        description=body.description,
        itinerary=body.itinerary,
        status=TripStatus.DRAFT,
    )
    db.add(trip)
    await db.flush()
    await db.refresh(trip)
    return trip


@router.get("/", response_model=list[TripOut])
async def list_trips(user: CurrentUser, db: Db):
    result = await db.execute(
        select(Trip).where(Trip.user_id == user.id).order_by(Trip.created_at.desc())
    )
    return result.scalars().all()


@router.get("/{trip_id}", response_model=TripOut)
async def get_trip(trip_id: int, user: CurrentUser, db: Db):
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == user.id)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(404, "Trip not found")
    return trip


@router.delete("/{trip_id}", status_code=204)
async def delete_trip(trip_id: int, user: CurrentUser, db: Db):
    result = await db.execute(
        select(Trip).where(Trip.id == trip_id, Trip.user_id == user.id)
    )
    trip = result.scalar_one_or_none()
    if not trip:
        raise HTTPException(404, "Trip not found")
    await db.delete(trip)
