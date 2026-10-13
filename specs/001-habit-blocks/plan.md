# Implementation Plan: Habit Blocks

**Branch**: `001-habit-blocks` (created at the start of implementation) | **Base Branch**: `roadmap_creation` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-habit-blocks/spec.md`, plus the user's planning notes (schema, service checks, routes, required UI components).

## Summary

This feature adds a standalone `Habit` resource: a name, an optional short description, and a length of time in minutes. It supports create, read, update and delete.

- **Backend**: one new Prisma model, plus `HabitService` → `HabitController` → `HabitRoute` following the existing Map/ObjectiveEdge layering. The routes are wired into `index.ts`.
- **Frontend**:
  - three routes (`/habits`, `/habits/new`, `/habits/:habitId`)
  - a three-step creation flow kept in a single page's state
  - an update page with inline delete confirmation
  - two shared components (`HabitItem`, `HabitDurationInput`)
  - a small validation/formatting utility module
  - all styled like the existing map pages.

Design decisions are in [research.md](research.md).

## Technical Context

**Language/Version**: TypeScript ~6.0, Node (ESM) on the backend; React 19 on the frontend.

**Primary Dependencies**:

- Backend: Express 5, Prisma 7 (`@prisma/adapter-pg`).
- Frontend: Vite 8, React Router 7.
- Nothing new is added.

**Storage**: PostgreSQL through Prisma. One new table, `Habit`.

**Testing**: Vitest in both workspaces.

- Backend: `vitest-mock-extended` deep-mocks Prisma.
- Frontend: jsdom and React Testing Library, with `src/apis/*` mocked.
- Unit tests only (Principle II).

**Target Platform**: Desktop browser; Node API on localhost:3000.

**Project Type**: Web application with two independent npm workspaces, `backend/` and `frontend/`.

**Performance Goals**: The habits page lists up to 100 habits within 2 seconds of opening (SC-006). Trivial at this scale.

**Constraints**: One user, no authentication. Name ≤ 100 characters, description ≤ 280 characters, duration 1 to 1440 whole minutes.

**Scale/Scope**: Tens to around 100 habits. Five endpoints, three pages, two shared components, one utility module.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How this plan complies |
|-----------|--------|------------------------|
| I. Layered backend | ✅ Pass | `HabitRoute` → `HabitController` → `HabitService` → `prisma` singleton. All validation lives in the service. The controller maps `"habit not found"` → 404, any other `Error` → 400, anything else → 500. Create returns 201. |
| II. Test-first unit tests, no e2e | ✅ Pass | `HabitService.test.ts` (mocked Prisma) and `HabitController.test.ts` (mocked service) are written first. Each frontend page/component/utility has a unit test with `HabitApi` mocked. No e2e. |
| III. Migration-driven schema | ✅ Pass | `npx prisma migrate dev --name add_habit`, then `npx prisma generate`. No DAG relation or both-or-neither pair, so there is no invariant to name. |
| IV. Frontend reuse | ✅ Pass | All calls go through the new `src/apis/HabitApi.ts`, which follows the `MapApi.ts` error convention. `ObjectiveSidebarShell` doesn't apply because these are not objective sidebars. The shared `HabitDurationInput` and `habitFields.ts` avoid duplicating logic across the create and edit pages. |
| V. Simplicity and documentation | ✅ Pass | No `createdAt` column: `id` order is creation order (research R3). No routes per step (R6). No "at least one field" rule on PATCH (R4). Shared helpers exist only where there are already two or more users (R9). Exported functions get purpose comments. |
| VI. Secrets hygiene | ✅ Pass | No new configuration or credentials. |
| VII. Plan and test checkpoints | ✅ Pass | This plan is presented for approval. Each user story's backend tests get one review of their own (🛑). So does each frontend unit's tests, including the shared Foundational units. Nothing is implemented until that specific review is approved. |
| Development workflow order | ✅ Pass | Stories are built one at a time in the order US2 → US1 → US3 → US4. US2 and US1 are both P1; US2 goes first because the list page is where creation starts and ends. Each story is a full vertical slice, and its backend layers are green before its frontend starts. Foundational holds only what more than one story uses. See the build order below. |
| Feature branch | ✅ Pass | At the start of implementation, `001-habit-blocks` is created off **`roadmap_creation`**, the base branch named in the header, and checked out before any file changes. If it already exists, implementation stops and asks. It is committed only after the user's manual check. |

**Post-design re-check (after Phase 1, re-done 2026-10-13 against constitution 4.1.0)**: All gates pass. The design itself (data model, contracts and UI) is unchanged by the amendments; only the build order and branch handling were updated. The design adds no abstraction beyond those justified in research R9, so Complexity Tracking is empty.

## Build Order (per constitution Development Workflow)

Each story is a vertical slice, built in this fixed order. Steps a story doesn't need are skipped.

1. Backend unit tests 🛑
2. Service, then controller
3. Route + `index.ts` wiring
4. `HabitApi.ts` additions
5. Frontend test → 🛑 → implementation pairs
6. `App.tsx` route

Every 🛑 is a separate review that must be approved before the code it covers is written. All unit tests, including earlier stories', must be green before the next story starts. Later stories add to the files earlier stories created.

**Setup**

1. Create branch `001-habit-blocks` off `roadmap_creation` and check it out. State the base to the user. Stop and ask if the branch already exists.
2. Run `npm test` in both workspaces to confirm a green baseline.

**Foundational**: only what more than one story uses.

1. Schema: add `model Habit` to `schema.prisma`, then run `npx prisma migrate dev --name add_habit` → [data-model.md](data-model.md). Every story reads or writes this table.
2. `src/utils/habitFields.ts`: tests 🛑, then implementation.
   - `formatDuration` is used by US1, US2 and US3.
   - The validators and `parseDuration`/`splitDuration` are used by US1 and US3.
3. `src/components/HabitDurationInput.tsx`: tests 🛑, then implementation. Used by US1 and US3.

**US2: View** (P1)

| Step | Work |
|------|------|
| Backend tests 🛑 | `getHabits` cases in a new `HabitService.test.ts` and `HabitController.test.ts`: sorted by name ignoring case, ties in id order, `[]` when empty, and 200/400/500 |
| Backend | `HabitService.getHabits`, then `HabitController.getHabits`. Create `HabitRoute.ts` with `GET /habits`, then add `app.use(habitRoutes)` to `index.ts` |
| API | Create `HabitApi.ts` with `HabitResponse` and `getHabits` |
| Frontend | `HabitItem` tests 🛑 then implementation; `HabitList` tests 🛑 then implementation; then the `/habits` route |

**US1: Create** (P1)

| Step | Work |
|------|------|
| Backend tests 🛑 | `createHabit` cases added to both test files: every name, description and durationMinutes rule and message in [data-model.md](data-model.md), check order, and 201/400/500 |
| Backend | `createHabit` with the shared private validators, then the controller. Add `POST /habits` |
| API | Add `createHabit` to `HabitApi.ts` |
| Frontend | `HabitCreate` tests 🛑 then implementation, plus the shared `HabitForm.css`; then the `/habits/new` route |

**US3: Update** (P2)

| Step | Work |
|------|------|
| Backend tests 🛑 | `getHabit` and `updateHabit` cases: invalid id → 400, missing → 404 before field checks, partial updates, `description: null` clears it, and the same field messages as create |
| Backend | `getHabit` and `updateHabit`, reusing US1's validators, then the controller. Add `GET /habits/:id` and `PATCH /habits/:id` |
| API | Add `getHabit` and `updateHabit` |
| Frontend | `HabitEdit` tests (load, not found, error, save, validation, cancel) 🛑 then implementation; then the `/habits/:habitId` route |

**US4: Delete** (P3)

| Step | Work |
|------|------|
| Backend tests 🛑 | `deleteHabit` cases: invalid id → 400, missing → 404 with `delete` not called, success → 200 returning the deleted habit |
| Backend | `deleteHabit` service and controller. Add `DELETE /habits/:id` |
| API | Add `deleteHabit` |
| Frontend | `HabitEdit` delete tests (inline confirm, cancel, confirm, failure) 🛑, then the delete section in `HabitEdit.tsx` |

**Polish**: lint, build and `format:check` in both workspaces; update `CLAUDE.md`; the user runs [quickstart.md](quickstart.md) by hand; then commit on `001-habit-blocks`.

Full route table, once all stories are done:

| Route | Handler | Story |
|-------|---------|-------|
| `GET /habits` | `getHabits` | US2 |
| `POST /habits` | `createHabit` | US1 |
| `GET /habits/:id` | `getHabit` | US3 |
| `PATCH /habits/:id` | `updateHabit` | US3 |
| `DELETE /habits/:id` | `deleteHabit` | US4 |

`App.tsx` route wiring is checked by hand only, matching the existing `App.tsx`, which has no test. UI behaviour is specified in [contracts/ui.md](contracts/ui.md). Manual verification follows [quickstart.md](quickstart.md).

**Independent test data**: US2 is built before the create endpoint exists, so its manual check seeds habits with `npx prisma studio` in `backend/` instead of `curl -X POST`.

## Project Structure

### Documentation (this feature)

```text
specs/001-habit-blocks/
├── plan.md              # This file
├── research.md          # Phase 0: design decisions R1 to R10
├── data-model.md        # Phase 1: Habit entity and validation table
├── quickstart.md        # Phase 1: manual and automated validation guide
├── contracts/
│   ├── habits-api.md    # Phase 1: HTTP endpoints, service signatures, API wrapper
│   └── ui.md            # Phase 1: routes, pages, components, utilities
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   ├── schema.prisma                       # + model Habit
│   └── migrations/<timestamp>_add_habit/   # generated by prisma migrate dev
└── src/
    ├── index.ts                            # + app.use(habitRoutes)
    ├── routes/HabitRoute.ts                # new
    ├── controllers/HabitController.ts      # new
    ├── services/HabitService.ts            # new
    └── __tests__/unit/
        ├── services/HabitService.test.ts       # new
        └── controllers/HabitController.test.ts # new

frontend/src/
├── App.tsx                                 # + /habits, /habits/new, /habits/:habitId
├── apis/HabitApi.ts                        # new
├── utils/habitFields.ts                    # new (first file in utils/)
├── components/
│   ├── HabitItem.tsx + HabitItem.css                     # new
│   └── HabitDurationInput.tsx + HabitDurationInput.css   # new
├── pages/
│   ├── HabitList.tsx + HabitList.css       # new
│   ├── HabitCreate.tsx                     # new
│   ├── HabitEdit.tsx                       # new
│   └── HabitForm.css                       # new, shared by HabitCreate and HabitEdit
└── __tests__/unit/
    ├── utils/habitFields.test.ts           # new
    ├── components/HabitItem.test.tsx, HabitDurationInput.test.tsx   # new
    └── pages/HabitList.test.tsx, HabitCreate.test.tsx, HabitEdit.test.tsx  # new
```

**Structure Decision**: Use the existing two-workspace web-app layout. Every new file follows the per-resource naming already used for Map/Objective/ObjectiveEdge. `frontend/src/utils/` is new, because the shared validators and formatters aren't components or API wrappers.

## Complexity Tracking

No constitution violations to justify.
