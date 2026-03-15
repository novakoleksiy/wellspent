from dataclasses import asdict

from fastapi import APIRouter, HTTPException

from app.core.db import CurrentUser, SwissTourism
from app.schemas.schemas import (
    AttractionListOut,
    AttractionOut,
    DestinationListOut,
    DestinationOut,
    PaginationOut,
    TourListOut,
    TourOut,
)

router = APIRouter(prefix="/swiss", tags=["swiss-tourism"])


# ── Destinations ─────────────────────────────────────


@router.get("/destinations", response_model=DestinationListOut)
async def list_destinations(
    user: CurrentUser,
    client: SwissTourism,
    query: str | None = None,
    page: int = 1,
    page_size: int = 10,
):
    result = await client.list_destinations(query=query, page=page, page_size=page_size)
    return DestinationListOut(
        data=[DestinationOut(**asdict(d)) for d in result.data],
        pagination=PaginationOut(**asdict(result.meta)),
    )


@router.get("/destinations/{destination_id}", response_model=DestinationOut)
async def get_destination(
    destination_id: str,
    user: CurrentUser,
    client: SwissTourism,
):
    dest = await client.get_destination(destination_id)
    if not dest:
        raise HTTPException(404, "Destination not found")
    return DestinationOut(**asdict(dest))


# ── Attractions ──────────────────────────────────────


@router.get("/attractions", response_model=AttractionListOut)
async def list_attractions(
    user: CurrentUser,
    client: SwissTourism,
    query: str | None = None,
    destination_id: str | None = None,
    page: int = 1,
    page_size: int = 10,
):
    result = await client.list_attractions(
        query=query, destination_id=destination_id, page=page, page_size=page_size
    )
    return AttractionListOut(
        data=[AttractionOut(**asdict(a)) for a in result.data],
        pagination=PaginationOut(**asdict(result.meta)),
    )


@router.get("/attractions/{attraction_id}", response_model=AttractionOut)
async def get_attraction(
    attraction_id: str,
    user: CurrentUser,
    client: SwissTourism,
):
    attr = await client.get_attraction(attraction_id)
    if not attr:
        raise HTTPException(404, "Attraction not found")
    return AttractionOut(**asdict(attr))


# ── Tours ────────────────────────────────────────────


@router.get("/tours", response_model=TourListOut)
async def list_tours(
    user: CurrentUser,
    client: SwissTourism,
    query: str | None = None,
    page: int = 1,
    page_size: int = 10,
):
    result = await client.list_tours(query=query, page=page, page_size=page_size)
    return TourListOut(
        data=[TourOut(**asdict(t)) for t in result.data],
        pagination=PaginationOut(**asdict(result.meta)),
    )


@router.get("/tours/{tour_id}", response_model=TourOut)
async def get_tour(
    tour_id: str,
    user: CurrentUser,
    client: SwissTourism,
):
    tour = await client.get_tour(tour_id)
    if not tour:
        raise HTTPException(404, "Tour not found")
    return TourOut(**asdict(tour))
