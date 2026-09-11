# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Roadmap ("goal-graph") — an app for building goal/habit plans as a DAG or tree of objectives on a visual canvas. Two independent npm workspaces, not a monorepo tool: `backend/` (Express + Prisma API) and `frontend/` (React + Vite + React Flow).

## Commands

Run from within `backend/` or `frontend/` respectively. The root `package.json` only hosts `husky` (git hooks are repo-wide, not workspace-scoped) — it doesn't tie the two workspaces together.

**Backend** (`backend/`):

- `npm run dev` — start API with hot reload (tsx watch), default port 3000
- `npm run build` — type-check and build (`tsc -b`)
- `npm test` — run vitest (unit tests use mocked Prisma; `*.e2e.test.ts` files hit the real database configured in `.env`)
- `npm run test:unit` — run vitest excluding `*.e2e.test.ts` (used in CI, since there's no live DB there)
- `npx vitest run src/services/ObjectiveService.test.ts` — run a single test file
- `npm run lint` — ESLint
- `npm run format` / `npm run format:check` — Prettier, using the shared root config
- `npx prisma migrate dev --name <description>` — create/apply a migration after editing `schema.prisma`
- `npx prisma generate` — regenerate the Prisma client into `src/generated/prisma` (needed after pulling schema changes)

**Frontend** (`frontend/`):

- `npm run dev` — start Vite dev server
- `npm run build` — type-check (`tsc -b`) and production build
- `npm run lint` — ESLint
- `npm test` — run vitest (jsdom environment, RTL)
- `npm run format` / `npm run format:check` — Prettier, using the shared root config
- `npx vitest run src/components/ObjectiveSidebar.test.tsx` — run a single test file

The frontend talks to the backend via `VITE_API_BASE_URL` (defaults to `http://localhost:3000`), so both dev servers normally run side by side.

## Architecture

### Backend: Route → Controller → Service → Prisma

Each resource (`Map`, `Objective`) follows this layering strictly:

- **Route** (`src/routes/*Route.ts`) — maps HTTP verb/path to a controller function, nothing else.
- **Controller** (`src/controllers/*Controller.ts`) — parses `req`, calls the service, translates thrown `Error`s into HTTP status codes. Convention: `"X not found"` messages → 404, everything else thrown → 400, unexpected non-Error → 500.
- **Service** (`src/services/*Service.ts`) — all business rules and validation live here (Prisma alone can't enforce them: string length, enum membership, cross-field consistency). Services call the shared Prisma singleton in `src/lib/prisma.ts` directly — never instantiate `PrismaClient` elsewhere, since tests rely on `vi.mock("../lib/prisma")` swapping in `src/lib/__mocks__/prisma.ts` (a `vitest-mock-extended` deep mock).

When adding a new endpoint, add all three layers and wire the route into `src/index.ts`.

### Data model (`backend/prisma/schema.prisma`)

- `Map` (`Project` or `Habit` type) has many `Objective`s.
- `Objective` nodes form a DAG via `ObjectiveEdge` (parent/child, many-to-many, cascade delete) — not a tree.
- An `Objective` can be a plain goal or a task (`isTask: true`). A task's description may embed exactly one `{placeholder}` (parsed by `ObjectiveParser.parseCounterLabels`), which becomes its `ObjectiveCounter` (a label + optional target quantity). More than one placeholder in a task description is a validation error.
- Migration history shows the domain model iterated significantly (goal templates → goal nodes → objectives; counters went from string arrays to a single relation). Prefer `prisma migrate dev` for new schema changes over hand-editing migrations.

### Backend tests

Two distinct kinds live side by side — check the filename before assuming behavior:

- `*.test.ts` — unit tests against a mocked Prisma client (`vi.mock("../lib/prisma")`).
- `*.e2e.test.ts` — real HTTP requests (via `supertest`) against a real Express app instance and the real database from `.env`; these clean up rows they create in `afterEach`.

### Frontend

- Routing (`App.tsx`): `/` map menu, `/maps/new` map creation form, `/maps/:mapId` the canvas.
- The canvas (`src/pages/Map.tsx`) is built on `@xyflow/react` (React Flow). Clicking empty canvas creates a placeholder node and opens the create sidebar (`ObjectiveSidebar`); clicking an existing (already-saved) node opens the edit sidebar (`ObjectiveEditSidebar`). Both sidebars are built on the shared `ObjectiveSidebarShell` component. Node IDs used by React Flow are local/ephemeral until a save succeeds, at which point the node's `data` is replaced with the real API response (carrying the database `id`).
- API calls live in `src/apis/*.ts` (`MapApi.ts`, `ObjectiveApi.ts`), each a thin `fetch` wrapper that throws on non-OK responses using the server's `{ error }` body.
- `src/types/ObjectiveType.ts` is marked deprecated in places — prefer the response types exported from `src/apis/ObjectiveApi.ts` for anything talking to the current backend.
- Known gap (see comment in `Map.tsx`): edges between objectives are not yet rendered or persisted from the frontend — `ObjectiveEdge` exists in the schema but isn't wired up in the UI yet.
