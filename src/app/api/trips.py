from fastapi import APIRouter, HTTPException

from app.core.db import CurrentUser, SwissTourism, TripRepo
from app.schemas.schemas import Recommendation, RecommendRequest, TripCreate, TripOut
from app.services import recommendation_service
from app.services.trip_service import (
    TripNotFound,
    create_trip,
    delete_trip,
    get_trip,
    list_trips,
)

router = APIRouter(prefix="/trips", tags=["trips"])


@router.post("/recommend", response_model=list[Recommendation])
async def recommend(body: RecommendRequest, user: CurrentUser, client: SwissTourism):
    recs = await recommendation_service.recommend(
        client,
        preferences=user.preferences,
        destination=body.destination,
        start_date=body.start_date,
        end_date=body.end_date,
        travelers=body.travelers,
    )
    return [Recommendation(**r) for r in recs]


@router.post("/", response_model=TripOut, status_code=201)
async def create(body: TripCreate, user: CurrentUser, repo: TripRepo):
    return await create_trip(
        repo,
        user.id,
        title=body.title,
        destination=body.destination,
        description=body.description,
        itinerary=body.itinerary,
    )


@router.get("/", response_model=list[TripOut])
async def list_all(user: CurrentUser, repo: TripRepo):
    return await list_trips(repo, user.id)


@router.get("/{trip_id}", response_model=TripOut)
async def get_one(trip_id: int, user: CurrentUser, repo: TripRepo):
    try:
        return await get_trip(repo, user.id, trip_id)
    except TripNotFound:
        raise HTTPException(404, "Trip not found")


@router.delete("/{trip_id}", status_code=204)
async def delete(trip_id: int, user: CurrentUser, repo: TripRepo):
    try:
        await delete_trip(repo, user.id, trip_id)
    except TripNotFound:
        raise HTTPException(404, "Trip not found")
