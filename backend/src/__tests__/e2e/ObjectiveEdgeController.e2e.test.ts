import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import {
  createObjectiveEdge,
  deleteObjectiveEdge,
} from "../../controllers/ObjectiveEdgeController";
import prisma from "../../lib/prisma";

const app = express();
app.use(express.json());
app.post("/objective-edges", createObjectiveEdge);
app.delete("/objective-edges/:id", deleteObjectiveEdge);

// Two real Map rows — one of each MapType, since the plan's "one parent per
// child" rule is Habit-only, while Project maps allow multiple parents (as
// long as no cycle forms). Every Objective below is scoped to one of these.
let projectMapId: number;
let habitMapId: number;

// Keyed by a descriptive name so each test can grab exactly the fixture(s)
// it needs without accidentally reusing an objective/edge another test
// already mutated (edges have a unique (parentId, childId) key, and cycle
// detection is stateful across the whole DAG, so cross-test reuse would
// produce order-dependent false failures).
const project: Record<string, number> = {};
const habit: Record<string, number> = {};

async function makeObjective(mapId: number, description: string) {
  const objective = await prisma.objective.create({
    data: { description, isTask: false, mapId },
  });
  return objective.id;
}

beforeAll(async () => {
  const projectMap = await prisma.map.create({
    data: { name: "ObjectiveEdge e2e project map", type: "Project" },
  });
  projectMapId = projectMap.id;

  const habitMap = await prisma.map.create({
    data: { name: "ObjectiveEdge e2e habit map", type: "Habit" },
  });
  habitMapId = habitMap.id;

  // Project-map fixtures, one dedicated set of objectives per scenario so
  // tests can run in any order without interfering with each other's edges.
  const projectSpecs = [
    "simpleA",
    "simpleB",
    "multiParentA",
    "multiParentB",
    "multiParentChild",
    "cycle2A",
    "cycle2B",
    "cycle3A",
    "cycle3B",
    "cycle3C",
    "dupA",
    "dupB",
    "selfRef",
    "cascadeA",
    "cascadeB",
    "crossMapProjectSide",
    "notFoundRef",
    "deleteExisting",
    "deleteExistingParent",
  ];
  for (const name of projectSpecs) {
    project[name] = await makeObjective(projectMapId, `project:${name}`);
  }

  // Habit-map fixtures for the single-parent rule.
  const habitSpecs = ["parent1", "parent2", "child", "crossMapHabitSide"];
  for (const name of habitSpecs) {
    habit[name] = await makeObjective(habitMapId, `habit:${name}`);
  }
});

afterAll(async () => {
  // Deleting the Maps cascades to their Objectives (Objective.mapId ->
  // Map is onDelete: Cascade), which in turn cascades to any ObjectiveEdge
  // rows still pointing at them (ObjectiveEdge.parentId/childId -> Objective
  // are both onDelete: Cascade) — this is the same cascade behavior
  // exercised deliberately in the "cascade documentation" test below.
  await prisma.map.delete({ where: { id: projectMapId } });
  await prisma.map.delete({ where: { id: habitMapId } });
});

// Edges created inside individual tests (as opposed to the fixture
// objectives above, which live for the whole file). Guarded because several
// tests intentionally fail to create an edge and would otherwise push
// `undefined`/leave nothing to clean up.
const createdEdgeIds: number[] = [];

afterEach(async () => {
  if (createdEdgeIds.length > 0) {
    await prisma.objectiveEdge.deleteMany({
      where: { id: { in: createdEdgeIds } },
    });
    createdEdgeIds.length = 0;
  }
});

describe("POST /objective-edges (end-to-end, real HTTP + real database)", () => {
  it("creates an edge between two objectives in a Project map and returns 201", async () => {
    const response = await request(app).post("/objective-edges").send({
      parentId: project.simpleA,
      childId: project.simpleB,
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      parentId: project.simpleA,
      childId: project.simpleB,
    });
    expect(response.body.id).toEqual(expect.any(Number));
    createdEdgeIds.push(response.body.id);
  });

  // Project maps explicitly allow a child to have more than one parent, as
  // long as the result stays acyclic — this is the key behavioral
  // difference from Habit maps, so it needs its own DAG-shaped fixture
  // (two parents feeding the same child) rather than a simple pair.
  it("allows a child to gain a second parent within a Project map (multi-parent DAG)", async () => {
    const first = await request(app).post("/objective-edges").send({
      parentId: project.multiParentA,
      childId: project.multiParentChild,
    });
    expect(first.status).toBe(201);
    createdEdgeIds.push(first.body.id);

    const second = await request(app).post("/objective-edges").send({
      parentId: project.multiParentB,
      childId: project.multiParentChild,
    });
    expect(second.status).toBe(201);
    createdEdgeIds.push(second.body.id);

    // Confirm both edges actually persisted, rather than trusting the HTTP
    // response alone — the whole point of the multi-parent rule is that the
    // second insert must not silently overwrite or reject the first.
    const persisted = await prisma.objectiveEdge.findMany({
      where: { childId: project.multiParentChild },
    });
    expect(persisted).toHaveLength(2);
    expect(persisted.map((e) => e.parentId).sort()).toEqual(
      [project.multiParentA, project.multiParentB].sort(),
    );
  });

  // Habit maps enforce a stricter "one parent per child" rule than Project
  // maps (a habit is meant to be a simple chain/tree, not a DAG), so a
  // second parent for the same child must be rejected outright.
  it("rejects a second parent for the same child in a Habit map", async () => {
    const first = await request(app).post("/objective-edges").send({
      parentId: habit.parent1,
      childId: habit.child,
    });
    expect(first.status).toBe(201);
    createdEdgeIds.push(first.body.id);

    const second = await request(app).post("/objective-edges").send({
      parentId: habit.parent2,
      childId: habit.child,
    });
    expect(second.status).toBe(400);
    expect(second.body.error).toBe(
      "a Habit map objective can only have one parent",
    );

    // The rejected second edge must never reach the database — only the
    // first parent/child pair should exist for this child.
    const persisted = await prisma.objectiveEdge.findMany({
      where: { childId: habit.child },
    });
    expect(persisted).toHaveLength(1);
    expect(persisted[0].parentId).toBe(habit.parent1);
  });

  // Proves the cycle-detection algorithm actually walks the graph rather
  // than just checking the single edge being inserted: A->B already exists,
  // so B->A would make A reachable from itself.
  it("rejects a direct 2-node cycle (A->B exists, then B->A is attempted)", async () => {
    const forward = await request(app).post("/objective-edges").send({
      parentId: project.cycle2A,
      childId: project.cycle2B,
    });
    expect(forward.status).toBe(201);
    createdEdgeIds.push(forward.body.id);

    const backward = await request(app).post("/objective-edges").send({
      parentId: project.cycle2B,
      childId: project.cycle2A,
    });
    expect(backward.status).toBe(400);
    expect(backward.body.error).toBe("adding this edge would create a cycle");

    const persisted = await prisma.objectiveEdge.findMany({
      where: { parentId: project.cycle2B, childId: project.cycle2A },
    });
    expect(persisted).toHaveLength(0);
  });

  // Same rule, but the cycle only closes after two hops (A->B->C, then
  // C->A) — this is what actually distinguishes a real graph traversal from
  // a naive check that only looks at existing edges directly touching the
  // two endpoints being connected.
  it("rejects a 3-node cycle (A->B, B->C, then C->A is attempted)", async () => {
    const ab = await request(app).post("/objective-edges").send({
      parentId: project.cycle3A,
      childId: project.cycle3B,
    });
    expect(ab.status).toBe(201);
    createdEdgeIds.push(ab.body.id);

    const bc = await request(app).post("/objective-edges").send({
      parentId: project.cycle3B,
      childId: project.cycle3C,
    });
    expect(bc.status).toBe(201);
    createdEdgeIds.push(bc.body.id);

    const ca = await request(app).post("/objective-edges").send({
      parentId: project.cycle3C,
      childId: project.cycle3A,
    });
    expect(ca.status).toBe(400);
    expect(ca.body.error).toBe("adding this edge would create a cycle");

    const persisted = await prisma.objectiveEdge.findMany({
      where: { parentId: project.cycle3C, childId: project.cycle3A },
    });
    expect(persisted).toHaveLength(0);
  });

  it("returns 404 when parentId does not reference an existing objective", async () => {
    const response = await request(app).post("/objective-edges").send({
      parentId: 999999999,
      childId: project.notFoundRef,
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("parent objective not found");
  });

  it("returns 404 when childId does not reference an existing objective", async () => {
    const response = await request(app).post("/objective-edges").send({
      parentId: project.notFoundRef,
      childId: 999999999,
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("child objective not found");
  });

  it("returns 400 when parentId and childId are the same objective", async () => {
    const response = await request(app).post("/objective-edges").send({
      parentId: project.selfRef,
      childId: project.selfRef,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("an objective cannot be its own parent");
  });

  // Edges are meaningless across two unrelated maps — a Project map's DAG
  // and a Habit map's tree are independent structures, so mixing endpoints
  // from different maps must be rejected regardless of cycle/parent-count
  // rules.
  it("returns 400 when parent and child objectives belong to different maps", async () => {
    const response = await request(app).post("/objective-edges").send({
      parentId: project.crossMapProjectSide,
      childId: habit.crossMapHabitSide,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "parent and child objectives must belong to the same map",
    );
  });

  it("returns 400 and creates nothing on a duplicate (parentId, childId) pair", async () => {
    const first = await request(app).post("/objective-edges").send({
      parentId: project.dupA,
      childId: project.dupB,
    });
    expect(first.status).toBe(201);
    createdEdgeIds.push(first.body.id);

    const duplicate = await request(app).post("/objective-edges").send({
      parentId: project.dupA,
      childId: project.dupB,
    });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error).toBe("this edge already exists");

    // The unique (parentId, childId) constraint means a second insert
    // attempt must not create a second row alongside the first.
    const persisted = await prisma.objectiveEdge.findMany({
      where: { parentId: project.dupA, childId: project.dupB },
    });
    expect(persisted).toHaveLength(1);
  });
});

describe("DELETE /objective-edges/:id (end-to-end, real HTTP + real database)", () => {
  it("deletes an existing edge and returns 200", async () => {
    const created = await request(app).post("/objective-edges").send({
      parentId: project.deleteExistingParent,
      childId: project.deleteExisting,
    });
    expect(created.status).toBe(201);
    const edgeId = created.body.id as number;

    const response = await request(app).delete(`/objective-edges/${edgeId}`);
    expect(response.status).toBe(200);

    const fromDb = await prisma.objectiveEdge.findUnique({
      where: { id: edgeId },
    });
    expect(fromDb).toBeNull();
    // Not pushed to createdEdgeIds: the row is already gone, and deleting
    // an already-deleted id in afterEach would be redundant, not harmful,
    // but omitting it keeps the cleanup array an honest "still needs
    // deleting" list.
  });

  it("returns 404 when the edge does not exist", async () => {
    const response = await request(app).delete("/objective-edges/999999999");

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("edge not found");
  });

  it("returns 400 when the id path param is not a valid integer", async () => {
    const response = await request(app).delete("/objective-edges/abc");

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("id must be a valid integer");
  });
});

describe("Database cascade behavior (real database, existing schema — not new application code)", () => {
  // The plan relies on ObjectiveEdge.parentId/childId already being
  // onDelete: Cascade in schema.prisma. This test doesn't exercise any code
  // this feature slice adds — it documents that deleting an Objective that
  // participates in an edge also removes the edge, so the
  // ObjectiveEdgeController never has to manually clean up edges itself
  // when an objective is deleted elsewhere in the app.
  it("cascades: deleting one of an edge's objectives also deletes the edge", async () => {
    const created = await request(app).post("/objective-edges").send({
      parentId: project.cascadeA,
      childId: project.cascadeB,
    });
    expect(created.status).toBe(201);
    const edgeId = created.body.id as number;

    await prisma.objective.delete({ where: { id: project.cascadeA } });

    const fromDb = await prisma.objectiveEdge.findUnique({
      where: { id: edgeId },
    });
    expect(fromDb).toBeNull();
    // project.cascadeA is now gone from the database; it's excluded from
    // any later reuse in this file (it isn't referenced by any other test).
  });
});
