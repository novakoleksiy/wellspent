import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getTrip } from "../api/trips";
import AppShell from "../components/AppShell";
import type { TripOut } from "../types";

function formatMoney(total: number, currency: string): string {
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "CHF",
        maximumFractionDigits: 0,
    }).format(total);
}

export default function TripDetailPage() {
    const { id } = useParams();
    const [trip, setTrip] = useState<TripOut | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        getTrip(Number(id))
            .then(setTrip)
            .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Unable to load trip");
            })
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <AppShell title="Trip details" description="Loading your saved itinerary.">
                <div className="h-72 animate-pulse rounded-[2rem] bg-white/70 shadow-sm" />
            </AppShell>
        );
    }

    if (!trip) {
        return (
            <AppShell title="Trip details" description="We could not find this saved trip.">
                <div className="rounded-[2rem] border border-rose-200 bg-rose-50 px-6 py-8 text-rose-700">
                    {error || "Trip not found."}
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell
            title={trip.title}
            description={trip.destination}
            actions={
                <Link
                    to="/trips"
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                    Back to trips
                </Link>
            }
        >
            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <section className="space-y-5">
                    {trip.description && (
                        <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm">
                            <p className="text-sm font-semibold tracking-[0.2em] text-slate-400 uppercase">
                                Overview
                            </p>
                            <p className="mt-4 text-base leading-7 text-slate-600">{trip.description}</p>
                        </div>
                    )}

                    {trip.itinerary?.days?.map((day) => (
                        <article
                            key={day.day}
                            className="rounded-[2rem] border border-slate-200/80 bg-white/92 p-6 shadow-sm"
                        >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Day {day.day}</p>
                                    <h2 className="text-2xl font-semibold tracking-tight text-slate-900">
                                        {new Date(day.date).toLocaleDateString(undefined, {
                                            weekday: "long",
                                            month: "long",
                                            day: "numeric",
                                        })}
                                    </h2>
                                </div>
                                <p className="text-sm text-slate-400">{day.activities.length} planned stop{day.activities.length === 1 ? "" : "s"}</p>
                            </div>

                            <div className="mt-6 space-y-3">
                                {day.activities.map((activity, index) => (
                                    <div
                                        key={`${day.day}-${activity.time}-${activity.title}-${index}`}
                                        className="grid gap-4 rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4 sm:grid-cols-[96px_1fr_auto] sm:items-center"
                                    >
                                        <div className="text-sm font-medium text-slate-500">{activity.time}</div>
                                        <div>
                                            <p className="text-base font-semibold text-slate-900">{activity.title}</p>
                                            <p className="mt-1 text-sm text-slate-500 capitalize">{activity.category}</p>
                                        </div>
                                        <div className="text-sm font-medium text-slate-600">
                                            {formatMoney(activity.cost, trip.itinerary?.currency || "CHF")}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </article>
                    ))}
                </section>

                <aside className="space-y-5">
                    <div className="rounded-[2rem] border border-slate-200/80 bg-slate-900 p-6 text-white shadow-lg shadow-slate-900/10 xl:sticky xl:top-28">
                        <p className="text-sm font-semibold tracking-[0.2em] text-white/60 uppercase">
                            Trip summary
                        </p>
                        <div className="mt-6 space-y-5">
                            <div>
                                <p className="text-sm text-white/60">Destination</p>
                                <p className="mt-1 text-lg font-semibold">{trip.destination}</p>
                            </div>
                            <div>
                                <p className="text-sm text-white/60">Status</p>
                                <p className="mt-1 text-lg font-semibold capitalize">{trip.status}</p>
                            </div>
                            <div>
                                <p className="text-sm text-white/60">Saved on</p>
                                <p className="mt-1 text-lg font-semibold">
                                    {new Date(trip.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-white/60">Days planned</p>
                                <p className="mt-1 text-lg font-semibold">{trip.itinerary?.days?.length ?? 0}</p>
                            </div>
                            {trip.itinerary && (
                                <div>
                                    <p className="text-sm text-white/60">Estimated total</p>
                                    <p className="mt-1 text-2xl font-semibold tracking-tight">
                                        {formatMoney(trip.itinerary.estimated_total, trip.itinerary.currency)}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </aside>
            </div>
        </AppShell>
    );
}
