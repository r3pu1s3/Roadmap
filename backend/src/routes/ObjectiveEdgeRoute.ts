import { Router } from "express";
import {
  createObjectiveEdge,
  deleteObjectiveEdge,
} from "../controllers/ObjectiveEdgeController";

const router = Router();

router.post("/objective-edges", createObjectiveEdge);
router.delete("/objective-edges/:id", deleteObjectiveEdge);

export default router;
