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
      title="Profile"
      description="Keep your travel profile current so planning and recommendations stay aligned with the way you like to travel."
      actions={
        <button
          onClick={handleSave}
          disabled={saving}
          className="ws-btn-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save preferences"}
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[0.7fr_1.3fr]">
        <section className="ws-surface p-6">
          <p className="ws-mono text-[var(--ws-orange)]">
            Profile
          </p>
          <div className="mt-6 space-y-5">
            <div>
              <p className="text-sm text-[var(--ws-muted)]">Name</p>
              <p className="mt-1 text-lg font-medium text-[var(--ws-ink)]">{user?.full_name}</p>
            </div>
            <div>
              <p className="text-sm text-[var(--ws-muted)]">Email</p>
              <p className="mt-1 text-lg font-medium text-[var(--ws-ink)]">{user?.email}</p>
            </div>
            {status && (
              <p className="rounded-2xl bg-[var(--ws-cream)] px-4 py-3 text-sm text-[var(--ws-muted)]">{status}</p>
            )}
          </div>
        </section>

        <PreferencesForm value={preferences} onChange={setPreferences} disabled={saving} />
      </div>
    </AppShell>
  );
}
