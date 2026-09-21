import { Router } from "express";
import {
  createMap,
  updateMap,
  getMap,
  getMaps,
} from "../controllers/MapController";

const router = Router();

router.post("/maps", createMap);
// GET /maps -> getMaps (list all maps for the map menu). Placed before
// GET /maps/:id for readability; no functional ordering conflict since
// Express distinguishes the exact "/maps" path from the "/maps/:id"
// param path regardless of declaration order.
router.get("/maps", getMaps);
router.get("/maps/:id", getMap);
// router.get("/maps/:id/objectives", getMapObjectives);
router.patch("/maps/:id", updateMap);
// router.delete("/maps/:id", deleteMap);

export default router;
