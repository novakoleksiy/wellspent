import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listTrips } from "../api/trips";
import AppShell from "../components/AppShell";
import { coercePreferences } from "../preferences";
import { useAuth } from "../hooks/useAuth";
import type { TripOut } from "../types";

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function HomePage() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<TripOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const preferences = coercePreferences(user?.preferences);

  useEffect(() => {
    listTrips()
      .then((items) => {
        setTrips(items);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Unable to load trips");
      })
      .finally(() => setLoading(false));
  }, []);

  const recentTrips = trips.slice(0, 3);

  return (
    <AppShell
      title={`Welcome${user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}`}
      description="Use home as your trip hub: start a new itinerary, reopen saved plans, or fine-tune your travel profile."
      actions={
        <Link
          to="/plan"
          className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
        >
          Start planning
        </Link>
      }
    >
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-6">
          <div className="rounded-[2.25rem] bg-slate-900 px-6 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-8 sm:py-8">
            <p className="text-sm font-medium text-white/65">Home</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
              Pick up where your next Swiss escape left off.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
              Jump back into planning, browse saved trips, or adjust the profile that drives every recommendation.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/plan"
                className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-stone-100"
              >
                Plan a trip
              </Link>
              <Link
                to="/trips"
                className="rounded-full border border-white/20 px-5 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                View saved trips
              </Link>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm">
              <p className="text-sm text-slate-500">Saved trips</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">{trips.length}</p>
            </div>
            <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm">
              <p className="text-sm text-slate-500">Travel styles</p>
              <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-900">
                {preferences.travel_styles.length}
              </p>
            </div>
            <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm">
              <p className="text-sm text-slate-500">Planning pace</p>
              <p className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 capitalize">
                {preferences.pace || "Flexible"}
              </p>
            </div>
          </div>

          <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-7">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-slate-500">Recent trips</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  Continue from your library.
                </h2>
              </div>
              <Link to="/trips" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
                See all
              </Link>
            </div>

            {error && (
              <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </p>
            )}

            {loading ? (
              <div className="mt-6 space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-[1.5rem] bg-stone-100" />
                ))}
              </div>
            ) : recentTrips.length === 0 ? (
              <div className="mt-6 rounded-[1.75rem] border border-dashed border-slate-300 bg-stone-50/70 px-6 py-10 text-center">
                <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">Ready to start</p>
                <p className="mt-3 text-base leading-7 text-slate-500">
                  Your saved trips will appear here once you keep a recommendation.
                </p>
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {recentTrips.map((trip) => (
                  <Link
                    key={trip.id}
                    to={`/trips/${trip.id}`}
                    className="flex items-center justify-between gap-4 rounded-[1.75rem] border border-slate-200/80 bg-stone-50 px-5 py-4 transition hover:border-slate-300 hover:bg-white"
                  >
                    <div>
                      <p className="text-base font-semibold text-slate-900">{trip.title}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        {trip.destination} · {trip.itinerary?.days?.length ?? 0} day{trip.itinerary?.days?.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-500 shadow-sm">
                      {formatDate(trip.created_at)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </section>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-7">
            <p className="text-sm font-medium text-slate-500">Quick start</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              Build from your current profile.
            </h2>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-slate-600">
                {preferences.budget_tier} budget
              </span>
              <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-slate-600">
                {preferences.pace} pace
              </span>
              {preferences.travel_styles.slice(0, 3).map((style) => (
                <span key={style} className="rounded-full bg-rose-100 px-4 py-2 text-sm text-rose-900">
                  {style}
                </span>
              ))}
            </div>
            <p className="mt-5 text-sm leading-6 text-slate-500">
              Prefer a different trip style or stay type? Update your profile before planning.
            </p>
            <Link
              to="/settings"
              className="mt-6 inline-flex rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
            >
              Open profile
            </Link>
          </section>

          <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-7">
            <p className="text-sm font-medium text-slate-500">Planning flow</p>
            <ol className="mt-5 space-y-4 text-sm text-slate-600">
              <li className="rounded-[1.5rem] bg-stone-50 px-4 py-4">
                <span className="font-semibold text-slate-900">1.</span> Set destination, dates, and trip notes.
              </li>
              <li className="rounded-[1.5rem] bg-stone-50 px-4 py-4">
                <span className="font-semibold text-slate-900">2.</span> Compare itinerary options matched to your profile.
              </li>
              <li className="rounded-[1.5rem] bg-stone-50 px-4 py-4">
                <span className="font-semibold text-slate-900">3.</span> Save the option that belongs in your trip library.
              </li>
            </ol>
          </section>
        </aside>
      </div>
    </AppShell>
  );
}
