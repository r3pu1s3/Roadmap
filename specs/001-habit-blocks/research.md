# Research: Habit Blocks

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Date**: 2026-10-13

The Technical Context had no open unknowns: the stack, storage and test tooling are already fixed by the repo. This file records the design decisions where the user's planning notes, the spec, and existing code disagreed or said nothing.

## R1. Name and description limits: characters, not words

- **Decision**: Name is limited to 100 **characters** and description to 280 **characters**, measured after trimming leading and trailing whitespace.
- **Rationale**: The spec (FR-008, FR-009) says characters, and the clarified spec governs. The planning notes said "word count", probably carried over from `MapService`, which caps map names at 10 words.
- **Alternatives considered**:
  - A word cap like maps. Rejected because it contradicts the spec, and a 280-character description is a length limit, not a word limit.

## R2. Model name and duration field

- **Decision**: The Prisma model is `Habit` (Prisma maps it to the `Habit` table), with fields `id`, `name`, `description?` and `durationMinutes`.
- **Rationale**: Every existing model is a singular noun (`Map`, `Objective`), so "Habits" would break the convention. `durationMinutes` puts the unit in the name, so nobody has to guess whether 90 means minutes or seconds. Hours and minutes exist only in the UI (spec clarification Q3).
- **Alternatives considered**:
  - A model named `Habits`. Rejected for consistency.
  - Separate `hours`/`minutes` columns. Rejected: they create two representations of one value, and validating a single integer is simpler.

## R3. List order: alphabetical, ignoring case, ties by creation

- **Decision**: `getHabits` fetches with `orderBy: { id: "asc" }`, then sorts in the service with `localeCompare(…, undefined, { sensitivity: "base" })`. JavaScript's sort is stable, so habits with equal names stay in id order, which is creation order (oldest first).
- **Rationale**: Prisma's `orderBy` cannot sort case-insensitively on PostgreSQL without raw SQL. At most around 100 habits (SC-006), an in-memory sort costs nothing. The autoincrement `id` already records creation order, so no `createdAt` column is needed (Principle V).
- **Alternatives considered**:
  - `$queryRaw` with `ORDER BY lower(name), id`. Rejected because it bypasses the typed client and is awkward to mock.
  - Adding a `createdAt` column. Rejected because it isn't needed yet.

## R4. Update semantics: partial PATCH

- **Decision**: `PATCH /habits/:id` accepts any subset of `name`, `description` and `durationMinutes`. Fields that are omitted stay unchanged. Fields that are present are validated by the same rules as create. `description: null` or an all-whitespace string clears the description. A body with none of these fields leaves the habit unchanged and returns it.
- **Rationale**: This matches PATCH meaning and the existing `updateMap`, which forwards only known fields. The update page always sends all three fields anyway, so the frontend is unaffected.
- **Check order** (mirrors `MapService.updateMap`):
  1. id is an integer (400).
  2. The habit exists (404).
  3. The fields are valid (400).
- **Alternatives considered**:
  - Requiring all three fields (PUT semantics). Rejected because it doesn't fit the PATCH verb the user chose.
  - Rejecting an empty body. Rejected because it adds a rule nobody needs (Principle V).

## R5. Strict type checks

- **Decision**:
  - `name` and `description` must be strings when present.
  - `durationMinutes` must be a JavaScript `number` that is an integer, so `"30"` is rejected rather than converted.
  - Any other body fields are ignored.
- **Rationale**: The user asked for explicit type checks. The frontend always sends a number, so there is no need to convert strings.

## R6. Creation flow: one route, step held in state

- **Decision**: `/habits/new` is a single page component that keeps the step index (1 to 3) and every field value in state. Back and Next change the step. Cancel goes to `/habits`.
- **Rationale**: Keeping the values in one component makes "go back without losing values" (FR-006) automatic. Leaving the page drops the state, which gives "discard without a prompt" (clarification Q5) for free.
- **Alternatives considered**:
  - One URL per step (`/habits/new/1` and so on). Rejected because the values would have to be shared across routes, and opening step 3 directly from its URL would need guarding.

## R7. Per-step validation: show the error on Next

- **Decision**: Next and Create stay enabled. Clicking them while the current step is invalid shows an inline message and keeps the user on that step. Create re-checks every field before sending (FR-007). While a save is in progress, the Create and Save buttons are disabled, which prevents double submission (edge case).
- **Rationale**: Acceptance scenario US1-4 says the user "tries to move to the next step" and sees a message, which needs a clickable button. `MapForm` instead disables its submit button, but the spec governs here.

## R8. Delete confirmation: inline, not `window.confirm`

- **Decision**: The Delete button at the bottom of the update page reveals a "Delete this habit permanently?" prompt in place, with **Confirm delete** and **Cancel** buttons.
- **Rationale**: It is easy to test with React Testing Library without stubbing `window.confirm`, and it matches the dark card styling of the existing pages.
- **Alternatives considered**:
  - `window.confirm`. Rejected because it ignores the app's styling and has to be stubbed in every test.

## R9. Shared frontend helpers

- **Decision**:
  - `src/utils/habitFields.ts` holds the limits and pure validators (name, description, and hours + minutes → total minutes).
  - The same file holds the duration helpers `formatDuration` (minutes → "1 h 15 min") and `splitDuration` (minutes → hours and minutes).
  - `HabitDurationInput` is a shared component for the two hours/minutes fields.
- **Rationale**: The creation and update pages both validate the same fields and show the same duration input. The list, review step and update page all format durations. These are real second uses, not speculative ones (Principle V). `MapForm`/`MapMenu` copy their limit constant into each file, but three copies of more complex logic would drift apart.

## R10. Styling

- **Decision**: Reuse the dark visual style of `MapMenu.css`/`MapForm.css`:
  - page background `#0a0a0a`, cards `#171717` with a `#2e2e2e` border
  - accent `#6366f1` / hover `#4f46e5`, error `#f87171`
  - uppercase field labels
  - Delete uses the error red.
  - Each page and component has its own CSS file with a prefixed class names (`habit-list-*`, `habit-form-*`), which is the existing convention.
- **Rationale**: The user asked to stay true to the styling of earlier features.
