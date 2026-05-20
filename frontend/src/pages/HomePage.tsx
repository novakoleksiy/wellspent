import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listTrips } from "../api/trips";
import AppShell from "../components/AppShell";
import { useAuth } from "../hooks/useAuth";
import { getTripHeroImageUrl } from "../tripImages";
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

  const recentTrips = trips.filter((trip) => trip.status === "completed").slice(0, 4);

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
        <section className="ws-surface-dark px-6 py-7 shadow-xl shadow-stone-900/10 sm:px-8 sm:py-8">
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
              className="min-w-0 flex-1 rounded-full border border-white/10 bg-white/8 px-5 py-3 text-sm text-white placeholder:text-white/55 focus:border-[var(--ws-yellow)] focus:outline-none focus:ring-2 focus:ring-[rgba(255,235,105,0.25)]"
            />
            <button
              type="submit"
              className="ws-btn-accent px-6 py-3 text-sm"
            >
              Plan
            </button>
          </form>
        </section>

        <section className="ws-surface p-6 sm:p-7">
          <div>
            <div>
              <p className="ws-mono text-[var(--ws-muted)]">Recent trips</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                Your completed trips.
              </h2>
            </div>
          </div>

          {error && (
            <p className="ws-error mt-5 px-4 py-3 text-sm">
              {error}
            </p>
          )}

          {loading ? (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="h-40 animate-pulse rounded-[1.75rem] bg-[var(--ws-cream)]" />
              ))}
            </div>
          ) : recentTrips.length === 0 ? (
            <div className="mt-6 rounded-[1.75rem] border border-dashed border-[var(--ws-line)] bg-[rgba(255,244,239,0.6)] px-6 py-10 text-center">
              <p className="ws-mono text-[var(--ws-muted)]">Ready to start</p>
              <p className="mt-3 text-base leading-7 text-[var(--ws-muted)]">
                Your completed trips will appear here once you save an itinerary.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {recentTrips.map((trip) => {
                const heroImageUrl = getTripHeroImageUrl(trip.itinerary);

                return (
                  <Link
                    key={trip.id}
                    to={`/trips/${trip.id}`}
                    className={heroImageUrl
                      ? "overflow-hidden rounded-[1.75rem] border border-[var(--ws-line)] bg-[#fffdf8] transition hover:border-[rgba(20,19,15,0.24)]"
                      : "rounded-[1.75rem] border border-[var(--ws-line)] bg-[rgba(255,244,239,0.6)] px-5 py-5 transition hover:border-[rgba(20,19,15,0.24)] hover:bg-[#fffdf8]"}
                  >
                    {heroImageUrl && (
                      <img
                        src={heroImageUrl}
                        alt={trip.destination}
                        className="h-40 w-full object-cover"
                        loading="lazy"
                      />
                    )}
                    <div className={heroImageUrl ? "px-5 py-5" : ""}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--ws-muted)]">{trip.destination}</p>
                          <p className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">{trip.title}</p>
                        </div>
                        <span className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--ws-muted)] shadow-sm">
                          {formatDate(trip.created_at)}
                        </span>
                      </div>
                      <p className="mt-4 text-sm leading-6 text-[var(--ws-muted)]">
                        {trip.description || "Saved from your recommendation flow and ready to revisit."}
                      </p>
                      <div className="mt-5 flex items-center justify-between text-sm text-[var(--ws-muted)]">
                        <span>{trip.itinerary?.days?.length ?? 0} day{trip.itinerary?.days?.length === 1 ? "" : "s"}</span>
                        <span className="font-medium capitalize">completed</span>
                      </div>
                    </div>
                  </Link>
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
            <Link to="/explore" className="text-sm font-medium text-[var(--ws-muted)] transition hover:text-[var(--ws-ink)]">
              Open Explore
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
