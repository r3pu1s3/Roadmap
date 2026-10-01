/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from "vitest";
import {
  checkDeadlinePair,
  getAncestors,
  getDescendants,
  validateDeadlinesAgainstGraph,
  validateEdgeDeadlines,
  type DeadlineNode,
} from "../../../services/ObjectiveDeadlineService";
import prisma from "../../../lib/prisma";

// This is the shared module the plan calls for: it holds the two deadline
// propagation rules (sequencing / umbrella) plus the childId-chain
// (ancestors) and parentId-chain (descendants) graph walks used to enforce
// them. Contract pinned by this file, for backend-service-builder:
//
//   interface DeadlineNode {
//     id: number;
//     description: string;
//     isTask: boolean;
//     deadlineStart: Date;
//     deadlineEnd: Date;
//   }
//
//   Deadlines are universally mandatory (the schema's `deadlineStart`/
//   `deadlineEnd` columns are NOT NULL, and the service layer requires both
//   fields on every create/update) -- there is no legacy-null case to
//   handle anywhere in this module.
//
//   checkDeadlinePair(ancestor: DeadlineNode, downstream: DeadlineNode): void
//     - throws a plain Error identifying both objectives and the
//       conflicting dates if `downstream`'s rule (chosen by its own isTask)
//       is violated by `ancestor`; no-op otherwise.
//
//   getAncestors(objectiveId): Promise<DeadlineNode[]>
//     - BFS the childId-chain: from objectiveId, repeatedly follow edges
//       where parentId is in the current frontier and collect their
//       childId side, transitively, then batch-fetch the full node data.
//
//   getDescendants(objectiveId): Promise<DeadlineNode[]>
//     - mirror of getAncestors, following edges where childId is in the
//       current frontier and collecting their parentId side.
//
//   validateDeadlinesAgainstGraph(node: DeadlineNode): Promise<void>
//     - fetches node's existing ancestors/descendants and runs
//       checkDeadlinePair across every (ancestor, node) and
//       (node, descendant) pair; used by ObjectiveService.updateObjective.
//
//   validateEdgeDeadlines(parent: DeadlineNode, child: DeadlineNode): Promise<void>
//     - used by ObjectiveEdgeService.createObjectiveEdge for a proposed
//       childId -> parentId edge; scoped to
//       (ancestors(child.id) ∪ {child}) x (descendants(parent.id) ∪ {parent}).
//
// Query shapes assumed by getAncestors/getDescendants (and asserted below):
//   ancestors direction:   objectiveEdge.findMany({ where: { parentId: { in: frontier } }, select: { childId: true } })
//   descendants direction: objectiveEdge.findMany({ where: { childId: { in: frontier } }, select: { parentId: true } })
//   node hydration:        objective.findMany({ where: { id: { in: [...] } } })
// This matches the existing childId->parentId BFS direction/shape already
// used by ObjectiveEdgeService's cycle-detection BFS.

vi.mock("../../../lib/prisma");

function node(
  id: number,
  isTask: boolean,
  deadlineStart: Date,
  deadlineEnd: Date,
  description = `objective-${id}`,
): DeadlineNode {
  return { id, description, isTask, deadlineStart, deadlineEnd };
}

const D1 = new Date("2026-01-01T00:00:00.000Z");
const D5 = new Date("2026-01-05T00:00:00.000Z");
const D6 = new Date("2026-01-06T00:00:00.000Z");
const D10 = new Date("2026-01-10T00:00:00.000Z");
const D15 = new Date("2026-01-15T00:00:00.000Z");

// Wires prisma.objectiveEdge.findMany / prisma.objective.findMany to behave
// like a real graph, regardless of call order or how many BFS levels the
// implementation issues -- keyed purely on the `where` clause shape, so
// these tests don't overfit to one particular traversal order.
function setupGraph(
  edges: { parentId: number; childId: number }[],
  objectives: DeadlineNode[],
) {
  prisma.objectiveEdge.findMany.mockImplementation(async ({ where }: any) => {
    if (where?.parentId?.in) {
      const frontier: number[] = where.parentId.in;
      return edges
        .filter((e) => frontier.includes(e.parentId))
        .map((e) => ({ childId: e.childId })) as any;
    }
    if (where?.childId?.in) {
      const frontier: number[] = where.childId.in;
      return edges
        .filter((e) => frontier.includes(e.childId))
        .map((e) => ({ parentId: e.parentId })) as any;
    }
    return [] as any;
  });

  prisma.objective.findMany.mockImplementation(async ({ where }: any) => {
    const ids: number[] = where?.id?.in ?? [];
    return objectives.filter((o) => ids.includes(o.id)) as any;
  });
}

describe("checkDeadlinePair", () => {
  // --- sequencing rule (downstream isTask: true) ---

  it("throws when an ancestor's deadlineEnd is after the downstream task's deadlineStart", () => {
    const ancestor = node(1, false, D1, D10);
    const task = node(2, true, D5, D15); // task starts D5, before ancestor ends D10
    expect(() => checkDeadlinePair(ancestor, task)).toThrow(/1|2/);
  });

  it("allows an ancestor whose deadlineEnd is before the downstream task's deadlineStart", () => {
    const ancestor = node(1, false, D1, D5);
    const task = node(2, true, D10, D15);
    expect(() => checkDeadlinePair(ancestor, task)).not.toThrow();
  });

  it("treats ancestor.deadlineEnd === task.deadlineStart as valid (boundary is inclusive)", () => {
    // Interpreting "<=" literally per the plan's rule statement: touching
    // exactly at the boundary is not a violation.
    const ancestor = node(1, false, D1, D5);
    const task = node(2, true, D5, D15);
    expect(() => checkDeadlinePair(ancestor, task)).not.toThrow();
  });

  // --- umbrella rule (downstream isTask: false) ---

  it("throws when the ancestor's interval starts before the downstream goal's interval", () => {
    const ancestor = node(1, true, D1, D6); // starts before goal's D5
    const goal = node(2, false, D5, D10);
    expect(() => checkDeadlinePair(ancestor, goal)).toThrow();
  });

  it("throws when the ancestor's interval ends after the downstream goal's interval", () => {
    const ancestor = node(1, true, D6, D15); // ends after goal's D10
    const goal = node(2, false, D5, D10);
    expect(() => checkDeadlinePair(ancestor, goal)).toThrow();
  });

  it("allows an ancestor interval that is fully contained within the downstream goal's interval", () => {
    const ancestor = node(1, true, D5, D10);
    const goal = node(2, false, D1, D15);
    expect(() => checkDeadlinePair(ancestor, goal)).not.toThrow();
  });

  it("treats an ancestor interval exactly equal to the goal's interval as fully contained (boundary is inclusive)", () => {
    const ancestor = node(1, true, D5, D10);
    const goal = node(2, false, D5, D10);
    expect(() => checkDeadlinePair(ancestor, goal)).not.toThrow();
  });
});

describe("getAncestors", () => {
  it("returns the direct childId-linked ancestor of a node", async () => {
    // Edge parentId:1, childId:2 means "2 leads to 1" -- 2 is upstream of 1.
    setupGraph(
      [{ parentId: 1, childId: 2 }],
      [node(2, false, D1, D5, "ancestor")],
    );

    const result = await getAncestors(1);

    expect(result).toEqual([node(2, false, D1, D5, "ancestor")]);
  });

  it("walks multiple hops to find a grandparent-equivalent ancestor via the childId-chain", async () => {
    // Chain: 3 -> 2 -> 1 (childId -> parentId), so relative to node 1,
    // both 2 (direct) and 3 (transitive) are ancestors.
    setupGraph(
      [
        { parentId: 1, childId: 2 },
        { parentId: 2, childId: 3 },
      ],
      [node(2, false, D1, D5, "direct"), node(3, false, D1, D5, "grand")],
    );

    const result = await getAncestors(1);

    expect(result).toHaveLength(2);
    expect(result.map((n) => n.id).sort()).toEqual([2, 3]);
  });

  it("returns an empty array when the node has no ancestors", async () => {
    setupGraph([], []);

    await expect(getAncestors(1)).resolves.toEqual([]);
  });
});

describe("getDescendants", () => {
  it("returns the direct parentId-linked descendant of a node", async () => {
    // Edge parentId:2, childId:1 means "1 leads to 2" -- 2 is downstream of 1.
    setupGraph(
      [{ parentId: 2, childId: 1 }],
      [node(2, false, D10, D15, "descendant")],
    );

    const result = await getDescendants(1);

    expect(result).toEqual([node(2, false, D10, D15, "descendant")]);
  });

  it("walks multiple hops to find a grandchild-equivalent descendant via the parentId-chain", async () => {
    // Chain: 1 -> 2 -> 3 (childId -> parentId), so relative to node 1,
    // both 2 (direct) and 3 (transitive) are descendants.
    setupGraph(
      [
        { parentId: 2, childId: 1 },
        { parentId: 3, childId: 2 },
      ],
      [node(2, false, D10, D15, "direct"), node(3, false, D10, D15, "grand")],
    );

    const result = await getDescendants(1);

    expect(result).toHaveLength(2);
    expect(result.map((n) => n.id).sort()).toEqual([2, 3]);
  });

  it("returns an empty array when the node has no descendants", async () => {
    setupGraph([], []);

    await expect(getDescendants(1)).resolves.toEqual([]);
  });
});

describe("validateDeadlinesAgainstGraph", () => {
  it("rejects when an existing ancestor violates the sequencing rule against this (isTask: true) node", async () => {
    const self = node(1, true, D10, D15);
    // Ancestor ends D15, well after self (the task) starts D10.
    const violatingAncestor = node(2, false, D10, D15, "violating-ancestor");
    setupGraph([{ parentId: 1, childId: 2 }], [violatingAncestor]);

    await expect(validateDeadlinesAgainstGraph(self)).rejects.toThrow();
  });

  it("accepts when every existing ancestor satisfies the sequencing rule against this (isTask: true) node", async () => {
    const self = node(1, true, D10, D15);
    const okAncestor = node(2, false, D1, D5, "ok-ancestor");
    setupGraph([{ parentId: 1, childId: 2 }], [okAncestor]);

    await expect(validateDeadlinesAgainstGraph(self)).resolves.toBeUndefined();
  });

  it("rejects when an existing descendant violates the rule chosen by the descendant's own isTask", async () => {
    // node 1 is upstream of node 2 (edge parentId:2, childId:1). Node 2 is
    // a task, so the sequencing rule applies with node 2 as downstream:
    // self.deadlineEnd (D15) must be <= descendant.deadlineStart (D5) --
    // it isn't, so this must be rejected.
    const self = node(1, false, D1, D15);
    const violatingDescendant = node(2, true, D5, D10, "violating-descendant");
    setupGraph([{ parentId: 2, childId: 1 }], [violatingDescendant]);

    await expect(validateDeadlinesAgainstGraph(self)).rejects.toThrow();
  });

  it("accepts when every existing descendant satisfies its own rule against this node", async () => {
    const self = node(1, false, D1, D5);
    const okDescendant = node(2, true, D10, D15, "ok-descendant");
    setupGraph([{ parentId: 2, childId: 1 }], [okDescendant]);

    await expect(validateDeadlinesAgainstGraph(self)).resolves.toBeUndefined();
  });

  it("enforces the umbrella rule transitively against a grandchild-equivalent (multi-hop) ancestor, not just a direct one", async () => {
    // Chain: 3 -> 2 -> 1 (childId -> parentId). Node 1 is a goal (umbrella)
    // whose interval must contain node 3's interval too, not just node 2's
    // -- this is the non-local case the plan calls out explicitly.
    const self = node(1, false, D5, D10);
    const direct = node(2, false, D5, D10, "direct-ancestor"); // fine, contained
    const grand = node(3, false, D1, D6, "grand-ancestor"); // starts D1, before self's D5 -> violates
    setupGraph(
      [
        { parentId: 1, childId: 2 },
        { parentId: 2, childId: 3 },
      ],
      [direct, grand],
    );

    await expect(validateDeadlinesAgainstGraph(self)).rejects.toThrow();
  });
});

describe("validateEdgeDeadlines", () => {
  // Used by ObjectiveEdgeService.createObjectiveEdge for a proposed
  // childId -> parentId edge (child upstream, parent downstream), scoped to
  // ancestors(child) ∪ descendants(parent), including the two endpoints
  // themselves.

  it("rejects a proposed edge when the direct parent/child pair already violates the sequencing rule", async () => {
    const parent = node(1, true, D5, D10, "parent-task"); // downstream, isTask true
    const child = node(2, false, D6, D15, "child"); // ends D15, after parent starts D5
    setupGraph([], []); // no further ancestors/descendants beyond the pair itself

    await expect(validateEdgeDeadlines(parent, child)).rejects.toThrow();
  });

  it("accepts a proposed edge when the direct parent/child pair satisfies the sequencing rule", async () => {
    const parent = node(1, true, D10, D15, "parent-task");
    const child = node(2, false, D1, D5, "child");
    setupGraph([], []);

    await expect(validateEdgeDeadlines(parent, child)).resolves.toBeUndefined();
  });

  it("rejects when a pre-existing ancestor of the child would violate the umbrella rule against the parent", async () => {
    // Existing chain: 3 -> 2 (childId -> parentId), where 2 is the
    // proposed child. Proposing edge 2 -> 1 makes 1 (a goal/umbrella)
    // responsible for containing 3's interval too, not just 2's.
    const parent = node(1, false, D5, D10, "goal-parent");
    const child = node(2, false, D5, D10, "child"); // fine on its own
    const grandAncestorOfChild = node(3, false, D1, D6, "too-early"); // violates umbrella
    setupGraph([{ parentId: 2, childId: 3 }], [grandAncestorOfChild]);

    await expect(validateEdgeDeadlines(parent, child)).rejects.toThrow();
  });
});
