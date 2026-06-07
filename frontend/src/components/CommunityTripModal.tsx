import { useState } from "react";
import { Link } from "react-router-dom";
import { createTrip } from "../api/trips";
import { visibleTimelineNote } from "../timelineNotes";
import { getTripHeroImageUrl } from "../tripImages";
import type { CommunityTripOut, TimelineItem, TripOut } from "../types";

interface CommunityTripModalProps {
  trip: CommunityTripOut;
  onClose: () => void;
}

function formatMoney(total: number, currency: string): string {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: currency || "CHF",
    maximumFractionDigits: 0,
  }).format(total);
}

function timelineForDay(
  day: NonNullable<CommunityTripOut["itinerary"]>["days"][number],
): TimelineItem[] {
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
    description: activity.description,
    refreshable: false,
  }));
}

export default function CommunityTripModal({ trip, onClose }: CommunityTripModalProps) {
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [addedTrip, setAddedTrip] = useState<TripOut | null>(null);

  const heroImageUrl = getTripHeroImageUrl(trip.itinerary);
  const dayCount = trip.itinerary?.days?.length ?? 0;
  const currency = trip.itinerary?.currency || "CHF";

  const handleAddTrip = async () => {
    setAdding(true);
    setError("");
    try {
      const created = await createTrip({
        title: trip.title,
        destination: trip.destination,
        description: trip.description ?? undefined,
        itinerary: (trip.itinerary as unknown as Record<string, unknown>) ?? undefined,
      });
      setAddedTrip(created);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to add this trip");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,19,15,0.45)] px-4 py-6 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-[var(--ws-line)] bg-[#fffdf8] shadow-2xl shadow-stone-950/20">
        <div className="relative">
          {heroImageUrl ? (
            <div className="relative h-44 w-full overflow-hidden rounded-t-[2rem] sm:h-52">
              <img
                src={heroImageUrl}
                alt={trip.destination}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(20,19,15,0.82)] via-[rgba(20,19,15,0.25)] to-transparent" />
              <div className="absolute inset-x-0 bottom-0 px-6 pb-5">
                <p className="ws-mono text-white/70">Community trip</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-white">
                  {trip.title}
                </h2>
                <p className="mt-1 text-sm font-medium text-white/80">{trip.destination}</p>
              </div>
            </div>
          ) : (
            <div className="px-6 pt-6">
              <p className="ws-mono text-[var(--ws-green)]">Community trip</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                {trip.title}
              </h2>
              <p className="mt-1 text-sm font-medium text-[var(--ws-muted)]">{trip.destination}</p>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close trip details"
            className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full border border-[var(--ws-line)] bg-[#fffdf8] text-xl leading-none text-[var(--ws-muted)] shadow-sm transition hover:border-[rgba(20,19,15,0.24)] hover:text-[var(--ws-ink)]"
          >
            ×
          </button>
        </div>

        <div className="p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--ws-muted)]">
            <span className="rounded-full bg-[var(--ws-cream)] px-3 py-1.5 font-medium">
              Shared by {trip.owner_name}
            </span>
            <span className="rounded-full bg-[var(--ws-cream)] px-3 py-1.5 font-medium">
              {dayCount || "-"} day{dayCount === 1 ? "" : "s"}
            </span>
            {trip.itinerary && (
              <span className="rounded-full bg-[var(--ws-cream)] px-3 py-1.5 font-medium">
                {formatMoney(trip.itinerary.estimated_total, currency)}
              </span>
            )}
          </div>

          {trip.description && (
            <p className="mt-4 text-sm leading-6 text-[var(--ws-muted)]">{trip.description}</p>
          )}

          {addedTrip ? (
            <div className="mt-6 rounded-[1.5rem] border border-[rgba(46,125,79,0.24)] bg-[var(--ws-green-tint)] px-5 py-5">
              <p className="ws-mono text-[var(--ws-green)]">Added to your trips</p>
              <p className="mt-2 text-sm leading-6 text-[var(--ws-ink-soft)]">
                {addedTrip.title} is now an active trip in your dashboard. Tweak it, plan around
                it, or mark it complete once you've travelled.
              </p>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <Link to={`/trips/${addedTrip.id}`} className="ws-btn-primary px-5 py-2.5 text-sm">
                  Open itinerary
                </Link>
                <Link to="/trips" className="ws-btn-secondary px-5 py-2.5 text-sm">
                  Go to My Trips
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="mt-6 space-y-4">
                {trip.itinerary?.days?.map((day) => (
                  <article
                    key={day.day}
                    className="rounded-[1.5rem] border border-[var(--ws-line)] bg-[rgba(255,244,239,0.5)] p-5"
                  >
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-[var(--ws-muted)]">Day {day.day}</p>
                      {day.theme && (
                        <span className="rounded-full bg-[rgba(232,93,44,0.12)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ws-orange)]">
                          {day.theme}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                      {new Date(day.date).toLocaleDateString(undefined, {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      })}
                    </h3>

                    <div className="mt-4 space-y-2">
                      {timelineForDay(day).map((item, index) => {
                        const note = visibleTimelineNote(item);
                        return (
                          <div
                            key={`${day.day}-${item.time}-${item.title}-${index}`}
                            className="grid gap-3 rounded-[1.25rem] bg-white/70 px-4 py-3 sm:grid-cols-[72px_1fr_auto] sm:items-center"
                          >
                            <div className="text-sm font-medium text-[var(--ws-muted)]">{item.time}</div>
                            <div>
                              <p className="text-sm font-semibold text-[var(--ws-ink)]">{item.title}</p>
                              <p className="mt-0.5 text-xs capitalize text-[var(--ws-muted)]">{item.category}</p>
                              {item.description && (
                                <p className="mt-1 text-xs text-[rgba(87,84,74,0.85)]">{item.description}</p>
                              )}
                              {note && <p className="mt-1 text-xs text-[var(--ws-muted)]">{note}</p>}
                            </div>
                            <div className="text-sm font-medium text-[var(--ws-muted)]">
                              {formatMoney(item.cost, currency)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </article>
                ))}

                {dayCount === 0 && (
                  <p className="rounded-[1.5rem] border border-dashed border-[var(--ws-line)] bg-[rgba(255,244,239,0.6)] px-5 py-8 text-center text-sm text-[var(--ws-muted)]">
                    This trip doesn't have a day-by-day itinerary attached.
                  </p>
                )}
              </div>

              {error && (
                <p className="mt-5 rounded-2xl border border-[rgba(228,87,46,0.24)] bg-[var(--ws-cream)] px-4 py-3 text-sm text-[var(--ws-orange)]">
                  {error}
                </p>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full px-5 py-3 text-sm font-semibold text-[var(--ws-muted)] transition hover:text-[var(--ws-ink)]"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleAddTrip}
                  disabled={adding}
                  className="ws-btn-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {adding ? "Adding..." : "Add to my trips"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
