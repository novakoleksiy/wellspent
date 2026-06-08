import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { listTours } from "../api/swissTourism";
import AppShell from "../components/AppShell";
import { isSameSeries, parseTourSeries } from "../tourFormat";
import type { TourOut } from "../types";

type Resolution =
    | { status: "loading" }
    | { status: "ready"; tourId: string }
    | { status: "error" };

export default function RouteDetailPage() {
    const { name } = useParams();
    const routeName = name ? decodeURIComponent(name) : "";
    const [resolution, setResolution] = useState<Resolution>({ status: "loading" });

    // Resolve the route to its first stage and hand off to the stage detail
    // view, which already lists every stage with links — so entering a route
    // always starts at 1/n.
    useEffect(() => {
        if (!routeName) return;

        const controller = new AbortController();
        listTours({ query: routeName, pageSize: 24, signal: controller.signal })
            .then((result) => {
                const target = { routeName, stage: 0, totalStages: null };
                const stages: { tour: TourOut; stage: number }[] = [];
                for (const tour of result.data) {
                    const series = parseTourSeries(tour.name);
                    if (series && isSameSeries(series, target)) {
                        stages.push({ tour, stage: series.stage });
                    }
                }
                stages.sort((a, b) => a.stage - b.stage);

                setResolution(
                    stages.length > 0
                        ? { status: "ready", tourId: stages[0].tour.id }
                        : { status: "error" },
                );
            })
            .catch(() => setResolution({ status: "error" }));

        return () => controller.abort();
    }, [routeName]);

    if (resolution.status === "ready") {
        return <Navigate to={`/tours/${resolution.tourId}`} replace />;
    }

    if (!routeName || resolution.status === "error") {
        return (
            <AppShell title={routeName || "Route"} description="We could not find this route.">
                <div className="ws-surface p-6">
                    <p className="text-sm leading-6 text-[var(--ws-muted)]">
                        This route is not available right now.
                    </p>
                    <Link to="/tours" className="ws-btn-secondary mt-5 inline-block px-5 py-3 text-sm">
                        Back to tours
                    </Link>
                </div>
            </AppShell>
        );
    }

    return (
        <AppShell title={routeName} description="Opening this Swiss route, stage by stage.">
            <div className="h-72 animate-pulse rounded-[2rem] bg-[#fffdf8]/70 shadow-sm" />
        </AppShell>
    );
}
