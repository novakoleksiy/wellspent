import type { Preferences } from "../types";
import {
  accommodationOptions,
  budgetOptions,
  paceOptions,
  travelStyleOptions,
} from "../preferences";

export type PreferenceSection = "basics" | "styles" | "notes";

type PreferencesFormProps = {
  value: Preferences;
  onChange: (value: Preferences) => void;
  sections?: PreferenceSection[];
  disabled?: boolean;
};

type CardOptionProps = {
  label: string;
  description: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
};

type ChipOptionProps = {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
};

function SectionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-xl font-semibold tracking-[-0.02em] text-[var(--ws-ink)]">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-[var(--ws-muted)]">{description}</p>
    </div>
  );
}

function CardOption({
  label,
  description,
  selected,
  onClick,
  disabled,
}: CardOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-3xl border p-5 text-left transition",
        selected
          ? "border-[var(--ws-ink)] bg-[var(--ws-ink)] text-[var(--ws-bg)] shadow-lg shadow-stone-900/10"
          : "border-[var(--ws-line)] bg-[#fffdf8] text-[var(--ws-ink)] hover:border-[rgba(20,19,15,0.24)] hover:shadow-sm",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
    >
      <p className="text-base font-semibold">{label}</p>
      <p className={selected ? "mt-2 text-sm text-white/72" : "mt-2 text-sm text-[var(--ws-muted)]"}>
        {description}
      </p>
    </button>
  );
}

function ChipOption({
  label,
  selected,
  onClick,
  disabled,
}: ChipOptionProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "rounded-full border px-4 py-2 text-sm font-medium transition",
        selected
          ? "border-[var(--ws-orange)] bg-[var(--ws-cream)] text-[var(--ws-orange)]"
          : "border-[var(--ws-line)] bg-[#fffdf8] text-[var(--ws-muted)] hover:border-[rgba(20,19,15,0.24)] hover:text-[var(--ws-ink)]",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

export default function PreferencesForm({
  value,
  onChange,
  sections = ["basics", "styles", "notes"],
  disabled,
}: PreferencesFormProps) {
  const update = <K extends keyof Preferences>(key: K, nextValue: Preferences[K]) => {
    onChange({ ...value, [key]: nextValue });
  };

  const toggleItem = (
    key: "travel_styles" | "accommodation_types",
    option: string,
  ) => {
    const current = value[key];
    const nextValue = current.includes(option)
      ? current.filter((item) => item !== option)
      : [...current, option];

    update(key, nextValue);
  };

  return (
    <div className="space-y-8">
      {sections.includes("basics") && (
        <section className="ws-surface-flat p-6 shadow-sm sm:p-8">
          <SectionHeader
            title="Travel rhythm"
            description="Set your budget and how full you want each day."
          />

          <div className="space-y-6">
            <div>
              <p className="mb-3 text-sm font-medium text-[var(--ws-ink-soft)]">Budget level</p>
              <div className="grid gap-3 lg:grid-cols-3">
                {budgetOptions.map((option) => (
                  <CardOption
                    key={option.value}
                    label={option.label}
                    description={option.description}
                    selected={value.budget_tier === option.value}
                    onClick={() => update("budget_tier", option.value)}
                    disabled={disabled}
                  />
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-[var(--ws-ink-soft)]">Trip pace</p>
              <div className="grid gap-3 lg:grid-cols-3">
                {paceOptions.map((option) => (
                  <CardOption
                    key={option.value}
                    label={option.label}
                    description={option.description}
                    selected={value.pace === option.value}
                    onClick={() => update("pace", option.value)}
                    disabled={disabled}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {sections.includes("styles") && (
        <section className="ws-surface-flat p-6 shadow-sm sm:p-8">
          <SectionHeader
            title="Style and stay"
            description="Pick the styles and stays we should suggest."
          />

          <div className="space-y-6">
            <div>
              <p className="mb-3 text-sm font-medium text-[var(--ws-ink-soft)]">Travel styles</p>
              <div className="flex flex-wrap gap-3">
                {travelStyleOptions.map((option) => (
                  <ChipOption
                    key={option.value}
                    label={option.label}
                    selected={value.travel_styles.includes(option.value)}
                    onClick={() => toggleItem("travel_styles", option.value)}
                    disabled={disabled}
                  />
                ))}
              </div>
              <p className="mt-3 text-sm text-[var(--ws-muted)]">
                Pick at least one — we use these to rank trips.
              </p>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-[var(--ws-ink-soft)]">Accommodation types</p>
              <div className="flex flex-wrap gap-3">
                {accommodationOptions.map((option) => (
                  <ChipOption
                    key={option.value}
                    label={option.label}
                    selected={value.accommodation_types.includes(option.value)}
                    onClick={() => toggleItem("accommodation_types", option.value)}
                    disabled={disabled}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {sections.includes("notes") && (
        <section className="ws-surface-flat p-6 shadow-sm sm:p-8">
          <SectionHeader
            title="Anything else?"
            description="Optional — tell us what you're in the mood for."
          />

          <label className="block text-sm font-medium text-[var(--ws-ink-soft)]" htmlFor="preference-notes">
            Notes
          </label>
          <textarea
            id="preference-notes"
            rows={5}
            value={value.notes}
            onChange={(event) => update("notes", event.target.value)}
            disabled={disabled}
            placeholder="Spa weekend, scenic train rides, low-key food spots, family-friendly pace..."
            className="ws-input mt-3 w-full rounded-3xl px-4 py-3 text-sm transition"
          />
        </section>
      )}
    </div>
  );
}
