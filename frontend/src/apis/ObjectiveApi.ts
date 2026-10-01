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
  // Backend now requires both deadline bounds on every Objective (non-nullable
  // DateTime columns), so they are always present ISO date strings here too.
  deadlineStart: string;
  deadlineEnd: string;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function createObjective(payload: {
  description: string;
  isTask: boolean;
  mapId: number;
  // Required (not optional) because the backend rejects creates missing
  // either bound now that both columns are mandatory.
  deadlineStart: string;
  deadlineEnd: string;
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
    // Required for the same reason as createObjective's payload above.
    deadlineStart: string;
    deadlineEnd: string;
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
