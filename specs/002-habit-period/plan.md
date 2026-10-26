# Implementation Plan: Habit Period

**Date**: 2026-10-14 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-habit-period/spec.md`, plus the user's planning notes (data model, per-endpoint service checks, controller codes, frontend steps).

## Summary

Adds an optional **period** to habits: one of Daily, Weekly, Monthly, Yearly, a custom number of hours, or none (one-time).

- **Backend**: one Prisma enum and two nullable columns (`periodPreset`, `periodHours`, at most one set) behind a single `period` field in every request and response. `HabitService` validates and maps it; `HabitController` forwards it. Routes don't change.
- **Frontend**: `HabitResponse` gains `period`; a new shared `HabitPeriodInput` (select + "Hours" field for Custom); a fourth creation step; a Period section on the update page; the period label on each list item.

Design decisions are in [research.md](research.md).

## Decisions from plan review (2026-10-14, revised 2026-10-15)

1. **Custom hours** (revised 2026-10-15): fractions allowed, from 1 to 8,766 h. Anything under 1 hour, including 0, is rejected; a user who wants no repeats chooses None. An empty Custom field still means one-time (spec FR-002). The spec was updated to match (FR-002, FR-004, FR-005, Edge Cases).
2. **No "empty or 0" note**: dropped along with the 0-means-one-time rule.
3. **Status codes**: unchanged. 404 stays "habit not found" for get/update/delete; an unreachable server has no status code and is already shown as an error by the page (research P7).
4. **Storage**: two typed columns behind the single `period` field (research P1).
5. **Controllers**: status codes unchanged, but `period` is added to the fields they forward to the service.

## Technical Context

**Language/Version**: TypeScript ~6.0, Node (ESM) backend; React 19 frontend.

**Primary Dependencies**: Express 5, Prisma 7 (`@prisma/adapter-pg`); Vite 8, React Router 7. Nothing new.

**Storage**: PostgreSQL via Prisma. One new enum `HabitPeriod`, two nullable columns on `Habit`.

**Testing**: Vitest in both workspaces; Prisma deep-mocked on the backend, `src/apis/*` mocked on the frontend. Unit tests only (Principle II).

**Target Platform**: Desktop browser; Node API on localhost:3000.

**Project Type**: Web application, two independent npm workspaces.

**Performance Goals**: Unchanged from Habit Blocks (≤100 habits listed within 2 s).

**Constraints**: Custom period from 1 to 8,766 hours, fractions allowed. Period independent of duration (spec FR-014).

**Scale/Scope**: No new endpoints. One migration, one new component, changes to one service, one controller, one API wrapper, one utility module, three pages/components.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | How this plan complies |
|-----------|--------|------------------------|
| I. Layered backend | ✅ Pass | Validation and row → response mapping live in `HabitService`. The controller only adds `period` to the fields it forwards. Status codes unchanged. |
| II. Test-first unit tests, no e2e | ✅ Pass | Period cases are added to `HabitService.test.ts` and `HabitController.test.ts` before the code; frontend units get tests first. No e2e. |
| III. Migration-driven schema | ✅ Pass | `npx prisma migrate dev --name add_habit_period_preset_or_hours`. The at-most-one invariant is named in the migration and enforced by `validatePeriod` always writing both columns. |
| IV. Frontend reuse | ✅ Pass | All calls go through `HabitApi.ts`. One shared `HabitPeriodInput` serves create and edit, like `HabitDurationInput`. |
| V. Simplicity and documentation | ✅ Pass | One private mapper (five callers) and one validator; no other new abstraction. New exports get purpose comments. |
| VI. Secrets hygiene | ✅ Pass | No new config or credentials. |
| VII. Plan and test checkpoints | ✅ Pass | This plan awaits approval. Each story's backend tests and each frontend unit's tests are a separate 🛑 review. |
| Development workflow order | ✅ Pass | Stories built one at a time, backend green before frontend. Foundational holds only what more than one story uses. |

**Post-design re-check**: All gates still pass. The two-column storage is the simplest design that keeps database typing (research P1); the mapper is shared by five functions.

## Build Order (per constitution Development Workflow)

Each 🛑 is a separate review that must be approved before the code it covers is written. All unit tests stay green before the next story starts.

**Setup**

1. `npm test` in both workspaces for a green baseline.

**Foundational** (used by more than one story)

1. Schema: enum + two columns, `npx prisma migrate dev --name add_habit_period_preset_or_hours` → [data-model.md](data-model.md). Every story reads or writes them.
2. `habitFields.ts` period helpers: tests 🛑, then implementation. `formatPeriod` is used by US1 and US2; `parsePeriod` by US1 and US3; `periodToFields` by US3.
3. `HabitPeriodInput` (select plus conditional Hours field): tests 🛑, then implementation. Used by US1 and US3.

**US2: See each habit's period** (P1, built first because the list is where create starts and ends, as in Habit Blocks)

| Step | Work |
|------|------|
| Backend tests 🛑 | `getHabits` returns `period` for each kind of row: both null → `null`, a preset, custom hours; the raw columns are not in the response |
| Backend | `HabitResponse` type, private `toHabitResponse`, applied in `getHabits`. Controller unchanged |
| API | `HabitResponse` gains `period`; existing test fixtures gain `period: null` |
| Frontend | `HabitItem` tests (period label for each kind) 🛑, then implementation |

**US1: Set a period when creating** (P1)

| Step | Work |
|------|------|
| Backend tests 🛑 | `createHabit`: missing/`null` → one-time; each preset; fractional hours; exactly 1 and 8766 accepted; 0, 0.5, negative, > 8766, numeric string, unknown name, wrong type → messages in [data-model.md](data-model.md); check order; controller forwards `period` |
| Backend | `validatePeriod`, used in `createHabit` with the mapper; controller adds `period` to the forwarded fields |
| API | `createHabit` payload gains `period` |
| Frontend | `HabitCreate` tests (4 steps, period step default, validation, Back keeps choice, review row, payload) 🛑, then implementation |

**US3: Change the period on the update page** (P2)

| Step | Work |
|------|------|
| Backend tests 🛑 | `updateHabit`: absent → unchanged; `null` → both cleared; preset clears hours; number clears preset; invalid → 400 and no update; 404 before period check. `getHabit` and `deleteHabit` return `period`. Controller forwards `period` only when present |
| Backend | `validatePeriod` in `updateHabit`; mapper in `getHabit`, `updateHabit`, `deleteHabit`; `"period"` added to the controller whitelist |
| API | `updateHabit` payload gains `period?` |
| Frontend | `HabitEdit` tests (prefill from `period`, change and save, None or Custom empty → `null`, invalid hours blocks save) 🛑, then implementation |

**Polish**: lint, build and `format:check` in both workspaces; update `CLAUDE.md` (Habit fields and the period limits mirrored in `habitFields.ts`); the user runs [quickstart.md](quickstart.md) by hand; then commit.

## Project Structure

### Documentation (this feature)

```text
specs/002-habit-period/
├── plan.md              # This file
├── research.md          # Phase 0: decisions P1 to P10
├── data-model.md        # Phase 1: schema change, period validation
├── quickstart.md        # Phase 1: manual and automated checks
├── contracts/
│   ├── habits-api.md    # Phase 1: API and service changes
│   └── ui.md            # Phase 1: component/page changes
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 (/speckit-tasks; not created here)
```

### Source Code (repository root)

```text
backend/
├── prisma/
│   ├── schema.prisma                                        # + enum HabitPeriod, periodPreset, periodHours
│   └── migrations/<timestamp>_add_habit_period_preset_or_hours/   # generated
└── src/
    ├── controllers/HabitController.ts                       # forward `period`
    ├── services/HabitService.ts                             # validatePeriod, toHabitResponse, HabitResponse
    └── __tests__/unit/
        ├── services/HabitService.test.ts                    # + period cases
        └── controllers/HabitController.test.ts              # + period forwarding

frontend/src/
├── apis/HabitApi.ts                                         # + re-exported HabitPeriodValue, period on response/payloads
├── utils/habitFields.ts                                     # + period helpers
├── components/
│   ├── HabitPeriodInput.tsx + HabitPeriodInput.css          # new
│   └── HabitItem.tsx + HabitItem.css                        # + period label
├── pages/
│   ├── HabitCreate.tsx                                      # + period step (4 steps)
│   └── HabitEdit.tsx                                        # + Period section
└── __tests__/unit/
    ├── utils/habitFields.test.ts                            # + period helpers
    ├── components/HabitPeriodInput.test.tsx                 # new
    ├── components/HabitItem.test.tsx                        # + period
    └── pages/HabitCreate.test.tsx, HabitEdit.test.tsx, HabitList.test.tsx   # + period (HabitList: fixtures only)
```

**Structure Decision**: Existing two-workspace layout; every change extends a Habit Blocks file except the new `HabitPeriodInput`. `HabitRoute.ts` and `index.ts` are unchanged.

## Complexity Tracking

No constitution violations to justify.
