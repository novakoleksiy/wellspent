import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { createTrip, recommend, refreshRecommendationItem } from "../api/trips";
import AppShell from "../components/AppShell";
import { useAuth } from "../hooks/useAuth";
import { coercePreferences } from "../preferences";
import type { Recommendation, TimelineItem } from "../types";

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

function defaultTravelers(groupType: string): number {
    if (groupType === "couple") return 2;
    if (groupType === "family" || groupType === "friends") return 4;
    return 1;
}

const quizSteps = [
    {
        key: "mood",
        eyebrow: "Question 1",
        title: "Pick your mood",
        description: "Start with the kind of day you want this trip to feel like.",
        options: [
            { value: "culture_history", label: "Culture and History", hint: "Museums, old towns, castles" },
            { value: "nature_outdoors", label: "Nature and Outdoors", hint: "Views, trails, lakes, mountain air" },
            { value: "food_markets", label: "Food and Markets", hint: "Cafes, tastings, local markets" },
            { value: "slow_relaxing", label: "Slow and Relaxing", hint: "Scenic, calm, low-friction" },
        ],
    },
    {
        key: "transport_mode",
        eyebrow: "Question 2",
        title: "How do you want to move around?",
        description: "We will tailor the day flow and transport placeholders around this choice.",
        options: [
            { value: "car", label: "Car", hint: "More flexibility between stops" },
            { value: "public_transport", label: "Public transport", hint: "Train, bus, and regional links" },
        ],
    },
    {
        key: "trip_length",
        eyebrow: "Question 3",
        title: "How much time do you have?",
        description: "This controls how dense each day feels.",
        options: [
            { value: "2_3_hours", label: "2-3 hours", hint: "A compact outing" },
            { value: "half_day", label: "Half day", hint: "A balanced short plan" },
            { value: "full_day", label: "Full day", hint: "A fuller itinerary" },
        ],
    },
    {
        key: "group_type",
        eyebrow: "Question 4",
        title: "Who is joining?",
        description: "Family plans stay gentler. Friend plans skew more active.",
        options: [
            { value: "solo", label: "Solo", hint: "Independent and flexible" },
            { value: "couple", label: "Couple", hint: "Balanced and easygoing" },
            { value: "family", label: "Family", hint: "Gentler pacing and simpler flow" },
            { value: "friends", label: "Friends", hint: "More active, social energy" },
        ],
    },
] as const;

type PlannerForm = {
    destination: string;
    start_date: string;
    end_date: string;
    travelers: number;
    notes: string;
    mood: "culture_history" | "nature_outdoors" | "food_markets" | "slow_relaxing";
    transport_mode: "car" | "public_transport";
    trip_length: "2_3_hours" | "half_day" | "full_day";
    group_type: "solo" | "couple" | "family" | "friends";
};

function timelineItems(day: Recommendation["itinerary"]["days"][number]): TimelineItem[] {
    return day.timeline_items?.length
        ? day.timeline_items
        : day.activities.map((activity, index) => ({
              id: activity.id || `activity-${day.day}-${index}`,
              kind: "activity" as const,
              time: activity.time,
              title: activity.title,
              category: activity.category,
              cost: activity.cost,
              url: activity.url,
              refreshable: true,
          }));
}

export default function PlanPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const preferences = coercePreferences(user?.preferences);
    const [form, setForm] = useState<PlannerForm>({
        destination: "",
        start_date: inputDate(14),
        end_date: inputDate(14),
        travelers: 1,
        notes: "",
        mood: "culture_history",
        transport_mode: "public_transport",
        trip_length: "half_day",
        group_type: "solo",
    });
    const [stepIndex, setStepIndex] = useState(0);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [travelersTouched, setTravelersTouched] = useState(false);
    const [result, setResult] = useState<Recommendation | null>(null);
    const [loading, setLoading] = useState(false);
    const [refreshingItemId, setRefreshingItemId] = useState<string | null>(null);
    const [savingTitle, setSavingTitle] = useState<string | null>(null);
    const [error, setError] = useState("");

    useEffect(() => {
        const nextDestination = searchParams.get("destination") || "";
        setForm((current) =>
            current.destination === nextDestination
                ? current
                : { ...current, destination: nextDestination },
        );
    }, [searchParams]);

    const currentStep = quizSteps[stepIndex];
    const progressValue = ((stepIndex + 1) / quizSteps.length) * 100;

    const set = <K extends keyof PlannerForm>(field: K, value: PlannerForm[K]) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const selectOption = (value: string) => {
        if (currentStep.key === "group_type") {
            setForm((current) => ({
                ...current,
                group_type: value as PlannerForm["group_type"],
                travelers: travelersTouched ? current.travelers : defaultTravelers(value),
            }));
        } else {
            set(currentStep.key, value as never);
        }

        if (stepIndex < quizSteps.length - 1) {
            setStepIndex((index) => index + 1);
        } else {
            setShowAdvanced(true);
        }
    };

    const handleSubmit = async () => {
        setError("");
        setLoading(true);
        try {
            const recs = await recommend(form);
            setResult(recs[0] ?? null);
            if (recs.length === 0) {
                setError("No itinerary matched that combination. Try another mood or destination.");
            }
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to get recommendations");
        } finally {
            setLoading(false);
        }
    };

    const handleRefreshItem = async (itemId: string) => {
        if (!result) return;
        setRefreshingItemId(itemId);
        setError("");
        try {
            const next = await refreshRecommendationItem({
                ...form,
                destination: result.destination,
                itinerary: result.itinerary,
                item_id: itemId,
            });
            setResult(next);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Failed to refresh itinerary item");
        } finally {
            setRefreshingItemId(null);
        }
    };

    const handleSave = async () => {
        if (!result) return;
        setSavingTitle(result.title);
        try {
            const trip = await createTrip({
                title: result.title,
                destination: result.destination,
                description: result.description,
                itinerary: result.itinerary as unknown as Record<string, unknown>,
            });
            navigate(`/trips/${trip.id}`);
        } finally {
            setSavingTitle(null);
        }
    };

    return (
        <AppShell
            title="Plan a trip"
            description="Answer a few quick questions, then shape a day-style itinerary without leaving the planner."
            actions={
                <Link
                    to="/profile"
                    className="rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                >
                    Open profile
                </Link>
            }
        >
            <div className="mx-auto grid max-w-5xl gap-6 xl:grid-cols-[0.82fr_1.18fr]">
                <section className="rounded-[2.5rem] border border-white/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.97),rgba(30,41,59,0.95))] p-6 text-white shadow-2xl shadow-slate-900/10 sm:p-8">
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <p className="text-sm font-semibold tracking-[0.2em] text-white/55 uppercase">Planner</p>
                            <h2 className="mt-3 text-3xl font-semibold tracking-tight">Build the day one answer at a time.</h2>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white/75">
                            {stepIndex + 1} / {quizSteps.length}
                        </div>
                    </div>

                    <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-rose-300 transition-all" style={{ width: `${progressValue}%` }} />
                    </div>

                    <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/6 p-6">
                        <p className="text-sm font-medium text-white/60">{currentStep.eyebrow}</p>
                        <h3 className="mt-3 text-2xl font-semibold tracking-tight">{currentStep.title}</h3>
                        <p className="mt-3 text-sm leading-6 text-white/70">{currentStep.description}</p>

                        <div className="mt-6 grid gap-3">
                            {currentStep.options.map((option) => {
                                const selected = form[currentStep.key] === option.value;
                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => selectOption(option.value)}
                                        className={`rounded-[1.75rem] border px-5 py-4 text-left transition ${
                                            selected
                                                ? "border-rose-300 bg-rose-300/16 text-white"
                                                : "border-white/10 bg-white/5 text-white/88 hover:border-white/25 hover:bg-white/10"
                                        }`}
                                    >
                                        <p className="text-base font-semibold">{option.label}</p>
                                        <p className="mt-1 text-sm text-white/60">{option.hint}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-6 flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => setStepIndex((index) => Math.max(index - 1, 0))}
                            disabled={stepIndex === 0}
                            className="rounded-full border border-white/12 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                            Back
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowAdvanced((open) => !open)}
                            className="rounded-full border border-white/12 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/8"
                        >
                            {showAdvanced ? "Hide advanced" : "Advanced trip details"}
                        </button>
                    </div>

                    <div className="mt-8 flex flex-wrap gap-2">
                        <span className="rounded-full bg-white/8 px-4 py-2 text-sm text-white/70">
                            {preferences.budget_tier} budget
                        </span>
                        <span className="rounded-full bg-white/8 px-4 py-2 text-sm text-white/70">
                            {preferences.pace} pace
                        </span>
                        {preferences.travel_styles.slice(0, 3).map((style) => (
                            <span key={style} className="rounded-full bg-rose-300/18 px-4 py-2 text-sm text-rose-100">
                                {style}
                            </span>
                        ))}
                    </div>
                </section>

                <section className="rounded-[2.5rem] border border-slate-200/80 bg-white/92 p-6 shadow-xl shadow-stone-200/40 sm:p-8 xl:min-h-[75vh]">
                    {!result ? (
                        <>
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Trip builder</p>
                                    <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                                        Your answers become one proposed itinerary.
                                    </h2>
                                </div>
                                <span className="rounded-full bg-stone-100 px-4 py-2 text-sm font-medium text-slate-600">
                                    Quiz mode
                                </span>
                            </div>

                            <div className="mt-6 grid gap-3 sm:grid-cols-2">
                                {quizSteps.map((step) => {
                                    const option = step.options.find((item) => item.value === form[step.key]);
                                    return (
                                        <div key={step.key} className="rounded-[1.5rem] bg-stone-50 px-4 py-4">
                                            <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">{step.title}</p>
                                            <p className="mt-2 text-base font-semibold text-slate-900">{option?.label}</p>
                                        </div>
                                    );
                                })}
                            </div>

                            {showAdvanced && (
                                <div className="mt-6 rounded-[2rem] border border-slate-200 bg-stone-50/80 p-5">
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="text-sm font-medium text-slate-500">Advanced step</p>
                                            <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">
                                                Optional trip details
                                            </h3>
                                        </div>
                                        <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
                                            Dates kept here
                                        </span>
                                    </div>

                                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                        <label className="text-sm font-medium text-slate-700">
                                            Destination idea
                                            <input
                                                type="text"
                                                value={form.destination}
                                                onChange={(event) => set("destination", event.target.value)}
                                                placeholder="Leave blank for a surprise"
                                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                                            />
                                        </label>
                                        <label className="text-sm font-medium text-slate-700">
                                            Travelers
                                            <input
                                                type="number"
                                                min={1}
                                                value={form.travelers}
                                                onChange={(event) => {
                                                    setTravelersTouched(true);
                                                    set("travelers", Number(event.target.value));
                                                }}
                                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                                            />
                                        </label>
                                        <label className="text-sm font-medium text-slate-700">
                                            Start date
                                            <input
                                                type="date"
                                                value={form.start_date}
                                                onChange={(event) => set("start_date", event.target.value)}
                                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                                            />
                                        </label>
                                        <label className="text-sm font-medium text-slate-700">
                                            End date
                                            <input
                                                type="date"
                                                value={form.end_date}
                                                onChange={(event) => set("end_date", event.target.value)}
                                                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-slate-400"
                                            />
                                        </label>
                                    </div>

                                    <label className="mt-4 block text-sm font-medium text-slate-700">
                                        Notes
                                        <textarea
                                            value={form.notes}
                                            onChange={(event) => set("notes", event.target.value)}
                                            rows={3}
                                            placeholder="Scenic rail route, fewer museums, kid-friendly lunch stop..."
                                            className="mt-2 w-full rounded-[1.5rem] border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                                        />
                                    </label>
                                </div>
                            )}

                            {error && (
                                <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                    {error}
                                </p>
                            )}

                            <div className="mt-8 rounded-[2rem] bg-slate-900 px-5 py-5 text-white">
                                <p className="text-sm text-white/65">When you generate</p>
                                <p className="mt-2 max-w-xl text-sm leading-6 text-white/78">
                                    You will get a day-style timeline with suggested stops, placeholder transport legs, and the option to refresh just one stop if it does not fit.
                                </p>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="mt-5 rounded-full bg-rose-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {loading ? "Generating itinerary..." : "Generate proposed itinerary"}
                                </button>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="text-sm font-medium text-slate-500">Proposed itinerary</p>
                                    <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                                        {result.destination}
                                    </h2>
                                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500">{result.description}</p>
                                </div>
                                <div className="flex flex-col items-start gap-2 sm:items-end">
                                    <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-medium text-emerald-800">
                                        {Math.round(result.match_score * 100)}% match
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setResult(null)}
                                        className="text-sm font-medium text-slate-500 transition hover:text-slate-900"
                                    >
                                        Change answers
                                    </button>
                                </div>
                            </div>

                            <div className="mt-5 flex flex-wrap gap-2">
                                {result.highlights.map((highlight) => (
                                    <span
                                        key={highlight}
                                        className="rounded-full bg-rose-100 px-3 py-1.5 text-xs font-medium text-rose-900"
                                    >
                                        {highlight}
                                    </span>
                                ))}
                            </div>

                            {error && (
                                <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                                    {error}
                                </p>
                            )}

                            <div className="mt-6 grid gap-4 md:grid-cols-3">
                                <div className="rounded-[1.5rem] bg-stone-50 px-4 py-4">
                                    <p className="text-sm text-slate-500">Estimated total</p>
                                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                                        {formatMoney(result.itinerary.estimated_total, result.itinerary.currency)}
                                    </p>
                                </div>
                                <div className="rounded-[1.5rem] bg-stone-50 px-4 py-4">
                                    <p className="text-sm text-slate-500">Days planned</p>
                                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                                        {result.itinerary.days.length}
                                    </p>
                                </div>
                                <div className="rounded-[1.5rem] bg-stone-50 px-4 py-4">
                                    <p className="text-sm text-slate-500">Group size</p>
                                    <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                                        {form.travelers}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-8 space-y-8">
                                {result.itinerary.days.map((day) => (
                                    <article key={day.day} className="rounded-[2rem] border border-slate-200 bg-stone-50/75 p-5">
                                        <div className="flex items-end justify-between gap-4">
                                            <div>
                                                <p className="text-sm font-medium text-slate-500">Day {day.day}</p>
                                                <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">
                                                    {new Date(day.date).toLocaleDateString(undefined, {
                                                        weekday: "long",
                                                        month: "long",
                                                        day: "numeric",
                                                    })}
                                                </h3>
                                            </div>
                                            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm">
                                                Timeline view
                                            </span>
                                        </div>

                                        <div className="mt-6 space-y-4">
                                            {timelineItems(day).map((item) => (
                                                <div key={item.id} className="grid gap-4 sm:grid-cols-[82px_18px_1fr_auto] sm:items-start">
                                                    <div className="pt-1 text-sm font-medium text-slate-500">{item.time}</div>
                                                    <div className="relative flex h-full justify-center">
                                                        <span className={`mt-1 h-4 w-4 rounded-full ${item.kind === "transport" ? "bg-amber-300" : "bg-rose-400"}`} />
                                                        <span className="absolute top-5 bottom-0 w-px bg-slate-200" />
                                                    </div>
                                                    <div className="rounded-[1.5rem] bg-white px-4 py-4 shadow-sm ring-1 ring-slate-200/70">
                                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                            <div>
                                                                <p className="text-base font-semibold text-slate-900">{item.title}</p>
                                                                <p className="mt-1 text-sm capitalize text-slate-500">{item.category}</p>
                                                                {item.duration_text && (
                                                                    <p className="mt-2 text-sm text-slate-500">{item.duration_text}</p>
                                                                )}
                                                                {item.notes && (
                                                                    <p className="mt-2 text-sm text-slate-500">{item.notes}</p>
                                                                )}
                                                            </div>
                                                            <div className="text-sm font-medium text-slate-600">
                                                                {formatMoney(item.cost, result.itinerary.currency)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    {item.refreshable ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRefreshItem(item.id)}
                                                            disabled={refreshingItemId === item.id}
                                                            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                                                        >
                                                            {refreshingItemId === item.id ? "Refreshing..." : "Refresh stop"}
                                                        </button>
                                                    ) : (
                                                        <div />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </article>
                                ))}
                            </div>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                                <button
                                    type="button"
                                    onClick={handleSave}
                                    disabled={savingTitle === result.title}
                                    className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {savingTitle === result.title ? "Saving trip..." : "Save this itinerary"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSubmit}
                                    disabled={loading}
                                    className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {loading ? "Refreshing plan..." : "Generate another version"}
                                </button>
                            </div>
                        </>
                    )}
                </section>
            </div>
        </AppShell>
    );
}
