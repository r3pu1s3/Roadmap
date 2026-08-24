import { describe, it, expect, afterEach } from "vitest";
import { createGoalNode } from "./GoalNodeService";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const createdIds: number[] = [];

// Helper: a deadline guaranteed to be in the future
function futureDate(daysFromNow = 30): Date {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000);
}

afterEach(async () => {
  if (createdIds.length > 0) {
    await prisma.goalCounter.deleteMany({
      where: { goalNodeId: { in: createdIds } },
    });
    await prisma.goalNode.deleteMany({
      where: { id: { in: createdIds } },
    });
    createdIds.length = 0;
  }
});

describe("createGoalNode (end-to-end, real database)", () => {
  it("creates a goal node with an explicit deadline and completed value", async () => {
    const deadline = futureDate();

    const result = await createGoalNode({
      description: "3 pushups",
      rewardRule: [1, 2],
      deadlineRule: [3, 4],
      deadline,
      completed: false,
      counters: [{ label: "pushups", targetQuantity: 3 }],
    });
    createdIds.push(result.id);

    expect(result.description).toBe("3 pushups");
    expect(result.rewardRule).toEqual([1, 2]);
    expect(result.deadlineRule).toEqual([3, 4]);
    expect(result.completed).toBe(false);
    expect(result.deadline).toEqual(deadline);
    expect(result.parentId).toBeNull();

    const fromDb = await prisma.goalNode.findUnique({
      where: { id: result.id },
      include: { counters: true },
    });
    expect(fromDb).not.toBeNull();
    expect(fromDb?.completed).toBe(false);
    expect(fromDb?.deadline).toEqual(deadline);
    expect(fromDb?.counters).toHaveLength(1);
    expect(fromDb?.counters[0]).toMatchObject({ label: "pushups", targetQuantity: 3 });
  });

  it("defaults completed to false when not provided", async () => {
    const result = await createGoalNode({
      description: "default completion test",
      rewardRule: [1, 2],
      deadlineRule: [1, 2],
      deadline: futureDate(),
      // completed intentionally omitted
    });
    createdIds.push(result.id);

    expect(result.completed).toBe(false);
  });

  it("allows completed to be explicitly set to true", async () => {
    const result = await createGoalNode({
      description: "already done",
      rewardRule: [1, 2],
      deadlineRule: [1, 2],
      deadline: futureDate(),
      completed: true,
    });
    createdIds.push(result.id);

    expect(result.completed).toBe(true);
  });

  it("throws if deadline is missing", async () => {
    await expect(
      createGoalNode({
        description: "no deadline",
        rewardRule: [1, 2],
        deadlineRule: [1, 2],
      } as any)
    ).rejects.toThrow("deadline is required");
  });

  it("throws if deadline is not a valid date", async () => {
    await expect(
      createGoalNode({
        description: "bad deadline",
        rewardRule: [1, 2],
        deadlineRule: [1, 2],
        deadline: new Date("not-a-real-date"),
      })
    ).rejects.toThrow("deadline must be a valid date");
  });

  it("throws if deadline is in the past", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // yesterday

    await expect(
      createGoalNode({
        description: "past deadline",
        rewardRule: [1, 2],
        deadlineRule: [1, 2],
        deadline: pastDate,
      })
    ).rejects.toThrow("deadline must be in the present or future, not the past");

    const found = await prisma.goalNode.findFirst({
      where: { description: "past deadline" },
    });
    expect(found).toBeNull();
  });

  it("throws if completed is provided but not a boolean", async () => {
    await expect(
      createGoalNode({
        description: "bad completed type",
        rewardRule: [1, 2],
        deadlineRule: [1, 2],
        deadline: futureDate(),
        completed: "yes" as any,
      })
    ).rejects.toThrow("completed must be a boolean");
  });

  it("creates a node with multiple counters, each with correct label and targetQuantity", async () => {
    const result = await createGoalNode({
      description: "multi-counter node",
      rewardRule: [1, 2],
      deadlineRule: [1, 2],
      deadline: futureDate(),
      counters: [
        { label: "pushups", targetQuantity: 3 },
        { label: "writeups", targetQuantity: 2 },
      ],
    });
    createdIds.push(result.id);

    const fromDb = await prisma.goalNode.findUnique({
      where: { id: result.id },
      include: { counters: true },
    });
    expect(fromDb?.counters).toHaveLength(2);
    expect(fromDb?.counters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "pushups", targetQuantity: 3 }),
        expect.objectContaining({ label: "writeups", targetQuantity: 2 }),
      ])
    );
  });

  it("throws if more than 3 counters are provided, and creates nothing", async () => {
    await expect(
      createGoalNode({
        description: "too many counters",
        rewardRule: [1, 2],
        deadlineRule: [1, 2],
        deadline: futureDate(),
        counters: [
          { label: "a", targetQuantity: 1 },
          { label: "b", targetQuantity: 1 },
          { label: "c", targetQuantity: 1 },
          { label: "d", targetQuantity: 1 },
        ],
      })
    ).rejects.toThrow("at most 3 counters");

    const found = await prisma.goalNode.findFirst({
      where: { description: "too many counters" },
    });
    expect(found).toBeNull();
  });

  it("throws if a counter has a non-positive targetQuantity", async () => {
    await expect(
      createGoalNode({
        description: "bad counter quantity",
        rewardRule: [1, 2],
        deadlineRule: [1, 2],
        deadline: futureDate(),
        counters: [{ label: "pushups", targetQuantity: 0 }],
      })
    ).rejects.toThrow("targetQuantity must be a positive number");
  });

  it("creates a child node linked to a real parent", async () => {
    const parent = await createGoalNode({
      description: "parent node",
      rewardRule: [1, 2],
      deadlineRule: [1, 2],
      deadline: futureDate(),
    });
    createdIds.push(parent.id);

    const child = await createGoalNode({
      description: "child node",
      rewardRule: [1, 2],
      deadlineRule: [1, 2],
      deadline: futureDate(),
      parentId: parent.id,
    });
    createdIds.push(child.id);

    expect(child.parentId).toBe(parent.id);

    const fromDb = await prisma.goalNode.findUnique({ where: { id: child.id } });
    expect(fromDb?.parentId).toBe(parent.id);
  });

  it("rejects a parentId that doesn't exist, without creating anything", async () => {
    await expect(
      createGoalNode({
        description: "test",
        rewardRule: [1, 2],
        deadlineRule: [1, 2],
        deadline: futureDate(),
        parentId: 999999999,
      })
    ).rejects.toThrow("parentId does not reference an existing goal node");

    const found = await prisma.goalNode.findFirst({ where: { description: "test" } });
    expect(found).toBeNull();
  });
});