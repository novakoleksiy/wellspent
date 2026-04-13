import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listTrips } from "../api/trips";
import AppShell from "../components/AppShell";
import { useAuth } from "../hooks/useAuth";
import type { TripOut } from "../types";

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

export default function HomePage() {
  const { user } = useAuth();
  const [trips, setTrips] = useState<TripOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [destination, setDestination] = useState("");
  const navigate = useNavigate();

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

  const recentTrips = trips.slice(0, 4);

  function openPlan(nextDestination: string) {
    const query = nextDestination.trim();
    navigate(query ? `/plan?destination=${encodeURIComponent(query)}` : "/plan");
  }

  function handlePlanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    openPlan(destination);
  }

  return (
    <AppShell
      title={`Welcome back, ${user?.full_name ? ` ${user.full_name.split(" ")[0]}` : ""}!`}
    >
      <div className="space-y-6">
        <section className="rounded-[2.25rem] bg-slate-900 px-6 py-7 text-white shadow-xl shadow-slate-900/10 sm:px-8 sm:py-8">
          <form className="flex flex-col gap-3 sm:flex-row sm:items-center" onSubmit={handlePlanSubmit}>
            <label className="sr-only" htmlFor="trip-destination">
              Plan a new trip
            </label>
            <input
              id="trip-destination"
              type="search"
              value={destination}
              onChange={(event) => setDestination(event.target.value)}
              placeholder="Plan a new trip"
              className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/8 px-5 py-3 text-sm text-white placeholder:text-white/55 focus:border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-300/40"
            />
            <button
              type="submit"
              className="rounded-full bg-rose-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-rose-300"
            >
              Plan
            </button>
          </form>
        </section>

        <section className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-7">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-slate-500">Recent trips</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                Your completed trips.
              </h2>
            </div>
            <Link to="/plan" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
              Plan another
            </Link>
          </div>

          {error && (
            <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </p>
          )}

          {loading ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-[1.75rem] bg-stone-100" />
              ))}
            </div>
          ) : recentTrips.length === 0 ? (
            <div className="mt-6 rounded-[1.75rem] border border-dashed border-slate-300 bg-stone-50/70 px-6 py-10 text-center">
              <p className="text-sm font-semibold tracking-[0.2em] text-slate-500 uppercase">Ready to start</p>
              <p className="mt-3 text-base leading-7 text-slate-500">
                Your completed trips will appear here once you save an itinerary.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {recentTrips.map((trip) => (
                <Link
                  key={trip.id}
                  to={`/trips/${trip.id}`}
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
                  <div className="mt-5 flex items-center justify-between text-sm text-slate-500">
                    <span>{trip.itinerary?.days?.length ?? 0} day{trip.itinerary?.days?.length === 1 ? "" : "s"}</span>
                    <span className="font-medium capitalize">completed</span>
                  </div>
                </Link>
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
            <Link to="/explore" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">
              Open Explore
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
