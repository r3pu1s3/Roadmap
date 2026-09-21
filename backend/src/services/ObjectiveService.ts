import prisma from "../lib/prisma";
import { parseCounterLabels } from "./ObjectiveParser";

const DESCRIPTION_WORD_LIMIT = 25;

export interface CreateObjectiveInput {
  description: string;
  isTask: boolean;
  mapId: number;
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
      `description must be ${DESCRIPTION_WORD_LIMIT} words or fewer (got ${wordCount})`,
    );
  }

  if (typeof isTask !== "boolean") {
    throw new Error("isTask must be a boolean");
  }
}

function resolveCounterLabel(
  description: string,
  isTask: boolean,
): string | null {
  if (!isTask) return null;

  const labels = parseCounterLabels(description);

  if (labels.length > 1) {
    throw new Error(
      "There should only be one counter for each objective. Break down the goal if you need to.",
    );
  }

  return labels.length === 1 ? labels[0] : null;
}

export async function createObjective(data: CreateObjectiveInput) {
  const { description, isTask, mapId } = data;

  // --- Validation (business rules Prisma can't enforce) ---
  validateObjectiveInput(description, isTask);

  if (!Number.isInteger(mapId)) {
    throw new Error("mapId is required and must be a valid integer");
  }

  const map = await prisma.map.findUnique({ where: { id: mapId } });
  if (!map) {
    throw new Error("mapId does not reference an existing map");
  }

  const counterLabel = resolveCounterLabel(description, isTask);

  // --- Create ---
  return prisma.objective.create({
    data: {
      description,
      isTask,
      mapId,
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
  let counterOperation:
    | { create: { label: string; targetQuantity: null } }
    | { update: { label: string; targetQuantity: null } }
    | { delete: true }
    | undefined;

  if (counterLabel) {
    if (!existing.counter) {
      counterOperation = {
        create: { label: counterLabel, targetQuantity: null },
      };
    } else if (existing.counter.label !== counterLabel) {
      counterOperation = {
        update: { label: counterLabel, targetQuantity: null },
      };
    }
  } else if (existing.counter) {
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
