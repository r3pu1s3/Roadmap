import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createHabit } from "../apis/HabitApi";
import HabitDurationInput from "../components/HabitDurationInput";
import {
  formatDuration,
  parseDuration,
  validateDescription,
  validateName,
} from "../utils/habitFields";
import "./HabitForm.css";

type Step = 1 | 2 | 3;

/**
 * The habit creation flow (/habits/new): Details → Length of time → Review.
 * Every value lives in this one component's state, so Back never loses input
 * and leaving the page (Cancel) simply discards it — no prompt, by design.
 */
export default function HabitCreate() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [stepError, setStepError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Returns the first problem with the given step's fields, or null.
  function validateStep(stepToCheck: Step): string | null {
    if (stepToCheck === 1) {
      return validateName(name) ?? validateDescription(description);
    }
    if (stepToCheck === 2) {
      const duration = parseDuration(hours, minutes);
      return "error" in duration ? duration.error : null;
    }
    return null;
  }

  function goNext() {
    const error = validateStep(step);
    if (error) {
      setStepError(error);
      return;
    }
    setStepError(null);
    setStep((current) => (current + 1) as Step);
  }

  function goBack() {
    setStepError(null);
    setSaveError(null);
    setStep((current) => (current - 1) as Step);
  }

  async function handleCreate() {
    if (isSaving) return;

    // Re-check everything before saving, not just the current step (FR-007).
    const error = validateStep(1) ?? validateStep(2);
    const duration = parseDuration(hours, minutes);
    if (error || "error" in duration) {
      setSaveError(error ?? "Invalid length of time");
      return;
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      await createHabit({
        name: name.trim(),
        description: description.trim() || null,
        durationMinutes: duration.minutes,
      });
      navigate("/habits");
    } catch (err) {
      setSaveError(
        err instanceof Error ? err.message : "Failed to create habit",
      );
      setIsSaving(false);
    }
  }

  const reviewDuration = parseDuration(hours, minutes);

  return (
    <div className="habit-form-page">
      <div className="habit-form-card">
        <h1 className="habit-form-title">New habit</h1>
        <p className="habit-form-subtitle">Step {step} of 3</p>

        {step === 1 && (
          <>
            <label className="habit-form-label" htmlFor="habit-name">
              Name
            </label>
            <input
              id="habit-name"
              type="text"
              className="habit-form-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Morning run"
              autoFocus
            />

            <label className="habit-form-label" htmlFor="habit-description">
              Description
            </label>
            <textarea
              id="habit-description"
              className="habit-form-input habit-form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional"
            />
          </>
        )}

        {step === 2 && (
          <>
            <span className="habit-form-label">Length of time</span>
            <HabitDurationInput
              hours={hours}
              minutes={minutes}
              onChange={(next) => {
                setHours(next.hours);
                setMinutes(next.minutes);
              }}
            />
          </>
        )}

        {step === 3 && (
          <dl className="habit-form-review">
            <dt className="habit-form-label">Name</dt>
            <dd className="habit-form-review-value">{name.trim()}</dd>
            <dt className="habit-form-label">Description</dt>
            <dd className="habit-form-review-value">
              {description.trim() || (
                <span className="habit-form-muted">No description</span>
              )}
            </dd>
            <dt className="habit-form-label">Length of time</dt>
            <dd className="habit-form-review-value">
              {"minutes" in reviewDuration &&
                formatDuration(reviewDuration.minutes)}
            </dd>
          </dl>
        )}

        {stepError && <div className="habit-form-error">{stepError}</div>}
        {saveError && <div className="habit-form-error">{saveError}</div>}

        <div className="habit-form-actions">
          <button
            type="button"
            className="habit-form-btn habit-form-btn-secondary"
            onClick={() => navigate("/habits")}
          >
            Cancel
          </button>
          {step > 1 && (
            <button
              type="button"
              className="habit-form-btn habit-form-btn-secondary"
              onClick={goBack}
              disabled={isSaving}
            >
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              type="button"
              className="habit-form-btn habit-form-btn-primary"
              onClick={goNext}
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              className="habit-form-btn habit-form-btn-primary"
              onClick={handleCreate}
              disabled={isSaving}
            >
              {isSaving ? "Creating…" : "Create habit"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
