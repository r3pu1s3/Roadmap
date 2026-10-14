import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteHabit, getHabit, updateHabit } from "../apis/HabitApi";
import HabitDurationInput from "../components/HabitDurationInput";
import {
  parseDuration,
  splitDuration,
  validateDescription,
  validateName,
} from "../utils/habitFields";
import "./HabitForm.css";

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded" };

/**
 * The habit update page (/habits/:habitId): one form with Name, Description
 * and Length of time sections. Save sends all three fields and returns to the
 * list; Cancel discards edits without a prompt, by design. A Delete button at
 * the very bottom permanently deletes the habit after an inline confirmation.
 */
export default function HabitEdit() {
  const navigate = useNavigate();
  const habitId = Number(useParams().habitId);

  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hours, setHours] = useState("");
  const [minutes, setMinutes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  // Deletion is a two-step inline confirm (research R8) rather than
  // window.confirm, so it matches the page styling and is easy to test.
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getHabit(habitId)
      .then((habit) => {
        if (cancelled) return;
        const split = splitDuration(habit.durationMinutes);
        setName(habit.name);
        setDescription(habit.description ?? "");
        setHours(String(split.hours));
        setMinutes(String(split.minutes));
        setLoadState({ status: "loaded" });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : "Failed to load habit";
        setLoadState({
          status: "error",
          // The server's lowercase "habit not found" is shown as a heading-style
          // message on this page (FR-018).
          message: message === "habit not found" ? "Habit not found" : message,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [habitId]);

  async function handleSave() {
    if (isSaving) return;

    const duration = parseDuration(hours, minutes);
    const error =
      validateName(name) ??
      validateDescription(description) ??
      ("error" in duration ? duration.error : null);
    if (error || "error" in duration) {
      setFormError(error);
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      await updateHabit(habitId, {
        name: name.trim(),
        description: description.trim() || null,
        durationMinutes: duration.minutes,
      });
      navigate("/habits");
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to update habit",
      );
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (isDeleting) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      await deleteHabit(habitId);
      navigate("/habits");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Failed to delete habit",
      );
      setIsDeleting(false);
    }
  }

  if (loadState.status !== "loaded") {
    return (
      <div className="habit-form-page">
        <div className="habit-form-card">
          {loadState.status === "loading" ? (
            <p className="habit-form-subtitle">Loading habit…</p>
          ) : (
            <>
              <p className="habit-form-load-error">{loadState.message}</p>
              <Link to="/habits" className="habit-form-back-link">
                ← Back to habits
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="habit-form-page">
      <div className="habit-form-card">
        <h1 className="habit-form-title">Edit habit</h1>
        <p className="habit-form-subtitle">Change any detail, then save.</p>

        <section className="habit-form-section">
          <label className="habit-form-label" htmlFor="habit-name">
            Name
          </label>
          <input
            id="habit-name"
            type="text"
            className="habit-form-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </section>

        <section className="habit-form-section">
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
        </section>

        <section className="habit-form-section">
          <span className="habit-form-label">Length of time</span>
          <HabitDurationInput
            hours={hours}
            minutes={minutes}
            onChange={(next) => {
              setHours(next.hours);
              setMinutes(next.minutes);
            }}
          />
        </section>

        {formError && <div className="habit-form-error">{formError}</div>}

        <div className="habit-form-actions">
          <button
            type="button"
            className="habit-form-btn habit-form-btn-secondary"
            onClick={() => navigate("/habits")}
          >
            Cancel
          </button>
          <button
            type="button"
            className="habit-form-btn habit-form-btn-primary"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>

        <div className="habit-form-danger-zone">
          {isConfirmingDelete ? (
            <div
              role="alertdialog"
              aria-labelledby="habit-delete-prompt"
              className="habit-form-delete-prompt"
            >
              <p id="habit-delete-prompt" className="habit-form-delete-text">
                Delete this habit permanently?
              </p>
              {deleteError && (
                <div className="habit-form-error">{deleteError}</div>
              )}
              <div className="habit-form-actions">
                <button
                  type="button"
                  className="habit-form-btn habit-form-btn-secondary"
                  onClick={() => {
                    setIsConfirmingDelete(false);
                    setDeleteError(null);
                  }}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="habit-form-btn habit-form-btn-danger"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting…" : "Confirm delete"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="habit-form-btn habit-form-btn-danger"
              onClick={() => setIsConfirmingDelete(true)}
            >
              Delete habit
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
