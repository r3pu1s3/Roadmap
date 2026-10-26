# Data Model: Habit Period

Changes to the `Habit` model from Habit Blocks (`specs/001-habit-blocks/data-model.md`). Everything not listed here is unchanged.

## Schema change (`backend/prisma/schema.prisma`)

```prisma
enum HabitPeriod {
  daily
  weekly
  monthly
  yearly
}

model Habit {
  id              Int          @id @default(autoincrement())
  name            String
  description     String?
  durationMinutes Int
  // At most one of these two is set; both null = one-time (research P1).
  periodPreset    HabitPeriod?
  periodHours     Float?
}
```

Migration: `npx prisma migrate dev --name add_habit_period_preset_or_hours`, then `npx prisma generate`. Existing rows get null in both columns, so they read as one-time. No backfill.

## API shape: `period`

The two columns are never exposed. Every response and request uses one field:

| `period` value | Stored as | Meaning | Shown as |
|---|---|---|---|
| `null` | both columns null | One-time | "One-time" |
| `"daily"` / `"weekly"` / `"monthly"` / `"yearly"` | `periodPreset` set, `periodHours` null | Named calendar period (spec FR-012) | "Daily" / "Weekly" / "Monthly" / "Yearly" |
| a number N | `periodPreset` null, `periodHours` = N | Every N hours | "Every N h" |

## Validation (service: `validatePeriod`)

Runs after the existing name → description → durationMinutes checks. The first failure is thrown.

| Input | Result |
|---|---|
| `undefined` on create, or `null` | One-time (both columns null) |
| `undefined` on update | Period left unchanged |
| `"daily"`, `"weekly"`, `"monthly"`, `"yearly"` | Accepted as a preset |
| Any other string (incl. `"Daily"`, `"36"`), boolean, object, array | `period must be one of daily, weekly, monthly, yearly, or a number of hours` |
| A number under 1 (including 0 and negatives) | `period must be at least 1 hour` |
| A number > 8766 | `period must be 8766 hours or fewer` |
| A number with 1 ≤ N ≤ 8766, fractions allowed | Accepted as custom hours |

JSON can't carry `NaN` or `Infinity`, but the check uses `Number.isFinite` anyway so the rule holds for any caller.

The period is not checked against `durationMinutes` (spec FR-014).

## Frontend form state

| Field | Type | Notes |
|---|---|---|
| `periodChoice` | `"none" \| "daily" \| "weekly" \| "monthly" \| "yearly" \| "custom"` | Starts at `"none"` on create |
| `periodHours` | `string` | Only read when `periodChoice` is `"custom"`. Kept as a string so an empty field stays empty |

`parsePeriod(choice, hours)` converts these to the API `period`, or an error message:

| Choice / hours | Result |
|---|---|
| `"none"` | `null` |
| a preset | that preset |
| `"custom"`, hours empty or only spaces | `null` (spec FR-002) |
| `"custom"`, hours not a plain decimal (e.g. `"abc"`, `"1e3"`) | `Hours must be a number` |
| `"custom"`, hours under 1 (e.g. `"0"`, `"0.5"`, `"-1"`) | `Hours must be at least 1` |
| `"custom"`, hours > 8766 | `Hours must be 8766 or fewer` |
| `"custom"`, valid | that number |
