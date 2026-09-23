/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response } from "express";
import {
  createMap,
  updateMap,
  getMaps,
  getMap,
} from "../../../controllers/MapController";
import * as mapService from "../../../services/MapService";

// Mock the service layer entirely — the controller should never know or
// care whether the underlying logic succeeds via Prisma, a mock, or
// anything else. We're only testing HTTP request/response wiring here.
vi.mock("../../../services/MapService", () => ({
  createMap: vi.fn(),
  updateMap: vi.fn(),
  getMaps: vi.fn(),
  getMap: vi.fn(),
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

describe("createMap controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 201 and the created map on success, with the service called with req.body unmodified", async () => {
    const fakeMap = { id: 1, name: "My Project" };
    vi.mocked(mapService.createMap).mockResolvedValue(fakeMap as any);

    const body = { name: "My Project" };
    const req = mockRequest(body);
    const res = mockResponse();

    await createMap(req, res);

    expect(mapService.createMap).toHaveBeenCalledWith(body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(fakeMap);
  });

  it("returns 400 with the error message when name is missing", async () => {
    vi.mocked(mapService.createMap).mockRejectedValue(
      new Error("name is required"),
    );

    const req = mockRequest({ name: "" });
    const res = mockResponse();

    await createMap(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "name is required" });
  });

  it("returns 400 when name exceeds 10 words", async () => {
    vi.mocked(mapService.createMap).mockRejectedValue(
      new Error("name must be 10 words or fewer (got 11)"),
    );

    const longName = Array(11).fill("word").join(" ");
    const req = mockRequest({ name: longName });
    const res = mockResponse();

    await createMap(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "name must be 10 words or fewer (got 11)",
    });
  });

  it("returns 500 for an unexpected non-Error rejection", async () => {
    vi.mocked(mapService.createMap).mockRejectedValue("unexpected failure");

    const req = mockRequest({ name: "Valid Name" });
    const res = mockResponse();

    await createMap(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "failed to create map",
    });
  });
});

describe("updateMap controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // --- id parsing ---

  it("returns 400 without calling the service when id is not a valid integer", async () => {
    const req = mockRequest({ name: "New Name" }, { id: "not-a-number" });
    const res = mockResponse();

    await updateMap(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "id must be a valid integer",
    });
    expect(mapService.updateMap).not.toHaveBeenCalled();
  });

  // Stray fields must be dropped — updateMap only ever accepts { id, name }.
  it("calls the service with { id: parsedNumber, name } for a valid numeric id, dropping any other body fields", async () => {
    vi.mocked(mapService.updateMap).mockResolvedValue({ id: 1 } as any);

    const req = mockRequest({ name: "New Name", extra: "field" }, { id: "1" });
    const res = mockResponse();

    await updateMap(req, res);

    expect(mapService.updateMap).toHaveBeenCalledWith({
      id: 1,
      name: "New Name",
    });
  });

  // --- success ---

  it("returns 200 and the updated map on success", async () => {
    const fakeUpdated = { id: 1, name: "New Name" };
    vi.mocked(mapService.updateMap).mockResolvedValue(fakeUpdated as any);

    const req = mockRequest({ name: "New Name" }, { id: "1" });
    const res = mockResponse();

    await updateMap(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(fakeUpdated);
  });

  // --- 404 for not found ---

  it("returns 404 when the map does not exist", async () => {
    vi.mocked(mapService.updateMap).mockRejectedValue(
      new Error("map not found"),
    );

    const req = mockRequest({ name: "New Name" }, { id: "999" });
    const res = mockResponse();

    await updateMap(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "map not found" });
  });

  // --- 400 for each validation message ---

  it("returns 400 when name is missing", async () => {
    vi.mocked(mapService.updateMap).mockRejectedValue(
      new Error("name is required"),
    );

    const req = mockRequest({ name: "" }, { id: "1" });
    const res = mockResponse();

    await updateMap(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "name is required" });
  });

  it("returns 400 when name exceeds 10 words", async () => {
    vi.mocked(mapService.updateMap).mockRejectedValue(
      new Error("name must be 10 words or fewer (got 11)"),
    );

    const longName = Array(11).fill("word").join(" ");
    const req = mockRequest({ name: longName }, { id: "1" });
    const res = mockResponse();

    await updateMap(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "name must be 10 words or fewer (got 11)",
    });
  });

  // --- 500 for unexpected non-Error rejection ---

  it("returns 500 for an unexpected non-Error rejection", async () => {
    vi.mocked(mapService.updateMap).mockRejectedValue("unexpected failure");

    const req = mockRequest({ name: "New Name" }, { id: "1" });
    const res = mockResponse();

    await updateMap(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "failed to update map",
    });
  });
});

describe("getMaps controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns 200 and the array of maps on success", async () => {
    const fakeMaps = [
      { id: 1, name: "First" },
      { id: 2, name: "Second" },
    ];
    vi.mocked(mapService.getMaps).mockResolvedValue(fakeMaps as any);

    const req = mockRequest(undefined);
    const res = mockResponse();

    await getMaps(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(fakeMaps);
  });

  // Empty result must still be a 200 with an empty array body, not an
  // error — "no maps yet" is a valid, successful state.
  it("returns 200 and an empty array when there are no maps", async () => {
    vi.mocked(mapService.getMaps).mockResolvedValue([]);

    const req = mockRequest(undefined);
    const res = mockResponse();

    await getMaps(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([]);
  });

  it("returns 500 for an unexpected non-Error rejection", async () => {
    vi.mocked(mapService.getMaps).mockRejectedValue("unexpected failure");

    const req = mockRequest(undefined);
    const res = mockResponse();

    await getMaps(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "failed to get maps",
    });
  });
});

describe("getMap controller", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // --- success ---

  // Asserts the controller forwards the service's response body verbatim,
  // including the new objectives/edges graph shape, without reshaping it.
  it("returns 200 and the exact object the service resolves with", async () => {
    const fakeMap = {
      id: 1,
      name: "My Map",
      objectives: [
        {
          id: 10,
          description: "Do a thing",
          isTask: false,
          mapId: 1,
          counter: null,
        },
      ],
      edges: [{ id: 5, parentId: 10, childId: 11 }],
    };
    vi.mocked(mapService.getMap).mockResolvedValue(fakeMap as any);

    const req = mockRequest(undefined, { id: "1" });
    const res = mockResponse();

    await getMap(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(fakeMap);
  });

  it("calls the service with Number(req.params.id)", async () => {
    vi.mocked(mapService.getMap).mockResolvedValue({ id: 42 } as any);

    const req = mockRequest(undefined, { id: "42" });
    const res = mockResponse();

    await getMap(req, res);

    expect(mapService.getMap).toHaveBeenCalledWith(42);
  });

  // --- 404 for not found ---

  it("returns 404 when the service rejects with 'map not found'", async () => {
    vi.mocked(mapService.getMap).mockRejectedValue(new Error("map not found"));

    const req = mockRequest(undefined, { id: "999" });
    const res = mockResponse();

    await getMap(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "map not found" });
  });

  // --- 400 for any other validation error ---

  it("returns 400 when the service rejects with any other Error", async () => {
    vi.mocked(mapService.getMap).mockRejectedValue(
      new Error("id must be a valid integer"),
    );

    const req = mockRequest(undefined, { id: "not-a-number" });
    const res = mockResponse();

    await getMap(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "id must be a valid integer",
    });
  });

  // --- 500 for unexpected non-Error rejection ---

  it("returns 500 for an unexpected non-Error rejection", async () => {
    vi.mocked(mapService.getMap).mockRejectedValue("unexpected failure");

    const req = mockRequest(undefined, { id: "1" });
    const res = mockResponse();

    await getMap(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: "failed to get map",
    });
  });
});
