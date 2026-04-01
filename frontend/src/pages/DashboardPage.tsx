import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteTrip, listTrips } from "../api/trips";
import AppShell from "../components/AppShell";
import type { TripOut } from "../types";

function formatMoney(total: number | undefined, currency: string | undefined): string {
    if (typeof total !== "number") {
        return "Estimate pending";
    }

    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "CHF",
        maximumFractionDigits: 0,
    }).format(total);
}

export default function TripsPage() {
    const [trips, setTrips] = useState<TripOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [deletingId, setDeletingId] = useState<number | null>(null);

    useEffect(() => {
        listTrips()
            .then(setTrips)
            .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Unable to load trips");
            })
            .finally(() => setLoading(false));
    }, []);

    const handleDelete = async (id: number) => {
        setDeletingId(id);
        try {
            await deleteTrip(id);
            setTrips((current) => current.filter((trip) => trip.id !== id));
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unable to delete trip");
        } finally {
            setDeletingId(null);
        }
    };

    const tripsWithItinerary = trips.filter((trip) => trip.itinerary?.days?.length).length;

    return (
        <AppShell
            title="My trips"
            description="Your saved itineraries live here, ready to revisit whenever the next escape starts taking shape."
            actions={
                <Link
                    to="/recommend"
                    className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
                >
                    Plan a new trip
                </Link>
            }
        >
            <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-sm">
                    <p className="text-sm text-slate-500">Saved trips</p>
                    <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{trips.length}</p>
                </div>
                <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-sm">
                    <p className="text-sm text-slate-500">With itinerary</p>
                    <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{tripsWithItinerary}</p>
                </div>
                <div className="rounded-[2rem] border border-slate-200/80 bg-slate-900 p-6 text-white shadow-lg shadow-slate-900/10">
                    <p className="text-sm text-white/70">Planning loop</p>
                    <p className="mt-3 text-lg font-semibold">Generate, save, revisit.</p>
                    <p className="mt-2 text-sm leading-6 text-white/70">
                        This MVP focuses on the fastest path from preferences to a saved travel plan.
                    </p>
                </div>
            </div>

            {error && (
                <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                </p>
            )}

            {loading ? (
                <div className="mt-8 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, index) => (
                        <div key={index} className="h-56 animate-pulse rounded-[2rem] bg-white/70 shadow-sm" />
                    ))}
                </div>
            ) : trips.length === 0 ? (
                <section className="mt-8 rounded-[2.5rem] border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center shadow-sm sm:px-10">
                    <p className="text-sm font-semibold tracking-[0.22em] text-slate-500 uppercase">
                        Empty library
                    </p>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                        Your next great trip starts here.
                    </h2>
                    <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-500">
                        Generate a tailored itinerary, save the one that fits best, and come back to it anytime.
                    </p>
                    <Link
                        to="/recommend"
                        className="mt-8 inline-flex rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
                    >
                        Plan your first trip
                    </Link>
                </section>
            ) : (
                <div className="mt-8 grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
                    {trips.map((trip) => {
                        const dayCount = trip.itinerary?.days?.length ?? 0;

                        return (
                            <article
                                key={trip.id}
                                className="flex flex-col rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-sm font-medium text-slate-500">{trip.destination}</p>
                                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                                            {trip.title}
                                        </h2>
                                    </div>
                                    <span className="rounded-full bg-stone-100 px-3 py-1 text-xs font-medium capitalize text-slate-600">
                                        {trip.status}
                                    </span>
                                </div>

                                <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-500">
                                    {trip.description || "Saved from your personalized recommendation flow."}
                                </p>

                                <div className="mt-6 grid grid-cols-2 gap-3 rounded-3xl bg-stone-50 p-4 text-sm text-slate-600">
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Created</p>
                                        <p className="mt-2 font-medium text-slate-800">
                                            {new Date(trip.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Days</p>
                                        <p className="mt-2 font-medium text-slate-800">{dayCount || "-"}</p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Estimated total</p>
                                        <p className="mt-2 font-medium text-slate-800">
                                            {formatMoney(
                                                trip.itinerary?.estimated_total,
                                                trip.itinerary?.currency,
                                            )}
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-6 flex items-center justify-between gap-3">
                                    <Link
                                        to={`/trips/${trip.id}`}
                                        className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                                    >
                                        View itinerary
                                    </Link>
                                    <button
                                        onClick={() => handleDelete(trip.id)}
                                        disabled={deletingId === trip.id}
                                        className="text-sm font-medium text-rose-600 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {deletingId === trip.id ? "Deleting..." : "Delete"}
                                    </button>
                                </div>
                            </article>
                        );
                    })}
                </div>
            )}
        </AppShell>
    );
}
