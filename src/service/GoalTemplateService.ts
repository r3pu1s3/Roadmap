import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
console.log(process.env.DATABASE_URL)
const prisma = new PrismaClient({adapter});


const DESCRIPTION_WORD_LIMIT = 25;

export interface CreateGoalTemplateInput {
  description: string;
  parentId?: number;
  rewardRule: number[];
  deadlineRule: number[];
  counters?: string[];
}

export async function createGoalTemplate(data: CreateGoalTemplateInput) {
  const { description, parentId, rewardRule, deadlineRule, counters } = data;

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

  if (counters && counters.length > 3) {
    throw new Error("a goal template can have at most 3 counters");
  }

  if (parentId !== undefined) {
    const parentExists = await prisma.goalTemplate.findUnique({ where: { id: parentId } });
    if (!parentExists) {
      throw new Error("parentId does not reference an existing goal template");
    }
  }

  // --- Create ---
  return prisma.goalTemplate.create({
    data: {
      description,
      parentId: parentId ?? null,
      rewardRule,
      deadlineRule,
      counters: counters ?? [],
    },
  });
}