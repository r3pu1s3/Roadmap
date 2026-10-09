export interface ObjectiveCounterResponse {
  id: number;
  label: string;
  targetQuantity: number | null;
}

export interface ObjectiveResponse {
  id: number;
  mapId: number;
  description: string;
  isTask: boolean;
  counter: ObjectiveCounterResponse | null;
  // Deadlines are nullable: an Objective may have no deadline at all. The two
  // bounds are set or cleared as a pair, so both are null or both are ISO strings.
  deadlineStart: string | null;
  deadlineEnd: string | null;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function createObjective(payload: {
  description: string;
  isTask: boolean;
  mapId: number;
  // ISO string or null, as a pair (both or neither). Kept required (not
  // optional) so callers must state "no deadline" explicitly with null.
  deadlineStart: string | null;
  deadlineEnd: string | null;
}): Promise<ObjectiveResponse> {
  const response = await fetch(`${API_BASE}/objectives`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error ?? `Failed to create objective (${response.status})`,
    );
  }

  return response.json();
}

export async function updateObjective(
  id: number,
  payload: {
    description: string;
    isTask: boolean;
    // Pair of ISO string or null. Explicit null clears the deadline; an omitted
    // key would mean "inherit" server-side, and JSON.stringify drops undefined,
    // so these stay required (no undefined) to avoid silently inheriting.
    deadlineStart: string | null;
    deadlineEnd: string | null;
  },
): Promise<ObjectiveResponse> {
  const response = await fetch(`${API_BASE}/objectives/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error ?? `Failed to update objective (${response.status})`,
    );
  }

  return response.json();
}
