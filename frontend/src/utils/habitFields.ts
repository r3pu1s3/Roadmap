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
