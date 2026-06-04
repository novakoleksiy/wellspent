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
