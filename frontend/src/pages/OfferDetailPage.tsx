import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getOffer } from "../api/swissTourism";
import AppShell from "../components/AppShell";
import {
    formatPrice,
    formatValidity,
    offerHeroImageUrl,
    offerMapUrl,
} from "../offerFormat";
import type { OfferOut } from "../types";

export default function OfferDetailPage() {
    const { id } = useParams();
    const [offer, setOffer] = useState<OfferOut | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!id) return;
        getOffer(id)
            .then(setOffer)
            .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Unable to load offer");
            })
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <AppShell title="Offer details" description="Loading this Swiss offer.">
                <div className="h-72 animate-pulse rounded-[2rem] bg-[#fffdf8]/70 shadow-sm" />
            </AppShell>
        );
    }

    if (!offer) {
        return (
            <AppShell title="Offer details" description="We could not find this offer.">
                <div className="rounded-[2rem] border border-[rgba(228,87,46,0.24)] bg-[var(--ws-cream)] px-6 py-8 text-[var(--ws-orange)]">
                    {error || "Offer not found."}
                </div>
            </AppShell>
        );
    }

    const heroImageUrl = offerHeroImageUrl(offer);
    const price = formatPrice(offer.price_amount, offer.price_currency);
    const validity = formatValidity(offer.valid_from, offer.valid_through);
    const mapUrl = offerMapUrl(offer);
    // The first image is the hero; the rest form a gallery.
    const galleryImages = offer.images.slice(1);

    return (
        <AppShell
            title={offer.name}
            description="A bookable Swiss experience, ready to reserve online."
            actions={
                <Link to="/offers" className="ws-btn-secondary px-5 py-3 text-sm">
                    Back to offers
                </Link>
            }
        >
            <section className="relative mb-6 overflow-hidden rounded-[2.25rem] bg-[var(--ws-ink)] text-white shadow-xl shadow-stone-900/10">
                {heroImageUrl && (
                    <img
                        src={heroImageUrl}
                        alt={offer.name}
                        className="absolute inset-0 h-full w-full object-cover opacity-45"
                    />
                )}
                {heroImageUrl && <div className="absolute inset-0 bg-[rgba(20,19,15,0.48)]" />}
                <div className="relative grid gap-6 px-6 py-7 sm:px-8 sm:py-8 lg:grid-cols-[1.15fr_0.85fr]">
                    <div>
                        <p className="ws-mono text-white/65">
                            {offer.offer_type ?? "Bookable experience"}
                        </p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] sm:text-4xl">
                            {offer.name}
                        </h2>
                        {offer.abstract && (
                            <p className="mt-4 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
                                {offer.abstract}
                            </p>
                        )}
                        <div className="mt-5 flex flex-wrap gap-2">
                            {offer.area_name && (
                                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                                    {offer.area_name}
                                </span>
                            )}
                            {validity && (
                                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white/80">
                                    {validity}
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                        {price && (
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/8 px-5 py-5">
                                <p className="text-sm text-white/60">Price</p>
                                <p className="mt-2 text-lg font-semibold">{price}</p>
                            </div>
                        )}
                        {validity && (
                            <div className="rounded-[1.75rem] border border-white/10 bg-white/8 px-5 py-5">
                                <p className="text-sm text-white/60">Bookable</p>
                                <p className="mt-2 text-lg font-semibold">{validity}</p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                <section className="space-y-5">
                    <article className="ws-surface p-6">
                        <p className="text-sm font-medium text-[var(--ws-muted)]">About this offer</p>
                        <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                            What's included
                        </h2>
                        <p className="mt-4 whitespace-pre-line text-sm leading-7 text-[var(--ws-muted)]">
                            {offer.description ||
                                offer.abstract ||
                                "A bookable Swiss experience. Open the booking page for the full details."}
                        </p>
                    </article>

                    {galleryImages.length > 0 && (
                        <article className="ws-surface p-6">
                            <p className="text-sm font-medium text-[var(--ws-muted)]">Gallery</p>
                            <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                                A look at the experience
                            </h2>
                            <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                {galleryImages.map((image, index) => (
                                    <img
                                        key={`${image.url}-${index}`}
                                        src={image.url}
                                        alt={image.title || offer.name}
                                        className="h-40 w-full rounded-[1.5rem] object-cover"
                                        loading="lazy"
                                    />
                                ))}
                            </div>
                        </article>
                    )}
                </section>

                <aside className="space-y-5 xl:sticky xl:top-28 xl:self-start">
                    <div className="ws-surface p-6">
                        <p className="ws-mono text-[var(--ws-orange)]">Booking</p>
                        <div className="mt-6 space-y-5">
                            {price && (
                                <div>
                                    <p className="text-sm text-[var(--ws-muted)]">Price</p>
                                    <p className="mt-1 text-lg font-semibold text-[var(--ws-ink)]">
                                        {price}
                                    </p>
                                    {offer.price_note && (
                                        <p className="mt-1 text-sm leading-6 text-[var(--ws-muted)]">
                                            {offer.price_note}
                                        </p>
                                    )}
                                </div>
                            )}
                            {validity && (
                                <div>
                                    <p className="text-sm text-[var(--ws-muted)]">Bookable</p>
                                    <p className="mt-1 text-lg font-semibold text-[var(--ws-ink)]">
                                        {validity}
                                    </p>
                                </div>
                            )}
                            {offer.area_name && (
                                <div>
                                    <p className="text-sm text-[var(--ws-muted)]">Location</p>
                                    <p className="mt-1 text-lg font-semibold text-[var(--ws-ink)]">
                                        {offer.area_name}
                                    </p>
                                    {mapUrl && (
                                        <a
                                            href={mapUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="mt-1 block text-sm font-medium text-[var(--ws-orange)] transition hover:opacity-80"
                                        >
                                            View on map
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>

                        {offer.booking_url && (
                            <a
                                href={offer.booking_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ws-btn-primary mt-6 block px-5 py-3 text-center text-sm"
                            >
                                Book now
                            </a>
                        )}
                        {offer.info_url && (
                            <a
                                href={offer.info_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ws-btn-secondary mt-3 block px-5 py-3 text-center text-sm"
                            >
                                More info on MySwitzerland
                            </a>
                        )}
                    </div>
                </aside>
            </div>
        </AppShell>
    );
}
