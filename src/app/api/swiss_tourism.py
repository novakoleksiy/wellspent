from dataclasses import asdict

from fastapi import APIRouter, HTTPException, Request

from app.core.db import CurrentUser, SwissTourism
from app.core.rate_limit import swiss_limit
from app.schemas.schemas import (
    AttractionListOut,
    AttractionOut,
    DestinationListOut,
    DestinationOut,
    FacetSnapshotOut,
    OfferListOut,
    OfferOut,
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


def _offer_out(offer: object) -> OfferOut:
    return OfferOut(**asdict(offer))


def _split_csv(value: str | None) -> list[str] | None:
    if value is None:
        return None
    values = [item.strip() for item in value.split(",") if item.strip()]
    return values or None


# ── Destinations ─────────────────────────────────────


@router.get("/destinations", response_model=DestinationListOut)
@swiss_limit
async def list_destinations(
    request: Request,
    user: CurrentUser,
    client: SwissTourism,
    query: str | None = None,
    language: str = "en",
    page: int = 1,
    page_size: int = 10,
):
    result = await client.list_destinations(
        query=query, language=language, page=page, page_size=page_size
    )
    return DestinationListOut(
        data=[_destination_out(d) for d in result.data],
        pagination=_pagination_out(result.meta),
    )


@router.get("/destinations/{destination_id}", response_model=DestinationOut)
@swiss_limit
async def get_destination(
    request: Request,
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
@swiss_limit
async def list_attractions(
    request: Request,
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
@swiss_limit
async def get_attraction(
    request: Request,
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
@swiss_limit
async def list_tours(
    request: Request,
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
@swiss_limit
async def get_tour(
    request: Request,
    tour_id: str,
    user: CurrentUser,
    client: SwissTourism,
):
    tour = await client.get_tour(tour_id)
    if not tour:
        raise HTTPException(404, "Tour not found")
    return _tour_out(tour)


# ── Offers ───────────────────────────────────────────


@router.get("/offers", response_model=OfferListOut)
@swiss_limit
async def list_offers(
    request: Request,
    user: CurrentUser,
    client: SwissTourism,
    query: str | None = None,
    page: int = 1,
    page_size: int = 10,
):
    result = await client.list_offers(query=query, page=page, page_size=page_size)
    return OfferListOut(
        data=[_offer_out(o) for o in result.data],
        pagination=_pagination_out(result.meta),
    )


@router.get("/offers/{offer_id}", response_model=OfferOut)
@swiss_limit
async def get_offer(
    request: Request,
    offer_id: str,
    user: CurrentUser,
    client: SwissTourism,
):
    offer = await client.get_offer(offer_id)
    if not offer:
        raise HTTPException(404, "Offer not found")
    return _offer_out(offer)
