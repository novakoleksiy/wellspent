import { offerToBoardItem, tourEntryToBoardItem, type BoardItem } from "./boardItems";
import { groupToursByRoute } from "./tourFormat";
import type { OfferOut, TourOut } from "./types";

/** ISO-8601 week number — used to rotate the spotlight once per week. */
function isoWeek(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/**
 * Picks a single tour or offer (never a personal trip) that has a hero image to
 * headline the homepage. Rotates deterministically by ISO week so it changes
 * weekly without any backend support. Returns null when nothing is suitable.
 */
export function pickFeatured(tours: TourOut[], offers: OfferOut[]): BoardItem | null {
    const candidates = [
        ...groupToursByRoute(tours).map((entry) => tourEntryToBoardItem(entry)),
        ...offers.map((offer) => offerToBoardItem(offer)),
    ].filter((item) => item.imageUrl);

    if (candidates.length === 0) {
        return null;
    }

    return candidates[isoWeek(new Date()) % candidates.length];
}
