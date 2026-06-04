import { Link } from "react-router-dom";
import { tourHeroImageUrl, tourStatsLine } from "../tourFormat";
import type { TourOut } from "../types";

type TourCardProps = {
    tour: TourOut;
};

export default function TourCard({ tour }: TourCardProps) {
    const heroImageUrl = tourHeroImageUrl(tour);
    const stats = tourStatsLine(tour);
    const startPlace = tour.waypoints[0];

    return (
        <Link
            to={`/tours/${tour.id}`}
            className={heroImageUrl
                ? "flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[var(--ws-line)] bg-[#fffdf8] transition hover:border-[rgba(20,19,15,0.24)]"
                : "flex h-full flex-col rounded-[1.75rem] border border-[var(--ws-line)] bg-[rgba(255,244,239,0.6)] px-5 py-5 transition hover:border-[rgba(20,19,15,0.24)] hover:bg-[#fffdf8]"}
        >
            {heroImageUrl && (
                <img
                    src={heroImageUrl}
                    alt={tour.name}
                    className="h-40 w-full object-cover"
                    loading="lazy"
                />
            )}
            <div className={heroImageUrl ? "flex flex-1 flex-col px-5 py-5" : "flex flex-1 flex-col"}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--ws-muted)]">
                            {startPlace ?? "Swiss tour"}
                        </p>
                        <p className="mt-2 line-clamp-2 text-xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                            {tour.name}
                        </p>
                    </div>
                    {tour.route_type && (
                        <span className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--ws-muted)] shadow-sm">
                            {tour.route_type}
                        </span>
                    )}
                </div>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-[var(--ws-muted)]">
                    {tour.description || "A ready-made Swiss route, planned end to end."}
                </p>
                <div className="mt-auto flex items-center justify-between pt-5 text-sm text-[var(--ws-muted)]">
                    <span>{stats || "Swiss route"}</span>
                    {tour.difficulty && <span className="font-medium">{tour.difficulty}</span>}
                </div>
            </div>
        </Link>
    );
}
