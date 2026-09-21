import { Handle, Position } from "@xyflow/react";

// Minimally-typed props rather than React Flow's full `NodeProps<Node>`: this
// component only ever reads `data.id`, and React Flow invokes custom node
// components via prop spreading (not an object literal), so the extra fields
// it actually passes (id, selected, dragging, etc.) don't trip up excess
// property checks. Keeping the type narrow also matches how the test file
// renders this component standalone with only a `data` prop.
type ObjectiveProps = {
  data?: {
    id?: number;
  };
};

export default function Objective({ data }: ObjectiveProps) {
  // A node is "saved" once its data carries a database id (see Map.tsx:
  // `{ ...created, dbId: created.id }` is set on save). Handles on unsaved
  // (still-local/ephemeral) nodes are made non-connectable so users can't
  // draw edges to/from a node that doesn't exist in the backend yet.
  const isSaved = data?.id != null;

  return (
    <div
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        backgroundColor: "#6366f1",
        border: "2px solid #4338ca",
      }}
    >
      <Handle type="source" position={Position.Top} isConnectable={isSaved} />
      <Handle
        type="target"
        position={Position.Bottom}
        isConnectable={isSaved}
      />
    </div>
  );
}
