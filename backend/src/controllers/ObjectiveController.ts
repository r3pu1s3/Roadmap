import { Request, Response } from "express";
import * as objectiveService from "../services/ObjectiveService";

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

    // Only description/isTask/deadlineStart/deadlineEnd are forwarded — even
    // if the client sends an "id" in the body, it's silently ignored rather
    // than overriding the id parsed and validated from the URL param above.
    // deadlineStart/deadlineEnd are now mandatory on every Objective, so
    // they're whitelisted through here just like description/isTask; the
    // service is responsible for rejecting missing/invalid values.
    const objective = await objectiveService.updateObjective({
      id,
      description: req.body.description,
      isTask: req.body.isTask,
      deadlineStart: req.body.deadlineStart,
      deadlineEnd: req.body.deadlineEnd,
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
