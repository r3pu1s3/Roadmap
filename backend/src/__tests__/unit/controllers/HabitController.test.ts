/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import {
  getHabits,
  createHabit,
  getHabit,
  updateHabit,
  deleteHabit,
} from "../../../controllers/HabitController";
import * as habitService from "../../../services/HabitService";

// Mock the service layer entirely — these tests only cover HTTP
// request/response wiring, not business rules.
vi.mock("../../../services/HabitService", () => ({
  getHabits: vi.fn(),
  createHabit: vi.fn(),
  getHabit: vi.fn(),
  updateHabit: vi.fn(),
  deleteHabit: vi.fn(),
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

describe("getHabits controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 and the habits from the service", async () => {
    const fakeHabits = [
      { id: 1, name: "Run", description: null, durationMinutes: 30 },
    ];
    vi.mocked(habitService.getHabits).mockResolvedValue(fakeHabits as any);

    const res = mockResponse();
    await getHabits(mockRequest({}), res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(fakeHabits);
  });

  it("returns 400 with the message when the service throws an Error", async () => {
    vi.mocked(habitService.getHabits).mockRejectedValue(
      new Error("something went wrong"),
    );

    const res = mockResponse();
    await getHabits(mockRequest({}), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "something went wrong" });
  });

  it("returns 500 when the service throws a non-Error", async () => {
    vi.mocked(habitService.getHabits).mockRejectedValue("boom");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = mockResponse();
    await getHabits(mockRequest({}), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "failed to get habits" });
  });
});

describe("createHabit controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 201 and the created habit", async () => {
    const fakeHabit = {
      id: 1,
      name: "Run",
      description: null,
      durationMinutes: 30,
    };
    vi.mocked(habitService.createHabit).mockResolvedValue(fakeHabit as any);

    const res = mockResponse();
    await createHabit(mockRequest({ name: "Run", durationMinutes: 30 }), res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(fakeHabit);
  });

  it("forwards only name, description and durationMinutes from the body", async () => {
    vi.mocked(habitService.createHabit).mockResolvedValue({} as any);

    await createHabit(
      mockRequest({
        name: "Run",
        description: "Easy pace",
        durationMinutes: 30,
        id: 99,
        extra: "ignored",
      }),
      mockResponse(),
    );

    expect(habitService.createHabit).toHaveBeenCalledWith({
      name: "Run",
      description: "Easy pace",
      durationMinutes: 30,
    });
  });

  it("returns 400 with the message when the service throws an Error", async () => {
    vi.mocked(habitService.createHabit).mockRejectedValue(
      new Error("name is required"),
    );

    const res = mockResponse();
    await createHabit(mockRequest({ durationMinutes: 30 }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "name is required" });
  });

  it("returns 500 when the service throws a non-Error", async () => {
    vi.mocked(habitService.createHabit).mockRejectedValue("boom");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = mockResponse();
    await createHabit(mockRequest({ name: "Run", durationMinutes: 30 }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "failed to create habit" });
  });
});

describe("getHabit controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("passes the numeric id to the service and returns 200 with the habit", async () => {
    const fakeHabit = {
      id: 7,
      name: "Run",
      description: null,
      durationMinutes: 30,
    };
    vi.mocked(habitService.getHabit).mockResolvedValue(fakeHabit as any);

    const res = mockResponse();
    await getHabit(mockRequest({}, { id: "7" }), res);

    expect(habitService.getHabit).toHaveBeenCalledWith(7);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(fakeHabit);
  });

  it("returns 404 when the habit is not found", async () => {
    vi.mocked(habitService.getHabit).mockRejectedValue(
      new Error("habit not found"),
    );

    const res = mockResponse();
    await getHabit(mockRequest({}, { id: "7" }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "habit not found" });
  });

  it("returns 400 for any other Error", async () => {
    vi.mocked(habitService.getHabit).mockRejectedValue(
      new Error("id must be a valid integer"),
    );

    const res = mockResponse();
    await getHabit(mockRequest({}, { id: "abc" }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "id must be a valid integer",
    });
  });

  it("returns 500 when the service throws a non-Error", async () => {
    vi.mocked(habitService.getHabit).mockRejectedValue("boom");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = mockResponse();
    await getHabit(mockRequest({}, { id: "7" }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "failed to get habit" });
  });
});

describe("updateHabit controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 400 for a non-integer id without calling the service", async () => {
    const res = mockResponse();
    await updateHabit(mockRequest({ name: "Run" }, { id: "abc" }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "id must be a valid integer",
    });
    expect(habitService.updateHabit).not.toHaveBeenCalled();
  });

  it("forwards the id and every habit field present, and returns 200", async () => {
    const fakeHabit = {
      id: 7,
      name: "Walk",
      description: null,
      durationMinutes: 20,
    };
    vi.mocked(habitService.updateHabit).mockResolvedValue(fakeHabit as any);

    const res = mockResponse();
    await updateHabit(
      mockRequest(
        { name: "Walk", description: null, durationMinutes: 20, extra: "x" },
        { id: "7" },
      ),
      res,
    );

    expect(habitService.updateHabit).toHaveBeenCalledWith({
      id: 7,
      name: "Walk",
      description: null,
      durationMinutes: 20,
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(fakeHabit);
  });

  it("leaves out fields that are not in the body (partial update)", async () => {
    vi.mocked(habitService.updateHabit).mockResolvedValue({} as any);

    await updateHabit(
      mockRequest({ durationMinutes: 20 }, { id: "7" }),
      mockResponse(),
    );

    const forwarded = vi.mocked(habitService.updateHabit).mock.calls[0][0];
    expect(forwarded).toEqual({ id: 7, durationMinutes: 20 });
    expect(Object.keys(forwarded).sort()).toEqual(["durationMinutes", "id"]);
  });

  it("returns 404 when the habit is not found", async () => {
    vi.mocked(habitService.updateHabit).mockRejectedValue(
      new Error("habit not found"),
    );

    const res = mockResponse();
    await updateHabit(mockRequest({ name: "Run" }, { id: "7" }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "habit not found" });
  });

  it("returns 400 for a validation Error", async () => {
    vi.mocked(habitService.updateHabit).mockRejectedValue(
      new Error("name is required"),
    );

    const res = mockResponse();
    await updateHabit(mockRequest({ name: "" }, { id: "7" }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "name is required" });
  });

  it("returns 500 when the service throws a non-Error", async () => {
    vi.mocked(habitService.updateHabit).mockRejectedValue("boom");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = mockResponse();
    await updateHabit(mockRequest({ name: "Run" }, { id: "7" }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "failed to update habit" });
  });
});

describe("deleteHabit controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 400 for a non-integer id without calling the service", async () => {
    const res = mockResponse();
    await deleteHabit(mockRequest({}, { id: "abc" }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "id must be a valid integer",
    });
    expect(habitService.deleteHabit).not.toHaveBeenCalled();
  });

  it("passes the numeric id and returns 200 with the deleted habit", async () => {
    const fakeHabit = {
      id: 7,
      name: "Run",
      description: null,
      durationMinutes: 30,
    };
    vi.mocked(habitService.deleteHabit).mockResolvedValue(fakeHabit as any);

    const res = mockResponse();
    await deleteHabit(mockRequest({}, { id: "7" }), res);

    expect(habitService.deleteHabit).toHaveBeenCalledWith(7);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(fakeHabit);
  });

  it("returns 404 when the habit is not found", async () => {
    vi.mocked(habitService.deleteHabit).mockRejectedValue(
      new Error("habit not found"),
    );

    const res = mockResponse();
    await deleteHabit(mockRequest({}, { id: "7" }), res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "habit not found" });
  });

  it("returns 400 for any other Error", async () => {
    vi.mocked(habitService.deleteHabit).mockRejectedValue(
      new Error("something went wrong"),
    );

    const res = mockResponse();
    await deleteHabit(mockRequest({}, { id: "7" }), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "something went wrong" });
  });

  it("returns 500 when the service throws a non-Error", async () => {
    vi.mocked(habitService.deleteHabit).mockRejectedValue("boom");
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = mockResponse();
    await deleteHabit(mockRequest({}, { id: "7" }), res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "failed to delete habit" });
  });
});
