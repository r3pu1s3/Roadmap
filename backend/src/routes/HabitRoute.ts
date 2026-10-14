import { Router } from "express";
import {
  createHabit,
  getHabits,
  getHabit,
  updateHabit,
  deleteHabit,
} from "../controllers/HabitController";

const router = Router();

router.post("/habits", createHabit);
router.get("/habits", getHabits);
router.get("/habits/:id", getHabit);
router.patch("/habits/:id", updateHabit);
router.delete("/habits/:id", deleteHabit);

export default router;
