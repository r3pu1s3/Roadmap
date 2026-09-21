/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import {
  createMap,
  updateMap,
  getMaps,
  getMap,
} from "../../../services/MapService";
import prisma from "../../../lib/prisma";

vi.mock("../../../lib/prisma");

describe("createMap", () => {
  // --- name validation ---

  it("throws if name is empty", async () => {
    await expect(
      createMap({ name: "", type: "Project" as any }),
    ).rejects.toThrow("name is required");
  });

  it("throws if name is only whitespace", async () => {
    await expect(
      createMap({ name: "   ", type: "Project" as any }),
    ).rejects.toThrow("name is required");
  });

  it("throws if name exceeds 10 words", async () => {
    const longName = Array(11).fill("word").join(" ");
    await expect(
      createMap({ name: longName, type: "Project" as any }),
    ).rejects.toThrow("name must be 10 words or fewer (got 11)");
  });

  it("allows name at exactly 10 words", async () => {
    const exactName = Array(10).fill("word").join(" ");
    prisma.map.create.mockResolvedValue({
      id: 1,
      name: exactName,
      type: "Project",
    } as any);

    await expect(
      createMap({ name: exactName, type: "Project" as any }),
    ).resolves.toBeDefined();
  });

  it("trims leading/trailing whitespace before persisting, regardless of word count", async () => {
    prisma.map.create.mockResolvedValue({
      id: 1,
      name: "Fitness Plan",
      type: "Project",
    } as any);

    await createMap({ name: "  Fitness Plan  ", type: "Project" as any });

    expect(prisma.map.create).toHaveBeenCalledWith({
      data: { name: "Fitness Plan", type: "Project" },
    });
  });

  // --- type validation ---

  it("throws if type is invalid", async () => {
    await expect(
      createMap({ name: "Valid Name", type: "Invalid" as any }),
    ).rejects.toThrow("type must be one of: Project, Habit");
  });

  it("throws if type is missing", async () => {
    await expect(
      createMap({ name: "Valid Name", type: undefined as any }),
    ).rejects.toThrow("type must be one of: Project, Habit");
  });

  // --- happy path ---

  it("creates a map with type Project", async () => {
    prisma.map.create.mockResolvedValue({
      id: 1,
      name: "My Project",
      type: "Project",
    } as any);

    await createMap({ name: "My Project", type: "Project" as any });

    expect(prisma.map.create).toHaveBeenCalledWith({
      data: { name: "My Project", type: "Project" },
    });
  });

  it("creates a map with type Habit", async () => {
    prisma.map.create.mockResolvedValue({
      id: 2,
      name: "My Habit",
      type: "Habit",
    } as any);

    await createMap({ name: "My Habit", type: "Habit" as any });

    expect(prisma.map.create).toHaveBeenCalledWith({
      data: { name: "My Habit", type: "Habit" },
    });
  });

  it("returns exactly what prisma.map.create resolves to", async () => {
    const created = { id: 5, name: "My Map", type: "Project" };
    prisma.map.create.mockResolvedValue(created as any);

    const result = await createMap({ name: "My Map", type: "Project" as any });

    expect(result).toStrictEqual(created);
  });
});

describe("updateMap", () => {
  // --- existence check ---

  it("throws 'map not found' when the map does not exist", async () => {
    prisma.map.findUnique.mockResolvedValue(null);

    await expect(updateMap({ id: 999, name: "New Name" })).rejects.toThrow(
      "map not found",
    );

    expect(prisma.map.update).not.toHaveBeenCalled();
  });

  // --- same name validation as createMap, via the shared helper ---

  it("throws if name is empty", async () => {
    prisma.map.findUnique.mockResolvedValue({
      id: 1,
      name: "old",
      type: "Project",
    } as any);

    await expect(updateMap({ id: 1, name: "" })).rejects.toThrow(
      "name is required",
    );
  });

  it("throws if name is only whitespace", async () => {
    prisma.map.findUnique.mockResolvedValue({
      id: 1,
      name: "old",
      type: "Project",
    } as any);

    await expect(updateMap({ id: 1, name: "   " })).rejects.toThrow(
      "name is required",
    );
  });

  it("throws if name exceeds 10 words", async () => {
    prisma.map.findUnique.mockResolvedValue({
      id: 1,
      name: "old",
      type: "Project",
    } as any);
    const longName = Array(11).fill("word").join(" ");

    await expect(updateMap({ id: 1, name: longName })).rejects.toThrow(
      "name must be 10 words or fewer (got 11)",
    );
  });

  it("allows name at exactly 10 words", async () => {
    prisma.map.findUnique.mockResolvedValue({
      id: 1,
      name: "old",
      type: "Project",
    } as any);
    const exactName = Array(10).fill("word").join(" ");
    prisma.map.update.mockResolvedValue({
      id: 1,
      name: exactName,
      type: "Project",
    } as any);

    await expect(updateMap({ id: 1, name: exactName })).resolves.toBeDefined();
  });

  it("trims leading/trailing whitespace before persisting, regardless of word count", async () => {
    prisma.map.findUnique.mockResolvedValue({
      id: 1,
      name: "old",
      type: "Project",
    } as any);
    prisma.map.update.mockResolvedValue({
      id: 1,
      name: "Fitness Plan",
      type: "Project",
    } as any);

    await updateMap({ id: 1, name: "  Fitness Plan  " });

    expect(prisma.map.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { name: "Fitness Plan" },
    });
  });

  // --- happy path ---

  it("calls prisma.map.update with where: { id } matching the input", async () => {
    prisma.map.findUnique.mockResolvedValue({
      id: 42,
      name: "old",
      type: "Habit",
    } as any);
    prisma.map.update.mockResolvedValue({
      id: 42,
      name: "New Name",
      type: "Habit",
    } as any);

    await updateMap({ id: 42, name: "New Name" });

    expect(prisma.map.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { name: "New Name" },
    });
  });

  it("returns exactly what prisma.map.update resolves to", async () => {
    prisma.map.findUnique.mockResolvedValue({
      id: 1,
      name: "old",
      type: "Project",
    } as any);
    const updated = { id: 1, name: "New Name", type: "Project" };
    prisma.map.update.mockResolvedValue(updated as any);

    const result = await updateMap({ id: 1, name: "New Name" });

    expect(result).toStrictEqual(updated);
  });
});

describe("getMaps", () => {
  it("calls prisma.map.findMany with orderBy: { id: 'asc' }", async () => {
    prisma.map.findMany.mockResolvedValue([]);

    await getMaps();

    expect(prisma.map.findMany).toHaveBeenCalledWith({
      orderBy: { id: "asc" },
    });
  });

  it("returns exactly what prisma.map.findMany resolves to", async () => {
    const maps = [
      { id: 1, name: "First", type: "Project" },
      { id: 2, name: "Second", type: "Habit" },
    ];
    prisma.map.findMany.mockResolvedValue(maps as any);

    const result = await getMaps();

    expect(result).toStrictEqual(maps);
  });

  // Empty result is a distinct case worth pinning down explicitly, since
  // getMaps has no filtering/validation of its own — an empty array must
  // pass straight through rather than being coerced to null/undefined.
  it("returns an empty array when there are no maps", async () => {
    prisma.map.findMany.mockResolvedValue([]);

    const result = await getMaps();

    expect(result).toStrictEqual([]);
  });
});

describe("getMap", () => {
  // --- id validation ---

  it("throws 'id must be a valid integer' when id is not an integer, without touching Prisma", async () => {
    await expect(getMap(1.5)).rejects.toThrow("id must be a valid integer");

    expect(prisma.map.findUnique).not.toHaveBeenCalled();
    expect(prisma.objectiveEdge.findMany).not.toHaveBeenCalled();
  });

  // --- existence check ---

  it("throws 'map not found' when prisma.map.findUnique resolves null, and short-circuits before fetching edges", async () => {
    prisma.map.findUnique.mockResolvedValue(null);

    await expect(getMap(999)).rejects.toThrow("map not found");

    // The edge fetch is a second query keyed off the map's existence — it
    // must never run for a map that doesn't exist.
    expect(prisma.objectiveEdge.findMany).not.toHaveBeenCalled();
  });

  // --- query shape ---

  it("calls prisma.map.findUnique with the correct where/include shape", async () => {
    prisma.map.findUnique.mockResolvedValue({
      id: 1,
      name: "My Map",
      type: "Project",
      objectives: [],
    } as any);
    prisma.objectiveEdge.findMany.mockResolvedValue([]);

    await getMap(1);

    expect(prisma.map.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: {
        objectives: { include: { counter: true } },
      },
    });
  });

  it("calls prisma.objectiveEdge.findMany filtered by the parent objective's mapId, after the map lookup succeeds", async () => {
    prisma.map.findUnique.mockResolvedValue({
      id: 7,
      name: "My Map",
      type: "Project",
      objectives: [],
    } as any);
    prisma.objectiveEdge.findMany.mockResolvedValue([]);

    await getMap(7);

    expect(prisma.objectiveEdge.findMany).toHaveBeenCalledWith({
      where: { parent: { mapId: 7 } },
    });
  });

  // --- return shape ---

  it("returns the map spread with its edges attached", async () => {
    const map = {
      id: 1,
      name: "My Map",
      type: "Project",
      objectives: [
        {
          id: 10,
          description: "Do a {thing}",
          isTask: true,
          mapId: 1,
          counter: {
            id: 100,
            label: "thing",
            targetQuantity: null,
            objectiveId: 10,
          },
        },
      ],
    };
    const edges = [{ id: 5, parentId: 10, childId: 11 }];
    prisma.map.findUnique.mockResolvedValue(map as any);
    prisma.objectiveEdge.findMany.mockResolvedValue(edges as any);

    const result = await getMap(1);

    expect(result).toStrictEqual({ ...map, edges });
  });

  it("returns edges: [] when prisma.objectiveEdge.findMany resolves an empty array", async () => {
    prisma.map.findUnique.mockResolvedValue({
      id: 1,
      name: "My Map",
      type: "Project",
      objectives: [],
    } as any);
    prisma.objectiveEdge.findMany.mockResolvedValue([]);

    const result = await getMap(1);

    expect(result).toMatchObject({ edges: [] });
  });

  it("passes through objectives: [] unchanged when the map has none", async () => {
    prisma.map.findUnique.mockResolvedValue({
      id: 1,
      name: "My Map",
      type: "Project",
      objectives: [],
    } as any);
    prisma.objectiveEdge.findMany.mockResolvedValue([]);

    const result = await getMap(1);

    expect(result).toMatchObject({ objectives: [] });
  });
});
