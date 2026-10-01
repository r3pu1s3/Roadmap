import { describe, it, expect, vi } from "vitest";
import {
  createObjectiveEdge,
  deleteObjectiveEdge,
} from "../../../services/ObjectiveEdgeService";
import prisma from "../../../lib/prisma";

// This suite mocks Prisma's deeply-typed client via vitest-mock-extended, and
// only ever needs a narrow, hand-picked subset of each model's real fields
// (e.g. `{ id, mapId }` rather than every column) — matching this repo's
// existing test-file convention (see MapService.test.ts) of using `any` to
// bridge those minimal fixtures into the deep mock's return types rather
// than maintaining full Prisma model shapes in every test.
/* eslint-disable @typescript-eslint/no-explicit-any */

vi.mock("../../../lib/prisma");

// Fixed ids used across tests so the "shape" of each scenario is easy to
// follow: PARENT/CHILD are the objectives being linked by the edge under
// test; the map ids let us flip between "same map" (allowed) and
// "different map" (rejected) scenarios explicitly.
const PARENT_ID = 1;
const CHILD_ID = 2;
const MAP_ID = 10;

// Deadlines are mandatory on every Objective, including at the DB level
// going forward (a follow-up migration makes the columns NOT NULL once
// legacy rows are cleaned up), so even fixtures for tests that aren't
// concerned with deadline rules must carry real dates. These two objectives
// share an identical, wide default interval and default to isTask: false,
// which trivially satisfies both the sequencing and umbrella rules against
// each other (equal intervals; boundary-touching is inclusive) -- so
// cross-map / duplicate-edge / cycle-detection tests can stay entirely
// unconcerned with deadlines.
const DEFAULT_DEADLINE_START = new Date("2026-01-01T00:00:00.000Z");
const DEFAULT_DEADLINE_END = new Date("2026-12-31T00:00:00.000Z");

function projectObjective(id: number, mapId = MAP_ID) {
  return {
    id,
    mapId,
    isTask: false,
    description: `objective-${id}`,
    deadlineStart: DEFAULT_DEADLINE_START,
    deadlineEnd: DEFAULT_DEADLINE_END,
  } as any;
}

// --- deadline-aware fixtures -------------------------------------------
// For tests that DO care about deadline rules, this lets each objective's
// isTask/interval be set explicitly. This mirrors the DeadlineNode shape
// expected by ObjectiveDeadlineService.checkDeadlinePair / validateEdgeDeadlines.
function deadlineObjective(
  id: number,
  isTask: boolean,
  deadlineStart: Date,
  deadlineEnd: Date,
  mapId = MAP_ID,
) {
  return {
    id,
    mapId,
    isTask,
    description: `objective-${id}`,
    deadlineStart,
    deadlineEnd,
  } as any;
}

const D1 = new Date("2026-01-01T00:00:00.000Z");
const D5 = new Date("2026-01-05T00:00:00.000Z");
const D6 = new Date("2026-01-06T00:00:00.000Z");
const D10 = new Date("2026-01-10T00:00:00.000Z");
const D15 = new Date("2026-01-15T00:00:00.000Z");
const D20 = new Date("2026-01-20T00:00:00.000Z");

// Simulates a graph with no edges beyond the one being proposed: this
// satisfies both the pre-existing cycle-detection BFS (no cycle found) and
// ObjectiveDeadlineService's ancestor/descendant walks (no extra nodes),
// isolating each test to just the direct parent/child pair.
function mockNoExtraEdges() {
  prisma.objectiveEdge.findMany.mockResolvedValue([]);
}

// Convenience: wires up the two `objective.findUnique` calls the service
// makes (parent first, then child, per the plan's ordering) so most tests
// only need to describe the two objectives involved.
function mockParentAndChild(parent: any, child: any) {
  prisma.objective.findUnique
    .mockResolvedValueOnce(parent)
    .mockResolvedValueOnce(child);
}

describe("createObjectiveEdge", () => {
  // --- parentId / childId integer validation ---
  // These must be checked before anything else, so no DB round trip is
  // wasted on obviously malformed input.

  it("throws if parentId is not a valid integer", async () => {
    await expect(
      createObjectiveEdge({ parentId: "abc" as any, childId: CHILD_ID }),
    ).rejects.toThrow("parentId is required and must be a valid integer");
  });

  it("throws if childId is not a valid integer", async () => {
    await expect(
      createObjectiveEdge({ parentId: PARENT_ID, childId: "abc" as any }),
    ).rejects.toThrow("childId is required and must be a valid integer");
  });

  // --- self-loop rejection ---

  it("throws a self-loop error and makes zero Prisma calls when parentId equals childId", async () => {
    await expect(
      createObjectiveEdge({ parentId: 5, childId: 5 }),
    ).rejects.toThrow("an objective cannot be its own parent");

    // This check must happen purely on the input, before any lookup —
    // asserting no Prisma calls occurred proves the short-circuit is real
    // and not just an early-thrown error after an accidental fetch.
    expect(prisma.objective.findUnique).not.toHaveBeenCalled();
    expect(prisma.objectiveEdge.findUnique).not.toHaveBeenCalled();
    expect(prisma.objectiveEdge.findFirst).not.toHaveBeenCalled();
    expect(prisma.objectiveEdge.findMany).not.toHaveBeenCalled();
    expect(prisma.objectiveEdge.create).not.toHaveBeenCalled();
  });

  // --- existence checks ---

  it("throws 'parent objective not found' when the parent lookup resolves null", async () => {
    prisma.objective.findUnique.mockResolvedValueOnce(null);

    await expect(
      createObjectiveEdge({ parentId: PARENT_ID, childId: CHILD_ID }),
    ).rejects.toThrow("parent objective not found");

    expect(prisma.objective.findUnique).toHaveBeenCalledWith({
      where: { id: PARENT_ID },
    });
  });

  it("throws 'child objective not found' when the child lookup resolves null", async () => {
    mockParentAndChild(projectObjective(PARENT_ID), null);

    await expect(
      createObjectiveEdge({ parentId: PARENT_ID, childId: CHILD_ID }),
    ).rejects.toThrow("child objective not found");
  });

  // --- cross-map rejection ---

  it("throws when the parent and child objectives belong to different maps", async () => {
    mockParentAndChild(
      projectObjective(PARENT_ID, MAP_ID),
      projectObjective(CHILD_ID, MAP_ID + 1),
    );

    await expect(
      createObjectiveEdge({ parentId: PARENT_ID, childId: CHILD_ID }),
    ).rejects.toThrow(
      "parent and child objectives must belong to the same map",
    );
  });

  // --- duplicate edge rejection ---

  it("throws when the edge already exists, without ever calling create", async () => {
    mockParentAndChild(projectObjective(PARENT_ID), projectObjective(CHILD_ID));
    prisma.objectiveEdge.findUnique.mockResolvedValue({
      id: 99,
      parentId: PARENT_ID,
      childId: CHILD_ID,
    } as any);

    await expect(
      createObjectiveEdge({ parentId: PARENT_ID, childId: CHILD_ID }),
    ).rejects.toThrow("this edge already exists");

    expect(prisma.objectiveEdge.findUnique).toHaveBeenCalledWith({
      where: { parentId_childId: { parentId: PARENT_ID, childId: CHILD_ID } },
    });
    expect(prisma.objectiveEdge.create).not.toHaveBeenCalled();
  });

  // --- multiple parents allowed (proves DAG shape, not a tree) ---
  // Every map behaves as an unconditional DAG now: a child may have any
  // number of incoming parent edges, with no map-level "single parent"
  // restriction (there used to be one for Habit maps; that concept and the
  // `map.type` distinction have been removed entirely).

  it("allows a child to receive a second parent edge (DAG, not tree)", async () => {
    mockParentAndChild(projectObjective(PARENT_ID), projectObjective(CHILD_ID));
    prisma.objectiveEdge.findUnique.mockResolvedValue(null);
    // The service never consults findFirst for a single-parent check — the
    // child already has an existing parent edge, but that must NOT block
    // the new one, since the DAG allows any number of parents.
    prisma.objectiveEdge.findMany.mockResolvedValue([]); // no cycle
    const created = { id: 2, parentId: PARENT_ID, childId: CHILD_ID };
    prisma.objectiveEdge.create.mockResolvedValue(created as any);

    await expect(
      createObjectiveEdge({ parentId: PARENT_ID, childId: CHILD_ID }),
    ).resolves.toStrictEqual(created);

    expect(prisma.objectiveEdge.findFirst).not.toHaveBeenCalled();
    expect(prisma.objectiveEdge.create).toHaveBeenCalledWith({
      data: { parentId: PARENT_ID, childId: CHILD_ID },
    });
  });

  // --- cycle detection ---
  // Edges represent "childId leads to parentId" (childId is upstream/
  // first, parentId is downstream/second). The BFS walks forward along
  // existing childId -> parentId edges, starting from the proposed new
  // edge's parentId, to see whether the proposed childId is already
  // reachable underneath it. If it is, adding childId -> parentId would
  // close a loop back around to an ancestor.

  it("rejects a direct 2-node cycle (existing A->B, proposing B->A)", async () => {
    const A = 1;
    const B = 2;
    mockParentAndChild(projectObjective(A), projectObjective(B));
    prisma.objectiveEdge.findUnique.mockResolvedValue(null);
    // Existing edge in the DB is A -> B (childId: A, parentId: B).
    // Proposing childId=B, parentId=A means the cycle check starts BFS
    // at parentId=A: querying "nodes A leads to" (childId in [A]) returns
    // B, and B is exactly the proposed childId — so the cycle is found
    // on the very first level, immediately.
    prisma.objectiveEdge.findMany.mockResolvedValueOnce([{ parentId: B }]);

    await expect(
      createObjectiveEdge({ parentId: A, childId: B }),
    ).rejects.toThrow("adding this edge would create a cycle");

    expect(prisma.objectiveEdge.findMany).toHaveBeenCalledWith({
      where: { childId: { in: [A] } },
      select: { parentId: true },
    });
    // Short-circuit: once the cycle is found at level 1, BFS must stop —
    // it should never issue a second findMany call to look deeper.
    expect(prisma.objectiveEdge.findMany).toHaveBeenCalledTimes(1);
    expect(prisma.objectiveEdge.create).not.toHaveBeenCalled();
  });

  it("rejects a multi-hop cycle (existing A->B->C, proposing C->A)", async () => {
    const A = 1;
    const B = 2;
    const C = 3;
    mockParentAndChild(projectObjective(A), projectObjective(C));
    prisma.objectiveEdge.findUnique.mockResolvedValue(null);
    // Existing chain: A -> B -> C. Proposing childId=C, parentId=A would
    // close the loop A -> B -> C -> A. BFS starts at parentId=A:
    //   level 1: A leads to -> [B]  (B is not the proposed child C yet)
    //   level 2: B leads to -> [C]  (C IS the proposed child -> cycle)
    prisma.objectiveEdge.findMany
      .mockResolvedValueOnce([{ parentId: B }])
      .mockResolvedValueOnce([{ parentId: C }]);

    await expect(
      createObjectiveEdge({ parentId: A, childId: C }),
    ).rejects.toThrow("adding this edge would create a cycle");

    expect(prisma.objectiveEdge.findMany).toHaveBeenNthCalledWith(1, {
      where: { childId: { in: [A] } },
      select: { parentId: true },
    });
    expect(prisma.objectiveEdge.findMany).toHaveBeenNthCalledWith(2, {
      where: { childId: { in: [B] } },
      select: { parentId: true },
    });
    // Found on the second level — must not go further (e.g. querying
    // what C leads to).
    expect(prisma.objectiveEdge.findMany).toHaveBeenCalledTimes(2);
    expect(prisma.objectiveEdge.create).not.toHaveBeenCalled();
  });

  it("does not false-positive on an unrelated chain and still creates the edge", async () => {
    const P = 10;
    const Q = 11;
    const R = 12; // R -> Q exists elsewhere in the graph, unrelated to P
    mockParentAndChild(projectObjective(Q), projectObjective(P));
    prisma.objectiveEdge.findUnique.mockResolvedValue(null);
    // BFS from parentId=Q: level 1 finds R (via existing R->Q edge), which
    // is not the proposed childId P, so it keeps walking; level 2 finds
    // nothing further upstream of R, so the frontier empties out and the
    // BFS correctly concludes there is no cycle.
    // Deadlines are now mandatory, so this edge reaching creation also
    // triggers deadline-propagation's own ancestor/descendant graph walk
    // (unrelated to cycle-detection) -- any calls beyond the two levels
    // below fall back to this persistent empty result.
    prisma.objectiveEdge.findMany
      .mockResolvedValueOnce([{ parentId: R }])
      .mockResolvedValueOnce([])
      .mockResolvedValue([]);
    const created = { id: 3, parentId: Q, childId: P };
    prisma.objectiveEdge.create.mockResolvedValue(created as any);

    await expect(
      createObjectiveEdge({ parentId: Q, childId: P }),
    ).resolves.toStrictEqual(created);

    // Pin the two cycle-detection BFS levels specifically, by position --
    // the *total* call count to this mock is no longer exactly 2, since
    // deadline-propagation's separate graph walk also consumes it now.
    expect(prisma.objectiveEdge.findMany).toHaveBeenNthCalledWith(1, {
      where: { childId: { in: [Q] } },
      select: { parentId: true },
    });
    expect(prisma.objectiveEdge.findMany).toHaveBeenNthCalledWith(2, {
      where: { childId: { in: [R] } },
      select: { parentId: true },
    });
    expect(prisma.objectiveEdge.create).toHaveBeenCalledWith({
      data: { parentId: Q, childId: P },
    });
  });

  // --- happy path: return value passthrough ---

  it("creates the edge and returns exactly what prisma resolves with", async () => {
    mockParentAndChild(projectObjective(PARENT_ID), projectObjective(CHILD_ID));
    prisma.objectiveEdge.findUnique.mockResolvedValue(null);
    prisma.objectiveEdge.findMany.mockResolvedValue([]);
    const created = {
      id: 42,
      parentId: PARENT_ID,
      childId: CHILD_ID,
    };
    prisma.objectiveEdge.create.mockResolvedValue(created as any);

    const result = await createObjectiveEdge({
      parentId: PARENT_ID,
      childId: CHILD_ID,
    });

    expect(prisma.objectiveEdge.create).toHaveBeenCalledWith({
      data: { parentId: PARENT_ID, childId: CHILD_ID },
    });
    expect(result).toStrictEqual(created);
  });

  // --- deadline propagation validation ---
  // After the existing cycle-detection BFS above (unchanged), a proposed
  // edge (childId upstream, parentId downstream) must also be checked
  // against ObjectiveDeadlineService's two rules, scoped to
  // ancestors(childId) ∪ descendants(parentId). These tests isolate the
  // direct parent/child pair itself (no further ancestors/descendants) —
  // multi-hop propagation is covered in ObjectiveDeadlineService.test.ts.

  it("rejects a new edge when the direct parent/child pair violates the sequencing rule (downstream parent isTask: true)", async () => {
    // Parent is a task starting D5; child (upstream) doesn't end until D6.
    mockParentAndChild(
      deadlineObjective(PARENT_ID, true, D5, D10),
      deadlineObjective(CHILD_ID, false, D1, D6),
    );
    prisma.objectiveEdge.findUnique.mockResolvedValue(null);
    mockNoExtraEdges();

    await expect(
      createObjectiveEdge({ parentId: PARENT_ID, childId: CHILD_ID }),
    ).rejects.toThrow();

    expect(prisma.objectiveEdge.create).not.toHaveBeenCalled();
  });

  it("creates the edge when the direct parent/child pair satisfies the sequencing rule", async () => {
    mockParentAndChild(
      deadlineObjective(PARENT_ID, true, D10, D15),
      deadlineObjective(CHILD_ID, false, D1, D5),
    );
    prisma.objectiveEdge.findUnique.mockResolvedValue(null);
    mockNoExtraEdges();
    const created = { id: 5, parentId: PARENT_ID, childId: CHILD_ID };
    prisma.objectiveEdge.create.mockResolvedValue(created as any);

    await expect(
      createObjectiveEdge({ parentId: PARENT_ID, childId: CHILD_ID }),
    ).resolves.toStrictEqual(created);
  });

  it("rejects a new edge when the direct parent/child pair violates the umbrella rule (downstream parent isTask: false)", async () => {
    // Parent is a goal spanning D1-D15; child (upstream) ends D20, which
    // isn't contained within the parent's interval.
    mockParentAndChild(
      deadlineObjective(PARENT_ID, false, D1, D15),
      deadlineObjective(CHILD_ID, false, D5, D20),
    );
    prisma.objectiveEdge.findUnique.mockResolvedValue(null);
    mockNoExtraEdges();

    await expect(
      createObjectiveEdge({ parentId: PARENT_ID, childId: CHILD_ID }),
    ).rejects.toThrow();

    expect(prisma.objectiveEdge.create).not.toHaveBeenCalled();
  });
});

describe("deleteObjectiveEdge", () => {
  it("throws if id is not a valid integer, before any Prisma call", async () => {
    await expect(deleteObjectiveEdge("abc" as any)).rejects.toThrow(
      "id must be a valid integer",
    );

    expect(prisma.objectiveEdge.findUnique).not.toHaveBeenCalled();
    expect(prisma.objectiveEdge.delete).not.toHaveBeenCalled();
  });

  it("throws 'edge not found' when the edge does not exist, without calling delete", async () => {
    prisma.objectiveEdge.findUnique.mockResolvedValue(null);

    await expect(deleteObjectiveEdge(999)).rejects.toThrow("edge not found");

    expect(prisma.objectiveEdge.findUnique).toHaveBeenCalledWith({
      where: { id: 999 },
    });
    expect(prisma.objectiveEdge.delete).not.toHaveBeenCalled();
  });

  it("deletes the edge and returns whatever prisma resolves with", async () => {
    prisma.objectiveEdge.findUnique.mockResolvedValue({
      id: 1,
      parentId: PARENT_ID,
      childId: CHILD_ID,
    } as any);
    const deleted = { id: 1, parentId: PARENT_ID, childId: CHILD_ID };
    prisma.objectiveEdge.delete.mockResolvedValue(deleted as any);

    const result = await deleteObjectiveEdge(1);

    expect(prisma.objectiveEdge.delete).toHaveBeenCalledWith({
      where: { id: 1 },
    });
    expect(result).toStrictEqual(deleted);
  });

  // --- no revalidation on deletion ---
  // Removing a dependency only relaxes constraints (fewer ancestors/
  // descendants to satisfy), so deletion must never trigger the deadline
  // propagation graph walk or any extra objective lookups.

  it("does not perform any deadline revalidation when deleting an edge", async () => {
    prisma.objectiveEdge.findUnique.mockResolvedValue({
      id: 1,
      parentId: PARENT_ID,
      childId: CHILD_ID,
    } as any);
    prisma.objectiveEdge.delete.mockResolvedValue({
      id: 1,
      parentId: PARENT_ID,
      childId: CHILD_ID,
    } as any);

    await deleteObjectiveEdge(1);

    expect(prisma.objectiveEdge.findMany).not.toHaveBeenCalled();
    expect(prisma.objective.findMany).not.toHaveBeenCalled();
    expect(prisma.objective.findUnique).not.toHaveBeenCalled();
  });
});
