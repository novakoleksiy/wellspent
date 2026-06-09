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
                setRegistrationOpen(settings.registration_open);
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
        <div className="ws-app-bg min-h-screen px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-[2.5rem] border border-[var(--ws-line)] bg-[#fffdf8]/82 shadow-2xl shadow-stone-300/45 backdrop-blur lg:grid-cols-[1.05fr_0.95fr]">
                <section className="ws-surface-dark ws-surface-dark-square px-8 py-10 sm:px-10 lg:px-12 lg:py-14">
                    <img className="ws-logo brightness-0 invert" src="/landing/logo.png" alt="Wellspent" />
                    <h1 className="mt-8 max-w-xl text-5xl font-semibold tracking-[-0.03em] lg:text-6xl">
                        Plan better trips with itineraries that already <span className="ws-serif-italic text-[var(--ws-yellow)]">fit you</span>.
                    </h1>
                    <p className="mt-6 max-w-lg text-base leading-7 text-white/72">
                        Set your travel style once and plan Swiss trips in minutes.
                    </p>

                    <div className="mt-12 grid gap-4 sm:grid-cols-2">
                        <div className="rounded-[2rem] border border-white/10 bg-white/8 p-5">
                            <p className="ws-mono text-white/65">Tailored planning</p>
                            <p className="mt-3 text-lg font-semibold">Recommendations shaped by your travel preferences.</p>
                        </div>
                        <div className="rounded-[2rem] border border-white/10 bg-white/8 p-5">
                            <p className="ws-mono text-white/65">Saved itineraries</p>
                            <p className="mt-3 text-lg font-semibold">Keep every promising route in your trip library.</p>
                        </div>
                    </div>
                </section>

                <section className="flex items-center justify-center px-6 py-10 sm:px-10">
                    <div className="w-full max-w-md">
                        <p className="ws-mono text-[var(--ws-orange)]">Welcome back</p>
                        <h2 className="ws-display mt-4 text-4xl">
                            Sign in to continue planning.
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-[var(--ws-muted)]">
                            Back to your saved trips and preferences.
                        </p>

                        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                            <input
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                                className="ws-input w-full rounded-2xl px-4 py-3 transition"
                            />
                            <input
                                type="password"
                                placeholder="Password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                                className="ws-input w-full rounded-2xl px-4 py-3 transition"
                            />
                            {error && <p className="text-sm text-[var(--ws-orange)]">{error}</p>}
                            <button
                                type="submit"
                                disabled={loading}
                                className="ws-btn-primary w-full px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {loading ? "Signing in..." : "Sign in"}
                            </button>
                        </form>

                        {registrationOpen && (
                            <p className="mt-6 text-sm text-[var(--ws-muted)]">
                                No account yet?{" "}
                                <Link to="/register" className="font-medium text-[var(--ws-ink)] underline decoration-[rgba(228,87,46,0.35)] underline-offset-4 transition hover:decoration-[var(--ws-orange)]">
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
