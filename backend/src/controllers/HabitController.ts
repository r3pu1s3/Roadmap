import { Request, Response } from "express";
import * as habitService from "../services/HabitService";

// POST /habits — create a habit. Only the four habit fields are forwarded;
// any other keys in the body (e.g. an `id`) are dropped here.
export async function createHabit(req: Request, res: Response) {
  try {
    const { name, description, durationMinutes, period } = req.body;
    const habit = await habitService.createHabit({
      name,
      description,
      durationMinutes,
      period,
    });
    res.status(201).json(habit);
  } catch (err) {
    if (err instanceof Error) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "failed to create habit" });
  }
}

// GET /habits — list all habits for the habits page. No inputs to parse, so
// req is unused (prefixed with "_" to satisfy noUnusedParameters).
export async function getHabits(_req: Request, res: Response) {
  try {
    const habits = await habitService.getHabits();
    res.status(200).json(habits);
  } catch (err) {
    if (err instanceof Error) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "failed to get habits" });
  }
}

// GET /habits/:id — fetch one habit for the update page.
export async function getHabit(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const habit = await habitService.getHabit(id);
    res.status(200).json(habit);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "habit not found") {
        return res.status(404).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "failed to get habit" });
  }
}

// PATCH /habits/:id — partial update. Only habit fields actually present in
// the body are forwarded, so the service can tell "leave unchanged" (key
// absent) apart from "clear it" (e.g. description: null).
export async function updateHabit(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be a valid integer" });
    }

    // Express 5 leaves req.body undefined when no JSON body was sent.
    const body = req.body ?? {};
    const fields: Partial<
      Record<"name" | "description" | "durationMinutes" | "period", unknown>
    > = {};
    for (const key of [
      "name",
      "description",
      "durationMinutes",
      "period",
    ] as const) {
      if (key in body) fields[key] = body[key];
    }

    const habit = await habitService.updateHabit({ id, ...fields });
    res.status(200).json(habit);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "habit not found") {
        return res.status(404).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "failed to update habit" });
  }
}

// DELETE /habits/:id — permanently delete a habit; returns the deleted habit.
export async function deleteHabit(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be a valid integer" });
    }

    const habit = await habitService.deleteHabit(id);
    res.status(200).json(habit);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "habit not found") {
        return res.status(404).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "failed to delete habit" });
  }
}
