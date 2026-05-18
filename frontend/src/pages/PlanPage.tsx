import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { createTrip, recommend, refreshRecommendationItem } from "../api/trips";
import AppShell from "../components/AppShell";
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
    {
        key: "budget_tier",
        eyebrow: "Question 5",
        title: "What budget feels right?",
        description: "This shapes the estimate for activities, meals, stays, and transport.",
        options: [
            { value: "budget", label: "Low", hint: "Value-led picks and simple stops", visual: "$" },
            { value: "mid", label: "Medium", hint: "Balanced comfort and standout moments", visual: "$$" },
            { value: "luxury", label: "High", hint: "Premium experiences and extra ease", visual: "$$$" },
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
    budget_tier: "budget" | "mid" | "luxury";
};

function initialPlannerForm(destination = ""): PlannerForm {
    return {
        destination,
        start_date: inputDate(14),
        end_date: inputDate(14),
        travelers: 1,
        notes: "",
        mood: "culture_history",
        transport_mode: "public_transport",
        trip_length: "half_day",
        group_type: "solo",
        budget_tier: "mid",
    };
}

function formatTransportTime(value?: string | null): string | null {
    if (!value) return null;

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

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
    const [form, setForm] = useState<PlannerForm>(() => initialPlannerForm());
    const [stepIndex, setStepIndex] = useState(0);
    const [result, setResult] = useState<Recommendation | null>(null);
    const [loading, setLoading] = useState(false);
    const [refreshingItemId, setRefreshingItemId] = useState<string | null>(null);
    const [savingTitle, setSavingTitle] = useState<string | null>(null);
    const [expandedTransportIds, setExpandedTransportIds] = useState<Set<string>>(() => new Set());
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
    const canGenerate = stepIndex === quizSteps.length - 1;

    const set = <K extends keyof PlannerForm>(field: K, value: PlannerForm[K]) => {
        setForm((current) => ({ ...current, [field]: value }));
    };

    const selectOption = (value: string) => {
        if (currentStep.key === "group_type") {
            setForm((current) => ({
                ...current,
                group_type: value as PlannerForm["group_type"],
                travelers: defaultTravelers(value),
            }));
        } else {
            set(currentStep.key, value as never);
        }
    };

    const handleNext = () => {
        if (stepIndex < quizSteps.length - 1) {
            setStepIndex((index) => index + 1);
        }
    };

    const toggleTransportDetails = (itemId: string) => {
        setExpandedTransportIds((current) => {
            const next = new Set(current);
            if (next.has(itemId)) {
                next.delete(itemId);
            } else {
                next.add(itemId);
            }
            return next;
        });
    };

    const handleRestartQuiz = () => {
        setForm(initialPlannerForm(searchParams.get("destination") || ""));
        setStepIndex(0);
        setResult(null);
        setExpandedTransportIds(new Set());
        setError("");
    };

    const handleSubmit = async () => {
        setError("");
        setLoading(true);
        try {
            const recs = await recommend(form);
            setResult(recs[0] ?? null);
            setExpandedTransportIds(new Set());
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
        >
            <div className="mx-auto max-w-5xl space-y-6">
                <section className="rounded-[2.5rem] border border-white/70 bg-[linear-gradient(180deg,rgba(15,23,42,0.97),rgba(30,41,59,0.95))] p-6 text-white shadow-2xl shadow-slate-900/10 sm:p-8 lg:p-10">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold tracking-[0.2em] text-white/55 uppercase">Planner</p>
                            <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                                Build the day one answer at a time.
                            </h2>
                        </div>
                        <div className="w-fit rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white/75">
                            {stepIndex + 1} / {quizSteps.length}
                        </div>
                    </div>

                    <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-rose-300 transition-all" style={{ width: `${progressValue}%` }} />
                    </div>

                    <div className="mt-8 rounded-[2rem] border border-white/10 bg-white/6 p-5 sm:p-7">
                        <p className="text-sm font-medium text-white/60">{currentStep.eyebrow}</p>
                        <h3 className="mt-3 text-3xl font-semibold tracking-tight">{currentStep.title}</h3>
                        <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">{currentStep.description}</p>

                        <div className="mt-6 grid gap-3 sm:grid-cols-2">
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
                                        <div className="flex items-center justify-between gap-4">
                                            <p className="text-base font-semibold">{option.label}</p>
                                            {"visual" in option && option.visual && (
                                                <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-rose-100">
                                                    {option.visual}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-sm text-white/60">{option.hint}</p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex gap-3">
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
                                onClick={handleNext}
                                disabled={stepIndex === quizSteps.length - 1}
                                className="rounded-full border border-white/12 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/8 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                Next
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading || !canGenerate}
                            className="rounded-full bg-rose-300 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-rose-200 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading
                                ? "Generating itinerary..."
                                : canGenerate
                                  ? "Generate proposed itinerary"
                                  : "Answer all questions to generate"}
                        </button>
                    </div>

                    {!result && error && (
                        <p className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {error}
                        </p>
                    )}
                </section>

                {result && (
                    <section className="rounded-[2.5rem] border border-slate-200/80 bg-white/92 p-6 shadow-xl shadow-stone-200/40 sm:p-8">
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
                                            {timelineItems(day).map((item) => {
                                                const transportLegs = item.transport_legs ?? [];
                                                const canExpandTransport = item.kind === "transport" && transportLegs.length > 0;
                                                const isTransportExpanded = expandedTransportIds.has(item.id);

                                                return (
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

                                                            {canExpandTransport && (
                                                                <div className="mt-4 border-t border-slate-100 pt-4">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleTransportDetails(item.id)}
                                                                        className="text-sm font-semibold text-slate-700 transition hover:text-slate-950"
                                                                    >
                                                                        {isTransportExpanded ? "Hide connections" : "Show connections"}
                                                                    </button>

                                                                    {isTransportExpanded && (
                                                                        <div className="mt-4 space-y-3">
                                                                            {transportLegs.map((leg, legIndex) => {
                                                                                const departureTime = formatTransportTime(leg.departure_time);
                                                                                const arrivalTime = formatTransportTime(leg.arrival_time);
                                                                                return (
                                                                                    <div key={`${item.id}-${legIndex}`} className="rounded-2xl bg-stone-50 px-4 py-3 ring-1 ring-slate-200/70">
                                                                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                                                            <div>
                                                                                                <p className="text-sm font-semibold capitalize text-slate-900">
                                                                                                    {leg.mode}{leg.line ? ` ${leg.line}` : ""}
                                                                                                </p>
                                                                                                <p className="mt-1 text-sm text-slate-500">
                                                                                                    {leg.origin} to {leg.destination}
                                                                                                </p>
                                                                                                {leg.direction && (
                                                                                                    <p className="mt-1 text-xs text-slate-400">Direction: {leg.direction}</p>
                                                                                                )}
                                                                                                {leg.notes && <p className="mt-1 text-xs text-slate-400">{leg.notes}</p>}
                                                                                            </div>
                                                                                            <div className="text-sm font-medium text-slate-600">
                                                                                                {[departureTime, arrivalTime].filter(Boolean).join(" - ")}
                                                                                                {leg.duration_minutes ? ` · ${leg.duration_minutes} min` : ""}
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                );
                                                                            })}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )}
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
                                                );
                                            })}
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
                                    onClick={handleRestartQuiz}
                                    className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    Restart quiz
                                </button>
                            </div>
                    </section>
                )}
            </div>
        </AppShell>
    );
}
