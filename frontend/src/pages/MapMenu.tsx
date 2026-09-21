import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getMaps, updateMap, type MapResponse } from "../apis/MapApi";
import "./MapMenu.css";

// Mirrors the 10-word cap enforced server-side in MapService (and mirrored in
// MapForm's create flow) — kept in sync manually since there's no shared
// config between the two workspaces.
const NAME_WORD_LIMIT = 10;

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "loaded" };

export default function MapMenu() {
  const navigate = useNavigate();

  const [loadState, setLoadState] = useState<LoadState>({ status: "loading" });
  const [maps, setMaps] = useState<MapResponse[]>([]);

  // Editing is tracked as a single "which row is being edited" id plus one
  // shared draft name/save-error pair — only one row can be edited at a time
  // per the contract, so per-row maps would be unnecessary complexity.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    getMaps()
      .then((result) => {
        if (cancelled) return;
        setMaps(result);
        setLoadState({ status: "loaded" });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadState({
          status: "error",
          message: err instanceof Error ? err.message : "Failed to load maps",
        });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const trimmedEditingName = editingName.trim();
  const editingWordCount =
    trimmedEditingName.length === 0
      ? 0
      : trimmedEditingName.split(/\s+/).length;
  const isEditingOverLimit = editingWordCount > NAME_WORD_LIMIT;

  // Over-limit validation takes precedence over any leftover server-side
  // error from a previous failed save on this row, per the contract.
  const displayedEditError = isEditingOverLimit
    ? `Name must be ${NAME_WORD_LIMIT} words or fewer (got ${editingWordCount})`
    : saveError;

  const canSave =
    trimmedEditingName.length > 0 && !isEditingOverLimit && !isSaving;

  function startEditing(map: MapResponse, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(map.id);
    setEditingName(map.name);
    setSaveError(null);
  }

  function cancelEditing(e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(null);
    setEditingName("");
    setSaveError(null);
  }

  async function saveEditing(map: MapResponse, e: React.MouseEvent) {
    e.stopPropagation();
    if (!canSave) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      const updated = await updateMap(map.id, { name: trimmedEditingName });
      setMaps((prev) => prev.map((m) => (m.id === map.id ? updated : m)));
      setEditingId(null);
      setEditingName("");
      setSaveError(null);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to update map");
    } finally {
      setIsSaving(false);
    }
  }

  const header = (
    <div className="map-menu-header">
      <h1 className="map-menu-title">Maps</h1>
      <Link to="/maps/new" className="map-menu-new-btn" aria-label="Create map">
        + New Map
      </Link>
    </div>
  );

  return (
    <div className="map-menu-page">
      {header}

      {loadState.status === "loading" && (
        <div className="map-menu-status">Loading maps…</div>
      )}

      {loadState.status === "error" && (
        <div className="map-menu-error">{loadState.message}</div>
      )}

      {loadState.status === "loaded" && maps.length === 0 && (
        <div className="map-menu-status">
          No maps yet — create one to get started.
        </div>
      )}

      {loadState.status === "loaded" && maps.length > 0 && (
        <div className="map-menu-list">
          {maps.map((map) => {
            const isEditing = editingId === map.id;

            return (
              <div
                key={map.id}
                className="map-menu-row"
                // While editing, the row's own click is a no-op — the input
                // click is still contained within the row, so it would
                // otherwise bubble up and trigger navigation.
                onClick={
                  isEditing ? undefined : () => navigate(`/maps/${map.id}`)
                }
              >
                {isEditing ? (
                  <>
                    <input
                      className="map-menu-edit-input"
                      aria-label="New map name"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                    <div className="map-menu-edit-actions">
                      {displayedEditError && (
                        <div className="map-menu-edit-error">
                          {displayedEditError}
                        </div>
                      )}
                      <button
                        type="button"
                        className="map-menu-btn map-menu-btn-primary"
                        onClick={(e) => saveEditing(map, e)}
                        disabled={!canSave}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="map-menu-btn map-menu-btn-secondary"
                        onClick={cancelEditing}
                      >
                        Cancel
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="map-menu-row-info">
                      <span className="map-menu-row-name">{map.name}</span>
                      <span className="map-menu-row-type">{map.type}</span>
                    </div>
                    <button
                      type="button"
                      className="map-menu-edit-icon"
                      aria-label={`Rename ${map.name}`}
                      onClick={(e) => startEditing(map, e)}
                    >
                      ✎
                    </button>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
