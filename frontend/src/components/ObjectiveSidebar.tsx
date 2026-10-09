import { useState } from "react";
import ObjectiveSidebarShell from "./ObjectiveSidebarShell";

export interface ObjectiveFormData {
  isTask: boolean;
  description: string;
  // Full ISO 8601 strings (converted from the raw <input type="datetime-local">
  // values at submit time) — the server expects/persists ISO timestamps, and
  // converting here keeps the raw local-time strings purely a UI concern.
  // null means "no deadline"; both are null or both are set.
  deadlineStart: string | null;
  deadlineEnd: string | null;
}

type Step = "type" | "description" | "deadline";

interface ObjectiveSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: ObjectiveFormData) => void;
  isSaving?: boolean;
  errorMessage?: string | null;
  // Optional: fired whenever the user picks a type on the type-selection
  // step, so a parent (e.g. the canvas page) can surface a live "type
  // changed" notification. Omitted by most callers, so selectType must
  // tolerate it being undefined.
  onTypeChange?: (isTask: boolean) => void;
}

export default function ObjectiveSidebar({
  isOpen,
  onClose,
  onSubmit,
  isSaving = false,
  errorMessage = null,
  onTypeChange,
}: ObjectiveSidebarProps) {
  const [step, setStep] = useState<Step>("type");
  const [isTask, setIsTask] = useState<boolean | null>(null);
  const [description, setDescription] = useState("");
  // Raw <input type="datetime-local"> strings (e.g. "2026-08-21T14:30"), kept
  // as-is in state so the inputs stay controlled; converted to ISO 8601 only
  // at submit time (see handleSubmit).
  const [deadlineStart, setDeadlineStart] = useState("");
  const [deadlineEnd, setDeadlineEnd] = useState("");

  function selectType(value: boolean) {
    setIsTask(value);
    setStep("description");
    onTypeChange?.(value);
  }

  function handleBack() {
    setStep(step === "deadline" ? "description" : "type");
  }

  function handleNext() {
    setStep("deadline");
  }

  function handleSubmit() {
    if (isTask === null) return; // guard — shouldn't happen since step order enforces this
    onSubmit({
      isTask,
      description,
      // Explicit null (never undefined) so the server clears/ignores deadlines.
      deadlineStart: hasStart ? new Date(deadlineStart).toISOString() : null,
      deadlineEnd: hasEnd ? new Date(deadlineEnd).toISOString() : null,
    });
  }

  // Deadlines are optional but all-or-nothing: both empty is valid, both
  // filled is valid if start <= end, exactly one filled is invalid. The loose
  // start <= end check is deliberate — the server enforces the real "at least
  // 60s apart" rule and reports it via errorMessage. Equal values stay enabled.
  const hasStart = deadlineStart.length > 0;
  const hasEnd = deadlineEnd.length > 0;
  const exactlyOneFilled = hasStart !== hasEnd;
  const deadlinesValid =
    (!hasStart && !hasEnd) ||
    (hasStart && hasEnd && new Date(deadlineStart) <= new Date(deadlineEnd));

  const title = `New ${step === "type" ? "node" : isTask ? "task" : "objective"}`;

  return (
    <ObjectiveSidebarShell
      isOpen={isOpen}
      title={title}
      onClose={onClose}
      isSaving={isSaving}
      errorMessage={errorMessage}
      secondaryLabel={step === "type" ? "Cancel" : "Back"}
      onSecondaryClick={step === "type" ? onClose : handleBack}
      showPrimary={step !== "type"}
      primaryLabel={step === "description" ? "Next" : "Submit"}
      primaryDisabled={
        step === "description"
          ? description.trim().length === 0
          : !deadlinesValid
      }
      onPrimaryClick={step === "description" ? handleNext : handleSubmit}
    >
      {step === "type" && (
        <>
          <label className="obj-form-label">What kind of node is this?</label>
          <div className="obj-form-type-options">
            <button
              className="obj-form-type-btn"
              onClick={() => selectType(false)}
              autoFocus
            >
              <span className="obj-form-type-btn-title">Objective</span>
              <span className="obj-form-type-btn-desc">
                A higher-level goal, no counter attached
              </span>
            </button>
            <button
              className="obj-form-type-btn"
              onClick={() => selectType(true)}
            >
              <span className="obj-form-type-btn-title">Task</span>
              <span className="obj-form-type-btn-desc">
                A concrete, countable action (e.g. "{"{pushups}"} pushups")
              </span>
            </button>
          </div>
        </>
      )}

      {step === "description" && (
        <>
          <label className="obj-form-label">Description</label>
          <textarea
            className="obj-form-textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={
              isTask
                ? "e.g. Do {pushups} pushups every morning"
                : "e.g. Get stronger this year"
            }
            rows={6}
            autoFocus
          />
        </>
      )}

      {step === "deadline" && (
        <>
          <label className="obj-form-label">Deadline</label>
          <label
            className="obj-form-label"
            htmlFor="obj-form-deadline-start"
            style={{ marginTop: 6 }}
          >
            Deadline start
          </label>
          <input
            id="obj-form-deadline-start"
            className="obj-form-input"
            type="datetime-local"
            value={deadlineStart}
            onChange={(e) => setDeadlineStart(e.target.value)}
            autoFocus
          />

          <label
            className="obj-form-label"
            htmlFor="obj-form-deadline-end"
            style={{ marginTop: 16 }}
          >
            Deadline end
          </label>
          <input
            id="obj-form-deadline-end"
            className="obj-form-input"
            type="datetime-local"
            value={deadlineEnd}
            onChange={(e) => setDeadlineEnd(e.target.value)}
          />
          {exactlyOneFilled && (
            <p className="obj-form-error">
              Set both deadline fields, or leave both empty.
            </p>
          )}
        </>
      )}
    </ObjectiveSidebarShell>
  );
}
