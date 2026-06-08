import { Link } from "react-router-dom";
import { routeSlug, tourHeroImageUrl } from "../tourFormat";
import type { TourOut } from "../types";

type RouteCardProps = {
    routeName: string;
    stageCount: number;
    representative: TourOut;
};

export default function RouteCard({ routeName, stageCount, representative }: RouteCardProps) {
    const heroImageUrl = tourHeroImageUrl(representative);
    const startPlace = representative.waypoints[0];
    const stageLabel = `${stageCount} stage${stageCount === 1 ? "" : "s"}`;

    return (
        <Link
            to={`/tours/route/${routeSlug(routeName)}`}
            className={heroImageUrl
                ? "flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[var(--ws-line)] bg-[#fffdf8] transition hover:border-[rgba(20,19,15,0.24)]"
                : "flex h-full flex-col rounded-[1.75rem] border border-[var(--ws-line)] bg-[rgba(255,244,239,0.6)] px-5 py-5 transition hover:border-[rgba(20,19,15,0.24)] hover:bg-[#fffdf8]"}
        >
            {heroImageUrl && (
                <div className="relative">
                    <img
                        src={heroImageUrl}
                        alt={routeName}
                        className="h-40 w-full object-cover"
                        loading="lazy"
                    />
                    <span className="absolute left-4 top-4 rounded-full bg-[var(--ws-orange)] px-3 py-1 text-xs font-semibold text-white shadow-sm">
                        {stageLabel}
                    </span>
                </div>
            )}
            <div className={heroImageUrl ? "flex flex-1 flex-col px-5 py-5" : "flex flex-1 flex-col"}>
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-[var(--ws-muted)]">
                            {startPlace ? `From ${startPlace}` : "Multi-stage route"}
                        </p>
                        <p className="mt-2 line-clamp-2 text-xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                            {routeName}
                        </p>
                    </div>
                    {!heroImageUrl && (
                        <span className="shrink-0 whitespace-nowrap rounded-full bg-white px-3 py-1 text-xs font-medium text-[var(--ws-muted)] shadow-sm">
                            {stageLabel}
                        </span>
                    )}
                </div>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-[var(--ws-muted)]">
                    {representative.description ||
                        "A multi-stage Swiss route — follow it stage by stage from start to finish."}
                </p>
                <div className="mt-auto flex items-center justify-between pt-5 text-sm text-[var(--ws-muted)]">
                    <span>Stage-by-stage route</span>
                    <span className="font-medium text-[var(--ws-orange)]">View stages →</span>
                </div>
            </div>
        </Link>
    );
}
