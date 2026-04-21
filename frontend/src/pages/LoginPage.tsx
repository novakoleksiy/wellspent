import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getPublicSettings } from "../api/waitlist";
import { useAuth } from "../hooks/useAuth";

export default function LoginPage() {
    const { login } = useAuth();
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [registrationOpen, setRegistrationOpen] = useState<boolean | null>(null);

    useEffect(() => {
        let isMounted = true;

        getPublicSettings()
            .then(settings => {
                if (!isMounted) return;
                if (!settings.registration_open) {
                    navigate("/", { replace: true });
                    return;
                }
                setRegistrationOpen(true);
            })
            .catch(() => {
                if (isMounted) {
                    setRegistrationOpen(true);
                }
            });

        return () => {
            isMounted = false;
        };
    }, [navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await login(email, password);
            navigate("/");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Login failed");
        } finally {
            setLoading(false);
        }
    };

    if (registrationOpen === null) return null;

    return (
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(254,226,226,0.9),_transparent_28%),linear-gradient(180deg,#fcfbf8_0%,#f2ecdf_100%)] px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-[2.5rem] border border-white/70 bg-[#fcfbf8]/80 shadow-2xl shadow-stone-200/50 backdrop-blur lg:grid-cols-[1.05fr_0.95fr]">
                <section className="bg-slate-900 px-8 py-10 text-white sm:px-10 lg:px-12 lg:py-14">
                    <p className="text-sm font-semibold tracking-[0.24em] text-white/65 uppercase">WellSpent</p>
                    <h1 className="mt-8 max-w-xl text-5xl font-semibold tracking-tight lg:text-6xl">
                        Plan better trips with itineraries that already fit you.
                    </h1>
                    <p className="mt-6 max-w-lg text-base leading-7 text-white/72">
                        Save your travel style once, generate a polished Swiss itinerary in minutes, and keep every great idea in one place.
                    </p>

                    <div className="mt-12 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-[2rem] border border-white/10 bg-white/8 p-5">
                            <p className="text-sm font-medium text-white/65">Tailored planning</p>
                            <p className="mt-3 text-lg font-semibold">Recommendations shaped by your travel preferences.</p>
                        </div>
                        <div className="rounded-[2rem] border border-white/10 bg-white/8 p-5">
                            <p className="text-sm font-medium text-white/65">Saved itineraries</p>
                            <p className="mt-3 text-lg font-semibold">Keep every promising route in your trip library.</p>
                        </div>
                    </div>
                </section>

                <section className="flex items-center justify-center px-6 py-10 sm:px-10">
                    <div className="w-full max-w-md">
                        <p className="text-sm font-semibold tracking-[0.24em] text-slate-500 uppercase">Welcome back</p>
                        <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
                            Sign in to continue planning.
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-slate-500">
                            We&apos;ll pick up with your saved trips and travel preferences.
                        </p>

                        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                            />
                            {error && <p className="text-sm text-rose-600">{error}</p>}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? "Signing in..." : "Sign in"}
                            </button>
                        </form>

                        {registrationOpen && (
                            <p className="mt-6 text-sm text-slate-500">
                                No account yet?{" "}
                                <Link to="/register" className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:decoration-slate-900">
                                    Create one
                                </Link>
                            </p>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
}
