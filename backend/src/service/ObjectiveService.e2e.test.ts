import { describe, it, expect, afterEach } from "vitest";
import { createObjective, updateObjective } from "./ObjectiveService";
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

  it("enforces at most one counter per objective at the database level", async () => {
    const result = await createObjective({
      description: "Do {pushups} pushups",
      isTask: true,
    });
    createdIds.push(result.id);

    await expect(
      prisma.objectiveCounter.create({
        data: { label: "extra", targetQuantity: null, objectiveId: result.id },
      })
    ).rejects.toThrow();
  });
});

describe("updateObjective (end-to-end, real database)", () => {
  it("throws 'objective not found' for a nonexistent id, without touching the database", async () => {
    await expect(
      updateObjective({ id: 999999999, description: "test", isTask: false })
    ).rejects.toThrow("objective not found");
  });

  it("updates a plain objective's description", async () => {
    const created = await createObjective({ description: "Old description", isTask: false });
    createdIds.push(created.id);

    const updated = await updateObjective({
      id: created.id,
      description: "New description",
      isTask: false,
    });

    expect(updated.description).toBe("New description");

    const fromDb = await prisma.objective.findUnique({ where: { id: created.id } });
    expect(fromDb?.description).toBe("New description");
  });

  it("rejects an update with an empty description and leaves the objective unchanged", async () => {
    const created = await createObjective({ description: "Original", isTask: false });
    createdIds.push(created.id);

    await expect(
      updateObjective({ id: created.id, description: "", isTask: false })
    ).rejects.toThrow("description is required");

    const fromDb = await prisma.objective.findUnique({ where: { id: created.id } });
    expect(fromDb?.description).toBe("Original");
  });

  it("rejects an update where the description has more than one placeholder", async () => {
    const created = await createObjective({ description: "Do {pushups} pushups", isTask: true });
    createdIds.push(created.id);

    await expect(
      updateObjective({
        id: created.id,
        description: "Do {pushups} pushups and {situps} situps",
        isTask: true,
      })
    ).rejects.toThrow(
      "There should only be one counter for each objective. Break down the goal if you need to."
    );
  });

  it("creates a new counter when a plain objective becomes a task with a placeholder", async () => {
    const created = await createObjective({ description: "Get stronger", isTask: false });
    createdIds.push(created.id);
    expect(created.counter).toBeNull();

    const updated = await updateObjective({
      id: created.id,
      description: "Do {pushups} pushups",
      isTask: true,
    });

    expect(updated.counter).toMatchObject({ label: "pushups", targetQuantity: null });

    const fromDb = await prisma.objective.findUnique({
      where: { id: created.id },
      include: { counter: true },
    });
    expect(fromDb?.counter?.label).toBe("pushups");
  });

  // it("resets targetQuantity to null when the placeholder label changes", async () => {
  //   const created = await createObjective({ description: "Do {pushups} pushups", isTask: true });
  //   createdIds.push(created.id);

  //   // Manually set a target quantity directly, since the API doesn't
  //   // expose setting it yet — simulates a counter that already has a
  //   // real value before the label changes underneath it.
  //   await prisma.objectiveCounter.update({
  //     where: { objectiveId: created.id },
  //     data: { targetQuantity: 5 },
  //   });

  //   const updated = await updateObjective({
  //     id: created.id,
  //     description: "Do {situps} situps",
  //     isTask: true,
  //   });

  //   expect(updated.counter).toMatchObject({ label: "situps", targetQuantity: null });

  //   const fromDb = await prisma.objective.findUnique({
  //     where: { id: created.id },
  //     include: { counter: true },
  //   });
  //   expect(fromDb?.counter?.label).toBe("situps");
  //   expect(fromDb?.counter?.targetQuantity).toBeNull();
  // });

  // it("leaves an existing targetQuantity untouched when the placeholder label is unchanged", async () => {
  //   const created = await createObjective({ description: "Do {pushups} pushups", isTask: true });
  //   createdIds.push(created.id);

  //   await prisma.objectiveCounter.update({
  //     where: { objectiveId: created.id },
  //     data: { targetQuantity: 5 },
  //   });

  //   const updated = await updateObjective({
  //     id: created.id,
  //     description: "Please do {pushups} pushups daily",
  //     isTask: true,
  //   });

  //   expect(updated.counter).toMatchObject({ label: "pushups", targetQuantity: 5 });
  // });

  // it("deletes the existing counter when isTask changes to false", async () => {
  //   const created = await createObjective({ description: "Do {pushups} pushups", isTask: true });
  //   createdIds.push(created.id);
  //   expect(created.counter).not.toBeNull();

  //   const updated = await updateObjective({
  //     id: created.id,
  //     description: "Get stronger overall",
  //     isTask: false,
  //   });

  //   expect(updated.counter).toBeNull();

  //   const remaining = await prisma.objectiveCounter.findFirst({
  //     where: { objectiveId: created.id },
  //   });
  //   expect(remaining).toBeNull();
  // });

  // it("deletes the existing counter when the placeholder is removed from the description", async () => {
  //   const created = await createObjective({ description: "Do {pushups} pushups", isTask: true });
  //   createdIds.push(created.id);

  //   const updated = await updateObjective({
  //     id: created.id,
  //     description: "Just get it done",
  //     isTask: true,
  //   });

  //   expect(updated.counter).toBeNull();

  //   const remaining = await prisma.objectiveCounter.findFirst({
  //     where: { objectiveId: created.id },
  //   });
  //   expect(remaining).toBeNull();
  // });

  it("deduplicates a repeated placeholder into a single counter row on update", async () => {
    const created = await createObjective({ description: "Get stronger", isTask: false });
    createdIds.push(created.id);

    const updated = await updateObjective({
      id: created.id,
      description: "Do {reps} reps, then do {reps} more reps",
      isTask: true,
    });

    expect(updated.counter?.label).toBe("reps");

    const counters = await prisma.objectiveCounter.findMany({
      where: { objectiveId: created.id },
    });
    expect(counters).toHaveLength(1);
  });
});