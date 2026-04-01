import type { Preferences } from "./types";

type PreferenceOption = {
  value: string;
  label: string;
  description: string;
};

export const defaultPreferences: Preferences = {
  budget_tier: "mid",
  travel_styles: [],
  accommodation_types: ["hotel"],
  pace: "moderate",
  notes: "",
};

export const budgetOptions: PreferenceOption[] = [
  {
    value: "budget",
    label: "Budget-friendly",
    description: "Smart picks, value stays, and low-key spending.",
  },
  {
    value: "mid",
    label: "Balanced",
    description: "Comfort-first trips with room for a few standout moments.",
  },
  {
    value: "luxury",
    label: "Elevated",
    description: "Premium stays, memorable dining, and extra comfort.",
  },
];

export const paceOptions: PreferenceOption[] = [
  {
    value: "relaxed",
    label: "Relaxed",
    description: "Slow mornings, fewer moves, and more downtime.",
  },
  {
    value: "moderate",
    label: "Moderate",
    description: "A balanced rhythm with a mix of activity and breathing room.",
  },
  {
    value: "packed",
    label: "Packed",
    description: "See as much as possible with full days and tight schedules.",
  },
];

export const travelStyleOptions: PreferenceOption[] = [
  {
    value: "adventure",
    label: "Adventure",
    description: "Active outings, alpine energy, and outdoor highlights.",
  },
  {
    value: "cultural",
    label: "Culture",
    description: "Museums, neighborhoods, architecture, and local history.",
  },
  {
    value: "relaxation",
    label: "Relaxation",
    description: "Scenic stays, wellness moments, and laid-back days.",
  },
  {
    value: "foodie",
    label: "Food",
    description: "Local specialties, markets, and memorable meals.",
  },
];

export const accommodationOptions: PreferenceOption[] = [
  {
    value: "hotel",
    label: "Hotels",
    description: "Simple, reliable comfort in central locations.",
  },
  {
    value: "airbnb",
    label: "Airbnbs",
    description: "Live more like a local with extra space and character.",
  },
  {
    value: "hostel",
    label: "Hostels",
    description: "Social, practical, and ideal for budget-conscious trips.",
  },
];

function stringValue(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function stringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function coercePreferences(
  value: Record<string, unknown> | null | undefined,
): Preferences {
  if (!value) {
    return { ...defaultPreferences };
  }

  return {
    budget_tier: stringValue(value.budget_tier, defaultPreferences.budget_tier),
    travel_styles: stringArray(value.travel_styles, defaultPreferences.travel_styles),
    accommodation_types: stringArray(
      value.accommodation_types,
      defaultPreferences.accommodation_types,
    ),
    pace: stringValue(value.pace, defaultPreferences.pace),
    notes: typeof value.notes === "string" ? value.notes : defaultPreferences.notes,
  };
}

export function hasCompletedOnboarding(
  value: Record<string, unknown> | null | undefined,
): boolean {
  const preferences = coercePreferences(value);

  return Boolean(
    preferences.budget_tier &&
      preferences.pace &&
      preferences.travel_styles.length > 0 &&
      preferences.accommodation_types.length > 0,
  );
}
