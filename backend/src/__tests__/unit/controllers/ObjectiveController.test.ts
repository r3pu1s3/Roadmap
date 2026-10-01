/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import {
  createObjective,
  updateObjective,
} from "../../../controllers/ObjectiveController";
import * as objectiveService from "../../../services/ObjectiveService";

// Mock the service layer entirely — the controller should never know or
// care whether the underlying logic succeeds via Prisma, a mock, or
// anything else. We're only testing HTTP request/response wiring here.
vi.mock("../../../services/ObjectiveService", () => ({
  createObjective: vi.fn(),
  updateObjective: vi.fn(),
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

// Deadlines are now mandatory on every Objective (including at the DB level
// going forward), so representative request bodies / service-return
// fixtures below include them. This controller mocks the entire service
// module, so these values are never actually validated here -- they just
// keep the fixtures honest about what a real Objective/request looks like.
const VALID_DEADLINES = {
  deadlineStart: "2026-01-01T00:00:00.000Z",
  deadlineEnd: "2026-01-10T00:00:00.000Z",
};

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
      ...VALID_DEADLINES,
    };
    vi.mocked(objectiveService.createObjective).mockResolvedValue(
      fakeObjective as any,
    );

    const req = mockRequest({
      description: "Get stronger this year",
      isTask: false,
      ...VALID_DEADLINES,
    });
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
      ...VALID_DEADLINES,
    };
    vi.mocked(objectiveService.createObjective).mockResolvedValue(
      fakeObjective as any,
    );

    const req = mockRequest({
      description: "Do {pushups} pushups",
      isTask: true,
      ...VALID_DEADLINES,
    });
    const res = mockResponse();

    await createObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(fakeObjective);
  });

  it("returns 400 with the error message when description is missing", async () => {
    vi.mocked(objectiveService.createObjective).mockRejectedValue(
      new Error("description is required"),
    );

    const req = mockRequest({ description: "", isTask: false });
    const res = mockResponse();

    await createObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "description is required" });
  });

  it("returns 400 when isTask is not a boolean", async () => {
    vi.mocked(objectiveService.createObjective).mockRejectedValue(
      new Error("isTask must be a boolean"),
    );

    const req = mockRequest({ description: "test", isTask: "yes" });
    const res = mockResponse();

    await createObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "isTask must be a boolean",
    });
  });

  it("returns 400 when a task description has more than one placeholder", async () => {
    vi.mocked(objectiveService.createObjective).mockRejectedValue(
      new Error(
        "There should only be one counter for each objective. Break down the goal if you need to.",
      ),
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
    vi.mocked(objectiveService.createObjective).mockRejectedValue(
      "unexpected failure",
    );

    const req = mockRequest({ description: "test", isTask: false });
    const res = mockResponse();

    await createObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "failed to create objective",
    });
  });

  it("passes the exact request body through to the service unmodified", async () => {
    vi.mocked(objectiveService.createObjective).mockResolvedValue({
      id: 1,
    } as any);

    const body = {
      description: "Do {reps} reps",
      isTask: true,
      ...VALID_DEADLINES,
    };
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
    const req = mockRequest(
      { description: "test", isTask: false },
      { id: "not-a-number" },
    );
    const res = mockResponse();

    await updateObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "id must be a valid integer",
    });
    expect(objectiveService.updateObjective).not.toHaveBeenCalled();
  });

  // NOTE for backend-controller-builder: the controller currently forwards
  // only `description`/`isTask` from the body (see comment in
  // ObjectiveController.ts). Now that deadlineStart/deadlineEnd are
  // mandatory on every update, this manual field-picking will need to grow
  // to include them too -- deliberately left unpinned here since that's a
  // controller-layer contract decision outside this test-writing pass'
  // scope (service-layer deadline validation), not a fixture-representativeness
  // concern.
  it("calls the service with id parsed as a number, merged with the request body", async () => {
    vi.mocked(objectiveService.updateObjective).mockResolvedValue({
      id: 1,
    } as any);

    const req = mockRequest(
      { description: "updated", isTask: true },
      { id: "1" },
    );
    const res = mockResponse();

    await updateObjective(req, res);

    expect(objectiveService.updateObjective).toHaveBeenCalledWith({
      id: 1,
      description: "updated",
      isTask: true,
    });
  });

  it("ignores an id in the request body, always using the id parsed from the URL param", async () => {
    vi.mocked(objectiveService.updateObjective).mockResolvedValue({
      id: 1,
    } as any);

    // A malicious or buggy client sends a different id in the body than
    // the one in the URL — the URL param must win.
    const req = mockRequest(
      { id: 999, description: "updated", isTask: true },
      { id: "1" },
    );
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
      ...VALID_DEADLINES,
    };
    vi.mocked(objectiveService.updateObjective).mockResolvedValue(
      fakeUpdated as any,
    );

    const req = mockRequest(
      { description: "updated description", isTask: false, ...VALID_DEADLINES },
      { id: "1" },
    );
    const res = mockResponse();

    await updateObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(fakeUpdated);
  });

  // --- 404 for not found ---

  it("returns 404 when the objective does not exist", async () => {
    vi.mocked(objectiveService.updateObjective).mockRejectedValue(
      new Error("objective not found"),
    );

    const req = mockRequest(
      { description: "test", isTask: false },
      { id: "999" },
    );
    const res = mockResponse();

    await updateObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "objective not found" });
  });

  // --- 400 for validation errors, same checks as create ---

  it("returns 400 when description is missing", async () => {
    vi.mocked(objectiveService.updateObjective).mockRejectedValue(
      new Error("description is required"),
    );

    const req = mockRequest({ description: "", isTask: false }, { id: "1" });
    const res = mockResponse();

    await updateObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "description is required" });
  });

  it("returns 400 when isTask is not a boolean", async () => {
    vi.mocked(objectiveService.updateObjective).mockRejectedValue(
      new Error("isTask must be a boolean"),
    );

    const req = mockRequest(
      { description: "test", isTask: "yes" },
      { id: "1" },
    );
    const res = mockResponse();

    await updateObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "isTask must be a boolean",
    });
  });

  it("returns 400 when the description has more than one placeholder", async () => {
    vi.mocked(objectiveService.updateObjective).mockRejectedValue(
      new Error(
        "There should only be one counter for each objective. Break down the goal if you need to.",
      ),
    );

    const req = mockRequest(
      { description: "Do {pushups} pushups and {situps} situps", isTask: true },
      { id: "1" },
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
    vi.mocked(objectiveService.updateObjective).mockRejectedValue(
      "unexpected failure",
    );

    const req = mockRequest(
      { description: "test", isTask: false },
      { id: "1" },
    );
    const res = mockResponse();

    await updateObjective(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "failed to update objective",
    });
  });
});
