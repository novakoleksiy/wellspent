import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { joinWaitlist } from "../api/waitlist";

const LAUNCH_DATE = new Date("2026-09-01T09:00:00+02:00");

const featureCards = [
    {
        label: "Personalised",
        title: "Recommendations shaped around your pace, budget, and interests.",
    },
    {
        label: "Effortless",
        title: "Generate polished day-by-day Swiss itineraries in minutes.",
    },
    {
        label: "Swiss-focused",
        title: "Built on official tourism data for places worth your time.",
    },
    {
        label: "Saved for later",
        title: "Keep every promising route in a trip library you can revisit.",
    },
];

const steps = [
    {
        number: "01",
        title: "Share your travel style",
        copy: "Tell WellSpent how fast you like to move, what you want to spend, and what kind of places you actually enjoy.",
    },
    {
        number: "02",
        title: "Get a Swiss itinerary draft",
        copy: "See routes, destinations, and attractions assembled into a realistic trip plan instead of a loose list of ideas.",
    },
    {
        number: "03",
        title: "Save and refine",
        copy: "Keep the routes you like, compare options, and come back when you are ready to book the right version of the trip.",
    },
];

function getTimeLeft() {
    const difference = LAUNCH_DATE.getTime() - Date.now();

    if (difference <= 0) {
        return {
            days: "00",
            hours: "00",
            minutes: "00",
            seconds: "00",
        };
    }

    const days = Math.floor(difference / (1000 * 60 * 60 * 24));
    const hours = Math.floor((difference / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((difference / (1000 * 60)) % 60);
    const seconds = Math.floor((difference / 1000) % 60);

    return {
        days: String(days).padStart(2, "0"),
        hours: String(hours).padStart(2, "0"),
        minutes: String(minutes).padStart(2, "0"),
        seconds: String(seconds).padStart(2, "0"),
    };
}

export default function LandingPage() {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [timeLeft, setTimeLeft] = useState(getTimeLeft);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setTimeLeft(getTimeLeft());
        }, 1000);

        return () => window.clearInterval(timer);
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await joinWaitlist({ email, name: name || undefined });
            setSubmitted(true);
        } catch (err: unknown) {
            if (err instanceof Error && err.message.includes("already on the waitlist")) {
                setError("You're already on the list — we'll reach out soon!");
            } else {
                setError(err instanceof Error ? err.message : "Something went wrong");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[linear-gradient(180deg,#edf6ff_0%,#f7fbff_30%,#ffffff_100%)] px-4 py-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl space-y-6 lg:space-y-8">
                <section className="overflow-hidden rounded-[2.5rem] border border-white/70 bg-[radial-gradient(circle_at_top,_rgba(65,167,255,0.42),transparent_34%),linear-gradient(180deg,#70bfff_0%,#6bb6ef_52%,#91caf8_100%)] px-6 py-6 text-white shadow-[0_30px_90px_rgba(82,153,220,0.28)] sm:px-8 sm:py-8 lg:px-10 lg:py-10">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-[1.25rem] bg-white/22 text-xl font-semibold shadow-[inset_0_1px_1px_rgba(255,255,255,0.35)] backdrop-blur">
                            W
                        </div>
                        <div>
                            <p className="text-2xl font-semibold tracking-tight sm:text-3xl">WellSpent</p>
                            <p className="text-sm text-white/72 sm:text-base">Swiss travel planning, tailored to real people.</p>
                        </div>
                    </div>

                    <div className="relative mt-10 text-center lg:mt-14">
                        <div className="mx-auto inline-flex rounded-full border border-white/25 bg-white/10 px-5 py-2 text-xs font-semibold tracking-[0.32em] text-white/90 uppercase backdrop-blur-sm sm:text-sm">
                            Coming soon
                        </div>

                        <div className="mx-auto mt-6 max-w-4xl">
                            <h1 className="text-5xl font-semibold tracking-[-0.06em] text-white sm:text-6xl lg:text-8xl">
                                Get early access to smarter Swiss trip planning.
                            </h1>
                            <p className="mx-auto mt-6 max-w-2xl text-base leading-7 text-white/84 sm:text-lg">
                                Tell us how you actually travel and get polished Switzerland itineraries built around your pace, priorities, and budget.
                            </p>
                        </div>

                        <div className="mx-auto mt-8 max-w-3xl rounded-[2rem] border border-white/20 bg-white/10 p-3 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] backdrop-blur-md">
                            {submitted ? (
                                <div className="rounded-[1.5rem] bg-white/92 px-6 py-7 text-left text-slate-900">
                                    <p className="text-sm font-semibold tracking-[0.24em] text-sky-600 uppercase">You&apos;re in</p>
                                    <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                                        Thanks for joining the waitlist.
                                    </h2>
                                    <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
                                        We&apos;ll let you know as soon as WellSpent is ready. Keep an eye on your inbox for your launch invite.
                                    </p>
                                </div>
                            ) : (
                                <form onSubmit={handleSubmit} className="rounded-[1.5rem] bg-white/92 p-3 text-left text-slate-900">
                                    <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
                                        <input
                                            type="text"
                                            placeholder="Name (optional)"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                            className="min-w-0 rounded-full border border-slate-200 bg-white px-5 py-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300"
                                        />
                                        <input
                                            type="email"
                                            placeholder="Your email address"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                            required
                                            className="min-w-0 rounded-full border border-slate-200 bg-white px-5 py-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300"
                                        />
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="rounded-full bg-slate-900 px-7 py-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                        >
                                            {loading ? "Joining..." : "Join waitlist"}
                                        </button>
                                    </div>
                                    <div className="mt-3 flex flex-col gap-2 px-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-slate-500">
                                            Beta access? {" "}
                                            <Link
                                                to="/login"
                                                className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:decoration-slate-900"
                                            >
                                                Sign in
                                            </Link>
                                        </p>
                                        {error && <p className="text-rose-600">{error}</p>}
                                    </div>
                                </form>
                            )}
                        </div>

                        <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                            {[
                                { label: "Days", value: timeLeft.days },
                                { label: "Hours", value: timeLeft.hours },
                                { label: "Minutes", value: timeLeft.minutes },
                                { label: "Seconds", value: timeLeft.seconds },
                            ].map(item => (
                                <div
                                    key={item.label}
                                    className="rounded-[1.9rem] border border-white/18 bg-white/10 px-6 py-6 text-center shadow-[inset_0_1px_1px_rgba(255,255,255,0.25)] backdrop-blur-sm"
                                >
                                    <p className="text-4xl font-semibold tracking-tight sm:text-5xl">{item.value}</p>
                                    <p className="mt-2 text-xs font-medium tracking-[0.28em] text-white/80 uppercase">{item.label}</p>
                                </div>
                            ))}
                        </div>

                    </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-2">
                    <article className="rounded-[2.25rem] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-7">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold tracking-[0.24em] text-sky-600 uppercase">Personalised</p>
                                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Plans shaped around how you travel</h3>
                            </div>
                            <div className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">Profile fit</div>
                        </div>
                        <p className="mt-4 text-base leading-7 text-slate-600">
                            Turn pace, budget, and interests into recommendations that feel considered instead of generic.
                        </p>
                        <div className="mt-6 rounded-[1.75rem] bg-sky-50 p-5">
                            <div className="flex items-center justify-between text-sm font-medium text-slate-500">
                                <span>Travel style</span>
                                <span>92% match</span>
                            </div>
                            <div className="mt-4 space-y-3">
                                <div>
                                    <div className="flex items-center justify-between text-sm text-slate-600">
                                        <span>Scenic routes</span>
                                        <span>High</span>
                                    </div>
                                    <div className="mt-2 h-2 rounded-full bg-white">
                                        <div className="h-2 w-5/6 rounded-full bg-sky-500" />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between text-sm text-slate-600">
                                        <span>Fast-paced days</span>
                                        <span>Low</span>
                                    </div>
                                    <div className="mt-2 h-2 rounded-full bg-white">
                                        <div className="h-2 w-1/3 rounded-full bg-slate-400" />
                                    </div>
                                </div>
                                <div className="rounded-2xl bg-white p-4 text-sm text-slate-600">
                                    Best fit: lakeside towns, rail segments under 2h, slower evening plans.
                                </div>
                            </div>
                        </div>
                    </article>

                    <article className="rounded-[2.25rem] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-7">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold tracking-[0.24em] text-emerald-600 uppercase">Effortless</p>
                                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Day-by-day itineraries, already structured</h3>
                            </div>
                            <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Draft ready</div>
                        </div>
                        <p className="mt-4 text-base leading-7 text-slate-600">
                            See a realistic trip shape with daily flow, transport rhythm, and attraction ideas in one view.
                        </p>
                        <div className="mt-6 rounded-[1.75rem] bg-emerald-50 p-5">
                            <div className="grid gap-3">
                                <div className="rounded-2xl bg-white p-4">
                                    <div className="flex items-center justify-between text-xs font-semibold tracking-[0.18em] text-emerald-700 uppercase">
                                        <span>Day 2</span>
                                        <span>Lucerne</span>
                                    </div>
                                    <p className="mt-3 text-lg font-semibold text-slate-900">Lake promenade, chapel bridge, old town dinner</p>
                                </div>
                                <div className="rounded-2xl bg-white p-4">
                                    <div className="flex items-center justify-between text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
                                        <span>Day 4</span>
                                        <span>Interlaken</span>
                                    </div>
                                    <p className="mt-3 text-lg font-semibold text-slate-900">GoldenPass arrival and low-effort scenic afternoon</p>
                                </div>
                            </div>
                        </div>
                    </article>

                    <article className="rounded-[2.25rem] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-7">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold tracking-[0.24em] text-amber-600 uppercase">Swiss-focused</p>
                                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Official attraction context, not random listicles</h3>
                            </div>
                            <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Verified data</div>
                        </div>
                        <p className="mt-4 text-base leading-7 text-slate-600">
                            Prioritise places worth your time using tourism-backed destination and activity information.
                        </p>
                        <div className="mt-6 rounded-[1.75rem] bg-amber-50 p-5">
                            <div className="rounded-2xl bg-white p-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-lg font-semibold text-slate-900">Mount Pilatus</p>
                                        <p className="mt-1 text-sm text-slate-500">Cableway, panoramic ridge walk, half-day fit</p>
                                    </div>
                                    <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Official</div>
                                </div>
                                <div className="mt-4 flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                                    <span className="rounded-full bg-slate-100 px-3 py-1">Scenic</span>
                                    <span className="rounded-full bg-slate-100 px-3 py-1">Rail-friendly</span>
                                    <span className="rounded-full bg-slate-100 px-3 py-1">Clear-day pick</span>
                                </div>
                            </div>
                        </div>
                    </article>

                    <article className="rounded-[2.25rem] border border-slate-200/80 bg-white p-6 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:p-7">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <p className="text-sm font-semibold tracking-[0.24em] text-violet-600 uppercase">Saved for later</p>
                                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">Keep and compare routes worth revisiting</h3>
                            </div>
                            <div className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">Trip library</div>
                        </div>
                        <p className="mt-4 text-base leading-7 text-slate-600">
                            Save strong options, compare versions, and come back to the one that best fits the trip you want to take.
                        </p>
                        <div className="mt-6 rounded-[1.75rem] bg-violet-50 p-5">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between rounded-2xl bg-white p-4">
                                    <div>
                                        <p className="text-base font-semibold text-slate-900">Classic Lakes Route</p>
                                        <p className="mt-1 text-sm text-slate-500">Zurich, Lucerne, Interlaken</p>
                                    </div>
                                    <div className="h-3 w-3 rounded-full bg-violet-500" />
                                </div>
                                <div className="flex items-center justify-between rounded-2xl bg-white p-4">
                                    <div>
                                        <p className="text-base font-semibold text-slate-900">Budget Alpine Variant</p>
                                        <p className="mt-1 text-sm text-slate-500">Bern, Thun, mountain day trip</p>
                                    </div>
                                    <div className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">Saved</div>
                                </div>
                            </div>
                        </div>
                    </article>
                </section>

                <section className="rounded-[2.5rem] border border-slate-200/80 bg-white px-6 py-8 shadow-[0_20px_60px_rgba(15,23,42,0.06)] sm:px-8 lg:px-10 lg:py-10">
                    <div className="max-w-2xl">
                        <p className="text-sm font-semibold tracking-[0.24em] text-sky-600 uppercase">Why WellSpent</p>
                        <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                            Built for travelers who want a plan, not more tabs.
                        </h2>
                        <p className="mt-4 text-base leading-7 text-slate-600">
                            The structure follows the premium launch-page feel from the reference, but the message stays grounded in real Swiss trip planning.
                        </p>
                    </div>

                    <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {featureCards.map(card => (
                            <div key={card.label} className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
                                <p className="text-sm font-semibold tracking-[0.16em] text-slate-500 uppercase">{card.label}</p>
                                <p className="mt-4 text-lg font-semibold leading-7 text-slate-900">{card.title}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
                    <div className="rounded-[2.5rem] border border-slate-200/80 bg-slate-900 px-6 py-8 text-white shadow-[0_20px_60px_rgba(15,23,42,0.16)] sm:px-8 lg:px-10">
                        <p className="text-sm font-semibold tracking-[0.24em] text-white/60 uppercase">How it works</p>
                        <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
                            From travel preferences to a trip you would actually take.
                        </h2>
                        <p className="mt-4 max-w-xl text-base leading-7 text-white/72">
                            WellSpent is meant to turn scattered destination research into something coherent, saveable, and genuinely useful.
                        </p>
                    </div>

                    <div className="grid gap-4">
                        {steps.map(step => (
                            <div key={step.number} className="rounded-[2rem] border border-slate-200/80 bg-white px-6 py-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)] sm:px-8">
                                <p className="text-sm font-semibold tracking-[0.22em] text-sky-600 uppercase">{step.number}</p>
                                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">{step.title}</h3>
                                <p className="mt-3 text-base leading-7 text-slate-600">{step.copy}</p>
                            </div>
                        ))}
                    </div>
                </section>

                <section className="rounded-[2.5rem] border border-slate-200/80 bg-[linear-gradient(180deg,#f8fbff_0%,#eef6ff_100%)] px-6 py-8 text-center shadow-[0_20px_60px_rgba(15,23,42,0.05)] sm:px-8 lg:px-10 lg:py-10">
                    <p className="text-sm font-semibold tracking-[0.24em] text-sky-600 uppercase">Launch access</p>
                    <h2 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                        Join early and help shape the first release.
                    </h2>
                    <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600">
                        The waitlist is open now. Early members will be the first to try itinerary generation and saved trip collections as they roll out.
                    </p>

                    <div className="mx-auto mt-8 max-w-2xl rounded-[2rem] border border-sky-100 bg-white/90 p-3 shadow-[0_18px_45px_rgba(66,121,184,0.10)] backdrop-blur-sm">
                        {submitted ? (
                            <div className="rounded-[1.4rem] bg-sky-50 px-5 py-5 text-left text-slate-900">
                                <p className="text-sm font-semibold tracking-[0.24em] text-sky-600 uppercase">You&apos;re in</p>
                                <p className="mt-2 text-base leading-7 text-slate-700">
                                    Thanks for joining the waitlist. We&apos;ll reach out as soon as launch access opens up.
                                </p>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="rounded-[1.4rem] bg-white p-3 text-left">
                                <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                                    <input
                                        type="email"
                                        placeholder="Email address"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                        className="min-w-0 rounded-full border border-slate-200 bg-white px-5 py-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300"
                                    />
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="rounded-full bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {loading ? "Joining..." : "Join waitlist"}
                                    </button>
                                </div>
                                {error && <p className="mt-3 px-2 text-sm text-rose-600">{error}</p>}
                            </form>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
