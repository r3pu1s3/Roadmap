# Contract: UI changes

Changes to `specs/001-habit-blocks/contracts/ui.md`. Styling reuses the existing habit pages' dark theme (`HabitForm.css`, `HabitDurationInput.css`). No new routes.

## New component: HabitPeriodInput (`src/components/HabitPeriodInput.tsx` + `.css`)

```ts
interface HabitPeriodInputProps {
  choice: PeriodChoice;
  hours: string;
  onChange(next: { choice: PeriodChoice; hours: string }): void;
}
```

- A `<select>` labelled "Period" with options, in order: None, Daily, Weekly, Monthly, Yearly, Custom.
- When `choice === "custom"`, a number input labelled "Hours" appears below it (`min={1}`, `step="any"`, `max={8766}`). Otherwise it isn't rendered. Its accessible name is "Period hours" (`aria-label`), so screen readers and tests can tell it apart from the duration's Hours field on the update page.
- Switching away from Custom keeps the typed `hours` in state (so switching back restores it), but `parsePeriod` ignores it for any other choice (spec Edge Cases).
- Fully controlled; no validation inside. Input and select styles match `HabitDurationInput`.

## Page: HabitCreate

- Four steps: Details → Length of time → **Period** → Review. Subtitle reads "Step N of 4".
- Period step: a "Period" label and `HabitPeriodInput`, starting at None.
- Next on the period step runs `parsePeriod`. An error keeps the user on the step and shows the message in the existing error box.
- Review step gains a "Period" row showing `formatPeriod(period)`.
- Create re-checks steps 1 to 3 and sends `period` (`null` for one-time).
- Back keeps the period choice and hours (spec FR-010).

## Page: HabitEdit

- A new "Period" section, after "Length of time" and before the error/actions, using `HabitPeriodInput`.
- On load, `periodToFields(habit.period)` fills the choice and hours (e.g. `36.5` → Custom + `"36.5"`; `null` → None).
- Save validates period after the other fields and always sends `period` (`null` when None, or Custom left empty).

## Component: HabitItem

- Shows the period after the duration: name, duration, then `formatPeriod(habit.period)` in a `habit-item-period` span styled like `habit-item-duration`.

## Utilities: `src/utils/habitFields.ts`

| Export | Behaviour |
|---|---|
| `MAX_PERIOD_HOURS` | `8766` |
| `PeriodChoice` | `"none" \| "daily" \| "weekly" \| "monthly" \| "yearly" \| "custom"` |
| `parsePeriod(choice, hours)` | See [../data-model.md](../data-model.md) |
| `periodToFields(period)` | `null` → `{ choice: "none", hours: "" }`; preset → `{ choice: preset, hours: "" }`; number → `{ choice: "custom", hours: String(n) }` |
| `formatPeriod(period)` | `null` → "One-time"; presets → "Daily" / "Weekly" / "Monthly" / "Yearly"; number → `` `Every ${n} h` `` |
