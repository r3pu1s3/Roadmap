import prisma from "../lib/prisma";

// Shared helper module for the deadlines feature. It holds the two
// cross-node deadline propagation rules (sequencing / umbrella) plus the
// graph walks (childId-chain "ancestors", parentId-chain "descendants")
// needed to enforce them against a node's *existing* neighbours whenever a
// deadline, isTask flag, or edge changes.
//
// Deadlines are nullable (the schema's `deadlineStart`/`deadlineEnd` columns
// are nullable). A node either has a real deadline (both fields set) or no
// deadline at all (both fields null) -- this both-or-neither invariant is
// enforced by ObjectiveService's create/update logic before anything is
// persisted, so this module never sees a "lopsided" node (exactly one field
// null). `checkDeadlinePair` treats "no deadline" on either side of a pair as
// vacuously satisfying the check -- see its guard below.

export interface DeadlineNode {
  id: number;
  description: string;
  isTask: boolean;
  deadlineStart: Date | null;
  deadlineEnd: Date | null;
}

/**
 * Returns true when `node` has no deadline at all. `deadlineStart === null`
 * is used as the sole proxy for this, since the both-or-neither invariant
 * guarantees `deadlineEnd` is null too whenever `deadlineStart` is null.
 */
function hasNoDeadline(
  node: DeadlineNode,
): node is DeadlineNode & { deadlineStart: null; deadlineEnd: null } {
  return node.deadlineStart === null;
}

/**
 * Checks a single (ancestor, downstream) pair against whichever rule the
 * DOWNSTREAM node's own `isTask` flag selects. `ancestor` is upstream of
 * `downstream` in the DAG (i.e. work that must happen first / that
 * `downstream` depends on).
 *
 * - downstream.isTask === true  -> "sequencing" rule: a task is a single
 *   unit of work that shouldn't start until everything feeding into it has
 *   finished, so every ancestor must fully end at-or-before the task starts.
 * - downstream.isTask === false -> "umbrella" rule: a goal is a container
 *   for its upstream work, so every ancestor's interval must fit entirely
 *   inside the goal's interval (the goal "wraps around" its dependencies).
 *
 * Both boundaries are INCLUSIVE (exact touching is allowed) -- this is
 * deliberately looser than the 1-minute-minimum-duration rule enforced on a
 * single node's own interval in ObjectiveService, which is a different
 * concern (a node can't be an instant; two *different* nodes' edges may
 * touch exactly).
 *
 * If either `ancestor` or `downstream` has no deadline at all, the pair is
 * vacuously satisfied -- there is nothing to conflict with -- and this
 * returns immediately without checking either rule.
 */
export function checkDeadlinePair(
  ancestor: DeadlineNode,
  downstream: DeadlineNode,
): void {
  if (hasNoDeadline(ancestor) || hasNoDeadline(downstream)) {
    return;
  }

  // TS can't narrow both `ancestor` and `downstream` to non-null from the
  // two independent `hasNoDeadline` checks above (each is a type predicate
  // over a different variable, combined with `||`), even though the early
  // return above guarantees neither has a null deadline here -- so we
  // re-bind to locals whose type reflects that guarantee.
  const ancestorStart = ancestor.deadlineStart as Date;
  const ancestorEnd = ancestor.deadlineEnd as Date;
  const downstreamStart = downstream.deadlineStart as Date;
  const downstreamEnd = downstream.deadlineEnd as Date;

  if (downstream.isTask) {
    if (ancestorEnd > downstreamStart) {
      throw new Error(
        `Deadline conflict: objective ${ancestor.id} ("${ancestor.description}") ends at ` +
          `${ancestorEnd.toISOString()}, which is after downstream task objective ` +
          `${downstream.id} ("${downstream.description}") starts at ` +
          `${downstreamStart.toISOString()}. All upstream work must finish before a ` +
          `task can begin.`,
      );
    }
  } else {
    if (downstreamStart > ancestorStart || ancestorEnd > downstreamEnd) {
      throw new Error(
        `Deadline conflict: objective ${ancestor.id} ("${ancestor.description}")'s interval ` +
          `[${ancestorStart.toISOString()}, ${ancestorEnd.toISOString()}] is not ` +
          `fully contained within downstream goal objective ${downstream.id} ` +
          `("${downstream.description}")'s interval [${downstreamStart.toISOString()}, ` +
          `${downstreamEnd.toISOString()}].`,
      );
    }
  }
}

// Batch-fetches full node data for a set of ids, mirroring the query shape
// the cycle-detection BFS in ObjectiveEdgeService already uses elsewhere in
// this codebase (`objective.findMany({ where: { id: { in: [...] } } })`).
// Skips the round trip entirely when there's nothing to fetch.
async function hydrate(ids: Set<number>): Promise<DeadlineNode[]> {
  if (ids.size === 0) return [];
  const objectives = await prisma.objective.findMany({
    where: { id: { in: [...ids] } },
  });
  return objectives as DeadlineNode[];
}

/**
 * BFS the childId-chain outward from `objectiveId`: an edge's `parentId` is
 * the downstream/later objective and `childId` is the upstream/earlier one,
 * so an ancestor of X is found by following edges where `parentId` is in
 * the current frontier and collecting the `childId` side, transitively.
 */
export async function getAncestors(
  objectiveId: number,
): Promise<DeadlineNode[]> {
  const visited = new Set<number>([objectiveId]);
  const collected = new Set<number>();
  let frontier: number[] = [objectiveId];

  while (frontier.length > 0) {
    const edges = await prisma.objectiveEdge.findMany({
      where: { parentId: { in: frontier } },
      select: { childId: true },
    });

    const next: number[] = [];
    for (const edge of edges) {
      if (!visited.has(edge.childId)) {
        visited.add(edge.childId);
        collected.add(edge.childId);
        next.push(edge.childId);
      }
    }
    frontier = next;
  }

  return hydrate(collected);
}

/**
 * Mirror of getAncestors: follows edges where `childId` is in the current
 * frontier and collects the `parentId` side, transitively, to find every
 * node downstream of `objectiveId`.
 */
export async function getDescendants(
  objectiveId: number,
): Promise<DeadlineNode[]> {
  const visited = new Set<number>([objectiveId]);
  const collected = new Set<number>();
  let frontier: number[] = [objectiveId];

  while (frontier.length > 0) {
    const edges = await prisma.objectiveEdge.findMany({
      where: { childId: { in: frontier } },
      select: { parentId: true },
    });

    const next: number[] = [];
    for (const edge of edges) {
      if (!visited.has(edge.parentId)) {
        visited.add(edge.parentId);
        collected.add(edge.parentId);
        next.push(edge.parentId);
      }
    }
    frontier = next;
  }

  return hydrate(collected);
}

/**
 * Used by ObjectiveService.updateObjective whenever a node's isTask flag or
 * deadline interval is changing: re-checks the node against every ancestor
 * and descendant it *already* has via existing edges (we can't touch the
 * edges themselves here, only validate that the node's new deadlines still
 * satisfy them).
 */
export async function validateDeadlinesAgainstGraph(
  node: DeadlineNode,
): Promise<void> {
  const [ancestors, descendants] = await Promise.all([
    getAncestors(node.id),
    getDescendants(node.id),
  ]);

  for (const ancestor of ancestors) {
    checkDeadlinePair(ancestor, node);
  }
  for (const descendant of descendants) {
    // The rule to apply is always chosen by the DOWNSTREAM node's own
    // isTask flag, so here that's the descendant's, not `node`'s.
    checkDeadlinePair(node, descendant);
  }
}

/**
 * Used by ObjectiveEdgeService.createObjectiveEdge for a proposed
 * childId -> parentId edge (child is upstream, parent is downstream).
 * Scoped to the affected subgraph only -- (ancestors(child) ∪ {child}) on
 * the upstream side, crossed with (descendants(parent) ∪ {parent}) on the
 * downstream side -- rather than the whole map's graph, since nodes outside
 * this subgraph can't be affected by adding this one edge.
 */
export async function validateEdgeDeadlines(
  parent: DeadlineNode,
  child: DeadlineNode,
): Promise<void> {
  const [ancestorsOfChild, descendantsOfParent] = await Promise.all([
    getAncestors(child.id),
    getDescendants(parent.id),
  ]);

  const upstreamSet = [child, ...ancestorsOfChild];
  const downstreamSet = [parent, ...descendantsOfParent];

  for (const upstream of upstreamSet) {
    for (const downstream of downstreamSet) {
      checkDeadlinePair(upstream, downstream);
    }
  }
}
