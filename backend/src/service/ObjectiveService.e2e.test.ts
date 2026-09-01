import { describe, it, expect, afterEach } from "vitest";
import { createObjective } from "./ObjectiveService";
import prisma from "../lib/prisma";

// Track every id created during a test so we can clean it up afterward.
// Deleting the Objective is enough — ObjectiveCounter has onDelete: Cascade
// pointing back at Objective, so its counter row is removed automatically.
const createdIds: number[] = [];

afterEach(async () => {
  if (createdIds.length > 0) {
    await prisma.objective.deleteMany({
      where: { id: { in: createdIds } },
    });
    createdIds.length = 0;
  }
});

describe("createObjective (end-to-end, real database)", () => {
  it("creates a plain objective with no counter when isTask is false", async () => {
    const result = await createObjective({
      description: "Get stronger this year",
      isTask: false,
    });
    createdIds.push(result.id);

    expect(result.description).toBe("Get stronger this year");
    expect(result.isTask).toBe(false);

    const fromDb = await prisma.objective.findUnique({
      where: { id: result.id },
      include: { counter: true },
    });
    expect(fromDb).not.toBeNull();
    expect(fromDb?.counter).toBeNull();
  });

  it("creates a task with a nested counter, targetQuantity starting null", async () => {
    const result = await createObjective({
      description: "Do {pushups} pushups every morning",
      isTask: true,
    });
    createdIds.push(result.id);

    expect(result.isTask).toBe(true);
    expect(result.counter).toMatchObject({
      label: "pushups",
      targetQuantity: null,
    });

    // Confirm it actually landed in the database, independent of what the
    // service returned.
    const fromDb = await prisma.objective.findUnique({
      where: { id: result.id },
      include: { counter: true },
    });
    expect(fromDb?.counter).not.toBeNull();
    expect(fromDb?.counter?.label).toBe("pushups");
    expect(fromDb?.counter?.targetQuantity).toBeNull();
  });

  it("creates a task with no counter when the description has no placeholder", async () => {
    const result = await createObjective({
      description: "Just get it done",
      isTask: true,
    });
    createdIds.push(result.id);

    expect(result.counter).toBeNull();

    const fromDb = await prisma.objective.findUnique({
      where: { id: result.id },
      include: { counter: true },
    });
    expect(fromDb?.counter).toBeNull();
  });

  it("deduplicates a repeated placeholder into a single counter row", async () => {
    const result = await createObjective({
      description: "Do {reps} reps, then do {reps} more reps",
      isTask: true,
    });
    createdIds.push(result.id);

    expect(result.counter?.label).toBe("reps");

    // Confirm there is exactly one counter row for this objective, not two.
    const counters = await prisma.objectiveCounter.findMany({
      where: { objectiveId: result.id },
    });
    expect(counters).toHaveLength(1);
  });

  it("rejects a description with more than one placeholder and creates nothing", async () => {
    await expect(
      createObjective({
        description: "Do {pushups} pushups and {situps} situps",
        isTask: true,
      })
    ).rejects.toThrow(
      "There should only be one counter for each objective. Break down the goal if you need to."
    );

    const found = await prisma.objective.findFirst({
      where: { description: "Do {pushups} pushups and {situps} situps" },
    });
    expect(found).toBeNull();
  });

  it("rejects an empty description and creates nothing", async () => {
    await expect(
      createObjective({ description: "", isTask: false })
    ).rejects.toThrow("description is required");
  });

  it("rejects a description over the word limit and creates nothing", async () => {
    const longDescription = Array(26).fill("word").join(" ");

    await expect(
      createObjective({ description: longDescription, isTask: false })
    ).rejects.toThrow("description must be 25 words or fewer (got 26)");

    const found = await prisma.objective.findFirst({
      where: { description: longDescription },
    });
    expect(found).toBeNull();
  });

  it("enforces at most one counter per objective at the database level", async () => {
    const result = await createObjective({
      description: "Do {pushups} pushups",
      isTask: true,
    });
    createdIds.push(result.id);

    // Attempting to attach a second counter directly to the same
    // objective should violate the @unique constraint on objectiveId.
    await expect(
      prisma.objectiveCounter.create({
        data: {
          label: "extra",
          targetQuantity: null,
          objectiveId: result.id,
        },
      })
    ).rejects.toThrow();
  });
});