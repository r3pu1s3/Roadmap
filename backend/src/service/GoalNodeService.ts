import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const DESCRIPTION_WORD_LIMIT = 25;
const MAX_COUNTERS = 3;

export interface CreateGoalNodeCounterInput {
  label: string;
  targetQuantity: number;
}

export interface CreateGoalNodeInput {
  description: string;
  parentId?: number;
  rewardRule: number[];
  deadlineRule: number[];
  deadline: Date;
  completed?: boolean;
  counters?: CreateGoalNodeCounterInput[];
}

export async function createGoalNode(data: CreateGoalNodeInput) {
  const { description, parentId, rewardRule, deadlineRule, deadline, completed, counters } = data;

  // --- Validation (business rules Prisma can't enforce) ---
  if (!description || description.trim().length === 0) {
    throw new Error("description is required");
  }

  const wordCount = description.trim().split(/\s+/).length;
  if (wordCount > DESCRIPTION_WORD_LIMIT) {
    throw new Error(
      `description must be ${DESCRIPTION_WORD_LIMIT} words or fewer (got ${wordCount})`
    );
  }

  if (!Array.isArray(rewardRule) || rewardRule.length !== 2) {
    throw new Error("rewardRule must contain exactly 2 modifiers");
  }

  if (!Array.isArray(deadlineRule) || deadlineRule.length !== 2) {
    throw new Error("deadlineRule must contain exactly 2 modifiers");
  }

  if (deadline === undefined || deadline === null) {
    throw new Error("deadline is required");
  }

  if (!(deadline instanceof Date) || isNaN(deadline.getTime())) {
    throw new Error("deadline must be a valid date");
  }

  if (deadline.getTime() < Date.now()) {
    throw new Error("deadline must be in the present or future, not the past");
  }


  if (completed !== undefined && typeof completed !== "boolean") {
    throw new Error("completed must be a boolean");
  }


  if (counters && counters.length > MAX_COUNTERS) {
    throw new Error(`a goal node can have at most ${MAX_COUNTERS} counters`);
  }

  if (counters) {
    for (const counter of counters) {
      if (!counter.label || counter.label.trim().length === 0) {
        throw new Error("each counter must have a non-empty label");
      }
      if (!Number.isFinite(counter.targetQuantity) || counter.targetQuantity <= 0) {
        throw new Error("each counter's targetQuantity must be a positive number");
      }
    }
  }


  if (parentId !== undefined) {
    const parentExists = await prisma.goalNode.findUnique({ where: { id: parentId } });
    if (!parentExists) {
      throw new Error("parentId does not reference an existing goal node");
    }
  }

  // --- Create ---
  return prisma.goalNode.create({
    data: {
      description,
      parentId: parentId ?? null,
      rewardRule,
      deadlineRule,
      deadline,
      completed: completed ?? false,
      counters: counters
        ? {
            create: counters.map((c) => ({
              label: c.label,
              targetQuantity: c.targetQuantity,
            })),
          }
        : undefined,
    },
    include: { counters: true },
  });
}