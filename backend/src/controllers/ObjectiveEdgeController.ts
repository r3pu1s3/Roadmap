import { Request, Response } from "express";
import * as objectiveEdgeService from "../services/ObjectiveEdgeService";

// POST /objective-edges — create an edge between two objectives (parent ->
// child). req.body is forwarded unmodified to the service, which owns all
// validation (existence, self-loop, cross-map, duplicate, cycle detection).
export async function createObjectiveEdge(req: Request, res: Response) {
  try {
    const edge = await objectiveEdgeService.createObjectiveEdge(req.body);
    res.status(201).json(edge);
  } catch (err) {
    if (err instanceof Error) {
      // Only the two "not found" messages map to 404; every other
      // service-thrown validation/business-rule error (self-loop,
      // cross-map, duplicate, cycle) is a 400.
      if (
        err.message === "parent objective not found" ||
        err.message === "child objective not found"
      ) {
        return res.status(404).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "failed to create objective edge" });
  }
}

// DELETE /objective-edges/:id — delete an edge by id.
export async function deleteObjectiveEdge(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be a valid integer" });
    }

    const edge = await objectiveEdgeService.deleteObjectiveEdge(id);
    res.status(200).json(edge);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "edge not found") {
        return res.status(404).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "failed to delete objective edge" });
  }
}
