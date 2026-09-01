import { Router } from "express";
import { createObjective } from "../controller/ObjectiveController";

const router = Router();

router.post("/objective", createObjective);
// router.get("/goal-nodes/:id", getGoalNode);
// router.get("/goal-nodes/:id/children", getGoalNodeChildren);
// router.patch("/goal-nodes/:id", updateGoalNode);
// router.delete("/goal-nodes/:id", deleteGoalNode);

export default router;