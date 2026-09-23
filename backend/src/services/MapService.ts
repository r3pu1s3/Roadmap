import prisma from "../lib/prisma";
import {
  Map,
  Objective,
  ObjectiveCounter,
  ObjectiveEdge,
} from "../generated/prisma/client";

const NAME_WORD_LIMIT = 10;

export interface CreateMapInput {
  name: string;
}

// Shared name validation for both createMap and updateMap. A map name is
// meant to be a short human-readable label (shown in tight UI spaces like
// the map menu), so we cap it by word count rather than character count —
// this is more forgiving of long words while still preventing someone from
// pasting in a full sentence/paragraph as a "name".
function validateMapName(name: string): string {
  if (!name || name.trim().length === 0) {
    throw new Error("name is required");
  }

  const trimmed = name.trim();
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > NAME_WORD_LIMIT) {
    throw new Error(
      `name must be ${NAME_WORD_LIMIT} words or fewer (got ${wordCount})`,
    );
  }

  return trimmed;
}

export async function createMap(data: CreateMapInput) {
  // --- Validation (business rules Prisma can't enforce) ---
  const name = validateMapName(data.name);

  // --- Create ---
  return prisma.map.create({
    data: {
      name,
    },
  });
}

// Plain listing of all maps for the map menu — no filtering/validation of
// its own since there are no user-scoped or query-string inputs yet.
// Ordered by id ascending so the list order is stable/deterministic across
// requests rather than relying on whatever order the DB happens to return.
export async function getMaps(): Promise<Map[]> {
  return prisma.map.findMany({ orderBy: { id: "asc" } });
}

// An objective as returned when loading a full map graph — includes its
// optional counter (present only for tasks whose description embeds a
// {placeholder}), mirroring the include shape used below.
export type MapObjectiveWithCounter = Objective & {
  counter: ObjectiveCounter | null;
};

// The "Open a Map Instance" view needs the full graph in one response: the
// map, its objectives (with counters), and the edges connecting them — so
// the canvas can render nodes and connections without a second round-trip.
export interface MapWithGraph extends Map {
  objectives: MapObjectiveWithCounter[];
  edges: ObjectiveEdge[];
}

export async function getMap(id: number): Promise<MapWithGraph> {
  if (!Number.isInteger(id)) {
    throw new Error("id must be a valid integer");
  }

  const map = await prisma.map.findUnique({
    where: { id },
    include: {
      objectives: {
        include: { counter: true },
      },
    },
  });

  if (!map) {
    throw new Error("map not found");
  }

  // Edges are fetched separately (ObjectiveEdge has no direct mapId column),
  // filtered by the parent objective's mapId. Edges are always intra-map
  // (enforced by ObjectiveEdgeService rejecting cross-map edges at creation
  // time), so filtering on the parent side alone is sufficient — we don't
  // need to also check the child side or collect the map's objective ids
  // into a second existence query.
  const edges = await prisma.objectiveEdge.findMany({
    where: { parent: { mapId: id } },
  });

  return { ...map, edges } as MapWithGraph;
}
export interface UpdateMapInput {
  id: number;
  name: string;
}

export async function updateMap(data: UpdateMapInput) {
  const { id } = data;

  // --- Existence check ---
  const existing = await prisma.map.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("map not found");
  }

  // --- Validation (same name checks as createMap, via the shared helper) ---
  const name = validateMapName(data.name);

  // --- Update ---
  // Only name is editable on a map.
  return prisma.map.update({
    where: { id },
    data: { name },
  });
}
