import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import request from "supertest";
import express from "express";
import {
  createObjectiveEdge,
  deleteObjectiveEdge,
} from "../../controllers/ObjectiveEdgeController";
import {
  createObjective,
  updateObjective,
} from "../../controllers/ObjectiveController";
import prisma from "../../lib/prisma";

const app = express();
app.use(express.json());
app.post("/objective-edges", createObjectiveEdge);
app.delete("/objective-edges/:id", deleteObjectiveEdge);
// Mounted alongside the edge routes (not split into a separate file) because
// the deadline-validation scenarios below are specifically about the
// interaction between edge creation/objective updates and already-connected
// objectives — that interaction is the thing under test here.
app.post("/objectives", createObjective);
app.patch("/objectives/:id", updateObjective);

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

// A wide, arbitrary, mutually-consistent deadline window shared by every
// structural fixture below (cycle/multi-parent/cross-map/self-ref/cascade).
// These fixtures are deliberately unrelated to the deadline feature's
// validation rules; deadlineStart/deadlineEnd are nullable columns now, but
// this helper still supplies a valid pair so these structural fixtures stay
// unaffected by (and don't incidentally exercise) the null-deadline
// vacuous-pass behavior exercised explicitly further down this file.
const FIXTURE_DEADLINE_START = "2025-01-01T00:00:00.000Z";
const FIXTURE_DEADLINE_END = "2025-12-31T00:00:00.000Z";

async function makeObjective(mapId: number, description: string) {
  const objective = await prisma.objective.create({
    data: {
      description,
      isTask: false,
      mapId,
      deadlineStart: new Date(FIXTURE_DEADLINE_START),
      deadlineEnd: new Date(FIXTURE_DEADLINE_END),
    },
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

// Objectives created inside individual tests via real POST /objectives
// calls (as opposed to the whole-file fixtures above created directly via
// prisma). Used by the deadline-validation scenarios below, which need
// objectives with specific, per-scenario deadline values (rather than the
// structural fixtures' shared, arbitrary deadline window) — and need to go
// through the service's own validation on creation, since these tests are
// about that validation. Deleting these cascades away any edge connecting
// them (ObjectiveEdge.parentId/childId -> Objective is onDelete: Cascade),
// so those edges don't also need tracking in createdEdgeIds.
const createdObjectiveIds: number[] = [];

async function createObjectiveViaHttp(options: {
  description: string;
  isTask: boolean;
  // Optional: omitting both is how a test creates an objective with null
  // deadlines (the pair is nullable now), exercised by the
  // "vacuous pass" describe block below.
  deadlineStart?: string;
  deadlineEnd?: string;
  mapId: number;
}) {
  const response = await request(app).post("/objectives").send(options);
  expect(response.status).toBe(201);
  createdObjectiveIds.push(response.body.id);
  return response.body.id as number;
}

afterEach(async () => {
  if (createdEdgeIds.length > 0) {
    await prisma.objectiveEdge.deleteMany({
      where: { id: { in: createdEdgeIds } },
    });
    createdEdgeIds.length = 0;
  }
  if (createdObjectiveIds.length > 0) {
    await prisma.objective.deleteMany({
      where: { id: { in: createdObjectiveIds } },
    });
    createdObjectiveIds.length = 0;
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

// --- Deadline validation (feature: objective deadlines) ---
//
// ObjectiveEdge.childId is the upstream/earlier objective, .parentId is the
// downstream/later objective. Two rules apply depending on the downstream
// (parentId-side) node's isTask flag:
//   - isTask: true  -> "sequencing": every ancestor's deadlineEnd must be
//     <= the task's deadlineStart.
//   - isTask: false -> "umbrella": the objective's interval must fully
//     contain every ancestor's interval.
// Both rules apply transitively across the whole childId-chain, not just to
// the direct edge being created/patched. All objectives in this section are
// created via real POST /objectives calls (not the direct-prisma
// `makeObjective` helper above) specifically so each one goes through the
// service's own validation at creation time and carries the exact,
// scenario-specific deadline values each test needs — not the structural
// fixtures' shared, arbitrary window.
//
// deadlineStart/deadlineEnd are nullable now: both rules above are pairwise
// checks between an ancestor and a downstream node, and whenever either
// side of a given pairwise check has a null deadline, that check passes
// vacuously (there's nothing to compare, so nothing to violate) rather than
// erroring. The "vacuous pass" describe block near the end of this section
// exercises that directly, using a parent/child pair whose real deadlines
// would otherwise violate the sequencing rule.

describe("Deadline validation on edge creation — sequencing rule (downstream isTask: true)", () => {
  it("returns 400 when an ancestor's deadlineEnd falls after the task's deadlineStart", async () => {
    const task = await createObjectiveViaHttp({
      description: "Run the marathon",
      isTask: true,
      mapId,
      deadlineStart: "2025-03-01T00:00:00.000Z",
      deadlineEnd: "2025-04-01T00:00:00.000Z",
    });
    // Ends 2 weeks after the task's start — violates "ancestor must finish
    // before the task begins".
    const ancestor = await createObjectiveViaHttp({
      description: "Build up mileage",
      isTask: false,
      mapId,
      deadlineStart: "2025-01-01T00:00:00.000Z",
      deadlineEnd: "2025-03-15T00:00:00.000Z",
    });

    // childId is upstream (ancestor), parentId is downstream (task).
    const response = await request(app).post("/objective-edges").send({
      parentId: task,
      childId: ancestor,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.toLowerCase()).toContain("deadline");

    const persisted = await prisma.objectiveEdge.findMany({
      where: { parentId: task, childId: ancestor },
    });
    expect(persisted).toHaveLength(0);
  });

  it("creates the edge and returns 201 when the ancestor's deadlineEnd falls at or before the task's deadlineStart", async () => {
    const task = await createObjectiveViaHttp({
      description: "Run the marathon 2",
      isTask: true,
      mapId,
      deadlineStart: "2025-03-01T00:00:00.000Z",
      deadlineEnd: "2025-04-01T00:00:00.000Z",
    });
    const ancestor = await createObjectiveViaHttp({
      description: "Build up mileage 2",
      isTask: false,
      mapId,
      deadlineStart: "2025-01-01T00:00:00.000Z",
      deadlineEnd: "2025-02-15T00:00:00.000Z",
    });

    const response = await request(app).post("/objective-edges").send({
      parentId: task,
      childId: ancestor,
    });

    expect(response.status).toBe(201);
    createdEdgeIds.push(response.body.id);
  });
});

describe("Deadline validation on edge creation — umbrella rule (downstream isTask: false)", () => {
  it("returns 400 when an ancestor's interval is not fully contained in the downstream objective's interval", async () => {
    const umbrella = await createObjectiveViaHttp({
      description: "Get fit this year",
      isTask: false,
      mapId,
      deadlineStart: "2025-01-01T00:00:00.000Z",
      deadlineEnd: "2025-12-31T00:00:00.000Z",
    });
    // Starts a month before the umbrella objective does -> not contained.
    const ancestor = await createObjectiveViaHttp({
      description: "Couch to 5k",
      isTask: false,
      mapId,
      deadlineStart: "2024-12-01T00:00:00.000Z",
      deadlineEnd: "2025-06-01T00:00:00.000Z",
    });

    const response = await request(app).post("/objective-edges").send({
      parentId: umbrella,
      childId: ancestor,
    });

    expect(response.status).toBe(400);
    expect(response.body.error.toLowerCase()).toContain("deadline");

    const persisted = await prisma.objectiveEdge.findMany({
      where: { parentId: umbrella, childId: ancestor },
    });
    expect(persisted).toHaveLength(0);
  });

  it("creates the edge and returns 201 when the ancestor's interval is fully contained in the downstream objective's interval", async () => {
    const umbrella = await createObjectiveViaHttp({
      description: "Get fit this year 2",
      isTask: false,
      mapId,
      deadlineStart: "2025-01-01T00:00:00.000Z",
      deadlineEnd: "2025-12-31T00:00:00.000Z",
    });
    const ancestor = await createObjectiveViaHttp({
      description: "Couch to 5k 2",
      isTask: false,
      mapId,
      deadlineStart: "2025-02-01T00:00:00.000Z",
      deadlineEnd: "2025-06-01T00:00:00.000Z",
    });

    const response = await request(app).post("/objective-edges").send({
      parentId: umbrella,
      childId: ancestor,
    });

    expect(response.status).toBe(201);
    createdEdgeIds.push(response.body.id);
  });
});

describe("Deadline validation passes vacuously when either side of a pairwise check has a null deadline", () => {
  it("creates the edge (201) under the sequencing rule when the ancestor has no deadline, even though its deadline would otherwise violate sequencing", async () => {
    const task = await createObjectiveViaHttp({
      description: "Run the marathon (vacuous sequencing)",
      isTask: true,
      mapId,
      deadlineStart: "2025-03-01T00:00:00.000Z",
      deadlineEnd: "2025-04-01T00:00:00.000Z",
    });
    // No deadline at all. If this objective instead had, say,
    // deadlineEnd: "2025-03-15T00:00:00.000Z" (after the task's
    // deadlineStart), the sequencing rule would reject this edge — see the
    // "sequencing rule" describe block above. With a null deadline, there is
    // nothing to compare, so the check must pass instead of erroring.
    const ancestor = await createObjectiveViaHttp({
      description: "Build up mileage (vacuous sequencing)",
      isTask: false,
      mapId,
    });

    const response = await request(app).post("/objective-edges").send({
      parentId: task,
      childId: ancestor,
    });

    expect(response.status).toBe(201);
    createdEdgeIds.push(response.body.id);
  });

  it("creates the edge (201) under the umbrella rule when the ancestor has no deadline, even though its deadline would otherwise violate containment", async () => {
    const umbrella = await createObjectiveViaHttp({
      description: "Get fit this year (vacuous umbrella)",
      isTask: false,
      mapId,
      deadlineStart: "2025-01-01T00:00:00.000Z",
      deadlineEnd: "2025-12-31T00:00:00.000Z",
    });
    // No deadline at all. If this objective instead had, say,
    // deadlineStart: "2024-12-01T00:00:00.000Z" (starting before the
    // umbrella), the umbrella/containment rule would reject this edge — see
    // the "umbrella rule" describe block above. With a null deadline, the
    // containment check has nothing to compare and must pass instead.
    const ancestor = await createObjectiveViaHttp({
      description: "Couch to 5k (vacuous umbrella)",
      isTask: false,
      mapId,
    });

    const response = await request(app).post("/objective-edges").send({
      parentId: umbrella,
      childId: ancestor,
    });

    expect(response.status).toBe(201);
    createdEdgeIds.push(response.body.id);
  });
});

describe("Deadline validation transitivity — 2-hop grandparent umbrella over grandchild", () => {
  // This scenario specifically requires walking the full ancestor chain,
  // not just the direct edge's two endpoints: the grandchild (GC) reaches
  // its parent (P) via the *sequencing* rule (P is a task), which only
  // guarantees an ordering (GC ends before P starts) — NOT containment. So
  // when the grandparent (G, an umbrella objective) is connected to P,
  // checking G against P alone is insufficient: G must also be checked
  // against GC, and a G that only "looks at" P would wrongly accept an
  // edge that leaves GC's much-earlier interval outside G's window.
  it("returns 400 when the grandparent's interval fails to contain a transitive (2-hop) ancestor reached through a sequencing edge", async () => {
    const grandchild = await createObjectiveViaHttp({
      description: "Grandchild - far in the past",
      isTask: false,
      mapId,
      deadlineStart: "2020-01-01T00:00:00.000Z",
      deadlineEnd: "2020-02-01T00:00:00.000Z",
    });
    const parentTask = await createObjectiveViaHttp({
      description: "Parent task",
      isTask: true,
      mapId,
      deadlineStart: "2025-05-01T00:00:00.000Z",
      deadlineEnd: "2025-05-15T00:00:00.000Z",
    });
    const grandparent = await createObjectiveViaHttp({
      description: "Grandparent umbrella",
      isTask: false,
      mapId,
      deadlineStart: "2025-04-01T00:00:00.000Z",
      deadlineEnd: "2025-08-01T00:00:00.000Z",
    });

    // GC -> P: sequencing rule satisfied (GC.deadlineEnd 2020-02-01 <=
    // P.deadlineStart 2025-05-01). This edge alone is valid.
    const gcToParent = await request(app).post("/objective-edges").send({
      parentId: parentTask,
      childId: grandchild,
    });
    expect(gcToParent.status).toBe(201);
    createdEdgeIds.push(gcToParent.body.id);

    // P -> G: umbrella rule. Direct check (G contains P) passes on its own
    // (2025-04-01 <= 2025-05-01 <= 2025-05-15 <= 2025-08-01), but G does NOT
    // contain the transitive ancestor GC (2020, nowhere near G's window) —
    // this edge must be rejected.
    const parentToGrandparent = await request(app)
      .post("/objective-edges")
      .send({
        parentId: grandparent,
        childId: parentTask,
      });

    expect(parentToGrandparent.status).toBe(400);
    expect(parentToGrandparent.body.error.toLowerCase()).toContain("deadline");

    const persisted = await prisma.objectiveEdge.findMany({
      where: { parentId: grandparent, childId: parentTask },
    });
    expect(persisted).toHaveLength(0);
  });

  it("creates both edges and returns 201 when the grandparent's interval also contains the transitive (2-hop) ancestor", async () => {
    const grandchild = await createObjectiveViaHttp({
      description: "Grandchild - within range",
      isTask: false,
      mapId,
      deadlineStart: "2025-04-10T00:00:00.000Z",
      deadlineEnd: "2025-04-20T00:00:00.000Z",
    });
    const parentTask = await createObjectiveViaHttp({
      description: "Parent task 2",
      isTask: true,
      mapId,
      deadlineStart: "2025-05-01T00:00:00.000Z",
      deadlineEnd: "2025-05-15T00:00:00.000Z",
    });
    const grandparent = await createObjectiveViaHttp({
      description: "Grandparent umbrella 2",
      isTask: false,
      mapId,
      deadlineStart: "2025-04-01T00:00:00.000Z",
      deadlineEnd: "2025-08-01T00:00:00.000Z",
    });

    const gcToParent = await request(app).post("/objective-edges").send({
      parentId: parentTask,
      childId: grandchild,
    });
    expect(gcToParent.status).toBe(201);
    createdEdgeIds.push(gcToParent.body.id);

    // Now G contains both P directly and GC transitively
    // (2025-04-01 <= 2025-04-10 and 2025-04-20 <= 2025-08-01).
    const parentToGrandparent = await request(app)
      .post("/objective-edges")
      .send({
        parentId: grandparent,
        childId: parentTask,
      });

    expect(parentToGrandparent.status).toBe(201);
    createdEdgeIds.push(parentToGrandparent.body.id);
  });
});

describe("Deadline validation triggered via PATCH on an already-connected node", () => {
  it("returns 400 and leaves the deadline unchanged when updating a task's deadlineStart would violate an existing ancestor's sequencing", async () => {
    const task = await createObjectiveViaHttp({
      description: "Task with an existing ancestor",
      isTask: true,
      mapId,
      deadlineStart: "2025-06-01T00:00:00.000Z",
      deadlineEnd: "2025-07-01T00:00:00.000Z",
    });
    const ancestor = await createObjectiveViaHttp({
      description: "Ancestor before the task",
      isTask: false,
      mapId,
      deadlineStart: "2025-01-01T00:00:00.000Z",
      deadlineEnd: "2025-05-01T00:00:00.000Z",
    });

    const edge = await request(app).post("/objective-edges").send({
      parentId: task,
      childId: ancestor,
    });
    expect(edge.status).toBe(201);
    createdEdgeIds.push(edge.body.id);

    // Moving the task's deadlineStart earlier than the ancestor's
    // deadlineEnd breaks the sequencing rule for an edge that already
    // exists — the update itself, not an edge creation, must be rejected.
    const updateResponse = await request(app)
      .patch(`/objectives/${task}`)
      .send({
        description: "Task with an existing ancestor",
        isTask: true,
        deadlineStart: "2025-03-01T00:00:00.000Z",
        deadlineEnd: "2025-07-01T00:00:00.000Z",
      });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.error.toLowerCase()).toContain("deadline");

    const fromDb = await prisma.objective.findUnique({ where: { id: task } });
    expect(fromDb?.deadlineStart?.toISOString()).toBe(
      new Date("2025-06-01T00:00:00.000Z").toISOString(),
    );
  });

  it("returns 400 when flipping isTask to true on an already-connected node would violate sequencing against its ancestor", async () => {
    // A currently-satisfies-the-umbrella-rule pair, where the downstream
    // node is NOT a task, so the ancestor's interval only needs to be
    // contained — it is.
    const downstream = await createObjectiveViaHttp({
      description: "Downstream, currently a plain objective",
      isTask: false,
      mapId,
      deadlineStart: "2025-01-01T00:00:00.000Z",
      deadlineEnd: "2025-12-01T00:00:00.000Z",
    });
    const ancestor = await createObjectiveViaHttp({
      description: "Ancestor ending well after downstream's start",
      isTask: false,
      mapId,
      deadlineStart: "2025-02-01T00:00:00.000Z",
      deadlineEnd: "2025-06-01T00:00:00.000Z",
    });

    const edge = await request(app).post("/objective-edges").send({
      parentId: downstream,
      childId: ancestor,
    });
    expect(edge.status).toBe(201);
    createdEdgeIds.push(edge.body.id);

    // Flipping isTask to true switches the applicable rule to sequencing,
    // which this same ancestor now violates (ancestor's deadlineEnd
    // 2025-06-01 is after downstream's deadlineStart 2025-01-01).
    const updateResponse = await request(app)
      .patch(`/objectives/${downstream}`)
      .send({
        description: "Downstream, currently a plain objective",
        isTask: true,
        deadlineStart: "2025-01-01T00:00:00.000Z",
        deadlineEnd: "2025-12-01T00:00:00.000Z",
      });

    expect(updateResponse.status).toBe(400);
    expect(updateResponse.body.error.toLowerCase()).toContain("deadline");

    const fromDb = await prisma.objective.findUnique({
      where: { id: downstream },
    });
    expect(fromDb?.isTask).toBe(false);
  });
});

describe("Deletion never triggers deadline validation (deletion only relaxes constraints)", () => {
  it("deletes an edge over HTTP without any deadline-validation error, even though the connected objectives have deadlines", async () => {
    const task = await createObjectiveViaHttp({
      description: "Task for deletion test",
      isTask: true,
      mapId,
      deadlineStart: "2025-06-01T00:00:00.000Z",
      deadlineEnd: "2025-07-01T00:00:00.000Z",
    });
    const ancestor = await createObjectiveViaHttp({
      description: "Ancestor for deletion test",
      isTask: false,
      mapId,
      deadlineStart: "2025-01-01T00:00:00.000Z",
      deadlineEnd: "2025-05-01T00:00:00.000Z",
    });

    const edge = await request(app).post("/objective-edges").send({
      parentId: task,
      childId: ancestor,
    });
    expect(edge.status).toBe(201);

    const response = await request(app).delete(
      `/objective-edges/${edge.body.id}`,
    );
    expect(response.status).toBe(200);

    const fromDb = await prisma.objectiveEdge.findUnique({
      where: { id: edge.body.id },
    });
    expect(fromDb).toBeNull();
  });

  // Deleting an objective goes through raw Prisma (there is no DELETE
  // /objectives/:id endpoint in this codebase), so this documents — the
  // same way the "Database cascade behavior" section above does — that the
  // new deadline-validation logic lives only in the create/update paths and
  // never blocks a deletion, even for a node whose removal is the only
  // thing keeping the remaining graph deadline-consistent.
  it("cascades: deleting a deadline-bearing objective that participates in an edge removes the edge without error", async () => {
    const task = await createObjectiveViaHttp({
      description: "Task for cascade deletion test",
      isTask: true,
      mapId,
      deadlineStart: "2025-06-01T00:00:00.000Z",
      deadlineEnd: "2025-07-01T00:00:00.000Z",
    });
    const ancestor = await createObjectiveViaHttp({
      description: "Ancestor for cascade deletion test",
      isTask: false,
      mapId,
      deadlineStart: "2025-01-01T00:00:00.000Z",
      deadlineEnd: "2025-05-01T00:00:00.000Z",
    });

    const edge = await request(app).post("/objective-edges").send({
      parentId: task,
      childId: ancestor,
    });
    expect(edge.status).toBe(201);
    const edgeId = edge.body.id as number;

    await prisma.objective.delete({ where: { id: ancestor } });
    // Remove from createdObjectiveIds so afterEach's deleteMany doesn't try
    // to delete an already-deleted row.
    const idx = createdObjectiveIds.indexOf(ancestor);
    if (idx !== -1) createdObjectiveIds.splice(idx, 1);

    const fromDb = await prisma.objectiveEdge.findUnique({
      where: { id: edgeId },
    });
    expect(fromDb).toBeNull();
  });
});
