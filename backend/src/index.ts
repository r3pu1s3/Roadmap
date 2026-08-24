import express from "express";
import goalNodeRoutes from "./routes/GoalNodeRoute";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Mount all goal-node routes. Every route defined in goalNodeRoutes.ts
// becomes live here — e.g. router.post("/goal-nodes", ...) is now
// reachable at http://localhost:3000/goal-nodes
app.use(goalNodeRoutes);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});