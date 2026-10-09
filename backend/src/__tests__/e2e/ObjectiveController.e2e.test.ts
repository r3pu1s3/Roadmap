import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import {
  createObjective,
  updateObjective,
} from "../../controllers/ObjectiveController";
import prisma from "../../lib/prisma";

const app = express();
app.use(express.json());
app.post("/objectives", createObjective);
app.patch("/objectives/:id", updateObjective);

// A real Map row that every objective in this file is scoped to — mapId is
// a required, validated field on createObjective, so it has to reference a
// row that actually exists in the database.
let mapId: number;

beforeAll(async () => {
  const map = await prisma.map.create({
    data: { name: "ObjectiveController e2e map" },
  });
  mapId = map.id;
});

afterAll(async () => {
  // Cascade-deletes any objectives (and their counters) left over from a
  // failed test, since Objective.mapId -> Map is onDelete: Cascade.
  await prisma.map.delete({ where: { id: mapId } });
});

const createdIds: number[] = [];

afterEach(async () => {
  if (createdIds.length > 0) {
    await prisma.objective.deleteMany({
      where: { id: { in: createdIds } },
    });
    createdIds.length = 0;
  }
});

// Deadlines are now mandatory on every create/update (an amendment over an
// earlier draft where they were optional) — this pair is spread into every
// pre-existing test's request body below purely so those tests keep
// exercising the behavior they were written for (description/isTask/mapId/
// counter handling) in isolation, without incidentally tripping the new
// deadline validation once it exists. The deadline-specific describe blocks
// at the bottom of this file are what actually exercise that validation.
const VALID_DEADLINE_START = "2025-01-01T00:00:00.000Z";
const VALID_DEADLINE_END = "2025-06-01T00:00:00.000Z";

describe("POST /objectives (end-to-end, real HTTP + real database)", () => {
  it("creates a plain objective and returns 201 with no counter attached", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Get stronger this year",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });

    expect(response.status).toBe(201);
    expect(response.body.counter).toBeNull();
    createdIds.push(response.body.id);
  });

  it("creates a task and returns 201 with a nested counter, targetQuantity null", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Do {pushups} pushups every morning",
      isTask: true,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });

    expect(response.status).toBe(201);
    expect(response.body.counter).toMatchObject({
      label: "pushups",
      targetQuantity: null,
    });
    createdIds.push(response.body.id);
  });

  it("returns 400 and creates nothing when description is missing", async () => {
    const response = await request(app).post("/objectives").send({
      description: "",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("description is required");
  });

  it("returns 400 and creates nothing when the description has more than one placeholder", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Do {pushups} pushups and {situps} situps",
      isTask: true,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "There should only be one counter for each objective. Break down the goal if you need to.",
    );

    const found = await prisma.objective.findFirst({
      where: { description: "Do {pushups} pushups and {situps} situps" },
    });
    expect(found).toBeNull();
  });

  // --- mapId validation ---

  it("returns 400 and creates nothing when mapId is missing", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Get stronger this year",
      isTask: false,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "mapId is required and must be a valid integer",
    );
  });

  it("returns 400 and creates nothing when mapId does not reference an existing map", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Get stronger this year",
      isTask: false,
      mapId: 999999999,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "mapId does not reference an existing map",
    );
  });
});

describe("Database constraints (real database)", () => {
  it("enforces at most one counter per objective at the database level", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Do {pushups} pushups",
      isTask: true,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponse.body.id);

    await expect(
      prisma.objectiveCounter.create({
        data: {
          label: "extra",
          targetQuantity: null,
          objectiveId: createResponse.body.id,
        },
      }),
    ).rejects.toThrow();
  });
});

describe("PATCH /objectives/:id (end-to-end, real HTTP + real database)", () => {
  it("returns 400 when id is not a valid integer", async () => {
    const response = await request(app).patch("/objectives/not-a-number").send({
      description: "test",
      isTask: false,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("id must be a valid integer");
  });

  it("returns 404 when the objective does not exist", async () => {
    const response = await request(app).patch("/objectives/999999999").send({
      description: "test",
      isTask: false,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("objective not found");
  });

  it("updates a plain objective's description and returns 200", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Old description",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "New description",
        isTask: false,
        deadlineStart: VALID_DEADLINE_START,
        deadlineEnd: VALID_DEADLINE_END,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.description).toBe("New description");

    const fromDb = await prisma.objective.findUnique({
      where: { id: createResponse.body.id },
    });
    expect(fromDb?.description).toBe("New description");
  });

  it("ignores an id in the request body and always updates the objective identified by the URL param", async () => {
    const createResponseA = await request(app).post("/objectives").send({
      description: "Objective A",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponseA.body.id);
    const createResponseB = await request(app).post("/objectives").send({
      description: "Objective B",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponseB.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponseA.body.id}`)
      .send({
        id: createResponseB.body.id,
        description: "Updated A",
        isTask: false,
        deadlineStart: VALID_DEADLINE_START,
        deadlineEnd: VALID_DEADLINE_END,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.id).toBe(createResponseA.body.id);

    const objectiveA = await prisma.objective.findUnique({
      where: { id: createResponseA.body.id },
    });
    const objectiveB = await prisma.objective.findUnique({
      where: { id: createResponseB.body.id },
    });
    expect(objectiveA?.description).toBe("Updated A");
    expect(objectiveB?.description).toBe("Objective B");
  });

  it("returns 400 and leaves the objective unchanged when description is missing", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Original",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "",
        isTask: false,
        deadlineStart: VALID_DEADLINE_START,
        deadlineEnd: VALID_DEADLINE_END,
      });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.error).toBe("description is required");

    const fromDb = await prisma.objective.findUnique({
      where: { id: createResponse.body.id },
    });
    expect(fromDb?.description).toBe("Original");
  });

  it("returns 400 when the description has more than one placeholder", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Do {pushups} pushups",
      isTask: true,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "Do {pushups} pushups and {situps} situps",
        isTask: true,
        deadlineStart: VALID_DEADLINE_START,
        deadlineEnd: VALID_DEADLINE_END,
      });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.error).toBe(
      "There should only be one counter for each objective. Break down the goal if you need to.",
    );
  });

  it("creates a new counter over HTTP when a plain objective becomes a task with a placeholder", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Get stronger",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponse.body.id);
    expect(createResponse.body.counter).toBeNull();

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "Do {pushups} pushups",
        isTask: true,
        deadlineStart: VALID_DEADLINE_START,
        deadlineEnd: VALID_DEADLINE_END,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.counter).toMatchObject({
      label: "pushups",
      targetQuantity: null,
    });
  });

  it("deduplicates a repeated placeholder into a single counter row over HTTP", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Get stronger",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "Do {reps} reps, then do {reps} more reps",
        isTask: true,
        deadlineStart: VALID_DEADLINE_START,
        deadlineEnd: VALID_DEADLINE_END,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.counter.label).toBe("reps");

    const counters = await prisma.objectiveCounter.findMany({
      where: { objectiveId: createResponse.body.id },
    });
    expect(counters).toHaveLength(1);
  });

  // it("resets targetQuantity to null over HTTP when the placeholder label changes", async () => {
  //   const createResponse = await request(app).post("/objectives").send({
  //     description: "Do {pushups} pushups",
  //     isTask: true,
  //   });
  //   createdIds.push(createResponse.body.id);

  //   await prisma.objectiveCounter.update({
  //     where: { objectiveId: createResponse.body.id },
  //     data: { targetQuantity: 5 },
  //   });

  //   const updateResponse = await request(app)
  //     .patch(`/objectives/${createResponse.body.id}`)
  //     .send({ description: "Do {situps} situps", isTask: true });

  //   expect(updateResponse.body.counter).toMatchObject({
  //     label: "situps",
  //     targetQuantity: null,
  //   });
  // });

  // it("leaves an existing targetQuantity untouched over HTTP when the placeholder label is unchanged", async () => {
  //   const createResponse = await request(app).post("/objectives").send({
  //     description: "Do {pushups} pushups",
  //     isTask: true,
  //   });
  //   createdIds.push(createResponse.body.id);

  //   await prisma.objectiveCounter.update({
  //     where: { objectiveId: createResponse.body.id },
  //     data: { targetQuantity: 5 },
  //   });

  //   const updateResponse = await request(app)
  //     .patch(`/objectives/${createResponse.body.id}`)
  //     .send({ description: "Please do {pushups} pushups daily", isTask: true });

  //   expect(updateResponse.body.counter).toMatchObject({
  //     label: "pushups",
  //     targetQuantity: 5,
  //   });
  // });

  it("deletes the counter over HTTP when isTask changes to false", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Do {pushups} pushups",
      isTask: true,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "Get stronger overall",
        isTask: false,
        deadlineStart: VALID_DEADLINE_START,
        deadlineEnd: VALID_DEADLINE_END,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.counter).toBeNull();

    const remaining = await prisma.objectiveCounter.findFirst({
      where: { objectiveId: createResponse.body.id },
    });
    expect(remaining).toBeNull();
  });

  // it("deletes the counter over HTTP when the placeholder is removed from the description", async () => {
  //   const createResponse = await request(app).post("/objectives").send({
  //     description: "Do {pushups} pushups",
  //     isTask: true,
  //   });
  //   createdIds.push(createResponse.body.id);

  //   const updateResponse = await request(app)
  //     .patch(`/objectives/${createResponse.body.id}`)
  //     .send({ description: "Just get it done", isTask: true });

  //   expect(updateResponse.body.counter).toBeNull();

  //   const remaining = await prisma.objectiveCounter.findFirst({
  //     where: { objectiveId: createResponse.body.id },
  //   });
  //   expect(remaining).toBeNull();
  // });
});

// --- Deadline validation (feature: objective deadlines) ---
//
// deadlineStart and deadlineEnd are now OPTIONAL on both create and update,
// but remain a strict pair: either both are provided, or both are
// omitted/null. Providing exactly one of the two is a validation error
// (400). On CREATE, there's no existing row to fall back to, so omitting
// both simply creates the objective with null deadlines — there is no NOT
// NULL constraint on these columns anymore (that's the schema migration this
// feature slice starts from).
//
// On UPDATE (PATCH), per-field presence is meaningful and distinguishes
// three states, checked against the FINAL RESOLVED pair (request value
// merged onto the existing row) rather than the raw request body directly:
//   - key absent from the JSON body       -> unchanged, inherits the
//     objective's current stored value for that field.
//   - key present with value `null`       -> explicitly clears that field.
//   - key present with a date value       -> sets that field to the date.
// So omitting both deadline keys on a PATCH leaves an existing deadline
// pair untouched; explicitly sending `deadlineStart: null, deadlineEnd:
// null` is how a client clears a previously-set deadline. The both-or-
// neither invariant is enforced on the resolved pair, so e.g. a PATCH that
// omits deadlineStart while explicitly nulling deadlineEnd on an objective
// that currently HAS a deadlineStart would resolve to "one set, one null"
// and still be rejected.
//
// The separate cross-node deadline-propagation rules (sequencing for tasks,
// umbrella/containment for goals, exercised end-to-end in
// ObjectiveEdgeController.e2e.test.ts) pass vacuously for any pairwise
// ancestor/downstream check where either side's (resolved) deadline is
// null.
//
// An objective's own interval, whenever both deadlines ARE provided, must
// additionally span at least one full minute: deadlineEnd must be >=
// deadlineStart + 60 seconds. Equal start/end (a zero-length window) and any
// gap under 60 seconds are both rejected; a gap of exactly 60 seconds is the
// minimum valid boundary. This own-interval minimum-gap rule is independent
// of, and stricter than, the separate cross-node sequencing/umbrella
// boundary rules exercised in ObjectiveEdgeController.e2e.test.ts, which
// remain inclusive (an ancestor's deadlineEnd exactly equal to a task's
// deadlineStart, or an ancestor's interval edge exactly touching its
// umbrella's, are still accepted there).
const EXACTLY_ONE_MINUTE_AFTER_START = "2025-01-01T00:01:00.000Z";
const LESS_THAN_ONE_MINUTE_AFTER_START = "2025-01-01T00:00:30.000Z";

describe("POST /objectives - deadline validation (end-to-end, real HTTP + real database)", () => {
  it("returns 400 and creates nothing when deadlineStart is provided without deadlineEnd", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Only start deadline provided",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
    });

    expect(response.status).toBe(400);
    // Both-or-neither: supplying exactly one of the pair is rejected, same
    // as the other pairwise deadline-consistency checks below.
    expect(response.body.error.toLowerCase()).toContain("deadline");

    const found = await prisma.objective.findFirst({
      where: { description: "Only start deadline provided", mapId },
    });
    expect(found).toBeNull();
  });

  it("returns 400 and creates nothing when deadlineEnd is provided without deadlineStart", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Only end deadline provided",
      isTask: false,
      mapId,
      deadlineEnd: VALID_DEADLINE_END,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.toLowerCase()).toContain("deadline");

    const found = await prisma.objective.findFirst({
      where: { description: "Only end deadline provided", mapId },
    });
    expect(found).toBeNull();
  });

  it("creates an objective (201) with null deadlines when both are omitted", async () => {
    const response = await request(app).post("/objectives").send({
      description: "No deadline at all",
      isTask: false,
      mapId,
    });

    expect(response.status).toBe(201);
    createdIds.push(response.body.id);
    expect(response.body.deadlineStart).toBeNull();
    expect(response.body.deadlineEnd).toBeNull();

    const fromDb = await prisma.objective.findUnique({
      where: { id: response.body.id },
    });
    expect(fromDb?.deadlineStart).toBeNull();
    expect(fromDb?.deadlineEnd).toBeNull();
  });

  it("returns 400 and creates nothing when deadlineStart is after deadlineEnd", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Inverted deadline range",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_END,
      deadlineEnd: VALID_DEADLINE_START,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.toLowerCase()).toContain("deadline");

    const found = await prisma.objective.findFirst({
      where: { description: "Inverted deadline range", mapId },
    });
    expect(found).toBeNull();
  });

  it("returns 400 and creates nothing when deadlineStart equals deadlineEnd (a zero-length window is not a valid boundary)", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Zero-length deadline",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_START,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.toLowerCase()).toContain("deadline");

    const found = await prisma.objective.findFirst({
      where: { description: "Zero-length deadline", mapId },
    });
    expect(found).toBeNull();
  });

  it("returns 400 and creates nothing when deadlineEnd is less than 60 seconds after deadlineStart", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Deadline gap too short",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: LESS_THAN_ONE_MINUTE_AFTER_START,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.toLowerCase()).toContain("deadline");

    const found = await prisma.objective.findFirst({
      where: { description: "Deadline gap too short", mapId },
    });
    expect(found).toBeNull();
  });

  it("creates an objective and returns 201 when deadlineEnd is exactly 60 seconds after deadlineStart (minimum valid boundary)", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Minimum valid deadline gap",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: EXACTLY_ONE_MINUTE_AFTER_START,
    });

    expect(response.status).toBe(201);
    createdIds.push(response.body.id);
  });

  it("persists deadlineStart and deadlineEnd to the database when both are provided validly", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Valid deadline range",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });

    expect(response.status).toBe(201);
    createdIds.push(response.body.id);

    const fromDb = await prisma.objective.findUnique({
      where: { id: response.body.id },
    });
    expect(fromDb?.deadlineStart?.toISOString()).toBe(
      new Date(VALID_DEADLINE_START).toISOString(),
    );
    expect(fromDb?.deadlineEnd?.toISOString()).toBe(
      new Date(VALID_DEADLINE_END).toISOString(),
    );
  });
});

describe("PATCH /objectives/:id - deadline validation (end-to-end, real HTTP + real database)", () => {
  it("returns 400 and leaves the deadline null when the update provides only deadlineEnd, given the objective has no deadline", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "No deadline, end-only update",
      isTask: false,
      mapId,
    });
    // Only track the id after confirming the create succeeded, so a failed
    // create never pushes `undefined` into the shared cleanup array.
    expect(createResponse.status).toBe(201);
    createdIds.push(createResponse.body.id);

    // deadlineStart is omitted, so it inherits the stored null; deadlineEnd
    // is a real date. The resolved pair is half a pair and must be rejected.
    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "No deadline, end-only update",
        isTask: false,
        deadlineEnd: VALID_DEADLINE_END,
      });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.error.toLowerCase()).toContain("deadline");

    const fromDb = await prisma.objective.findUnique({
      where: { id: createResponse.body.id },
    });
    expect(fromDb?.deadlineStart).toBeNull();
    expect(fromDb?.deadlineEnd).toBeNull();
  });

  it("returns 400 and leaves the deadline null when the update provides only deadlineStart, given the objective has no deadline", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "No deadline, start-only update",
      isTask: false,
      mapId,
    });
    expect(createResponse.status).toBe(201);
    createdIds.push(createResponse.body.id);

    // deadlineEnd is omitted, so it inherits the stored null; deadlineStart
    // is a real date. The resolved pair is half a pair and must be rejected.
    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "No deadline, start-only update",
        isTask: false,
        deadlineStart: VALID_DEADLINE_START,
      });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.error.toLowerCase()).toContain("deadline");

    const fromDb = await prisma.objective.findUnique({
      where: { id: createResponse.body.id },
    });
    expect(fromDb?.deadlineStart).toBeNull();
    expect(fromDb?.deadlineEnd).toBeNull();
  });

  it("clears a previously-set deadline to null over HTTP when both fields are explicitly set to null", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Deadline to be cleared",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponse.body.id);

    // Explicit `null` is how a client clears an existing deadline — merely
    // omitting the keys instead means "leave unchanged" (see the next test).
    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "Deadline to be cleared",
        isTask: false,
        deadlineStart: null,
        deadlineEnd: null,
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.deadlineStart).toBeNull();
    expect(updateResponse.body.deadlineEnd).toBeNull();

    const fromDb = await prisma.objective.findUnique({
      where: { id: createResponse.body.id },
    });
    expect(fromDb?.deadlineStart).toBeNull();
    expect(fromDb?.deadlineEnd).toBeNull();
  });

  it("preserves the existing deadline over HTTP when both deadline fields are omitted from a PATCH body", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Deadline that should survive an unrelated update",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponse.body.id);

    // deadlineStart/deadlineEnd keys are fully absent here (not present,
    // not null) — only an unrelated field is being updated. Omitted keys
    // must inherit the objective's current stored deadline, not clear it.
    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "Deadline that survived an unrelated update",
        isTask: false,
      });

    expect(updateResponse.status).toBe(200);

    const fromDb = await prisma.objective.findUnique({
      where: { id: createResponse.body.id },
    });
    expect(fromDb?.description).toBe(
      "Deadline that survived an unrelated update",
    );
    expect(fromDb?.deadlineStart?.toISOString()).toBe(
      new Date(VALID_DEADLINE_START).toISOString(),
    );
    expect(fromDb?.deadlineEnd?.toISOString()).toBe(
      new Date(VALID_DEADLINE_END).toISOString(),
    );
  });

  it("updates only deadlineStart over HTTP and inherits the existing deadlineEnd when deadlineEnd is omitted from the PATCH body", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Partial deadline update",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponse.body.id);

    // New deadlineStart is still well within 60s+ of the EXISTING (inherited)
    // deadlineEnd, so the resolved pair remains valid.
    const newStart = "2025-02-01T00:00:00.000Z";

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "Partial deadline update",
        isTask: false,
        deadlineStart: newStart,
      });

    expect(updateResponse.status).toBe(200);

    const fromDb = await prisma.objective.findUnique({
      where: { id: createResponse.body.id },
    });
    expect(fromDb?.deadlineStart?.toISOString()).toBe(
      new Date(newStart).toISOString(),
    );
    // deadlineEnd was omitted from the PATCH body entirely, so it must
    // still hold the value set at creation time.
    expect(fromDb?.deadlineEnd?.toISOString()).toBe(
      new Date(VALID_DEADLINE_END).toISOString(),
    );
  });

  it("sets a deadline over HTTP on an objective that previously had none", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "No deadline yet",
      isTask: false,
      mapId,
    });
    // Asserted (and the id only tracked for cleanup) after confirming the
    // create actually succeeded — pushing an id unconditionally here would
    // push `undefined` into the shared `createdIds` cleanup array whenever
    // this create 400s (as it currently does, pre-implementation), which
    // then poisons every other test's `afterEach` in this file for the rest
    // of the run.
    expect(createResponse.status).toBe(201);
    createdIds.push(createResponse.body.id);
    expect(createResponse.body.deadlineStart).toBeNull();
    expect(createResponse.body.deadlineEnd).toBeNull();

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "No deadline yet",
        isTask: false,
        deadlineStart: VALID_DEADLINE_START,
        deadlineEnd: VALID_DEADLINE_END,
      });

    expect(updateResponse.status).toBe(200);

    const fromDb = await prisma.objective.findUnique({
      where: { id: createResponse.body.id },
    });
    expect(fromDb?.deadlineStart?.toISOString()).toBe(
      new Date(VALID_DEADLINE_START).toISOString(),
    );
    expect(fromDb?.deadlineEnd?.toISOString()).toBe(
      new Date(VALID_DEADLINE_END).toISOString(),
    );
  });

  it("returns 400 and leaves the stored deadline unchanged when deadlineStart is after deadlineEnd", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Has a deadline already 3",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "Has a deadline already 3",
        isTask: false,
        deadlineStart: VALID_DEADLINE_END,
        deadlineEnd: VALID_DEADLINE_START,
      });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.error.toLowerCase()).toContain("deadline");

    const fromDb = await prisma.objective.findUnique({
      where: { id: createResponse.body.id },
    });
    expect(fromDb?.deadlineStart?.toISOString()).toBe(
      new Date(VALID_DEADLINE_START).toISOString(),
    );
    expect(fromDb?.deadlineEnd?.toISOString()).toBe(
      new Date(VALID_DEADLINE_END).toISOString(),
    );
  });

  it("returns 400 and leaves the stored deadline unchanged when the update sets deadlineStart equal to deadlineEnd", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Has a deadline already 4",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "Has a deadline already 4",
        isTask: false,
        deadlineStart: VALID_DEADLINE_START,
        deadlineEnd: VALID_DEADLINE_START,
      });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.error.toLowerCase()).toContain("deadline");

    const fromDb = await prisma.objective.findUnique({
      where: { id: createResponse.body.id },
    });
    expect(fromDb?.deadlineStart?.toISOString()).toBe(
      new Date(VALID_DEADLINE_START).toISOString(),
    );
    expect(fromDb?.deadlineEnd?.toISOString()).toBe(
      new Date(VALID_DEADLINE_END).toISOString(),
    );
  });

  it("returns 400 and leaves the stored deadline unchanged when the update sets deadlineEnd less than 60 seconds after deadlineStart", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Has a deadline already 5",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "Has a deadline already 5",
        isTask: false,
        deadlineStart: VALID_DEADLINE_START,
        deadlineEnd: LESS_THAN_ONE_MINUTE_AFTER_START,
      });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.error.toLowerCase()).toContain("deadline");

    const fromDb = await prisma.objective.findUnique({
      where: { id: createResponse.body.id },
    });
    expect(fromDb?.deadlineEnd?.toISOString()).toBe(
      new Date(VALID_DEADLINE_END).toISOString(),
    );
  });

  it("updates deadlineStart and deadlineEnd over HTTP and returns 200 when the new values are exactly 60 seconds apart (minimum valid boundary)", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Deadline to the minimum boundary",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "Deadline to the minimum boundary",
        isTask: false,
        deadlineStart: VALID_DEADLINE_START,
        deadlineEnd: EXACTLY_ONE_MINUTE_AFTER_START,
      });

    expect(updateResponse.status).toBe(200);

    const fromDb = await prisma.objective.findUnique({
      where: { id: createResponse.body.id },
    });
    expect(fromDb?.deadlineEnd?.toISOString()).toBe(
      new Date(EXACTLY_ONE_MINUTE_AFTER_START).toISOString(),
    );
  });

  it("updates deadlineStart and deadlineEnd over HTTP and persists the new values when both are provided validly", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Deadline to be moved",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponse.body.id);

    const newStart = "2025-02-01T00:00:00.000Z";
    const newEnd = "2025-03-01T00:00:00.000Z";

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "Deadline to be moved",
        isTask: false,
        deadlineStart: newStart,
        deadlineEnd: newEnd,
      });

    expect(updateResponse.status).toBe(200);

    const fromDb = await prisma.objective.findUnique({
      where: { id: createResponse.body.id },
    });
    expect(fromDb?.deadlineStart?.toISOString()).toBe(
      new Date(newStart).toISOString(),
    );
    expect(fromDb?.deadlineEnd?.toISOString()).toBe(
      new Date(newEnd).toISOString(),
    );
  });
});
