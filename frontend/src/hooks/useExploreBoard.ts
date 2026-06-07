import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listOffers, listTours } from "../api/swissTourism";
import { listCommunityTrips } from "../api/trips";
import {
    communityTripToBoardItem,
    interleave,
    offerToBoardItem,
    tourEntryToBoardItem,
    type BoardItem,
    type BoardKind,
} from "../boardItems";
import { groupToursByRoute } from "../tourFormat";
import type { CommunityTripOut, OfferOut, TourOut } from "../types";

const PAGE_SIZE = 12;

export interface ExploreBoard {
    items: BoardItem[];
    initialLoading: boolean;
    loadingMore: boolean;
    hasMore: boolean;
    error: string;
    /** Attach to a bottom sentinel element to drive infinite scroll. */
    sentinelRef: (node: HTMLElement | null) => void;
}

/**
 * Loads community trips (finite) plus paginated tours & offers, and exposes a
 * single interleaved, type-tagged feed for the masonry board.
 *
 * Pagination is filter-aware: it only advances the sources the active filter
 * actually renders (tours and/or offers). Otherwise — e.g. on the finite
 * "Trips" filter — loading more would never grow the visible board, so the
 * scroll sentinel would stay in view and loop until the API rate-limits us.
 */
export function useExploreBoard(
    openPlan: (destination: string) => void,
    activeFilter: "all" | BoardKind,
): ExploreBoard {
    const [communityTrips, setCommunityTrips] = useState<CommunityTripOut[]>([]);
    const [tours, setTours] = useState<TourOut[]>([]);
    const [offers, setOffers] = useState<OfferOut[]>([]);
    const [hasMoreTours, setHasMoreTours] = useState(true);
    const [hasMoreOffers, setHasMoreOffers] = useState(true);
    const [initialLoading, setInitialLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState("");

    // Pagination cursors live in refs so loadMore stays stable across renders.
    const tourPageRef = useRef(0);
    const offerPageRef = useRef(0);
    const loadingRef = useRef(false);
    // Whether the sentinel is currently within the observer's root margin. Used
    // to keep loading after a page lands if the sentinel never left the viewport
    // (IntersectionObserver only fires on transitions, not while still in view).
    const isIntersectingRef = useRef(false);

    // Whether more pages exist for the sources the current filter displays.
    const wantTours = activeFilter === "all" || activeFilter === "tour";
    const wantOffers = activeFilter === "all" || activeFilter === "offer";
    const hasMore = (wantTours && hasMoreTours) || (wantOffers && hasMoreOffers);

    const loadMore = useCallback(async () => {
        if (loadingRef.current) return;
        const canLoadTours = wantTours && hasMoreTours;
        const canLoadOffers = wantOffers && hasMoreOffers;
        // Nothing relevant left to fetch → return without touching state so the
        // continuation effect below settles instead of looping.
        if (!canLoadTours && !canLoadOffers) return;
        loadingRef.current = true;
        setLoadingMore(true);

        const requests: Promise<void>[] = [];

        if (canLoadTours) {
            const nextPage = tourPageRef.current + 1;
            requests.push(
                listTours({ page: nextPage, pageSize: PAGE_SIZE })
                    .then((res) => {
                        tourPageRef.current = nextPage;
                        setTours((prev) => [...prev, ...res.data]);
                        setHasMoreTours(
                            res.pagination.page_number < res.pagination.total_pages,
                        );
                    })
                    .catch(() => {
                        setHasMoreTours(false);
                    }),
            );
        }

        if (canLoadOffers) {
            const nextPage = offerPageRef.current + 1;
            requests.push(
                listOffers({ page: nextPage, pageSize: PAGE_SIZE })
                    .then((res) => {
                        offerPageRef.current = nextPage;
                        setOffers((prev) => [...prev, ...res.data]);
                        setHasMoreOffers(
                            res.pagination.page_number < res.pagination.total_pages,
                        );
                    })
                    .catch(() => {
                        setHasMoreOffers(false);
                    }),
            );
        }

        await Promise.all(requests);
        loadingRef.current = false;
        setLoadingMore(false);
        setInitialLoading(false);
    }, [wantTours, wantOffers, hasMoreTours, hasMoreOffers]);

    // The IntersectionObserver only fires on transitions, so if a page lands
    // while the sentinel is still in view it won't re-fire. Once a load settles,
    // keep loading until enough content pushes the sentinel past the root margin.
    // Deferred so layout (and the observer's intersection state) settles first.
    useEffect(() => {
        if (loadingMore || !hasMore) return;
        const id = window.setTimeout(() => {
            if (isIntersectingRef.current) loadMore();
        }, 0);
        return () => window.clearTimeout(id);
    }, [loadingMore, hasMore, loadMore]);

    // Community trips are finite; fetch them once. The first page of tours/offers
    // is loaded by the sentinel observer below (which fires on mount).
    useEffect(() => {
        let cancelled = false;
        listCommunityTrips()
            .then((trips) => {
                if (!cancelled) setCommunityTrips(trips);
            })
            .catch((err: unknown) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : "Unable to load the board");
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const observerRef = useRef<IntersectionObserver | null>(null);
    const sentinelRef = useCallback(
        (node: HTMLElement | null) => {
            if (observerRef.current) {
                observerRef.current.disconnect();
                observerRef.current = null;
            }
            if (node) {
                observerRef.current = new IntersectionObserver(
                    (entries) => {
                        const intersecting = entries[0]?.isIntersecting ?? false;
                        isIntersectingRef.current = intersecting;
                        if (intersecting) {
                            loadMore();
                        }
                    },
                    { rootMargin: "400px" },
                );
                observerRef.current.observe(node);
            }
        },
        [loadMore],
    );

    const items = useMemo(() => {
        const tripItems = communityTrips.map((trip) =>
            communityTripToBoardItem(trip, openPlan),
        );
        const tourItems = groupToursByRoute(tours).map(tourEntryToBoardItem);
        const offerItems = offers.map(offerToBoardItem);
        return interleave(tripItems, tourItems, offerItems);
    }, [communityTrips, tours, offers, openPlan]);

    return { items, initialLoading, loadingMore, hasMore, error, sentinelRef };
}
