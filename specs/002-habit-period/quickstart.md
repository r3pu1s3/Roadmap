# Quickstart: Validate Habit Period

Manual check of the finished feature, required before committing. The behaviour it checks is defined in [contracts/habits-api.md](contracts/habits-api.md), [contracts/ui.md](contracts/ui.md) and [data-model.md](data-model.md).

## Prerequisites

- PostgreSQL is running and `backend/.env` has `DATABASE_URL`.
- At least one habit created before this feature exists, to check that old habits read as one-time.
- The migration is applied: `npx prisma migrate dev` in `backend/` (picks up `add_habit_period_preset_or_hours` and regenerates the client).

## Automated checks

```bash
cd backend  && npm test && npm run build && npm run lint
cd frontend && npm test && npm run build && npm run lint
```

Expected: everything passes, including the new and extended suites:

- **Backend**: `HabitService.test.ts`, `HabitController.test.ts`
- **Frontend**: `habitFields.test.ts`, `HabitPeriodInput.test.tsx` (new), `HabitItem.test.tsx`, `HabitCreate.test.tsx`, `HabitEdit.test.tsx`

## Run the app

`npm run dev` in `backend/` and `frontend/`, then open `http://localhost:5173/habits`.

## Manual scenarios

| # | Steps | Expected |
|---|-------|----------|
| 1 | Open `/habits` | Habits from before this feature show "One-time" |
| 2 | New habit "Run", 30 min, Next | Step 3 of 4, Period, with None selected |
| 3 | Pick Weekly, Next | Review shows "Period: Weekly" |
| 4 | Back to Period, pick Custom | An "Hours" field appears |
| 5 | Enter 0, Next | Stays on the step with "at least 1" |
| 6 | Enter 0.5, Next | Stays on the step with "at least 1" |
| 7 | Enter 9000, Next | Stays on the step with "8766 or fewer" |
| 8 | Enter 1.5, Next, Create habit | List shows "Run · 30 min · Every 1.5 h" |
| 9 | New habit "Read", pick Custom, leave Hours empty, create | Listed as "One-time" |
| 10 | Open "Run" | Period shows Custom with 1.5 in Hours |
| 11 | Change to Monthly, Save | List shows "Monthly"; still there after reload |
| 12 | Open "Run", change to None, Save | List shows "One-time" |
| 13 | Open "Run", Custom 720, Save | List shows "Every 720 h" (not converted to days) |
| 14 | Habit 2 h long, Custom 1 h | Saves fine (period isn't checked against length) |

## API spot checks (optional)

| Request | Expected |
|---------|----------|
| `curl -X POST localhost:3000/habits -H "Content-Type: application/json" -d '{"name":"x","durationMinutes":30,"period":"hourly"}'` | 400 `period must be one of daily, weekly, monthly, yearly, or a number of hours` |
| same with `"period":"36"` | 400, same message (strings aren't converted) |
| same with `"period":0` | 400 `period must be at least 1 hour` |
| same with `"period":0.5` | 400 `period must be at least 1 hour` |
| same with `"period":1` | 201, `"period": 1` |
| `curl -X PATCH localhost:3000/habits/<id> -H "Content-Type: application/json" -d '{"name":"y"}'` | 200, `period` unchanged |
| `curl -X PATCH localhost:3000/habits/<id> -H "Content-Type: application/json" -d '{"period":null}'` | 200, `"period": null` |
