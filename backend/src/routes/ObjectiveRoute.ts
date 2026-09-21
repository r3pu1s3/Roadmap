import { Router } from "express";
import {
  createObjective,
  updateObjective,
} from "../controllers/ObjectiveController";

const router = Router();

router.post("/objectives", createObjective);
router.patch("/objectives/:id", updateObjective);

export default router;
