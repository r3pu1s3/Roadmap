import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";
import { parseCounterLabels } from "./ObjectiveParser";
import prisma from "../lib/prisma";

// const adapter = new PrismaPg({
//   connectionString: process.env.DATABASE_URL!,
// });
// const prisma = new PrismaClient({ adapter });

const DESCRIPTION_WORD_LIMIT = 25;

export interface CreateObjectiveInput {
  description: string;
  isTask: boolean;
}

export async function createObjective(data: CreateObjectiveInput) {
  const { description, isTask } = data;

  // --- Validation (business rules Prisma can't enforce) ---

  // description check
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

  // task + counter check
  let counterLabel: string | null = null;

  if (isTask) {
    const labels = parseCounterLabels(description);

    if (labels.length > 1) {
      throw new Error(
        "There should only be one counter for each objective. Break down the goal if you need to."
      );
    }

    if (labels.length === 1) {
      counterLabel = labels[0];
    }
    // labels.length === 0: isTask is true but the description has no
    // {placeholder} — allowed for now, the objective is just created
    // without a counter attached. See note below if you'd rather require one.
  }

  // --- Create ---
  return prisma.objective.create({
    data: {
      description,
      isTask,
      counter: counterLabel
        ? {
            create: {
              label: counterLabel,
              targetQuantity: null, // filled in by the user later, e.g. via PATCH
            },
          }
        : undefined,
    },
    include: { counter: true },
  });
}