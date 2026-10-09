import prisma from "../lib/prisma";
import { parseCounterLabels } from "./ObjectiveParser";
import {
  checkDeadlinePair,
  getAncestors,
  getDescendants,
  type DeadlineNode,
} from "./ObjectiveDeadlineService";

const DESCRIPTION_WORD_LIMIT = 25;

// A deadline interval must span at least this long. Chosen to rule out a
// single-instant "deadline" (start === end), which isn't a meaningful window
// to plan work inside of, while still allowing arbitrarily short real
// windows. Amendment to the original (nullable) deadline design: a
// zero-length or negative interval is never valid, mandatory or not.
const MIN_DEADLINE_DURATION_MS = 60_000;

export interface CreateObjectiveInput {
  description: string;
  isTask: boolean;
  mapId: number;
  // Accepted as raw JSON values (e.g. ISO strings from the controller's
  // req.body pass-through), not `Date` instances -- resolveDeadlines below
  // normalizes them into real Dates (or null) before anything touches
  // Prisma.
  deadlineStart: unknown;
  deadlineEnd: unknown;
}

export interface UpdateObjectiveInput {
  id: number;
  description: string;
  isTask: boolean;
  deadlineStart: unknown;
  deadlineEnd: unknown;
}

function validateObjectiveInput(description: string, isTask: boolean) {
  if (!description || description.trim().length === 0) {
    throw new Error("description is required");
  }

  const wordCount = description.trim().split(/\s+/).length;
  if (wordCount > DESCRIPTION_WORD_LIMIT) {
    throw new Error(
      `description must be ${DESCRIPTION_WORD_LIMIT} words or fewer (got ${wordCount})`,
    );
  }

  if (typeof isTask !== "boolean") {
    throw new Error("isTask must be a boolean");
  }
}

const BOTH_OR_NEITHER_ERROR =
  "deadlineStart and deadlineEnd must both be set or both be null";

// Deadlines are nullable: a resolved pair is either both null ("no
// deadline") or both real Dates -- never lopsided. "Resolving" a single
// field means:
//   - input === undefined -> inherit `existingValue` (used on update to mean
//     "omitted, leave unchanged"; create always passes `null` as the
//     existing value, since there's no prior row, so omitted-on-create
//     collapses to "no deadline" just like explicit null does).
//   - input === null       -> explicitly clear the field (resolves to null).
//   - anything else        -> parse it as a Date, throwing on an invalid one.
function resolveDeadlineField(
  input: unknown,
  existingValue: Date | null,
  fieldName: "deadlineStart" | "deadlineEnd",
): Date | null {
  if (input === undefined) return existingValue;
  if (input === null) return null;

  const parsed = new Date(input as string | number | Date);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid date`);
  }
  return parsed;
}

// Resolves a raw (deadlineStart, deadlineEnd) input pair against whatever
// the field already holds (null/null on create, since there's no existing
// row), then validates the RESOLVED pair:
//   - exactly one resolves to non-null -> both-or-neither error.
//   - both resolve to non-null -> existing valid-date-format (handled by
//     resolveDeadlineField above) + 60-second-minimum-duration checks apply.
//   - both resolve to null -> valid "no deadline" state, no further checks.
function resolveDeadlines(
  input: { deadlineStart: unknown; deadlineEnd: unknown },
  existing: { deadlineStart: Date | null; deadlineEnd: Date | null },
): { deadlineStart: Date | null; deadlineEnd: Date | null } {
  const resolvedStart = resolveDeadlineField(
    input.deadlineStart,
    existing.deadlineStart,
    "deadlineStart",
  );
  const resolvedEnd = resolveDeadlineField(
    input.deadlineEnd,
    existing.deadlineEnd,
    "deadlineEnd",
  );

  if ((resolvedStart === null) !== (resolvedEnd === null)) {
    throw new Error(BOTH_OR_NEITHER_ERROR);
  }

  if (resolvedStart !== null && resolvedEnd !== null) {
    if (
      resolvedEnd.getTime() - resolvedStart.getTime() <
      MIN_DEADLINE_DURATION_MS
    ) {
      throw new Error(
        "deadlineEnd must be at least 60 seconds after deadlineStart",
      );
    }
  }

  return { deadlineStart: resolvedStart, deadlineEnd: resolvedEnd };
}

// Null-safe equality check used to detect whether a node's deadline interval
// actually changed across an update -- null-to-null counts as unchanged.
function dateEquals(a: Date | null, b: Date | null): boolean {
  if (a === null || b === null) return a === b;
  return a.getTime() === b.getTime();
}

function resolveCounterLabel(
  description: string,
  isTask: boolean,
): string | null {
  if (!isTask) return null;

  const labels = parseCounterLabels(description);

  if (labels.length > 1) {
    throw new Error(
      "There should only be one counter for each objective. Break down the goal if you need to.",
    );
  }

  return labels.length === 1 ? labels[0] : null;
}

export async function createObjective(data: CreateObjectiveInput) {
  const { description, isTask, mapId } = data;

  // --- Validation (business rules Prisma can't enforce) ---
  // Ordered so the cheapest/most-fundamental checks fail fastest: basic
  // field shape, then mapId (needs a DB round trip), then the
  // placeholder/counter rule, and only then the deadline fields -- matching
  // the exact precedence the test suite pins (e.g. an invalid mapId or a
  // multi-placeholder description must be reported even when deadlines are
  // also missing/invalid).
  validateObjectiveInput(description, isTask);

  if (!Number.isInteger(mapId)) {
    throw new Error("mapId is required and must be a valid integer");
  }

  const map = await prisma.map.findUnique({ where: { id: mapId } });
  if (!map) {
    throw new Error("mapId does not reference an existing map");
  }

  const counterLabel = resolveCounterLabel(description, isTask);

  // There is no existing row on create, so "omitted" and "explicit null"
  // are equivalent -- both resolve to null via the { deadlineStart: null,
  // deadlineEnd: null } existing-value stand-in below, producing a "no
  // deadline" objective unless real values are actually provided.
  const { deadlineStart, deadlineEnd } = resolveDeadlines(
    { deadlineStart: data.deadlineStart, deadlineEnd: data.deadlineEnd },
    { deadlineStart: null, deadlineEnd: null },
  );

  // Note: no ancestor/descendant graph revalidation here -- a brand-new
  // objective can't yet be referenced by any ObjectiveEdge (edges only ever
  // link already-existing ids), so there is nothing in the graph to check.

  // --- Create ---
  return prisma.objective.create({
    data: {
      description,
      isTask,
      mapId,
      deadlineStart,
      deadlineEnd,
      counter: counterLabel
        ? {
            create: {
              label: counterLabel,
              targetQuantity: null,
            },
          }
        : undefined,
    },
    include: { counter: true },
  });
}

export async function updateObjective(data: UpdateObjectiveInput) {
  const { id, description, isTask } = data;

  // --- Existence check ---
  const existing = await prisma.objective.findUnique({
    where: { id },
    include: { counter: true },
  });
  if (!existing) {
    throw new Error("objective not found");
  }

  // --- Validation (same checks as createObjective, same precedence) ---
  // Placeholder/counter validation is checked before deadlines here too, so
  // e.g. a multi-placeholder description is reported even when deadlines are
  // also missing/invalid.
  validateObjectiveInput(description, isTask);
  const counterLabel = resolveCounterLabel(description, isTask);

  // On update, an OMITTED field inherits the existing row's current value
  // for that field; an EXPLICIT null always clears it. The both-or-neither
  // check (inside resolveDeadlines) runs against this RESOLVED pair, not the
  // raw input.
  const { deadlineStart, deadlineEnd } = resolveDeadlines(
    { deadlineStart: data.deadlineStart, deadlineEnd: data.deadlineEnd },
    {
      deadlineStart: existing.deadlineStart,
      deadlineEnd: existing.deadlineEnd,
    },
  );

  // --- Deadline propagation revalidation against the EXISTING graph ---
  // Editing this node's own fields can silently invalidate promises already
  // made to its neighbours (we aren't touching any edges here, so the graph
  // shape is fixed -- only this node's isTask/interval can change):
  //   - Ancestors are re-checked whenever isTask OR the interval changes,
  //     because checkDeadlinePair's rule is chosen by the DOWNSTREAM node's
  //     isTask, and this node is the downstream side relative to its
  //     ancestors.
  //   - Descendants are re-checked only when the interval changes, because
  //     on that side the rule is chosen by each DESCENDANT's own isTask
  //     (unaffected by this update) -- only this node's interval matters
  //     there.
  // When neither changes, skip the graph walk entirely (this is also what
  // keeps a plain description-only edit cheap).
  const isTaskChanged = isTask !== existing.isTask;
  const intervalChanged =
    !dateEquals(deadlineStart, existing.deadlineStart) ||
    !dateEquals(deadlineEnd, existing.deadlineEnd);

  if (isTaskChanged || intervalChanged) {
    const updatedNode: DeadlineNode = {
      id,
      description,
      isTask,
      deadlineStart,
      deadlineEnd,
    };

    const ancestors = await getAncestors(id);
    for (const ancestor of ancestors) {
      checkDeadlinePair(ancestor, updatedNode);
    }

    if (intervalChanged) {
      const descendants = await getDescendants(id);
      for (const descendant of descendants) {
        checkDeadlinePair(updatedNode, descendant);
      }
    }
  }

  // --- Reconcile the counter against whatever it already was ---
  let counterOperation:
    | { create: { label: string; targetQuantity: null } }
    | { update: { label: string; targetQuantity: null } }
    | { delete: true }
    | undefined;

  if (counterLabel) {
    if (!existing.counter) {
      counterOperation = {
        create: { label: counterLabel, targetQuantity: null },
      };
    } else if (existing.counter.label !== counterLabel) {
      counterOperation = {
        update: { label: counterLabel, targetQuantity: null },
      };
    }
  } else if (existing.counter) {
    counterOperation = { delete: true };
  }

  // --- Update ---
  return prisma.objective.update({
    where: { id },
    data: {
      description,
      isTask,
      deadlineStart,
      deadlineEnd,
      counter: counterOperation,
    },
    include: { counter: true },
  });
}
