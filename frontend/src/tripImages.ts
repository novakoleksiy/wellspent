import type { Itinerary } from "./types";

function asObject(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function imageUrlFrom(value: unknown): string | null {
    const object = asObject(value);
    const imageUrl = object?.image_url;
    return typeof imageUrl === "string" && imageUrl.length > 0 ? imageUrl : null;
}

export function getTripHeroImageUrl(itinerary: Itinerary | null): string | null {
    const itineraryObject = asObject(itinerary);
    const days = itineraryObject?.days;

    if (!Array.isArray(days)) return null;

    for (const day of days) {
        const dayObject = asObject(day);
        const timelineItems = dayObject?.timeline_items;
        if (Array.isArray(timelineItems)) {
            for (const item of timelineItems) {
                const itemObject = asObject(item);
                if (itemObject?.kind !== "activity") continue;

                const imageUrl = imageUrlFrom(item);
                if (imageUrl) return imageUrl;
            }
        }

        const activities = dayObject?.activities;
        if (Array.isArray(activities)) {
            for (const activity of activities) {
                const imageUrl = imageUrlFrom(activity);
                if (imageUrl) return imageUrl;
            }
        }
    }

    return null;
}
