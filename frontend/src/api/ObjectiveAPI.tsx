export interface CreateObjectiveCounter {
  label: string;
  targetQuantity: number;
}

export interface CreateObjectivePayload {
  description: string;
  isTask: boolean;
  
}

export interface ObjectiveCounter{
  label: string;
  
}

export interface Objective {
  id: number;
  description: string;
  isTask: boolean;
  counter?: ObjectiveCounter;
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export async function createGoalNode(payload: CreateObjectivePayload): Promise<Objective> {
  const response = await fetch(`${API_BASE}/objective`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.error ?? `Failed to create goal node (${response.status})`);
  }

  return response.json();
}