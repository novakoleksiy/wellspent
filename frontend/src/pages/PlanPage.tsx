import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createTrip, recommend } from "../api/trips";
import AppShell from "../components/AppShell";
import { useAuth } from "../hooks/useAuth";
import { coercePreferences } from "../preferences";
import type { Recommendation } from "../types";

function inputDate(daysAhead: number): string {
    const date = new Date();
    date.setDate(date.getDate() + daysAhead);
    return date.toISOString().slice(0, 10);
}

function formatMoney(total: number, currency: string): string {
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: currency || "CHF",
        maximumFractionDigits: 0,
    }).format(total);
}

export default function PlanPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const [form, setForm] = useState({
        destination: "",
        start_date: inputDate(14),
        end_date: inputDate(18),
        travelers: 1,
        notes: "",
    });
    const [results, setResults] = useState<Recommendation[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingTitle, setSavingTitle] = useState<string | null>(null);
    const [error, setError] = useState("");
    const preferences = coercePreferences(user?.preferences);

    useEffect(() => {
        const nextDestination = searchParams.get("destination") || "";
        setForm((current) =>
            current.destination === nextDestination
                ? current
                : { ...current, destination: nextDestination },
        );
    }, [searchParams]);

    const set = (field: string, value: unknown) =>
        setForm((current) => ({ ...current, [field]: value }));

    const handleSubmit = async (event: React.FormEvent) => {
        event.preventDefault();
        setError("");
        setLoading(true);
        try {
            const recs = await recommend({
                destination: form.destination || undefined,
                start_date: form.start_date,
                end_date: form.end_date,
                travelers: form.travelers,
                notes: form.notes,
            });
            setResults(recs);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to get recommendations");
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (rec: Recommendation) => {
        setSavingTitle(rec.title);
        try {
            const trip = await createTrip({
                title: rec.title,
                destination: rec.destination,
                description: rec.description,
                itinerary: rec.itinerary as unknown as Record<string, unknown>,
            });
            navigate(`/trips/${trip.id}`);
        } finally {
            setSavingTitle(null);
        }
    };

    return (
        <AppShell
            title="Plan"
            description="Build a trip brief, compare tailored itineraries, and save the option worth turning into your next trip."
            actions={
                <Link
                    to="/profile"
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                    Open profile
                </Link>
            }
        >
            <section className="mb-6 rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <p className="text-sm font-medium text-slate-500">Step 1: Use your profile</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                            Your current travel settings
                        </h2>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-slate-600">
                            {preferences.budget_tier} budget
                        </span>
                        <span className="rounded-full bg-stone-100 px-4 py-2 text-sm text-slate-600">
                            {preferences.pace} pace
                        </span>
                        {preferences.travel_styles.map((style) => (
                            <span key={style} className="rounded-full bg-rose-100 px-4 py-2 text-sm text-rose-900">
                                {style}
                            </span>
                        ))}
                    </div>
                </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
                <form onSubmit={handleSubmit} className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-6 shadow-sm sm:p-8">
                    <div className="mb-8">
                        <p className="text-sm font-medium text-rose-600">Step 2: Build the brief</p>
                        <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                            Build the first draft
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-slate-500">
                            Leave the destination blank if you want the backend to surprise you with the best match.
                        </p>
                    </div>

                    <div className="space-y-5">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">
                                Destination
                            </label>
                            <input
                                type="text"
                                placeholder="Leave blank for a surprise Swiss destination"
                                value={form.destination}
                                onChange={(event) => set("destination", event.target.value)}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                            />
                        </div>

                        <div className="grid gap-5 sm:grid-cols-2">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">Start date</label>
                                <input
                                    type="date"
                                    required
                                    value={form.start_date}
                                    onChange={(event) => set("start_date", event.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                                />
                            </div>
                            <div>
                                <label className="mb-2 block text-sm font-medium text-slate-700">End date</label>
                                <input
                                    type="date"
                                    required
                                    value={form.end_date}
                                    onChange={(event) => set("end_date", event.target.value)}
                                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">Travelers</label>
                            <input
                                type="number"
                                min={1}
                                value={form.travelers}
                                onChange={(event) => set("travelers", Number(event.target.value))}
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-slate-700">Trip notes</label>
                            <textarea
                                placeholder="Anniversary weekend, scenic rail journey, minimal museum stops..."
                                value={form.notes}
                                onChange={(event) => set("notes", event.target.value)}
                                rows={4}
                                className="w-full rounded-[1.75rem] border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                            />
                        </div>
                    </div>

                    {error && (
                        <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </p>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="mt-8 w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {loading ? "Finding itineraries..." : "Generate recommendations"}
                    </button>
                </form>

                <section className="space-y-5">
                    <div className="rounded-[2rem] border border-slate-200/80 bg-white/90 p-5 shadow-sm">
                        <p className="text-sm font-medium text-slate-500">Step 3: Compare results</p>
                        <p className="mt-2 text-sm leading-6 text-slate-500">
                            Generated itineraries appear here. Save the option that best fits your dates, budget, and pace.
                        </p>
                    </div>

                    {!loading && results.length === 0 && (
                        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/65 p-10 text-center shadow-sm">
                            <p className="text-sm font-semibold tracking-[0.22em] text-slate-500 uppercase">
                                Ready when you are
                            </p>
                            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
                                Your recommendations will appear here.
                            </h2>
                            <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-slate-500">
                                We will turn your preferences, dates, and trip brief into a polished first itinerary you can save in one click.
                            </p>
                        </div>
                    )}

                    {results.map((rec) => {
                        const firstDay = rec.itinerary.days[0];

                        return (
                            <article
                                key={`${rec.title}-${rec.destination}`}
                                className="rounded-[2rem] border border-slate-200/80 bg-white/92 p-6 shadow-sm sm:p-7"
                            >
                                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className="text-sm font-medium text-slate-500">{rec.destination}</p>
                                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                                            {rec.title}
                                        </h2>
                                    </div>
                                    <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800">
                                        {Math.round(rec.match_score * 100)}% match
                                    </span>
                                </div>

                                <p className="mt-4 text-sm leading-6 text-slate-600">{rec.description}</p>

                                <div className="mt-5 flex flex-wrap gap-2">
                                    {rec.highlights.map((highlight) => (
                                        <span
                                            key={highlight}
                                            className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-900"
                                        >
                                            {highlight}
                                        </span>
                                    ))}
                                </div>

                                <div className="mt-6 grid gap-4 rounded-[1.75rem] bg-stone-50 p-5 md:grid-cols-[0.9fr_1.1fr]">
                                    <div>
                                        <p className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
                                            Estimate
                                        </p>
                                        <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                                            {formatMoney(rec.itinerary.estimated_total, rec.itinerary.currency)}
                                        </p>
                                        <p className="mt-2 text-sm text-slate-500">
                                            {rec.itinerary.days.length} days planned for {form.travelers} traveler{form.travelers > 1 ? "s" : ""}.
                                        </p>
                                    </div>

                                    <div>
                                        <p className="text-xs font-semibold tracking-[0.2em] text-slate-400 uppercase">
                                            First day preview
                                        </p>
                                        {firstDay ? (
                                            <div className="mt-3 space-y-2">
                                                {firstDay.activities.slice(0, 3).map((activity) => (
                                                    <div
                                                        key={`${firstDay.day}-${activity.time}-${activity.title}`}
                                                        className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 text-sm text-slate-600"
                                                    >
                                                        <div>
                                                            <p className="font-medium text-slate-900">{activity.title}</p>
                                                            <p className="text-xs text-slate-400">
                                                                {activity.time} · {activity.category}
                                                            </p>
                                                        </div>
                                                        <span className="text-sm font-medium text-slate-500">
                                                            {formatMoney(activity.cost, rec.itinerary.currency)}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="mt-3 text-sm text-slate-500">Detailed day plan unavailable.</p>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => handleSave(rec)}
                                    disabled={savingTitle === rec.title}
                                    className="mt-6 w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {savingTitle === rec.title ? "Saving trip..." : "Save this trip"}
                                </button>
                            </article>
                        );
                    })}
                </section>
            </div>
        </AppShell>
    );
}
