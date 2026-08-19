import { Request, Response } from "express";
import * as goalTemplateService from "../service/GoalTemplateService";

export async function createGoalTemplate(req: Request, res: Response) {
  try {
    const goalTemplate = await goalTemplateService.createGoalTemplate(req.body);
    res.status(201).json(goalTemplate);
  } catch (err) {
    if (err instanceof Error) {
      // treat thrown validation errors as client errors (400)
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "failed to create goal template" });
  }
}