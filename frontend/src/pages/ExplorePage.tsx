import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BOARD_META, type BoardKind } from "../boardItems";
import AppShell from "../components/AppShell";
import BoardCard from "../components/BoardCard";
import { useColumnCount } from "../hooks/useColumnCount";
import { useExploreBoard } from "../hooks/useExploreBoard";

const nearbyIdeas = [
    {
        name: "Lucerne",
        description: "Lake views, an easy old-town stroll, and mountain access for a low-friction weekend.",
    },
    {
        name: "Interlaken",
        description: "A strong base for scenic rail rides, alpine walks, and a more active short escape.",
    },
    {
        name: "Lausanne",
        description: "Vineyards, waterfront time, and a slower city break with quick regional connections.",
    },
];

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
    const navigate = useNavigate();

    const openPlan = useCallback(
        (destination: string) => {
            const query = destination.trim();
            navigate(query ? `/plan?destination=${encodeURIComponent(query)}` : "/plan");
        },
        [navigate],
    );

    const [filter, setFilter] = useState<BoardFilter>("all");
    const { items, initialLoading, loadingMore, hasMore, error, sentinelRef } =
        useExploreBoard(openPlan, filter);
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
            description="A living board of trips, tours, and offers from across Switzerland. Filter by type, or just keep scrolling."
            actions={
                <Link to="/plan" className="ws-btn-primary px-5 py-3 text-sm">
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

                <section className="ws-surface p-6 sm:p-7">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="ws-mono text-[var(--ws-orange)]">Explore Nearby</p>
                            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                                A few easy places to start.
                            </h2>
                        </div>
                        <Link
                            to="/plan"
                            className="text-sm font-medium text-[var(--ws-muted)] transition hover:text-[var(--ws-ink)]"
                        >
                            Open planner
                        </Link>
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-3">
                        {nearbyIdeas.map((idea) => (
                            <article key={idea.name} className="ws-chip-card px-5 py-5">
                                <p className="ws-mono text-[var(--ws-muted)]">Nearby idea</p>
                                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                                    {idea.name}
                                </h3>
                                <p className="mt-4 text-sm leading-6 text-[var(--ws-muted)]">
                                    {idea.description}
                                </p>
                                <button
                                    type="button"
                                    onClick={() => openPlan(idea.name)}
                                    className="ws-btn-primary mt-5 px-4 py-2 text-sm"
                                >
                                    Explore {idea.name}
                                </button>
                            </article>
                        ))}
                    </div>
                </section>
            </div>
        </AppShell>
    );
}
