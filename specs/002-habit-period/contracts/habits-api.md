# Contract: Habits API changes

Changes to `specs/001-habit-blocks/contracts/habits-api.md`. Routes, URLs and status codes are unchanged. Validation of `period` is in [../data-model.md](../data-model.md).

## Habit object (response shape)

```json
{
  "id": 1,
  "name": "Morning run",
  "description": null,
  "durationMinutes": 30,
  "period": "daily"
}
```

`period` is `"daily" | "weekly" | "monthly" | "yearly" | number | null`. It is always present. The `periodPreset` and `periodHours` columns are never returned.

## POST /habits → `createHabit`

Body gains an optional `period`. Missing or `null` → one-time. `0` is rejected (minimum 1 hour).

| Case | Status | Body |
|---|---|---|
| Valid | 201 | Habit object |
| Invalid `period` (or any other field) | 400 | `{ "error": "<message>" }` |
| Unexpected non-`Error` | 500 | `{ "error": "failed to create habit" }` |

## GET /habits, GET /habits/:id, DELETE /habits/:id

Unchanged, except each returned habit includes `period`.

## PATCH /habits/:id → `updateHabit`

`period` joins the forwarded keys. The controller forwards it only when the key is present in the body.

| Body | Effect on period |
|---|---|
| no `period` key | unchanged |
| `"period": null` | cleared (one-time) |
| `"period": "weekly"` | set to Weekly; any custom hours cleared |
| `"period": 36.5` | set to every 36.5 h; any preset cleared |
| invalid `period` | 400, nothing saved |

Existence is still checked first: a missing habit is 404 even if `period` is also invalid.

## Service signatures (`backend/src/services/HabitService.ts`)

```ts
export type HabitPeriodValue = "daily" | "weekly" | "monthly" | "yearly" | number | null;

export interface HabitResponse {
  id: number;
  name: string;
  description: string | null;
  durationMinutes: number;
  period: HabitPeriodValue;
}

interface CreateHabitInput { name: unknown; description?: unknown; durationMinutes: unknown; period?: unknown }
interface UpdateHabitInput { id: number; name?: unknown; description?: unknown; durationMinutes?: unknown; period?: unknown }

createHabit(data: CreateHabitInput): Promise<HabitResponse>
getHabits(): Promise<HabitResponse[]>
getHabit(id: number): Promise<HabitResponse>
updateHabit(data: UpdateHabitInput): Promise<HabitResponse>
deleteHabit(id: number): Promise<HabitResponse>
```

Private helpers: `validatePeriod(period: unknown)` returns `{ periodPreset, periodHours }` for Prisma; `toHabitResponse(row)` maps a row to `HabitResponse`.

## Frontend wrapper (`frontend/src/apis/HabitApi.ts`)

- `HabitPeriodValue = "daily" | "weekly" | "monthly" | "yearly" | number | null` is defined in `frontend/src/utils/habitFields.ts` (same name as the backend's union) and re-exported from `HabitApi.ts`. It is not the backend's Prisma enum `HabitPeriod`, which holds only the four presets.
- `HabitResponse` gains `period: HabitPeriodValue`.
- `createHabit` payload gains `period: HabitPeriodValue`.
- `updateHabit` payload gains `period?: HabitPeriodValue`.
- No other wrapper changes.
