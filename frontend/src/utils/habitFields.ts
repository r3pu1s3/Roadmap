// Mirror the limits enforced server-side in HabitService — kept in sync
// manually since there's no shared config between the two workspaces (same
// approach as NAME_WORD_LIMIT in MapForm.tsx).
export const NAME_CHAR_LIMIT = 100;
export const DESCRIPTION_CHAR_LIMIT = 280;
export const MAX_DURATION_MINUTES = 1440;

// Matches a non-negative whole number as typed into a number input. Anything
// else (a minus sign, a decimal point) is rejected rather than rounded.
const WHOLE_NUMBER = /^\d+$/;

/** Returns an error message for an invalid habit name, or null if it's valid. */
export function validateName(name: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return "Name is required";
  if (trimmed.length > NAME_CHAR_LIMIT) {
    return `Name must be ${NAME_CHAR_LIMIT} characters or fewer`;
  }
  return null;
}

/** Returns an error message for an invalid (optional) description, or null. */
export function validateDescription(description: string): string | null {
  if (description.trim().length > DESCRIPTION_CHAR_LIMIT) {
    return `Description must be ${DESCRIPTION_CHAR_LIMIT} characters or fewer`;
  }
  return null;
}

/**
 * Converts the hours/minutes form fields into a total number of minutes, or
 * an error message. An empty field counts as zero, so "" + "45" is 45 minutes.
 */
export function parseDuration(
  hours: string,
  minutes: string,
): { minutes: number } | { error: string } {
  const hoursText = hours.trim() || "0";
  const minutesText = minutes.trim() || "0";

  if (!WHOLE_NUMBER.test(hoursText) || !WHOLE_NUMBER.test(minutesText)) {
    return { error: "Hours and minutes must be whole numbers" };
  }

  const hoursValue = Number(hoursText);
  const minutesValue = Number(minutesText);

  if (minutesValue > 59) {
    return { error: "Minutes must be between 0 and 59" };
  }

  const total = hoursValue * 60 + minutesValue;
  if (total > MAX_DURATION_MINUTES) {
    return { error: "Length of time must be 24 hours or less" };
  }
  if (total < 1) {
    return { error: "Length of time must be at least 1 minute" };
  }

  return { minutes: total };
}

/** Formats a length of time for display, e.g. 75 → "1 h 15 min". */
export function formatDuration(totalMinutes: number): string {
  const { hours, minutes } = splitDuration(totalMinutes);
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours} h`;
  return `${hours} h ${minutes} min`;
}

/** Splits total minutes into whole hours and leftover minutes, e.g. 75 → 1 h 15 min. */
export function splitDuration(totalMinutes: number): {
  hours: number;
  minutes: number;
} {
  return {
    hours: Math.floor(totalMinutes / 60),
    minutes: totalMinutes % 60,
  };
}

// Mirrors MAX_PERIOD_HOURS in HabitService (365.25 days), kept in sync by
// hand like the limits above.
export const MAX_PERIOD_HOURS = 8766;

/**
 * A habit's period as the API sends it: a named calendar period, a custom
 * number of hours, or null for a one-time habit. Same name as the backend's
 * union; not the backend's Prisma enum `HabitPeriod` (presets only).
 */
export type HabitPeriodValue =
  "daily" | "weekly" | "monthly" | "yearly" | number | null;

/** The period select's options; "custom" means the Hours field is used. */
export type PeriodChoice =
  "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom";

// A plain decimal as typed into the Hours field (optional minus sign so a
// negative reads as "under 1" rather than "not a number").
const DECIMAL = /^-?\d+(\.\d+)?$/;

const PERIOD_LABELS = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
} as const;

/**
 * Converts the period select and Hours field into the API's period, or an
 * error message. Custom with empty hours means no period (one-time).
 */
export function parsePeriod(
  choice: PeriodChoice,
  hours: string,
): { period: HabitPeriodValue } | { error: string } {
  if (choice === "none") return { period: null };
  if (choice !== "custom") return { period: choice };

  const hoursText = hours.trim();
  if (hoursText === "") return { period: null };
  if (!DECIMAL.test(hoursText)) return { error: "Hours must be a number" };

  const value = Number(hoursText);
  if (value < 1) return { error: "Hours must be at least 1" };
  if (value > MAX_PERIOD_HOURS) {
    return { error: `Hours must be ${MAX_PERIOD_HOURS} or fewer` };
  }
  return { period: value };
}

/** Splits a saved period into the select choice and Hours text for editing. */
export function periodToFields(period: HabitPeriodValue): {
  choice: PeriodChoice;
  hours: string;
} {
  if (period === null) return { choice: "none", hours: "" };
  if (typeof period === "number") {
    return { choice: "custom", hours: String(period) };
  }
  return { choice: period, hours: "" };
}

/** Formats a period for display, e.g. "Weekly", "Every 36 h" or "One-time". */
export function formatPeriod(period: HabitPeriodValue): string {
  if (period === null) return "One-time";
  if (typeof period === "number") return `Every ${period} h`;
  return PERIOD_LABELS[period];
}
