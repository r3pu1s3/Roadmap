import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { createObjective } from "./ObjectiveController";
import prisma from "../lib/prisma";

const app = express();
app.use(express.json());
app.post("/objectives", createObjective);

// Track every id created during a test so we can clean it up afterward.
// Deleting the Objective is enough — ObjectiveCounter has onDelete: Cascade
// pointing back at Objective, so its counter row is removed automatically.
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
    expect(response.body.description).toBe("Get stronger this year");
    expect(response.body.isTask).toBe(false);
    expect(response.body.counter).toBeNull();

    createdIds.push(response.body.id);

    // Confirm it actually landed in the database, independent of the HTTP response
    const fromDb = await prisma.objective.findUnique({
      where: { id: response.body.id },
      include: { counter: true },
    });
    expect(fromDb).not.toBeNull();
    expect(fromDb?.counter).toBeNull();
  });

  it("creates a task and returns 201 with a nested counter, targetQuantity null", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Do {pushups} pushups every morning",
      isTask: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.isTask).toBe(true);
    expect(response.body.counter).toMatchObject({
      label: "pushups",
      targetQuantity: null,
    });

    createdIds.push(response.body.id);

    const fromDb = await prisma.objective.findUnique({
      where: { id: response.body.id },
      include: { counter: true },
    });
    expect(fromDb?.counter?.label).toBe("pushups");
    expect(fromDb?.counter?.targetQuantity).toBeNull();
  });

  it("creates a task with no counter when the description has no placeholder", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Just get it done",
      isTask: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.counter).toBeNull();

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

  it("returns 400 and creates nothing when description exceeds the word limit", async () => {
    const longDescription = Array(26).fill("word").join(" ");

    const response = await request(app).post("/objectives").send({
      description: longDescription,
      isTask: false,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("description must be 25 words or fewer (got 26)");

    const found = await prisma.objective.findFirst({
      where: { description: longDescription },
    });
    expect(found).toBeNull();
  });

  it("returns 400 when isTask is not a boolean", async () => {
    const response = await request(app).post("/objectives").send({
      description: "test",
      isTask: "yes",
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("isTask must be a boolean");
  });

  it("returns 400 and creates nothing when a task description has more than one placeholder", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Do {pushups} pushups and {situps} situps",
      isTask: true,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "There should only be one counter for each objective. Break down the goal if you need to."
    );

    const found = await prisma.objective.findFirst({
      where: { description: "Do {pushups} pushups and {situps} situps" },
    });
    expect(found).toBeNull();
  });

  it("deduplicates a repeated placeholder into a single counter row over real HTTP", async () => {
    const response = await request(app).post("/objectives").send({
      description: "Do {reps} reps, then do {reps} more reps",
      isTask: true,
    });

    expect(response.status).toBe(201);
    expect(response.body.counter.label).toBe("reps");
    createdIds.push(response.body.id);

    const counters = await prisma.objectiveCounter.findMany({
      where: { objectiveId: response.body.id },
    });
    expect(counters).toHaveLength(1);
  });
});