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

// Two real Map rows — maps no longer have a type distinction, every map is
// an unconditional general DAG. The second map exists purely so the
// cross-map rejection test has two ordinary maps to prove an edge can't
// span between them. Every Objective below is scoped to one of these.
let mapId: number;
let otherMapId: number;

// Keyed by a descriptive name so each test can grab exactly the fixture(s)
// it needs without accidentally reusing an objective/edge another test
// already mutated (edges have a unique (parentId, childId) key, and cycle
// detection is stateful across the whole DAG, so cross-test reuse would
// produce order-dependent false failures).
const objectives: Record<string, number> = {};

async function makeObjective(mapId: number, description: string) {
  const objective = await prisma.objective.create({
    data: { description, isTask: false, mapId },
  });
  return objective.id;
}

beforeAll(async () => {
  const map = await prisma.map.create({
    data: { name: "ObjectiveEdge e2e map" },
  });
  mapId = map.id;

  const otherMap = await prisma.map.create({
    data: { name: "ObjectiveEdge e2e other map" },
  });
  otherMapId = otherMap.id;

  // Primary-map fixtures, one dedicated set of objectives per scenario so
  // tests can run in any order without interfering with each other's edges.
  const specs = [
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
  for (const name of specs) {
    objectives[name] = await makeObjective(mapId, `objective:${name}`);
  }

  // Secondary-map fixture, used only to prove cross-map edges are rejected.
  objectives.crossMapOtherSide = await makeObjective(
    otherMapId,
    "objective:crossMapOtherSide",
  );
});

afterAll(async () => {
  // Deleting the Maps cascades to their Objectives (Objective.mapId ->
  // Map is onDelete: Cascade), which in turn cascades to any ObjectiveEdge
  // rows still pointing at them (ObjectiveEdge.parentId/childId -> Objective
  // are both onDelete: Cascade) — this is the same cascade behavior
  // exercised deliberately in the "cascade documentation" test below.
  await prisma.map.delete({ where: { id: mapId } });
  await prisma.map.delete({ where: { id: otherMapId } });
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
  it("creates an edge between two objectives and returns 201", async () => {
    const response = await request(app).post("/objective-edges").send({
      parentId: objectives.simpleA,
      childId: objectives.simpleB,
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      parentId: objectives.simpleA,
      childId: objectives.simpleB,
    });
    expect(response.body.id).toEqual(expect.any(Number));
    createdEdgeIds.push(response.body.id);
  });

  // Every map explicitly allows a child to have more than one parent, as
  // long as the result stays acyclic — this is the default (and only)
  // behavior now that maps no longer distinguish a stricter single-parent
  // type, so it needs its own DAG-shaped fixture (two parents feeding the
  // same child) rather than a simple pair.
  it("allows a child to gain a second parent (multi-parent DAG)", async () => {
    const first = await request(app).post("/objective-edges").send({
      parentId: objectives.multiParentA,
      childId: objectives.multiParentChild,
    });
    expect(first.status).toBe(201);
    createdEdgeIds.push(first.body.id);

    const second = await request(app).post("/objective-edges").send({
      parentId: objectives.multiParentB,
      childId: objectives.multiParentChild,
    });
    expect(second.status).toBe(201);
    createdEdgeIds.push(second.body.id);

    // Confirm both edges actually persisted, rather than trusting the HTTP
    // response alone — the whole point of the multi-parent rule is that the
    // second insert must not silently overwrite or reject the first.
    const persisted = await prisma.objectiveEdge.findMany({
      where: { childId: objectives.multiParentChild },
    });
    expect(persisted).toHaveLength(2);
    expect(persisted.map((e) => e.parentId).sort()).toEqual(
      [objectives.multiParentA, objectives.multiParentB].sort(),
    );
  });

  // Proves the cycle-detection algorithm actually walks the graph rather
  // than just checking the single edge being inserted: A->B already exists,
  // so B->A would make A reachable from itself.
  it("rejects a direct 2-node cycle (A->B exists, then B->A is attempted)", async () => {
    const forward = await request(app).post("/objective-edges").send({
      parentId: objectives.cycle2A,
      childId: objectives.cycle2B,
    });
    expect(forward.status).toBe(201);
    createdEdgeIds.push(forward.body.id);

    const backward = await request(app).post("/objective-edges").send({
      parentId: objectives.cycle2B,
      childId: objectives.cycle2A,
    });
    expect(backward.status).toBe(400);
    expect(backward.body.error).toBe("adding this edge would create a cycle");

    const persisted = await prisma.objectiveEdge.findMany({
      where: { parentId: objectives.cycle2B, childId: objectives.cycle2A },
    });
    expect(persisted).toHaveLength(0);
  });

  // Same rule, but the cycle only closes after two hops (A->B->C, then
  // C->A) — this is what actually distinguishes a real graph traversal from
  // a naive check that only looks at existing edges directly touching the
  // two endpoints being connected.
  it("rejects a 3-node cycle (A->B, B->C, then C->A is attempted)", async () => {
    const ab = await request(app).post("/objective-edges").send({
      parentId: objectives.cycle3A,
      childId: objectives.cycle3B,
    });
    expect(ab.status).toBe(201);
    createdEdgeIds.push(ab.body.id);

    const bc = await request(app).post("/objective-edges").send({
      parentId: objectives.cycle3B,
      childId: objectives.cycle3C,
    });
    expect(bc.status).toBe(201);
    createdEdgeIds.push(bc.body.id);

    const ca = await request(app).post("/objective-edges").send({
      parentId: objectives.cycle3C,
      childId: objectives.cycle3A,
    });
    expect(ca.status).toBe(400);
    expect(ca.body.error).toBe("adding this edge would create a cycle");

    const persisted = await prisma.objectiveEdge.findMany({
      where: { parentId: objectives.cycle3C, childId: objectives.cycle3A },
    });
    expect(persisted).toHaveLength(0);
  });

  it("returns 404 when parentId does not reference an existing objective", async () => {
    const response = await request(app).post("/objective-edges").send({
      parentId: 999999999,
      childId: objectives.notFoundRef,
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("parent objective not found");
  });

  it("returns 404 when childId does not reference an existing objective", async () => {
    const response = await request(app).post("/objective-edges").send({
      parentId: objectives.notFoundRef,
      childId: 999999999,
    });

    expect(response.status).toBe(404);
    expect(response.body.error).toBe("child objective not found");
  });

  it("returns 400 when parentId and childId are the same objective", async () => {
    const response = await request(app).post("/objective-edges").send({
      parentId: objectives.selfRef,
      childId: objectives.selfRef,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe("an objective cannot be its own parent");
  });

  // Edges are meaningless across two unrelated maps — each map's DAG is an
  // independent structure, so mixing endpoints from different maps must be
  // rejected regardless of cycle/parent-count rules.
  it("returns 400 when parent and child objectives belong to different maps", async () => {
    const response = await request(app).post("/objective-edges").send({
      parentId: objectives.crossMapProjectSide,
      childId: objectives.crossMapOtherSide,
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe(
      "parent and child objectives must belong to the same map",
    );
  });

  it("returns 400 and creates nothing on a duplicate (parentId, childId) pair", async () => {
    const first = await request(app).post("/objective-edges").send({
      parentId: objectives.dupA,
      childId: objectives.dupB,
    });
    expect(first.status).toBe(201);
    createdEdgeIds.push(first.body.id);

    const duplicate = await request(app).post("/objective-edges").send({
      parentId: objectives.dupA,
      childId: objectives.dupB,
    });
    expect(duplicate.status).toBe(400);
    expect(duplicate.body.error).toBe("this edge already exists");

    // The unique (parentId, childId) constraint means a second insert
    // attempt must not create a second row alongside the first.
    const persisted = await prisma.objectiveEdge.findMany({
      where: { parentId: objectives.dupA, childId: objectives.dupB },
    });
    expect(persisted).toHaveLength(1);
  });
});

describe("DELETE /objective-edges/:id (end-to-end, real HTTP + real database)", () => {
  it("deletes an existing edge and returns 200", async () => {
    const created = await request(app).post("/objective-edges").send({
      parentId: objectives.deleteExistingParent,
      childId: objectives.deleteExisting,
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
      parentId: objectives.cascadeA,
      childId: objectives.cascadeB,
    });
    expect(created.status).toBe(201);
    const edgeId = created.body.id as number;

    await prisma.objective.delete({ where: { id: objectives.cascadeA } });

    const fromDb = await prisma.objectiveEdge.findUnique({
      where: { id: edgeId },
    });
    expect(fromDb).toBeNull();
    // objectives.cascadeA is now gone from the database; it's excluded from
    // any later reuse in this file (it isn't referenced by any other test).
  });
});
