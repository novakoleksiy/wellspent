from dataclasses import asdict

from fastapi import APIRouter, HTTPException

from app.core.db import CurrentUser, SwissTourism
from app.schemas.schemas import (
    AttractionListOut,
    AttractionOut,
    DestinationListOut,
    DestinationOut,
    FacetSnapshotOut,
    PaginationOut,
    TourListOut,
    TourOut,
)
from app.services.recommendation_facets import get_attraction_facets_snapshot

router = APIRouter(prefix="/swiss", tags=["swiss-tourism"])


def _pagination_out(pagination: object) -> PaginationOut:
    return PaginationOut(**asdict(pagination))


def _destination_out(destination: object) -> DestinationOut:
    return DestinationOut(**asdict(destination))


def _attraction_out(attraction: object) -> AttractionOut:
    return AttractionOut(**asdict(attraction))


def _tour_out(tour: object) -> TourOut:
    return TourOut(**asdict(tour))


def _split_csv(value: str | None) -> list[str] | None:
    if value is None:
        return None
    values = [item.strip() for item in value.split(",") if item.strip()]
    return values or None


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
        data=[_destination_out(d) for d in result.data],
        pagination=_pagination_out(result.meta),
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
    return _destination_out(dest)


# ── Attractions ──────────────────────────────────────


@router.get("/attractions", response_model=AttractionListOut)
async def list_attractions(
    user: CurrentUser,
    client: SwissTourism,
    query: str | None = None,
    destination_id: str | None = None,
    facets: str | None = None,
    facet_filter: str | None = None,
    facets_translate: bool | None = None,
    page: int = 1,
    page_size: int = 10,
):
    result = await client.list_attractions(
        query=query,
        destination_id=destination_id,
        facets=_split_csv(facets),
        facet_filter=facet_filter,
        facets_translate=facets_translate,
        page=page,
        page_size=page_size,
    )
    return AttractionListOut(
        data=[_attraction_out(a) for a in result.data],
        pagination=_pagination_out(result.meta),
    )


@router.get("/attractions/facets", response_model=FacetSnapshotOut)
async def get_attraction_facets(user: CurrentUser):
    snapshot = get_attraction_facets_snapshot()
    if snapshot is None:
        raise HTTPException(503, "Swiss Tourism attraction facets are not available")
    return FacetSnapshotOut(**asdict(snapshot))


@router.get("/attractions/{attraction_id}", response_model=AttractionOut)
async def get_attraction(
    attraction_id: str,
    user: CurrentUser,
    client: SwissTourism,
):
    attr = await client.get_attraction(attraction_id)
    if not attr:
        raise HTTPException(404, "Attraction not found")
    return _attraction_out(attr)


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
        data=[_tour_out(t) for t in result.data],
        pagination=_pagination_out(result.meta),
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
    return _tour_out(tour)
