export interface ObjectiveEdgeResponse {
  id: number;
  parentId: number;
  childId: number;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function createObjectiveEdge(payload: {
  parentId: number;
  childId: number;
}): Promise<ObjectiveEdgeResponse> {
  const response = await fetch(`${API_BASE}/objective-edges`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error ?? `Failed to create objective edge (${response.status})`,
    );
  }

  return response.json();
}

export async function deleteObjectiveEdge(
  id: number,
): Promise<ObjectiveEdgeResponse> {
  const response = await fetch(`${API_BASE}/objective-edges/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error ?? `Failed to delete objective edge (${response.status})`,
    );
  }

  return response.json();
}
