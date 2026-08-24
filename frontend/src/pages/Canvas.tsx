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
import GoalNode from '../components/GoalNode';
import GoalNodeFormSidebar, { type GoalNodeFormData } from '../components/GoalNodeSideBar';
import { createGoalNode } from '../api/GoalNodeAPI';

const nodeTypes = { goalNode: GoalNode };

let nextId = 1;

function Canvas() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [pendingNodeId, setPendingNodeId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const { screenToFlowPosition } = useReactFlow();

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const handlePaneClick = useCallback(
    (event: ReactFlowMouseEvent) => {
      if (isFormOpen) return;

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
    [isFormOpen, screenToFlowPosition]
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
    async (formData: GoalNodeFormData) => {
      if (!pendingNodeId) return;

      setIsSaving(true);
      setSaveError(null);

      // Only send counters the user actually filled in a label for —
      // the 3 boxes are optional and mostly start empty.
      const counters = formData.counters
        .filter((c) => c.label.trim().length > 0)
        .map((c) => ({ label: c.label.trim(), targetQuantity: c.targetQuantity }));

      try {
        const created = await createGoalNode({
          description: formData.description,
          rewardRule: formData.rewardRule,
          deadlineRule: formData.deadlineRule,
          // The date input gives "yyyy-mm-dd" — convert to a full ISO
          // timestamp the backend's Date parsing expects.
          deadline: new Date(formData.deadline).toISOString(),
          counters: counters.length > 0 ? counters : undefined,
        });

        // Swap the local placeholder node's data for the real, saved
        // record, and tag it with the database id for future PATCH/DELETE calls.
        setNodes((prev) =>
          prev.map((n) =>
            n.id === pendingNodeId
              ? { ...n, data: { ...created, dbId: created.id } }
              : n
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

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={handleNodesChange}
        onPaneClick={handlePaneClick}
        fitView
      >
        <Background />
        <Controls />
      </ReactFlow>

      <GoalNodeFormSidebar
        key={pendingNodeId ?? 'closed'}
        isOpen={isFormOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        isSaving={isSaving}
        errorMessage={saveError}
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