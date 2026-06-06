import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getTour, listTours } from "../api/swissTourism";
import AppShell from "../components/AppShell";
import {
    formatDistance,
    formatDuration,
    isSameSeries,
    parseTourSeries,
    tourHeroImageUrl,
    tourStageLabel,
    tourStatsLine,
    type TourSeries,
} from "../tourFormat";
import type { TourOut } from "../types";

function waypointLabel(index: number, total: number): string {
    if (index === 0) return "Start";
    if (index === total - 1) return "Finish";
    return `Stop ${index}`;
}

type Stage = { tour: TourOut; series: TourSeries; isCurrent: boolean };

export default function TourDetailPage() {
    const { id } = useParams();
    const [tour, setTour] = useState<TourOut | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [related, setRelated] = useState<{ tourId: string; stages: Stage[] }>({
        tourId: "",
        stages: [],
    });

    useEffect(() => {
        if (!id) return;
        getTour(id)
            .then(setTour)
            .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Unable to load tour");
            })
            .finally(() => setLoading(false));
    }, [id]);

    // A tour like "Rhine Route, Stage 4/9" belongs to a multi-stage route. Search
    // by the route name to pull in the sibling stages and link them together.
    useEffect(() => {
        if (!tour) return;
        const series = parseTourSeries(tour.name);
        if (!series) return;

        const controller = new AbortController();
        listTours({ query: series.routeName, pageSize: 24, signal: controller.signal })
            .then((result) => {
                const siblings = new Map<string, Stage>();
                for (const candidate of result.data) {
                    const candidateSeries = parseTourSeries(candidate.name);
                    if (candidateSeries && isSameSeries(candidateSeries, series)) {
                        siblings.set(candidate.id, {
                            tour: candidate,
                            series: candidateSeries,
                            isCurrent: candidate.id === tour.id,
                        });
                    }
                }
                // The current tour is the source of truth and may fall outside the
                // search page, so make sure it is always present.
                siblings.set(tour.id, { tour, series, isCurrent: true });

                const ordered = [...siblings.values()].sort(
                    (a, b) => a.series.stage - b.series.stage,
                );
                setRelated({ tourId: tour.id, stages: ordered.length > 1 ? ordered : [] });
            })
            .catch(() => setRelated({ tourId: tour.id, stages: [] }));

        return () => controller.abort();
    }, [tour]);

    if (loading) {
        return (
            <AppShell title="Tour details" description="Loading this Swiss tour.">
                <div className="h-72 animate-pulse rounded-[2rem] bg-[#fffdf8]/70 shadow-sm" />
            </AppShell>
        );
    }

    if (!tour) {
        return (
            <AppShell title="Tour details" description="We could not find this tour.">
                <div className="rounded-[2rem] border border-[rgba(228,87,46,0.24)] bg-[var(--ws-cream)] px-6 py-8 text-[var(--ws-orange)]">
                    {error || "Tour not found."}
                </div>
            </AppShell>
        );
    }

    const heroImageUrl = tourHeroImageUrl(tour);
    const distance = formatDistance(tour.distance_km);
    const duration = formatDuration(tour.duration_minutes);
    const waypoints = tour.waypoints;
    const provider = tour.provider;
    const series = parseTourSeries(tour.name);
    // Only trust fetched stages once they belong to the tour now on screen.
    const stages = related.tourId === tour.id ? related.stages : [];

    const stats: { label: string; value: string }[] = [];
    if (distance) stats.push({ label: "Distance", value: distance });
    if (duration) stats.push({ label: "Duration", value: duration });
    if (tour.ascent_m != null) stats.push({ label: "Ascent", value: `${tour.ascent_m} m` });
    if (tour.descent_m != null) stats.push({ label: "Descent", value: `${tour.descent_m} m` });

    return (
        <AppShell
            title={tour.name}
            description="A ready-made Swiss itinerary, planned end to end and ready to follow."
            actions={
                <Link to="/tours" className="ws-btn-secondary px-5 py-3 text-sm">
                    Back to tours
                </Link>
            }
        >
            <section className="relative mb-6 overflow-hidden rounded-[2.25rem] bg-[var(--ws-ink)] text-white shadow-xl shadow-stone-900/10">
                {heroImageUrl && (
                    <img
                        src={heroImageUrl}
                        alt={tour.name}
                        className="absolute inset-0 h-full w-full object-cover opacity-45"
                    />
                )}
                {heroImageUrl && <div className="absolute inset-0 bg-[rgba(20,19,15,0.48)]" />}
                <div className="relative grid gap-6 px-6 py-7 sm:px-8 sm:py-8 lg:grid-cols-[1.15fr_0.85fr]">
                    <div>
                        <p className="ws-mono text-white/65">
                            {series
                                ? `${series.routeName}${
                                      series.totalStages
                                          ? ` · Stage ${series.stage} of ${series.totalStages}`
                                          : ` · Stage ${series.stage}`
                                  }`
                                : "Ready-made itinerary"}
                        </p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                            {tour.name}
                        </h2>
                        <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
                            {tour.description ||
                                "A ready-made route, planned end to end and ready to follow at your own pace."}
                        </p>
                        {tour.tourist_types.length > 0 && (
                            <div className="mt-5 flex flex-wrap gap-2">
                                {tour.tourist_types.map((type) => (
                                    <span
                                        key={type}
                                        className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80"
                                    >
                                        {type}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                        {tour.route_type && (
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/8 px-5 py-5">
                                <p className="text-sm text-white/60">Route type</p>
                                <p className="mt-2 text-lg font-semibold">{tour.route_type}</p>
                            </div>
                        )}
                        {tour.difficulty && (
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/8 px-5 py-5">
                                <p className="text-sm text-white/60">Difficulty</p>
                                <p className="mt-2 text-lg font-semibold">{tour.difficulty}</p>
                            </div>
                        )}
                        {distance && (
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/8 px-5 py-5">
                                <p className="text-sm text-white/60">Distance</p>
                                <p className="mt-2 text-lg font-semibold">{distance}</p>
                            </div>
                        )}
                        {duration && (
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/8 px-5 py-5">
                                <p className="text-sm text-white/60">Duration</p>
                                <p className="mt-2 text-lg font-semibold">{duration}</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <section className="space-y-5">
                    <article className="ws-surface p-6">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                            <div>
                                <p className="text-sm font-medium text-[var(--ws-muted)]">Planned itinerary</p>
                                <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                                    The route, stop by stop
                                </h2>
                            </div>
                            <p className="text-sm text-[rgba(87,84,74,0.8)]">
                                {waypoints.length} stop{waypoints.length === 1 ? "" : "s"}
                            </p>
                        </div>

                        {waypoints.length > 0 ? (
                            <div className="mt-6 space-y-3">
                                {waypoints.map((place, index) => (
                                    <div
                                        key={`${place}-${index}`}
                                        className="grid gap-4 rounded-[1.5rem] border border-[var(--ws-line)] bg-[rgba(255,244,239,0.5)] px-4 py-4 sm:grid-cols-[96px_1fr] sm:items-center"
                                    >
                                        <div className="text-sm font-medium text-[var(--ws-muted)]">
                                            {waypointLabel(index, waypoints.length)}
                                        </div>
                                        <div>
                                            <p className="text-base font-semibold text-[var(--ws-ink)]">
                                                {place}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="mt-6 text-sm leading-6 text-[var(--ws-muted)]">
                                A stop-by-stop breakdown is not available for this tour. Open the full
                                route for the complete planned itinerary.
                            </p>
                        )}
                    </article>

                    {series && stages.length > 0 && (
                        <article className="ws-surface p-6">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <p className="text-sm font-medium text-[var(--ws-muted)]">
                                        Part of {series.routeName}
                                    </p>
                                    <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                                        Continue the route, stage by stage
                                    </h2>
                                </div>
                                <p className="text-sm text-[rgba(87,84,74,0.8)]">
                                    {series.totalStages ?? stages.length} stages
                                </p>
                            </div>

                            <div className="mt-6 space-y-3">
                                {stages.map(({ tour: stageTour, series: stageSeries, isCurrent }) => {
                                    const stats = tourStatsLine(stageTour);
                                    const label = tourStageLabel(stageTour.name, stageSeries);
                                    const rowClass =
                                        "grid gap-4 rounded-[1.5rem] border px-4 py-4 sm:grid-cols-[64px_1fr] sm:items-center";
                                    const content = (
                                        <>
                                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--ws-orange)] text-sm font-semibold text-white">
                                                {stageSeries.stage}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="truncate text-base font-semibold text-[var(--ws-ink)]">
                                                    {label}
                                                </p>
                                                <p className="mt-1 text-sm text-[var(--ws-muted)]">
                                                    {isCurrent
                                                        ? "You are here"
                                                        : stats || "Swiss route"}
                                                </p>
                                            </div>
                                        </>
                                    );

                                    return isCurrent ? (
                                        <div
                                            key={stageTour.id}
                                            aria-current="true"
                                            className={`${rowClass} border-[var(--ws-orange)] bg-[rgba(255,244,239,0.9)]`}
                                        >
                                            {content}
                                        </div>
                                    ) : (
                                        <Link
                                            key={stageTour.id}
                                            to={`/tours/${stageTour.id}`}
                                            className={`${rowClass} border-[var(--ws-line)] bg-[rgba(255,244,239,0.5)] transition hover:border-[rgba(20,19,15,0.24)] hover:bg-[#fffdf8]`}
                                        >
                                            {content}
                                        </Link>
                                    );
                                })}
                            </div>
                        </article>
                    )}
                </section>

                <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
                    <div className="ws-surface p-6">
                        <p className="ws-mono text-[var(--ws-orange)]">Tour summary</p>
                        <div className="mt-6 space-y-5">
                            {stats.map((stat) => (
                                <div key={stat.label}>
                                    <p className="text-sm text-[var(--ws-muted)]">{stat.label}</p>
                                    <p className="mt-1 text-lg font-semibold text-[var(--ws-ink)]">
                                        {stat.value}
                                    </p>
                                </div>
                            ))}
                            {tour.route_type && (
                                <div>
                                    <p className="text-sm text-[var(--ws-muted)]">Route type</p>
                                    <p className="mt-1 text-lg font-semibold text-[var(--ws-ink)]">
                                        {tour.route_type}
                                    </p>
                                </div>
                            )}
                            {tour.difficulty && (
                                <div>
                                    <p className="text-sm text-[var(--ws-muted)]">Difficulty</p>
                                    <p className="mt-1 text-lg font-semibold text-[var(--ws-ink)]">
                                        {tour.difficulty}
                                    </p>
                                </div>
                            )}
                        </div>

                        {tour.url && (
                            <a
                                href={tour.url}
                                target="_blank"
                                rel="noreferrer"
                                className="ws-btn-primary mt-6 block px-5 py-3 text-center text-sm"
                            >
                                View full route on MySwitzerland
                            </a>
                        )}
                    </div>

                    {provider && (
                        <div className="ws-surface p-6">
                            <p className="ws-mono text-[var(--ws-muted)]">More information</p>
                            <p className="mt-2 text-lg font-semibold text-[var(--ws-ink)]">
                                {provider.name}
                            </p>
                            {provider.locality && (
                                <p className="mt-1 text-sm text-[var(--ws-muted)]">{provider.locality}</p>
                            )}
                            <div className="mt-4 space-y-2 text-sm">
                                {provider.url && (
                                    <a
                                        href={provider.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="block font-medium text-[var(--ws-orange)] transition hover:opacity-80"
                                    >
                                        Visit website
                                    </a>
                                )}
                                {provider.phone && (
                                    <a
                                        href={`tel:${provider.phone.replace(/\s+/g, "")}`}
                                        className="block text-[var(--ws-muted)] transition hover:text-[var(--ws-ink)]"
                                    >
                                        {provider.phone}
                                    </a>
                                )}
                                {provider.email && (
                                    <a
                                        href={`mailto:${provider.email}`}
                                        className="block text-[var(--ws-muted)] transition hover:text-[var(--ws-ink)]"
                                    >
                                        {provider.email}
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </aside>
            </div>
        </AppShell>
    );
}
