# Quickstart: Validate Habit Blocks

This guide lets you check the finished feature by hand, which the constitution requires before committing. The behaviour it checks is defined in:

- [contracts/habits-api.md](contracts/habits-api.md)
- [contracts/ui.md](contracts/ui.md)
- [data-model.md](data-model.md)

## Prerequisites

- PostgreSQL is running, and `backend/.env` has `DATABASE_URL`.
- The migration is applied: run `npx prisma migrate dev` in `backend/`. It picks up `add_habit` and regenerates the client.

## Automated checks

```bash
cd backend  && npm test && npm run build && npm run lint
cd frontend && npm test && npm run build && npm run lint
```

Expected: every test passes, including the new suites listed below, and the build and lint finish without errors.

- **Backend**: `HabitService.test.ts`, `HabitController.test.ts`
- **Frontend**: `HabitList.test.tsx`, `HabitCreate.test.tsx`, `HabitEdit.test.tsx`, `HabitItem.test.tsx`, `HabitDurationInput.test.tsx`, `habitFields.test.ts`

## Run the app

Run `npm run dev` in `backend/` and `frontend/` side by side, then open `http://localhost:5173/habits`.

## Manual scenarios

| # | Steps | Expected |
|---|-------|----------|
| 1 | Open `/habits` with no habits | Empty-state message and a "+ New Habit" button |
| 2 | Click + New Habit. Click Next with the name empty | Stays on step 1 with a "name is required" message |
| 3 | Enter the name "Run", click Next. Enter 0 h and 0 min, click Next | Stays on step 2 with the "at least 1 minute" message |
| 4 | Enter 1 h 15 min, click Next, then Back twice | Name "Run" and 1 h 15 min are still filled in |
| 5 | Go forward to Review and click Create habit | Back on `/habits` with "Run · 1 h 15 min" listed |
| 6 | Create "apple" and "Banana", then reload | Order is apple, Banana, Run (alphabetical, ignoring case) |
| 7 | Click "Run", change it to 45 min, Save | Back on `/habits` showing "Run · 45 min". It is still there after a reload |
| 8 | Open "Run", clear the name, Save | Error shown, nothing saved |
| 9 | Open "Run", press Delete habit, then Cancel | Prompt closes, and the habit is still there |
| 10 | Press Delete habit, then Confirm delete | Back on `/habits`, and "Run" is gone after a reload |
| 11 | Open `/habits/999999` | "Habit not found" and a link back to `/habits` |
| 12 | Stop the backend and reload `/habits` | Error message, not an empty list |
| 13 | Start a new habit, type a name, click Cancel | Back on `/habits` with no prompt, and nothing created |

## API spot checks (optional)

| Request | Expected |
|---------|----------|
| `curl -X POST localhost:3000/habits -H "Content-Type: application/json" -d '{"name":"x","durationMinutes":"30"}'` | 400 `durationMinutes must be a whole number` |
| `curl -X PATCH localhost:3000/habits/abc -H "Content-Type: application/json" -d '{}'` | 400 `id must be a valid integer` |
