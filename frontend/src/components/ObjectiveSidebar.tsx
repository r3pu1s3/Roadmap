import { useState } from 'react';
import ObjectiveSidebarShell from './ObjectiveSidebarShell';

export interface ObjectiveFormData {
  isTask: boolean;
  description: string;
}

type Step = 'type' | 'description';

interface ObjectiveSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ObjectiveFormData) => void;
  isSaving?: boolean;
  errorMessage?: string | null;
}

export default function ObjectiveSidebar({
  isOpen,
  onClose,
  onSubmit,
  isSaving = false,
  errorMessage = null,
}: ObjectiveSidebarProps) {
  const [step, setStep] = useState<Step>('type');
  const [isTask, setIsTask] = useState<boolean | null>(null);
  const [description, setDescription] = useState('');

  function selectType(value: boolean) {
    setIsTask(value);
    setStep('description');
  }

  function handleBack() {
    setStep('type');
  }

  function handleSubmit() {
    if (isTask === null) return; // guard — shouldn't happen since step order enforces this
    onSubmit({ isTask, description });
  }

  const title = `New ${step === 'type' ? 'node' : isTask ? 'task' : 'objective'}`;

  return (
    <ObjectiveSidebarShell
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      isSaving={isSaving}
      errorMessage={errorMessage}
      secondaryLabel={step === 'type' ? 'Cancel' : 'Back'}
      onSecondaryClick={step === 'type' ? onClose : handleBack}
      showPrimary={step === 'description'}
      primaryLabel="Submit"
      primaryDisabled={description.trim().length === 0}
      onPrimaryClick={handleSubmit}
    >
      {step === 'type' && (
        <>
          <label className="obj-form-label">What kind of node is this?</label>
          <div className="obj-form-type-options">
            <button className="obj-form-type-btn" onClick={() => selectType(false)} autoFocus>
              <span className="obj-form-type-btn-title">Objective</span>
              <span className="obj-form-type-btn-desc">A higher-level goal, no counter attached</span>
            </button>
            <button className="obj-form-type-btn" onClick={() => selectType(true)}>
              <span className="obj-form-type-btn-title">Task</span>
              <span className="obj-form-type-btn-desc">
                A concrete, countable action (e.g. "{'{pushups}'} pushups")
              </span>
            </button>
          </div>
        </>
      )}

      {step === 'description' && (
        <>
          <label className="obj-form-label">Description</label>
          <textarea
            className="obj-form-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              isTask ? 'e.g. Do {pushups} pushups every morning' : 'e.g. Get stronger this year'
            }
            rows={6}
            autoFocus
          />
        </>
      )}
    </ObjectiveSidebarShell>
  );
}