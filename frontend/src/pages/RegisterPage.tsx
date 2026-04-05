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
        <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(254,226,226,0.9),_transparent_28%),linear-gradient(180deg,#fcfbf8_0%,#f2ecdf_100%)] px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-[2.5rem] border border-white/70 bg-[#fcfbf8]/80 shadow-2xl shadow-stone-200/50 backdrop-blur lg:grid-cols-[1.02fr_0.98fr]">
                <section className="bg-[#f7f1e5] px-8 py-10 text-slate-900 sm:px-10 lg:px-12 lg:py-14">
                    <p className="text-sm font-semibold tracking-[0.24em] text-slate-500 uppercase">WellSpent</p>
                    <h1 className="mt-8 max-w-xl text-5xl font-semibold tracking-tight lg:text-6xl">
                        Start with your travel style. We&apos;ll build from there.
                    </h1>
                    <p className="mt-6 max-w-lg text-base leading-7 text-slate-600">
                        Create your account, complete a quick preference setup, and move straight into personalized trip planning.
                    </p>

                    <div className="mt-12 space-y-4">
                        <div className="rounded-[2rem] border border-stone-200 bg-white/70 p-5 shadow-sm">
                            <p className="text-sm font-medium text-slate-500">Step 1</p>
                            <p className="mt-2 text-lg font-semibold">Create your account</p>
                        </div>
                        <div className="rounded-[2rem] border border-stone-200 bg-white/70 p-5 shadow-sm">
                            <p className="text-sm font-medium text-slate-500">Step 2</p>
                            <p className="mt-2 text-lg font-semibold">Tell us how you like to travel</p>
                        </div>
                        <div className="rounded-[2rem] border border-stone-200 bg-white/70 p-5 shadow-sm">
                            <p className="text-sm font-medium text-slate-500">Step 3</p>
                            <p className="mt-2 text-lg font-semibold">Save the first itinerary that feels right</p>
                        </div>
                    </div>
                </section>

                <section className="flex items-center justify-center px-6 py-10 sm:px-10">
                    <div className="w-full max-w-md">
                        <p className="text-sm font-semibold tracking-[0.24em] text-slate-500 uppercase">Create account</p>
                        <h2 className="mt-4 text-4xl font-semibold tracking-tight text-slate-900">
                            Build your planning profile.
                        </h2>
                        <p className="mt-3 text-sm leading-6 text-slate-500">
                            We&apos;ll take you directly into mandatory onboarding once your account is ready.
                        </p>

                        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                            <input
                                type="text"
                                placeholder="Full name"
                                value={fullName}
                                onChange={e => setFullName(e.target.value)}
                                required
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
                                {loading ? "Creating account..." : "Create account"}
                            </button>
                        </form>

                        <p className="mt-6 text-sm text-slate-500">
                            Already have an account? {" "}
                            <Link to="/login" className="font-medium text-slate-900 underline decoration-slate-300 underline-offset-4 transition hover:decoration-slate-900">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </section>
            </div>
        </div>
    );
}
