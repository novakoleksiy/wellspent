import { Link } from "react-router-dom";
import { formatPrice, formatValidity, offerHeroImageUrl, offerMapUrl } from "../offerFormat";
import type { OfferOut } from "../types";

interface OfferPreviewModalProps {
  offer: OfferOut;
  onClose: () => void;
}

export default function OfferPreviewModal({ offer, onClose }: OfferPreviewModalProps) {
  const heroImageUrl = offerHeroImageUrl(offer);
  const price = formatPrice(offer.price_amount, offer.price_currency);
  const validity = formatValidity(offer.valid_from, offer.valid_through);
  const mapUrl = offerMapUrl(offer);
  // The first image is the hero; the rest form a gallery.
  const galleryImages = offer.images.slice(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,19,15,0.45)] px-4 py-6 backdrop-blur-sm"
      role="presentation"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-[2rem] border border-[var(--ws-line)] bg-[#fffdf8] shadow-2xl shadow-stone-950/20"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative">
          {heroImageUrl ? (
            <div className="relative h-44 w-full overflow-hidden rounded-t-[2rem] sm:h-52">
              <img src={heroImageUrl} alt={offer.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(20,19,15,0.82)] via-[rgba(20,19,15,0.25)] to-transparent" />
              <div className="absolute inset-x-0 bottom-0 px-6 pb-5">
                <p className="ws-mono text-white/70">{offer.offer_type ?? "Bookable experience"}</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-white">
                  {offer.name}
                </h2>
              </div>
            </div>
          ) : (
            <div className="px-6 pt-6">
              <p className="ws-mono text-[var(--ws-navy)]">
                {offer.offer_type ?? "Bookable experience"}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                {offer.name}
              </h2>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Close offer details"
            className="absolute right-4 top-4 inline-flex size-10 items-center justify-center rounded-full border border-[var(--ws-line)] bg-[#fffdf8] text-xl leading-none text-[var(--ws-muted)] shadow-sm transition hover:border-[rgba(20,19,15,0.24)] hover:text-[var(--ws-ink)]"
          >
            ×
          </button>
        </div>

        <div className="p-6 sm:p-7">
          <div className="flex flex-wrap gap-2">
            {price && (
              <span className="rounded-full bg-[var(--ws-cream)] px-3 py-1.5 text-sm font-medium text-[var(--ws-muted)]">
                {price}
              </span>
            )}
            {offer.area_name && (
              <span className="rounded-full bg-[var(--ws-cream)] px-3 py-1.5 text-sm font-medium text-[var(--ws-muted)]">
                {offer.area_name}
              </span>
            )}
            {validity && (
              <span className="rounded-full bg-[var(--ws-cream)] px-3 py-1.5 text-sm font-medium text-[var(--ws-muted)]">
                {validity}
              </span>
            )}
          </div>

          {offer.abstract && (
            <p className="mt-4 text-sm leading-6 text-[var(--ws-muted)]">{offer.abstract}</p>
          )}

          <div className="mt-6">
            <p className="text-sm font-medium text-[var(--ws-ink)]">What's included</p>
            <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[var(--ws-muted)]">
              {offer.description ||
                offer.abstract ||
                "A bookable Swiss experience. Open the booking page for the full details."}
            </p>
          </div>

          {(price || validity || offer.area_name) && (
            <div className="mt-6 grid grid-cols-2 gap-3 rounded-[1.5rem] bg-white/80 p-4">
              {price && (
                <div className={offer.price_note ? "col-span-2" : undefined}>
                  <p className="ws-mono text-[rgba(87,84,74,0.7)]">Price</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--ws-ink)]">{price}</p>
                  {offer.price_note && (
                    <p className="mt-1 text-sm leading-6 text-[var(--ws-muted)]">{offer.price_note}</p>
                  )}
                </div>
              )}
              {validity && (
                <div>
                  <p className="ws-mono text-[rgba(87,84,74,0.7)]">Bookable</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--ws-ink)]">{validity}</p>
                </div>
              )}
              {offer.area_name && (
                <div>
                  <p className="ws-mono text-[rgba(87,84,74,0.7)]">Location</p>
                  <p className="mt-1 text-sm font-semibold text-[var(--ws-ink)]">{offer.area_name}</p>
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
          )}

          {galleryImages.length > 0 && (
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
          )}

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
            {offer.info_url && (
              <a
                href={offer.info_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full px-5 py-3 text-center text-sm font-semibold text-[var(--ws-muted)] transition hover:text-[var(--ws-ink)]"
              >
                More info
              </a>
            )}
            {offer.booking_url && (
              <a
                href={offer.booking_url}
                target="_blank"
                rel="noopener noreferrer"
                className="ws-btn-secondary px-5 py-3 text-center text-sm"
              >
                Book now
              </a>
            )}
            <Link to={`/offers/${offer.id}`} className="ws-btn-primary px-5 py-3 text-center text-sm">
              View full details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
