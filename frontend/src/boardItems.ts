import { formatPrice, offerHeroImageUrl } from "./offerFormat";
import { routeSlug, tourHeroImageUrl, tourStatsLine, type TourListEntry } from "./tourFormat";
import { getTripHeroImageUrl } from "./tripImages";
import type { CommunityTripOut, OfferOut, TourOut } from "./types";

/** The three content types that share the Explore board and Home rails. */
export type BoardKind = "trip" | "tour" | "offer";

/** A normalized, type-tagged item rendered by BoardCard / the spotlight. */
export interface BoardItem {
    key: string;
    kind: BoardKind;
    title: string;
    subtitle: string;
    imageUrl: string | null;
    /** Link target. Mutually exclusive with onSelect. */
    to?: string;
    /** Click handler — every board kind opens a preview modal in place. */
    onSelect?: () => void;
}

/** Single source of truth for per-type colour coding, shared by both pages. */
export const BOARD_META: Record<
    BoardKind,
    { label: string; accent: string; badgeClass: string; tintClass: string }
> = {
    trip: {
        label: "Trip",
        accent: "var(--ws-green)",
        badgeClass: "bg-[var(--ws-green)] text-white",
        tintClass: "bg-[var(--ws-green-tint)] text-[var(--ws-green)]",
    },
    tour: {
        label: "Tour",
        accent: "var(--ws-orange)",
        badgeClass: "bg-[var(--ws-orange)] text-white",
        tintClass: "bg-[rgba(228,87,46,0.12)] text-[var(--ws-orange)]",
    },
    offer: {
        label: "Offer",
        accent: "var(--ws-navy)",
        badgeClass: "bg-[var(--ws-navy)] text-white",
        tintClass: "bg-[var(--ws-navy-tint)] text-[var(--ws-navy)]",
    },
};

export function communityTripToBoardItem(
    trip: CommunityTripOut,
    onOpen: (trip: CommunityTripOut) => void,
): BoardItem {
    return {
        key: `trip:${trip.id}`,
        kind: "trip",
        title: trip.title,
        subtitle: trip.destination,
        imageUrl: getTripHeroImageUrl(trip.itinerary),
        onSelect: () => onOpen(trip),
    };
}

/**
 * When `onOpen` is provided the card opens a preview modal in place (the Explore
 * board); when omitted it falls back to a link to the detail page (the homepage
 * spotlight, which navigates rather than previewing).
 */
export function tourEntryToBoardItem(
    entry: TourListEntry,
    onOpen?: (tour: TourOut) => void,
): BoardItem {
    if (entry.kind === "route") {
        const startPlace = entry.representative.waypoints[0];
        const stages = `${entry.stageCount} stage${entry.stageCount === 1 ? "" : "s"}`;
        // Routes collapse multiple stages; preview the representative stage tour.
        return {
            key: `route:${entry.routeName.toLowerCase()}`,
            kind: "tour",
            title: entry.routeName,
            subtitle: startPlace ? `From ${startPlace} · ${stages}` : stages,
            imageUrl: tourHeroImageUrl(entry.representative),
            ...(onOpen
                ? { onSelect: () => onOpen(entry.representative) }
                : { to: `/tours/route/${routeSlug(entry.routeName)}` }),
        };
    }

    const { tour } = entry;
    return {
        key: `tour:${tour.id}`,
        kind: "tour",
        title: tour.name,
        subtitle: tourStatsLine(tour) || tour.waypoints[0] || "Swiss tour",
        imageUrl: tourHeroImageUrl(tour),
        ...(onOpen ? { onSelect: () => onOpen(tour) } : { to: `/tours/${tour.id}` }),
    };
}

export function offerToBoardItem(
    offer: OfferOut,
    onOpen?: (offer: OfferOut) => void,
): BoardItem {
    return {
        key: `offer:${offer.id}`,
        kind: "offer",
        title: offer.name,
        subtitle: formatPrice(offer.price_amount, offer.price_currency) ?? offer.area_name ?? "Bookable offer",
        imageUrl: offerHeroImageUrl(offer),
        ...(onOpen ? { onSelect: () => onOpen(offer) } : { to: `/offers/${offer.id}` }),
    };
}

/** Round-robin merge so the masonry board mixes types instead of clustering them. */
export function interleave(...lists: BoardItem[][]): BoardItem[] {
    const merged: BoardItem[] = [];
    const max = Math.max(0, ...lists.map((list) => list.length));
    for (let i = 0; i < max; i += 1) {
        for (const list of lists) {
            if (i < list.length) {
                merged.push(list[i]);
            }
        }
    }
    return merged;
}
