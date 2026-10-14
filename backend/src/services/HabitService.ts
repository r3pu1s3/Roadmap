import prisma from "../lib/prisma";
import { Habit } from "../generated/prisma/client";

const NAME_CHAR_LIMIT = 100;
const DESCRIPTION_CHAR_LIMIT = 280;
const MIN_DURATION_MINUTES = 1;
const MAX_DURATION_MINUTES = 1440; // 24 hours

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

export interface CreateHabitInput {
  name: unknown;
  description?: unknown;
  durationMinutes: unknown;
}

// Creates a habit after validating every field. Checks run name →
// description → durationMinutes, and the first failure is thrown.
export async function createHabit(data: CreateHabitInput): Promise<Habit> {
  const name = validateName(data.name);
  const description = validateDescription(data.description);
  const durationMinutes = validateDurationMinutes(data.durationMinutes);

  return prisma.habit.create({
    data: { name, description, durationMinutes },
  });
}

// Lists every habit for the habits page, alphabetically by name (ignoring
// case), with same-name habits in creation order. Prisma's orderBy can't sort
// case-insensitively on PostgreSQL without raw SQL, so we fetch in id order
// (autoincrement id = creation order) and sort in memory — Array.sort is
// stable, so equal names keep that id order. Fine at the expected ~100 rows.
export async function getHabits(): Promise<Habit[]> {
  const habits = await prisma.habit.findMany({ orderBy: { id: "asc" } });
  return habits.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

// Fetches one habit by id for the update page.
export async function getHabit(id: number): Promise<Habit> {
  if (!Number.isInteger(id)) {
    throw new Error("id must be a valid integer");
  }

  const habit = await prisma.habit.findUnique({ where: { id } });
  if (!habit) {
    throw new Error("habit not found");
  }
  return habit;
}

export interface UpdateHabitInput {
  id: number;
  name?: unknown;
  description?: unknown;
  durationMinutes?: unknown;
}

// Partial update: a field that is absent (undefined) is left unchanged; a
// field that is present goes through the same validators as createHabit.
// description: null (or blank) clears the description. Existence is checked
// before any field, mirroring MapService.updateMap (research R4).
export async function updateHabit(data: UpdateHabitInput): Promise<Habit> {
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

  return prisma.habit.update({ where: { id }, data: changes });
}

// Permanently deletes a habit (no archive/undo) and returns the deleted row,
// mirroring ObjectiveEdgeService.deleteObjectiveEdge.
export async function deleteHabit(id: number): Promise<Habit> {
  if (!Number.isInteger(id)) {
    throw new Error("id must be a valid integer");
  }

  const existing = await prisma.habit.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("habit not found");
  }

  return prisma.habit.delete({ where: { id } });
}
