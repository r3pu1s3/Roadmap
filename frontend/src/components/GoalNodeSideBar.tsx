import { useState } from 'react';
import './GoalNodeSidebar.css';

export interface CounterInput {
  label: string;
  targetQuantity: number;
}

export interface GoalNodeFormData {
  description: string;
  rewardRule: [number, number];
  deadlineRule: [number, number];
  deadline: string; // yyyy-mm-dd from the date input
  counters: [CounterInput, CounterInput, CounterInput];
}

const STEPS = ['description', 'rewardRule', 'deadlineRule', 'deadline', 'counters'] as const;
type Step = (typeof STEPS)[number];

const STEP_LABELS: Record<Step, string> = {
  description: 'Description',
  rewardRule: 'Reward rule',
  deadlineRule: 'Deadline rule',
  deadline: 'Deadline',
  counters: 'Counters (optional)',
};

const EMPTY_FORM: GoalNodeFormData = {
  description: '',
  rewardRule: [0, 0],
  deadlineRule: [0, 0],
  deadline: '',
  counters: [
    { label: '', targetQuantity: 0 },
    { label: '', targetQuantity: 0 },
    { label: '', targetQuantity: 0 },
  ],
};

interface GoalNodeFormSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: GoalNodeFormData) => void;
  isSaving?: boolean;
  errorMessage?: string | null;
}

export default function GoalNodeFormSidebar({
  isOpen,
  onClose,
  onSubmit,
  isSaving = false,
  errorMessage = null,
}: GoalNodeFormSidebarProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<GoalNodeFormData>(EMPTY_FORM);

  if (!isOpen) return null;

  const step = STEPS[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === STEPS.length - 1;

  function goNext() {
    if (isLastStep) {
      onSubmit(form);
      // Deliberately not resetting/closing here — submission is async and
      // may fail. The parent closes the sidebar (and this component
      // remounts fresh via its `key` prop) only once the save succeeds.
    } else {
      setStepIndex((i) => i + 1);
    }
  }

  function goBack() {
    if (isFirstStep) {
      resetAndClose();
    } else {
      setStepIndex((i) => i - 1);
    }
  }

  function resetAndClose() {
    setForm(EMPTY_FORM);
    setStepIndex(0);
    onClose();
  }

  function updateRewardRule(index: 0 | 1, value: number) {
    setForm((prev) => {
      const next = [...prev.rewardRule] as [number, number];
      next[index] = value;
      return { ...prev, rewardRule: next };
    });
  }

  function updateDeadlineRule(index: 0 | 1, value: number) {
    setForm((prev) => {
      const next = [...prev.deadlineRule] as [number, number];
      next[index] = value;
      return { ...prev, deadlineRule: next };
    });
  }

  function updateCounterLabel(index: 0 | 1 | 2, label: string) {
    setForm((prev) => {
      const next = [...prev.counters] as [CounterInput, CounterInput, CounterInput];
      next[index] = { ...next[index], label };
      return { ...prev, counters: next };
    });
  }

  function updateCounterTarget(index: 0 | 1 | 2, targetQuantity: number) {
    setForm((prev) => {
      const next = [...prev.counters] as [CounterInput, CounterInput, CounterInput];
      next[index] = { ...next[index], targetQuantity };
      return { ...prev, counters: next };
    });
  }

  return (
    <div className="goal-form-sidebar">
      <div className="goal-form-header">
        <span className="goal-form-title">New goal</span>
        <button className="goal-form-close" onClick={resetAndClose} aria-label="Close">
          ×
        </button>
      </div>

      <div className="goal-form-progress">
        {STEPS.map((s, i) => (
          <div key={s} className={`goal-form-dot ${i === stepIndex ? 'active' : ''} ${i < stepIndex ? 'done' : ''}`} />
        ))}
      </div>

      <div className="goal-form-body">
        <label className="goal-form-label">{STEP_LABELS[step]}</label>

        {step === 'description' && (
          <textarea
            className="goal-form-textarea"
            value={form.description}
            onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
            placeholder="e.g. Do 3 sets of pushups every morning"
            rows={5}
            autoFocus
          />
        )}

        {step === 'rewardRule' && (
          <div className="goal-form-number-pair">
            <input
              type="number"
              className="goal-form-number"
              value={form.rewardRule[0]}
              onChange={(e) => updateRewardRule(0, Number(e.target.value))}
              placeholder="Modifier 1"
              autoFocus
            />
            <input
              type="number"
              className="goal-form-number"
              value={form.rewardRule[1]}
              onChange={(e) => updateRewardRule(1, Number(e.target.value))}
              placeholder="Modifier 2"
            />
          </div>
        )}

        {step === 'deadlineRule' && (
          <div className="goal-form-number-pair">
            <input
              type="number"
              className="goal-form-number"
              value={form.deadlineRule[0]}
              onChange={(e) => updateDeadlineRule(0, Number(e.target.value))}
              placeholder="Modifier 1"
              autoFocus
            />
            <input
              type="number"
              className="goal-form-number"
              value={form.deadlineRule[1]}
              onChange={(e) => updateDeadlineRule(1, Number(e.target.value))}
              placeholder="Modifier 2"
            />
          </div>
        )}

        {step === 'deadline' && (
          <input
            type="date"
            className="goal-form-date"
            value={form.deadline}
            onChange={(e) => setForm((prev) => ({ ...prev, deadline: e.target.value }))}
            autoFocus
          />
        )}

        {step === 'counters' && (
          <div className="goal-form-counters">
            {[0, 1, 2].map((i) => (
              <div key={i} className="goal-form-counter-row">
                <input
                  type="text"
                  className="goal-form-text goal-form-counter-label"
                  value={form.counters[i as 0 | 1 | 2].label}
                  onChange={(e) => updateCounterLabel(i as 0 | 1 | 2, e.target.value)}
                  placeholder={`Counter ${i + 1} label (optional)`}
                  autoFocus={i === 0}
                />
                <input
                  type="number"
                  min={0}
                  className="goal-form-number goal-form-counter-target"
                  value={form.counters[i as 0 | 1 | 2].targetQuantity}
                  onChange={(e) => updateCounterTarget(i as 0 | 1 | 2, Number(e.target.value))}
                  placeholder="Target"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="goal-form-footer">
        {errorMessage && <div className="goal-form-error">{errorMessage}</div>}
        <div className="goal-form-footer-buttons">
          <button
            className="goal-form-btn goal-form-btn-secondary"
            onClick={goBack}
            disabled={isSaving}
          >
            {isFirstStep ? 'Cancel' : 'Back'}
          </button>
          <button
            className="goal-form-btn goal-form-btn-primary"
            onClick={goNext}
            disabled={isSaving}
          >
            {isLastStep ? (isSaving ? 'Saving…' : 'Submit') : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}