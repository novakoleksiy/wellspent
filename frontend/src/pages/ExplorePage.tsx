import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listCommunityTrips } from "../api/trips";
import AppShell from "../components/AppShell";
import { getTripHeroImageUrl } from "../tripImages";
import type { CommunityTripOut } from "../types";

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

function formatDate(date: string): string {
    return new Date(date).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
}

export default function ExplorePage() {
    const navigate = useNavigate();
    const [communityTrips, setCommunityTrips] = useState<CommunityTripOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        listCommunityTrips()
            .then(setCommunityTrips)
            .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Unable to load community trips");
            })
            .finally(() => setLoading(false));
    }, []);

    function openPlan(destination: string) {
        const query = destination.trim();
        navigate(query ? `/plan?destination=${encodeURIComponent(query)}` : "/plan");
    }

    return (
        <AppShell
            title="Explore"
            description="See what the community is sharing, then jump into a nearby idea when you are ready to plan your own version."
            actions={
                <Link
                    to="/plan"
                    className="ws-btn-primary px-5 py-3 text-sm"
                >
                    Plan a trip
                </Link>
            }
        >
            <div className="space-y-6">
                <section className="ws-surface p-6 sm:p-7">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="ws-mono text-[var(--ws-orange)]">Community Trips</p>
                            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                                Latest trips shared by other members.
                            </h2>
                        </div>
                        <span className="ws-pill px-4 py-2 text-sm font-medium">
                            {communityTrips.length}
                        </span>
                    </div>

                    {error && (
                        <p className="ws-error mt-5 px-4 py-3 text-sm">
                            {error}
                        </p>
                    )}

                    {loading ? (
                        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <div key={index} className="h-64 animate-pulse rounded-[1.75rem] bg-[var(--ws-cream)]" />
                            ))}
                        </div>
                    ) : communityTrips.length === 0 ? (
                        <div className="mt-6 rounded-[1.75rem] border border-dashed border-[var(--ws-line)] bg-[rgba(255,244,239,0.6)] px-6 py-10 text-center">
                            <p className="ws-mono text-[var(--ws-muted)]">Quiet for now</p>
                            <p className="mt-3 text-base leading-7 text-[var(--ws-muted)]">
                                Shared trips from other members will appear here as soon as the community starts publishing them.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {communityTrips.map((trip) => {
                                const heroImageUrl = getTripHeroImageUrl(trip.itinerary);

                                return (
                                    <article
                                        key={trip.id}
                                        className={heroImageUrl
                                            ? "overflow-hidden rounded-[1.75rem] border border-[var(--ws-line)] bg-[#fffdf8]"
                                            : "rounded-[1.75rem] border border-[var(--ws-line)] bg-[rgba(255,244,239,0.6)] px-5 py-5"}
                                    >
                                        {heroImageUrl && (
                                            <img
                                                src={heroImageUrl}
                                                alt={trip.destination}
                                                className="h-44 w-full object-cover"
                                                loading="lazy"
                                            />
                                        )}
                                        <div className={heroImageUrl ? "px-5 py-5" : ""}>
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <p className="text-sm font-medium text-[var(--ws-muted)]">{trip.destination}</p>
                                                    <p className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                                                        {trip.title}
                                                    </p>
                                                </div>
                                                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--ws-muted)] shadow-sm">
                                                    {formatDate(trip.shared_at)}
                                                </span>
                                            </div>

                                            <p className="mt-4 text-sm leading-6 text-[var(--ws-muted)]">
                                                {trip.description || "Shared from another member's saved itinerary."}
                                            </p>

                                            <div className="mt-5 grid gap-3 rounded-[1.5rem] bg-white/80 p-4 text-sm text-[var(--ws-muted)] sm:grid-cols-2">
                                                <div>
                                                    <p className="ws-mono text-[rgba(87,84,74,0.7)]">Shared by</p>
                                                    <p className="mt-2 font-medium text-[var(--ws-ink)]">{trip.owner_name}</p>
                                                </div>
                                                <div>
                                                    <p className="ws-mono text-[rgba(87,84,74,0.7)]">Days</p>
                                                    <p className="mt-2 font-medium text-[var(--ws-ink)]">
                                                        {trip.itinerary?.days?.length ?? 0}
                                                    </p>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => openPlan(trip.destination)}
                                                className="ws-btn-primary mt-5 px-4 py-2 text-sm"
                                            >
                                                Plan your version
                                            </button>
                                        </div>
                                    </article>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="ws-surface p-6 sm:p-7">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="ws-mono text-[var(--ws-orange)]">Explore Nearby</p>
                            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                                A few easy places to start.
                            </h2>
                        </div>
                        <Link to="/plan" className="text-sm font-medium text-[var(--ws-muted)] transition hover:text-[var(--ws-ink)]">
                            Open planner
                        </Link>
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-3">
                        {nearbyIdeas.map((idea) => (
                            <article
                                key={idea.name}
                                className="ws-chip-card px-5 py-5"
                            >
                                <p className="ws-mono text-[var(--ws-muted)]">Nearby idea</p>
                                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">{idea.name}</h3>
                                <p className="mt-4 text-sm leading-6 text-[var(--ws-muted)]">{idea.description}</p>
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
