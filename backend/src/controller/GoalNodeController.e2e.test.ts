import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { createGoalNode } from "./GoalNodeController";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const app = express();
app.use(express.json());
app.post("/goal-nodes", createGoalNode);

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const createdIds: number[] = [];

function futureDateISOString(daysFromNow = 30): string {
  return new Date(Date.now() + daysFromNow * 24 * 60 * 60 * 1000).toISOString();
}

afterEach(async () => {
  if (createdIds.length > 0) {
    await prisma.goalCounter.deleteMany({
      where: { goalNodeId: { in: createdIds } },
    });
    await prisma.goalNode.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  }
});

describe("POST /goal-nodes (end-to-end, real HTTP + real database)", () => {
  it("creates a goal node and returns 201 with the persisted data", async () => {
    const response = await request(app)
      .post("/goal-nodes")
      .send({
        description: "3 pushups",
        rewardRule: [1, 2],
        deadlineRule: [3, 4],
        deadline: futureDateISOString(),
        completed: false,
        counters: [{ label: "pushups", targetQuantity: 3 }],
      });

    expect(response.status).toBe(201);
    expect(response.body.description).toBe("3 pushups");
    expect(response.body.rewardRule).toEqual([1, 2]);
    expect(response.body.deadlineRule).toEqual([3, 4]);
    expect(response.body.completed).toBe(false);

    createdIds.push(response.body.id);

    const fromDb = await prisma.goalNode.findUnique({
      where: { id: response.body.id },
      include: { counters: true },
    });
    expect(fromDb).not.toBeNull();
    expect(fromDb?.counters).toHaveLength(1);
    expect(fromDb?.counters[0]).toMatchObject({ label: "pushups", targetQuantity: 3 });
  });

  it("defaults completed to false when omitted from the request", async () => {
    const response = await request(app).post("/goal-nodes").send({
      description: "default completion",
      rewardRule: [1, 2],
      deadlineRule: [1, 2],
      deadline: futureDateISOString(),
    });

    expect(response.status).toBe(201);
    expect(response.body.completed).toBe(false);
    createdIds.push(response.body.id);
  });

  it("returns 400 when deadline is missing", async () => {
    const response = await request(app).post("/goal-nodes").send({
      description: "no deadline",
      rewardRule: [1, 2],
      deadlineRule: [1, 2],
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("deadline is required");
  });

  it("returns 400 when deadline is in the past", async () => {
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const response = await request(app).post("/goal-nodes").send({
      description: "past deadline",
      rewardRule: [1, 2],
      deadlineRule: [1, 2],
      deadline: pastDate,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("deadline must be in the present or future, not the past");
  });

  it("returns 400 and does not create anything when description is missing", async () => {
    const response = await request(app).post("/goal-nodes").send({
      description: "",
      rewardRule: [1, 2],
      deadlineRule: [1, 2],
      deadline: futureDateISOString(),
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("description is required");
  });

  it("returns 400 and does not create anything when rewardRule is invalid", async () => {
    const response = await request(app).post("/goal-nodes").send({
      description: "test",
      rewardRule: [1],
      deadlineRule: [1, 2],
      deadline: futureDateISOString(),
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("rewardRule must contain exactly 2 modifiers");
  });

  it("returns 400 when more than 3 counters are provided", async () => {
    const response = await request(app)
      .post("/goal-nodes")
      .send({
        description: "test",
        rewardRule: [1, 2],
        deadlineRule: [1, 2],
        deadline: futureDateISOString(),
        counters: [
          { label: "a", targetQuantity: 1 },
          { label: "b", targetQuantity: 1 },
          { label: "c", targetQuantity: 1 },
          { label: "d", targetQuantity: 1 },
        ],
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("a goal node can have at most 3 counters");
  });

  it("creates a child node linked to a real parent, over real HTTP", async () => {
    const parentResponse = await request(app).post("/goal-nodes").send({
      description: "parent node",
      rewardRule: [1, 2],
      deadlineRule: [1, 2],
      deadline: futureDateISOString(),
    });
    createdIds.push(parentResponse.body.id);

    const childResponse = await request(app)
      .post("/goal-nodes")
      .send({
        description: "child node",
        rewardRule: [1, 2],
        deadlineRule: [1, 2],
        deadline: futureDateISOString(),
        parentId: parentResponse.body.id,
      });
    createdIds.push(childResponse.body.id);

    expect(childResponse.status).toBe(201);
    expect(childResponse.body.parentId).toBe(parentResponse.body.id);
  });

  it("returns 400 when parentId does not reference an existing node", async () => {
    const response = await request(app).post("/goal-nodes").send({
      description: "test",
      rewardRule: [1, 2],
      deadlineRule: [1, 2],
      deadline: futureDateISOString(),
      parentId: 999999999,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("parentId does not reference an existing goal node");
  });
});

