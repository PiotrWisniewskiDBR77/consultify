# INI-MVP-PORTFOLIO-001 — Portfolio/Resource/Roadmap/Timeline/Capacity: persisted vs. computed

Evidence gathered 2026-08-16 in worktree `consultify-closure-claude-b`,
branch `codex/closure-claude-b-transformation`. Live DB queried read-only via
`docker exec consultify-closure-b-64f50785 psql`. No source files edited.

## Verdict up front

Of the five read models, **two have real backing tables that persist
user-entered data** (Resource, Roadmap) and **three are computed live on
every request with zero persistence of the read model itself** (Portfolio,
Timeline, Capacity). Critically, even the two "persisted" ones have no
*rebuild* concept at all — they are plain CRUD tables, not materialized
views derived from other data, so "idempotent rebuild" does not apply to
them either, just for a different reason (there is nothing to rebuild, only
data to read back as stored). None of the five has a rebuild job, a
materialized view, or a cache table anywhere in the codebase — confirmed by
`grep -rl "MATERIALIZED VIEW\|read_model\|readModel\|rebuildPortfolio\|
rebuildResource\|rebuildRoadmap\|rebuildTimeline\|rebuildCapacity"` across
`server/migrations` and `server/src/services`, which returned zero relevant
hits.

## Portfolio

**Prior finding CONFIRMED.** `server/src/services/v8/planningPortfolioReadService.ts`,
exported function `getPortfolioRead` at line 143 (confirmed exact), runs a
live `SELECT i.*, ... FROM initiatives i LEFT JOIN users ob ... LEFT JOIN
users oe ... WHERE i.organization_id = ?` (lines 155-163), maps and
aggregates in JS (`stats.avgProgress`, `totalBudget`, `totalValue`, lines
278-313), and returns the object directly — no INSERT, no cache table, no
persistence of the computed result anywhere in the function (verified by
reading the full function body, lines 143-315).

- **Endpoint**: `GET /api/v8/planning/initiatives/portfolio`
  (`server/src/routes/v8/planning.routes.ts:77-94`, calls `getPortfolioRead`
  imported at `planning.routes.ts:45`), mounted at `v8Router.use('/planning',
  planningRoutes)` (`server/src/routes/v8/index.ts:129`), and `/api/v8`
  itself mounted behind `v8FeatureGate` at `Gateway.ts:1391`.
- **Read path**: direct SQL over `initiatives` + `users`, computed fresh
  every call.
- **Rebuild idempotency**: not applicable — there is no rebuild step, only
  a query. Two calls with unchanged `initiatives`/`users` data return
  byte-identical JSON (the function is a pure read + deterministic JS
  reduce), so a restart/cold-readback trivially returns identical results
  **as long as the underlying `initiatives` rows are unchanged** — but this
  is "the query is repeatable," not "the read model was rebuilt and
  verified identical," because there is no persisted read model to compare
  against in the first place.

## Resource

**Persisted, but per-initiative CRUD, not a portfolio-wide read model.**
Two code paths both confirmed:

1. `server/src/controllers/InitiativeController.ts:3722`
   (`static getResources`) reads directly from a real table:
   ```
   SELECT r.id, r.initiative_id ..., r.user_id ..., r.name, r.role,
     r.allocation_percentage ..., r.start_date ..., r.end_date ..., r.notes,
     r.source, r.version, u.first_name ..., u.last_name ..., u.avatar_url ...
   FROM initiative_resources r
   LEFT JOIN users u ON r.user_id = u.id AND u.organization_id = r.organization_id
   WHERE r.initiative_id = ? AND r.organization_id = ?
   ```
   `initiative_resources` is confirmed live in the DB (`\d
   initiative_resources`: `id, initiative_id, organization_id, user_id, name,
   role, allocation_percentage, start_date, end_date, notes, source,
   created_at, updated_at, idempotency_key, skills, staffing_plan_role_id,
   version` — a real, versioned table, 0 rows). Writes go through
   `InitiativeController.addResource` (`InitiativeController.ts:3761` ff.),
   a genuine `INSERT`-backed CRUD endpoint (`GET/POST /api/initiatives/:id/resources`,
   `initiatives.routes.ts:3466` ff.).
2. `server/src/services/v8/planningPortfolioReadService.ts:821`
   (`getInitiativeResourcesRead`) is a SECOND, separate read path over the
   same table for the v8 planning surface — not inspected line-by-line in
   this pass beyond confirming its existence at that line number.

**Rebuild idempotency**: Resource is genuinely persisted (real INSERT/SELECT
against `initiative_resources`), so a restart/cold readback returns exactly
what was written, by definition of a normal ACID table — this is standard
persistence, not a "rebuild," because nothing here is *derived* from other
source data; the row IS the data. There is no separate "resource read
model" distinct from the table itself to test idempotent-rebuild against.

## Roadmap

**Persisted, same shape as Resource.**
`server/src/controllers/RoadmapController.ts`:
- `getWaves` (line 20): `SELECT * FROM roadmap_waves WHERE project_id = ?
  AND organization_id = ? ORDER BY sequence_order ASC`.
- `createWave` (line 40): `INSERT INTO roadmap_waves (id, organization_id,
  project_id, name, description, start_date, end_date, sequence_order)
  VALUES (...)`.
- `getSummary` (line 75): a live `COUNT(*)` over `roadmap_waves` plus a live
  `COUNT(*)` over `initiatives` — this summary itself is computed on every
  call, not cached, though the underlying `roadmap_waves` rows it counts are
  persisted.

`roadmap_waves` confirmed live in the DB: `id, organization_id, project_id,
name, description, start_date, end_date, sequence_order, created_at,
updated_at` — a real table, 0 rows, with index
`idx_roadmap_waves_project (project_id, organization_id)`. Mounted at
`GET/POST /api/roadmap/:projectId/waves` and
`GET /api/roadmap/:projectId/summary` (`roadmap.routes.ts:20,26,32`).

Separately, there is ALSO a schedule-baseline "timeline lock" concept —
`GET /api/initiatives/:id/schedule-baselines` and
`/:id/schedule-baselines/:version` (`initiatives.routes.ts`, "ROADMAP
MODULE: SCHEDULE BASELINES (Timeline lock)" section) via
`InitiativeController.getScheduleBaselines`/`getScheduleBaseline` — these
read versioned snapshots, which if genuinely append-only would be the one
clean "persisted, idempotently re-readable" read model among all five. This
was not fully traced in this pass (out of budget); flagged NOT_VERIFIED as
a promising follow-up rather than asserted.

**Rebuild idempotency**: same reasoning as Resource — `roadmap_waves` is a
plain CRUD table, restart/readback trivially returns what was stored; the
`getSummary` COUNT is recomputed live each call (same caveat as Portfolio:
repeatable query, not a verified rebuild of a persisted read model).

## Timeline

**Prior-finding pattern CONFIRMED: computed live, not persisted, and
regenerated relative to "now" on every call — the least idempotent of the
five.**
`server/src/services/workloadCapacityService.ts:560`
(`getCapacityTimeline`):
```
const today = new Date();
...
for (let w = 0; w < 12; w++) {
  const weekStart = getMonday(new Date(today.getTime() + w * 7 * 24 * 60 * 60 * 1000));
  ...
}
```
Every call generates a fresh rolling 12-week window anchored to
`new Date()` at call time, querying `task_allocations` (with a fallback to
an even-split-over-tasks estimate when `task_allocations` has no rows for
that week, lines 602-609) and `initiative_resources` for member counts
(lines 567-580). There is no table storing "the timeline" — the output
literally depends on wall-clock time of the request, not just DB state.

- **Endpoint**: `GET /api/initiatives/:id/capacity/timeline`
  (`initiatives.routes.ts:3334`, controller-level wrapper calls
  `getCapacityTimeline(orgId, initiativeId)`).
- **Rebuild idempotency**: **cannot be idempotent across a restart spanning
  a week boundary by construction** — a rebuild "the next day" (or the next
  Monday) will legitimately shift which 12 weeks are returned, because the
  window is `today`-relative, not a stored, versioned artifact. Even within
  the same instant, if `task_allocations` is empty the fallback branch
  divides `SUM(estimated_hours)` by a hardcoded `12.0`
  (`workloadCapacityService.ts:604`), so the same underlying `tasks` state
  produces different per-week numbers depending solely on whether
  `task_allocations` happens to have rows — a second source of
  non-reproducibility unrelated to persistence at all.

## Capacity

**Prior-finding pattern CONFIRMED, and found to be duplicated across TWO
independent, non-shared implementations — neither persists.**

1. `server/src/controllers/CapacityController.ts` — three live-computed
   endpoints, none backed by a capacity table:
   - `getUserCapacity` (line 19): live SQL over `project_members` +
     `tasks`, `DEFAULT_WEEKLY_HOURS = 40` hardcoded (line 29).
   - `getProjectOverloads` (line 72): live SQL over `project_members` +
     per-member `tasks` SUM, loop-computed (lines 82-113).
   - `getProjectSummary` (line 119): live SQL SUM over `project_members`
     and `tasks`, `updatedAt: new Date().toISOString()` freshly stamped on
     every response (line 147) — the field name implies persistence but
     none exists; it is simply "the time this particular request ran."
   - Mounted at `GET /api/capacity/user/:userId`,
     `/api/capacity/project/:projectId/overloads`,
     `/api/capacity/project/:projectId/summary`
     (`capacity.routes.ts:20,26,32`).
2. `server/src/services/workloadCapacityService.ts:377`
   (`getInitiativeCapacity`) — a SECOND, entirely separate capacity
   computation, scoped to one initiative rather than one project/user,
   joining `initiative_resources` + cross-initiative `SUM(allocation_percentage)`
   (lines 409-416) + `tasks` (lines 418-426) + optionally `time_entries`
   wrapped in a try/catch fallback for "may not exist" (lines 429-441).
   Mounted at `GET /api/initiatives/:id/capacity`
   (`initiatives.routes.ts:3313`, `getInitiativeCapacity` import).

Both implementations use the same `DEFAULT_WEEKLY_HOURS = 40` constant
independently, both compute utilization/overload from `tasks.estimated_hours`
live, and neither shares a function or a persisted output with the other —
this is a second instance of the "N independent formulas for the same
concept" pattern already documented for health scores in EXE-MVP-SPINE-001.

**Rebuild idempotency**: not applicable in the persisted-materialization
sense — both are pure live queries. Two calls with unchanged
`project_members`/`initiative_resources`/`tasks` data return identical
numbers (deterministic aggregation), so in that narrow sense a "restart"
trivially reproduces the same output — but, as with Portfolio, this is
query-repeatability, not verification of a persisted, rebuildable read
model, because no such persisted artifact exists to rebuild.

## Summary table

| Read model | Persisted table? | Read path | Idempotent rebuild possible? |
|---|---|---|---|
| Portfolio | No | `planningPortfolioReadService.ts:143` `getPortfolioRead`, live SELECT+JS reduce over `initiatives`/`users` | N/A — no persisted artifact; live query is deterministic given unchanged source data, but nothing is "rebuilt" |
| Resource | **Yes** — `initiative_resources` | `InitiativeController.ts:3722` `getResources` (direct SELECT); also `planningPortfolioReadService.ts:821` | N/A — plain CRUD table, restart/readback trivially exact by construction; no derivation step exists to test |
| Roadmap | **Yes** — `roadmap_waves` | `RoadmapController.ts:20` `getWaves` (direct SELECT); `getSummary` (line 75) recomputes counts live | Same as Resource for the table itself; `getSummary`'s live COUNT is query-repeatable, not a rebuild |
| Timeline | No | `workloadCapacityService.ts:560` `getCapacityTimeline`, live 12-week rolling window anchored to `new Date()` | **No** — output is wall-clock-relative by construction; also has a non-deterministic-feeling fallback branch (÷12.0 estimate) depending on whether `task_allocations` has rows |
| Capacity | No | `CapacityController.ts` (project/user-scoped) AND `workloadCapacityService.ts:377` `getInitiativeCapacity` (initiative-scoped) — two independent, non-shared implementations | N/A — pure live query in both cases; no persisted artifact to rebuild |

## What "idempotent rebuild with restart/readback" can and cannot mean here

For the three genuinely **computed** models (Portfolio, Timeline, Capacity),
"idempotent rebuild" is a category error as literally stated in the task
brief — there is no persisted read model to rebuild. What CAN honestly be
claimed is a weaker property: **query determinism** — calling the same
endpoint twice against unchanged source rows returns the same JSON. For
Portfolio and Capacity this weaker property likely holds (pure functions of
DB state + deterministic JS). For Timeline it explicitly does NOT hold even
under the weaker definition, because the function's own first line is
`const today = new Date()` — the output changes every time real wall-clock
time crosses a week boundary, independent of any data change, and there is
additionally the `task_allocations`-presence-dependent fallback branch
producing different numbers for the same `tasks` state.

For the two genuinely **persisted** models (Resource, Roadmap), a
restart/cold-readback trivially returns identical results because they are
ordinary ACID-backed tables — but this is not evidence of a "rebuild"
capability either, since nothing here is derived/rebuilt from other source
data; verifying idempotent rebuild would require identifying an actual
derivation step (e.g., if `roadmap_waves` were ever regenerated FROM
`initiative_milestones` or similar), and no such derivation code was found
for either table in this pass.

**Bottom line**: none of the five read models today satisfies "persisted,
idempotently rebuildable, with restart/readback returning identical
results" as a single coherent property. Three have no persistence to
rebuild; two have persistence but no rebuild step to test idempotency
against; and one of the three computed models (Timeline) is actively
non-reproducible by design (time-anchored + presence-dependent fallback).

## In-lease / out-of-lease split

Checked against `docs/cleanup/agents/generated/CLAUDE_LANE_B_PATH_LEASE.json`:

**IN-LEASE**: `server/src/routes/pmo/initiatives.routes.ts`,
`server/src/routes/pmo/capacity.routes.ts`,
`server/src/routes/pmo/roadmap.routes.ts`,
`server/src/controllers/InitiativeController.ts`.

**OUT-OF-LEASE**: `server/src/services/v8/planningPortfolioReadService.ts`,
`server/src/controllers/CapacityController.ts`,
`server/src/controllers/RoadmapController.ts`,
`server/src/services/workloadCapacityService.ts`.

Four of the eight files central to this trace — including BOTH files that
implement the actual Portfolio and Timeline/Capacity computations — are
out-of-lease for lane B. Any remediation (e.g. adding real persistence,
fixing Timeline's non-determinism, unifying the two Capacity
implementations) would require an integrator request; this is not a
lane-B-only fix.
