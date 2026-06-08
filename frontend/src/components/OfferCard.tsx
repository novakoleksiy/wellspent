import { Link } from "react-router-dom";
import { formatPrice, formatValidity, offerHeroImageUrl } from "../offerFormat";
import type { OfferOut } from "../types";

type OfferCardProps = {
    offer: OfferOut;
};

export default function OfferCard({ offer }: OfferCardProps) {
    const heroImageUrl = offerHeroImageUrl(offer);
    const price = formatPrice(offer.price_amount, offer.price_currency);
    const validity = formatValidity(offer.valid_from, offer.valid_through);
    const summary = offer.abstract || offer.description;

    return (
        <Link
            to={`/offers/${offer.id}`}
            className={heroImageUrl
                ? "flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[var(--ws-line)] bg-[#fffdf8] transition hover:border-[rgba(20,19,15,0.24)]"
                : "flex h-full flex-col rounded-[1.75rem] border border-[var(--ws-line)] bg-[rgba(255,244,239,0.6)] px-5 py-5 transition hover:border-[rgba(20,19,15,0.24)] hover:bg-[#fffdf8]"}
        >
            {heroImageUrl && (
                <img
                    src={heroImageUrl}
                    alt={offer.name}
                    className="h-40 w-full object-cover"
                    loading="lazy"
                />
            )}
            <div className={heroImageUrl ? "flex flex-1 flex-col px-5 py-5" : "flex flex-1 flex-col"}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--ws-muted)]">
                            {offer.area_name ?? "Bookable experience"}
                        </p>
                        <p className="mt-2 line-clamp-2 text-xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                            {offer.name}
                        </p>
                    </div>
                    {price && (
                        <span className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--ws-ink)] shadow-sm">
                            {price}
                        </span>
                    )}
                </div>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-[var(--ws-muted)]">
                    {summary || "A bookable Swiss experience, ready to reserve."}
                </p>
                <div className="mt-auto flex items-center justify-between pt-5 text-sm text-[var(--ws-muted)]">
                    <span>{validity ?? "Book online"}</span>
                    <span className="font-medium text-[var(--ws-orange)]">View offer</span>
                </div>
            </div>
        </Link>
    );
}
