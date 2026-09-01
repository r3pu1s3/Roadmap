import prisma from "../lib/prisma";
import { parseCounterLabels } from "./ObjectiveParser";

const DESCRIPTION_WORD_LIMIT = 25;

export interface CreateObjectiveInput {
  description: string;
  isTask: boolean;
}

export interface UpdateObjectiveInput {
  id: number;
  description: string;
  isTask: boolean;
}

function validateObjectiveInput(description: string, isTask: boolean) {
  if (!description || description.trim().length === 0) {
    throw new Error("description is required");
  }

  const wordCount = description.trim().split(/\s+/).length;
  if (wordCount > DESCRIPTION_WORD_LIMIT) {
    throw new Error(
      `description must be ${DESCRIPTION_WORD_LIMIT} words or fewer (got ${wordCount})`
    );
  }

  if (typeof isTask !== "boolean") {
    throw new Error("isTask must be a boolean");
  }
}

function resolveCounterLabel(description: string, isTask: boolean): string | null {
  if (!isTask) return null;

  const labels = parseCounterLabels(description);

  if (labels.length > 1) {
    throw new Error(
      "There should only be one counter for each objective. Break down the goal if you need to."
    );
  }

  return labels.length === 1 ? labels[0] : null;
}

export async function createObjective(data: CreateObjectiveInput) {
  const { description, isTask } = data;

  // --- Validation (business rules Prisma can't enforce) ---
  validateObjectiveInput(description, isTask);
  const counterLabel = resolveCounterLabel(description, isTask);

  // --- Create ---
  return prisma.objective.create({
    data: {
      description,
      isTask,
      counter: counterLabel
        ? {
            create: {
              label: counterLabel,
              targetQuantity: null,
            },
          }
        : undefined,
    },
    include: { counter: true },
  });
}

export async function updateObjective(data: UpdateObjectiveInput) {
  const { id, description, isTask } = data;

  // --- Existence check ---
  const existing = await prisma.objective.findUnique({
    where: { id },
    include: { counter: true },
  });
  if (!existing) {
    throw new Error("objective not found");
  }

  // --- Validation (same checks as createObjective) ---
  validateObjectiveInput(description, isTask);
  const counterLabel = resolveCounterLabel(description, isTask);

  // --- Reconcile the counter against whatever it already was ---
  // Unlike create, an update has to decide what happens to an EXISTING
  // counter row: keep it, replace it, or remove it — depending on whether
  // the description's placeholder changed.
  let counterOperation:
    | { create: { label: string; targetQuantity: null } }
    | { update: { label: string; targetQuantity: null } }
    | { delete: true }
    | undefined;

  if (counterLabel) {
    if (!existing.counter) {
      // No counter existed before — create one.
      counterOperation = { create: { label: counterLabel, targetQuantity: null } };
    } else if (existing.counter.label !== counterLabel) {
      // The placeholder changed (e.g. {pushups} -> {situps}) — the old
      // targetQuantity no longer means anything, so reset it to null
      // rather than silently keeping a stale number under a new label.
      counterOperation = { update: { label: counterLabel, targetQuantity: null } };
    }
    // else: label is unchanged — leave the counter (and its
    // targetQuantity) untouched, don't set counterOperation at all.
  } else if (existing.counter) {
    // isTask is now false, or the placeholder was removed from the
    // description — the objective no longer has anything to count.
    counterOperation = { delete: true };
  }

  // --- Update ---
  return prisma.objective.update({
    where: { id },
    data: {
      description,
      isTask,
      counter: counterOperation,
    },
    include: { counter: true },
  });
}