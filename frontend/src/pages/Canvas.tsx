import { useCallback, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  useReactFlow,
  applyNodeChanges,
  type Node,
  type NodeChange,
  type MouseEvent as ReactFlowMouseEvent,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import GoalNode from '../components/Objective';
import ObjectiveFormSidebar, { type ObjectiveFormData } from '../components/ObjectiveSidebar';
import ObjectiveEditSidebar, {
  type ObjectiveData,
  type UpdateObjectiveFormData,
} from '../components/ObjectiveEditSidebar';
import { createGoalNode, updateObjective } from '../api/ObjectiveAPI';

const nodeTypes = { goalNode: GoalNode };

let nextId = 1;

function Canvas() {
  const [nodes, setNodes] = useState<Node[]>([]);

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

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

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
        type: 'goalNode',
        position,
        data: {},
      };

      setNodes((prev) => [...prev, newNode]);
      setPendingNodeId(id);
      setIsFormOpen(true);
      setSaveError(null);
    },
    [isFormOpen, isEditOpen, screenToFlowPosition]
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
        const created = await createGoalNode({
          description: formData.description,
          isTask: formData.isTask,
        });

        // Swap the local placeholder node's data for the real, saved
        // record, and tag it with the database id for future PATCH/DELETE calls.
        setNodes((prev) =>
          prev.map((n) =>
            n.id === pendingNodeId ? { ...n, data: { ...created, dbId: created.id } } : n
          )
        );

        setPendingNodeId(null);
        setIsFormOpen(false);
      } catch (err) {
        setSaveError(err instanceof Error ? err.message : 'Failed to save goal node');
        // Keep the sidebar open on failure so the user can fix input and retry.
      } finally {
        setIsSaving(false);
      }
    },
    [pendingNodeId]
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
    [isFormOpen, isEditOpen]
  );

  const handleEditClose = useCallback(() => {
    setEditingNode(null);
    setIsEditOpen(false);
    setEditError(null);
  }, []);

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
        });

        setNodes((prev) =>
          prev.map((n) =>
            n.id === editingNode.id ? { ...n, data: { ...updated, dbId: updated.id } } : n
          )
        );

        setEditingNode(null);
        setIsEditOpen(false);
      } catch (err) {
        setEditError(err instanceof Error ? err.message : 'Failed to update objective');
        // Keep the sidebar open on failure so the user can fix input and retry.
      } finally {
        setIsEditSaving(false);
      }
    },
    [editingNode]
  );

  const editingObjective: ObjectiveData | null = editingNode
    ? {
        id: editingNode.data.id as number,
        description: editingNode.data.description as string,
        isTask: editingNode.data.isTask as boolean,
        counter: (editingNode.data.counter as ObjectiveData['counter']) ?? null,
      }
    : null;

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onPaneClick={handlePaneClick}
        onNodeClick={handleNodeClick}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>

      <ObjectiveFormSidebar
        key={pendingNodeId ?? 'closed'}
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        isSaving={isSaving}
        errorMessage={saveError}
      />

      <ObjectiveEditSidebar
        key={editingObjective?.id ?? 'closed'}
        isOpen={isEditOpen}
        objective={editingObjective}
        onClose={handleEditClose}
        onSubmit={handleEditSubmit}
        isSaving={isEditSaving}
        errorMessage={editError}
      />
    </>
  );
}

export default function GoalGraphPage() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <ReactFlowProvider>
        <Canvas />
      </ReactFlowProvider>
    </div>
  );
}