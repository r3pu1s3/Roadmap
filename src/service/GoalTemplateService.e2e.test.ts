import { describe, it, expect, afterEach } from "vitest";
import { createGoalTemplate } from "./GoalTemplateService";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

// Separate Prisma instance used only for test verification/cleanup —
// the service under test creates its own internally.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

// Track every id created during a test so we can clean it up afterward,
// even if an assertion fails partway through.
const createdIds: number[] = [];

afterEach(async () => {
  if (createdIds.length > 0) {
    await prisma.goalTemplate.deleteMany({
      where: { id: { in: createdIds } },
    });
    createdIds.length = 0;
  }
});

describe("createGoalTemplate (end-to-end, real database)", () => {
  it("creates a goal template and persists it to the database", async () => {
    const result = await createGoalTemplate({
      description: "3 pushups",
      rewardRule: [1, 2],
      deadlineRule: [3, 4],
      counters: ["pushups"],
    });
    createdIds.push(result.id);

    // Confirm the returned object looks right
    expect(result.description).toBe("3 pushups");
    expect(result.rewardRule).toEqual([1, 2]);
    expect(result.deadlineRule).toEqual([3, 4]);
    expect(result.counters).toEqual(["pushups"]);
    expect(result.parentId).toBeNull();

    // Confirm it actually landed in the database, independent of what the
    // service returned (guards against the service lying about success)
    const fromDb = await prisma.goalTemplate.findUnique({
      where: { id: result.id },
    });
    expect(fromDb).not.toBeNull();
    expect(fromDb?.description).toBe("3 pushups");
  });

  it("creates a child template linked to a real parent", async () => {
    const parent = await createGoalTemplate({
      description: "parent template",
      rewardRule: [1, 2],
      deadlineRule: [1, 2],
    });
    createdIds.push(parent.id);

    const child = await createGoalTemplate({
      description: "child template",
      rewardRule: [1, 2],
      deadlineRule: [1, 2],
      parentId: parent.id,
    });
    createdIds.push(child.id);

    expect(child.parentId).toBe(parent.id);

    const fromDb = await prisma.goalTemplate.findUnique({
      where: { id: child.id },
    });
    expect(fromDb?.parentId).toBe(parent.id);
  });

  it("rejects a parentId that doesn't exist, without creating anything", async () => {
    await expect(
      createGoalTemplate({
        description: "test",
        rewardRule: [1, 2],
        deadlineRule: [1, 2],
        parentId: 999999999, // essentially guaranteed not to exist
      })
    ).rejects.toThrow("parentId does not reference an existing goal template");

    // Confirm nothing was created despite the failure
    const found = await prisma.goalTemplate.findFirst({
      where: { description: "test" },
    });
    expect(found).toBeNull();
  });
});