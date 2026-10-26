import prisma from "../lib/prisma";
import { Habit, HabitPeriod } from "../generated/prisma/client";

const NAME_CHAR_LIMIT = 100;
const DESCRIPTION_CHAR_LIMIT = 280;
const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 1440; // 24 hours
const MIN_PERIOD_HOURS = 1;
const MAX_PERIOD_HOURS = 8766; // 365.25 days
const PERIOD_PRESETS: readonly string[] = [
  "daily",
  "weekly",
  "monthly",
  "yearly",
];

// Inputs arrive straight from the request body, so they're typed `unknown`
// and every validator does its own runtime type check (research R5).

// Returns the trimmed name, or throws if it's missing, not a string, blank,
// or over the character limit.
function validateName(name: unknown): string {
  if (name === undefined || name === null) {
    throw new Error("name is required");
  }
  if (typeof name !== "string") {
    throw new Error("name must be a string");
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    throw new Error("name is required");
  }
  if (trimmed.length > NAME_CHAR_LIMIT) {
    throw new Error(
      `name must be ${NAME_CHAR_LIMIT} characters or fewer (got ${trimmed.length})`,
    );
  }
  return trimmed;
}

// Returns the trimmed description, or null when it's absent or blank (an
// empty description is stored as "no description"). Throws if it's not a
// string or is over the character limit.
function validateDescription(description: unknown): string | null {
  if (description === undefined || description === null) {
    return null;
  }
  if (typeof description !== "string") {
    throw new Error("description must be a string");
  }
  const trimmed = description.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > DESCRIPTION_CHAR_LIMIT) {
    throw new Error(
      `description must be ${DESCRIPTION_CHAR_LIMIT} characters or fewer (got ${trimmed.length})`,
    );
  }
  return trimmed;
}

// Returns durationMinutes unchanged, or throws if it's missing, not a whole
// number (numeric strings like "30" are rejected, not coerced), or outside
// 1–1440.
function validateDurationMinutes(durationMinutes: unknown): number {
  if (durationMinutes === undefined || durationMinutes === null) {
    throw new Error("durationMinutes is required");
  }
  if (
    typeof durationMinutes !== "number" ||
    !Number.isInteger(durationMinutes)
  ) {
    throw new Error("durationMinutes must be a whole number");
  }
  if (
    durationMinutes < MIN_DURATION_MINUTES ||
    durationMinutes > MAX_DURATION_MINUTES
  ) {
    throw new Error(
      `durationMinutes must be between ${MIN_DURATION_MINUTES} and ${MAX_DURATION_MINUTES}`,
    );
  }
  return durationMinutes;
}

// Turns the API's single `period` value into the two period columns, or
// throws. undefined/null → one-time (both null). It always returns both
// columns, so every write keeps "at most one set" without a separate check
// (research P5). Numeric strings like "36" are rejected, not coerced.
function validatePeriod(period: unknown): {
  periodPreset: HabitPeriod | null;
  periodHours: number | null;
} {
  if (period === undefined || period === null) {
    return { periodPreset: null, periodHours: null };
  }
  if (typeof period === "string" && PERIOD_PRESETS.includes(period)) {
    return { periodPreset: period as HabitPeriod, periodHours: null };
  }
  if (typeof period === "number" && Number.isFinite(period)) {
    if (period < MIN_PERIOD_HOURS) {
      throw new Error(`period must be at least ${MIN_PERIOD_HOURS} hour`);
    }
    if (period > MAX_PERIOD_HOURS) {
      throw new Error(`period must be ${MAX_PERIOD_HOURS} hours or fewer`);
    }
    return { periodPreset: null, periodHours: period };
  }
  throw new Error(
    "period must be one of daily, weekly, monthly, yearly, or a number of hours",
  );
}

// A habit's period as the API sends it: a named calendar period, a custom
// number of hours, or null for a one-time habit.
export type HabitPeriodValue =
  "daily" | "weekly" | "monthly" | "yearly" | number | null;

// The habit shape every service function returns and the API responds with.
export interface HabitResponse {
  id: number;
  name: string;
  description: string | null;
  durationMinutes: number;
  period: HabitPeriodValue;
}

// The API exposes one `period` field, but it's stored in two typed columns
// (periodPreset / periodHours, at most one set) so the database checks both
// halves (research P1, P6). The raw columns never leave the service.
function toHabitResponse(row: Habit): HabitResponse {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    durationMinutes: row.durationMinutes,
    period: row.periodPreset ?? row.periodHours ?? null,
  };
}

export interface CreateHabitInput {
  name: unknown;
  description?: unknown;
  durationMinutes: unknown;
  period?: unknown;
}

// Creates a habit after validating every field. Checks run name →
// description → durationMinutes → period, and the first failure is thrown.
export async function createHabit(
  data: CreateHabitInput,
): Promise<HabitResponse> {
  const name = validateName(data.name);
  const description = validateDescription(data.description);
  const durationMinutes = validateDurationMinutes(data.durationMinutes);
  const period = validatePeriod(data.period);

  const created = await prisma.habit.create({
    data: { name, description, durationMinutes, ...period },
  });
  return toHabitResponse(created);
}

// Lists every habit for the habits page, alphabetically by name (ignoring
// case), with same-name habits in creation order. Prisma's orderBy can't sort
// case-insensitively on PostgreSQL without raw SQL, so we fetch in id order
// (autoincrement id = creation order) and sort in memory — Array.sort is
// stable, so equal names keep that id order. Fine at the expected ~100 rows.
export async function getHabits(): Promise<HabitResponse[]> {
  const habits = await prisma.habit.findMany({ orderBy: { id: "asc" } });
  return habits
    .sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
    )
    .map(toHabitResponse);
}

// Fetches one habit by id for the update page.
export async function getHabit(id: number): Promise<HabitResponse> {
  if (!Number.isInteger(id)) {
    throw new Error("id must be a valid integer");
  }

  const habit = await prisma.habit.findUnique({ where: { id } });
  if (!habit) {
    throw new Error("habit not found");
  }
  return toHabitResponse(habit);
}

export interface UpdateHabitInput {
  id: number;
  name?: unknown;
  description?: unknown;
  durationMinutes?: unknown;
  period?: unknown;
}

// Partial update: a field that is absent (undefined) is left unchanged; a
// field that is present goes through the same validators as createHabit.
// description: null (or blank) clears the description, and period: null
// makes the habit one-time; a preset or number replaces whichever period
// column was set before. Existence is checked before any field, mirroring
// MapService.updateMap (research R4).
export async function updateHabit(
  data: UpdateHabitInput,
): Promise<HabitResponse> {
  const { id } = data;

  if (!Number.isInteger(id)) {
    throw new Error("id must be a valid integer");
  }

  const existing = await prisma.habit.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("habit not found");
  }

  const changes: {
    name?: string;
    description?: string | null;
    durationMinutes?: number;
    periodPreset?: HabitPeriod | null;
    periodHours?: number | null;
  } = {};
  if (data.name !== undefined) {
    changes.name = validateName(data.name);
  }
  if (data.description !== undefined) {
    changes.description = validateDescription(data.description);
  }
  if (data.durationMinutes !== undefined) {
    changes.durationMinutes = validateDurationMinutes(data.durationMinutes);
  }
  if (data.period !== undefined) {
    Object.assign(changes, validatePeriod(data.period));
  }

  const updated = await prisma.habit.update({ where: { id }, data: changes });
  return toHabitResponse(updated);
}

// Permanently deletes a habit (no archive/undo) and returns the deleted row,
// mirroring ObjectiveEdgeService.deleteObjectiveEdge.
export async function deleteHabit(id: number): Promise<HabitResponse> {
  if (!Number.isInteger(id)) {
    throw new Error("id must be a valid integer");
  }

  const existing = await prisma.habit.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("habit not found");
  }

  const deleted = await prisma.habit.delete({ where: { id } });
  return toHabitResponse(deleted);
}
