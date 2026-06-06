import type { TourOut } from "./types";

export function formatDuration(minutes: number | null | undefined): string | null {
    if (minutes == null || minutes <= 0) {
        return null;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours === 0) {
        return `${mins}m`;
    }
    if (mins === 0) {
        return `${hours}h`;
    }
    return `${hours}h ${mins}m`;
}

export function formatDistance(km: number | null | undefined): string | null {
    if (km == null || km <= 0) {
        return null;
    }
    return `${Number.isInteger(km) ? km : km.toFixed(1)} km`;
}

export function tourHeroImageUrl(tour: TourOut): string | null {
    return tour.images?.[0]?.url ?? null;
}

/** Short "43 km · 5h 50m" style summary for cards. */
export function tourStatsLine(tour: TourOut): string {
    return [formatDistance(tour.distance_km), formatDuration(tour.duration_minutes)]
        .filter(Boolean)
        .join(" · ");
}

/**
 * Multi-stage routes encode their relationship in the tour name, e.g.
 * "Rhine Route, Stage 4/9". This identifies the parent route ("series") so
 * sibling stages can be linked together.
 */
export interface TourSeries {
    /** The parent route name, e.g. "Rhine Route". */
    routeName: string;
    /** This tour's stage number within the route. */
    stage: number;
    /** Total number of stages, when the name spells it out (the "9" in "4/9"). */
    totalStages: number | null;
}

// "<route>[ , – — - ] Stage <n>[/<total>]" anchored at the end of the name.
const STAGE_PATTERN = /^(.*?)[\s,–—-]*stage\s+(\d+)(?:\s*\/\s*(\d+))?\s*$/i;

export function parseTourSeries(name: string): TourSeries | null {
    const match = name.match(STAGE_PATTERN);
    if (!match) {
        return null;
    }
    const routeName = match[1].replace(/[\s,–—-]+$/, "").trim();
    const stage = Number(match[2]);
    if (!routeName || !Number.isFinite(stage)) {
        return null;
    }
    const totalStages = match[3] ? Number(match[3]) : null;
    return { routeName, stage, totalStages };
}

/** Two tours belong to the same route when their parsed route names match. */
export function isSameSeries(a: TourSeries, b: TourSeries): boolean {
    return a.routeName.toLowerCase() === b.routeName.toLowerCase();
}

/** Drops the "<route>, " prefix so a stage can be labelled on its own. */
export function tourStageLabel(name: string, series: TourSeries): string {
    const stripped = name.replace(/[\s,–—-]+$/, "").trim();
    if (stripped.toLowerCase().startsWith(series.routeName.toLowerCase())) {
        const rest = stripped.slice(series.routeName.length).replace(/^[\s,–—-]+/, "").trim();
        if (rest) {
            return rest;
        }
    }
    return `Stage ${series.stage}`;
}

/** Slug used in the `/tours/route/:name` URL for a grouped route. */
export function routeSlug(routeName: string): string {
    return encodeURIComponent(routeName);
}

/** A standalone tour, or a multi-stage route collapsed into a single entry. */
export type TourListEntry =
    | { kind: "tour"; tour: TourOut }
    | {
          kind: "route";
          routeName: string;
          /** Best known stage count — the "9" in "4/9", or the highest stage seen. */
          stageCount: number;
          /** Lowest stage present, used for the card preview (image, start place). */
          representative: TourOut;
      };

/**
 * Collapses stages of the same route into one entry so listings show "Rhine
 * Route" once instead of every "Rhine Route, Stage n/9". Standalone tours are
 * passed through untouched, and the original ordering is preserved.
 */
export function groupToursByRoute(tours: TourOut[]): TourListEntry[] {
    const entries: TourListEntry[] = [];
    const routeIndexByName = new Map<string, number>();
    // Track the representative's stage separately so we can keep the lowest one.
    const representativeStage = new Map<string, number>();

    for (const tour of tours) {
        const series = parseTourSeries(tour.name);
        if (!series) {
            entries.push({ kind: "tour", tour });
            continue;
        }

        const key = series.routeName.toLowerCase();
        const existingIndex = routeIndexByName.get(key);
        if (existingIndex === undefined) {
            routeIndexByName.set(key, entries.length);
            representativeStage.set(key, series.stage);
            entries.push({
                kind: "route",
                routeName: series.routeName,
                stageCount: series.totalStages ?? series.stage,
                representative: tour,
            });
            continue;
        }

        const entry = entries[existingIndex];
        if (entry.kind !== "route") {
            continue;
        }
        entry.stageCount = series.totalStages ?? Math.max(entry.stageCount, series.stage);
        if (series.stage < (representativeStage.get(key) ?? Infinity)) {
            representativeStage.set(key, series.stage);
            entry.representative = tour;
        }
    }

    return entries;
}
