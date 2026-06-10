import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BOARD_META, type BoardKind } from "../boardItems";
import AppShell from "../components/AppShell";
import BoardCard from "../components/BoardCard";
import CommunityTripModal from "../components/CommunityTripModal";
import OfferPreviewModal from "../components/OfferPreviewModal";
import TourPreviewModal from "../components/TourPreviewModal";
import { useColumnCount } from "../hooks/useColumnCount";
import { useExploreBoard } from "../hooks/useExploreBoard";
import type { CommunityTripOut, OfferOut, TourOut } from "../types";

type BoardFilter = "all" | BoardKind;

const FILTERS: { key: BoardFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "trip", label: "Trips" },
    { key: "tour", label: "Tours" },
    { key: "offer", label: "Offers" },
];

/**
 * Splits items into `columnCount` round-robin buckets (item i → column i %
 * columnCount). Because placement depends only on a card's index, appending
 * items never moves an existing card between columns — the layout stays steady.
 */
function bucketByColumn<T>(items: T[], columnCount: number): T[][] {
    const buckets: T[][] = Array.from({ length: columnCount }, () => []);
    items.forEach((item, index) => {
        buckets[index % columnCount].push(item);
    });
    return buckets;
}

export default function ExplorePage() {
    const [filter, setFilter] = useState<BoardFilter>("all");
    const [selectedTrip, setSelectedTrip] = useState<CommunityTripOut | null>(null);
    const [selectedTour, setSelectedTour] = useState<TourOut | null>(null);
    const [selectedOffer, setSelectedOffer] = useState<OfferOut | null>(null);
    const { items, initialLoading, loadingMore, hasMore, error, sentinelRef } =
        useExploreBoard(
            {
                onOpenTrip: setSelectedTrip,
                onOpenTour: setSelectedTour,
                onOpenOffer: setSelectedOffer,
            },
            filter,
        );
    const columnCount = useColumnCount();

    const visibleItems = useMemo(
        () => (filter === "all" ? items : items.filter((item) => item.kind === filter)),
        [items, filter],
    );

    const columns = useMemo(
        () => bucketByColumn(visibleItems, columnCount),
        [visibleItems, columnCount],
    );

    return (
        <AppShell
            title="Explore"
            description="Trips, tours, and offers from across Switzerland. Filter by type or keep scrolling."
            actions={
                <Link to="/?plan=1" className="ws-btn-primary px-5 py-3 text-sm">
                    Plan a trip
                </Link>
            }
        >
            <div className="space-y-6">
                <div className="sticky top-4 z-20 flex flex-wrap gap-2 rounded-full border border-[var(--ws-line)] bg-[rgba(255,253,248,0.85)] p-2 shadow-sm backdrop-blur">
                    {FILTERS.map(({ key, label }) => {
                        const active = filter === key;
                        const accent = key === "all" ? "var(--ws-ink)" : BOARD_META[key].accent;
                        return (
                            <button
                                key={key}
                                type="button"
                                onClick={() => setFilter(key)}
                                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                                    active
                                        ? "text-white"
                                        : "text-[var(--ws-muted)] hover:text-[var(--ws-ink)]"
                                }`}
                                style={active ? { background: accent } : undefined}
                            >
                                {label}
                            </button>
                        );
                    })}
                </div>

                {error && <p className="ws-error px-4 py-3 text-sm">{error}</p>}

                {initialLoading ? (
                    <div className="flex items-start gap-4">
                        {bucketByColumn(Array.from({ length: 12 }), columnCount).map(
                            (bucket, columnIndex) => (
                                <div
                                    key={columnIndex}
                                    className="flex min-w-0 flex-1 flex-col gap-4"
                                >
                                    {bucket.map((_, index) => (
                                        <div
                                            key={index}
                                            className="animate-pulse rounded-[1.5rem] bg-[var(--ws-cream)]"
                                            style={{ height: `${160 + (index % 4) * 40}px` }}
                                        />
                                    ))}
                                </div>
                            ),
                        )}
                    </div>
                ) : visibleItems.length === 0 ? (
                    <div className="rounded-[1.75rem] border border-dashed border-[var(--ws-line)] bg-[rgba(255,244,239,0.6)] px-6 py-12 text-center">
                        <p className="ws-mono text-[var(--ws-muted)]">Nothing here yet</p>
                        <p className="mt-3 text-base leading-7 text-[var(--ws-muted)]">
                            No {filter === "all" ? "items" : `${filter}s`} to show right now. Try another filter.
                        </p>
                    </div>
                ) : (
                    <div className="flex items-start gap-4">
                        {columns.map((bucket, columnIndex) => (
                            <div
                                key={columnIndex}
                                className="flex min-w-0 flex-1 flex-col gap-4"
                            >
                                {bucket.map((item) => (
                                    <BoardCard key={item.key} item={item} />
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {/* Infinite-scroll sentinel — tours & offers keep loading in the background. */}
                <div ref={sentinelRef} aria-hidden className="h-px" />

                {loadingMore && (
                    <p className="text-center text-sm text-[var(--ws-muted)]">Loading more…</p>
                )}
                {!initialLoading && !hasMore && visibleItems.length > 0 && (
                    <p className="text-center text-sm text-[var(--ws-muted)]">
                        You've reached the end of the board.
                    </p>
                )}

            </div>

            {selectedTrip && (
                <CommunityTripModal
                    trip={selectedTrip}
                    onClose={() => setSelectedTrip(null)}
                />
            )}
            {selectedTour && (
                <TourPreviewModal tour={selectedTour} onClose={() => setSelectedTour(null)} />
            )}
            {selectedOffer && (
                <OfferPreviewModal offer={selectedOffer} onClose={() => setSelectedOffer(null)} />
            )}
        </AppShell>
    );
}
