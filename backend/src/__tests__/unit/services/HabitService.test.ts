/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import {
  getHabits,
  createHabit,
  getHabit,
  updateHabit,
  deleteHabit,
} from "../../../services/HabitService";
import prisma from "../../../lib/prisma";

vi.mock("../../../lib/prisma");

const savedHabit = {
  id: 1,
  name: "Run",
  description: null,
  durationMinutes: 30,
};

describe("createHabit", () => {
  // --- name ---

  it("throws if name is missing", async () => {
    await expect(createHabit({ durationMinutes: 30 } as any)).rejects.toThrow(
      "name is required",
    );
  });

  it("throws if name is null", async () => {
    await expect(
      createHabit({ name: null, durationMinutes: 30 }),
    ).rejects.toThrow("name is required");
  });

  it("throws if name is not a string", async () => {
    await expect(
      createHabit({ name: 42, durationMinutes: 30 }),
    ).rejects.toThrow("name must be a string");
  });

  it("throws if name is empty", async () => {
    await expect(
      createHabit({ name: "", durationMinutes: 30 }),
    ).rejects.toThrow("name is required");
  });

  it("throws if name is only whitespace", async () => {
    await expect(
      createHabit({ name: "   ", durationMinutes: 30 }),
    ).rejects.toThrow("name is required");
  });

  it("throws if name exceeds 100 characters", async () => {
    await expect(
      createHabit({ name: "a".repeat(101), durationMinutes: 30 }),
    ).rejects.toThrow("name must be 100 characters or fewer (got 101)");
  });

  it("allows a name of exactly 100 characters", async () => {
    prisma.habit.create.mockResolvedValue(savedHabit as any);

    await expect(
      createHabit({ name: "a".repeat(100), durationMinutes: 30 }),
    ).resolves.toBeDefined();
  });

  it("trims the name before saving", async () => {
    prisma.habit.create.mockResolvedValue(savedHabit as any);

    await createHabit({ name: "  Run  ", durationMinutes: 30 });

    expect(prisma.habit.create).toHaveBeenCalledWith({
      data: { name: "Run", description: null, durationMinutes: 30 },
    });
  });

  // --- description ---

  it("saves an omitted description as null", async () => {
    prisma.habit.create.mockResolvedValue(savedHabit as any);

    await createHabit({ name: "Run", durationMinutes: 30 });

    expect(prisma.habit.create).toHaveBeenCalledWith({
      data: { name: "Run", description: null, durationMinutes: 30 },
    });
  });

  it("saves a null description as null", async () => {
    prisma.habit.create.mockResolvedValue(savedHabit as any);

    await createHabit({ name: "Run", description: null, durationMinutes: 30 });

    expect(prisma.habit.create).toHaveBeenCalledWith({
      data: { name: "Run", description: null, durationMinutes: 30 },
    });
  });

  it("saves a whitespace-only description as null", async () => {
    prisma.habit.create.mockResolvedValue(savedHabit as any);

    await createHabit({ name: "Run", description: "   ", durationMinutes: 30 });

    expect(prisma.habit.create).toHaveBeenCalledWith({
      data: { name: "Run", description: null, durationMinutes: 30 },
    });
  });

  it("throws if description is not a string", async () => {
    await expect(
      createHabit({ name: "Run", description: 42, durationMinutes: 30 }),
    ).rejects.toThrow("description must be a string");
  });

  it("throws if description exceeds 280 characters", async () => {
    await expect(
      createHabit({
        name: "Run",
        description: "a".repeat(281),
        durationMinutes: 30,
      }),
    ).rejects.toThrow("description must be 280 characters or fewer (got 281)");
  });

  it("allows a description of exactly 280 characters", async () => {
    prisma.habit.create.mockResolvedValue(savedHabit as any);

    await expect(
      createHabit({
        name: "Run",
        description: "a".repeat(280),
        durationMinutes: 30,
      }),
    ).resolves.toBeDefined();
  });

  it("trims the description before saving", async () => {
    prisma.habit.create.mockResolvedValue(savedHabit as any);

    await createHabit({
      name: "Run",
      description: "  Easy pace  ",
      durationMinutes: 30,
    });

    expect(prisma.habit.create).toHaveBeenCalledWith({
      data: { name: "Run", description: "Easy pace", durationMinutes: 30 },
    });
  });

  // --- durationMinutes ---

  it("throws if durationMinutes is missing", async () => {
    await expect(createHabit({ name: "Run" } as any)).rejects.toThrow(
      "durationMinutes is required",
    );
  });

  it("throws if durationMinutes is null", async () => {
    await expect(
      createHabit({ name: "Run", durationMinutes: null }),
    ).rejects.toThrow("durationMinutes is required");
  });

  it.each([
    ["a numeric string", "30"],
    ["a fraction", 1.5],
    ["NaN", NaN],
  ])("throws if durationMinutes is %s", async (_label, value) => {
    await expect(
      createHabit({ name: "Run", durationMinutes: value }),
    ).rejects.toThrow("durationMinutes must be a whole number");
  });

  it.each([0, -5, 1441])(
    "throws if durationMinutes is %s (outside 1–1440)",
    async (value) => {
      await expect(
        createHabit({ name: "Run", durationMinutes: value }),
      ).rejects.toThrow("durationMinutes must be between 1 and 1440");
    },
  );

  it.each([1, 1440])("allows durationMinutes of %s", async (value) => {
    prisma.habit.create.mockResolvedValue(savedHabit as any);

    await expect(
      createHabit({ name: "Run", durationMinutes: value }),
    ).resolves.toBeDefined();
  });

  // --- check order / no write on failure ---

  it("reports the name error first when name and durationMinutes are both invalid", async () => {
    await expect(createHabit({ name: "", durationMinutes: 0 })).rejects.toThrow(
      "name is required",
    );
  });

  it("does not call prisma.habit.create when validation fails", async () => {
    await expect(
      createHabit({ name: "Run", durationMinutes: 0 }),
    ).rejects.toThrow();

    expect(prisma.habit.create).not.toHaveBeenCalled();
  });

  it("returns the created habit", async () => {
    prisma.habit.create.mockResolvedValue(savedHabit as any);

    await expect(
      createHabit({ name: "Run", durationMinutes: 30 }),
    ).resolves.toEqual(savedHabit);
  });
});

describe("getHabits", () => {
  it("calls prisma.habit.findMany with orderBy: { id: 'asc' }", async () => {
    prisma.habit.findMany.mockResolvedValue([]);

    await getHabits();

    expect(prisma.habit.findMany).toHaveBeenCalledWith({
      orderBy: { id: "asc" },
    });
  });

  it("sorts by name ignoring case, keeping same-name habits in id (creation) order", async () => {
    prisma.habit.findMany.mockResolvedValue([
      { id: 1, name: "banana", description: null, durationMinutes: 30 },
      { id: 2, name: "Apple", description: null, durationMinutes: 15 },
      { id: 3, name: "apple", description: null, durationMinutes: 45 },
    ] as any);

    const result = await getHabits();

    expect(result.map((h) => h.id)).toEqual([2, 3, 1]);
  });

  it("returns an empty array when there are no habits", async () => {
    prisma.habit.findMany.mockResolvedValue([]);

    await expect(getHabits()).resolves.toEqual([]);
  });
});

describe("getHabit", () => {
  it("throws if id is not an integer", async () => {
    await expect(getHabit(NaN)).rejects.toThrow("id must be a valid integer");
  });

  it("throws if the habit does not exist", async () => {
    prisma.habit.findUnique.mockResolvedValue(null);

    await expect(getHabit(7)).rejects.toThrow("habit not found");
    expect(prisma.habit.findUnique).toHaveBeenCalledWith({ where: { id: 7 } });
  });

  it("returns the habit", async () => {
    prisma.habit.findUnique.mockResolvedValue(savedHabit as any);

    await expect(getHabit(1)).resolves.toEqual(savedHabit);
  });
});

describe("updateHabit", () => {
  it("throws if id is not an integer", async () => {
    await expect(updateHabit({ id: 1.5, name: "Run" })).rejects.toThrow(
      "id must be a valid integer",
    );
    expect(prisma.habit.findUnique).not.toHaveBeenCalled();
  });

  it("throws 'habit not found' before checking fields", async () => {
    prisma.habit.findUnique.mockResolvedValue(null);

    await expect(updateHabit({ id: 7, name: "" })).rejects.toThrow(
      "habit not found",
    );
    expect(prisma.habit.update).not.toHaveBeenCalled();
  });

  it("updates only the fields that are present", async () => {
    prisma.habit.findUnique.mockResolvedValue(savedHabit as any);
    prisma.habit.update.mockResolvedValue({
      ...savedHabit,
      durationMinutes: 45,
    } as any);

    await updateHabit({ id: 1, durationMinutes: 45 });

    expect(prisma.habit.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { durationMinutes: 45 },
    });
  });

  it("trims and saves every field when all are present", async () => {
    prisma.habit.findUnique.mockResolvedValue(savedHabit as any);
    prisma.habit.update.mockResolvedValue(savedHabit as any);

    await updateHabit({
      id: 1,
      name: "  Evening run  ",
      description: "  Slow  ",
      durationMinutes: 45,
    });

    expect(prisma.habit.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: "Evening run", description: "Slow", durationMinutes: 45 },
    });
  });

  it.each([
    ["null", null],
    ["whitespace-only", "  "],
  ])("clears the description when it is %s", async (_label, value) => {
    prisma.habit.findUnique.mockResolvedValue(savedHabit as any);
    prisma.habit.update.mockResolvedValue(savedHabit as any);

    await updateHabit({ id: 1, description: value });

    expect(prisma.habit.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { description: null },
    });
  });

  it.each([
    [{ name: "" }, "name is required"],
    [{ name: 42 }, "name must be a string"],
    [
      { name: "a".repeat(101) },
      "name must be 100 characters or fewer (got 101)",
    ],
    [{ description: 42 }, "description must be a string"],
    [
      { description: "a".repeat(281) },
      "description must be 280 characters or fewer (got 281)",
    ],
    [{ durationMinutes: null }, "durationMinutes is required"],
    [{ durationMinutes: "30" }, "durationMinutes must be a whole number"],
    [{ durationMinutes: 0 }, "durationMinutes must be between 1 and 1440"],
    [{ durationMinutes: 1441 }, "durationMinutes must be between 1 and 1440"],
  ])(
    "rejects an invalid present field %j with the create message",
    async (fields, message) => {
      prisma.habit.findUnique.mockResolvedValue(savedHabit as any);

      await expect(updateHabit({ id: 1, ...fields })).rejects.toThrow(message);
      expect(prisma.habit.update).not.toHaveBeenCalled();
    },
  );

  it("treats an empty body as a no-op update and returns the habit", async () => {
    prisma.habit.findUnique.mockResolvedValue(savedHabit as any);
    prisma.habit.update.mockResolvedValue(savedHabit as any);

    await expect(updateHabit({ id: 1 })).resolves.toEqual(savedHabit);
    expect(prisma.habit.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {},
    });
  });
});

describe("deleteHabit", () => {
  it("throws if id is not an integer", async () => {
    await expect(deleteHabit(NaN)).rejects.toThrow(
      "id must be a valid integer",
    );
    expect(prisma.habit.delete).not.toHaveBeenCalled();
  });

  it("throws 'habit not found' and deletes nothing when the habit is missing", async () => {
    prisma.habit.findUnique.mockResolvedValue(null);

    await expect(deleteHabit(7)).rejects.toThrow("habit not found");
    expect(prisma.habit.delete).not.toHaveBeenCalled();
  });

  it("deletes by id and returns the deleted habit", async () => {
    prisma.habit.findUnique.mockResolvedValue(savedHabit as any);
    prisma.habit.delete.mockResolvedValue(savedHabit as any);

    await expect(deleteHabit(1)).resolves.toEqual(savedHabit);
    expect(prisma.habit.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });
});
