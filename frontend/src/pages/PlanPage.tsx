import { useEffect, useRef, useState } from "react";
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
              description: activity.description,
              refreshable: true,
          }));
}

function TrainLoadingPopup() {
    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(20,19,15,0.38)] px-4 backdrop-blur-sm"
            role="status"
            aria-live="polite"
            aria-label="Generating proposed itinerary"
        >
            <div className="w-full max-w-sm overflow-hidden rounded-[2rem] border border-[var(--ws-line)] bg-[#fffdf8] p-6 text-center shadow-2xl shadow-stone-950/25">
                <div className="relative mx-auto mb-5 h-28 overflow-hidden rounded-[1.5rem] bg-[linear-gradient(180deg,#e7ecff_0%,#fffdf8_58%,#e9dfcf_58%,#e9dfcf_100%)]">
                    <div className="plan-loader-cloud top-5 left-6 w-12" />
                    <div className="plan-loader-cloud top-8 right-8 w-16" />
                    <div className="absolute right-5 bottom-10 left-5 h-1 rounded-full bg-[var(--ws-muted)]" />
                    <div className="plan-loader-sleepers absolute right-4 bottom-7 left-4 h-3" />
                    <div className="plan-loader-train absolute bottom-10 left-0 flex items-end gap-1">
                        <div className="relative h-10 w-16 rounded-t-xl rounded-br-md rounded-bl-lg bg-[var(--ws-ink)] shadow-lg">
                            <div className="absolute top-2 left-3 h-3 w-7 rounded-md bg-[var(--ws-navy-tint)]" />
                            <div className="absolute -right-1 bottom-0 h-6 w-4 rounded-t-md bg-[var(--ws-orange)]" />
                            <div className="absolute bottom-[-7px] left-3 h-3 w-3 rounded-full border-2 border-white bg-[var(--ws-muted)]" />
                            <div className="absolute right-3 bottom-[-7px] h-3 w-3 rounded-full border-2 border-white bg-[var(--ws-muted)]" />
                        </div>
                        <div className="relative h-8 w-12 rounded-lg bg-[var(--ws-yellow)] shadow-lg">
                            <div className="absolute top-2 left-2 h-2 w-8 rounded-full bg-white/60" />
                            <div className="absolute bottom-[-7px] left-2 h-3 w-3 rounded-full border-2 border-white bg-[var(--ws-muted)]" />
                            <div className="absolute right-2 bottom-[-7px] h-3 w-3 rounded-full border-2 border-white bg-[var(--ws-muted)]" />
                        </div>
                    </div>
                </div>
                <p className="ws-mono text-[var(--ws-orange)]">All aboard</p>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">Building your Swiss route</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--ws-muted)]">
                    Querying the travel APIs and stitching together your proposed itinerary.
                </p>
            </div>
            <style>{`
                .plan-loader-cloud {
                    position: absolute;
                    height: 10px;
                    border-radius: 9999px;
                    background: rgba(255, 255, 255, 0.92);
                    box-shadow: 14px -5px 0 2px rgba(255, 255, 255, 0.78), 28px 0 0 rgba(255, 255, 255, 0.74);
                    animation: plan-cloud-drift 5s linear infinite;
                }

                .plan-loader-sleepers {
                    background-image: repeating-linear-gradient(90deg, rgba(71, 85, 105, 0.32) 0 8px, transparent 8px 18px);
                    animation: plan-track-roll 0.7s linear infinite;
                }

                .plan-loader-train {
                    animation: plan-train-ride 2.8s cubic-bezier(0.45, 0, 0.55, 1) infinite;
                }

                @keyframes plan-train-ride {
                    0% { transform: translateX(-120px); }
                    45% { transform: translateX(110px); }
                    55% { transform: translateX(120px); }
                    100% { transform: translateX(360px); }
                }

                @keyframes plan-track-roll {
                    from { background-position-x: 0; }
                    to { background-position-x: 18px; }
                }

                @keyframes plan-cloud-drift {
                    from { transform: translateX(30px); }
                    to { transform: translateX(-60px); }
                }
            `}</style>
        </div>
    );
}

export default function PlanPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [form, setForm] = useState<PlannerForm>(() => initialPlannerForm());
    const [stepIndex, setStepIndex] = useState(0);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [travelersTouched, setTravelersTouched] = useState(false);
    const [result, setResult] = useState<Recommendation | null>(null);
    const [loading, setLoading] = useState(false);
    const [refreshingItemId, setRefreshingItemId] = useState<string | null>(null);
    const [savingTitle, setSavingTitle] = useState<string | null>(null);
    const [expandedTransportIds, setExpandedTransportIds] = useState<Set<string>>(() => new Set());
    const [error, setError] = useState("");
    const resultSectionRef = useRef<HTMLElement | null>(null);
    const shouldScrollToResultRef = useRef(false);

    useEffect(() => {
        const nextDestination = searchParams.get("destination") || "";
        setForm((current) =>
            current.destination === nextDestination
                ? current
                : { ...current, destination: nextDestination },
        );
    }, [searchParams]);

    useEffect(() => {
        if (!result || loading || !shouldScrollToResultRef.current) return;

        resultSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        shouldScrollToResultRef.current = false;
    }, [result, loading]);

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
                travelers: travelersTouched ? current.travelers : defaultTravelers(value),
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
        setShowAdvanced(false);
        setTravelersTouched(false);
        setResult(null);
        setExpandedTransportIds(new Set());
        shouldScrollToResultRef.current = false;
        setError("");
    };

    const updateTravelers = (value: number) => {
        setTravelersTouched(true);
        set("travelers", Number.isFinite(value) ? Math.max(1, value) : 1);
    };

    const handleSubmit = async () => {
        setError("");
        setLoading(true);
        shouldScrollToResultRef.current = true;
        try {
            const recs = await recommend(form);
            setResult(recs[0] ?? null);
            setExpandedTransportIds(new Set());
            if (recs.length === 0) {
                shouldScrollToResultRef.current = false;
                setError("No itinerary matched that combination. Try another mood or destination.");
            }
        } catch (err: unknown) {
            shouldScrollToResultRef.current = false;
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
            {loading && <TrainLoadingPopup />}
            <div className="mx-auto max-w-5xl space-y-6">
                <section className="ws-surface-dark p-6 shadow-2xl shadow-stone-900/10 sm:p-8 lg:p-10">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                            <p className="ws-mono text-white/55">Planner</p>
                            <h2 className="mt-3 max-w-3xl text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
                                Build the day <span className="ws-serif-italic text-[var(--ws-yellow)]">one answer</span> at a time.
                            </h2>
                        </div>
                        <div className="w-fit rounded-full border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white/75">
                            {stepIndex + 1} / {quizSteps.length}
                        </div>
                    </div>

                    <div className="mt-8 h-2 overflow-hidden rounded-full bg-white/10">
                        <div className="h-full rounded-full bg-[var(--ws-yellow)] transition-all" style={{ width: `${progressValue}%` }} />
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
                                                ? "border-[var(--ws-yellow)] bg-[rgba(255,235,105,0.14)] text-white"
                                                : "border-white/10 bg-white/5 text-white/88 hover:border-white/25 hover:bg-white/10"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <p className="text-base font-semibold">{option.label}</p>
                                            {"visual" in option && option.visual && (
                                                    <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-[var(--ws-yellow)]">
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
                            <button
                                type="button"
                                onClick={() => setShowAdvanced((open) => !open)}
                                className="rounded-full border border-white/12 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/8"
                            >
                                {showAdvanced ? "Hide advanced" : "Advanced trip details"}
                            </button>
                        </div>
                        <button
                            type="button"
                            onClick={handleSubmit}
                            disabled={loading || !canGenerate}
                            className="ws-btn-accent px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {loading
                                ? "Generating itinerary..."
                                : canGenerate
                                  ? "Generate proposed itinerary"
                                  : "Answer all questions to generate"}
                        </button>
                    </div>

                    {showAdvanced && (
                        <div className="mt-6 rounded-[2rem] border border-white/10 bg-white/6 p-5 sm:p-7">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="text-sm font-medium text-white/60">Advanced trip details</p>
                                    <h3 className="mt-1 text-2xl font-semibold tracking-tight text-white">
                                        Add specifics before generating.
                                    </h3>
                                </div>
                                <span className="w-fit rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/65">
                                    Optional
                                </span>
                            </div>

                            <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                <label className="text-sm font-medium text-white/78">
                                    Destination idea
                                    <input
                                        type="text"
                                        value={form.destination}
                                        onChange={(event) => set("destination", event.target.value)}
                                        placeholder="Leave blank for a surprise"
                                        className="ws-input mt-2 w-full rounded-2xl px-4 py-3 transition"
                                    />
                                </label>
                                <label className="text-sm font-medium text-white/78">
                                    Travelers
                                    <input
                                        type="number"
                                        min={1}
                                        value={form.travelers}
                                        onChange={(event) => updateTravelers(event.currentTarget.valueAsNumber)}
                                        className="ws-input mt-2 w-full rounded-2xl px-4 py-3 transition"
                                    />
                                </label>
                                <label className="text-sm font-medium text-white/78">
                                    Start date
                                    <input
                                        type="date"
                                        value={form.start_date}
                                        onChange={(event) => set("start_date", event.target.value)}
                                        className="ws-input mt-2 w-full rounded-2xl px-4 py-3 transition"
                                    />
                                </label>
                                <label className="text-sm font-medium text-white/78">
                                    End date
                                    <input
                                        type="date"
                                        value={form.end_date}
                                        onChange={(event) => set("end_date", event.target.value)}
                                        className="ws-input mt-2 w-full rounded-2xl px-4 py-3 transition"
                                    />
                                </label>
                            </div>

                            <label className="mt-4 block text-sm font-medium text-white/78">
                                Notes
                                <textarea
                                    value={form.notes}
                                    onChange={(event) => set("notes", event.target.value)}
                                    rows={3}
                                    placeholder="Scenic rail route, fewer museums, kid-friendly lunch stop..."
                                    className="ws-input mt-2 w-full rounded-[1.5rem] px-4 py-3 transition"
                                />
                            </label>
                        </div>
                    )}

                    {!result && error && (
                        <p className="ws-error mt-6 px-4 py-3 text-sm">
                            {error}
                        </p>
                    )}
                </section>

                {result && (
                    <section ref={resultSectionRef} className="ws-surface scroll-mt-6 p-6 sm:p-8">
                            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                                <div>
                                    <p className="ws-mono text-[var(--ws-orange)]">Proposed itinerary</p>
                                    <h2 className="ws-display mt-2 text-3xl">
                                        {result.destination}
                                    </h2>
                                    <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--ws-muted)]">{result.description}</p>
                                </div>
                                <div className="flex flex-col items-start gap-2 sm:items-end">
                                    <span className="rounded-full bg-[var(--ws-green-tint)] px-4 py-2 text-sm font-medium text-[var(--ws-green)]">
                                        {Math.round(result.match_score * 100)}% match
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setResult(null)}
                                        className="text-sm font-medium text-[var(--ws-muted)] transition hover:text-[var(--ws-ink)]"
                                    >
                                        Change answers
                                    </button>
                                </div>
                            </div>

                            <div className="mt-5 flex flex-wrap gap-2">
                                {result.highlights.map((highlight) => (
                                    <span
                                        key={highlight}
                                        className="rounded-full bg-[var(--ws-cream)] px-3 py-1.5 text-xs font-medium text-[var(--ws-orange)]"
                                    >
                                        {highlight}
                                    </span>
                                ))}
                            </div>

                            {error && (
                                <p className="ws-error mt-5 px-4 py-3 text-sm">
                                    {error}
                                </p>
                            )}

                            <div className="mt-6 grid gap-4 md:grid-cols-3">
                                <div className="ws-chip-card px-4 py-4">
                                    <p className="text-sm text-[var(--ws-muted)]">Estimated total</p>
                                    <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                                        {formatMoney(result.itinerary.estimated_total, result.itinerary.currency)}
                                    </p>
                                </div>
                                <div className="ws-chip-card ws-chip-card-yellow px-4 py-4">
                                    <p className="text-sm text-[var(--ws-muted)]">Days planned</p>
                                    <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                                        {result.itinerary.days.length}
                                    </p>
                                </div>
                                <div className="ws-chip-card ws-chip-card-green-soft px-4 py-4">
                                    <p className="text-sm text-[var(--ws-muted)]">Group size</p>
                                    <p className="mt-2 text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                                        {form.travelers}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-8 space-y-8">
                                {result.itinerary.days.map((day) => (
                                    <article key={day.day} className="rounded-[2rem] border border-[var(--ws-line)] bg-[rgba(255,244,239,0.48)] p-5">
                                        <div className="flex items-end justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <p className="text-sm font-medium text-[var(--ws-muted)]">Day {day.day}</p>
                                                    {day.theme && (
                                                        <span className="rounded-full bg-[rgba(232,93,44,0.12)] px-2.5 py-0.5 text-xs font-semibold text-[var(--ws-orange)]">
                                                            {day.theme}
                                                        </span>
                                                    )}
                                                </div>
                                                <h3 className="mt-1 text-2xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">
                                                    {new Date(day.date).toLocaleDateString(undefined, {
                                                        weekday: "long",
                                                        month: "long",
                                                        day: "numeric",
                                                    })}
                                                </h3>
                                            </div>
                                            <span className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-[var(--ws-muted)] shadow-sm">
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
                                                        <div className="pt-1 text-sm font-medium text-[var(--ws-muted)]">{item.time}</div>
                                                        <div className="relative flex h-full justify-center">
                                                            <span className={`mt-1 h-4 w-4 rounded-full ${item.kind === "transport" ? "bg-[var(--ws-yellow)]" : "bg-[var(--ws-orange)]"}`} />
                                                            <span className="absolute top-5 bottom-0 w-px bg-[var(--ws-line)]" />
                                                        </div>
                                                        <div className="rounded-[1.5rem] bg-[#fffdf8] px-4 py-4 shadow-sm ring-1 ring-[var(--ws-line)]">
                                                            {item.kind === "activity" && item.image_url && (
                                                                <img
                                                                    src={item.image_url}
                                                                    alt={item.title}
                                                                    className="mb-4 h-44 w-full rounded-[1.15rem] object-cover"
                                                                    loading="lazy"
                                                                />
                                                            )}
                                                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                                <div>
                                                                    <p className="text-base font-semibold text-[var(--ws-ink)]">{item.title}</p>
                                                                    <p className="mt-1 text-sm capitalize text-[var(--ws-muted)]">{item.category}</p>
                                                                    {item.description && (
                                                                        <p className="mt-2 text-sm text-[rgba(87,84,74,0.85)]">{item.description}</p>
                                                                    )}
                                                                    {item.duration_text && (
                                                                        <p className="mt-2 text-sm text-[var(--ws-muted)]">{item.duration_text}</p>
                                                                    )}
                                                                    {item.notes && (
                                                                        <p className="mt-2 text-sm text-[var(--ws-muted)]">{item.notes}</p>
                                                                    )}
                                                                </div>
                                                                <div className="text-sm font-medium text-[var(--ws-muted)]">
                                                                    {formatMoney(item.cost, result.itinerary.currency)}
                                                                </div>
                                                            </div>

                                                            {canExpandTransport && (
                                                                <div className="mt-4 border-t border-[var(--ws-line-soft)] pt-4">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => toggleTransportDetails(item.id)}
                                                                        className="text-sm font-semibold text-[var(--ws-ink-soft)] transition hover:text-[var(--ws-ink)]"
                                                                    >
                                                                        {isTransportExpanded ? "Hide connections" : "Show connections"}
                                                                    </button>

                                                                    {isTransportExpanded && (
                                                                        <div className="mt-4 space-y-3">
                                                                            {transportLegs.map((leg, legIndex) => {
                                                                                const departureTime = formatTransportTime(leg.departure_time);
                                                                                const arrivalTime = formatTransportTime(leg.arrival_time);
                                                                                return (
                                                                                        <div key={`${item.id}-${legIndex}`} className="rounded-2xl bg-[rgba(255,244,239,0.55)] px-4 py-3 ring-1 ring-[var(--ws-line)]">
                                                                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                                                            <div>
                                                                                                    <p className="text-sm font-semibold capitalize text-[var(--ws-ink)]">
                                                                                                    {leg.mode}{leg.line ? ` ${leg.line}` : ""}
                                                                                                </p>
                                                                                                    <p className="mt-1 text-sm text-[var(--ws-muted)]">
                                                                                                    {leg.origin} to {leg.destination}
                                                                                                </p>
                                                                                                {leg.direction && (
                                                                                                    <p className="mt-1 text-xs text-[rgba(87,84,74,0.7)]">Direction: {leg.direction}</p>
                                                                                                )}
                                                                                                {leg.notes && <p className="mt-1 text-xs text-[rgba(87,84,74,0.7)]">{leg.notes}</p>}
                                                                                            </div>
                                                                                            <div className="text-sm font-medium text-[var(--ws-muted)]">
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
                                                                className="ws-btn-secondary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
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
                                    className="ws-btn-primary px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {savingTitle === result.title ? "Saving trip..." : "Save this itinerary"}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRestartQuiz}
                                    className="ws-btn-secondary px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
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
