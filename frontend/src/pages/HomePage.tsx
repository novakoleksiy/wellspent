import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { listDestinations, listOffers, listTours } from "../api/swissTourism";
import AppShell from "../components/AppShell";
import FeaturedSpotlight from "../components/FeaturedSpotlight";
import OfferCard from "../components/OfferCard";
import Rail from "../components/Rail";
import RouteCard from "../components/RouteCard";
import TourCard from "../components/TourCard";
import { useAuth } from "../hooks/useAuth";
import { pickFeatured } from "../homeFeatured";
import { groupToursByRoute } from "../tourFormat";
import type { DestinationOut, OfferOut, TourOut } from "../types";

const nearbyIdeas = [
  {
    name: "Lucerne",
    description: "Lake views, an easy old-town stroll, and mountain access for a relaxed weekend.",
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

export default function HomePage() {
  const { user } = useAuth();
  const [tours, setTours] = useState<TourOut[]>([]);
  const [offers, setOffers] = useState<OfferOut[]>([]);
  const [destination, setDestination] = useState("");
  const [destinationOptions, setDestinationOptions] = useState<DestinationOut[]>([]);
  const [destinationSearchLoading, setDestinationSearchLoading] = useState(false);
  const [destinationSearchError, setDestinationSearchError] = useState("");
  const [destinationFocused, setDestinationFocused] = useState(false);
  const [showRandomPrompt, setShowRandomPrompt] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    listTours({ pageSize: 12 })
      .then((result) => setTours(result.data))
      .catch(() => setTours([]));
  }, []);

  useEffect(() => {
    listOffers({ pageSize: 12 })
      .then((result) => setOffers(result.data))
      .catch(() => setOffers([]));
  }, []);

  useEffect(() => {
    if (!showRandomPrompt) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowRandomPrompt(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [showRandomPrompt]);

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

  const tourEntries = groupToursByRoute(tours).slice(0, 12);
  const offerEntries = offers.slice(0, 12);
  const featured = useMemo(() => pickFeatured(tours, offers), [tours, offers]);

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
    if (destination.trim().length === 0) {
      setShowRandomPrompt(true);
      return;
    }
    openPlan(destination);
  }

  function confirmRandomDestination() {
    setShowRandomPrompt(false);
    openPlan("");
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
                placeholder="Enter a destination idea..."
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

        {featured && <FeaturedSpotlight item={featured} />}

        {tourEntries.length > 0 && (
          <Rail
            eyebrow="Ready-made tours"
            title="Pre-planned itineraries you can follow."
            seeAllTo="/tours"
            seeAllLabel="See all tours"
            autoScroll
          >
            {tourEntries.map((entry) => (
              <div
                key={entry.kind === "route" ? `route:${entry.routeName}` : entry.tour.id}
                className="w-72 shrink-0 snap-start"
              >
                {entry.kind === "route" ? (
                  <RouteCard
                    routeName={entry.routeName}
                    stageCount={entry.stageCount}
                    representative={entry.representative}
                  />
                ) : (
                  <TourCard tour={entry.tour} />
                )}
              </div>
            ))}
          </Rail>
        )}

        {offerEntries.length > 0 && (
          <Rail
            eyebrow="Bookable offers"
            title="Swiss experiences you can reserve."
            seeAllTo="/offers"
            seeAllLabel="See all offers"
            autoScroll
          >
            {offerEntries.map((offer) => (
              <div key={offer.id} className="w-72 shrink-0 snap-start">
                <OfferCard offer={offer} />
              </div>
            ))}
          </Rail>
        )}

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

      {showRandomPrompt && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,19,15,0.45)] px-4 py-6 backdrop-blur-sm"
          onClick={() => setShowRandomPrompt(false)}
          role="presentation"
        >
          <div
            className="ws-surface w-full max-w-md rounded-[2rem] p-6 sm:p-7"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="random-destination-title"
          >
            <p className="ws-mono text-[var(--ws-orange)]">No destination yet</p>
            <h2
              id="random-destination-title"
              className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]"
            >
              We'll surprise you.
            </h2>
            <p className="mt-4 text-base leading-7 text-[var(--ws-muted)]">
              You haven't picked a destination, so we'll choose a random Swiss spot for you.
              Continue to the planner?
            </p>
            <div className="mt-7 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowRandomPrompt(false)}
                className="ws-btn-secondary px-5 py-3 text-sm"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmRandomDestination}
                className="ws-btn-primary px-5 py-3 text-sm"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
