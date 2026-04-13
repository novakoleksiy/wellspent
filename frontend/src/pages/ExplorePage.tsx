import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listCommunityTrips } from "../api/trips";
import AppShell from "../components/AppShell";
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
                    className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
                >
                    Plan a trip
                </Link>
            }
        >
            <div className="space-y-6">
                <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-7">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Community Trips</p>
                            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                                Latest trips shared by other members.
                            </h2>
                        </div>
                        <span className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-slate-600">
                            {communityTrips.length}
                        </span>
                    </div>

                    {error && (
                        <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </p>
                    )}

                    {loading ? (
                        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {Array.from({ length: 3 }).map((_, index) => (
                                <div key={index} className="h-64 animate-pulse rounded-[1.75rem] bg-stone-100" />
                            ))}
                        </div>
                    ) : communityTrips.length === 0 ? (
                        <div className="mt-6 rounded-[1.75rem] border border-dashed border-slate-300 bg-stone-50/70 px-6 py-10 text-center">
                            <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">Quiet for now</p>
                            <p className="mt-3 text-base leading-7 text-slate-500">
                                Shared trips from other members will appear here as soon as the community starts publishing them.
                            </p>
                        </div>
                    ) : (
                        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {communityTrips.map((trip) => (
                                <article
                                    key={trip.id}
                                    className="rounded-[1.75rem] border border-slate-200/80 bg-stone-50 px-5 py-5"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">{trip.destination}</p>
                                            <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
                                                {trip.title}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                                            {formatDate(trip.shared_at)}
                                        </span>
                                    </div>

                                    <p className="mt-4 text-sm leading-6 text-slate-500">
                                        {trip.description || "Shared from another member's saved itinerary."}
                                    </p>

                                    <div className="mt-5 grid gap-3 rounded-[1.5rem] bg-white/80 p-4 text-sm text-slate-600 sm:grid-cols-2">
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Shared by</p>
                                            <p className="mt-2 font-medium text-slate-800">{trip.owner_name}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Days</p>
                                            <p className="mt-2 font-medium text-slate-800">
                                                {trip.itinerary?.days?.length ?? 0}
                                            </p>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => openPlan(trip.destination)}
                                        className="mt-5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                                    >
                                        Plan your version
                                    </button>
                                </article>
                            ))}
                        </div>
                    )}
                </section>

                <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-7">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium text-slate-500">Explore Nearby</p>
                            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                                A few easy places to start.
                            </h2>
                        </div>
                        <Link to="/plan" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
                            Open planner
                        </Link>
                    </div>

                    <div className="mt-6 grid gap-4 lg:grid-cols-3">
                        {nearbyIdeas.map((idea) => (
                            <article
                                key={idea.name}
                                className="rounded-[1.75rem] border border-slate-200/80 bg-stone-50 px-5 py-5"
                            >
                                <p className="text-sm font-medium text-slate-500">Nearby idea</p>
                                <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{idea.name}</h3>
                                <p className="mt-4 text-sm leading-6 text-slate-500">{idea.description}</p>
                                <button
                                    type="button"
                                    onClick={() => openPlan(idea.name)}
                                    className="mt-5 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
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
