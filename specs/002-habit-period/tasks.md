---

description: "Task list for Habit Period"
---

# Tasks: Habit Period

**Input**: Design documents from `/specs/002-habit-period/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/habits-api.md](contracts/habits-api.md), [contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md)

**Tests**: Required. Constitution Principle II requires unit tests to be written before the code they cover. They are **not** sent to the user for review (constitution 5.1.0, Principle VII).

**Checkpoints**: Only two kinds, both hard stops (Principle VII):

- **🛑 Story checkpoint** at the end of each user story phase (US2, US1, US3). Stop and send the user a summary: what was built and which files changed; tasks done and remaining in this file; test, build and lint results; any deviation from the plan, surprise, or open question. The next story starts only when the user explicitly approves that checkpoint. Approving one never approves the next.
- **🛑 Final check** (T037): the user verifies the finished feature by hand before it is committed.

Within a phase, work runs without stopping, except when a task fails.

**Organization**: Spec Kit default, as required by constitution 5.1.0 (Development Workflow). Each user story is a vertical slice built in this fixed order:

1. Backend tests
2. Service, then controller
3. `HabitApi.ts` changes
4. Frontend test → implementation pairs
5. 🛑 Story checkpoint

No route, `index.ts` or `App.tsx` changes are needed: every endpoint and page already exists. A story's backend must be green before its frontend starts. All unit tests, including earlier stories', must be green before the next story starts.

**Branches**: None of these tasks create or switch git branches (constitution 5.1.0). Work on whichever branch is checked out.

**Story order**: US2 (See the period, P1) → US1 (Set it on create, P1) → US3 (Change it on update, P2). US2 and US1 have the same priority. US2 goes first because it introduces the response shape (`period`) that every later story returns, and the list is where creation starts and ends.

**Existing tests that change meaning**: These features already exist, so some Habit Blocks tests assert on shapes this feature changes. Each story's test task says which ones to update:

- Backend: `toEqual(savedHabit)` on a returned habit, and `prisma.habit.create` called with exactly `{ name, description, durationMinutes }`.
- Frontend: `HabitResponse` fixtures without `period`, and "Step N of 3" in `HabitCreate.test.tsx`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: US1 to US3 from spec.md
- Paths are relative to the repository root

---

## Phase 1: Setup

**Purpose**: Confirm a green baseline.

- [X] T001 Run `npm test` in `backend/` and in `frontend/`. Both must pass before any change. If tests already fail, report them to the user rather than fixing them in this feature.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pieces more than one story uses:

| Piece | Used by |
|-------|---------|
| The period columns | Every story |
| `habitFields.ts` period helpers | `formatPeriod` in US1 and US2; `parsePeriod` in US1 and US3; `periodToFields` in US3 |
| `HabitPeriodInput` | US1 and US3 |

**⚠️ CRITICAL**: No user story can start until this phase is complete.

- [X] T002 In `backend/prisma/schema.prisma`:
  - Add, just before `model Habit`:
    ```prisma
    enum HabitPeriod {
      daily
      weekly
      monthly
      yearly
    }
    ```
  - Add two fields to `model Habit`, after `durationMinutes`: `periodPreset HabitPeriod?` and `periodHours Float?`.
  - Add a comment above the two fields: "At most one of these is set; both null = one-time. Enforced in HabitService (custom hours: 1 ≤ value ≤ 8766, fractions allowed)."
  - Change nothing else in the model.
- [X] T003 In `backend/`, run `npx prisma migrate dev --name add_habit_period_preset_or_hours`. This creates `backend/prisma/migrations/<timestamp>_add_habit_period_preset_or_hours/` and regenerates `backend/src/generated/prisma`. Don't hand-edit the generated migration (Principle III). Existing rows get null in both columns. Confirm `npm test` and `npm run build` in `backend/` still pass.
- [X] T004 [P] Add a `describe` block per helper to `frontend/src/__tests__/unit/utils/habitFields.test.ts`, matching [data-model.md](data-model.md) "Frontend form state" and [contracts/ui.md](contracts/ui.md) "Utilities":
  - **`MAX_PERIOD_HOURS`** is `8766`.
  - **`parsePeriod(choice, hours)`**:
    - `("none", "")` → `{ period: null }`. `("none", "5")` → `{ period: null }`: hours are ignored unless the choice is Custom.
    - `("daily", "")`, `("weekly", "")`, `("monthly", "")` and `("yearly", "")` → `{ period: <that preset> }`. `("weekly", "abc")` → `{ period: "weekly" }`.
    - `("custom", "")` and `("custom", "   ")` → `{ period: null }`.
    - `("custom", "36")` → `{ period: 36 }`. `("custom", "1.5")` → `{ period: 1.5 }`. `("custom", " 2 ")` → `{ period: 2 }`.
    - `("custom", "1")` → `{ period: 1 }` and `("custom", "8766")` → `{ period: 8766 }` (the boundaries are accepted).
    - `("custom", "0")`, `("custom", "0.5")` and `("custom", "-1")` → `{ error: "Hours must be at least 1" }`.
    - `("custom", "8766.5")` and `("custom", "10000")` → `{ error: "Hours must be 8766 or fewer" }`.
    - `("custom", "abc")`, `("custom", "1e3")` and `("custom", ".5")` → `{ error: "Hours must be a number" }`.
  - **`periodToFields(period)`**: `null` → `{ choice: "none", hours: "" }`; `"monthly"` → `{ choice: "monthly", hours: "" }`; `36.5` → `{ choice: "custom", hours: "36.5" }`.
  - **`formatPeriod(period)`**: `null` → "One-time"; `"daily"` / `"weekly"` / `"monthly"` / `"yearly"` → "Daily" / "Weekly" / "Monthly" / "Yearly"; `36` → "Every 36 h"; `1.5` → "Every 1.5 h"; `720` → "Every 720 h" (never converted to days).


- [X] T005 Implement the period helpers in `frontend/src/utils/habitFields.ts`:
  - Export `MAX_PERIOD_HOURS = 8766`. Comment that it mirrors `HabitService`, like the existing limits.
  - Export `type PeriodChoice = "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom"`.
  - Export `type HabitPeriodValue = "daily" | "weekly" | "monthly" | "yearly" | number | null`, the same name the backend uses for this union. (The backend's Prisma enum `HabitPeriod` holds only the four presets.) Define it here, not in `HabitApi.ts`, so utilities don't depend on the API module. `HabitApi.ts` re-exports it in T012.
  - Export `parsePeriod`, `periodToFields` and `formatPeriod`, each with a one-line purpose comment.
  - In `parsePeriod`, trim the hours text and match it against `/^-?\d+(\.\d+)?$/` before converting it with `Number`. Check "at least 1" before "8766 or fewer".
  - Iterate until T004 passes.
- [X] T006 [P] Write `frontend/src/__tests__/unit/components/HabitPeriodInput.test.tsx`, following `HabitDurationInput.test.tsx`:
  - A combobox labelled "Period" has options in this order: None, Daily, Weekly, Monthly, Yearly, Custom, with values `none`, `daily`, `weekly`, `monthly`, `yearly`, `custom`. The selected option matches the `choice` prop.
  - With `choice` other than `"custom"`, no "Hours" input is rendered.
  - With `choice="custom"`, a number input labelled "Hours" is rendered, showing the `hours` prop, with `min="1"`, `max="8766"` and `step="any"`.
  - Selecting another option calls `onChange({ choice: <new>, hours: <current hours> })`, so hours are kept when switching away from Custom.
  - Typing in Hours calls `onChange({ choice: "custom", hours: <typed> })`.


- [X] T007 Implement `frontend/src/components/HabitPeriodInput.tsx` and `frontend/src/components/HabitPeriodInput.css`:
  - Props `{ choice: PeriodChoice; hours: string; onChange(next: { choice: PeriodChoice; hours: string }): void }`.
  - Fully controlled, with no validation inside. Add a purpose comment like the one on `HabitDurationInput`.
  - Style the select and input like `.habit-duration-input`: background `#0f0f0f`, border `#333`, radius 6px, text `#f5f5f5`, focus border `#6366f1`. Style the "Hours" label like `.habit-duration-label`.
  - Iterate until T006 passes.

**Phase done when**: The schema is migrated and the shared period helpers and input are ready. Every unit test in both workspaces is green. (Not a checkpoint: carry straight on to US2.)

---

## Phase 3: User Story 2 - See each habit's period on the habits page (Priority: P1)

**Goal**: Every habit endpoint's response carries `period`. Each block on `/habits` shows "Daily" / "Weekly" / "Monthly" / "Yearly" / "Every N h" / "One-time".

**Independent Test**: The create and update endpoints don't accept `period` yet at this point.
1. Run `npx prisma studio` in `backend/` and set one habit's `periodPreset` to `weekly`, another's `periodHours` to `36.5`, and leave a third with both empty.
2. Open `/habits`. They show "Weekly", "Every 36.5 h" and "One-time".

### Backend tests for User Story 2 ⚠️

- [X] T008 [P] [US2] In `backend/src/__tests__/unit/services/HabitService.test.ts`, inside `describe("getHabits")`, add:
  - A row with `periodPreset: null, periodHours: null` is returned with `period: null`.
  - A row with `periodPreset: "weekly", periodHours: null` is returned with `period: "weekly"`.
  - A row with `periodPreset: null, periodHours: 36.5` is returned with `period: 36.5`.
  - Returned habits have exactly the keys `id`, `name`, `description`, `durationMinutes` and `period`. They do **not** include `periodPreset` or `periodHours`.
  - Add `periodPreset: null, periodHours: null` to the file's shared mock rows (e.g. `savedHabit`) so they match the regenerated `Habit` type. Leave the other `describe` blocks' assertions alone: US1 and US3 update them.
- [X] T009 [P] [US2] In `backend/src/__tests__/unit/controllers/HabitController.test.ts`, `describe("getHabits")`: add one case where the service resolves habits with `period` values (`null`, `"daily"`, `12`) and the 200 body equals them unchanged.


### Backend implementation for User Story 2

- [X] T010 [US2] In `backend/src/services/HabitService.ts`:
  - Export `type HabitPeriodValue = "daily" | "weekly" | "monthly" | "yearly" | number | null`.
  - Export `interface HabitResponse { id: number; name: string; description: string | null; durationMinutes: number; period: HabitPeriodValue }`.
  - Add a private `toHabitResponse(row: Habit): HabitResponse`. It returns `period` as `row.periodPreset ?? row.periodHours ?? null` and never copies the two columns into the response. Comment why: the API exposes one `period` field over two typed columns (research P1, P6).
  - Change `getHabits()` to return `Promise<HabitResponse[]>`. Map with `toHabitResponse` after the existing sort.
  - Leave the other functions unchanged in this task.
  - Iterate until T008 passes. `HabitController.getHabits` needs no change, so T009 should already pass.
- [X] T011 [US2] In `backend/`, run `npm test`, `npm run build` and `npm run lint`. All must pass. Then, with the dev server running, check `curl localhost:3000/habits`: every habit has `period`, and none has `periodPreset` or `periodHours`.

### Frontend for User Story 2

- [X] T012 [US2] In `frontend/src/apis/HabitApi.ts`:
  - Import `type HabitPeriodValue` from `../utils/habitFields` and re-export it.
  - Add `period: HabitPeriodValue` to `HabitResponse`, with the comment "null when the habit is one-time".
  - `npm run build` will fail to type-check until T013 updates the test fixtures. That's expected; don't edit test files in this task.
- [X] T013 [US2] Update the frontend tests for the new response shape (all under `frontend/src/__tests__/unit/`):
  - **Fixtures (type-only)**: add `period: null` to every `HabitResponse` fixture in `components/HabitItem.test.tsx`, `pages/HabitList.test.tsx`, `pages/HabitCreate.test.tsx` and `pages/HabitEdit.test.tsx`. Change nothing else in those files here.
  - **New cases** in `components/HabitItem.test.tsx`:
    - It renders `formatPeriod(habit.period)` for `null` ("One-time"), `"monthly"` ("Monthly") and `1.5` ("Every 1.5 h").
    - The period appears after the duration.
  - After this, `npm run build` in `frontend/` must type-check again, and only the new HabitItem cases fail.


- [X] T014 [US2] In `frontend/src/components/HabitItem.tsx` and `frontend/src/components/HabitItem.css`:
  - After the duration, render `<span className="habit-item-period">{formatPeriod(habit.period)}</span>`.
  - Group the duration and period on the right in a `.habit-item-meta` wrapper (`display: flex; gap: 8px; flex-shrink: 0`) so the long name still truncates.
  - Style `.habit-item-period` like `.habit-item-duration` (13px, `#a3a3a3`).
  - Iterate until T013 passes.
- [X] T015 [US2] Run `npm test` in both workspaces: all green.

**🛑 Story checkpoint (US2)**: Run its Independent Test above where it can be run without the user. Then stop and send the user the US2 summary (built, files changed, tasks done/remaining, test/build/lint results, deviations and open questions). Do not start Phase 4 (US1) until the user explicitly approves.

---

## Phase 4: User Story 1 - Set a period when creating a habit (Priority: P1) 🎯 MVP

**Goal**: `POST /habits` accepts an optional `period`. The creation flow has a fourth step, Period, before Review.

**Independent Test**: Create "Run" with Weekly, "Read" with Custom 36, and "Nap" with None. `/habits` shows "Weekly", "Every 36 h" and "One-time", and they are still there after a reload (quickstart scenarios 2 to 9).

### Backend tests for User Story 1 ⚠️

- [X] T016 [P] [US1] In `backend/src/__tests__/unit/services/HabitService.test.ts`, `describe("createHabit")`:
  - **Update existing tests**:
    - Every `prisma.habit.create` call assertion now expects `data` to also include `periodPreset: null, periodHours: null` when no period is given.
    - "returns the created habit" expects the mapped `HabitResponse` (with `period`, without the two columns), not the raw row.
  - **Add**:
    - A missing `period` and `period: null` both create with `periodPreset: null, periodHours: null` and return `period: null`.
    - Each of `"daily"`, `"weekly"`, `"monthly"` and `"yearly"` creates with `periodPreset: <it>, periodHours: null` and returns `period: <it>`.
    - `1.5` creates with `periodPreset: null, periodHours: 1.5` and returns `period: 1.5`. `1` and `8766` are accepted.
    - `0`, `0.5` and `-1` → throws `"period must be at least 1 hour"`.
    - `8766.5` and `10000` → throws `"period must be 8766 hours or fewer"`.
    - `"hourly"`, `"Daily"`, `"36"`, `true`, `{}` and `[]` → throws `"period must be one of daily, weekly, monthly, yearly, or a number of hours"`.
    - With an invalid `durationMinutes` and an invalid `period`, the `durationMinutes` error is thrown (check order: name → description → durationMinutes → period).
    - `prisma.habit.create` is not called when `period` is invalid.
    - A 120-minute habit with `period: 1` is accepted. The period isn't checked against the duration (spec FR-014).
- [X] T017 [P] [US1] In `backend/src/__tests__/unit/controllers/HabitController.test.ts`, `describe("createHabit")`:
  - The service is called with `{ name, description, durationMinutes, period }` taken from the body, e.g. `period: "weekly"`.
  - Without `period` in the body, the service is called with `period: undefined`.
  - A service `Error` such as `"period must be at least 1 hour"` → 400 `{ error: message }`. The 201 and 500 paths are unchanged.


### Backend implementation for User Story 1

- [X] T018 [US1] In `backend/src/services/HabitService.ts`:
  - Add constants `MIN_PERIOD_HOURS = 1` and `MAX_PERIOD_HOURS = 8766`, with the comment "365.25 days".
  - Add a private `validatePeriod(period: unknown): { periodPreset: HabitPeriod | null; periodHours: number | null }`. Import the generated `HabitPeriod` enum type.
    - `undefined` or `null` → both null.
    - A string in `["daily", "weekly", "monthly", "yearly"]` → `{ periodPreset: it, periodHours: null }`.
    - A finite number: below 1 → throw `"period must be at least 1 hour"`; above 8766 → throw `"period must be 8766 hours or fewer"`; otherwise `{ periodPreset: null, periodHours: it }`.
    - Anything else, including numeric strings → throw `"period must be one of daily, weekly, monthly, yearly, or a number of hours"`.
    - Comment that it returns both columns so a write always keeps "at most one set" (research P5).
  - Add `period?: unknown` to `CreateHabitInput`.
  - In `createHabit`, validate the period after `durationMinutes`, spread the result into `data`, and return `toHabitResponse(created)`. Change the return type to `Promise<HabitResponse>`.
  - Iterate until T016 passes.
- [X] T019 [US1] In `backend/src/controllers/HabitController.ts` `createHabit`: destructure `period` from `req.body` and pass it to the service. Update the comment to "the four habit fields". Status codes are unchanged. Iterate until T017 passes.
- [X] T020 [US1] In `backend/`, run `npm test`, `npm run build` and `npm run lint`: all pass. Then, with the dev server running, run the POST spot checks in [quickstart.md](quickstart.md) ("API spot checks", rows 1 to 5).

### Frontend for User Story 1

- [X] T021 [US1] In `frontend/src/apis/HabitApi.ts`, add `period: HabitPeriodValue` to the `createHabit` payload type.
- [X] T022 [US1] Update `frontend/src/__tests__/unit/pages/HabitCreate.test.tsx`:
  - **Update**: every "Step N of 3" becomes "Step N of 4". Tests that click through to Review now pass through the Period step: click Next once more with None selected.
  - **Add**:
    - After a valid duration, Next shows "Step 3 of 4" with the Period combobox set to None.
    - Choosing Weekly and clicking Next shows Review with a "Period" row reading "Weekly".
    - Choosing Custom with Hours "1.5" shows "Every 1.5 h" on Review.
    - Custom with empty Hours shows "One-time" on Review.
    - Custom with Hours "0", then Next, stays on step 3 and shows "Hours must be at least 1". "9000" shows "Hours must be 8766 or fewer".
    - From Review, Back returns to the Period step with the earlier choice and hours still set.
    - Create calls `createHabit` with `period: "weekly"`, `period: 1.5` or `period: null` to match the choice.


- [X] T023 [US1] Update `frontend/src/pages/HabitCreate.tsx`:
  - `type Step = 1 | 2 | 3 | 4`. Add `periodChoice` state (initially `"none"`) and `periodHours` state (initially `""`).
  - Step 3 renders a "Period" label and `<HabitPeriodInput>`. Review moves to step 4 and gains a "Period" row with `formatPeriod`.
  - `validateStep(3)` returns the `parsePeriod` error, or null.
  - `handleCreate` re-checks steps 1 to 3 and sends `period` from `parsePeriod`.
  - Update the subtitle to "Step {step} of 4", the `step < 3` condition to `step < 4`, and the component comment to "Details → Length of time → Period → Review".
  - Iterate until T022 passes.
- [X] T024 [US1] Run `npm test` in both workspaces: all green.

**🛑 Story checkpoint (US1)**: Run its Independent Test above where it can be run without the user. Then stop and send the user the US1 summary (built, files changed, tasks done/remaining, test/build/lint results, deviations and open questions). Do not start Phase 5 (US3) until the user explicitly approves.

---

## Phase 5: User Story 3 - Change a habit's period on the update page (Priority: P2)

**Goal**: `PATCH /habits/:id` accepts `period` (absent → unchanged, `null` → cleared). `GET /habits/:id` and `DELETE /habits/:id` return `period`. The update page has a Period section.

**Independent Test**: Open a Weekly habit, change it to Custom 12, and Save: `/habits` shows "Every 12 h". Change it to None and Save: "One-time". Both survive a reload (quickstart scenarios 10 to 14).

### Backend tests for User Story 3 ⚠️

- [X] T025 [P] [US3] In `backend/src/__tests__/unit/services/HabitService.test.ts`:
  - **`describe("getHabit")`**: the found habit is returned mapped, e.g. a row with `periodHours: 12` → `period: 12`, with no `periodPreset` or `periodHours` key. Update "resolves to savedHabit" to expect the mapped shape.
  - **`describe("deleteHabit")`**: the deleted habit is returned mapped. Update its `toEqual(savedHabit)` the same way.
  - **`describe("updateHabit")`**:
    - **Update**: the existing `toEqual(savedHabit)` expects the mapped shape. Existing `prisma.habit.update` `data` assertions stay as they are, because they don't send `period`. This confirms that an absent `period` leaves both columns out of `data`.
    - **Add**:
      - `{ id, period: null }` → `data` has `periodPreset: null, periodHours: null`.
      - `{ id, period: "weekly" }` → `data` has `periodPreset: "weekly", periodHours: null`.
      - `{ id, period: 36.5 }` → `data` has `periodPreset: null, periodHours: 36.5`.
      - `{ id, period: 0 }` → throws `"period must be at least 1 hour"`, and `update` isn't called.
      - `{ id, period: "36" }` → throws the "must be one of" message.
      - A missing habit with an invalid `period` → throws `"habit not found"`, because existence is checked first.
      - The result is the mapped updated habit.
- [X] T026 [P] [US3] In `backend/src/__tests__/unit/controllers/HabitController.test.ts`, `describe("updateHabit")`:
  - A body `{ period: "monthly" }` → the service is called with `{ id, period: "monthly" }`.
  - `{ period: null }` → the service is called with `period: null`; the key is present.
  - A body without `period` → the service input has no `period` key (assert with `not.toHaveProperty("period")`).
  - A service `Error` with a period message → 400. Not found → 404, unchanged.


### Backend implementation for User Story 3

- [X] T027 [US3] In `backend/src/services/HabitService.ts`:
  - Add `period?: unknown` to `UpdateHabitInput`.
  - In `updateHabit`, after the existing field checks: `if (data.period !== undefined) Object.assign(changes, validatePeriod(data.period));`. Widen the `changes` type to include `periodPreset` and `periodHours`.
  - Update its comment: `period: null` clears it, and a preset or number replaces the other column.
  - Return `toHabitResponse(...)` from `getHabit`, `updateHabit` and `deleteHabit`, and change their return types to `Promise<HabitResponse>`.
  - Iterate until T025 passes.
- [X] T028 [US3] In `backend/src/controllers/HabitController.ts` `updateHabit`, add `"period"` to the forwarded-keys list and its `Partial<Record<...>>` type. Iterate until T026 passes.
- [X] T029 [US3] In `backend/`, run `npm test`, `npm run build` and `npm run lint`: all pass. Then run the PATCH spot checks in [quickstart.md](quickstart.md) (the last two rows).

### Frontend for User Story 3

- [X] T030 [US3] In `frontend/src/apis/HabitApi.ts`, add `period?: HabitPeriodValue` to the `updateHabit` payload type.
- [X] T031 [US3] In `frontend/src/__tests__/unit/pages/HabitEdit.test.tsx`, add:
  - Loading a habit with `period: 36.5` shows the Period combobox on Custom and Hours "36.5". With `"weekly"` it shows Weekly and no Hours input. With `null` it shows None.
  - Changing to Monthly and saving calls `updateHabit(id, { ..., period: "monthly" })` and navigates to `/habits`.
  - Choosing None, or Custom with empty Hours, and saving sends `period: null`.
  - Custom with Hours "0.5" and Save shows "Hours must be at least 1" and doesn't call `updateHabit`.
  - Existing save tests now expect `period` in the payload, e.g. `period: null` for a fixture with `period: null`.


- [X] T032 [US3] Update `frontend/src/pages/HabitEdit.tsx`:
  - Add `periodChoice` and `periodHours` state, filled on load from `periodToFields(habit.period)`.
  - Add a `<section className="habit-form-section">` with a "Period" label and `<HabitPeriodInput>`, after "Length of time".
  - In `handleSave`, validate with `parsePeriod` after the other fields (same error box) and send `period`.
  - Update the component comment to list the Period section.
  - Iterate until T031 passes.
- [X] T033 [US3] Run `npm test` in both workspaces: all green.

**🛑 Story checkpoint (US3)**: Run its Independent Test above where it can be run without the user. Then stop and send the user the US3 summary (built, files changed, tasks done/remaining, test/build/lint results, deviations and open questions). Do not start Phase 6 (Polish) until the user explicitly approves.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T034 [P] In `frontend/`, run `npm test`, `npm run build`, `npm run lint` and `npm run format:check`. Fix only issues in this feature's files.
- [X] T035 [P] In `backend/`, run `npm run build`, `npm run lint` and `npm run format:check`. Fix only issues in this feature's files.
- [X] T036 Update `CLAUDE.md`:
  - Under "Data model", change the `Habit` line to mention the optional period. Say that it is stored as `periodPreset` (enum daily/weekly/monthly/yearly) or `periodHours` (1–8766, fractions allowed), at most one set, and exposed as a single `period` field.
  - Note that the period limits are mirrored in `frontend/src/utils/habitFields.ts`.
- [X] T037 **🛑 Final check.** With both dev servers running, send the user a summary of the whole feature, then have the **user** go through scenarios 1 to 14 in [quickstart.md](quickstart.md). Fix any failure in the relevant task rather than patching ad hoc, then repeat the check. Nothing is committed until the user confirms it passed.
- [X] T038 Only after the user confirms T037 passed:
  1. Review the staged files' contents (Principle VI: no `.env` or local configuration).
  2. Ask the user whether the pending constitution amendments (4.2.0 → 5.1.0) in `.specify/memory/constitution.md` go in this commit or a separate one. Its Sync Impact Report must be removed before it is committed.
  3. Commit with a detailed message ending with the required co-author line. Don't create or switch branches.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none.
- **Foundational (Phase 2)**: depends on Setup. **It blocks every story.**
- **US2 (Phase 3)**: depends on Phase 2. It introduces `HabitResponse`/`toHabitResponse` and `HabitResponse.period`, which US1 and US3 use.
- **US1 (Phase 4)**: depends on US2. It adds `validatePeriod`, which US3 reuses.
- **US3 (Phase 5)**: depends on US1.
- **Polish (Phase 6)**: depends on every story. T038 needs the user's sign-off on T037.

### Within Each Story

Backend tests → service → controller → backend green → `HabitApi.ts` → each frontend unit: test → implementation → all tests green → 🛑 story checkpoint.

### Parallel Opportunities

| Tasks | Why they can run together |
|-------|---------------------------|
| T004 ∥ T006 | Independent Foundational test files. |
| T008 ∥ T009, T016 ∥ T017, T025 ∥ T026 | Service and controller test files for the same story. |
| T034 ∥ T035 | Independent checks in different workspaces. |

Nothing runs in parallel *across* stories, because each story edits the same service, controller, API and test files.

---

## Parallel Example: User Story 1

```bash
# Write the story's two backend test files together:
Task: "Extend describe('createHabit') in backend/src/__tests__/unit/services/HabitService.test.ts per T016"
Task: "Extend describe('createHabit') in backend/src/__tests__/unit/controllers/HabitController.test.ts per T017"
```

## Parallel Example: Foundational

```bash
Task: "Add period helper tests to frontend/src/__tests__/unit/utils/habitFields.test.ts per T004"
Task: "Write frontend/src/__tests__/unit/components/HabitPeriodInput.test.tsx per T006"
```

---

## Implementation Strategy

### MVP (Phases 1 to 4)

1. Setup, then Foundational (migration, helpers, input).
2. US2: the period in responses and on the list, then the 🛑 US2 story checkpoint. The user may validate with Prisma Studio seed data.
3. US1: the period on create, then the 🛑 US1 story checkpoint. This is the MVP: the user can create habits with periods and see them, and may validate with quickstart scenarios 1 to 9.

### Incremental Delivery

1. Add US3 (update), then the 🛑 US3 story checkpoint. The user may validate with scenarios 10 to 14.
2. Polish, then the 🛑 final check (T037: the full quickstart pass by the user), then commit (T038).

---

## Notes

- The only stops are the three 🛑 story checkpoints and the 🛑 final check (T037). Each needs the user's explicit go-ahead; approving one never approves the next (Principle VII).
- Tests are written before the code they cover but are not sent for review. A failing task still stops the run.
- Error messages and limits quoted here come from [data-model.md](data-model.md) and [contracts/](contracts/). Keep them exact, because the tests assert on the strings.
- No e2e tests (Principle II). Wiring is checked with curl and by hand.
- No commits before T038, and no branch operations at any point.
