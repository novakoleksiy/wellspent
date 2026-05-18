import type { Itinerary } from "./types";

export function getTripHeroImageUrl(itinerary: Itinerary | null): string | null {
    if (!itinerary) return null;

    for (const day of itinerary.days) {
        for (const item of day.timeline_items ?? []) {
            if (item.kind === "activity" && item.image_url) return item.image_url;
        }
        for (const activity of day.activities) {
            if (activity.image_url) return activity.image_url;
        }
    }

    return null;
}
