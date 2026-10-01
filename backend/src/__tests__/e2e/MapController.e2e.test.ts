import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import {
  createMap,
  getMaps,
  updateMap,
  getMap,
} from "../../controllers/MapController";
import prisma from "../../lib/prisma";

const app = express();
app.use(express.json());
app.post("/maps", createMap);
app.get("/maps", getMaps);
app.get("/maps/:id", getMap);
app.patch("/maps/:id", updateMap);

// Mirrors the makeObjective helper in ObjectiveEdgeController.e2e.test.ts —
// creates a real Objective row directly via Prisma (bypassing the
// controller/service layer) so tests can set up graph fixtures without
// depending on the ObjectiveController being correct. A valid deadline pair
// is supplied even though these fixtures have nothing to do with the
// deadline feature: deadlines are mandatory end-to-end now — both columns
// are NOT NULL at the DB level — so a bare create with no deadline fields
// would violate that constraint.
const FIXTURE_DEADLINE_START = "2025-01-01T00:00:00.000Z";
const FIXTURE_DEADLINE_END = "2025-12-31T00:00:00.000Z";

async function makeObjective(
  mapId: number,
  description: string,
  isTask = false,
) {
  const objective = await prisma.objective.create({
    data: {
      description,
      isTask,
      mapId,
      deadlineStart: new Date(FIXTURE_DEADLINE_START),
      deadlineEnd: new Date(FIXTURE_DEADLINE_END),
    },
  });
  return objective.id;
}

const createdIds: number[] = [];

afterEach(async () => {
  if (createdIds.length > 0) {
    await prisma.map.deleteMany({
      where: { id: { in: createdIds } },
    });
    createdIds.length = 0;
  }
});

describe("POST /maps (end-to-end, real HTTP + real database)", () => {
  it("creates a map and returns 201 with the persisted name/id", async () => {
    const response = await request(app).post("/maps").send({
      name: "Test Map",
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      name: "Test Map",
    });
    expect(response.body.id).toEqual(expect.any(Number));
    createdIds.push(response.body.id);
  });

  it("returns 400 and creates nothing when name exceeds the 10-word limit", async () => {
    const elevenWordName =
      "one two three four five six seven eight nine ten eleven";

    const response = await request(app).post("/maps").send({
      name: elevenWordName,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("name must be 10 words or fewer (got 11)");

    // Confirms the 400 short-circuited before any write — not just that the
    // response was an error while a row was created anyway.
    const found = await prisma.map.findFirst({
      where: { name: elevenWordName },
    });
    expect(found).toBeNull();
  });

  it("trims surrounding whitespace from the name before persisting", async () => {
    const response = await request(app).post("/maps").send({
      name: "  Test  ",
    });

    expect(response.status).toBe(201);
    expect(response.body.name).toBe("Test");
    createdIds.push(response.body.id);

    const fromDb = await prisma.map.findUnique({
      where: { id: response.body.id },
    });
    expect(fromDb?.name).toBe("Test");
  });
});

describe("GET /maps (end-to-end, real HTTP + real database)", () => {
  it("returns 200 with an array that includes a just-created map", async () => {
    const createResponse = await request(app).post("/maps").send({
      name: "Findable Map",
    });
    createdIds.push(createResponse.body.id);

    const response = await request(app).get("/maps");

    expect(response.status).toBe(200);
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: createResponse.body.id,
          name: "Findable Map",
        }),
      ]),
    );
  });

  it("returns maps ordered by ascending id", async () => {
    const firstResponse = await request(app).post("/maps").send({
      name: "First Map",
    });
    createdIds.push(firstResponse.body.id);

    const secondResponse = await request(app).post("/maps").send({
      name: "Second Map",
    });
    createdIds.push(secondResponse.body.id);

    const response = await request(app).get("/maps");

    // Ordering is asserted by relative index rather than exact position,
    // since other rows may already exist in the (shared) real database.
    const firstIndex = response.body.findIndex(
      (m: { id: number }) => m.id === firstResponse.body.id,
    );
    const secondIndex = response.body.findIndex(
      (m: { id: number }) => m.id === secondResponse.body.id,
    );

    expect(firstIndex).toBeGreaterThanOrEqual(0);
    expect(secondIndex).toBeGreaterThanOrEqual(0);
    expect(firstIndex).toBeLessThan(secondIndex);
  });
});

describe("PATCH /maps/:id (end-to-end, real HTTP + real database)", () => {
  it("returns 400 when id is not a valid integer", async () => {
    const response = await request(app).patch("/maps/not-a-number").send({
      name: "test",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("id must be a valid integer");
  });

  it("returns 404 when the map does not exist", async () => {
    const response = await request(app).patch("/maps/999999999").send({
      name: "test",
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("map not found");
  });

  it("updates a map's name and returns 200, reflected in the DB", async () => {
    const createResponse = await request(app).post("/maps").send({
      name: "Old Name",
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/maps/${createResponse.body.id}`)
      .send({ name: "New Name" });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.name).toBe("New Name");

    const fromDb = await prisma.map.findUnique({
      where: { id: createResponse.body.id },
    });
    expect(fromDb?.name).toBe("New Name");
  });

  it("returns 400 and leaves the name unchanged when name is empty/missing", async () => {
    const createResponse = await request(app).post("/maps").send({
      name: "Original",
    });
    createdIds.push(createResponse.body.id);

    const updateResponse = await request(app)
      .patch(`/maps/${createResponse.body.id}`)
      .send({});

    expect(updateResponse.status).toBe(400);

    const fromDb = await prisma.map.findUnique({
      where: { id: createResponse.body.id },
    });
    expect(fromDb?.name).toBe("Original");
  });

  it("returns 400 with the word-limit message and leaves the name unchanged when the new name exceeds 10 words", async () => {
    const createResponse = await request(app).post("/maps").send({
      name: "Original",
    });
    createdIds.push(createResponse.body.id);

    const elevenWordName =
      "one two three four five six seven eight nine ten eleven";
    const updateResponse = await request(app)
      .patch(`/maps/${createResponse.body.id}`)
      .send({ name: elevenWordName });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.error).toBe(
      "name must be 10 words or fewer (got 11)",
    );

    // Confirms the rejected update never reached the DB, not just that the
    // HTTP response reported an error.
    const fromDb = await prisma.map.findUnique({
      where: { id: createResponse.body.id },
    });
    expect(fromDb?.name).toBe("Original");
  });
});

describe("GET /maps/:id (end-to-end, real HTTP + real database)", () => {
  it("returns 400 when id is not a valid integer", async () => {
    const response = await request(app).get("/maps/abc");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("id must be a valid integer");
  });

  it("returns 404 when the map does not exist", async () => {
    const response = await request(app).get("/maps/999999999");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("map not found");
  });

  it("returns 200 with empty objectives and edges arrays for a freshly created map", async () => {
    const createResponse = await request(app).post("/maps").send({
      name: "Empty Map",
    });
    createdIds.push(createResponse.body.id);

    const response = await request(app).get(`/maps/${createResponse.body.id}`);

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      id: createResponse.body.id,
      name: "Empty Map",
    });
    expect(response.body.objectives).toEqual([]);
    expect(response.body.edges).toEqual([]);
  });

  it("returns 200 with the map's objectives populated, including a task objective's counter relation", async () => {
    const createResponse = await request(app).post("/maps").send({
      name: "Populated Objectives Map",
    });
    const mapId = createResponse.body.id as number;
    createdIds.push(mapId);

    const goalId = await makeObjective(mapId, "A plain goal objective");
    // isTask + a {placeholder} in the description is what drives an
    // ObjectiveCounter row to exist for this objective (see
    // ObjectiveService.resolveCounterLabel) — created directly via Prisma
    // here since this test targets getMap's response shape, not creation.
    const taskId = await prisma.objective.create({
      data: {
        description: "Do {reps} reps",
        isTask: true,
        mapId,
        deadlineStart: new Date(FIXTURE_DEADLINE_START),
        deadlineEnd: new Date(FIXTURE_DEADLINE_END),
        counter: { create: { label: "reps", targetQuantity: null } },
      },
      include: { counter: true },
    });

    const response = await request(app).get(`/maps/${mapId}`);

    expect(response.status).toBe(200);
    expect(response.body.objectives).toHaveLength(2);

    const goalInResponse = response.body.objectives.find(
      (o: { id: number }) => o.id === goalId,
    );
    expect(goalInResponse).toMatchObject({
      id: goalId,
      description: "A plain goal objective",
      isTask: false,
      counter: null,
    });

    const taskInResponse = response.body.objectives.find(
      (o: { id: number }) => o.id === taskId.id,
    );
    expect(taskInResponse).toMatchObject({
      id: taskId.id,
      description: "Do {reps} reps",
      isTask: true,
      counter: { label: "reps", targetQuantity: null },
    });
  });

  it("returns 200 with edges reflecting ObjectiveEdge rows connecting the map's objectives", async () => {
    const createResponse = await request(app).post("/maps").send({
      name: "Populated Edges Map",
    });
    const mapId = createResponse.body.id as number;
    createdIds.push(mapId);

    const parentId = await makeObjective(mapId, "Parent objective");
    const childId = await makeObjective(mapId, "Child objective");
    const edge = await prisma.objectiveEdge.create({
      data: { parentId, childId },
    });

    const response = await request(app).get(`/maps/${mapId}`);

    expect(response.status).toBe(200);
    // Asserts the exact shape from the plan ({ id, parentId, childId }) —
    // not just that an edge is present somewhere in the payload.
    expect(response.body.edges).toEqual([{ id: edge.id, parentId, childId }]);
  });
});
