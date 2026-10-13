# Contract: Habits HTTP API

Base URL: `VITE_API_BASE_URL` (default `http://localhost:3000`). All bodies are JSON. Errors are always `{ "error": "<message>" }`. Status codes follow the existing controller convention:

| Status | When |
|--------|------|
| 201 | Successful create |
| 200 | Successful read, update or delete |
| 400 | The service threw an `Error` that is not "not found", e.g. a validation error or a bad id |
| 404 | The service threw `habit not found` |
| 500 | Something other than an `Error` was thrown (and logged) |

## Habit object (response shape)

```json
{ "id": 1, "name": "Morning run", "description": "Easy pace", "durationMinutes": 30 }
```

`description` is `null` when it is not set.

## POST /habits → `createHabit`

Request:

```json
{ "name": "Morning run", "description": "Easy pace", "durationMinutes": 30 }
```

- `description` may be omitted or `null`.
- Unknown fields are ignored.
- On success: **201** with the created Habit.
- The 400 cases are listed in [data-model.md](../data-model.md).

## GET /habits → `getHabits`

- **200** with an array of Habits, sorted by name ignoring upper/lower case. Habits with the same name are listed oldest first.
- Returns `[]` when there are none.

## GET /habits/:id → `getHabit`

| Status | When |
|--------|------|
| 200 | Returns the Habit |
| 400 | `id must be a valid integer` |
| 404 | `habit not found` |

## PATCH /habits/:id → `updateHabit`

Request: any subset of the following.

```json
{ "name": "Evening run", "description": null, "durationMinutes": 45 }
```

- Omitted fields are left unchanged.
- `description: null` (or a whitespace-only string) clears the description.

Checks run in this order, and the first failure is returned:

| Step | Check | Failure |
|------|-------|---------|
| 1 | id is a valid integer | 400 `id must be a valid integer` |
| 2 | the habit exists | 404 `habit not found` |
| 3 | every field that is present passes the create rules | 400 |
| — | all checks pass | 200 with the updated Habit |

## DELETE /habits/:id → `deleteHabit`

| Status | When |
|--------|------|
| 200 | Returns the deleted Habit, matching the existing `DELETE /objective-edges/:id` |
| 400 | `id must be a valid integer` |
| 404 | `habit not found` |

## Service signatures (`backend/src/services/HabitService.ts`)

```ts
createHabit(data: { name: unknown; description?: unknown; durationMinutes: unknown }): Promise<Habit>
getHabits(): Promise<Habit[]>
getHabit(id: number): Promise<Habit>
updateHabit(data: { id: number; name?: unknown; description?: unknown; durationMinutes?: unknown }): Promise<Habit>
deleteHabit(id: number): Promise<Habit>
```

- Inputs are typed `unknown` because the service does the runtime type checks (research R5).
- The controller does `Number(req.params.id)` and passes the body fields through. It never validates them itself.

## Frontend wrapper (`frontend/src/apis/HabitApi.ts`)

`HabitResponse` mirrors the Habit object. The wrapper exports these functions:

- `createHabit(payload)`
- `getHabits()`
- `getHabit(id)`
- `updateHabit(id, payload)`
- `deleteHabit(id)`

Each one throws `new Error(body.error ?? "Failed to … (status)")` on a non-OK response, matching `MapApi.ts`.
