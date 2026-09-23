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

describe("POST /objectives (end-to-end, real HTTP + real database)", () => {
  it("creates a plain objective and returns 201 with no counter attached", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Get stronger this year",
      isTask: false,
      mapId,
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
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("description is required");
  });

  it("returns 400 and creates nothing when the description has more than one placeholder", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Do {pushups} pushups and {situps} situps",
      isTask: true,
      mapId,
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
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("id must be a valid integer");
  });

  it("returns 404 when the objective does not exist", async () => {
    const response = await request(app).patch("/objectives/999999999").send({
      description: "test",
      isTask: false,
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("objective not found");
  });

  it("updates a plain objective's description and returns 200", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Old description",
      isTask: false,
      mapId,
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({ description: "New description", isTask: false });

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
    });
    createdIds.push(createResponseA.body.id);
    const createResponseB = await request(app).post("/objectives").send({
      description: "Objective B",
      isTask: false,
      mapId,
    });
    createdIds.push(createResponseB.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponseA.body.id}`)
      .send({
        id: createResponseB.body.id,
        description: "Updated A",
        isTask: false,
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
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({ description: "", isTask: false });

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
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "Do {pushups} pushups and {situps} situps",
        isTask: true,
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
    });
    createdIds.push(createResponse.body.id);
    expect(createResponse.body.counter).toBeNull();

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({ description: "Do {pushups} pushups", isTask: true });

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
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({
        description: "Do {reps} reps, then do {reps} more reps",
        isTask: true,
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
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/objectives/${createResponse.body.id}`)
      .send({ description: "Get stronger overall", isTask: false });

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
