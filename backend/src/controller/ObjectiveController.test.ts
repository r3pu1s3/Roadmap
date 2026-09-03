import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { createObjective, updateObjective } from "./ObjectiveController";
import * as objectiveService from "../service/ObjectiveService";

// Mock the service layer entirely — the controller should never know or
// care whether the underlying logic succeeds via Prisma, a mock, or
// anything else. We're only testing HTTP request/response wiring here.
vi.mock("../service/ObjectiveService", () => ({
  createObjective: vi.fn(),
  updateObjective: vi.fn(),
}));

// Helper to build a fake Express Request object with a body and optional params
function mockRequest(body: unknown, params: Record<string, string> = {}): Request {
  return { body, params } as unknown as Request;
}

// Helper to build a fake Express Response object we can inspect afterward
function mockResponse(): Response {
  const res = {} as Response;
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("createObjective controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 201 and the created objective on success", async () => {
    const fakeObjective = {
      id: 1,
      description: "Get stronger this year",
      isTask: false,
      counter: null,
    };
    vi.mocked(objectiveService.createObjective).mockResolvedValue(fakeObjective as any);

    const req = mockRequest({ description: "Get stronger this year", isTask: false });
    const res = mockResponse();

    await createObjective(req, res);

    expect(objectiveService.createObjective).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(fakeObjective);
  });

  it("returns 201 with a nested counter when the objective is a task", async () => {
    const fakeObjective = {
      id: 2,
      description: "Do {pushups} pushups",
      isTask: true,
      counter: { id: 1, label: "pushups", targetQuantity: null },
    };
    vi.mocked(objectiveService.createObjective).mockResolvedValue(fakeObjective as any);

    const req = mockRequest({ description: "Do {pushups} pushups", isTask: true });
    const res = mockResponse();

    await createObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(fakeObjective);
  });

  it("returns 400 with the error message when description is missing", async () => {
    vi.mocked(objectiveService.createObjective).mockRejectedValue(
      new Error("description is required")
    );

    const req = mockRequest({ description: "", isTask: false });
    const res = mockResponse();

    await createObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "description is required" });
  });

  it("returns 400 when isTask is not a boolean", async () => {
    vi.mocked(objectiveService.createObjective).mockRejectedValue(
      new Error("isTask must be a boolean")
    );

    const req = mockRequest({ description: "test", isTask: "yes" });
    const res = mockResponse();

    await createObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "isTask must be a boolean" });
  });

  it("returns 400 when a task description has more than one placeholder", async () => {
    vi.mocked(objectiveService.createObjective).mockRejectedValue(
      new Error(
        "There should only be one counter for each objective. Break down the goal if you need to."
      )
    );

    const req = mockRequest({
      description: "Do {pushups} pushups and {situps} situps",
      isTask: true,
    });
    const res = mockResponse();

    await createObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "There should only be one counter for each objective. Break down the goal if you need to.",
    });
  });

  it("returns 500 for an unexpected non-Error rejection", async () => {
    vi.mocked(objectiveService.createObjective).mockRejectedValue("unexpected failure");

    const req = mockRequest({ description: "test", isTask: false });
    const res = mockResponse();

    await createObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "failed to create objective" });
  });

  it("passes the exact request body through to the service unmodified", async () => {
    vi.mocked(objectiveService.createObjective).mockResolvedValue({ id: 1 } as any);

    const body = { description: "Do {reps} reps", isTask: true };
    const req = mockRequest(body);
    const res = mockResponse();

    await createObjective(req, res);

    expect(objectiveService.createObjective).toHaveBeenCalledWith(body);
  });
});

describe("updateObjective controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // --- id parsing ---

  it("returns 400 without calling the service when id is not a valid integer", async () => {
    const req = mockRequest({ description: "test", isTask: false }, { id: "not-a-number" });
    const res = mockResponse();

    await updateObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "id must be a valid integer" });
    expect(objectiveService.updateObjective).not.toHaveBeenCalled();
  });

  it("calls the service with id parsed as a number, merged with the request body", async () => {
    vi.mocked(objectiveService.updateObjective).mockResolvedValue({ id: 1 } as any);

    const req = mockRequest({ description: "updated", isTask: true }, { id: "1" });
    const res = mockResponse();

    await updateObjective(req, res);

    expect(objectiveService.updateObjective).toHaveBeenCalledWith({
      id: 1,
      description: "updated",
      isTask: true,
    });
  });

  // --- success ---

  it("returns 200 and the updated objective on success", async () => {
    const fakeUpdated = {
      id: 1,
      description: "updated description",
      isTask: false,
      counter: null,
    };
    vi.mocked(objectiveService.updateObjective).mockResolvedValue(fakeUpdated as any);

    const req = mockRequest({ description: "updated description", isTask: false }, { id: "1" });
    const res = mockResponse();

    await updateObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(fakeUpdated);
  });

  // --- 404 for not found ---

  it("returns 404 when the objective does not exist", async () => {
    vi.mocked(objectiveService.updateObjective).mockRejectedValue(
      new Error("objective not found")
    );

    const req = mockRequest({ description: "test", isTask: false }, { id: "999" });
    const res = mockResponse();

    await updateObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "objective not found" });
  });

  // --- 400 for validation errors, same checks as create ---

  it("returns 400 when description is missing", async () => {
    vi.mocked(objectiveService.updateObjective).mockRejectedValue(
      new Error("description is required")
    );

    const req = mockRequest({ description: "", isTask: false }, { id: "1" });
    const res = mockResponse();

    await updateObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "description is required" });
  });

  it("returns 400 when isTask is not a boolean", async () => {
    vi.mocked(objectiveService.updateObjective).mockRejectedValue(
      new Error("isTask must be a boolean")
    );

    const req = mockRequest({ description: "test", isTask: "yes" }, { id: "1" });
    const res = mockResponse();

    await updateObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "isTask must be a boolean" });
  });

  it("returns 400 when the description has more than one placeholder", async () => {
    vi.mocked(objectiveService.updateObjective).mockRejectedValue(
      new Error(
        "There should only be one counter for each objective. Break down the goal if you need to."
      )
    );

    const req = mockRequest(
      { description: "Do {pushups} pushups and {situps} situps", isTask: true },
      { id: "1" }
    );
    const res = mockResponse();

    await updateObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error:
        "There should only be one counter for each objective. Break down the goal if you need to.",
    });
  });

  // --- 500 for unexpected non-Error rejection ---

  it("returns 500 for an unexpected non-Error rejection", async () => {
    vi.mocked(objectiveService.updateObjective).mockRejectedValue("unexpected failure");

    const req = mockRequest({ description: "test", isTask: false }, { id: "1" });
    const res = mockResponse();

    await updateObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "failed to update objective" });
  });
});