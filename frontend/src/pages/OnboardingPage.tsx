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
    <div className="ws-app-bg min-h-screen px-4 py-6 text-[var(--ws-ink)] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl items-center justify-between pb-6">
        <div>
          <img className="ws-logo" src="/landing/logo.png" alt="Wellspent" />
          <p className="mt-2 text-sm text-[var(--ws-muted)]">A tailored planner for your next Swiss escape.</p>
        </div>

        <button
          onClick={logout}
          className="ws-btn-secondary px-4 py-2 text-sm"
        >
          Sign out
        </button>
      </div>

      <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="ws-surface-dark px-6 py-8 shadow-2xl shadow-stone-900/15 sm:px-8 sm:py-10">
          <p className="ws-mono text-white/70">Welcome{user?.full_name ? `, ${user.full_name}` : ""}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Let&apos;s tune your <span className="ws-serif-italic text-[var(--ws-yellow)]">travel profile</span> before we plan the first trip.
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
                          ? "bg-[var(--ws-yellow)] text-[var(--ws-ink)]"
                          : isActive
                            ? "bg-white text-[var(--ws-ink)]"
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

        <section className="ws-surface p-6 backdrop-blur sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="ws-mono text-[var(--ws-orange)]">Step {step + 1} of {steps.length}</p>
              <h2 className="ws-display mt-2 text-3xl">
                {activeStep.title}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--ws-muted)]">
                {activeStep.description}
              </p>
            </div>

            <div className="ws-pill hidden px-4 py-2 text-sm sm:block">
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

          {error && <p className="mt-5 text-sm text-[var(--ws-orange)]">{error}</p>}

          <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => setStep((current) => Math.max(0, current - 1))}
              disabled={step === 0 || saving}
              className="ws-btn-secondary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              Back
            </button>

            <button
              type="button"
              onClick={handleContinue}
              disabled={saving}
              className="ws-btn-primary px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
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
