import express from "express";
import objectiveRoutes from "./routes/ObjectiveRoute";
import objectiveEdgeRoutes from "./routes/ObjectiveEdgeRoute";
import mapRoutes from "./routes/MapRoute";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

app.use(objectiveRoutes);
// objective-edges paths (/objective-edges, /objective-edges/:id) are
// distinct from the /objectives paths above, so mounting order here
// doesn't matter — no collision.
app.use(objectiveEdgeRoutes);
app.use(mapRoutes);
const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
