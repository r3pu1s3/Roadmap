import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import { createObjective } from "./ObjectiveController";
import * as objectiveService from "../service/ObjectiveService";

// Mock the service layer entirely — the controller should never know or
// care whether the underlying logic succeeds via Prisma, a mock, or
// anything else. We're only testing HTTP request/response wiring here.
vi.mock("../service/ObjectiveService");

// Helper to build a fake Express Request object with just a body
function mockRequest(body: unknown): Request {
  return { body } as Request;
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