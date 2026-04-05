import { Link } from "react-router-dom";
import { useState } from "react";
import { joinWaitlist } from "../api/waitlist";

export default function LandingPage() {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

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
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(254,226,226,0.9),_transparent_28%),linear-gradient(180deg,#fcfbf8_0%,#f2ecdf_100%)] px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-[2.5rem] border border-white/70 bg-[#fcfbf8]/80 shadow-2xl shadow-stone-200/50 backdrop-blur lg:grid-cols-[1.05fr_0.95fr]">
                <section className="bg-slate-900 px-8 py-10 text-white sm:px-10 lg:px-12 lg:py-14">
                    <p className="text-sm font-semibold tracking-[0.24em] text-white/65 uppercase">WellSpent</p>
                    <h1 className="mt-8 max-w-xl text-5xl font-semibold tracking-tight lg:text-6xl">
                        Swiss trips, planned around the way you actually travel.
                    </h1>
                    <p className="mt-6 max-w-lg text-base leading-7 text-white/72">
                        Tell us your travel style once. We&apos;ll build polished Swiss itineraries in minutes — matched to your pace, budget, and interests.
                    </p>

                    <div className="mt-12 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-[2rem] border border-white/10 bg-white/8 p-5">
                            <p className="text-sm font-medium text-white/65">Personalised</p>
                            <p className="mt-3 text-lg font-semibold">Recommendations shaped by your travel preferences.</p>
                        </div>
                        <div className="rounded-[2rem] border border-white/10 bg-white/8 p-5">
                            <p className="text-sm font-medium text-white/65">Effortless</p>
                            <p className="mt-3 text-lg font-semibold">Day-by-day itineraries with attractions and tours built in.</p>
                        </div>
                        <div className="rounded-[2rem] border border-white/10 bg-white/8 p-5">
                            <p className="text-sm font-medium text-white/65">Swiss-focused</p>
                            <p className="mt-3 text-lg font-semibold">Powered by official Swiss tourism data for every destination.</p>
                        </div>
                        <div className="rounded-[2rem] border border-white/10 bg-white/8 p-5">
                            <p className="text-sm font-medium text-white/65">Saved for later</p>
                            <p className="mt-3 text-lg font-semibold">Keep every promising route in your personal trip library.</p>
                        </div>
                    </div>
                </section>

                <section className="flex items-center justify-center px-6 py-10 sm:px-10">
                    <div className="w-full max-w-md">
                        {submitted ? (
                            <>
                                <p className="text-sm font-semibold tracking-[0.24em] text-slate-500 uppercase">You&apos;re in</p>
                                <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
                                    Thanks for joining the waitlist!
                                </h2>
                                <p className="mt-3 text-sm leading-6 text-slate-500">
                                    We&apos;ll let you know as soon as WellSpent is ready. Keep an eye on your inbox.
                                </p>
                            </>
                        ) : (
                            <>
                                <p className="text-sm font-semibold tracking-[0.24em] text-slate-500 uppercase">Coming soon</p>
                                <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
                                    Join the waitlist.
                                </h2>
                                <p className="mt-3 text-sm leading-6 text-slate-500">
                                    Be the first to plan smarter Swiss trips. We&apos;ll notify you when we launch.
                                </p>

                                <p className="mt-4 text-sm text-slate-500">
                                    Already have access? {" "}
                                    <Link to="/login" className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:decoration-slate-900">
                                        Sign in
                                    </Link>
                                </p>

                                <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                                    <input
                                        type="text"
                                        placeholder="Name (optional)"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                                    />
                                    <input
                                        type="email"
                                        placeholder="Email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        required
                                        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                                    />
                                    {error && <p className="text-sm text-rose-600">{error}</p>}
                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {loading ? "Joining..." : "Join the waitlist"}
                                    </button>
                                </form>
                            </>
                        )}

                    </div>
                </section>
            </div>
        </div>
    );
}
