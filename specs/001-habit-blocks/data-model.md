# Data Model: Habit Blocks

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

## Entity: Habit

A reusable definition of an activity done over a block of time. It is standalone: there are no relations to `Map`, `Objective` or anything else in this feature (FR-020).

### Prisma model (`backend/prisma/schema.prisma`)

```prisma
model Habit {
  id              Int     @id @default(autoincrement())
  name            String
  description     String?
  durationMinutes Int
}
```

Migration: `npx prisma migrate dev --name add_habit`. The model has no both-or-neither pair and no DAG relation, so the migration name has no invariant to state (Principle III).

### Fields and validation (enforced in `HabitService`)

| Field | Type | Required | Rule | Error message (400) |
|-------|------|----------|------|---------------------|
| `id` | Int | auto | autoincrement; its order is also creation order | `id must be a valid integer` (non-integer route param) |
| `name` | String | yes on create | must be a string; trimmed; not empty after trimming; ≤ 100 characters | `name is required` / `name must be a string` / `name must be 100 characters or fewer (got N)` |
| `description` | String? | no | must be a string, `null`, or absent; trimmed; empty after trimming → stored as `null`; ≤ 280 characters | `description must be a string` / `description must be 280 characters or fewer (got N)` |
| `durationMinutes` | Int | yes on create | must be a `number` and an integer; 1 ≤ value ≤ 1440 | `durationMinutes is required` / `durationMinutes must be a whole number` / `durationMinutes must be between 1 and 1440` |

Order of checks within one field: missing → wrong type → value rules. Order across fields: `name`, then `description`, then `durationMinutes`. Only the first error is thrown.

Not found: `habit not found` (404). It applies to get, update and delete when no row matches the id.

### Ordering (FR-001)

`getHabits` returns habits sorted by `name`, ignoring upper/lower case. Equal names are listed in ascending `id` order, which is creation order. See [research.md](research.md) R3.

### Lifecycle

A habit is created, then updated any number of times, then hard-deleted. There is no status field, no archive and no undo.

## Frontend-only representation

The length of time is entered as two text-backed number fields, **hours** (0 to 24) and **minutes** (0 to 59). It is converted to `durationMinutes = hours × 60 + minutes` before sending.

| Input state | Result |
|-------------|--------|
| A field is empty | That field counts as 0 |
| Both fields are empty or 0 | "Length of time must be at least 1 minute" |
| A field is negative or not a whole number | "Hours and minutes must be whole numbers" |
| Minutes is above 59 | "Minutes must be between 0 and 59" |
| Hours is above 24, or 24 h with minutes above 0 | "Length of time must be 24 hours or less" |

Display format (`formatDuration`):

- `45` → `45 min`
- `60` → `1 h`
- `75` → `1 h 15 min`
- `1440` → `24 h`
