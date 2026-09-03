import { useState } from 'react';
import ObjectiveSidebarShell from './ObjectiveSidebarShell';

export interface ObjectiveCounterData {
  label: string;
  targetQuantity: number | null;
}

export interface ObjectiveData {
  id: number;
  description: string;
  isTask: boolean;
  counter: ObjectiveCounterData | null;
}

export interface UpdateObjectiveFormData {
  description: string;
  isTask: boolean;
}

interface ObjectiveEditSidebarProps {
  isOpen: boolean;
  objective: ObjectiveData | null;
  onClose: () => void;
  onSubmit: (data: UpdateObjectiveFormData) => void;
  isSaving?: boolean;
  errorMessage?: string | null;
}

export default function ObjectiveEditSidebar({
  isOpen,
  objective,
  onClose,
  onSubmit,
  isSaving = false,
  errorMessage = null,
}: ObjectiveEditSidebarProps) {
  // Initialized once from the objective passed in. The parent is expected
  // to remount this component (e.g. via a `key={objective.id}`) whenever a
  // different node is selected, so these defaults stay in sync with
  // whichever objective is currently being edited.
  const [description, setDescription] = useState(objective?.description ?? '');
  const [isTask, setIsTask] = useState(objective?.isTask ?? false);

  if (!objective) return null;

  function handleSubmit() {
    onSubmit({ description, isTask });
  }

  const title = `Edit ${isTask ? 'task' : 'objective'}`;

  return (
    <ObjectiveSidebarShell
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      isSaving={isSaving}
      errorMessage={errorMessage}
      secondaryLabel="Cancel"
      primaryLabel="Save"
      primaryDisabled={description.trim().length === 0}
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
          onClick={() => setIsTask(false)}
          style={{ borderColor: !isTask ? '#6366f1' : undefined }}
        >
          <span className="obj-form-type-btn-title">Objective</span>
        </button>
        <button
          className="obj-form-type-btn"
          onClick={() => setIsTask(true)}
          style={{ borderColor: isTask ? '#6366f1' : undefined }}
        >
          <span className="obj-form-type-btn-title">Task</span>
        </button>
      </div>
    </ObjectiveSidebarShell>
  );
}