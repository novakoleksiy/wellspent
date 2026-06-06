import type { OfferOut } from "./types";

/** "from CHF 92" style price label; null when no price is available. */
export function formatPrice(
    amount: number | null | undefined,
    currency: string | null | undefined,
): string | null {
    if (amount == null || amount <= 0) {
        return null;
    }
    const value = Number.isInteger(amount) ? amount : amount.toFixed(2);
    return currency ? `from ${currency} ${value}` : `from ${value}`;
}

function formatDate(value: string): string | null {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

/**
 * Human-readable bookable window, e.g. "13 May 2026 – 18 Oct 2026". Collapses to
 * a single date when the two ends match, and degrades gracefully when only one
 * end (or neither) is present.
 */
export function formatValidity(
    validFrom: string | null | undefined,
    validThrough: string | null | undefined,
): string | null {
    const from = validFrom ? formatDate(validFrom) : null;
    const through = validThrough ? formatDate(validThrough) : null;

    if (from && through) {
        return from === through ? from : `${from} – ${through}`;
    }
    if (from) {
        return `From ${from}`;
    }
    if (through) {
        return `Until ${through}`;
    }
    return null;
}

export function offerHeroImageUrl(offer: OfferOut): string | null {
    return offer.images?.[0]?.url ?? null;
}

/** Google Maps search link from an offer's coordinates, when available. */
export function offerMapUrl(offer: OfferOut): string | null {
    if (!offer.geo) {
        return null;
    }
    const { latitude, longitude } = offer.geo;
    return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
