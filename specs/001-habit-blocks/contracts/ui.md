# Contract: Habit UI (routes, pages, components)

Every page uses the dark style of `MapMenu`/`MapForm` (see [research.md](../research.md) R10). Every backend call goes through `src/apis/HabitApi.ts` (Principle IV). New routes are added to `App.tsx`:

| Route | Page | Purpose |
|-------|------|---------|
| `/habits` | `HabitList` | View page (US2) |
| `/habits/new` | `HabitCreate` | Creation steps (US1) |
| `/habits/:habitId` | `HabitEdit` | Update and delete page (US3, US4) |

No existing page links to `/habits`. It is opened directly, because the home page is out of scope.

## Page: HabitList (`src/pages/HabitList.tsx` + `.css`)

Header:

- Title: "Habits".
- **Create button**: a link to `/habits/new` labelled "+ New Habit", with `aria-label="Create habit"`. It mirrors `map-menu-new-btn`.

States:

| State | What is shown |
|-------|---------------|
| Loading | "Loading habits…" |
| Error | The error message in red (FR-017) |
| Empty | "No habits yet — press + New Habit to create one." (FR-003) |
| Loaded | One `HabitItem` per habit, in the order the API returns |

## Component: HabitItem (`src/components/HabitItem.tsx` + `.css`)

Props: `{ habit: HabitResponse }`.

- Renders as a link to `/habits/{id}` showing the name and `formatDuration(durationMinutes)` (FR-002, FR-011).
- A long name is cut off with an ellipsis (`text-overflow: ellipsis`, as in `map-menu-row-name`).

## Component: HabitDurationInput (`src/components/HabitDurationInput.tsx` + `.css`)

Props: `{ hours: string; minutes: string; onChange(next: { hours: string; minutes: string }): void }`.

- Two `type="number"` inputs, labelled "Hours" and "Minutes".
- The parent owns the values and the validation. This component is controlled and keeps no state of its own.

## Page: HabitCreate (`src/pages/HabitCreate.tsx` + `HabitForm.css`)

A single card with the step indicator "Step N of 3". All values live in page state (research R6).

| Step | Content | Buttons |
|------|---------|---------|
| 1. Details | **Name** input field; **Description** input field (textarea, optional) | Cancel, Next |
| 2. Length of time | **Duration** input field (`HabitDurationInput`) | Cancel, Back, Next |
| 3. Review | Read-only name, description ("No description" if empty) and the formatted length of time | Cancel, Back, **Create habit** (the submit button) |

Behaviour:

- **Next** validates the current step. If it is invalid, the page shows an inline error and stays on the step (US1-4).
- **Back** keeps all values (FR-006).
- **Cancel** goes to `/habits` without a prompt (clarification Q5).
- **Create habit** re-checks every field, then calls `createHabit`.
  - While saving, the button reads "Creating…" and is disabled (double-submit edge case).
  - On success it navigates to `/habits`.
  - On failure it stays on step 3, shows the server error and keeps the values.

## Page: HabitEdit (`src/pages/HabitEdit.tsx`, shares `HabitForm.css`)

On load it calls `getHabit(habitId)`:

| State | What is shown |
|-------|---------------|
| Loading | "Loading habit…" |
| Not found (`habit not found`) | "Habit not found" and a link back to `/habits` (FR-018) |
| Other error | The message and a link back to `/habits` |

When loaded, the card contains:

1. **Name section**: the title "Name" and the name input field.
2. **Description section**: the title "Description" and the description input field (textarea).
3. **Duration section**: the title "Length of time" and `HabitDurationInput`, pre-filled with `splitDuration`.
4. Buttons: **Save** and **Cancel**. Cancel goes back to `/habits` without a prompt.
5. A divider, then the **Delete habit** button at the very bottom (FR-013).

Save:

- Validates all fields, then calls `updateHabit` with all three fields.
- While saving, it reads "Saving…" and is disabled.
- On success it navigates to `/habits` (clarification Q1).
- On failure it shows the error inline and keeps the edits.

Delete:

- Pressing the button shows an inline prompt, "Delete this habit permanently?", with **Confirm delete** and **Cancel** (FR-014, research R8).
- **Confirm delete** calls `deleteHabit` and then navigates to `/habits`. On failure it shows the error and stays on the page.
- **Cancel** hides the prompt and nothing is deleted.

## Utilities: `src/utils/habitFields.ts`

- **Constants**: `NAME_CHAR_LIMIT = 100`, `DESCRIPTION_CHAR_LIMIT = 280`, `MAX_DURATION_MINUTES = 1440`. These mirror `HabitService` and are kept in sync by hand, like `NAME_WORD_LIMIT` for maps.
- `validateName(name)` returns an error message or `null`.
- `validateDescription(description)` returns an error message or `null`.
- `parseDuration(hours, minutes)` returns either `{ minutes }` or `{ error }`. Its rules are in [data-model.md](../data-model.md).
- `formatDuration(totalMinutes)` returns a string.
- `splitDuration(totalMinutes)` returns `{ hours, minutes }`.
