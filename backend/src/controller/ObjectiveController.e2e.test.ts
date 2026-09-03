import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { createObjective, updateObjective } from "./ObjectiveController";
import prisma from "../lib/prisma";

const app = express();
app.use(express.json());
app.post("/objectives", createObjective);
app.patch("/objectives/:id", updateObjective);

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
    });

    expect(response.status).toBe(201);
    expect(response.body.counter).toBeNull();
    createdIds.push(response.body.id);
  });

  it("creates a task and returns 201 with a nested counter, targetQuantity null", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Do {pushups} pushups every morning",
      isTask: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.counter).toMatchObject({ label: "pushups", targetQuantity: null });
    createdIds.push(response.body.id);
  });

  it("returns 400 and creates nothing when description is missing", async () => {
    const response = await request(app).post("/objectives").send({
      description: "",
      isTask: false,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("description is required");
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

  it("returns 400 and leaves the objective unchanged when description is missing", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Original",
      isTask: false,
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
      "There should only be one counter for each objective. Break down the goal if you need to."
    );
  });

  it("creates a new counter over HTTP when a plain objective becomes a task with a placeholder", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Get stronger",
      isTask: false,
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

  it("deletes the counter over HTTP when isTask changes to false", async () => {
    const createResponse = await request(app).post("/objectives").send({
      description: "Do {pushups} pushups",
      isTask: true,
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
});