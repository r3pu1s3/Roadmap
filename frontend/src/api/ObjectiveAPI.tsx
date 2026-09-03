export interface ObjectiveCounterResponse {
  id: number;
  label: string;
  targetQuantity: number | null;
}

export interface ObjectiveResponse {
  id: number;
  description: string;
  isTask: boolean;
  counter: ObjectiveCounterResponse | null;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export async function createGoalNode(payload: {
  description: string;
  isTask: boolean;
}): Promise<ObjectiveResponse> {
  const response = await fetch(`${API_BASE}/objectives`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error ?? `Failed to create objective (${response.status})`);
  }

  return response.json();
}

export async function updateObjective(
  id: number,
  payload: { description: string; isTask: boolean }
): Promise<ObjectiveResponse> {
  const response = await fetch(`${API_BASE}/objectives/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error ?? `Failed to update objective (${response.status})`);
  }

  return response.json();
}