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
// Going forward, deadlineStart and deadlineEnd are MANDATORY on every create
// and update — not optional, and there is no "clear the deadline" or
// "set only one field" operation. This is a deliberate amendment over an
// earlier draft of the plan where they were nullable/optional. Deadlines are
// mandatory end-to-end: enforced by validation at the API level, and by a
// NOT NULL constraint at the DB level (deadlineStart/deadlineEnd are no
// longer nullable columns — the prior legacy-null rows were cleaned up
// before that migration landed).
//
// An objective's own interval must additionally span at least one full
// minute: deadlineEnd must be >= deadlineStart + 60 seconds. Equal
// start/end (a zero-length window) and any gap under 60 seconds are both
// rejected; a gap of exactly 60 seconds is the minimum valid boundary. This
// own-interval minimum-gap rule is independent of, and stricter than, the
// separate cross-node sequencing/umbrella boundary rules exercised in
// ObjectiveEdgeController.e2e.test.ts, which remain inclusive (an ancestor's
// deadlineEnd exactly equal to a task's deadlineStart, or an ancestor's
// interval edge exactly touching its umbrella's, are still accepted there).
const EXACTLY_ONE_MINUTE_AFTER_START = "2025-01-01T00:01:00.000Z";
const LESS_THAN_ONE_MINUTE_AFTER_START = "2025-01-01T00:00:30.000Z";

describe("POST /objectives - deadline validation (end-to-end, real HTTP + real database)", () => {
  it("returns 400 and creates nothing when deadlineStart is missing", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Missing start deadline",
      isTask: false,
      mapId,
      deadlineEnd: VALID_DEADLINE_END,
    });

    expect(response.status).toBe(400);
    // Message wording isn't dictated by the plan beyond "clear"; requiring
    // it name the missing field mirrors this codebase's existing
    // field-specific error convention (e.g. "mapId is required...").
    expect(response.body.error.toLowerCase()).toContain("deadlinestart");

    const found = await prisma.objective.findFirst({
      where: { description: "Missing start deadline", mapId },
    });
    expect(found).toBeNull();
  });

  it("returns 400 and creates nothing when deadlineEnd is missing", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Missing end deadline",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.toLowerCase()).toContain("deadlineend");

    const found = await prisma.objective.findFirst({
      where: { description: "Missing end deadline", mapId },
    });
    expect(found).toBeNull();
  });

  it("returns 400 and creates nothing when both deadlineStart and deadlineEnd are omitted entirely", async () => {
    const response = await request(app).post("/objectives").send({
      description: "No deadline at all",
      isTask: false,
      mapId,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.toLowerCase()).toContain("deadline");

    const found = await prisma.objective.findFirst({
      where: { description: "No deadline at all", mapId },
    });
    expect(found).toBeNull();
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
  it("returns 400 and leaves the stored deadline unchanged when deadlineStart is missing", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Has a deadline already",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "Has a deadline already",
        isTask: false,
        deadlineEnd: VALID_DEADLINE_END,
      });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.error.toLowerCase()).toContain("deadlinestart");

    // Confirms the earlier valid deadline survives a rejected update — there
    // is no partial-update/clear-deadline behavior for this feature.
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

  it("returns 400 and leaves the stored deadline unchanged when deadlineEnd is missing", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Has a deadline already 2",
      isTask: false,
      mapId,
      deadlineStart: VALID_DEADLINE_START,
      deadlineEnd: VALID_DEADLINE_END,
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "Has a deadline already 2",
        isTask: false,
        deadlineStart: VALID_DEADLINE_START,
      });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.error.toLowerCase()).toContain("deadlineend");

    const fromDb = await prisma.objective.findUnique({
      where: { id: createResponse.body.id },
    });
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
