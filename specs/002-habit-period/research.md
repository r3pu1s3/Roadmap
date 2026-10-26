# Research: Habit Period

Design decisions for [plan.md](plan.md). Decisions from Habit Blocks (`specs/001-habit-blocks/research.md`, R1 to R10) still apply unless one here replaces it.

## P1. Storage: two nullable columns behind one `period` field in the API

- **Decision**: Add two nullable columns to `Habit`:
  - `periodPreset HabitPeriod?`, where `enum HabitPeriod { daily weekly monthly yearly }`
  - `periodHours Float?`

  At most one of them is set. Both null means one-time. The API, the service's return type, and the frontend all see a single field, `period: "daily" | "weekly" | "monthly" | "yearly" | number | null`. The service translates between that field and the two columns.
- **Rationale**: The planning notes ask for a column holding "an enum or a number". PostgreSQL (and Prisma) can't type one column as an enum or a number. Two typed columns keep both halves checked by the database (the enum rejects unknown names; the float column only holds numbers). Collapsing them to one `period` field at the API keeps the shape the notes describe, and means a PATCH can never leave a habit with both a preset and custom hours.
- **Alternatives considered**:
  - One `String` column storing `"daily"` or `"36.5"`: no database checking, and every read must parse it.
  - One `Json` column: same problem, plus awkward Prisma typing for a scalar.
  - Exposing `periodPreset` and `periodHours` directly: every client would have to maintain the at-most-one rule, and the notes ask for a single `period`.

## P2. Monthly and Yearly are named periods, not hours

- **Decision**: Daily, Weekly, Monthly and Yearly are saved as enum values and never converted to hours.
- **Rationale**: Spec FR-012: Monthly and Yearly mean "the same date each calendar month/year", so their length varies. Keeping the name lets the later scheduling feature apply real calendar rules.

## P3. Custom hours: 1 to 8,766, fractions allowed

- **Decision**: A custom period is a finite number of hours from 1 to 8,766 (365.25 days), fractions allowed (e.g. 1.5) (spec FR-005). Anything under 1, including 0 and negatives, is rejected. One-time is only ever `null` (or an absent key on create). Numeric strings like `"36"` are rejected, not coerced, the same as `durationMinutes` (001 R5).
- **Rationale**: User decision on 2026-10-15: a user who wants no repeats chooses None, so 0 and sub-hour values have no use.

## P4. Check order and messages

- **Decision**: The service checks name → description → durationMinutes → period and throws the first failure. Period messages:
  - wrong type or unknown name: `period must be one of daily, weekly, monthly, yearly, or a number of hours`
  - under 1 (including 0 and negatives): `period must be at least 1 hour`
  - over the limit: `period must be 8766 hours or fewer`
- **Rationale**: Period goes at the end of the existing order, so existing tests keep their meaning.

## P5. PATCH behaviour for period

- **Decision**: Absent `period` key → both columns unchanged. `period: null` → both cleared. A preset → `periodPreset` set, `periodHours` cleared. A number → `periodHours` set, `periodPreset` cleared. The controller's list of forwarded keys gains `"period"`.
- **Rationale**: Follows the existing "absent vs. null" rule (001 R4) and the notes. Always writing both columns keeps the at-most-one rule without a separate check.

## P6. Mapping rows to responses

- **Decision**: A private `toHabitResponse(row)` in `HabitService.ts` turns a Prisma row into `{ id, name, description, durationMinutes, period }`. Every exported service function returns that shape. The two columns never appear in responses.
- **Rationale**: Five functions return habits, so one mapper avoids repeating the conversion (Principle V). Doing it in the service keeps the controller free of logic (Principle I).

## P7. Status codes are unchanged

- **Decision**: Controllers keep the current mapping: 201 for create, 200 otherwise, `"habit not found"` → 404, any other `Error` → 400, anything else → 500.
- **Rationale**: The notes list "404 if not able to access server". In this codebase 404 means "this habit id doesn't exist", which only applies to get, update and delete; create has no 404 case. When the server can't be reached there is no status code at all: `fetch` throws in the browser and the page shows an error (001 FR-017). No new code is needed for that.

## P8. Frontend input: select plus a conditional hours field

- **Decision**: A new shared component, `HabitPeriodInput`, renders a `<select>` with None, Daily, Weekly, Monthly, Yearly and Custom. Choosing Custom reveals a number input labelled "Hours" (`step="any"`, `min` 1). It is fully controlled with string values, like `HabitDurationInput`. The creation step and the update page both use it.
- **Rationale**: Matches the notes and the existing pattern: one shared, controlled input, with the page doing validation.

## P9. Frontend helpers in `habitFields.ts`

- **Decision**: Add:
  - `MAX_PERIOD_HOURS = 8766`
  - `type PeriodChoice = "none" | "daily" | "weekly" | "monthly" | "yearly" | "custom"`
  - `parsePeriod(choice, hours)` → `{ period }` or `{ error }`. Custom with an empty hours field gives `{ period: null }` (spec FR-002).
  - `periodToFields(period)` → `{ choice, hours }`, to fill the update page.
  - `formatPeriod(period)` → "Daily", "Weekly", "Monthly", "Yearly", "Every N h" or "One-time", with N shown exactly as stored ("Every 1.5 h", "Every 720 h").
- **Rationale**: Same split as the duration helpers: pure, unit-tested parse/format logic, thin pages.

## P10. Existing habits and the migration

- **Decision**: The migration only adds the enum and two nullable columns. Existing rows get null in both, which reads as one-time (spec FR-011), so no backfill is needed. It is named `add_habit_period_preset_or_hours` so the at-most-one rule is stated in the name (Principle III); the service enforces it.
