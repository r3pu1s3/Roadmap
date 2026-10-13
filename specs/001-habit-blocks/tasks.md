---

description: "Task list for Habit Blocks"
---

# Tasks: Habit Blocks

**Input**: Design documents from `/specs/001-habit-blocks/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/habits-api.md](contracts/habits-api.md), [contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md)

**Tests**: Required. Constitution Principle II requires unit tests to be written before the code they cover. Principle VII requires each test review to be **approved by the user before implementation**. Lines marked **🛑 Checkpoint** are hard stops: nothing past them may start until the user explicitly approves that specific review. Approving one review never approves the next.

**Organization**: Spec Kit default, as required by constitution 4.1.0 (Development Workflow). Each user story is a vertical slice built in this fixed order:

1. Backend tests 🛑
2. Service, then controller
3. Route + `index.ts` wiring
4. `HabitApi.ts` additions
5. Frontend test 🛑 → implementation pairs
6. `App.tsx` route

A story's backend must be green before its frontend starts. All unit tests, including earlier stories', must be green before the next story starts. Foundational contains only what more than one story uses.

**Story order**: US2 (View, P1) → US1 (Create, P1) → US3 (Update, P2) → US4 (Delete, P3). US2 and US1 have the same priority. US2 goes first because the list page is where the creation flow starts and where a created habit appears.

**Growing files**: `HabitService.ts`, `HabitController.ts`, `HabitRoute.ts`, `HabitApi.ts`, both backend test files, `HabitEdit.tsx`/`.test.tsx`, and `App.tsx` are created by the first story that needs them. Later stories add to them. Tasks that touch the same file are therefore never parallel across stories.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on unfinished tasks)
- **[Story]**: US1 to US4 from spec.md
- Paths are relative to the repository root

---

## Phase 1: Setup

**Purpose**: Create the feature branch and confirm a green baseline (constitution: Development Workflow, feature branch rule).

- [ ] T001 Create the feature branch:
  1. Run `git branch --list 001-habit-blocks`. If it prints anything, **stop and ask the user** whether to reuse that branch or choose another name. Never reuse or overwrite it silently.
  2. Otherwise, run `git switch -c 001-habit-blocks roadmap_creation`. `roadmap_creation` is the base branch named in [plan.md](plan.md).
  3. Tell the user: "Created `001-habit-blocks` off `roadmap_creation`."

  The uncommitted `specs/001-habit-blocks/` files and the `.specify/memory/constitution.md` amendment carry over to the new branch unchanged. Do not commit anything here.
- [ ] T002 Run `npm test` in `backend/` and in `frontend/`. Both must pass before any change. If tests already fail, report them to the user rather than fixing them in this feature.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The pieces more than one story uses:

| Piece | Used by |
|-------|---------|
| The `Habit` table | Every story |
| `habitFields.ts` | `formatDuration` in US1, US2 and US3; the validators in US1 and US3 |
| `HabitDurationInput` | US1 and US3 |

**⚠️ CRITICAL**: No user story can start until this phase is complete.

- [ ] T003 Add `model Habit` to `backend/prisma/schema.prisma`, after `ObjectiveCounter`. Fields exactly:
  - `id Int @id @default(autoincrement())`
  - `name String`
  - `description String?`
  - `durationMinutes Int`

  Add no relations, because the habit is standalone (FR-020). Add a short comment above the model saying the limits (name "≤ 100 characters", description "≤ 280 characters", durationMinutes "1 ≤ value ≤ 1440") are enforced in `HabitService`, not in the database.
- [ ] T004 In `backend/`, run `npx prisma migrate dev --name add_habit`. This creates `backend/prisma/migrations/<timestamp>_add_habit/` and regenerates `backend/src/generated/prisma`. Do not hand-edit the generated migration (Principle III). Confirm that `npm test` and `npm run build` in `backend/` still pass.
- [ ] T005 [P] Write `frontend/src/__tests__/unit/utils/habitFields.test.ts` for the utilities in [contracts/ui.md](contracts/ui.md):
  - **`validateName`**: `""` or `"   "` → "Name is required"; 101 characters → "Name must be 100 characters or fewer"; 100 characters → `null`.
  - **`validateDescription`**: `""` → `null`; 281 characters → "Description must be 280 characters or fewer"; 280 characters → `null`.
  - **`parseDuration(hours, minutes)`**:
    - `("1","15")` → `{ minutes: 75 }`
    - `("","45")` → `{ minutes: 45 }`
    - `("2","")` → `{ minutes: 120 }`
    - `("","")` and `("0","0")` → "Length of time must be at least 1 minute"
    - `("-1","0")` and `("1.5","0")` → "Hours and minutes must be whole numbers"
    - `("0","60")` → "Minutes must be between 0 and 59"
    - `("25","0")` and `("24","1")` → "Length of time must be 24 hours or less"
    - `("24","0")` → `{ minutes: 1440 }`
  - **`formatDuration`**: 45 → "45 min"; 60 → "1 h"; 75 → "1 h 15 min"; 1440 → "24 h".
  - **`splitDuration`**: 75 → `{ hours: 1, minutes: 15 }`; 45 → `{ hours: 0, minutes: 45 }`.

**🛑 Checkpoint (habitFields tests)**: Present T005 to the user with its failing run. Do not start T006 until the user approves.

- [ ] T006 Implement `frontend/src/utils/habitFields.ts`:
  - Export `NAME_CHAR_LIMIT = 100`, `DESCRIPTION_CHAR_LIMIT = 280` and `MAX_DURATION_MINUTES = 1440`, with a comment that they mirror `HabitService` and are kept in sync by hand, like `NAME_WORD_LIMIT` in `MapForm.tsx`.
  - Export the five pure functions, each with a purpose comment (Principle V).
  - Iterate until T005 passes.
- [ ] T007 [P] Write `frontend/src/__tests__/unit/components/HabitDurationInput.test.tsx`:
  - It renders two number inputs, labelled "Hours" and "Minutes", showing the `hours` and `minutes` props.
  - Typing in Hours calls `onChange({ hours: <new>, minutes: <unchanged> })`, and the same for Minutes.
  - It keeps no state of its own: re-rendering with new props updates the values shown.

**🛑 Checkpoint (HabitDurationInput tests)**: Present T007 to the user. Do not start T008 until the user approves.

- [ ] T008 Implement `frontend/src/components/HabitDurationInput.tsx` and `frontend/src/components/HabitDurationInput.css`:
  - It is a controlled component with props `{ hours: string; minutes: string; onChange(next: { hours: string; minutes: string }): void }`.
  - Style the inputs like `.map-form-input`: background `#0f0f0f`, border `#333`, focus border `#6366f1`.
  - Iterate until T007 passes.

**Checkpoint**: The schema is migrated and the shared utilities are ready. Every frontend unit test is green.

---

## Phase 3: User Story 2 - View all habit blocks (Priority: P1)

**Goal**: `GET /habits` returns habits sorted alphabetically. The `/habits` page lists them as blocks showing name and length of time, with loading, empty and error states and a "+ New Habit" link.

**Independent Test**: The create endpoint doesn't exist yet at this point.
1. Run `npx prisma studio` in `backend/` and add habits named "banana", "Apple" and "apple" with any durations.
2. Open `/habits`. They appear in the order Apple, apple, banana, each showing its formatted length.
3. Delete them in Prisma Studio and reload: the empty-state message appears.
4. Stop the backend and reload: an error message appears.

### Backend tests for User Story 2 ⚠️

- [ ] T009 [P] [US2] Create `backend/src/__tests__/unit/services/HabitService.test.ts` with a `describe("getHabits")` block. Follow `MapService.test.ts`: `vi.mock("../../../lib/prisma")` and `prisma.habit.findMany.mockResolvedValue`. Cover:
  - It calls `findMany` with `orderBy: { id: "asc" }`.
  - It returns the habits sorted by name, ignoring upper/lower case. Input ids 1 "banana", 2 "Apple", 3 "apple" → output ids 2, 3, 1 (same names stay in id order).
  - It returns `[]` when there are none.
- [ ] T010 [P] [US2] Create `backend/src/__tests__/unit/controllers/HabitController.test.ts` with a `describe("getHabits")` block. Follow `MapController.test.ts` and `vi.mock` `../../../services/HabitService`. Cover:
  - 200 with the service result.
  - A service `Error` → 400 `{ error: message }`.
  - A thrown non-`Error` → 500 `{ error: "failed to get habits" }`.

**🛑 Checkpoint (US2 backend tests)**: Present T009 and T010 together with their failing run. Do not start T011 until the user approves.

### Backend implementation for User Story 2

- [ ] T011 [US2] Create `backend/src/services/HabitService.ts` with `getHabits(): Promise<Habit[]>`:
  - Call `prisma.habit.findMany({ orderBy: { id: "asc" } })`, then sort in memory with `a.name.localeCompare(b.name, undefined, { sensitivity: "base" })`.
  - Add a comment explaining why: Prisma cannot sort case-insensitively, the sort is stable, and id order is creation order (research R3).
  - Use only the `prisma` singleton from `../lib/prisma`.
  - Iterate until T009 passes.
- [ ] T012 [US2] Create `backend/src/controllers/HabitController.ts` with `getHabits(_req, res)`, mirroring `MapController.getMaps`: 200 / 400 / 500 `"failed to get habits"`, with `console.error` before a 500. Iterate until T010 passes.
- [ ] T013 [US2] Create `backend/src/routes/HabitRoute.ts`: a `Router` with `router.get("/habits", getHabits)`, exported as default.
- [ ] T014 [US2] In `backend/src/index.ts`, import `habitRoutes from "./routes/HabitRoute"` and add `app.use(habitRoutes)` after `app.use(mapRoutes)`.
- [ ] T015 [US2] In `backend/`, run `npm test`, `npm run build` and `npm run lint`. All must pass. Then manually run `curl localhost:3000/habits` → `[]` with the dev server running.

### Frontend for User Story 2

- [ ] T016 [US2] Create `frontend/src/apis/HabitApi.ts`, following the shape of `MapApi.ts`:
  - Export `interface HabitResponse { id: number; name: string; description: string | null; durationMinutes: number }`, with `description` set to `null` when there isn't one.
  - Export `getHabits(): Promise<HabitResponse[]>`, using `API_BASE`. On a non-OK response it throws `new Error(body.error ?? \`Failed to load habits (${status})\`)`.
- [ ] T017 [P] [US2] Write `frontend/src/__tests__/unit/components/HabitItem.test.tsx`:
  - It renders the habit's name and `formatDuration(durationMinutes)`, e.g. 75 → "1 h 15 min".
  - It is a link whose `href` is `/habits/{id}`. Render it inside a `MemoryRouter`.

**🛑 Checkpoint (HabitItem tests)**: Present T017 to the user. Do not start T018 until the user approves.

- [ ] T018 [US2] Implement `frontend/src/components/HabitItem.tsx` and `frontend/src/components/HabitItem.css`:
  - Props `{ habit: HabitResponse }`.
  - Render `<Link to={\`/habits/${habit.id}\`}>` containing the name and the formatted duration.
  - Style it like `.map-menu-row`: `#171717` background, `#2e2e2e` border, hover border `#4d4d4d`. Cut long names off with `text-overflow: ellipsis`.
  - Iterate until T017 passes.
- [ ] T019 [US2] Write `frontend/src/__tests__/unit/pages/HabitList.test.tsx`. Mock `../../../apis/HabitApi`, following the style of `MapMenu.test.tsx`:
  - It shows "Loading habits…" while `getHabits` is pending.
  - It renders one `HabitItem` per habit, in the order the API returns them.
  - With `[]`, it shows "No habits yet — press + New Habit to create one."
  - On rejection, it shows the error message and no list.
  - The "+ New Habit" link (`aria-label="Create habit"`) points to `/habits/new`.

**🛑 Checkpoint (HabitList tests)**: Present T019 to the user. Do not start T020 until the user approves.

- [ ] T020 [US2] Implement `frontend/src/pages/HabitList.tsx` and `frontend/src/pages/HabitList.css`:
  - Mirror the `LoadState` pattern in `MapMenu.tsx`, including the cancelled flag in `useEffect`.
  - Header: "Habits" title and the "+ New Habit" link.
  - Copy the CSS values from `MapMenu.css` with a `habit-list-` prefix: page background `#0a0a0a`, 560px column, button `#6366f1`.
  - Iterate until T019 passes.
- [ ] T021 [US2] In `frontend/src/App.tsx`, import `HabitList` and add `<Route path="/habits" element={<HabitList />} />`. Run `npm test` in both workspaces: all green.

**Checkpoint**: US2 works on its own. Run its Independent Test above.

---

## Phase 4: User Story 1 - Create a habit block (Priority: P1) 🎯 MVP

**Goal**: `POST /habits` with full validation. "+ New Habit" opens a three-step flow (Details → Length of time → Review) that saves the habit and returns to `/habits`.

**Independent Test**: From an empty `/habits`, press "+ New Habit" and complete all three steps. The habit appears on `/habits` and is still there after a reload. See [quickstart.md](quickstart.md) scenarios 1 to 6 and 13.

### Backend tests for User Story 1 ⚠️

- [ ] T022 [P] [US1] Add a `describe("createHabit")` block to `backend/src/__tests__/unit/services/HabitService.test.ts`. Error messages must match [data-model.md](data-model.md) exactly. Cover:
  - **name**:
    - missing or `null` → `"name is required"`
    - `42` → `"name must be a string"`
    - `""` or `"   "` → `"name is required"`
    - 101 characters → `"name must be 100 characters or fewer (got 101)"`
    - exactly 100 characters is allowed
    - the name is trimmed before `prisma.habit.create`
  - **description**:
    - omitted, `null`, or `"   "` → saved as `null`
    - `42` → `"description must be a string"`
    - 281 characters → `"description must be 280 characters or fewer (got 281)"`
    - exactly 280 characters is allowed
    - the description is trimmed
  - **durationMinutes**:
    - missing or `null` → `"durationMinutes is required"`
    - `"30"`, `1.5`, or `NaN` → `"durationMinutes must be a whole number"`
    - `0`, `-5`, or `1441` → `"durationMinutes must be between 1 and 1440"`
    - `1` and `1440` are allowed
  - **check order**: with both the name and durationMinutes invalid, the name error is thrown. `prisma.habit.create` is not called when any check fails.
- [ ] T023 [P] [US1] Add a `describe("createHabit")` block to `backend/src/__tests__/unit/controllers/HabitController.test.ts`:
  - 201 with the created habit.
  - It forwards only `name`, `description` and `durationMinutes` from `req.body`, so extra keys are dropped.
  - A service `Error` → 400.
  - A non-`Error` → 500 `"failed to create habit"`.

**🛑 Checkpoint (US1 backend tests)**: Present T022 and T023 together with their failing run. Do not start T024 until the user approves.

### Backend implementation for User Story 1

- [ ] T024 [US1] In `backend/src/services/HabitService.ts`:
  - Add the constants `NAME_CHAR_LIMIT = 100`, `DESCRIPTION_CHAR_LIMIT = 280`, `MIN_DURATION_MINUTES = 1` and `MAX_DURATION_MINUTES = 1440`.
  - Add private validators `validateName`, `validateDescription` (returns the trimmed string, or `null`) and `validateDurationMinutes`. US3 reuses them.
  - Add `createHabit(data: { name: unknown; description?: unknown; durationMinutes: unknown })`. Inputs are typed `unknown` because the service does the runtime type checks (research R5).
  - Give exported functions purpose comments.
  - Iterate until T022 and every earlier test pass.
- [ ] T025 [US1] In `backend/src/controllers/HabitController.ts`, add `createHabit`, mirroring `MapController.createMap` and returning 201. Iterate until T023 passes.
- [ ] T026 [US1] In `backend/src/routes/HabitRoute.ts`, add `router.post("/habits", createHabit)`.
- [ ] T027 [US1] In `backend/`, run `npm test`, `npm run build` and `npm run lint`: all green. Then check by hand:
  - `curl -X POST localhost:3000/habits -H "Content-Type: application/json" -d '{"name":"Run","durationMinutes":30}'` → 201.
  - The same request with `"durationMinutes":"30"` → 400 `durationMinutes must be a whole number`.

### Frontend for User Story 1

- [ ] T028 [US1] In `frontend/src/apis/HabitApi.ts`, add `createHabit(payload: { name: string; description: string | null; durationMinutes: number }): Promise<HabitResponse>`. It sends a POST with a JSON body and, on a non-OK response, throws `body.error ?? \`Failed to create habit (${status})\``.
- [ ] T029 [US1] Write `frontend/src/__tests__/unit/pages/HabitCreate.test.tsx`. Mock `HabitApi` and `useNavigate`. Cover:
  - **Step 1**: "Step 1 of 3" is shown with Name and Description fields. Next with an empty name shows "Name is required" and stays on step 1. A 101-character name shows "Name must be 100 characters or fewer". A 281-character description shows "Description must be 280 characters or fewer".
  - **Step 2**: a valid step 1 plus Next shows "Step 2 of 3" and `HabitDurationInput`. Next with 0 h 0 min shows "Length of time must be at least 1 minute" and stays on step 2.
  - **Back**: from step 3, Back twice returns to step 1 with the name, description and hours/minutes still filled in (FR-006).
  - **Step 3 (Review)**: shows the name, the description (or "No description" if empty) and the formatted length of time.
  - **Create habit**:
    - It calls `createHabit({ name: <trimmed>, description: <trimmed or null>, durationMinutes: <total> })`.
    - While pending, the button reads "Creating…" and is disabled, so a second click makes no second call.
    - On success it navigates to `/habits`.
    - On rejection it stays on step 3, shows the error message, and keeps the values.
  - **Cancel**: from any step, Cancel navigates to `/habits` immediately with no prompt, and `createHabit` is never called.

**🛑 Checkpoint (HabitCreate tests)**: Present T029 to the user. Do not start T030 until the user approves.

- [ ] T030 [US1] Implement `frontend/src/pages/HabitCreate.tsx` and the shared `frontend/src/pages/HabitForm.css`:
  - Keep the state on one page: `step` (1 to 3), `name`, `description`, `hours`, `minutes`, `stepError`, `saveError` and `isSaving` (research R6, R7).
  - Validate with the `habitFields` helpers. Render `HabitDurationInput` on step 2.
  - Base the card styling on `MapForm.css`, with a `habit-form-` prefix. Add a secondary button style for Back and Cancel, like `.map-menu-btn-secondary`.
  - Iterate until T029 passes.
- [ ] T031 [US1] In `frontend/src/App.tsx`, import `HabitCreate` and add `<Route path="/habits/new" element={<HabitCreate />} />`. React Router ranks the static `/habits/new` above a parameter route, so the order of routes doesn't matter. Run `npm test` in both workspaces: all green.

**Checkpoint**: US2 + US1 = MVP. Users can create habits and see them listed.

---

## Phase 5: User Story 3 - Update a habit block (Priority: P2)

**Goal**: `GET /habits/:id` and `PATCH /habits/:id`. Clicking a habit opens `/habits/:habitId` with Name, Description and Length-of-time sections. Save stores the changes and returns to `/habits`.

**Independent Test**: Click an existing habit, change its name and length of time, and Save. `/habits` shows the new values, and they are still there after a reload. Opening `/habits/999999` shows "Habit not found". See [quickstart.md](quickstart.md) scenarios 7, 8 and 11.

### Backend tests for User Story 3 ⚠️

- [ ] T032 [P] [US3] Add `describe("getHabit")` and `describe("updateHabit")` blocks to `backend/src/__tests__/unit/services/HabitService.test.ts`:
  - **getHabit**:
    - a non-integer id → `"id must be a valid integer"`
    - `findUnique` returns `null` → `"habit not found"`
    - otherwise returns the habit
  - **updateHabit**:
    - a non-integer id → `"id must be a valid integer"`
    - a missing habit → `"habit not found"`, checked before field validation: a missing habit plus an invalid name gives "habit not found"
    - only the fields that are present are validated and passed to `prisma.habit.update` in `data`
    - `description: null` and `description: "  "` both set the description to `null`
    - an invalid field that is present throws the same messages as `createHabit`
    - an empty body calls `update` with an empty `data` and returns the habit
- [ ] T033 [P] [US3] Add `describe("getHabit")` and `describe("updateHabit")` blocks to `backend/src/__tests__/unit/controllers/HabitController.test.ts`:
  - **Both**: pass `Number(req.params.id)` to the service. Return 200 on success, 404 for `"habit not found"`, 400 for any other `Error`, and 500 for a non-`Error` (`"failed to get habit"` / `"failed to update habit"`).
  - **updateHabit only**:
    - `"abc"` → 400 `"id must be a valid integer"` without calling the service
    - it forwards `{ id, name, description, durationMinutes }`, leaving out keys that aren't in the body

**🛑 Checkpoint (US3 backend tests)**: Present T032 and T033 together with their failing run. Do not start T034 until the user approves.

### Backend implementation for User Story 3

- [ ] T034 [US3] In `backend/src/services/HabitService.ts`, add `getHabit(id: number)` and `updateHabit(data: { id: number; name?: unknown; description?: unknown; durationMinutes?: unknown })`:
  - Check order: id integer → exists (`findUnique`) → fields present (research R4).
  - Reuse the US1 validators.
  - Iterate until T032 and every earlier test pass.
- [ ] T035 [US3] In `backend/src/controllers/HabitController.ts`, add `getHabit` (mirroring `getMap`) and `updateHabit` (mirroring `updateMap`, plus the partial-body forwarding). Iterate until T033 passes.
- [ ] T036 [US3] In `backend/src/routes/HabitRoute.ts`, add `router.get("/habits/:id", getHabit)` and `router.patch("/habits/:id", updateHabit)`.
- [ ] T037 [US3] In `backend/`, run `npm test`, `npm run build` and `npm run lint`: all green. Then check by hand:
  - `curl localhost:3000/habits/999999` → 404.
  - `curl -X PATCH localhost:3000/habits/abc -H "Content-Type: application/json" -d '{}'` → 400.

### Frontend for User Story 3

- [ ] T038 [US3] In `frontend/src/apis/HabitApi.ts`, add:
  - `getHabit(id: number): Promise<HabitResponse>`
  - `updateHabit(id: number, payload: { name?: string; description?: string | null; durationMinutes?: number }): Promise<HabitResponse>`, sent as PATCH

  Both throw on a non-OK response with `body.error`, falling back to `"Failed to load habit (status)"` and `"Failed to update habit (status)"`.
- [ ] T039 [US3] Write `frontend/src/__tests__/unit/pages/HabitEdit.test.tsx`. Mock `HabitApi`, render inside a `MemoryRouter` at `/habits/7` with `<Route path="/habits/:habitId">`, and mock `useNavigate`. Cover:
  - **Loading**: shows "Loading habit…" while `getHabit(7)` is pending.
  - **Loaded**: the Name, Description and "Length of time" section titles and fields are pre-filled. 75 minutes shows as hours "1" and minutes "15".
  - **Errors**:
    - A rejection with "habit not found" shows "Habit not found" and a link to `/habits`.
    - Any other rejection shows its message and a link to `/habits`.
  - **Save**:
    - It calls `updateHabit(7, { name, description, durationMinutes })`, with all three fields, trimmed, and an empty description sent as `null`.
    - While pending, it reads "Saving…" and is disabled.
    - On success it navigates to `/habits`.
  - **Validation**: Save with the name cleared shows "Name is required" and does not call `updateHabit`. An invalid duration shows the matching `parseDuration` message.
  - **Failure**: on an `updateHabit` rejection, the error is shown and the edits are kept.
  - **Cancel**: navigates to `/habits` with no prompt and does not call `updateHabit`.

**🛑 Checkpoint (HabitEdit update tests)**: Present T039 to the user. Do not start T040 until the user approves.

- [ ] T040 [US3] Implement `frontend/src/pages/HabitEdit.tsx` using `frontend/src/pages/HabitForm.css`:
  - Read `habitId` with `useParams` and load it through a `LoadState` with a `cancelled` guard.
  - Render the sections in this order: Name (title + input), Description (title + textarea), Length of time (title + `HabitDurationInput`, pre-filled with `splitDuration`), then Save and Cancel.
  - Iterate until T039 passes.
- [ ] T041 [US3] In `frontend/src/App.tsx`, import `HabitEdit` and add `<Route path="/habits/:habitId" element={<HabitEdit />} />`. Run `npm test` in both workspaces: all green.

**Checkpoint**: Updating works from start to finish, independently of delete.

---

## Phase 6: User Story 4 - Delete a habit block (Priority: P3)

**Goal**: `DELETE /habits/:id`. A "Delete habit" button at the very bottom of the update page confirms inline, then permanently deletes the habit and returns to `/habits`.

**Independent Test**: Open a habit, press "Delete habit", then Cancel: the habit is still there. Press it again and choose "Confirm delete": you are back on `/habits` and the habit is gone after a reload. See [quickstart.md](quickstart.md) scenarios 9 and 10.

### Backend tests for User Story 4 ⚠️

- [ ] T042 [P] [US4] Add a `describe("deleteHabit")` block to `backend/src/__tests__/unit/services/HabitService.test.ts`:
  - a non-integer id → `"id must be a valid integer"`
  - a missing habit → `"habit not found"`, and `delete` is not called
  - otherwise calls `prisma.habit.delete({ where: { id } })` and returns the deleted habit
- [ ] T043 [P] [US4] Add a `describe("deleteHabit")` block to `backend/src/__tests__/unit/controllers/HabitController.test.ts`:
  - 200 with the deleted habit
  - `"abc"` → 400 without calling the service
  - `"habit not found"` → 404
  - any other `Error` → 400
  - a non-`Error` → 500 `"failed to delete habit"`

  This mirrors `ObjectiveEdgeController.deleteObjectiveEdge`.

**🛑 Checkpoint (US4 backend tests)**: Present T042 and T043 together with their failing run. Do not start T044 until the user approves.

### Backend implementation for User Story 4

- [ ] T044 [US4] In `backend/src/services/HabitService.ts`, add `deleteHabit(id: number)`, mirroring `ObjectiveEdgeService.deleteObjectiveEdge`. Iterate until T042 and every earlier test pass.
- [ ] T045 [US4] In `backend/src/controllers/HabitController.ts`, add `deleteHabit`. Iterate until T043 passes.
- [ ] T046 [US4] In `backend/src/routes/HabitRoute.ts`, add `router.delete("/habits/:id", deleteHabit)`.
- [ ] T047 [US4] In `backend/`, run `npm test`, `npm run build` and `npm run lint`: all green.

### Frontend for User Story 4

- [ ] T048 [US4] In `frontend/src/apis/HabitApi.ts`, add `deleteHabit(id: number): Promise<HabitResponse>`, sent as DELETE. On a non-OK response it throws `body.error`, falling back to `"Failed to delete habit (status)"`.
- [ ] T049 [US4] Add a `describe("delete")` block to `frontend/src/__tests__/unit/pages/HabitEdit.test.tsx`:
  - "Delete habit" is the last button in the card, after Save and Cancel.
  - Clicking it shows "Delete this habit permanently?" with "Confirm delete" and "Cancel" buttons, and does not call `deleteHabit`.
  - Cancel hides the prompt and does not call `deleteHabit`.
  - "Confirm delete" calls `deleteHabit(7)`, then navigates to `/habits`.
  - On rejection, it shows the error, stays on the page, and does not navigate.

**🛑 Checkpoint (HabitEdit delete tests)**: Present T049 to the user. Do not start T050 until the user approves.

- [ ] T050 [US4] Add the delete section to `frontend/src/pages/HabitEdit.tsx`:
  - Add `isConfirmingDelete` and `isDeleting` state, a divider, the "Delete habit" button, and the inline confirm prompt (research R8).
  - Add the delete styles to `frontend/src/pages/HabitForm.css`, using the error colours: text `#f87171`, background `rgba(248, 113, 113, 0.08)`, border `rgba(248, 113, 113, 0.2)`.
  - Iterate until T049 and T039 both pass. Then run `npm test` in both workspaces: all green.

**Checkpoint**: All four user stories work.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T051 [P] In `frontend/`, run `npm test`, `npm run build`, `npm run lint` and `npm run format:check`. Fix only issues in this feature's files.
- [ ] T052 [P] In `backend/`, run `npm run format:check`. Fix only issues in this feature's files.
- [ ] T053 Update `CLAUDE.md`:
  - Add `Habit` to the resource list in "Backend: Route → Controller → Service → Prisma".
  - Describe `Habit` under "Data model" as standalone: name, optional description, `durationMinutes`.
  - Add `/habits`, `/habits/new` and `/habits/:habitId` to the frontend routing line, and `HabitApi.ts` to the API list.
  - Mention `src/utils/` as the place for shared, pure frontend helpers.
- [ ] T054 With both dev servers running, have the **user** go through scenarios 1 to 13 in `specs/001-habit-blocks/quickstart.md`. Optionally, to check SC-006, seed about 100 habits and confirm `/habits` loads in under 2 seconds. Report any failure back to the relevant task rather than patching ad hoc.
- [ ] T055 Only after the user confirms T054 passed:
  1. Review the staged files' contents (Principle VI: no `.env` or local configuration).
  2. Ask the user whether the pending constitution amendment in `.specify/memory/constitution.md` goes in this commit or a separate one. Its Sync Impact Report must be removed before it is committed.
  3. Commit on `001-habit-blocks` with a detailed message ending with the required co-author line.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none. T001 must run before any file changes.
- **Foundational (Phase 2)**: depends on Setup. **It blocks every story.**
- **US2 (Phase 3)**: depends on Phase 2. It creates the habit service, controller, route, API and test files.
- **US1 (Phase 4)**: depends on US2. It adds to US2's files, and creation starts from and returns to the list page.
- **US3 (Phase 5)**: depends on US1. It reuses US1's validators, and is reached by clicking a `HabitItem` from US2.
- **US4 (Phase 6)**: depends on US3. It adds to `HabitEdit.tsx` and its test file.
- **Polish (Phase 7)**: depends on every story. T055 needs the user's sign-off on T054.

### Within Each Story

Backend tests 🛑 → service → controller → route (→ `index.ts`, US2 only) → backend green → `HabitApi.ts` → each frontend unit: test 🛑 → implementation → `App.tsx` route → all tests green.

### Parallel Opportunities

| Tasks | Why they can run together |
|-------|---------------------------|
| T005 ∥ T007 | Independent Foundational test files. Each is still approved before its own implementation. |
| T009 ∥ T010, T022 ∥ T023, T032 ∥ T033, T042 ∥ T043 | Service and controller test files for the same story, presented together as that story's one backend review. |
| T017 can be drafted while T016 is written | It only needs the `HabitResponse` type. Units are still implemented one at a time. |
| T051 ∥ T052 | Independent checks in different workspaces. |

Nothing runs in parallel *across* stories, because every story adds to files the previous one created.

---

## Parallel Example: User Story 1

```bash
# Draft the story's two backend test files together, then present them as one review:
Task: "Add describe('createHabit') to backend/src/__tests__/unit/services/HabitService.test.ts per T022"
Task: "Add describe('createHabit') to backend/src/__tests__/unit/controllers/HabitController.test.ts per T023"
```

## Parallel Example: Foundational

```bash
Task: "Write frontend/src/__tests__/unit/utils/habitFields.test.ts per T005"
Task: "Write frontend/src/__tests__/unit/components/HabitDurationInput.test.tsx per T007"
```

---

## Implementation Strategy

### MVP (Phases 1 to 4)

1. Setup: the branch off `roadmap_creation`. Then Foundational.
2. US2: the list, end to end. Validate with Prisma Studio seed data.
3. US1: creation, end to end. **Stop and validate** with quickstart scenarios 1 to 6 and 13. At this point the user can create and see habits.

### Incremental Delivery

1. Add US3 (update), then validate scenarios 7, 8 and 11.
2. Add US4 (delete), then validate scenarios 9 and 10.
3. Polish, then the full quickstart pass by the user, then commit (T055).

---

## Notes

- 🛑 checkpoints need the user's explicit go-ahead for that step. Approving one never approves the next (Principle VII).
- The "**Checkpoint**" lines after each story are informational: tests must be green before the next story starts. They are **not** approval stops. No stop for the user to check each story by hand was requested.
- Error messages and limits quoted in the tasks come from `data-model.md` and `contracts/`. Keep them exact, because the tests assert on the strings.
- No e2e tests (Principle II). Route wiring is checked by curl and by hand.
- No commits before T055.
