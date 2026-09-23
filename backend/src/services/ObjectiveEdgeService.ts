import prisma from "../lib/prisma";

export interface CreateObjectiveEdgeInput {
  parentId: number;
  childId: number;
}

export async function createObjectiveEdge(data: CreateObjectiveEdgeInput) {
  const { parentId, childId } = data;

  // --- Input validation (Prisma can't enforce "is a real integer" on
  // values that may arrive as strings/undefined from the controller layer) ---
  if (!Number.isInteger(parentId)) {
    throw new Error("parentId is required and must be a valid integer");
  }
  if (!Number.isInteger(childId)) {
    throw new Error("childId is required and must be a valid integer");
  }

  // --- Self-loop rejection ---
  // An objective being its own parent is nonsensical for a goal graph and
  // would also trivially be a cycle; checked purely on input so it never
  // costs a DB round trip.
  if (parentId === childId) {
    throw new Error("an objective cannot be its own parent");
  }

  // --- Existence checks ---
  // Parent is fetched first (per the plan's ordering) so that a missing
  // parent is reported before we even look at the child. Only the bare
  // objective is needed here — `mapId` is a direct scalar field, so there's
  // no need to include the `map` relation.
  const parentObjective = await prisma.objective.findUnique({
    where: { id: parentId },
  });
  if (!parentObjective) {
    throw new Error("parent objective not found");
  }

  const childObjective = await prisma.objective.findUnique({
    where: { id: childId },
  });
  if (!childObjective) {
    throw new Error("child objective not found");
  }

  // --- Cross-map rejection ---
  // Edges only make sense within a single map's DAG/routine; an edge that
  // spans two maps would corrupt both graphs.
  if (parentObjective.mapId !== childObjective.mapId) {
    throw new Error("parent and child objectives must belong to the same map");
  }

  // --- Duplicate edge rejection ---
  // The schema's @@unique([parentId, childId]) would also reject this at
  // the DB level, but checking here lets us surface a clean domain error
  // message instead of a raw Prisma constraint violation.
  const existingEdge = await prisma.objectiveEdge.findUnique({
    where: { parentId_childId: { parentId, childId } },
  });
  if (existingEdge) {
    throw new Error("this edge already exists");
  }

  // --- Cycle detection (BFS) ---
  // Edges represent "childId leads to parentId" — childId is the
  // upstream/first objective, parentId is the downstream/later one (this
  // matches the frontend's canvas: the node a connection is dragged FROM
  // becomes the child, the node it's dropped ON becomes the parent, and the
  // child is laid out below the parent). Adding childId -> parentId would
  // create a cycle if childId is already reachable *from* parentId by
  // following existing edges forward. We BFS outward from parentId, level
  // by level, and check at each level whether the proposed childId shows up
  // among the discovered descendants — stopping immediately (no further
  // queries) the moment it does, since that alone proves a cycle regardless
  // of what lies beyond it.
  let frontier: number[] = [parentId];
  const visited = new Set<number>([parentId]);

  while (frontier.length > 0) {
    const edges = await prisma.objectiveEdge.findMany({
      where: { childId: { in: frontier } },
      select: { parentId: true },
    });

    const nextFrontier: number[] = [];
    for (const edge of edges) {
      if (edge.parentId === childId) {
        throw new Error("adding this edge would create a cycle");
      }
      if (!visited.has(edge.parentId)) {
        visited.add(edge.parentId);
        nextFrontier.push(edge.parentId);
      }
    }

    frontier = nextFrontier;
  }

  // --- Create ---
  return prisma.objectiveEdge.create({
    data: { parentId, childId },
  });
}

export async function deleteObjectiveEdge(id: number) {
  // --- Input validation ---
  if (!Number.isInteger(id)) {
    throw new Error("id must be a valid integer");
  }

  // --- Existence check ---
  const existing = await prisma.objectiveEdge.findUnique({ where: { id } });
  if (!existing) {
    throw new Error("edge not found");
  }

  // --- Delete ---
  return prisma.objectiveEdge.delete({ where: { id } });
}
