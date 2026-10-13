# Roadmap Constitution

## Core Principles

### I. Layered Backend Architecture (NON-NEGOTIABLE)

Every backend resource MUST follow Route → Controller → Service → Prisma, with no layer
skipped or bypassed:

- Routes map an HTTP verb/path to a controller function and do nothing else.
- Controllers parse `req`, call a service, and translate thrown `Error`s into HTTP status
  codes (`"X not found"` → 404, any other thrown `Error` → 400, unexpected non-`Error` → 500).
  Controllers MUST NOT contain business logic.
- Services own all business rules and validation that Prisma cannot enforce on its own
  (string length, enum membership, cross-field consistency, DAG-aware checks, etc.).
- Services call the shared Prisma singleton in `src/lib/prisma.ts` directly. Code MUST NOT
  instantiate `PrismaClient` anywhere else, because unit tests depend on
  `vi.mock("../lib/prisma")` swapping in the deep mock for that exact import path.

Rationale: strict layering keeps business rules testable in isolation (mocked Prisma) while
HTTP and persistence concerns stay swappable; this is the structure the existing codebase and
its automated build agents already assume, and deviating from it silently breaks that tooling.

### II. Test-First Unit Testing (NON-NEGOTIABLE)

The project has one automated test tier in both workspaces: unit tests. Unit tests MUST be
written before the implementation they cover.

- `*.test.ts` / `*.test.tsx` — unit tests against a mocked Prisma client or mocked
  dependencies (the backend mocks `src/lib/prisma`; the frontend mocks `src/apis/*`). They
  MUST NOT require a live database or network, so they pass the same way locally and in CI.
- End-to-end tests (real HTTP against a real database) are not part of this project and MUST
  NOT be added. Behaviour that only a running backend and database can show is checked by
  the user's manual verification before commit (see Development Workflow).

Rationale: for a solo project of this size, a second test tier that needs a live database
costs more to write, run, and clean up after than it catches. Unit tests pin the behavioural
contract; the user's hands-on check of the finished feature covers the wiring between layers.

### III. Schema Changes Are Deliberate and Migration-Driven

`backend/prisma/schema.prisma` MUST be changed via `npx prisma migrate dev --name
<description>`, not by hand-editing files under `prisma/migrations/`. After pulling a schema
change made elsewhere, `npx prisma generate` MUST be run before relying on
`src/generated/prisma` types. Schema changes that affect a DAG relationship (e.g.
`ObjectiveEdge`) or a both-or-neither field pair MUST state the invariant they enforce in the
migration name or an accompanying service-layer validation, not leave it implicit.

Rationale: this schema has already iterated several times (goal templates → goal nodes →
objectives; counters moved from string arrays to a relation); hand-edited migrations have
no record of intent and are the likeliest way to silently diverge from `schema.prisma`.

### IV. Frontend Reuse Over Duplication

New sidebar-like UI for objectives MUST build on `ObjectiveSidebarShell` rather than
duplicating its layout. All backend calls MUST go through a thin wrapper in `src/apis/*.ts`
that throws on non-OK responses using the server's `{ error }` body — components MUST NOT
call `fetch` directly against the API. New code MUST prefer the response types exported from
`src/apis/ObjectiveApi.ts` over `src/types/ObjectiveType.ts`, which is deprecated in places.

Rationale: the create/edit sidebars and the API layer were deliberately split this way so that
server-shape changes have one call site to update; bypassing the wrapper or the shared shell
reintroduces the duplication that split was meant to remove.

### V. Simplicity, Readability, and Reviewable Documentation

Code MUST solve the task at hand, not a hypothetical future one. No new abstraction,
configuration flag, backwards-compatibility shim, or defensive validation may be added unless
the current task requires it — three similar lines are preferred over a premature helper, and
a half-finished implementation (a flag for a feature not yet built, a branch for an error that
cannot occur at that boundary) is not acceptable.

Code MUST also be documented and structured well enough that the project owner can review it
without re-deriving intent from scratch:

- Every exported function, service method, and non-trivial component MUST carry a short
  comment or docstring stating its purpose whenever that purpose is not obvious from its name
  and signature alone.
- Comments MUST explain non-obvious *why* (a constraint, an invariant, a workaround, a
  deliberate deviation from the layering/testing conventions above) — they MUST NOT restate
  *what* the code already shows line-by-line.
- Names MUST be descriptive enough that a reviewer unfamiliar with the specific change can
  follow control flow and intent without executing the code.
- Work presented for review MUST leave the diff in a state a human can read top-to-bottom: no
  commented-out dead code, no unexplained TODOs, no file left mid-refactor.

Rationale: this is a solo-maintained learning project built largely with AI assistance; every
speculative abstraction is pure maintenance cost with no second author to amortize it against,
and every change that skips purpose-level documentation or leaves an unreadable diff defeats
the point of a human owner reviewing and learning from the result.

### VI. Secrets & Local-Config Hygiene

Secrets and machine-local configuration MUST never be committed to the repository:

- `.env` files in either workspace (`DATABASE_URL`, `VITE_API_BASE_URL`, any future API key)
  MUST stay gitignored, never checked in, regardless of how innocuous a given value looks today.
- Tool-local state — `.claude/settings.local.json`, `.claude/worktrees/` (each a full nested
  git worktree with its own `.git`), and per-machine extension overrides such as
  `.specify/extensions/*/local-config.yml` — MUST be gitignored, not committed.
- Before wiring up a new integration that can hold credentials (an MCP server, a GitHub token
  for `speckit-taskstoissues`, or similar), the location where that integration would persist
  the credential MUST be identified and gitignored *before* the integration is first configured,
  not discovered after the fact.
- When staging or committing, changes under `.gitignore`-adjacent paths MUST be reviewed for
  file contents, not just filenames, before the commit is made — an innocuous-looking filename
  is not proof the file is safe to commit.

Rationale: this rule already governed practice before it was written down — local permission
config and a stray nested git worktree were caught and gitignored ad hoc in this project's
history. Writing it into the constitution turns a one-off catch into a standing check applied
the same way every time, instead of depending on it being noticed again by chance.

### VII. Plan and Unit-Test Checkpoints Before Implementation (NON-NEGOTIABLE)

Non-trivial features MUST be planned before any code is written, and the plan MUST be
checkpointed for explicit user approval before implementation begins. Approval of one
checkpoint covers only the step presented — it is never blanket license to proceed through
later checkpoints unattended.

Once a plan is approved, unit test files (`*.test.ts` / `*.test.tsx`) MUST be written and sent
back to the user for review before the corresponding implementation (service, controller,
component, page) is built against them. Tests are reviewed at the granularity the Development
Workflow sets: one review per user story's backend tests, and one review per frontend unit.
Implementation of the covered code MUST NOT begin until the user explicitly approves that
specific review.

Rationale: unit tests are the actual behavioral contract the implementation gets built against,
so reviewing them before implementation catches a misunderstood requirement while it is still
cheap to fix.

## Backend & Frontend Conventions

Additional conventions, not themselves principles but required reading before touching either
workspace: `backend/` and `frontend/` are independent npm workspaces (not a monorepo tool) —
the root `package.json` only hosts `husky`. The frontend talks to the backend over
`VITE_API_BASE_URL`, so both dev servers normally run side by side. Node IDs used by React
Flow on the canvas are local/ephemeral until a save succeeds, at which point the node's `data`
is replaced with the real API response carrying the database `id`; code must not assume a
React Flow node id is a database id. Edges between objectives (`ObjectiveEdge`) are loaded,
created, and deleted from the canvas through `src/apis/ObjectiveEdgeApi.ts`; the canvas runs a
client-side cycle check before creating an edge, mirroring the backend check in
`ObjectiveEdgeService`.

## Development Workflow

Every approved plan is built using Spec Kit's default task organisation: by user story, in
the priority order given in the spec (P1, then P2, and so on). Each story is built as a full
vertical slice before the next story starts.

- **Setup and Foundational phases** contain only prerequisites that more than one story
  genuinely shares, for example a schema change several stories depend on, or a shared
  frontend utility. Work that only one story needs belongs in that story's phase.
- **Within a story's phase**, the layers it touches are built in this fixed order:
  1. Schema change and migration (Principle III), where the story needs one and Foundational
     has not already made it.
  2. Backend unit tests for that story's service and controller behaviour, which MUST be
     approved by the user (Principle VII).
  3. Backend implementation against the approved tests: service, then controller.
  4. Route + `index.ts` wiring for that story's endpoints.
  5. The `src/apis/*.ts` wrapper and response-type changes that story needs, matching the
     shapes its finished backend slice actually returns.
  6. Each component or page that story needs, built as a unit-test/implementation pair. Its
     unit tests MUST be approved by the user (Principle VII) before it is implemented against
     them. The next pair starts only after the current unit is green.
- A story's backend layers MUST be green before that story's frontend work starts, so the API
  wrappers are always written against endpoints that already exist. Later stories MAY extend
  files that earlier stories created (for example, adding an endpoint to an existing service).
- Each completed story MUST leave every unit test green, both its own and every earlier
  story's, before the next story starts.

Each feature is built on its own branch:

- At the start of implementation, before the first task changes any file, a new branch MUST
  be created and checked out. Spec, plan and tasks generation do not create one.
- The branch is named after the feature's spec directory (e.g. `001-habit-blocks`).
- It is branched off the base branch the feature's `plan.md` names. If the plan names none,
  it is branched off whichever branch is checked out when implementation starts. The base
  branch used MUST be stated to the user when the branch is created.
- If a branch with that name already exists, implementation MUST stop and ask the user
  whether to reuse it or pick another name. It MUST NOT silently reuse or overwrite it.

The feature is committed on that branch only after the user has verified the finished feature
by hand in the running app (both dev servers up). Commits are not created speculatively
mid-pipeline.

Rationale: building one story end to end at a time gives a working, demonstrable increment
after every story, and keeps each test review small and tied to one piece of user-visible
behaviour. Building a story's backend before its frontend keeps the benefit the old
backend-first order was meant to protect: wrappers are never written against a contract that
might still change.

## Governance

This constitution supersedes ad hoc practice and any instruction that conflicts with it;
`CLAUDE.md` provides operational detail (commands, file layout, worked examples) and MUST NOT
be read as overriding a principle here, only as elaborating how to satisfy it. Amendments are
made by editing this file through the constitution-update workflow, not by direct edit. Each
amendment MUST produce a Sync Impact Report, as an HTML comment at the top of this file, for
the user to review; that report is scratch material and MUST be removed before the amendment
is committed. Versioning follows semantic rules: MAJOR for a
backward-incompatible removal or redefinition of a principle, MINOR for a new principle or
materially expanded guidance, PATCH for wording/clarification only. Because this is a
solo-maintained project, compliance review happens as self-review against this document before
a feature is committed, rather than through a separate approver.

**Version**: 4.1.0 | **Ratified**: 2026-10-09 | **Last Amended**: 2026-10-13
