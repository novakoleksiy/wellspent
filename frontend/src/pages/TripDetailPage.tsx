import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { completeTrip, getTrip, setTripShared } from "../api/trips";
import AppShell from "../components/AppShell";
import TripCompletionModal from "../components/TripCompletionModal";
import type { TimelineItem, TripCompleteRequest, TripOut } from "../types";

function formatMoney(total: number, currency: string): string {
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "CHF",
        maximumFractionDigits: 0,
    }).format(total);
}

function timelineForDay(day: NonNullable<TripOut["itinerary"]>["days"][number]): TimelineItem[] {
    if (day.timeline_items?.length) {
        return day.timeline_items;
    }

    return day.activities.map((activity, index) => ({
        id: activity.id || `activity-${day.day}-${index}`,
        kind: "activity" as const,
        time: activity.time,
        title: activity.title,
        category: activity.category,
        cost: activity.cost,
        url: activity.url,
        refreshable: false,
    }));
}

export default function TripDetailPage() {
    const { id } = useParams();
    const [trip, setTrip] = useState<TripOut | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [sharing, setSharing] = useState(false);
    const [completing, setCompleting] = useState(false);
    const [isCompletionOpen, setIsCompletionOpen] = useState(false);

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

    const handleShareToggle = async () => {
        setSharing(true);
        setError("");
        try {
            const updatedTrip = await setTripShared(trip.id, !trip.shared_at);
            setTrip(updatedTrip);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unable to update community sharing");
        } finally {
            setSharing(false);
        }
    };

    const handleCompleteTrip = async (body: TripCompleteRequest) => {
        setCompleting(true);
        setError("");
        try {
            const updatedTrip = await completeTrip(trip.id, body);
            setTrip(updatedTrip);
            return updatedTrip;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unable to complete trip");
            throw err;
        } finally {
            setCompleting(false);
        }
    };

    const handleShareCompletedTrip = async (completedTrip: TripOut) => {
        setSharing(true);
        setError("");
        try {
            const updatedTrip = await setTripShared(completedTrip.id, true);
            setTrip(updatedTrip);
            return updatedTrip;
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Unable to share trip with the community");
            throw err;
        } finally {
            setSharing(false);
        }
    };

    return (
        <AppShell
            title={trip.title}
            description={`Saved itinerary for ${trip.destination}`}
            actions={
                <div className="flex flex-wrap items-center gap-3">
                    {trip.status !== "completed" && (
                        <button
                            type="button"
                            onClick={() => setIsCompletionOpen(true)}
                            disabled={completing}
                            className="rounded-full bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {completing ? "Completing..." : "Complete Trip"}
                        </button>
                    )}
                    <Link
                        to="/"
                        className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                    >
                        Back to homepage
                    </Link>
                </div>
            }
        >
            {error && (
                <p className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {error}
                </p>
            )}

            <section className="mb-6 overflow-hidden rounded-[2.25rem] bg-slate-900 text-white shadow-xl shadow-slate-900/10">
                <div className="grid gap-6 px-6 py-7 sm:px-8 sm:py-8 lg:grid-cols-[1.15fr_0.85fr]">
                    <div>
                        <p className="text-sm font-medium text-white/65">Itinerary overview</p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                            {trip.destination}
                        </h2>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
                            {trip.description || "Saved from your planning flow and ready to revisit whenever you want to compare options or travel."}
                        </p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                        <div className="rounded-[1.75rem] border border-white/10 bg-white/8 px-5 py-5">
                            <p className="text-sm text-white/60">Status</p>
                            <p className="mt-2 text-lg font-semibold capitalize">{trip.status}</p>
                        </div>
                        <div className="rounded-[1.75rem] border border-white/10 bg-white/8 px-5 py-5">
                            <p className="text-sm text-white/60">Days planned</p>
                            <p className="mt-2 text-lg font-semibold">{trip.itinerary?.days?.length ?? 0}</p>
                        </div>
                        <div className="rounded-[1.75rem] border border-white/10 bg-white/8 px-5 py-5 sm:col-span-2 lg:col-span-1 xl:col-span-2">
                            <p className="text-sm text-white/60">Community</p>
                            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                <p className="text-lg font-semibold">{trip.shared_at ? "Shared with the community" : "Private to you"}</p>
                                <button
                                    type="button"
                                    onClick={handleShareToggle}
                                    disabled={sharing}
                                    className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {sharing
                                        ? trip.shared_at
                                            ? "Removing..."
                                            : "Sharing..."
                                        : trip.shared_at
                                            ? "Remove from community"
                                            : "Share with community"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <section className="space-y-5">
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
                                {timelineForDay(day).map((item, index) => (
                                    <div
                                        key={`${day.day}-${item.time}-${item.title}-${index}`}
                                        className="grid gap-4 rounded-[1.5rem] border border-stone-200 bg-stone-50 px-4 py-4 sm:grid-cols-[96px_1fr_auto] sm:items-center"
                                    >
                                        <div className="text-sm font-medium text-slate-500">{item.time}</div>
                                        <div>
                                            <p className="text-base font-semibold text-slate-900">{item.title}</p>
                                            <p className="mt-1 text-sm text-slate-500 capitalize">{item.category}</p>
                                            {item.duration_text && (
                                                <p className="mt-1 text-sm text-slate-500">{item.duration_text}</p>
                                            )}
                                            {item.notes && <p className="mt-1 text-sm text-slate-500">{item.notes}</p>}
                                        </div>
                                        <div className="text-sm font-medium text-slate-600">
                                            {formatMoney(item.cost, trip.itinerary?.currency || "CHF")}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </article>
                    ))}
                </section>

                <aside className="space-y-5">
                    <div className="rounded-[2rem] border border-slate-200/80 bg-white/92 p-6 shadow-sm xl:sticky xl:top-28">
                        <p className="text-sm font-semibold tracking-[0.2em] text-slate-400 uppercase">
                            Trip summary
                        </p>
                        <div className="mt-6 space-y-5">
                            <div>
                                <p className="text-sm text-slate-500">Destination</p>
                                <p className="mt-1 text-lg font-semibold text-slate-900">{trip.destination}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Status</p>
                                <p className="mt-1 text-lg font-semibold capitalize text-slate-900">{trip.status}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Saved on</p>
                                <p className="mt-1 text-lg font-semibold text-slate-900">
                                    {new Date(trip.created_at).toLocaleDateString()}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Days planned</p>
                                <p className="mt-1 text-lg font-semibold text-slate-900">{trip.itinerary?.days?.length ?? 0}</p>
                            </div>
                            <div>
                                <p className="text-sm text-slate-500">Community</p>
                                <p className="mt-1 text-lg font-semibold text-slate-900">
                                    {trip.shared_at ? "Shared" : "Private"}
                                </p>
                            </div>
                            {trip.itinerary && (
                                <div>
                                    <p className="text-sm text-slate-500">Estimated total</p>
                                    <p className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                                        {formatMoney(trip.itinerary.estimated_total, trip.itinerary.currency)}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="rounded-[2rem] border border-slate-200/80 bg-white/92 p-6 shadow-sm">
                        <p className="text-sm font-medium text-slate-500">Next move</p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Want a different destination, timing, or pace? Start a new planning run without losing this saved version.
                        </p>
                        <Link
                            to="/plan"
                            className="mt-5 inline-flex rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold !text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
                        >
                            Plan another trip
                        </Link>
                    </div>
                </aside>
            </div>
            {isCompletionOpen && (
                <TripCompletionModal
                    trip={trip}
                    completing={completing}
                    sharing={sharing}
                    onClose={() => setIsCompletionOpen(false)}
                    onComplete={handleCompleteTrip}
                    onShare={handleShareCompletedTrip}
                />
            )}
        </AppShell>
    );
}
