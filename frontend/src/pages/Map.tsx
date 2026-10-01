import {
  useCallback,
  useEffect,
  useState,
  type MouseEvent as ReactFlowMouseEvent,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useReactFlow,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type NodeChange,
  type Edge,
  type EdgeChange,
  type Connection,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import Objective from "../components/Objective";
import ObjectiveFormSidebar, {
  type ObjectiveFormData,
} from "../components/ObjectiveSidebar";
import ObjectiveEditSidebar, {
  type ObjectiveData,
  type UpdateObjectiveFormData,
} from "../components/ObjectiveEditSidebar";
import { createObjective, updateObjective } from "../apis/ObjectiveApi";
import {
  createObjectiveEdge,
  deleteObjectiveEdge,
} from "../apis/ObjectiveEdgeApi";
import { getMap } from "../apis/MapApi";
import CanvasErrorBanner from "../components/CanvasErrorBanner";
import CanvasExitButton from "../components/CanvasExitButton";

const nodeTypes = { objective: Objective };

let nextId = 1;
let nextEdgeId = 1;

// Local shape stashed on every edge's `data` so we can later map a React
// Flow (local, ephemeral) edge id back to the database id needed for
// deleteObjectiveEdge, and so the client-side cycle check in handleConnect
// can walk parent/child relationships without re-fetching anything.
interface EdgeData {
  dbId: number;
  parentId: number;
  childId: number;
  [key: string]: unknown;
}

function MapInner() {
  const { mapId } = useParams<{ mapId: string }>();
  const navigate = useNavigate();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge<EdgeData>[]>([]);
  const [edgeError, setEdgeError] = useState<string | null>(null);

  // --- hydration state (loading the map's full graph on mount) ---
  const [loadState, setLoadState] = useState<"loading" | "loaded" | "error">(
    "loading",
  );
  const [loadError, setLoadError] = useState<string | null>(null);

  // --- create flow state ---
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // --- edit flow state ---
  const [editingNode, setEditingNode] = useState<Node | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditSaving, setIsEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const { screenToFlowPosition } = useReactFlow();

  // Fetch the full graph (objectives + edges) for this map on mount and lay
  // it out on the canvas. Re-runs if :mapId changes (though the test suite's
  // static useParams mock can't exercise that branch).
  useEffect(() => {
    let cancelled = false;

    // Wrapped in an async function (rather than setState calls directly in
    // the effect body) both for readability with the try/catch below and to
    // satisfy the react-hooks lint rule against synchronous setState calls
    // directly inside an effect body.
    async function loadGraph() {
      setLoadState("loading");
      setLoadError(null);

      // An invalid :mapId (missing/non-integer) is routed through the same
      // try/catch as a real fetch failure below, rather than an early
      // return, so both error paths funnel through one place.
      const numericMapId = Number(mapId);
      if (mapId == null || !Number.isInteger(numericMapId)) {
        throw new Error("Invalid map id");
      }

      const graph = await getMap(numericMapId);
      if (cancelled) return;

      // Longest-path-from-source layering: childId is the upstream/first
      // objective and parentId is the downstream/later one (see the edge
      // source/target comment below), so a node with no incoming
      // "predecessor" edges (nothing points at it as a parentId) is layer
      // 0; every other node's layer is 1 + the max layer of its
      // predecessors. Memoized since a naive per-node DFS could otherwise
      // revisit shared ancestors many times over. Safe from infinite
      // recursion because ObjectiveEdge is guaranteed cycle-free by the
      // backend.
      //
      // Plain Record objects (keyed by numeric id) are used here instead of
      // the built-in Map class deliberately: this module's own default
      // export is a component named `Map` (a hoisted function declaration),
      // which shadows the global `Map` constructor for the rest of this
      // file — `new Map()` here would silently construct this React
      // component instead of a real Map instance.
      const predecessorsOf: Record<number, number[]> = {};
      for (const edge of graph.edges) {
        (predecessorsOf[edge.parentId] ??= []).push(edge.childId);
      }

      const layerCache: Record<number, number> = {};
      const computeLayer = (objectiveId: number): number => {
        if (objectiveId in layerCache) return layerCache[objectiveId];
        const predecessorIds = predecessorsOf[objectiveId] ?? [];
        const layer =
          predecessorIds.length === 0
            ? 0
            : 1 + Math.max(...predecessorIds.map((id) => computeLayer(id)));
        layerCache[objectiveId] = layer;
        return layer;
      };

      const layerByObjectiveId: Record<number, number> = {};
      for (const objective of graph.objectives) {
        layerByObjectiveId[objective.id] = computeLayer(objective.id);
      }

      const layerValues = Object.values(layerByObjectiveId);
      const maxLayer = layerValues.length > 0 ? Math.max(...layerValues) : 0;

      // Spread nodes within the same layer horizontally by tracking how
      // many nodes have already been placed at that layer.
      const xSpacing = 220;
      const ySpacing = 160;
      const xIndexByLayer: Record<number, number> = {};

      const loadedNodes: Node[] = graph.objectives.map((objective) => {
        const layer = layerByObjectiveId[objective.id] ?? 0;
        const xIndex = xIndexByLayer[layer] ?? 0;
        xIndexByLayer[layer] = xIndex + 1;
        return {
          id: String(objective.id),
          type: "objective",
          // Deliberately inverted from a typical top-down tree: layer 0
          // (the source, no parents) sits at the BOTTOM of the canvas
          // (largest y), and the highest layer (terminal/leaf nodes) sits
          // at the TOP (smallest y) — matches this project's chosen canvas
          // convention (see feature plan).
          position: { x: xIndex * xSpacing, y: (maxLayer - layer) * ySpacing },
          data: { ...objective, dbId: objective.id },
        };
      });

      // Edge direction matches handleConnect's convention elsewhere in this
      // file: the CHILD objective's node is the edge's source (where a drag
      // would start), the PARENT objective's node is the edge's target
      // (where it would be dropped). Child is the upstream/first objective,
      // parent is the downstream/later one, so this also draws the arrow
      // flowing from the lower layer up to the higher one.
      const loadedEdges: Edge<EdgeData>[] = graph.edges.map((edge) => ({
        id: `e${edge.id}`,
        source: String(edge.childId),
        target: String(edge.parentId),
        data: {
          dbId: edge.id,
          parentId: edge.parentId,
          childId: edge.childId,
        },
      }));

      // Keep newly-created local node ids from ever colliding with
      // hydrated (database) objective ids.
      const maxObjectiveId = graph.objectives.reduce(
        (max, objective) => Math.max(max, objective.id),
        0,
      );
      nextId = Math.max(nextId, maxObjectiveId + 1);

      setNodes(loadedNodes);
      setEdges(loadedEdges);
      setLoadState("loaded");
    }

    loadGraph().catch((err: unknown) => {
      if (cancelled) return;
      setLoadState("error");
      setLoadError(err instanceof Error ? err.message : "Failed to load map");
    });

    return () => {
      cancelled = true;
    };
  }, [mapId]);

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  // --- edge (connection) flow handlers ---

  const handleConnect = useCallback(
    async (connection: Connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.source);
      const targetNode = nodes.find((n) => n.id === connection.target);
      const childId = sourceNode?.data?.id as number | undefined;
      const parentId = targetNode?.data?.id as number | undefined;

      // Directionality: the node the drag STARTED from (source) becomes
      // the child; the node it was DROPPED on (target) becomes the parent.
      // Child is the upstream/first objective, parent is the downstream/
      // later one (matches the backend's cycle-detection direction and the
      // hydration layering above).
      if (parentId == null || childId == null) {
        setEdgeError("Both objectives must be saved before connecting them");
        return;
      }

      if (parentId === childId) {
        setEdgeError("An objective cannot be its own parent");
        return;
      }

      // Client-side cycle check: only the current session's edges are known
      // here (no server round-trip), so we walk forward from the proposed
      // parent following childId -> parentId edges (mirrors the backend's
      // BFS direction in ObjectiveEdgeService). If the proposed child shows
      // up during that walk, it's already a descendant of the proposed
      // parent, so adding child -> parent would close a cycle.
      const descendants = new Set<number>();
      const stack = [parentId];
      while (stack.length > 0) {
        const current = stack.pop() as number;
        for (const edge of edges) {
          if (edge.data?.childId === current) {
            const next = edge.data.parentId;
            if (next === childId) {
              setEdgeError("Adding this connection would create a cycle");
              return;
            }
            if (!descendants.has(next)) {
              descendants.add(next);
              stack.push(next);
            }
          }
        }
      }

      try {
        const created = await createObjectiveEdge({ parentId, childId });
        const newEdge: Edge<EdgeData> = {
          id: String(nextEdgeId++),
          source: connection.source,
          target: connection.target,
          data: { dbId: created.id, parentId, childId },
        };
        setEdges((prev) => [...prev, newEdge]);
        setEdgeError(null);
      } catch (err) {
        setEdgeError(
          err instanceof Error ? err.message : "Failed to create connection",
        );
      }
    },
    [nodes, edges],
  );

  const handleEdgesChange = useCallback(
    async (changes: EdgeChange<Edge<EdgeData>>[]) => {
      const removals = changes.filter((change) => change.type === "remove");
      const rest = changes.filter((change) => change.type !== "remove");

      if (rest.length > 0) {
        setEdges((prev) => applyEdgeChanges(rest, prev));
      }

      for (const change of removals) {
        const edge = edges.find((e) => e.id === change.id);
        const dbId = edge?.data?.dbId;
        if (dbId == null) continue;

        try {
          await deleteObjectiveEdge(dbId);
          setEdges((prev) => prev.filter((e) => e.id !== change.id));
        } catch (err) {
          setEdgeError(
            err instanceof Error ? err.message : "Failed to delete connection",
          );
          // Leave the edge in place on failure — do not remove it.
        }
      }
    },
    [edges],
  );

  const handlePaneClick = useCallback(
    (event: ReactFlowMouseEvent) => {
      if (isFormOpen || isEditOpen) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const id = String(nextId++);
      const newNode: Node = {
        id,
        type: "objective",
        position,
        data: {},
      };

      setNodes((prev) => [...prev, newNode]);
      setPendingNodeId(id);
      setIsFormOpen(true);
      setSaveError(null);
    },
    [isFormOpen, isEditOpen, screenToFlowPosition],
  );

  const handleFormClose = useCallback(() => {
    // User cancelled — remove the placeholder node since it was never saved.
    if (pendingNodeId) {
      setNodes((prev) => prev.filter((n) => n.id !== pendingNodeId));
    }
    setPendingNodeId(null);
    setIsFormOpen(false);
    setSaveError(null);
  }, [pendingNodeId]);

  const handleFormSubmit = useCallback(
    async (formData: ObjectiveFormData) => {
      if (!pendingNodeId) return;

      setIsSaving(true);
      setSaveError(null);

      try {
        const created = await createObjective({
          description: formData.description,
          isTask: formData.isTask,
          mapId: Number(mapId),
          // Already converted to full ISO strings by ObjectiveSidebar itself
          // (from its datetime-local inputs) — no conversion needed here.
          deadlineStart: formData.deadlineStart,
          deadlineEnd: formData.deadlineEnd,
        });

        // Swap the local placeholder node's data for the real, saved
        // record, and tag it with the database id for future PATCH/DELETE calls.
        setNodes((prev) =>
          prev.map((n) =>
            n.id === pendingNodeId
              ? { ...n, data: { ...created, dbId: created.id } }
              : n,
          ),
        );

        setPendingNodeId(null);
        setIsFormOpen(false);
      } catch (err) {
        setSaveError(
          err instanceof Error ? err.message : "Failed to save goal node",
        );
        // Keep the sidebar open on failure so the user can fix input and retry.
      } finally {
        setIsSaving(false);
      }
    },
    [pendingNodeId],
  );

  // Live-previews the pending (unsaved) placeholder node's color while the
  // user is still on the create sidebar's type step, well before Submit —
  // Objective.tsx derives its color variant directly from data.isTask.
  const handleFormTypeChange = useCallback(
    (isTask: boolean) => {
      if (!pendingNodeId) return;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === pendingNodeId ? { ...n, data: { ...n.data, isTask } } : n,
        ),
      );
    },
    [pendingNodeId],
  );

  // Mirrors handleFormTypeChange for the edit sidebar. Unlike create, an
  // edit-sidebar type change previews on an ALREADY-SAVED node, so it must be
  // explicitly reverted on cancel (see handleEditClose below) rather than
  // just discarding an unsaved placeholder.
  const handleEditTypeChange = useCallback(
    (isTask: boolean) => {
      if (!editingNode) return;
      setNodes((prev) =>
        prev.map((n) =>
          n.id === editingNode.id ? { ...n, data: { ...n.data, isTask } } : n,
        ),
      );
    },
    [editingNode],
  );

  // --- edit flow handlers ---

  const handleNodeClick = useCallback(
    (_event: ReactFlowMouseEvent, node: Node) => {
      // Ignore clicks while the create form is open, and ignore clicks on
      // a node that hasn't actually been saved yet (no database id means
      // it's still the pending placeholder from an in-progress create).
      if (isFormOpen || isEditOpen) return;
      if (!node.data?.id) return;

      setEditingNode(node);
      setIsEditOpen(true);
      setEditError(null);
    },
    [isFormOpen, isEditOpen],
  );

  const handleEditClose = useCallback(() => {
    // Revert any live-previewed (unsaved) type change back to the snapshot
    // captured when the edit sidebar opened. editingNode itself is never
    // mutated after setEditingNode(node) below (only the `nodes` array is,
    // via handleEditTypeChange), so editingNode.data still holds the
    // original, pre-preview values here.
    if (editingNode) {
      setNodes((prev) =>
        prev.map((n) =>
          n.id === editingNode.id ? { ...n, data: editingNode.data } : n,
        ),
      );
    }
    setEditingNode(null);
    setIsEditOpen(false);
    setEditError(null);
  }, [editingNode]);

  const handleEditSubmit = useCallback(
    async (formData: UpdateObjectiveFormData) => {
      if (!editingNode) return;

      setIsEditSaving(true);
      setEditError(null);

      try {
        // targetQuantity is intentionally not sent yet — updateObjective
        // only supports description and isTask for now.
        const updated = await updateObjective(editingNode.data.id as number, {
          description: formData.description,
          isTask: formData.isTask,
          // Already converted to full ISO strings by ObjectiveEditSidebar
          // itself (from its datetime-local inputs) — no conversion needed
          // here.
          deadlineStart: formData.deadlineStart,
          deadlineEnd: formData.deadlineEnd,
        });

        setNodes((prev) =>
          prev.map((n) =>
            n.id === editingNode.id
              ? { ...n, data: { ...updated, dbId: updated.id } }
              : n,
          ),
        );

        setEditingNode(null);
        setIsEditOpen(false);
      } catch (err) {
        setEditError(
          err instanceof Error ? err.message : "Failed to update objective",
        );
        // Keep the sidebar open on failure so the user can fix input and retry.
      } finally {
        setIsEditSaving(false);
      }
    },
    [editingNode],
  );

  const editingObjective: ObjectiveData | null = editingNode
    ? {
        id: editingNode.data.id as number,
        description: editingNode.data.description as string,
        isTask: editingNode.data.isTask as boolean,
        counter: (editingNode.data.counter as ObjectiveData["counter"]) ?? null,
        // editingNode.data is always either the hydrated ObjectiveResponse
        // spread (on load) or the { ...created/updated, dbId } spread (after
        // a create/edit save), both of which carry these now-required
        // fields as full ISO strings — ObjectiveEditSidebar converts them to
        // datetime-local for display itself.
        deadlineStart: editingNode.data.deadlineStart as string,
        deadlineEnd: editingNode.data.deadlineEnd as string,
      }
    : null;

  // Exiting back to the map menu is only "risky" (and thus confirmed) when a
  // sidebar is open with in-progress, unsaved form state — otherwise there's
  // nothing to lose, so leave immediately.
  const handleExitClick = useCallback(() => {
    const hasUnsavedDraft = isFormOpen || isEditOpen;
    if (hasUnsavedDraft) {
      const confirmed = window.confirm(
        "You have an objective open for editing that hasn't been saved. Exit without saving it?",
      );
      if (!confirmed) return;
    }
    navigate("/");
  }, [isFormOpen, isEditOpen, navigate]);

  return (
    <>
      {loadState === "loading" && <p>Loading map…</p>}

      {/* The canvas only mounts once hydration has actually produced
          nodes/edges to show — rendering <ReactFlow> during "loading" (or
          leaving it up during "error") would show a misleadingly-empty
          canvas under the loading text / error banner. */}
      {loadState === "loaded" && (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={handleNodesChange}
          onConnect={handleConnect}
          onEdgesChange={handleEdgesChange}
          onPaneClick={handlePaneClick}
          onNodeClick={handleNodeClick}
          nodesConnectable={!isFormOpen && !isEditOpen}
          defaultEdgeOptions={{
            style: { stroke: "#6366f1", strokeWidth: 2 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: "#6366f1",
              width: 22,
              height: 22,
            },
          }}
          fitView
        >
          <Background />
          <Controls />
        </ReactFlow>
      )}

      {/* loadError takes priority since a failed hydration means there's no
          usable canvas underneath to report a transient edgeError about. */}
      <CanvasErrorBanner message={loadError ?? edgeError} />

      {/* Always rendered (even during loading/error) since there must always
          be a way back to the map menu. */}
      <CanvasExitButton
        onExit={handleExitClick}
        disabled={isSaving || isEditSaving}
      />

      <ObjectiveFormSidebar
        key={pendingNodeId ?? "closed"}
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        onTypeChange={handleFormTypeChange}
        isSaving={isSaving}
        errorMessage={saveError}
      />

      <ObjectiveEditSidebar
        key={editingObjective?.id ?? "closed"}
        isOpen={isEditOpen}
        objective={editingObjective}
        onClose={handleEditClose}
        onSubmit={handleEditSubmit}
        onTypeChange={handleEditTypeChange}
        isSaving={isEditSaving}
        errorMessage={editError}
      />
    </>
  );
}

export default function Map() {
  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <ReactFlowProvider>
        <MapInner />
      </ReactFlowProvider>
    </div>
  );
}
