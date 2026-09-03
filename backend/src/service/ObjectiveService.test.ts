import { describe, it, expect, vi } from "vitest";
import { createObjective, updateObjective } from "./ObjectiveService";
import prisma from "../lib/prisma";

vi.mock("../lib/prisma");

describe("createObjective", () => {
  // --- description validation ---

  it("throws if description is empty", async () => {
    await expect(
      createObjective({ description: "", isTask: false })
    ).rejects.toThrow("description is required");
  });

  it("throws if description is only whitespace", async () => {
    await expect(
      createObjective({ description: "   ", isTask: false })
    ).rejects.toThrow("description is required");
  });

  it("throws if description exceeds 25 words", async () => {
    const longDescription = Array(26).fill("word").join(" ");
    await expect(
      createObjective({ description: longDescription, isTask: false })
    ).rejects.toThrow("description must be 25 words or fewer (got 26)");
  });

  it("allows description at exactly 25 words", async () => {
    const exactDescription = Array(25).fill("word").join(" ");
    prisma.objective.create.mockResolvedValue({
      id: 1,
      description: exactDescription,
      isTask: false,
    } as any);

    await expect(
      createObjective({ description: exactDescription, isTask: false })
    ).resolves.toBeDefined();
  });

  // --- isTask type validation ---

  it("throws if isTask is not a boolean", async () => {
    await expect(
      createObjective({ description: "test", isTask: "yes" as any })
    ).rejects.toThrow("isTask must be a boolean");
  });

  // --- objective (isTask: false) — no counter parsing should happen ---

  it("creates a plain objective with no counter when isTask is false", async () => {
    const input = { description: "Get stronger", isTask: false };
    prisma.objective.create.mockResolvedValue({ ...input, id: 1 } as any);

    const result = await createObjective(input);

    expect(result).toStrictEqual({ ...input, id: 1 });
    expect(prisma.objective.create).toHaveBeenCalledWith({
      data: {
        description: "Get stronger",
        isTask: false,
        counter: undefined,
      },
      include: { counter: true },
    });
  });

  it("does not attach a counter even if description contains a placeholder, when isTask is false", async () => {
    prisma.objective.create.mockResolvedValue({ id: 1 } as any);

    await createObjective({ description: "Do {pushups} pushups", isTask: false });

    expect(prisma.objective.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ counter: undefined }),
      include: { counter: true },
    });
  });

  // --- task (isTask: true) — counter parsing kicks in ---

  it("throws if isTask is true and description has more than one placeholder", async () => {
    await expect(
      createObjective({
        description: "Do {pushups} pushups and {situps} situps",
        isTask: true,
      })
    ).rejects.toThrow(
      "There should only be one counter for each objective. Break down the goal if you need to."
    );

    expect(prisma.objective.create).not.toHaveBeenCalled();
  });

  it("creates a task with a nested counter when exactly one placeholder is found", async () => {
    const input = { description: "Do {pushups} pushups", isTask: true };
    prisma.objective.create.mockResolvedValue({
      ...input,
      id: 1,
      counter: { id: 1, label: "pushups", targetQuantity: null },
    } as any);

    await createObjective(input);

    expect(prisma.objective.create).toHaveBeenCalledWith({
      data: {
        description: "Do {pushups} pushups",
        isTask: true,
        counter: {
          create: {
            label: "pushups",
            targetQuantity: null,
          },
        },
      },
      include: { counter: true },
    });
  });

  it("creates a task with no counter attached when isTask is true but no placeholder is found", async () => {
    prisma.objective.create.mockResolvedValue({ id: 1, isTask: true, counter: null } as any);

    await createObjective({ description: "Just get it done", isTask: true });

    expect(prisma.objective.create).toHaveBeenCalledWith({
      data: {
        description: "Just get it done",
        isTask: true,
        counter: undefined,
      },
      include: { counter: true },
    });
  });

  it("deduplicates a repeated placeholder into a single counter", async () => {
    prisma.objective.create.mockResolvedValue({ id: 1 } as any);

    await createObjective({
      description: "Do {reps} reps, then do {reps} more reps",
      isTask: true,
    });

    expect(prisma.objective.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        counter: { create: { label: "reps", targetQuantity: null } },
      }),
      include: { counter: true },
    });
  });

  // --- happy path: return value passthrough ---

  it("should create a single objective", async () => {
    const input = { description: "test", isTask: true };
    prisma.objective.create.mockResolvedValue({ ...input, id: 1 } as any);

    const node = await createObjective(input);

    expect(node).toStrictEqual({ ...input, id: 1 });
  });
});

describe("updateObjective", () => {
  // --- existence check ---

  it("throws 'objective not found' if the objective does not exist", async () => {
    prisma.objective.findUnique.mockResolvedValue(null);

    await expect(
      updateObjective({ id: 999, description: "test", isTask: false })
    ).rejects.toThrow("objective not found");

    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  // --- same validation as createObjective ---

  it("throws if description is empty", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
    } as any);

    await expect(
      updateObjective({ id: 1, description: "", isTask: false })
    ).rejects.toThrow("description is required");
  });

  it("throws if description is only whitespace", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
    } as any);

    await expect(
      updateObjective({ id: 1, description: "   ", isTask: false })
    ).rejects.toThrow("description is required");
  });

  it("throws if description exceeds 25 words", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
    } as any);
    const longDescription = Array(26).fill("word").join(" ");

    await expect(
      updateObjective({ id: 1, description: longDescription, isTask: false })
    ).rejects.toThrow("description must be 25 words or fewer (got 26)");
  });

  it("throws if isTask is not a boolean", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
    } as any);

    await expect(
      updateObjective({ id: 1, description: "test", isTask: "yes" as any })
    ).rejects.toThrow("isTask must be a boolean");
  });

  it("throws if isTask is true and description has more than one placeholder", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: true,
      counter: null,
    } as any);

    await expect(
      updateObjective({
        id: 1,
        description: "Do {pushups} pushups and {situps} situps",
        isTask: true,
      })
    ).rejects.toThrow(
      "There should only be one counter for each objective. Break down the goal if you need to."
    );

    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  // --- counter reconciliation: no existing counter, new label found ---

  it("creates a new counter when isTask becomes true with a placeholder and none existed before", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old description",
      isTask: false,
      counter: null,
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await updateObjective({
      id: 1,
      description: "Do {pushups} pushups",
      isTask: true,
    });

    expect(prisma.objective.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        description: "Do {pushups} pushups",
        isTask: true,
        counter: { create: { label: "pushups", targetQuantity: null } },
      },
      include: { counter: true },
    });
  });

  // --- counter reconciliation: label changed, existing counter reset ---

  it("resets targetQuantity to null when the placeholder label changes", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "Do {pushups} pushups",
      isTask: true,
      counter: { id: 1, label: "pushups", targetQuantity: 3 },
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await updateObjective({
      id: 1,
      description: "Do {situps} situps",
      isTask: true,
    });

    expect(prisma.objective.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        description: "Do {situps} situps",
        isTask: true,
        counter: { update: { label: "situps", targetQuantity: null } },
      },
      include: { counter: true },
    });
  });

  // --- counter reconciliation: label unchanged, leave counter untouched ---

  it("leaves the counter untouched when the placeholder label is unchanged", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "Do {pushups} pushups",
      isTask: true,
      counter: { id: 1, label: "pushups", targetQuantity: 3 },
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await updateObjective({
      id: 1,
      description: "Please do {pushups} pushups daily",
      isTask: true,
    });

    expect(prisma.objective.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        description: "Please do {pushups} pushups daily",
        isTask: true,
        counter: undefined, // no change — existing targetQuantity preserved as-is
      },
      include: { counter: true },
    });
  });

  // --- counter reconciliation: isTask flips to false, existing counter deleted ---

  it("deletes the existing counter when isTask changes to false", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "Do {pushups} pushups",
      isTask: true,
      counter: { id: 1, label: "pushups", targetQuantity: 3 },
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await updateObjective({
      id: 1,
      description: "Get stronger overall",
      isTask: false,
    });

    expect(prisma.objective.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        description: "Get stronger overall",
        isTask: false,
        counter: { delete: true },
      },
      include: { counter: true },
    });
  });

  // --- counter reconciliation: placeholder removed from description, counter deleted ---

  it("deletes the existing counter when the placeholder is removed from the description", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "Do {pushups} pushups",
      isTask: true,
      counter: { id: 1, label: "pushups", targetQuantity: 3 },
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await updateObjective({
      id: 1,
      description: "Just get it done",
      isTask: true,
    });

    expect(prisma.objective.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        description: "Just get it done",
        isTask: true,
        counter: { delete: true },
      },
      include: { counter: true },
    });
  });

  // --- counter reconciliation: no counter existed, no label found — no-op ---

  it("does nothing to the counter when there was none before and still no placeholder", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "Just get it done",
      isTask: true,
      counter: null,
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await updateObjective({
      id: 1,
      description: "Still just get it done",
      isTask: true,
    });

    expect(prisma.objective.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        description: "Still just get it done",
        isTask: true,
        counter: undefined,
      },
      include: { counter: true },
    });
  });

  // --- happy path: return value passthrough ---

  it("returns whatever prisma.objective.update resolves with", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
    } as any);
    const updated = { id: 1, description: "new description", isTask: false, counter: null };
    prisma.objective.update.mockResolvedValue(updated as any);

    const result = await updateObjective({ id: 1, description: "new description", isTask: false });

    expect(result).toStrictEqual(updated);
  });
});