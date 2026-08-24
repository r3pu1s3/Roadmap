export enum RepeatDuration {
  DAILY = "DAILY",
  WEEKLY = "WEEKLY",
  MONTHLY = "MONTHLY",
  YEARLY = "YEARLY",
}

export enum ObjectiveStatus {
  Completed = "Completed",
  Incomplete = "Incomplete",
  Unknown = "Unknown",
}

export type Objective = {
  description: string;
  id: number;
  subObjectives: Objective[];
  deadline: Date;
  repeatDuration?: RepeatDuration;
  endDate?: Date;
  unit?: string;
  value?: number;
  miss?: number;
  hit?: number;
  status: ObjectiveStatus;
};

// DEPRECATED
export type ObjectiveNode = {
  description: string;
  id: number;
  deadline: Date;
  status: ObjectiveStatus;
};
