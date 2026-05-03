import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { updatePreferences } from "../api/auth";
import PreferencesForm, {
  type PreferenceSection,
} from "../components/PreferencesForm";
import { useAuth } from "../hooks/useAuth";
import { coercePreferences, defaultPreferences } from "../preferences";
import type { Preferences } from "../types";

const steps: Array<{
  title: string;
  description: string;
  sections: PreferenceSection[];
}> = [
  {
    title: "Set the tone",
    description: "Choose the pace and comfort level you want recommendations to optimize for.",
    sections: ["basics"],
  },
  {
    title: "Shape your travel style",
    description: "Tell us what kind of places and stays feel most like you.",
    sections: ["styles"],
  },
  {
    title: "Finish your setup",
    description: "Add any final notes, then we will take you straight into planning.",
    sections: ["notes"],
  },
];

function currentStepReady(step: number, preferences: Preferences): boolean {
  if (step === 0) {
    return Boolean(preferences.budget_tier && preferences.pace);
  }

  if (step === 1) {
    return (
      preferences.travel_styles.length > 0 &&
      preferences.accommodation_types.length > 0
    );
  }

  return true;
}

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user, logout, refreshUser } = useAuth();
  const [step, setStep] = useState(0);
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setPreferences(coercePreferences(user?.preferences));
  }, [user]);

  const activeStep = steps[step];

  const handleContinue = async () => {
    if (!currentStepReady(step, preferences)) {
      setError("Choose at least one travel style and one stay type before continuing.");
      return;
    }

    setError("");

    if (step < steps.length - 1) {
      setStep((current) => current + 1);
      return;
    }

    setSaving(true);

    try {
      await updatePreferences(preferences);
      await refreshUser();
      navigate("/plan", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unable to save preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(254,226,226,0.9),_transparent_30%),linear-gradient(180deg,#fcfbf8_0%,#f5efe4_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between pb-6">
        <div>
          <p className="text-sm font-semibold tracking-[0.24em] text-slate-500 uppercase">WellSpent</p>
          <p className="mt-1 text-sm text-slate-500">A tailored planner for your next Swiss escape.</p>
        </div>

        <button
          onClick={logout}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          Sign out
        </button>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[2.5rem] bg-slate-900 px-6 py-8 text-white shadow-2xl shadow-slate-900/15 sm:px-8 sm:py-10">
          <p className="text-sm font-medium text-white/70">Welcome{user?.full_name ? `, ${user.full_name}` : ""}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight sm:text-5xl">
            Let&apos;s tune your travel profile before we plan the first trip.
          </h1>
          <p className="mt-4 max-w-lg text-base leading-7 text-white/75">
            Your preferences shape every itinerary we generate. This only takes a minute and keeps the recommendations feeling personal from the start.
          </p>

          <div className="mt-10 space-y-4">
            {steps.map((item, index) => {
              const isActive = index === step;
              const isComplete = index < step;

              return (
                <div
                  key={item.title}
                  className={[
                    "rounded-3xl border px-5 py-4 transition",
                    isActive
                      ? "border-white/25 bg-white/10"
                      : "border-white/10 bg-white/5",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        "flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold",
                        isComplete
                          ? "bg-emerald-400 text-slate-900"
                          : isActive
                            ? "bg-white text-slate-900"
                            : "bg-white/10 text-white/70",
                      ].join(" ")}
                    >
                      {isComplete ? "✓" : index + 1}
                    </div>
                    <div>
                      <p className="text-base font-semibold">{item.title}</p>
                      <p className="text-sm text-white/65">{item.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 rounded-[2rem] border border-white/10 bg-white/5 p-5">
            <p className="text-sm font-medium text-white/75">What we use right away</p>
            <ul className="mt-4 space-y-3 text-sm text-white/70">
              <li>Travel styles influence which itineraries rank highest.</li>
              <li>Pace helps determine how full each day should feel.</li>
              <li>Budget tier steers the overall trip estimate.</li>
            </ul>
          </div>
        </section>

        <section className="rounded-[2.5rem] border border-white/60 bg-[#fcfbf8]/90 p-6 shadow-xl shadow-stone-200/50 backdrop-blur sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-rose-600">Step {step + 1} of {steps.length}</p>
              <h2 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                {activeStep.title}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                {activeStep.description}
              </p>
            </div>

            <div className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-500 sm:block">
              Personalized setup
            </div>
          </div>

          <PreferencesForm
            value={preferences}
            onChange={(next) => {
              setError("");
              setPreferences(next);
            }}
            sections={activeStep.sections}
            disabled={saving}
          />

          {error && <p className="mt-5 text-sm text-rose-600">{error}</p>}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0 || saving}
              className="rounded-full border border-slate-200 px-5 py-3 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>

            <button
              type="button"
              onClick={handleContinue}
              disabled={saving}
              className="rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/15 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : step === steps.length - 1
                  ? "Start planning"
                  : "Continue"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
