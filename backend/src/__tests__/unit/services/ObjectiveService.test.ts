/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createObjective,
  updateObjective,
} from "../../../services/ObjectiveService";
import prisma from "../../../lib/prisma";

vi.mock("../../../lib/prisma");

const VALID_MAP_ID = 7;

// --- deadline fixtures -----------------------------------------------------
// Deadlines are NULLABLE on every create/update call, but "omitted" and
// "explicit null" are NOT interchangeable once an existing row is involved:
//
//   - On CREATE there is no existing row, so both missing (omitted) and both
//     explicitly `null` are equivalent -- both produce a "no deadline"
//     objective (persisted as `{ deadlineStart: null, deadlineEnd: null }`).
//   - On UPDATE, an OMITTED field means "leave unchanged" (inherit whatever
//     the existing row already has for that field); an EXPLICIT `null`
//     always means "clear this field". The both-or-neither invariant is
//     checked against the FINAL RESOLVED pair (after applying inheritance
//     for any omitted field), not the raw input.
//
// Providing exactly one field (with the other resolving to null, whether by
// omission-with-no-existing-value or explicit null) is a validation error:
// "deadlineStart and deadlineEnd must both be set or both be null". Providing
// both (or resolving both to non-null) goes through the existing
// valid-date-parsing + 60-second-minimum-duration logic unchanged. The
// service is expected to accept ISO date strings on the way in (mirroring
// the controller's current req.body pass-through for create, and its manual
// field-picking for update -- both of which hand the service raw JSON
// values, not Date instances) and persist parsed `Date` objects, since
// Prisma's DateTime columns require real Date instances (or null).
const VALID_DEADLINE_START = "2026-01-01T00:00:00.000Z";
const VALID_DEADLINE_END = "2026-01-10T00:00:00.000Z";
const VALID_DEADLINES = {
  deadlineStart: VALID_DEADLINE_START,
  deadlineEnd: VALID_DEADLINE_END,
};
// What the service is expected to hand to Prisma for the above input.
const EXPECTED_DEADLINES = {
  deadlineStart: new Date(VALID_DEADLINE_START),
  deadlineEnd: new Date(VALID_DEADLINE_END),
};

beforeEach(() => {
  // Most createObjective tests need mapId validation to pass so they can
  // reach the business logic under test; individual mapId-validation tests
  // override this mock as needed.
  prisma.map.findUnique.mockResolvedValue({
    id: VALID_MAP_ID,
    name: "Test Map",
    type: "Project",
  } as any);

  // updateObjective is expected to propagate-check new deadlines/isTask
  // against the objective's EXISTING ancestors/descendants (via
  // ObjectiveDeadlineService, which queries prisma.objectiveEdge.findMany /
  // prisma.objective.findMany under the hood). Defaulting this to "no
  // edges" means tests that aren't concerned with deadline propagation
  // don't need to know about this plumbing at all; the dedicated
  // propagation tests below override it explicitly.
  prisma.objectiveEdge.findMany.mockResolvedValue([]);
});

describe("createObjective", () => {
  // --- description validation ---
  // (These throw before deadline validation is ever reached, so they don't
  // need valid deadlines in their input.)

  it("throws if description is empty", async () => {
    await expect(
      createObjective({ description: "", isTask: false, mapId: VALID_MAP_ID }),
    ).rejects.toThrow("description is required");
  });

  it("throws if description is only whitespace", async () => {
    await expect(
      createObjective({
        description: "   ",
        isTask: false,
        mapId: VALID_MAP_ID,
      }),
    ).rejects.toThrow("description is required");
  });

  it("throws if description exceeds 25 words", async () => {
    const longDescription = Array(26).fill("word").join(" ");
    await expect(
      createObjective({
        description: longDescription,
        isTask: false,
        mapId: VALID_MAP_ID,
      }),
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
      createObjective({
        description: exactDescription,
        isTask: false,
        mapId: VALID_MAP_ID,
        ...VALID_DEADLINES,
      }),
    ).resolves.toBeDefined();
  });

  // --- isTask type validation ---

  it("throws if isTask is not a boolean", async () => {
    await expect(
      createObjective({
        description: "test",
        isTask: "yes" as any,
        mapId: VALID_MAP_ID,
      }),
    ).rejects.toThrow("isTask must be a boolean");
  });

  // --- deadline validation (nullable, both-or-neither) ---
  // Deadlines are nullable: both missing/null is a valid "no deadline"
  // state, but exactly one provided is a validation error -- a half-open
  // deadline isn't a meaningful planning window. These checks are assumed to
  // run immediately after the description/isTask checks above, so
  // `prisma.objective.create` must never be reached for any of the rejecting
  // cases.

  it("throws the both-or-neither error when deadlineStart is provided but deadlineEnd is omitted", async () => {
    await expect(
      createObjective({
        description: "test",
        isTask: false,
        mapId: VALID_MAP_ID,
        deadlineStart: VALID_DEADLINE_START,
      } as any),
    ).rejects.toThrow(
      /deadlineStart and deadlineEnd must both be set or both be null/i,
    );
    expect(prisma.objective.create).not.toHaveBeenCalled();
  });

  it("throws the both-or-neither error when deadlineEnd is provided but deadlineStart is omitted", async () => {
    await expect(
      createObjective({
        description: "test",
        isTask: false,
        mapId: VALID_MAP_ID,
        deadlineEnd: VALID_DEADLINE_END,
      } as any),
    ).rejects.toThrow(
      /deadlineStart and deadlineEnd must both be set or both be null/i,
    );
    expect(prisma.objective.create).not.toHaveBeenCalled();
  });

  it("throws the both-or-neither error when deadlineStart is null and deadlineEnd is provided", async () => {
    await expect(
      createObjective({
        description: "test",
        isTask: false,
        mapId: VALID_MAP_ID,
        deadlineStart: null,
        deadlineEnd: VALID_DEADLINE_END,
      } as any),
    ).rejects.toThrow(
      /deadlineStart and deadlineEnd must both be set or both be null/i,
    );
    expect(prisma.objective.create).not.toHaveBeenCalled();
  });

  it("throws the both-or-neither error when deadlineEnd is null and deadlineStart is provided", async () => {
    await expect(
      createObjective({
        description: "test",
        isTask: false,
        mapId: VALID_MAP_ID,
        deadlineStart: VALID_DEADLINE_START,
        deadlineEnd: null,
      } as any),
    ).rejects.toThrow(
      /deadlineStart and deadlineEnd must both be set or both be null/i,
    );
    expect(prisma.objective.create).not.toHaveBeenCalled();
  });

  it("creates an objective with null deadlines when both are omitted", async () => {
    prisma.objective.create.mockResolvedValue({
      id: 1,
      deadlineStart: null,
      deadlineEnd: null,
    } as any);

    await expect(
      createObjective({
        description: "test",
        isTask: false,
        mapId: VALID_MAP_ID,
      } as any),
    ).resolves.toBeDefined();

    expect(prisma.objective.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deadlineStart: null,
        deadlineEnd: null,
      }),
      include: { counter: true },
    });
  });

  it("creates an objective with null deadlines when both are explicitly passed as null", async () => {
    prisma.objective.create.mockResolvedValue({
      id: 1,
      deadlineStart: null,
      deadlineEnd: null,
    } as any);

    await expect(
      createObjective({
        description: "test",
        isTask: false,
        mapId: VALID_MAP_ID,
        deadlineStart: null,
        deadlineEnd: null,
      } as any),
    ).resolves.toBeDefined();

    expect(prisma.objective.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deadlineStart: null,
        deadlineEnd: null,
      }),
      include: { counter: true },
    });
  });

  it("throws if deadlineStart is after deadlineEnd", async () => {
    await expect(
      createObjective({
        description: "test",
        isTask: false,
        mapId: VALID_MAP_ID,
        deadlineStart: "2026-01-10T00:00:00.000Z",
        deadlineEnd: "2026-01-01T00:00:00.000Z",
      }),
    ).rejects.toThrow(/deadlineStart.*deadlineEnd|deadline/i);
    expect(prisma.objective.create).not.toHaveBeenCalled();
  });

  it("throws when deadlineStart === deadlineEnd (amendment: a minimum 1-minute duration is now required, so a single instant is no longer valid)", async () => {
    const instant = "2026-01-05T00:00:00.000Z";

    await expect(
      createObjective({
        description: "test",
        isTask: false,
        mapId: VALID_MAP_ID,
        deadlineStart: instant,
        deadlineEnd: instant,
      }),
    ).rejects.toThrow(/deadline/i);
    expect(prisma.objective.create).not.toHaveBeenCalled();
  });

  it("throws when deadlineEnd is less than 60 seconds after deadlineStart", async () => {
    await expect(
      createObjective({
        description: "test",
        isTask: false,
        mapId: VALID_MAP_ID,
        deadlineStart: "2026-01-05T00:00:00.000Z",
        deadlineEnd: "2026-01-05T00:00:59.000Z", // 59 seconds -- just under the minimum
      }),
    ).rejects.toThrow(/deadline/i);
    expect(prisma.objective.create).not.toHaveBeenCalled();
  });

  it("accepts deadlineEnd exactly 60 seconds after deadlineStart (minimum-duration boundary is inclusive)", async () => {
    prisma.objective.create.mockResolvedValue({ id: 1 } as any);

    await expect(
      createObjective({
        description: "test",
        isTask: false,
        mapId: VALID_MAP_ID,
        deadlineStart: "2026-01-05T00:00:00.000Z",
        deadlineEnd: "2026-01-05T00:01:00.000Z", // exactly 60 seconds
      }),
    ).resolves.toBeDefined();
  });

  it("does not attempt any ancestor/descendant graph traversal on create", async () => {
    // A brand-new objective cannot yet be linked by any ObjectiveEdge (edges
    // only reference already-existing objective ids), so there is nothing
    // for the deadline-propagation graph walk to check on create.
    prisma.objective.create.mockResolvedValue({ id: 1 } as any);

    await createObjective({
      description: "test",
      isTask: false,
      mapId: VALID_MAP_ID,
      ...VALID_DEADLINES,
    });

    expect(prisma.objectiveEdge.findMany).not.toHaveBeenCalled();
  });

  // --- mapId validation ---

  it("throws if mapId is not a valid integer", async () => {
    await expect(
      createObjective({
        description: "test",
        isTask: false,
        mapId: "not-a-number" as any,
      }),
    ).rejects.toThrow("mapId is required and must be a valid integer");
  });

  it("throws if mapId does not reference an existing map", async () => {
    prisma.map.findUnique.mockResolvedValue(null);

    await expect(
      createObjective({ description: "test", isTask: false, mapId: 999 }),
    ).rejects.toThrow("mapId does not reference an existing map");

    expect(prisma.objective.create).not.toHaveBeenCalled();
  });

  // --- objective (isTask: false) — no counter parsing should happen ---

  it("creates a plain objective with no counter when isTask is false", async () => {
    const input = {
      description: "Get stronger",
      isTask: false,
      mapId: VALID_MAP_ID,
      ...VALID_DEADLINES,
    };
    prisma.objective.create.mockResolvedValue({ ...input, id: 1 } as any);

    const result = await createObjective(input);

    expect(result).toStrictEqual({ ...input, id: 1 });
    expect(prisma.objective.create).toHaveBeenCalledWith({
      data: {
        description: "Get stronger",
        isTask: false,
        mapId: VALID_MAP_ID,
        ...EXPECTED_DEADLINES,
        counter: undefined,
      },
      include: { counter: true },
    });
  });

  it("does not attach a counter even if description contains a placeholder, when isTask is false", async () => {
    prisma.objective.create.mockResolvedValue({ id: 1 } as any);

    await createObjective({
      description: "Do {pushups} pushups",
      isTask: false,
      mapId: VALID_MAP_ID,
      ...VALID_DEADLINES,
    });

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
        mapId: VALID_MAP_ID,
      }),
    ).rejects.toThrow(
      "There should only be one counter for each objective. Break down the goal if you need to.",
    );

    expect(prisma.objective.create).not.toHaveBeenCalled();
  });

  it("creates a task with a nested counter when exactly one placeholder is found", async () => {
    const input = {
      description: "Do {pushups} pushups",
      isTask: true,
      mapId: VALID_MAP_ID,
      ...VALID_DEADLINES,
    };
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
        mapId: VALID_MAP_ID,
        ...EXPECTED_DEADLINES,
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
    prisma.objective.create.mockResolvedValue({
      id: 1,
      isTask: true,
      counter: null,
    } as any);

    await createObjective({
      description: "Just get it done",
      isTask: true,
      mapId: VALID_MAP_ID,
      ...VALID_DEADLINES,
    });

    expect(prisma.objective.create).toHaveBeenCalledWith({
      data: {
        description: "Just get it done",
        isTask: true,
        mapId: VALID_MAP_ID,
        ...EXPECTED_DEADLINES,
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
      mapId: VALID_MAP_ID,
      ...VALID_DEADLINES,
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
    const input = {
      description: "test",
      isTask: true,
      mapId: VALID_MAP_ID,
      ...VALID_DEADLINES,
    };
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
      updateObjective({ id: 999, description: "test", isTask: false } as any),
    ).rejects.toThrow("objective not found");

    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  // --- same validation as createObjective ---
  // (These throw before deadline validation, so no deadlines needed here.)

  it("throws if description is empty", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
      // Deadlines are nullable; this fixture uses real dates purely for
      // convenience since the test below isn't exercising deadline behavior.
      deadlineStart: new Date("2025-06-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-06-02T00:00:00.000Z"),
    } as any);

    await expect(
      updateObjective({ id: 1, description: "", isTask: false } as any),
    ).rejects.toThrow("description is required");
  });

  it("throws if description is only whitespace", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
      // Deadlines are nullable; this fixture uses real dates purely for
      // convenience since the test below isn't exercising deadline behavior.
      deadlineStart: new Date("2025-06-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-06-02T00:00:00.000Z"),
    } as any);

    await expect(
      updateObjective({ id: 1, description: "   ", isTask: false } as any),
    ).rejects.toThrow("description is required");
  });

  it("throws if description exceeds 25 words", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
      // Deadlines are nullable; this fixture uses real dates purely for
      // convenience since the test below isn't exercising deadline behavior.
      deadlineStart: new Date("2025-06-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-06-02T00:00:00.000Z"),
    } as any);
    const longDescription = Array(26).fill("word").join(" ");

    await expect(
      updateObjective({
        id: 1,
        description: longDescription,
        isTask: false,
      } as any),
    ).rejects.toThrow("description must be 25 words or fewer (got 26)");
  });

  it("throws if isTask is not a boolean", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
      // Deadlines are nullable; this fixture uses real dates purely for
      // convenience since the test below isn't exercising deadline behavior.
      deadlineStart: new Date("2025-06-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-06-02T00:00:00.000Z"),
    } as any);

    await expect(
      updateObjective({
        id: 1,
        description: "test",
        isTask: "yes" as any,
      } as any),
    ).rejects.toThrow("isTask must be a boolean");
  });

  it("throws if isTask is true and description has more than one placeholder", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: true,
      counter: null,
      deadlineStart: new Date("2025-06-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-06-02T00:00:00.000Z"),
    } as any);

    await expect(
      updateObjective({
        id: 1,
        description: "Do {pushups} pushups and {situps} situps",
        isTask: true,
      } as any),
    ).rejects.toThrow(
      "There should only be one counter for each objective. Break down the goal if you need to.",
    );

    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  // --- deadline validation (nullable, both-or-neither against the FINAL
  // RESOLVED state) ---
  // On update, an OMITTED field inherits whatever the existing row already
  // has (undefined -> inherit), while an EXPLICIT `null` always means
  // "clear this field" -- these are different input shapes with different
  // meanings. The both-or-neither check runs against the resolved pair
  // (after applying inheritance), not the raw input, so "provide one field,
  // omit the other" only rejects when the inherited value for the omitted
  // field doesn't match (null vs non-null) the provided one. The two tests
  // below use an existing objective that already has NO deadline, so the
  // omitted field resolves to null and mismatches the provided real date --
  // see the "partial update" tests further below for the case where the
  // existing row has real dates and omitting one field is a VALID partial
  // update (inheriting the other).

  it("throws the both-or-neither error when deadlineStart is provided but deadlineEnd is omitted, given the existing objective has no deadline (inherited end stays null)", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
      deadlineStart: null,
      deadlineEnd: null,
    } as any);

    await expect(
      updateObjective({
        id: 1,
        description: "test",
        isTask: false,
        deadlineStart: VALID_DEADLINE_START,
      } as any),
    ).rejects.toThrow(
      /deadlineStart and deadlineEnd must both be set or both be null/i,
    );
    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  it("throws the both-or-neither error when deadlineEnd is provided but deadlineStart is omitted, given the existing objective has no deadline (inherited start stays null)", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
      deadlineStart: null,
      deadlineEnd: null,
    } as any);

    await expect(
      updateObjective({
        id: 1,
        description: "test",
        isTask: false,
        deadlineEnd: VALID_DEADLINE_END,
      } as any),
    ).rejects.toThrow(
      /deadlineStart and deadlineEnd must both be set or both be null/i,
    );
    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  it("clears an objective's deadlines to null on update when both fields are explicitly sent as null (distinct from omitting them)", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
      deadlineStart: new Date("2025-06-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-06-02T00:00:00.000Z"),
    } as any);
    prisma.objective.update.mockResolvedValue({
      id: 1,
      deadlineStart: null,
      deadlineEnd: null,
    } as any);

    await updateObjective({
      id: 1,
      description: "new description",
      isTask: false,
      deadlineStart: null,
      deadlineEnd: null,
    } as any);

    expect(prisma.objective.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        description: "new description",
        isTask: false,
        deadlineStart: null,
        deadlineEnd: null,
        counter: undefined,
      },
      include: { counter: true },
    });
  });

  it("preserves the existing deadlines unchanged when both deadlineStart and deadlineEnd are omitted on update (omission means inherit, not clear)", async () => {
    const existingStart = new Date("2025-06-01T00:00:00.000Z");
    const existingEnd = new Date("2025-06-02T00:00:00.000Z");
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
      deadlineStart: existingStart,
      deadlineEnd: existingEnd,
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await updateObjective({
      id: 1,
      description: "new description",
      isTask: false,
    } as any);

    expect(prisma.objective.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        description: "new description",
        isTask: false,
        deadlineStart: existingStart,
        deadlineEnd: existingEnd,
        counter: undefined,
      },
      include: { counter: true },
    });
  });

  it("applies a partial update that provides a new deadlineStart and omits deadlineEnd, inheriting the existing deadlineEnd when the resulting pairing is still valid", async () => {
    const existingEnd = new Date("2026-06-01T00:00:00.000Z");
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
      deadlineStart: new Date("2026-01-01T00:00:00.000Z"),
      deadlineEnd: existingEnd,
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);
    const newStart = "2026-05-01T00:00:00.000Z"; // still >=60s before the inherited existingEnd

    await updateObjective({
      id: 1,
      description: "new description",
      isTask: false,
      deadlineStart: newStart,
    } as any);

    expect(prisma.objective.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        description: "new description",
        isTask: false,
        deadlineStart: new Date(newStart),
        deadlineEnd: existingEnd,
        counter: undefined,
      },
      include: { counter: true },
    });
  });

  it("treats omitted deadlineStart/deadlineEnd as unchanged when the existing objective already has no deadline, and skips the ancestor/descendant graph walk", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
      deadlineStart: null,
      deadlineEnd: null,
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await updateObjective({
      id: 1,
      description: "new description",
      isTask: false,
      // deadlineStart/deadlineEnd deliberately OMITTED (not sent as null) --
      // inherits the existing null/null, so the resolved interval is
      // unchanged.
    } as any);

    expect(prisma.objectiveEdge.findMany).not.toHaveBeenCalled();
  });

  it("treats explicit null deadlineStart/deadlineEnd as unchanged when the existing objective already has no deadline, and skips the ancestor/descendant graph walk", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
      deadlineStart: null,
      deadlineEnd: null,
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await updateObjective({
      id: 1,
      description: "new description",
      isTask: false,
      // deadlineStart/deadlineEnd deliberately sent as EXPLICIT null (not
      // omitted) -- resolves to null/null either way here since the
      // existing row was already null/null, so the interval is still
      // unchanged, just via a different input shape than the test above.
      deadlineStart: null,
      deadlineEnd: null,
    } as any);

    expect(prisma.objectiveEdge.findMany).not.toHaveBeenCalled();
  });

  it("treats null->date as changed and runs the graph walk, passing when the new deadline satisfies the ancestor", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: true,
      counter: null,
      deadlineStart: null,
      deadlineEnd: null,
    } as any);
    // The vacuous-pass skip only applies when a side has NO deadline AFTER
    // the update is resolved -- not because the node had none BEFORE the
    // update. Once this update sets a real deadline, the sequencing rule is
    // actually checked against it, same as if the node always had one. This
    // ancestor's deadlineEnd (2026-02-01) is before the new task's
    // deadlineStart (2026-02-05), so the rule is genuinely satisfied, not
    // skipped.
    prisma.objectiveEdge.findMany.mockImplementation(async ({ where }: any) => {
      if (where?.parentId?.in?.includes(1)) {
        return [{ childId: 2 }] as any;
      }
      return [] as any;
    });
    prisma.objective.findMany.mockResolvedValue([
      {
        id: 2,
        description: "ancestor",
        isTask: false,
        deadlineStart: new Date("2020-01-01T00:00:00.000Z"),
        deadlineEnd: new Date("2026-02-01T00:00:00.000Z"),
      },
    ] as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await expect(
      updateObjective({
        id: 1,
        description: "new description",
        isTask: true,
        deadlineStart: "2026-02-05T00:00:00.000Z",
        deadlineEnd: "2026-02-20T00:00:00.000Z",
      } as any),
    ).resolves.toBeDefined();

    expect(prisma.objectiveEdge.findMany).toHaveBeenCalled();
  });

  it("rejects null->date when the new real deadline genuinely conflicts with a real ancestor deadline (validation re-arms once a real deadline is set)", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: true,
      counter: null,
      deadlineStart: null,
      deadlineEnd: null,
    } as any);
    prisma.objectiveEdge.findMany.mockImplementation(async ({ where }: any) => {
      if (where?.parentId?.in?.includes(1)) {
        return [{ childId: 2 }] as any;
      }
      return [] as any;
    });
    prisma.objective.findMany.mockResolvedValue([
      {
        id: 2,
        description: "ancestor",
        isTask: false,
        deadlineStart: new Date("2026-02-01T00:00:00.000Z"),
        deadlineEnd: new Date("2026-02-10T00:00:00.000Z"),
      },
    ] as any);

    await expect(
      updateObjective({
        id: 1,
        description: "new description",
        isTask: true,
        deadlineStart: "2026-02-05T00:00:00.000Z", // before ancestor's end
        deadlineEnd: "2026-02-20T00:00:00.000Z",
      } as any),
    ).rejects.toThrow();

    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  it("treats date->null as changed, runs the graph walk, and passes vacuously regardless of the ancestor's own deadlines", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: true,
      counter: null,
      deadlineStart: new Date("2025-01-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-01-02T00:00:00.000Z"),
    } as any);
    // Ancestor deliberately violates the OLD rule (ends after the old
    // deadlineStart would require) -- clearing to null must not be blocked
    // by this stale neighbor state.
    prisma.objectiveEdge.findMany.mockImplementation(async ({ where }: any) => {
      if (where?.parentId?.in?.includes(1)) {
        return [{ childId: 2 }] as any;
      }
      return [] as any;
    });
    prisma.objective.findMany.mockResolvedValue([
      {
        id: 2,
        description: "ancestor",
        isTask: false,
        deadlineStart: new Date("2024-12-01T00:00:00.000Z"),
        deadlineEnd: new Date("2025-06-01T00:00:00.000Z"), // after old deadlineStart
      },
    ] as any);
    prisma.objective.update.mockResolvedValue({
      id: 1,
      deadlineStart: null,
      deadlineEnd: null,
    } as any);

    await expect(
      updateObjective({
        id: 1,
        description: "new description",
        isTask: true,
        // EXPLICIT null on both -- omitting them here would instead INHERIT
        // the existing real deadlines (no change), which would skip the
        // graph walk entirely and defeat the point of this test.
        deadlineStart: null,
        deadlineEnd: null,
      } as any),
    ).resolves.toBeDefined();

    expect(prisma.objectiveEdge.findMany).toHaveBeenCalled();
    expect(prisma.objective.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          deadlineStart: null,
          deadlineEnd: null,
        }),
      }),
    );
  });

  it("throws if deadlineStart is after deadlineEnd", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
      // Deadlines are nullable; this fixture uses real dates purely for
      // convenience since the test below isn't exercising deadline behavior.
      deadlineStart: new Date("2025-06-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-06-02T00:00:00.000Z"),
    } as any);

    await expect(
      updateObjective({
        id: 1,
        description: "test",
        isTask: false,
        deadlineStart: "2026-01-10T00:00:00.000Z",
        deadlineEnd: "2026-01-01T00:00:00.000Z",
      } as any),
    ).rejects.toThrow(/deadline/i);
    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  it("throws when deadlineStart === deadlineEnd (amendment: a minimum 1-minute duration is now required, so a single instant is no longer valid)", async () => {
    const instant = "2026-01-05T00:00:00.000Z";
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
      // Deadlines are nullable; this fixture uses real dates purely for
      // convenience since the test below isn't exercising deadline behavior.
      deadlineStart: new Date("2025-06-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-06-02T00:00:00.000Z"),
    } as any);

    await expect(
      updateObjective({
        id: 1,
        description: "test",
        isTask: false,
        deadlineStart: instant,
        deadlineEnd: instant,
      } as any),
    ).rejects.toThrow(/deadline/i);
    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  it("throws when deadlineEnd is less than 60 seconds after deadlineStart", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
      // Deadlines are nullable; this fixture uses real dates purely for
      // convenience since the test below isn't exercising deadline behavior.
      deadlineStart: new Date("2025-06-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-06-02T00:00:00.000Z"),
    } as any);

    await expect(
      updateObjective({
        id: 1,
        description: "test",
        isTask: false,
        deadlineStart: "2026-01-05T00:00:00.000Z",
        deadlineEnd: "2026-01-05T00:00:59.000Z", // 59 seconds -- just under the minimum
      } as any),
    ).rejects.toThrow(/deadline/i);
    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  it("accepts deadlineEnd exactly 60 seconds after deadlineStart (minimum-duration boundary is inclusive)", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
      // Deadlines are nullable; this fixture uses real dates purely for
      // convenience since the test below isn't exercising deadline behavior.
      deadlineStart: new Date("2025-06-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-06-02T00:00:00.000Z"),
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await expect(
      updateObjective({
        id: 1,
        description: "test",
        isTask: false,
        deadlineStart: "2026-01-05T00:00:00.000Z",
        deadlineEnd: "2026-01-05T00:01:00.000Z", // exactly 60 seconds
      } as any),
    ).resolves.toBeDefined();
  });

  // --- deadline propagation against existing graph (ancestors/descendants) ---
  // Per the plan: on update, if this is a create (n/a here) or the
  // deadlines/isTask are changing, propagate-check the objective against its
  // EXISTING ancestors (childId-chain) and descendants (parentId-chain)
  // using ObjectiveDeadlineService's rule logic. `prisma.objectiveEdge
  // .findMany` is mocked to `[]` by the top-level beforeEach by default; the
  // tests below override it to simulate a real graph.

  it("rejects an update when an existing ancestor violates the sequencing rule against the new (isTask: true) deadlines", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: true,
      counter: null,
      // Prior (pre-update) deadlines -- unrelated to the new ones being
      // submitted below. Deadlines are mandatory everywhere now, so even
      // this "existing" fixture must carry real dates, not null.
      deadlineStart: new Date("2025-01-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-01-02T00:00:00.000Z"),
    } as any);
    // Existing edge: ancestor (id 2) -> this objective (id 1). Ancestor's
    // deadlineEnd is after the new deadlineStart being submitted below.
    prisma.objectiveEdge.findMany.mockImplementation(async ({ where }: any) => {
      if (where?.parentId?.in?.includes(1)) {
        return [{ childId: 2 }] as any;
      }
      return [] as any;
    });
    prisma.objective.findMany.mockResolvedValue([
      {
        id: 2,
        description: "ancestor",
        isTask: false,
        deadlineStart: new Date("2026-02-01T00:00:00.000Z"),
        deadlineEnd: new Date("2026-02-10T00:00:00.000Z"),
      },
    ] as any);

    await expect(
      updateObjective({
        id: 1,
        description: "new description",
        isTask: true,
        deadlineStart: "2026-02-05T00:00:00.000Z", // before ancestor's end
        deadlineEnd: "2026-02-20T00:00:00.000Z",
      } as any),
    ).rejects.toThrow();

    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  it("accepts an update when every existing ancestor satisfies the sequencing rule", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: true,
      counter: null,
      // Prior (pre-update) deadlines -- unrelated to the new ones being
      // submitted below. Deadlines are mandatory everywhere now, so even
      // this "existing" fixture must carry real dates, not null.
      deadlineStart: new Date("2025-01-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-01-02T00:00:00.000Z"),
    } as any);
    prisma.objectiveEdge.findMany.mockImplementation(async ({ where }: any) => {
      if (where?.parentId?.in?.includes(1)) {
        return [{ childId: 2 }] as any;
      }
      return [] as any;
    });
    prisma.objective.findMany.mockResolvedValue([
      {
        id: 2,
        description: "ancestor",
        isTask: false,
        deadlineStart: new Date("2026-01-01T00:00:00.000Z"),
        deadlineEnd: new Date("2026-01-05T00:00:00.000Z"),
      },
    ] as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await expect(
      updateObjective({
        id: 1,
        description: "new description",
        isTask: true,
        deadlineStart: "2026-02-05T00:00:00.000Z", // well after ancestor's end
        deadlineEnd: "2026-02-20T00:00:00.000Z",
      } as any),
    ).resolves.toBeDefined();
  });

  it("rejects an update when an existing descendant's own rule is violated by the new deadlines", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old",
      isTask: false,
      counter: null,
      // Prior (pre-update) deadlines -- unrelated to the new ones being
      // submitted below. Deadlines are mandatory everywhere now, so even
      // this "existing" fixture must carry real dates, not null.
      deadlineStart: new Date("2025-01-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-01-02T00:00:00.000Z"),
    } as any);
    // Existing edge: this objective (id 1) -> descendant (id 2), i.e. 2 is
    // downstream of 1. Descendant is a task, so the sequencing rule applies
    // with descendant as downstream: this node's new deadlineEnd must be
    // <= descendant's deadlineStart.
    prisma.objectiveEdge.findMany.mockImplementation(async ({ where }: any) => {
      if (where?.childId?.in?.includes(1)) {
        return [{ parentId: 2 }] as any;
      }
      return [] as any;
    });
    prisma.objective.findMany.mockResolvedValue([
      {
        id: 2,
        description: "descendant-task",
        isTask: true,
        deadlineStart: new Date("2026-01-05T00:00:00.000Z"),
        deadlineEnd: new Date("2026-01-10T00:00:00.000Z"),
      },
    ] as any);

    await expect(
      updateObjective({
        id: 1,
        description: "new description",
        isTask: false,
        deadlineStart: "2026-01-01T00:00:00.000Z",
        deadlineEnd: "2026-01-08T00:00:00.000Z", // after descendant's start
      } as any),
    ).rejects.toThrow();

    expect(prisma.objective.update).not.toHaveBeenCalled();
  });

  it("skips the ancestor/descendant graph check entirely when neither isTask nor the deadlines are changing", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old description",
      isTask: false,
      counter: null,
      deadlineStart: EXPECTED_DEADLINES.deadlineStart,
      deadlineEnd: EXPECTED_DEADLINES.deadlineEnd,
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await updateObjective({
      id: 1,
      description: "new description", // only description changes
      isTask: false,
      ...VALID_DEADLINES,
    } as any);

    expect(prisma.objectiveEdge.findMany).not.toHaveBeenCalled();
  });

  // --- counter reconciliation: no existing counter, new label found ---

  it("creates a new counter when isTask becomes true with a placeholder and none existed before", async () => {
    prisma.objective.findUnique.mockResolvedValue({
      id: 1,
      description: "old description",
      isTask: false,
      counter: null,
      deadlineStart: new Date("2025-06-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-06-02T00:00:00.000Z"),
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await updateObjective({
      id: 1,
      description: "Do {pushups} pushups",
      isTask: true,
      ...VALID_DEADLINES,
    } as any);

    expect(prisma.objective.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        description: "Do {pushups} pushups",
        isTask: true,
        ...EXPECTED_DEADLINES,
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
      deadlineStart: new Date("2025-06-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-06-02T00:00:00.000Z"),
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await updateObjective({
      id: 1,
      description: "Do {situps} situps",
      isTask: true,
      ...VALID_DEADLINES,
    } as any);

    expect(prisma.objective.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        description: "Do {situps} situps",
        isTask: true,
        ...EXPECTED_DEADLINES,
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
      deadlineStart: new Date("2025-06-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-06-02T00:00:00.000Z"),
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await updateObjective({
      id: 1,
      description: "Please do {pushups} pushups daily",
      isTask: true,
      ...VALID_DEADLINES,
    } as any);

    expect(prisma.objective.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        description: "Please do {pushups} pushups daily",
        isTask: true,
        ...EXPECTED_DEADLINES,
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
      deadlineStart: new Date("2025-06-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-06-02T00:00:00.000Z"),
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await updateObjective({
      id: 1,
      description: "Get stronger overall",
      isTask: false,
      ...VALID_DEADLINES,
    } as any);

    expect(prisma.objective.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        description: "Get stronger overall",
        isTask: false,
        ...EXPECTED_DEADLINES,
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
      deadlineStart: new Date("2025-06-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-06-02T00:00:00.000Z"),
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await updateObjective({
      id: 1,
      description: "Just get it done",
      isTask: true,
      ...VALID_DEADLINES,
    } as any);

    expect(prisma.objective.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        description: "Just get it done",
        isTask: true,
        ...EXPECTED_DEADLINES,
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
      deadlineStart: new Date("2025-06-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-06-02T00:00:00.000Z"),
    } as any);
    prisma.objective.update.mockResolvedValue({ id: 1 } as any);

    await updateObjective({
      id: 1,
      description: "Still just get it done",
      isTask: true,
      ...VALID_DEADLINES,
    } as any);

    expect(prisma.objective.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: {
        description: "Still just get it done",
        isTask: true,
        ...EXPECTED_DEADLINES,
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
      // Deadlines are nullable; this fixture uses real dates purely for
      // convenience since the test below isn't exercising deadline behavior.
      deadlineStart: new Date("2025-06-01T00:00:00.000Z"),
      deadlineEnd: new Date("2025-06-02T00:00:00.000Z"),
    } as any);
    const updated = {
      id: 1,
      description: "new description",
      isTask: false,
      counter: null,
      ...EXPECTED_DEADLINES,
    };
    prisma.objective.update.mockResolvedValue(updated as any);

    const result = await updateObjective({
      id: 1,
      description: "new description",
      isTask: false,
      ...VALID_DEADLINES,
    } as any);

    expect(result).toStrictEqual(updated);
  });
});
