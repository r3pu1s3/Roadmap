import { Handle, Position } from "@xyflow/react";

// Minimally-typed props rather than React Flow's full `NodeProps<Node>`: this
// component only ever reads `data.id` / `data.isTask`, and React Flow invokes
// custom node components via prop spreading (not an object literal), so the
// extra fields it actually passes (id, selected, dragging, etc.) don't trip
// up excess property checks. Keeping the type narrow also matches how the
// test file renders this component standalone with only a `data` prop.
type ObjectiveProps = {
  data?: {
    id?: number;
    isTask?: boolean | null;
  };
};

type ObjectiveVariant = "task" | "objective" | "empty";

// `isTask` is `true`/`false` once a node has been saved as a task or a plain
// objective respectively. It's `undefined`/`null` for a freshly-placed
// placeholder node where the user hasn't picked a type yet (or for
// API/local-state shapes that explicitly carry `isTask: null`) — both map to
// the neutral "empty" variant.
function getVariant(isTask: boolean | null | undefined): ObjectiveVariant {
  if (isTask === true) return "task";
  if (isTask === false) return "objective";
  return "empty";
}

// Colors are sourced from CSS custom properties defined in index.css (both
// light and dark `prefers-color-scheme` blocks) rather than hardcoded here,
// so the three variants stay in sync with the app's theme. They're applied
// via inline style (not a class from Objective.css, which isn't imported
// anywhere) to keep this testable under jsdom, which doesn't apply real
// stylesheet rules in this project's vitest config.
const VARIANT_COLORS: Record<
  ObjectiveVariant,
  { backgroundColor: string; borderColor: string }
> = {
  task: {
    backgroundColor: "var(--node-task-bg)",
    borderColor: "var(--node-task-border)",
  },
  objective: {
    backgroundColor: "var(--node-objective-bg)",
    borderColor: "var(--node-objective-border)",
  },
  empty: {
    backgroundColor: "var(--node-empty-bg)",
    borderColor: "var(--node-empty-border)",
  },
};

export default function Objective({ data }: ObjectiveProps) {
  // A node is "saved" once its data carries a database id (see Map.tsx:
  // `{ ...created, dbId: created.id }` is set on save). Handles on unsaved
  // (still-local/ephemeral) nodes are made non-connectable so users can't
  // draw edges to/from a node that doesn't exist in the backend yet.
  const isSaved = data?.id != null;

  const variant = getVariant(data?.isTask);
  const { backgroundColor, borderColor } = VARIANT_COLORS[variant];

  return (
    <div
      data-variant={variant}
      style={{
        width: 48,
        height: 48,
        borderRadius: "50%",
        backgroundColor,
        border: `2px solid ${borderColor}`,
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
