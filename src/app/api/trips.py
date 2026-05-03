from fastapi import APIRouter, HTTPException

from app.core.db import CurrentUser, FolderRepo, SwissTourism, TripRepo
from app.schemas.schemas import (
    CommunityTripOut,
    Recommendation,
    RecommendRequest,
    RefreshRecommendationItemRequest,
    TripCompletionUpdate,
    TripCreate,
    TripFolderUpdate,
    TripOut,
    TripShareUpdate,
    TripStatusUpdate,
)
from app.services import recommendation_service
from app.services.folder_service import FolderNotFound, move_trip_to_folder
from app.services.trip_service import (
    TripNotFound,
    complete_trip,
    create_trip,
    delete_trip,
    get_trip,
    list_shared_trips,
    list_trips,
    set_trip_shared,
    set_trip_status,
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
        mood=body.mood,
        transport_mode=body.transport_mode,
        trip_length=body.trip_length,
        group_type=body.group_type,
    )
    return [Recommendation(**r) for r in recs]


@router.post("/recommend/refresh-item", response_model=Recommendation)
async def refresh_recommendation_item(
    body: RefreshRecommendationItemRequest, user: CurrentUser, client: SwissTourism
):
    rec = await recommendation_service.refresh_recommendation_item(
        client,
        preferences=user.preferences,
        destination=body.destination,
        start_date=body.start_date,
        end_date=body.end_date,
        travelers=body.travelers,
        mood=body.mood,
        transport_mode=body.transport_mode,
        trip_length=body.trip_length,
        group_type=body.group_type,
        itinerary=body.itinerary.model_dump(),
        item_id=body.item_id,
    )
    return Recommendation(**rec)


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


@router.get("/community", response_model=list[CommunityTripOut])
async def list_community(user: CurrentUser, repo: TripRepo):
    return await list_shared_trips(repo, user.id)


@router.get("/{trip_id}", response_model=TripOut)
async def get_one(trip_id: int, user: CurrentUser, repo: TripRepo):
    try:
        return await get_trip(repo, user.id, trip_id)
    except TripNotFound:
        raise HTTPException(404, "Trip not found")


@router.patch("/{trip_id}/share", response_model=TripOut)
async def set_share_state(
    trip_id: int, body: TripShareUpdate, user: CurrentUser, repo: TripRepo
):
    try:
        return await set_trip_shared(repo, user.id, trip_id, shared=body.shared)
    except TripNotFound:
        raise HTTPException(404, "Trip not found")


@router.patch("/{trip_id}/status", response_model=TripOut)
async def set_status(
    trip_id: int, body: TripStatusUpdate, user: CurrentUser, repo: TripRepo
):
    try:
        return await set_trip_status(repo, user.id, trip_id, status=body.status)
    except TripNotFound:
        raise HTTPException(404, "Trip not found")


@router.patch("/{trip_id}/complete", response_model=TripOut)
async def complete(
    trip_id: int, body: TripCompletionUpdate, user: CurrentUser, repo: TripRepo
):
    try:
        return await complete_trip(
            repo,
            user.id,
            trip_id,
            rating=body.rating,
            comment=body.comment,
            image_urls=body.image_urls,
        )
    except TripNotFound:
        raise HTTPException(404, "Trip not found")


@router.patch("/{trip_id}/folder", response_model=TripOut)
async def set_folder(
    trip_id: int,
    body: TripFolderUpdate,
    user: CurrentUser,
    trip_repo: TripRepo,
    folder_repo: FolderRepo,
):
    try:
        return await move_trip_to_folder(
            trip_repo,
            folder_repo,
            user.id,
            trip_id,
            folder_id=body.folder_id,
        )
    except FolderNotFound:
        raise HTTPException(404, "Folder not found")
    except TripNotFound:
        raise HTTPException(404, "Trip not found")


@router.delete("/{trip_id}", status_code=204)
async def delete(trip_id: int, user: CurrentUser, repo: TripRepo):
    try:
        await delete_trip(repo, user.id, trip_id)
    except TripNotFound:
        raise HTTPException(404, "Trip not found")
