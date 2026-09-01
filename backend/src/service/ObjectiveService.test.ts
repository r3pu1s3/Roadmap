import { describe, it, expect, test, vi, beforeEach } from "vitest";
import { createObjective } from "./ObjectiveService";
import prisma from "../lib/__mocks__/prisma";

vi.mock('../lib/prisma')

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

// test('createUser should return the generated user', async () => {
//   const newUser = { description: 'test', isTask: true }
//   prisma.objective.create.mockResolvedValue({ ...newUser, id: 1 }) // 👈🏻 mock the response
//   const user = await createObjective(newUser)
//   expect(user).toStrictEqual({ ...newUser, id: 1 })
// })