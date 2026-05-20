import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getPublicSettings } from "../api/waitlist";
import { useAuth } from "../hooks/useAuth";

export default function RegisterPage() {
    const { register } = useAuth();
    const navigate = useNavigate();
    const [fullName, setFullName] = useState("");
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
            await register(email, password, fullName);
            navigate("/");
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "Registration failed");
        } finally {
            setLoading(false);
        }
    };

    if (registrationOpen === null) return null;

    return (
        <div className="ws-app-bg min-h-screen px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-[2.5rem] border border-[var(--ws-line)] bg-[#fffdf8]/82 shadow-2xl shadow-stone-300/45 backdrop-blur lg:grid-cols-[1.02fr_0.98fr]">
                <section className="relative overflow-hidden bg-[var(--ws-cream)] px-8 py-10 text-[var(--ws-ink)] sm:px-10 lg:px-12 lg:py-14">
                    <img className="ws-logo" src="/landing/logo.png" alt="Wellspent" />
                    <h1 className="mt-8 max-w-xl text-5xl font-semibold tracking-[-0.03em] lg:text-6xl">
                        Start with your <span className="ws-serif-italic text-[var(--ws-orange)]">travel style</span>. We&apos;ll build from there.
                    </h1>
                    <p className="mt-6 max-w-lg text-base leading-7 text-[var(--ws-muted)]">
                        Create your account, complete a quick preference setup, and move straight into personalized trip planning.
                    </p>

                    <div className="mt-12 space-y-4">
                        <div className="ws-chip-card p-5 shadow-sm">
                            <p className="ws-mono text-[var(--ws-muted)]">Step 1</p>
                            <p className="mt-2 text-lg font-semibold">Create your account</p>
                        </div>
                        <div className="ws-chip-card ws-chip-card-yellow p-5 shadow-sm">
                            <p className="ws-mono text-[var(--ws-muted)]">Step 2</p>
                            <p className="mt-2 text-lg font-semibold">Tell us how you like to travel</p>
                        </div>
                        <div className="ws-chip-card ws-chip-card-green-soft p-5 shadow-sm">
                            <p className="ws-mono text-[var(--ws-muted)]">Step 3</p>
                            <p className="mt-2 text-lg font-semibold">Save the first itinerary that feels right</p>
                        </div>
                    </div>
                </section>

                <section className="flex items-center justify-center px-6 py-10 sm:px-10">
                    <div className="w-full max-w-md">
                        <p className="ws-mono text-[var(--ws-orange)]">Create account</p>
                        <h2 className="ws-display mt-4 text-4xl">
                            Build your planning profile.
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-[var(--ws-muted)]">
                            We&apos;ll take you directly into mandatory onboarding once your account is ready.
                        </p>

                        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                            <input
                                type="text"
                                placeholder="Full name"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                required
                                className="ws-input w-full rounded-2xl px-4 py-3 transition"
                            />
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
                                {loading ? "Creating account..." : "Create account"}
                            </button>
                        </form>

                        <p className="mt-6 text-sm text-[var(--ws-muted)]">
                            Already have an account? {" "}
                            <Link to="/login" className="font-medium text-[var(--ws-ink)] underline decoration-[rgba(228,87,46,0.35)] underline-offset-4 transition hover:decoration-[var(--ws-orange)]">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}
