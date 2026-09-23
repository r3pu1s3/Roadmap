import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createMap } from "../apis/MapApi";
import "./MapForm.css";

// Mirrors the 10-word cap enforced server-side in MapService — kept in sync
// manually since there's no shared config between the two workspaces.
const NAME_WORD_LIMIT = 10;

export default function MapForm() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const trimmedName = name.trim();
  // Splitting on whitespace after trimming avoids counting an empty string
  // as a single "word".
  const wordCount =
    trimmedName.length === 0 ? 0 : trimmedName.split(/\s+/).length;
  const isOverLimit = wordCount > NAME_WORD_LIMIT;

  const canSubmit = trimmedName.length > 0 && !isSaving && !isOverLimit;

  async function handleSubmit() {
    if (!canSubmit) return;

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const map = await createMap({ name: name.trim() });
      navigate(`/maps/${map.id}`);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Failed to create map",
      );
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="map-form-page">
      <div className="map-form-card">
        <h1 className="map-form-title">New map</h1>
        <p className="map-form-subtitle">Give your map a name.</p>

        <label className="map-form-label">Name</label>
        <input
          type="text"
          className="map-form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Fitness Goals"
          autoFocus
        />

        {isOverLimit && (
          <div className="map-form-error">
            {`Name must be ${NAME_WORD_LIMIT} words or fewer (got ${wordCount})`}
          </div>
        )}

        {errorMessage && <div className="map-form-error">{errorMessage}</div>}

        <button
          className="map-form-submit"
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
          {isSaving ? "Creating…" : "Create map"}
        </button>
      </div>
    </div>
  );
}
