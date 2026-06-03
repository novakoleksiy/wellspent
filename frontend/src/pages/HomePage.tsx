import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listDestinations } from "../api/swissTourism";
import { listTrips } from "../api/trips";
import AppShell from "../components/AppShell";
import { useAuth } from "../hooks/useAuth";
import { getTripHeroImageUrl } from "../tripImages";
import type { DestinationOut, TripOut } from "../types";

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
  const [destinationOptions, setDestinationOptions] = useState<DestinationOut[]>([]);
  const [destinationSearchLoading, setDestinationSearchLoading] = useState(false);
  const [destinationSearchError, setDestinationSearchError] = useState("");
  const [destinationFocused, setDestinationFocused] = useState(false);
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

  useEffect(() => {
    const query = destination.trim();
    if (query.length < 2) {
      return;
    }

    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
      listDestinations({ query, pageSize: 5, signal: controller.signal })
        .then((result) => {
          if (!controller.signal.aborted) {
            setDestinationOptions(result.data);
          }
        })
        .catch((err: unknown) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (!controller.signal.aborted) {
            setDestinationOptions([]);
            setDestinationSearchError("Destination search is unavailable right now.");
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setDestinationSearchLoading(false);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [destination]);

  const recentTrips = trips.filter((trip) => trip.status === "completed").slice(0, 4);

  function openPlan(nextDestination: string) {
    const query = nextDestination.trim();
    navigate(query ? `/plan?destination=${encodeURIComponent(query)}` : "/plan");
  }

  function chooseDestination(option: DestinationOut) {
    setDestination(option.name);
    setDestinationFocused(false);
    openPlan(option.name);
  }

  function handleDestinationChange(value: string) {
    setDestination(value);
    setDestinationSearchError("");

    if (value.trim().length < 2) {
      setDestinationOptions([]);
      setDestinationSearchLoading(false);
    } else {
      setDestinationSearchLoading(true);
    }
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
            <div className="relative min-w-0 flex-1">
              <input
                id="trip-destination"
                type="search"
                value={destination}
                onChange={(event) => handleDestinationChange(event.target.value)}
                onFocus={() => setDestinationFocused(true)}
                onBlur={() => setDestinationFocused(false)}
                placeholder="Plan a new trip"
                autoComplete="off"
                className="w-full rounded-full border border-white/10 bg-white/8 px-5 py-3 text-sm text-white placeholder:text-white/55 focus:border-[var(--ws-yellow)] focus:outline-none focus:ring-2 focus:ring-[rgba(255,235,105,0.25)]"
              />
              {destinationFocused && destination.trim().length >= 2 && (
                <div className="absolute top-[calc(100%+0.5rem)] right-0 left-0 z-20 overflow-hidden rounded-[1.35rem] border border-white/10 bg-[#fffdf8] text-[var(--ws-ink)] shadow-2xl shadow-stone-950/25">
                  {destinationSearchLoading ? (
                    <p className="px-4 py-3 text-sm text-[var(--ws-muted)]">Searching Swiss destinations...</p>
                  ) : destinationSearchError ? (
                    <p className="px-4 py-3 text-sm text-[var(--ws-muted)]">{destinationSearchError}</p>
                  ) : destinationOptions.length > 0 ? (
                    destinationOptions.map((option) => (
                        <button
                          key={option.id}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => chooseDestination(option)}
                          className="block w-full px-4 py-3 text-left transition hover:bg-[var(--ws-cream)]"
                        >
                          <span className="block text-sm font-semibold">{option.name}</span>
                          {option.category && (
                            <span className="mt-0.5 block text-xs capitalize text-[var(--ws-muted)]">{option.category}</span>
                          )}
                        </button>
                    ))
                  ) : (
                    <p className="px-4 py-3 text-sm text-[var(--ws-muted)]">No matching destinations found.</p>
                  )}
                </div>
              )}
            </div>
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
                      ? "flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[var(--ws-line)] bg-[#fffdf8] transition hover:border-[rgba(20,19,15,0.24)]"
                      : "flex h-full flex-col rounded-[1.75rem] border border-[var(--ws-line)] bg-[rgba(255,244,239,0.6)] px-5 py-5 transition hover:border-[rgba(20,19,15,0.24)] hover:bg-[#fffdf8]"}
                  >
                    {heroImageUrl && (
                      <img
                        src={heroImageUrl}
                        alt={trip.destination}
                        className="h-40 w-full object-cover"
                        loading="lazy"
                      />
                    )}
                    <div className={heroImageUrl ? "flex flex-1 flex-col px-5 py-5" : "flex flex-1 flex-col"}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--ws-muted)]">{trip.destination}</p>
                          <p className="mt-2 line-clamp-2 text-xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">{trip.title}</p>
                        </div>
                        <span className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--ws-muted)] shadow-sm">
                          {formatDate(trip.created_at)}
                        </span>
                      </div>
                      <p className="mt-4 line-clamp-3 text-sm leading-6 text-[var(--ws-muted)]">
                        {trip.description || "Saved from your recommendation flow and ready to revisit."}
                      </p>
                      <div className="mt-auto flex items-center justify-between pt-5 text-sm text-[var(--ws-muted)]">
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
