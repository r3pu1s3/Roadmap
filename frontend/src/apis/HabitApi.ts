import type { HabitPeriodValue } from "../utils/habitFields";

export type { HabitPeriodValue };

export interface HabitResponse {
  id: number;
  name: string;
  // null when the habit has no description
  description: string | null;
  durationMinutes: number;
  // null when the habit is one-time
  period: HabitPeriodValue;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000";

export async function getHabits(): Promise<HabitResponse[]> {
  const response = await fetch(`${API_BASE}/habits`);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error ?? `Failed to load habits (${response.status})`,
    );
  }

  return response.json();
}

export async function createHabit(payload: {
  name: string;
  description: string | null;
  durationMinutes: number;
  period: HabitPeriodValue;
}): Promise<HabitResponse> {
  const response = await fetch(`${API_BASE}/habits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error ?? `Failed to create habit (${response.status})`,
    );
  }

  return response.json();
}

export async function getHabit(id: number): Promise<HabitResponse> {
  const response = await fetch(`${API_BASE}/habits/${id}`);

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error ?? `Failed to load habit (${response.status})`,
    );
  }

  return response.json();
}

export async function updateHabit(
  id: number,
  payload: {
    name?: string;
    description?: string | null;
    durationMinutes?: number;
    period?: HabitPeriodValue;
  },
): Promise<HabitResponse> {
  const response = await fetch(`${API_BASE}/habits/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error ?? `Failed to update habit (${response.status})`,
    );
  }

  return response.json();
}

export async function deleteHabit(id: number): Promise<HabitResponse> {
  const response = await fetch(`${API_BASE}/habits/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.error ?? `Failed to delete habit (${response.status})`,
    );
  }

  return response.json();
}
