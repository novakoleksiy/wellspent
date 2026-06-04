import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listTours } from "../api/swissTourism";
import AppShell from "../components/AppShell";
import TourCard from "../components/TourCard";
import type { TourOut } from "../types";

export default function ToursPage() {
    const [tours, setTours] = useState<TourOut[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        listTours({ pageSize: 24 })
            .then((result) => setTours(result.data))
            .catch((err: unknown) => {
                setError(err instanceof Error ? err.message : "Unable to load tours");
            })
            .finally(() => setLoading(false));
    }, []);

    return (
        <AppShell
            title="Tours"
            description="Ready-made Swiss itineraries you can follow — scenic hikes, bike stages, and more, each planned end to end."
            actions={
                <Link to="/plan" className="ws-btn-primary px-5 py-3 text-sm">
                    Plan a trip
                </Link>
            }
        >
            <section className="ws-surface p-6 sm:p-7">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="ws-mono text-[var(--ws-orange)]">Ready-made tours</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                            Pre-planned Swiss itineraries.
                        </h2>
                    </div>
                    <span className="ws-pill px-4 py-2 text-sm font-medium">{tours.length}</span>
                </div>

                {error && <p className="ws-error mt-5 px-4 py-3 text-sm">{error}</p>}

                {loading ? (
                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, index) => (
                            <div
                                key={index}
                                className="h-64 animate-pulse rounded-[1.75rem] bg-[var(--ws-cream)]"
                            />
                        ))}
                    </div>
                ) : tours.length === 0 ? (
                    <div className="mt-6 rounded-[1.75rem] border border-dashed border-[var(--ws-line)] bg-[rgba(255,244,239,0.6)] px-6 py-10 text-center">
                        <p className="ws-mono text-[var(--ws-muted)]">Quiet for now</p>
                        <p className="mt-3 text-base leading-7 text-[var(--ws-muted)]">
                            Ready-made tours will appear here once they are available.
                        </p>
                    </div>
                ) : (
                    <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {tours.map((tour) => (
                            <TourCard key={tour.id} tour={tour} />
                        ))}
                    </div>
                )}
            </section>
        </AppShell>
    );
}
