import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { deleteTrip, listTrips } from "../api/trips";
import AppShell from "../components/AppShell";
import type { TripOut } from "../types";

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

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

  const activeTrips = trips.filter((trip) => trip.status !== "completed");
  const pastTrips = trips.filter((trip) => trip.status === "completed");
  const itinerariesCount = trips.filter((trip) => trip.itinerary?.days?.length).length;

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

  function renderTripSection(label: string, title: string, items: TripOut[], emptyLabel: string) {
    return (
      <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-7">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-slate-500">{label}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
          </div>
          <span className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-slate-600">
            {items.length}
          </span>
        </div>

        {items.length === 0 ? (
          <div className="mt-6 rounded-[1.75rem] border border-dashed border-slate-300 bg-stone-50/70 px-6 py-10 text-center">
            <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">Nothing here yet</p>
            <p className="mt-3 text-base leading-7 text-slate-500">{emptyLabel}</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((trip) => {
              const dayCount = trip.itinerary?.days?.length ?? 0;

              return (
                <article
                  key={trip.id}
                  className="rounded-[1.75rem] border border-slate-200/80 bg-stone-50 px-5 py-5 transition hover:border-slate-300 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-slate-500">{trip.destination}</p>
                      <p className="mt-2 text-xl font-semibold tracking-tight text-slate-900">{trip.title}</p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                      {formatDate(trip.created_at)}
                    </span>
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-500">
                    {trip.description || "Saved from your recommendation flow and ready to revisit."}
                  </p>

                  <div className="mt-5 grid grid-cols-2 gap-3 rounded-[1.5rem] bg-white/80 p-4 text-sm text-slate-600">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Days</p>
                      <p className="mt-2 font-medium text-slate-800">{dayCount || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Status</p>
                      <p className="mt-2 font-medium capitalize text-slate-800">{trip.status}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Estimated total</p>
                      <p className="mt-2 font-medium text-slate-800">
                        {formatMoney(trip.itinerary?.estimated_total, trip.itinerary?.currency)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 text-sm text-slate-500">
                    <Link
                      to={`/trips/${trip.id}`}
                      className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      View itinerary
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(trip.id)}
                      disabled={deletingId === trip.id}
                      className="font-medium text-rose-600 transition hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingId === trip.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    );
  }

  return (
    <AppShell
      title="My Trips"
      description="Track the trips you are actively planning, revisit completed itineraries, and keep your travel history in one place."
      actions={
        <Link
          to="/explore"
          className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
        >
          Plan a trip
        </Link>
      }
    >
      <div className="space-y-6">
        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-sm">
            <p className="text-sm text-slate-500">Total trips</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{trips.length}</p>
          </div>
          <div className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-sm">
            <p className="text-sm text-slate-500">Active trips</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{activeTrips.length}</p>
          </div>
          <div className="rounded-[2rem] border border-slate-200/80 bg-slate-900 p-6 text-white shadow-lg shadow-slate-900/10">
            <p className="text-sm text-white/70">Saved itineraries</p>
            <p className="mt-3 text-4xl font-semibold tracking-tight text-white">{itinerariesCount}</p>
            <p className="mt-2 text-sm leading-6 text-white/70">
              Keep drafts in motion and hold onto the trips worth repeating.
            </p>
          </div>
        </section>

        {error && (
          <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        {loading ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="h-80 animate-pulse rounded-[2rem] bg-white/70 shadow-sm" />
            <div className="h-80 animate-pulse rounded-[2rem] bg-white/70 shadow-sm" />
          </div>
        ) : trips.length === 0 ? (
          <section className="rounded-[2.5rem] border border-dashed border-slate-300 bg-white/60 px-6 py-14 text-center shadow-sm sm:px-10">
            <p className="text-sm font-semibold tracking-[0.22em] text-slate-500 uppercase">Ready to start</p>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              Your trip history will build from here.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-500">
              Generate a tailored itinerary, save the one that fits best, and come back to it anytime.
            </p>
            <Link
              to="/explore"
              className="mt-8 inline-flex rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
            >
              Plan your first trip
            </Link>
          </section>
        ) : (
          <>
            {renderTripSection(
              "Current Trips",
              "Trips you are still planning or keeping active.",
              activeTrips,
              "Your in-progress trips and open itineraries will appear here."
            )}
            {renderTripSection(
              "Past Trips",
              "Trips and itineraries you have already completed.",
              pastTrips,
              "Completed trips will appear here once their status is marked as completed."
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
