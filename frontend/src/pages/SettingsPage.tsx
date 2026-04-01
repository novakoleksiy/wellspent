import { useEffect, useState } from "react";
import { updatePreferences } from "../api/auth";
import AppShell from "../components/AppShell";
import PreferencesForm from "../components/PreferencesForm";
import { useAuth } from "../hooks/useAuth";
import { coercePreferences, defaultPreferences } from "../preferences";
import type { Preferences } from "../types";

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    setPreferences(coercePreferences(user?.preferences));
  }, [user]);

  const handleSave = async () => {
    setSaving(true);
    setStatus("");

    try {
      await updatePreferences(preferences);
      await refreshUser();
      setStatus("Preferences updated.");
    } catch (err: unknown) {
      setStatus(err instanceof Error ? err.message : "Unable to update preferences");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AppShell
      title="Settings"
      description="Keep your travel profile up to date so every itinerary stays aligned with the way you like to travel."
      actions={
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save preferences"}
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <section className="rounded-[2rem] border border-slate-200/80 bg-white/85 p-6 shadow-sm">
          <p className="text-sm font-semibold tracking-[0.22em] text-slate-500 uppercase">
            Account
          </p>
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-sm text-slate-500">Name</p>
              <p className="mt-1 text-lg font-medium text-slate-900">{user?.full_name}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500">Email</p>
              <p className="mt-1 text-lg font-medium text-slate-900">{user?.email}</p>
            </div>
            {status && (
              <p className="rounded-2xl bg-stone-100 px-4 py-3 text-sm text-slate-600">{status}</p>
            )}
          </div>
        </section>

        <PreferencesForm value={preferences} onChange={setPreferences} disabled={saving} />
      </div>
    </AppShell>
  );
}
