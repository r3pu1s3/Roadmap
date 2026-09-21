import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import {
  createObjectiveEdge,
  deleteObjectiveEdge,
} from "../../../controllers/ObjectiveEdgeController";
import * as objectiveEdgeService from "../../../services/ObjectiveEdgeService";

// A couple of fixtures below are cast loosely into the mocked service's
// resolved-value type, matching this repo's existing test-file convention
// (see MapService.test.ts) of using `any` for hand-picked fixture shapes
// rather than maintaining full Prisma model types in every test.
/* eslint-disable @typescript-eslint/no-explicit-any */

// Mock the service layer entirely — the controller only needs to translate
// resolved/rejected promises into HTTP responses, it shouldn't know
// anything about Prisma, cycle detection, etc.
vi.mock("../../../services/ObjectiveEdgeService", () => ({
  createObjectiveEdge: vi.fn(),
  deleteObjectiveEdge: vi.fn(),
}));

// Helper to build a fake Express Request object with a body and optional params
function mockRequest(
  body: unknown,
  params: Record<string, string> = {},
): Request {
  return { body, params } as unknown as Request;
}

// Helper to build a fake Express Response object we can inspect afterward
function mockResponse(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("createObjectiveEdge controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 201 and the created edge on success, forwarding req.body unmodified", async () => {
    const fakeEdge = { id: 1, parentId: 1, childId: 2 };
    vi.mocked(objectiveEdgeService.createObjectiveEdge).mockResolvedValue(
      fakeEdge as any,
    );

    const body = { parentId: 1, childId: 2 };
    const req = mockRequest(body);
    const res = mockResponse();

    await createObjectiveEdge(req, res);

    expect(objectiveEdgeService.createObjectiveEdge).toHaveBeenCalledWith(body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(fakeEdge);
  });

  // --- 404 mapping: only these two specific messages map to "not found" ---

  it("returns 404 when the parent objective is not found", async () => {
    vi.mocked(objectiveEdgeService.createObjectiveEdge).mockRejectedValue(
      new Error("parent objective not found"),
    );

    const req = mockRequest({ parentId: 999, childId: 2 });
    const res = mockResponse();

    await createObjectiveEdge(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "parent objective not found",
    });
  });

  it("returns 404 when the child objective is not found", async () => {
    vi.mocked(objectiveEdgeService.createObjectiveEdge).mockRejectedValue(
      new Error("child objective not found"),
    );

    const req = mockRequest({ parentId: 1, childId: 999 });
    const res = mockResponse();

    await createObjectiveEdge(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: "child objective not found",
    });
  });

  // --- 400 mapping: every other validation/business-rule error from the
  // service, asserted verbatim so the client sees the exact reason ---

  it("returns 400 for a self-loop rejection", async () => {
    vi.mocked(objectiveEdgeService.createObjectiveEdge).mockRejectedValue(
      new Error("an objective cannot be its own parent"),
    );

    const req = mockRequest({ parentId: 1, childId: 1 });
    const res = mockResponse();

    await createObjectiveEdge(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "an objective cannot be its own parent",
    });
  });

  it("returns 400 for a cross-map rejection", async () => {
    vi.mocked(objectiveEdgeService.createObjectiveEdge).mockRejectedValue(
      new Error("parent and child objectives must belong to the same map"),
    );

    const req = mockRequest({ parentId: 1, childId: 2 });
    const res = mockResponse();

    await createObjectiveEdge(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "parent and child objectives must belong to the same map",
    });
  });

  it("returns 400 for a duplicate edge rejection", async () => {
    vi.mocked(objectiveEdgeService.createObjectiveEdge).mockRejectedValue(
      new Error("this edge already exists"),
    );

    const req = mockRequest({ parentId: 1, childId: 2 });
    const res = mockResponse();

    await createObjectiveEdge(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "this edge already exists",
    });
  });

  it("returns 400 for a Habit map single-parent rejection", async () => {
    vi.mocked(objectiveEdgeService.createObjectiveEdge).mockRejectedValue(
      new Error("a Habit map objective can only have one parent"),
    );

    const req = mockRequest({ parentId: 1, childId: 2 });
    const res = mockResponse();

    await createObjectiveEdge(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "a Habit map objective can only have one parent",
    });
  });

  it("returns 400 for a cycle rejection", async () => {
    vi.mocked(objectiveEdgeService.createObjectiveEdge).mockRejectedValue(
      new Error("adding this edge would create a cycle"),
    );

    const req = mockRequest({ parentId: 1, childId: 2 });
    const res = mockResponse();

    await createObjectiveEdge(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "adding this edge would create a cycle",
    });
  });

  // --- 500 for unexpected non-Error rejection ---

  it("returns 500 for an unexpected non-Error rejection", async () => {
    vi.mocked(objectiveEdgeService.createObjectiveEdge).mockRejectedValue(
      "unexpected failure",
    );

    const req = mockRequest({ parentId: 1, childId: 2 });
    const res = mockResponse();

    await createObjectiveEdge(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "failed to create objective edge",
    });
  });
});

describe("deleteObjectiveEdge controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // --- id parsing ---

  it("returns 400 without calling the service when id is not a valid integer", async () => {
    const req = mockRequest({}, { id: "not-a-number" });
    const res = mockResponse();

    await deleteObjectiveEdge(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "id must be a valid integer",
    });
    // Guards against a wasted/incorrect service call on unparseable input —
    // NaN must never reach the service layer.
    expect(objectiveEdgeService.deleteObjectiveEdge).not.toHaveBeenCalled();
  });

  // --- success ---

  it("returns 200 and the deleted edge on success", async () => {
    const fakeEdge = { id: 1, parentId: 1, childId: 2 };
    vi.mocked(objectiveEdgeService.deleteObjectiveEdge).mockResolvedValue(
      fakeEdge as any,
    );

    const req = mockRequest({}, { id: "1" });
    const res = mockResponse();

    await deleteObjectiveEdge(req, res);

    expect(objectiveEdgeService.deleteObjectiveEdge).toHaveBeenCalledWith(1);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(fakeEdge);
  });

  // --- 404 for not found ---

  it("returns 404 when the edge does not exist", async () => {
    vi.mocked(objectiveEdgeService.deleteObjectiveEdge).mockRejectedValue(
      new Error("edge not found"),
    );

    const req = mockRequest({}, { id: "999" });
    const res = mockResponse();

    await deleteObjectiveEdge(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "edge not found" });
  });

  // --- 500 for unexpected non-Error rejection ---

  it("returns 500 for an unexpected non-Error rejection", async () => {
    vi.mocked(objectiveEdgeService.deleteObjectiveEdge).mockRejectedValue(
      "unexpected failure",
    );

    const req = mockRequest({}, { id: "1" });
    const res = mockResponse();

    await deleteObjectiveEdge(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "failed to delete objective edge",
    });
  });
});
