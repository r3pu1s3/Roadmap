import { describe, it, expect, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import { createGoalTemplate } from "./GoalTemplateController";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const app = express();
app.use(express.json());
app.post("/goal-templates", createGoalTemplate);

// Separate Prisma instance used only for test verification/cleanup
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});
const prisma = new PrismaClient({ adapter });

const createdIds: number[] = [];

afterEach(async () => {
  if (createdIds.length > 0) {
    await prisma.goalTemplate.deleteMany({ where: { id: { in: createdIds } } });
    createdIds.length = 0;
  }
});

describe("POST /goal-templates (integration: controller + service + real database)", () => {
  it("creates a template end-to-end and persists it to the real database", async () => {
    const response = await request(app).post("/goal-templates").send({
      description: "3 pushups",
      rewardRule: [1, 2],
      deadlineRule: [3, 4],
      counters: ["pushups"],
    });

    expect(response.status).toBe(201);
    createdIds.push(response.body.id);

    const fromDb = await prisma.goalTemplate.findUnique({ where: { id: response.body.id } });
    expect(fromDb).not.toBeNull();
    expect(fromDb?.description).toBe("3 pushups");
    expect(fromDb?.rewardRule).toEqual([1, 2]);
    expect(fromDb?.deadlineRule).toEqual([3, 4]);
    expect(fromDb?.counters).toEqual(["pushups"]);
  });

  it("creates a parent and child template, both actually linked in the database", async () => {
    const parentRes = await request(app).post("/goal-templates").send({
      description: "parent template",
      rewardRule: [1, 2],
      deadlineRule: [1, 2],
    });
    createdIds.push(parentRes.body.id);

    const childRes = await request(app).post("/goal-templates").send({
      description: "child template",
      rewardRule: [1, 2],
      deadlineRule: [1, 2],
      parentId: parentRes.body.id,
    });
    createdIds.push(childRes.body.id);

    expect(childRes.status).toBe(201);

    const childFromDb = await prisma.goalTemplate.findUnique({ where: { id: childRes.body.id } });
    expect(childFromDb?.parentId).toBe(parentRes.body.id);
  });

  it("rejects a nonexistent parentId and confirms nothing was written", async () => {
    const response = await request(app).post("/goal-templates").send({
      description: "test",
      rewardRule: [1, 2],
      deadlineRule: [1, 2],
      parentId: 999999999,
    });

    expect(response.status).toBe(400);

    const found = await prisma.goalTemplate.findFirst({ where: { description: "test" } });
    expect(found).toBeNull();
  });

  it("rejects invalid rewardRule and confirms nothing was written", async () => {
    const response = await request(app).post("/goal-templates").send({
      description: "should not be saved",
      rewardRule: [1],
      deadlineRule: [1, 2],
    });

    expect(response.status).toBe(400);

    const found = await prisma.goalTemplate.findFirst({
      where: { description: "should not be saved" },
    });
    expect(found).toBeNull();
  });
});