import { Request, Response } from "express";
import * as objectiveService from "../service/ObjectiveService";

export async function createObjective(req: Request, res: Response) {
  try {
    const body = {
      ...req.body,
      // JSON transmits dates as strings — convert to a real Date before
      // handing off to the service, which expects deadline to be a Date.
      deadline: req.body.deadline !== undefined ? new Date(req.body.deadline) : undefined,
    };

    const goalNode = await objectiveService.createObjective(body);
    res.status(201).json(goalNode);
  } catch (err) {
    if (err instanceof Error) {
      // treat thrown validation errors as client errors (400)
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "failed to create objective" });
  }
}