export interface CreateGoalNodeCounter {
  label: string;
  targetQuantity: number;
}

export interface CreateGoalNodePayload {
  description: string;
  rewardRule: [number, number];
  deadlineRule: [number, number];
  deadline: string; // ISO string
  parentId?: number;
  counters?: CreateGoalNodeCounter[];
}

export interface GoalNode {
  id: number;
  description: string;
  parentId: number | null;
  rewardRule: number[];
  deadlineRule: number[];
  deadline: string;
  completed: boolean;
  counters: CreateGoalNodeCounter[];
}

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export async function createGoalNode(payload: CreateGoalNodePayload): Promise<GoalNode> {
  const response = await fetch(`${API_BASE}/goal-nodes`, {
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