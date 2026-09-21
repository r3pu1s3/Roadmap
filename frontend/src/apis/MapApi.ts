import type { ObjectiveResponse } from "./ObjectiveApi";
import type { ObjectiveEdgeResponse } from "./ObjectiveEdgeApi";

export type MapType = "Project" | "Habit";

export interface MapResponse {
  id: number;
  name: string;
  type: MapType;
}

// The canvas needs the full graph (objectives + edges) in one call, so this
// extends the bare MapResponse rather than requiring a second round-trip.
export interface MapGraphResponse extends MapResponse {
  objectives: ObjectiveResponse[];
  edges: ObjectiveEdgeResponse[];
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function createMap(payload: {
  name: string;
  type: MapType;
}): Promise<MapResponse> {
  const response = await fetch(`${API_BASE}/maps`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error ?? `Failed to create map (${response.status})`,
    );
  }

  return response.json();
}

export async function getMaps(): Promise<MapResponse[]> {
  const response = await fetch(`${API_BASE}/maps`);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error ?? `Failed to load maps (${response.status})`,
    );
  }

  return response.json();
}

export async function getMap(id: number): Promise<MapGraphResponse> {
  const response = await fetch(`${API_BASE}/maps/${id}`);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error ?? `Failed to load map (${response.status})`,
    );
  }

  return response.json();
}

export async function updateMap(
  id: number,
  payload: { name: string },
): Promise<MapResponse> {
  const response = await fetch(`${API_BASE}/maps/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error ?? `Failed to update map (${response.status})`,
    );
  }

  return response.json();
}
