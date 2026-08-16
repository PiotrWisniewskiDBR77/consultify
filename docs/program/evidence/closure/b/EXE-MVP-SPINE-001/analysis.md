# EXE-MVP-SPINE-001 — One spine, one health model: verification

Evidence gathered 2026-08-16 in worktree `consultify-closure-claude-b`,
branch `codex/closure-claude-b-transformation`. Live DB queried read-only via
`docker exec consultify-closure-b-64f50785 psql`. No source files edited.

## Verdict up front

**CONFIRMED, not refuted.** Four structurally distinct execution models
coexist, all reachable via mounted HTTP routes (none orphaned), sharing no
common writer, no common ID space, and no adapter that fuses their state into
one another. Four independent health-score formulas also confirmed, each
with a different input set, output range, and RAG/threshold rule.

## The four execution models

### Model 1 — Legacy relational PMO spine
- **Owner tables**: `tasks`, `initiative_milestones`, `raid_items`,
  `budget_entries` (all confirmed to exist in the live DB; all empty —
  `0` rows each, this is a schema-only shared lane DB).
- **Writer**: `server/src/controllers/ExecutionController.ts` (portfolio
  health aggregation, `healthScore` at line 438),
  `server/src/routes/pmo/tasks.routes.ts` (task CRUD, critical path,
  `scheduleHealth` at line 665), `server/src/routes/pmo/initiatives.routes.ts`
  (initiative CRUD; also hosts the mount point for Model 3, see below).
- **Mount status**: LIVE. `server/src/Gateway.ts:1105-1107` mounts
  `/api/pmo/projects`, `/api/pmo/initiatives`, `/api/pmo/tasks`;
  `Gateway.ts:1334-1337` mounts the legacy `/api/execution-control` (behind
  `deprecationHeader('/api/v8/execution-control')`, still live, not removed).
- **Adapter to another model**: none found. `tasks`/`raid_items`/
  `budget_entries` have no foreign key to `case_core`, `ie_aggregate_state`,
  or `v8_execution_runs`.

### Model 2 — Case Workspace graph/state-machine
- **Owner tables**: `case_core`, `case_plan_versions`,
  `case_workspace_node_runs`, `case_workspace_runs`,
  `case_workspace_gateway_evaluations`, `case_workspace_artifact_links` (all
  confirmed present in the live DB, all `0` rows).
- **Writer**: `server/src/services/caseWorkspace/caseCoreService.ts`,
  `server/src/services/caseWorkspace/executionGraphService.ts` (node
  runs/gateway evaluations, e.g. INSERT into
  `case_workspace_gateway_evaluations` at line 669).
- **Mount status**: LIVE — `server/src/Gateway.ts:892` mounts
  `/api/webhooks/case-workspace`; the broader `/api/v8/case-workspace`
  family (intake, cases, adapters) is mounted elsewhere under the `/api/v8`
  gate (`v8Router`), reachable behind `v8FeatureGate`.
- **Schema-level isolation from Model 1**: `case_core` has **no
  `initiative_id` column at all** (confirmed via `\d case_core` — columns are
  `case_id, project_id, organization_id, case_profile, ..., case_name,
  intake_confirmation_key`, FKs only to `projects`, `organizations`,
  `users`). It links to `projects`, never to `initiatives`.
- **Adapter to Model 1**: one exists, but only in the **reverse** direction:
  `server/src/services/caseWorkspace/adapters/initiativeAdapter.ts` lets a
  Case **create** an `initiatives` row (wrapping
  `initiativeService.createInitiative`, `initiativeAdapter.ts:52-120`) and
  link it as an `OUTPUT` artifact. There is no adapter that takes an existing
  Initiative and produces/attaches a Case — see EXE-BVP-001 evidence for the
  full trace of this gap.

### Model 3 — Event-sourced DDD engine (`ie_aggregate_state`)
- **Owner table**: `ie_aggregate_state` (confirmed present, `0` rows), JSON
  aggregate storage for tasks/decisions under
  `server/src/domain/initiatives-execution/`
  (`postgresMaterialCommandUnitOfWork.ts`, `postgresInitiativeReader.ts`,
  `materialCommand.ts` all reference the table).
- **Writer**: `server/src/domain/initiatives-execution/**`.
- **Mount status**: LIVE, and specifically nested inside Model 1's own
  router: `server/src/routes/pmo/initiatives.routes.ts:67` imports
  `initiativesExecutionRuntimeRouter` from `./initiativesExecutionRuntime.routes.js`
  and `initiatives.routes.ts:133` does
  `router.use('/runtime-v1', initiativesExecutionRuntimeRouter);` — placed
  after `verifyToken`/`requireOrgAccess`/`demoContextMiddleware`
  (`initiatives.routes.ts:125-133`). Because `initiatives.routes.ts` is
  itself mounted at `/api/pmo/initiatives` (`Gateway.ts:1106`), Model 3 is
  reachable at `/api/pmo/initiatives/runtime-v1/...` — **not orphaned**,
  contrary to what a naive `grep 'runtime-v1'` against `Gateway.ts` alone
  would suggest (that string does not appear directly in `Gateway.ts`; the
  mount is one hop deeper, inside the PMO initiatives router).
- **Adapter to another model**: none found — `ie_aggregate_state` is a
  single JSON-blob table with no FK to `case_core`, `tasks`, or
  `v8_execution_runs`.

### Model 4 — v8 AI-run/approval spine
- **Owner tables**: `v8_execution_runs`, `v8_action_proposals` (confirmed
  present, `0` rows).
- **Writer**: not fully traced in this pass (out of scope budget); the
  route surface is `server/src/routes/v8/execution-control.routes.ts`
  (imported at `Gateway.ts:397` as `v8ExecutionControlManagerRouter`, and
  again inside `server/src/routes/v8/index.ts:26` as `executionControlRoutes`,
  mounted at `v8Router.use('/execution-control', executionControlRoutes)`,
  `v8/index.ts:103`).
- **Mount status**: LIVE, twice over — `Gateway.ts:1385-1391` mounts
  `/api/v8/execution-control/manager` directly (bypassing the general
  `/api/v8` feature gate, per the comment at `Gateway.ts:1376-1381`), and
  the gated `/api/v8` mount (`Gateway.ts:1391`, `app.use('/api/v8',
  v8FeatureGate, v8Router)`) additionally exposes
  `/api/v8/execution-control/*` through `v8Router`.
- **FK to `initiatives`**: **confirmed absent.** Live-DB constraint check
  (`pg_constraint` on `v8_execution_runs`/`v8_action_proposals`) shows
  exactly one FK: `v8_action_proposals_execution_run_id_fkey`
  (`v8_action_proposals.execution_run_id -> v8_execution_runs.run_id`) — a
  self-referential link within Model 4 only. No FK to `initiatives`,
  `case_core`, or `ie_aggregate_state`.
- **Adapter to another model**: none found in this pass.

## Cross-model reality check (live DB)

```
 v8_action_proposals_execution_run_id_fkey | v8_action_proposals | v8_execution_runs
 case_core_project_id_fkey                 | case_core           | projects
 case_core_organization_id_fkey            | case_core           | organizations
 case_core_sponsor_user_id_fkey             | case_core           | users
```
No FK anywhere ties any of the four models' owner tables to `initiatives`
except through `case_core.project_id -> projects` (one hop removed, and only
for Model 2). This is schema-level proof, not a code-reading inference: the
four models cannot join to each other or to `initiatives` in SQL without an
application-layer bridge, and no such bridge was found.

## The four health-score formulas — confirmed distinct

| # | Location | Formula | Scope | Output |
|---|----------|---------|-------|--------|
| 1 | `server/src/controllers/ExecutionController.ts:438` | `Math.round((avgProgress + decisionHealth + taskHealth + riskHealth) / 4)` | per-project portfolio (initiatives filtered to `EXECUTING`/`BLOCKED`) | 0-100 number, plus separate GREEN/AMBER/RED per-initiative classifier (`ExecutionController.ts:474-537`) |
| 2 | `server/src/routes/reports.routes.ts:72` | `Math.round((avgProjectProgress + taskCompletionRate) / 2)` | org-wide project summary | 0-100 number -> `riskLevel` low/medium/high at `reports.routes.ts:73` |
| 3 | `server/src/routes/pmo/tasks.routes.ts:665` | threshold classifier on critical-path `criticalPercent` and `overdueCritical.length` (not an average) | one initiative/project's critical-path schedule | `scheduleHealth`: GREEN/AMBER/RED, no numeric score |
| 4 | `server/src/services/execution/threeAxisReportService.ts:202-204` (`computeScheduleHealth`) via `ratioRag()` (`threeAxisReportService.ts:160-162`) | `ratioRag(evm.spi)`: `>=0.95` GREEN, `>=0.85` AMBER, else RED | T/W/Z multi-axis (schedule/impact/cost) reading per initiative | `AxisRatio { ratio, rag }` — the file's own comment at line 724 states the RAG *thresholds* are "identical to evmService.indexRag" (an intentional shared constant), but the axis-reading object model itself (`computeAxisT/W/Z`, `computeImpactGap`, `computeDeliveryPromise`) is unique to this file and not used by 1-3 |

None of the four imports or calls another's health function. Formula 1 and 2
both compute a 0-100 average but from different, non-overlapping inputs
(initiative-progress-based vs. project-progress-based) and would disagree on
the same organization's data. Formula 3 is not a score at all, only a
threshold classifier. Formula 4 is the only one grounded in EVM (SPI), and is
explicitly the "same math" the file's own comment
(`threeAxisReportService.ts:390`) says was previously duplicated elsewhere
("agregacja portfelowa T/Z byla DOKLADNIE ta sama matematyka co
portfolio-health") — i.e. even the file's own authors flag this as a known
duplication risk, not a resolved one.

## What "ONE spine" would require

At minimum, unification requires:
1. **One canonical execution-unit table** (task/decision/risk/budget-line)
   that all four models read and write — today there are at least three
   distinct storage shapes for "a task": relational rows (`tasks`), JSON
   aggregate state (`ie_aggregate_state`), and Case Workspace's node-run
   records (`case_workspace_node_runs`).
2. **One FK path from `initiatives` to whichever table is canonical** — none
   exists today (see cross-model reality check above); this alone is a
   migration + backfill, not a code change.
3. **One health formula** replacing all four, with a single set of inputs
   (project/initiative progress, task completion, overdue risk/decisions,
   and — where available — EVM SPI/CPI) and a single output contract (number
   + RAG), consumed by `ExecutionController.ts`, `reports.routes.ts`,
   `pmo/tasks.routes.ts`, and `threeAxisReportService.ts` instead of each
   computing its own.
4. **Retirement or explicit demotion of at least two of the four models** —
   Model 1 (legacy PMO) and Model 3 (DDD engine) both claim ownership of
   "initiative tasks" with zero cross-reference; Model 4 (v8 spine) claims
   ownership of "AI-run approvals" with zero reference to `initiatives` at
   all, which is either a missing FK (bug) or evidence Model 4 was never
   actually integrated into the initiative lifecycle (design gap) — this
   pass could not distinguish the two without reading
   `execution-control.routes.ts`'s handler bodies, which is out of budget
   here and should be a follow-up.

This was **not** implemented in this pass, per the task's own instruction
("Do NOT implement unification").

## File count and in-lease / out-of-lease split

Files directly cited above, checked against
`docs/cleanup/agents/generated/CLAUDE_LANE_B_PATH_LEASE.json`:

**IN-LEASE** (lane B may touch): `server/src/controllers/ExecutionController.ts`,
`server/src/routes/pmo/tasks.routes.ts`,
`server/src/services/execution/threeAxisReportService.ts`,
`server/src/routes/pmo/initiatives.routes.ts`,
`server/src/routes/pmo/initiativesExecutionRuntime.routes.ts`,
`server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts`,
`server/src/domain/initiatives-execution/postgresInitiativeReader.ts`,
`server/src/services/initiative/initiativeCandidateService.ts`,
`server/src/routes/executionControl.routes.ts`,
`server/src/routes/v8/execution-control.routes.ts`,
`server/src/controllers/InitiativeController.ts`,
`server/src/services/caseWorkspace/caseCoreService.ts`,
`server/src/services/caseWorkspace/adapters/initiativeAdapter.ts`,
`server/src/services/caseWorkspace/executionGraphService.ts`.

**OUT-OF-LEASE** (owned by another lane/domain; would need an integrator
request to touch): `server/src/routes/reports.routes.ts`.

Given the in-lease files alone touch three of the four models plus two of
the four health formulas, a genuine unification is **not** a lane-B-only
change — it would require coordination across at least the `reports.routes`
owner and whoever owns `v8/execution-control.routes.ts`'s actual handler
logic (not directly inspected in this pass).

## Recommended target model (reasoning only, not implemented)

Recommend **Model 2 (Case Workspace) as the long-term canonical execution
spine**, for three reasons found in this pass:
1. It is the only model with a real governance/state-machine discipline
   (`case_status`, four closure axes, `case_workspace_gateway_evaluations`)
   rather than ad hoc status strings.
2. It already has a working adapter pattern
   (`server/src/services/caseWorkspace/adapters/*.ts`) designed exactly for
   bridging to other modules' native services — the missing piece is an
   Initiative-to-Case adapter symmetric to the existing Case-to-Initiative one
   (`initiativeAdapter.ts`), not a new architecture.
3. Per prior session memory (Case Workspace V1 kandydat / handoff notes),
   Case Workspace has the deepest existing test investment (583/588 at last
   handoff) of the four models.

This recommendation is **NOT_VERIFIED** against Model 4's actual capability
(v8 spine may be intentionally a separate "AI autonomous action" concern
rather than a competing execution spine) — the handler bodies of
`execution-control.routes.ts` were not read in this pass; a follow-up should
confirm before treating Model 4 as pure duplication.
