import { Router } from "express";
import { createGoalNode } from "../controller/goalNodeController";

const router = Router();

router.post("/goal-nodes", createGoalNode);
// router.get("/goal-nodes/:id", getGoalNode);
// router.get("/goal-nodes/:id/children", getGoalNodeChildren);
// router.patch("/goal-nodes/:id", updateGoalNode);
// router.delete("/goal-nodes/:id", deleteGoalNode);

export default router;