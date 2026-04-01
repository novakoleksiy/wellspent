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
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
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
          ? "border-slate-900 bg-slate-900 text-white shadow-lg shadow-slate-900/10"
          : "border-slate-200 bg-white text-slate-900 hover:border-slate-300 hover:shadow-sm",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      ].join(" ")}
    >
      <p className="text-base font-semibold">{label}</p>
      <p className={selected ? "mt-2 text-sm text-slate-300" : "mt-2 text-sm text-slate-500"}>
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
          ? "border-rose-300 bg-rose-100 text-rose-900"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900",
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
        <section className="rounded-[2rem] border border-slate-200/80 bg-[#fffdf9] p-6 shadow-sm sm:p-8">
          <SectionHeader
            title="Travel rhythm"
            description="Tell us how you like to spend and how full you want your days to feel."
          />

          <div className="space-y-6">
            <div>
              <p className="mb-3 text-sm font-medium text-slate-700">Budget level</p>
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
              <p className="mb-3 text-sm font-medium text-slate-700">Trip pace</p>
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
        <section className="rounded-[2rem] border border-slate-200/80 bg-[#fffdf9] p-6 shadow-sm sm:p-8">
          <SectionHeader
            title="Style and stay"
            description="Pick the trip styles and stay types that should shape your recommendations."
          />

          <div className="space-y-6">
            <div>
              <p className="mb-3 text-sm font-medium text-slate-700">Travel styles</p>
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
              <p className="mt-3 text-sm text-slate-500">
                Select at least one. We use these to rank recommendations.
              </p>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium text-slate-700">Accommodation types</p>
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
        <section className="rounded-[2rem] border border-slate-200/80 bg-[#fffdf9] p-6 shadow-sm sm:p-8">
          <SectionHeader
            title="A little more context"
            description="Optional notes help capture the kind of trip you are in the mood for."
          />

          <label className="block text-sm font-medium text-slate-700" htmlFor="preference-notes">
            Notes
          </label>
          <textarea
            id="preference-notes"
            rows={5}
            value={value.notes}
            onChange={(event) => update("notes", event.target.value)}
            disabled={disabled}
            placeholder="Spa weekend, scenic train rides, low-key food spots, family-friendly pace..."
            className="mt-3 w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
          />
        </section>
      )}
    </div>
  );
}
