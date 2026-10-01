import { useState } from "react";
import ObjectiveSidebarShell from "./ObjectiveSidebarShell";

export interface ObjectiveCounterData {
  label: string;
  targetQuantity: number | null;
}

export interface ObjectiveData {
  id: number;
  description: string;
  isTask: boolean;
  counter: ObjectiveCounterData | null;
  // ISO 8601 strings. Mandatory: every objective always has a deadline
  // range once it exists server-side (see ObjectiveDeadlineService).
  deadlineStart: string;
  deadlineEnd: string;
}

export interface UpdateObjectiveFormData {
  description: string;
  isTask: boolean;
  // ISO 8601 strings, always sent in full on submit (no partial update
  // semantics for deadlines).
  deadlineStart: string;
  deadlineEnd: string;
}

// Converts an ISO 8601 string into the value format the native
// `<input type="datetime-local">` expects, using the browser's LOCAL
// date/time components (not UTC) so the field reflects what the user
// would expect to see in their own timezone.
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

interface ObjectiveEditSidebarProps {
  isOpen: boolean;
  objective: ObjectiveData | null;
  onClose: () => void;
  onSubmit: (data: UpdateObjectiveFormData) => void;
  isSaving?: boolean;
  errorMessage?: string | null;
  // Optional live notification fired whenever the user toggles the type
  // buttons below, independent of submit. Lets the canvas (Map.tsx) preview
  // the node's new color before the edit is actually saved.
  onTypeChange?: (isTask: boolean) => void;
}

export default function ObjectiveEditSidebar({
  isOpen,
  objective,
  onClose,
  onSubmit,
  isSaving = false,
  errorMessage = null,
  onTypeChange,
}: ObjectiveEditSidebarProps) {
  // Initialized once from the objective passed in. The parent is expected
  // to remount this component (e.g. via a `key={objective.id}`) whenever a
  // different node is selected, so these defaults stay in sync with
  // whichever objective is currently being edited.
  const [description, setDescription] = useState(objective?.description ?? "");
  const [isTask, setIsTask] = useState(objective?.isTask ?? false);
  const [deadlineStart, setDeadlineStart] = useState(
    objective ? toDatetimeLocalValue(objective.deadlineStart) : "",
  );
  const [deadlineEnd, setDeadlineEnd] = useState(
    objective ? toDatetimeLocalValue(objective.deadlineEnd) : "",
  );

  if (!objective) return null;

  // Save is blocked if the description is empty, either deadline field is
  // empty (e.g. the user cleared it), or start is strictly after end. Equal
  // start/end is allowed client-side — the server enforces the real minimum
  // gap (see ObjectiveDeadlineService), so this is just a cheap sanity guard.
  const deadlinesInvalid =
    deadlineStart.trim().length === 0 ||
    deadlineEnd.trim().length === 0 ||
    new Date(deadlineStart) > new Date(deadlineEnd);

  function handleSubmit() {
    onSubmit({
      description,
      isTask,
      deadlineStart: new Date(deadlineStart).toISOString(),
      deadlineEnd: new Date(deadlineEnd).toISOString(),
    });
  }

  const title = `Edit ${isTask ? "task" : "objective"}`;

  return (
    <ObjectiveSidebarShell
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      isSaving={isSaving}
      errorMessage={errorMessage}
      secondaryLabel="Cancel"
      primaryLabel="Save"
      primaryDisabled={description.trim().length === 0 || deadlinesInvalid}
      onPrimaryClick={handleSubmit}
    >
      <label className="obj-form-label">Description</label>
      <textarea
        className="obj-form-textarea"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={6}
        autoFocus
      />

      <label className="obj-form-label" style={{ marginTop: 16 }}>
        Type
      </label>
      <div className="obj-form-type-options">
        <button
          className="obj-form-type-btn"
          onClick={() => {
            setIsTask(false);
            onTypeChange?.(false);
          }}
          style={{ borderColor: !isTask ? "#6366f1" : undefined }}
        >
          <span className="obj-form-type-btn-title">Objective</span>
        </button>
        <button
          className="obj-form-type-btn"
          onClick={() => {
            setIsTask(true);
            onTypeChange?.(true);
          }}
          style={{ borderColor: isTask ? "#6366f1" : undefined }}
        >
          <span className="obj-form-type-btn-title">Task</span>
        </button>
      </div>

      <label
        className="obj-form-label"
        htmlFor="obj-edit-deadline-start"
        style={{ marginTop: 16 }}
      >
        Deadline start
      </label>
      <input
        id="obj-edit-deadline-start"
        className="obj-form-input"
        type="datetime-local"
        required
        value={deadlineStart}
        onChange={(e) => setDeadlineStart(e.target.value)}
      />

      <label
        className="obj-form-label"
        htmlFor="obj-edit-deadline-end"
        style={{ marginTop: 16 }}
      >
        Deadline end
      </label>
      <input
        id="obj-edit-deadline-end"
        className="obj-form-input"
        type="datetime-local"
        required
        value={deadlineEnd}
        onChange={(e) => setDeadlineEnd(e.target.value)}
      />
    </ObjectiveSidebarShell>
  );
}
