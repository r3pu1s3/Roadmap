import { Request, Response } from "express";
import * as mapService from "../services/MapService";

export async function createMap(req: Request, res: Response) {
  try {
    const map = await mapService.createMap(req.body);
    res.status(201).json(map);
  } catch (err) {
    if (err instanceof Error) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "failed to create map" });
  }
}
// GET /maps — list all maps for the map menu. No inputs to parse/validate,
// so there's no id/body-shape 400 case here (unlike getMap/updateMap) —
// only the service's own failure (non-Error) maps to 500.
// req is unused (no route params/body to parse for a plain list endpoint)
// but kept as a parameter, prefixed with "_", to match the standard Express
// handler signature expected by the router while satisfying
// noUnusedParameters.
export async function getMaps(_req: Request, res: Response) {
  try {
    const maps = await mapService.getMaps();
    res.status(200).json(maps);
  } catch (err) {
    if (err instanceof Error) {
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "failed to get maps" });
  }
}

export async function getMap(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);
    const map = await mapService.getMap(id);
    res.status(200).json(map);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "map not found") {
        return res.status(404).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "failed to get map" });
  }
}

export async function updateMap(req: Request, res: Response) {
  try {
    const id = Number(req.params.id);

    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: "id must be a valid integer" });
    }

    // Only "name" is forwarded — even if the client sends other fields
    // (e.g. type), they're silently ignored rather than passed through,
    // since updateMap only accepts { id, name }.
    const map = await mapService.updateMap({ id, name: req.body.name });
    res.status(200).json(map);
  } catch (err) {
    if (err instanceof Error) {
      if (err.message === "map not found") {
        return res.status(404).json({ error: err.message });
      }
      return res.status(400).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "failed to update map" });
  }
}
