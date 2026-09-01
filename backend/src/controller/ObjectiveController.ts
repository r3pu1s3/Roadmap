import { Request, Response } from "express";
import * as objectiveService from "../service/ObjectiveService";

export async function createObjective(req: Request, res: Response) {
  try {
    const objective = await objectiveService.createObjective(req.body);
    res.status(201).json(objective);
  } catch (err) {
    if (err instanceof Error) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "failed to create objective" });
  }
}

export async function updateObjective(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be a valid integer" });
    }

    const objective = await objectiveService.updateObjective({
      id,
      ...req.body,
    });
    res.status(200).json(objective);
  } catch (err) {
    if (err instanceof Error) {
      // "objective not found" is a 404, everything else is a validation 400
      if (err.message === "objective not found") {
        return res.status(404).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "failed to update objective" });
  }
}