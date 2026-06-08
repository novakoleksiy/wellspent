import { Link } from "react-router-dom";
import {
  formatDistance,
  formatDuration,
  parseTourSeries,
  routeSlug,
  tourHeroImageUrl,
} from "../tourFormat";
import type { TourOut } from "../types";

interface TourPreviewModalProps {
  tour: TourOut;
  onClose: () => void;
}

function waypointLabel(index: number, total: number): string {
  if (index === 0) return "Start";
  if (index === total - 1) return "Finish";
  return `Stop ${index}`;
}

export default function TourPreviewModal({ tour, onClose }: TourPreviewModalProps) {
  const heroImageUrl = tourHeroImageUrl(tour);
  const distance = formatDistance(tour.distance_km);
  const duration = formatDuration(tour.duration_minutes);
  const series = parseTourSeries(tour.name);
  const provider = tour.provider;

  const stats: { label: string; value: string }[] = [];
  if (tour.route_type) stats.push({ label: "Route type", value: tour.route_type });
  if (tour.difficulty) stats.push({ label: "Difficulty", value: tour.difficulty });
  if (distance) stats.push({ label: "Distance", value: distance });
  if (duration) stats.push({ label: "Duration", value: duration });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,19,15,0.45)] px-4 py-6 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-[var(--ws-line)] bg-[#fffdf8] shadow-2xl shadow-stone-950/20"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative">
          {heroImageUrl ? (
            <div className="relative h-44 w-full overflow-hidden rounded-t-[2rem] sm:h-52">
              <img src={heroImageUrl} alt={tour.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(20,19,15,0.82)] via-[rgba(20,19,15,0.25)] to-transparent" />
              <div className="absolute inset-x-0 bottom-0 px-6 pb-5">
                <p className="ws-mono text-white/70">
                  {series
                    ? `${series.routeName}${
                        series.totalStages
                          ? ` · Stage ${series.stage} of ${series.totalStages}`
                          : ` · Stage ${series.stage}`
                      }`
                    : "Ready-made tour"}
                </p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-white">
                  {tour.name}
                </h2>
              </div>
            </div>
          ) : (
            <div className="px-6 pt-6">
              <p className="ws-mono text-[var(--ws-orange)]">
                {series
                  ? `${series.routeName} · Stage ${series.stage}`
                  : "Ready-made tour"}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                {tour.name}
              </h2>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close tour details"
            className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full border border-[var(--ws-line)] bg-[#fffdf8] text-xl leading-none text-[var(--ws-muted)] shadow-sm transition hover:border-[rgba(20,19,15,0.24)] hover:text-[var(--ws-ink)]"
          >
            ×
          </button>
        </div>

        <div className="p-6 sm:p-7">
          {tour.tourist_types.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {tour.tourist_types.map((type) => (
                <span
                  key={type}
                  className="rounded-full bg-[var(--ws-cream)] px-3 py-1.5 text-sm font-medium text-[var(--ws-muted)]"
                >
                  {type}
                </span>
              ))}
            </div>
          )}

          <p className="mt-4 text-sm leading-6 text-[var(--ws-muted)]">
            {tour.description ||
              "A ready-made route, planned end to end and ready to follow at your own pace."}
          </p>

          {stats.length > 0 && (
            <div className="mt-6 grid grid-cols-2 gap-3 rounded-[1.5rem] bg-white/80 p-4 sm:grid-cols-4">
              {stats.map((stat) => (
                <div key={stat.label}>
                  <p className="ws-mono text-[rgba(87,84,74,0.7)]">{stat.label}</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--ws-ink)]">{stat.value}</p>
                </div>
              ))}
            </div>
          )}

          {tour.waypoints.length > 0 && (
            <div className="mt-6">
              <p className="text-sm font-medium text-[var(--ws-ink)]">
                The route, stop by stop
              </p>
              <div className="mt-3 space-y-2">
                {tour.waypoints.map((place, index) => (
                  <div
                    key={`${place}-${index}`}
                    className="grid gap-3 rounded-[1.25rem] border border-[var(--ws-line)] bg-[rgba(255,244,239,0.5)] px-4 py-3 sm:grid-cols-[80px_1fr] sm:items-center"
                  >
                    <div className="text-sm font-medium text-[var(--ws-muted)]">
                      {waypointLabel(index, tour.waypoints.length)}
                    </div>
                    <div className="text-sm font-semibold text-[var(--ws-ink)]">{place}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {provider && (
            <div className="mt-6 rounded-[1.5rem] border border-[var(--ws-line)] bg-white/70 p-4">
              <p className="ws-mono text-[rgba(87,84,74,0.7)]">More information</p>
              <p className="mt-1 text-sm font-semibold text-[var(--ws-ink)]">{provider.name}</p>
              {provider.locality && (
                <p className="mt-0.5 text-sm text-[var(--ws-muted)]">{provider.locality}</p>
              )}
            </div>
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            {series && (
              <Link
                to={`/tours/route/${routeSlug(series.routeName)}`}
                className="rounded-full px-5 py-3 text-center text-sm font-semibold text-[var(--ws-muted)] transition hover:text-[var(--ws-ink)]"
              >
                View full route
              </Link>
            )}
            {tour.url && (
              <a
                href={tour.url}
                target="_blank"
                rel="noreferrer"
                className="ws-btn-secondary px-5 py-3 text-center text-sm"
              >
                View on MySwitzerland
              </a>
            )}
            <Link to={`/tours/${tour.id}`} className="ws-btn-primary px-5 py-3 text-center text-sm">
              View full details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
