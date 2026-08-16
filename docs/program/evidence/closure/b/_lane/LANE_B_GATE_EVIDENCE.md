# Lane B — baseline evidence (Opus lead)

## Identity (G0)

- worktree: `/Users/piotrwisniewski/Developer/consultify-closure-claude-b`
- branch: `codex/closure-claude-b-transformation`
- baseline SHA = HEAD SHA = `64f507859c717494ffa5e83fae550173c9382230`
- tag `closure-execution-baseline-v2-20260816` (annotated, object `876d0942021fafd4f570c29796c1265a567de57c`) resolves to `64f507859c` — verified ancestor of HEAD, and HEAD == baseline exactly.
- `git status --porcelain`: empty at start and after dependency install.
- `node scripts/cleanup/verify-closure-lane.mjs b closure-execution-baseline-v2-20260816` → `lane B lease PASS: 0 changed paths; manifest f4d75f0aed94f2e34acaec63d91c245495e7e0f658aa36d1122342c2acecc612`
- Declared lease identity matches the contract's Lane B value.
- NOTE: the raw file digest of `CLAUDE_LANE_B_PATH_LEASE.json` is `bc4aca9bbc5e54d8cd4eee5afa75d7cc7c2c5cb3ddf9180b7706e6a34a1b34b1`; the `f4d75f0a…` value is the manifest's self-declared `.sha256` field, which `verify-closure-lane.mjs` echoes but does NOT recompute (script has no digest verification). The lease identity is therefore self-asserted, not machine-verified.

## Toolchain

Node v24.12.0 · npm 11.6.2 · Vitest 4.1.8 (installed; a pre-install `npx vitest --version` reported 4.1.10 from a non-project resolution — the authoritative value is `node_modules/vitest/package.json` = 4.1.8) · Playwright 1.62.1 · Docker 29.3.0 · PostgreSQL 16.14 (pgvector/pgvector:pg16). No local `psql` binary — all SQL run via `docker exec`.

Worktree had NO `node_modules` at start. Installed with `npm ci` at root and in `server/` (lockfile-respecting, non-mutating). Verified: `git status --porcelain` empty afterwards, lease still PASS.

## G1 (partial)

- `npm run test:inventory:generate` → 4997 entries; ACTIVE 4698 / INTENTIONALLY_EXCLUDED 7 / LEGACY 1 / PLAYWRIGHT 291.
  - **Gate defect:** this command writes tracked file `docs/program/METHOD_TOOLS_2026-08-13/test-inventory.json`, which is in NO lane lease (not A, B, C, or Codex). G1 therefore mandates a write that G0 forbids. Verified the only diff is the `generatedAt` timestamp — content identical — so the committed inventory IS current at baseline. File restored with a single-path `git checkout --`; worktree clean.
- `npm run test:discovery-gate` → `Discovery gate: PASS`, Discovered 4997 / Manifest 4997 / Executed 4698.
- `type-check`, `build:backend`, `build` — running.

## G3 strict migration gate — PASS at baseline

Isolated container, unique lane port, never a developer/demo DB:
- `ACCEPTANCE_PG_NAME=consultify-closure-b-64f50785`, port `127.0.0.1:55811`, image `pgvector/pgvector:pg16`.
- Local-DB guard: `server/src/config/databaseTargetResolver.ts:111-119` (`allowLocalDatabaseForTests`) permits a local host only under `NODE_ENV=test`, `CI=true`, `VITEST`, `VITEST_POOL_ID` or `JEST_WORKER_ID`. Used **`CI=true`** deliberately — `NODE_ENV=test` is known in this repo to substitute a mock DB. Without it the runner fails closed: "points to local host 127.0.0.1".

| Run | Command | Result |
| --- | --- | --- |
| 1 fresh | `CI=true DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts` | exit 0, `✅ Postgres migrations complete` |
| 2 repeat | same | exit 0, `Applying migrations: 0` |
| 3 dry-run | `… --dry-run` | exit 0, `Pending migrations: 0` |

Ledger readback: `schema_migrations` → `success = 703`, zero rows with status distinct from `success`, 703 total. 1678 non-system tables created. `to_regclass('public.tp_migration_history')` → NULL (no runtime Table Platform migrations in this schema).

`--safe` never used. No demo/dev database touched.

Observed ordering note: the applied sequence is not purely lexicographic — `948_tool_promotion_tenant_idempotency.sql` and several `20260802c…`/`20260810c…`/`20260813c…` files apply AFTER `20260831_…`. The reserved `20260911_claude_b_*` prefix must be checked against the runner's real ordering rule, not assumed to sort last.

## STRUCTURAL BLOCKER — lease coverage gap for Decisions/Tasks

Lease ceilings: A=719, B=2066, C=1943, Codex=1549 files; union 6277 of 24490 tracked files. The four ceilings are mutually disjoint as the contract claims, but they are **not exhaustive** over Lane B's assigned domain.

Of 158 B-domain server service/controller files, ownership is: B=116, C=5, Codex=7, A=1, **UNOWNED=29**.

The 29 unowned files are essentially the whole Decisions + Tasks + Inbox server implementation:

```
server/src/controllers/DecisionController.ts
server/src/controllers/DecisionPlaybookController.ts
server/src/controllers/TaskController.ts
server/src/services/TaskService.ts
server/src/services/ai/aiTaskCatalog.ts
server/src/services/ai/decisionAuditService.ts
server/src/services/ai/decisionMemoryService.ts
server/src/services/ai/taskAdvisorService.ts
server/src/services/ai/tools/createDecision.ts
server/src/services/ai/tools/createTask.ts
server/src/services/capitalDecisionService.ts
server/src/services/cqrs/task/CreateTask.ts
server/src/services/decisionCollaborationService.ts
server/src/services/decisionCopilotService.ts
server/src/services/decisionDelegationService.ts
server/src/services/decisionEscalationChainService.ts
server/src/services/decisionOutcomeService.ts
server/src/services/decisionPlaybookService.ts
server/src/services/decisionService.ts
server/src/services/decisionWorkflowService.ts
server/src/services/inboxAiAssistService.ts
server/src/services/inboxEnterpriseService.ts
server/src/services/inboxService.ts
server/src/services/inboxTriageService.ts
server/src/services/results/valueDecisionService.ts
server/src/services/taskAssignmentService.ts
server/src/services/taskSectionGenerationService.ts
server/src/services/taskWorkflowService.ts
server/src/services/v8/laneHeuristics/decisionsHeuristics.ts
```

These are live, not dead: `server/src/routes/my-work.routes.ts` (which IS leased to B) imports both `inboxService` and `TaskController`.

Impact: the packet assigns "Decisions/Tasks/Agent" to Lane B and requires "one writer per My Work projection", but the candidate multi-writer set for `decisions` and `tasks` lies outside every lease. Consolidating writers cannot be done inside the lease. This is an `INTEGRATOR_CHANGE_REQUEST` at lane scope, not a per-file one.

Also outside the lease (shared, as the contract intends): `src/routes/AppRoutes.tsx`, `src/routes/routeConfig.ts`, `server/src/routes/index.ts`, `package.json`, `vitest.config.ts`, `playwright.config.ts`. Lane B owns the domain route MODULES (`my-work.routes.ts`, `initiatives.routes.ts`, `execution.routes.ts`, `caseWorkspace/*`) but NOT the registry that mounts them → Lane B cannot mount a new route unaided.

## OWNER-TABLE FINDINGS (independently verified by Opus against the live 703-migration schema)

### F1 — the packet's canonical table `inbox_items` DOES NOT EXIST

`CLAUDE_LANE_B_15_TASKS_20260816.md` names `inbox_items` as a canonical owner record for
`MYW-REALDB-FIXTURE-AUTH-001` and `MYW-AGT-BVP-001`.
`select to_regclass('public.inbox_items')` on the schema built from all 703 migrations → NULL.

There is no single inbox table; there are THREE independent inbox projections, each with a different writer:

| table | production writers | lease owner |
| --- | --- | --- |
| `canonical_inbox_items` | `routes/my-work.routes.ts`, `services/inboxEnterpriseService.ts`, `services/inboxService.ts`, `services/v8/financeIntegrationHooks.ts` | B, UNOWNED, UNOWNED, UNOWNED |
| `ai_inbox` | `services/myWorkService.ts` | B |
| `v8_inbox_materializations` | `services/v8/myWorkRoofService.ts` | B |

Plus `ai_market_inbox`, `case_workspace_event_inbox`, `inbox_connector_items`, `my_work_inbox_triage`.
"One writer per My Work projection" is not merely unmet — the projection itself is not identified.

### F2 — `case_core` is declared RETIRED but Lane B writes to it at baseline

Lane acceptance: "no write to retired `case_core`, `ai_agent_plans` or downstream Results".
`case_core` exists in the live schema and is written by three Lane-B-OWNED services:
`services/caseWorkspace/caseCoreService.ts`, `caseIntakeService.ts`, `casePlanVersionService.ts`.
So the lane fails its own acceptance criterion at the sealed baseline, in files it owns — this is
in-lease, fixable work, not a blocker.

`ai_agent_plans` also still exists; its writers (`services/ai/agentPlannerService.ts`,
`services/ai/agentFolderService.ts`, `scripts/a04WorkerClaimContextRealDbProof.ts`) are ALL UNOWNED.

### F3 — multi-writer census (production code, excluding tests/_backup)

| table | distinct writer files | LaneB | LaneA | LaneC | Codex | UNOWNED |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `decisions` | 26 | 7 | 4 | 0 | 2 | 13 |
| `tasks` | 36 | 12 | 5 | 0 | 0 | 19 |
| `transformation_cases` | 15 | 3 | 1 | 0 | 0 | 11 |
| `canonical_inbox_items` | 4 | 1 | 0 | 0 | 0 | 3 |

Consequence: `MYW-AGT-BVP-001`'s "one canonical writer" and the lane-acceptance line
"one writer per My Work projection" cannot be satisfied inside the Lane B lease. Collapsing
`decisions` to one writer requires editing 19 files Lane B may not touch (13 unowned + 4 Lane A +
2 Codex); `tasks` requires 24 (19 unowned + 5 Lane A). This is a lane-scope
`INTEGRATOR_CHANGE_REQUEST`, and the affected tasks resolve to `BLOCKED_OWNER` after all
in-lease work is complete.

## GATE-INFRASTRUCTURE DEFECTS (verified empirically, not from docs)

1. **Backend tests run under jsdom.** `vitest.config.ts:355` uses `environmentMatchGlobs`, removed in
   Vitest 4; installed version is 4.1.8. Empirical probe: a test placed at
   `server/src/services/initiative/__tests__/` printed `PROBE_ENV=jsdom`. 138 of the 784 leased
   vitest files live under `server/src` and all run in the wrong environment.
2. **Silent retry.** `vitest.config.ts:311` `retry: process.env.CI ? 3 : 1` — the catalog's G2 command
   re-runs a local failure once and reports green. All lane runs add `--retry=0`.
3. **Playwright denominator is inflated.** `counts.playwright = 30`, but the list contains 4 `.png`
   baseline images, 1 `.html` fixture, and 3 extension-less files (`tests/e2e/initiatives.spec`,
   `myWork.spec`, `pmo-workflow.spec`) that Playwright's default `testMatch` cannot collect even
   though they contain 1, 13 and 9 `test.describe` blocks. Real runnable denominator = **22**, not 30.
4. **Playwright defaults to a mock DB.** `playwright.config.ts:43` `MOCK_DB=${E2E_MOCK_DB ?? 'true'}`;
   G4 forbids mock persistence, so every browser gate must explicitly set `E2E_MOCK_DB=false`.
5. **G2 as specified proves nothing about realDB.** The catalog command sets no `DATABASE_URL`/
   `RUN_DB_TESTS`, so `*.pg.test.ts` files fail or skip. Baseline chunk 1 alone: 255 skipped of 567.
   Lane B therefore runs G2 twice — catalog-exact, and a realDB pass with
   `RUN_DB_TESTS=1 MOCK_DB=false DATABASE_URL=<isolated>`.
6. **`NODE_ENV=test` alone forces a mock DB** (`server/src/database/Database.ts:80-89`); `CI=true` does
   not affect that branch, only the local-host guard. The correct realDB trio is
   `NODE_ENV=test` + `RUN_DB_TESTS=1` + `MOCK_DB=false`.
7. **Migration checksums are never re-verified by the runner** (`migrate.postgres.ts` skips any
   filename already `status='success'`). G3 requires checksum agreement, so Opus verified it
   independently: 703/703 stored checksums equal SHA-256 of the file at baseline; 0 mismatches,
   0 missing. `--safe` records failures as `skipped` and continues — never used here.
8. **Reporter misconfiguration:** both the junit and json reporters write to `junit.xml`, so the
   JSON reporter overwrites the JUnit output. Untracked/gitignored, so no lease impact.

## G2 — exact leased Vitest denominator at BASELINE (catalog-exact command + `--retry=0`)

Command: `jq -r '.tests.vitest[]' <lease> | xargs -n 80 npx vitest run --no-file-parallelism --maxWorkers=1 --maxConcurrency=2 --retry=0`
10 chunks, every chunk exit 1.

| metric | value |
| --- | ---: |
| lease `counts.vitest` | 784 |
| of which are helpers/harness/fixtures, not tests (uncollectable by any include glob) | 23 |
| real test files | 761 |
| collected by the mandated command | 747 |
| **leased test files the mandated command CANNOT collect** | **14** |
| Test Files: failed / passed / skipped | 107 / 557 / 83 |
| Tests: failed / passed / skipped / todo | 287 / 4270 / 617 / 0 |
| unhandled errors | 2 |

### G2-D1 — 14 leased acceptance tests are invisible to the mandated G2 command

All 14 live under `tests/acceptance/` and are collected only by `vitest.acceptance.config.ts`, never by the
default `vitest.config.ts` the catalog command uses. They count toward the lease denominator but the gate can
never execute them. They are exactly the lane-relevant realDB acceptance proofs:

```
tests/acceptance/h14-tools-initiatives.e2e.test.ts
tests/acceptance/h16-start-execution.e2e.test.ts
tests/acceptance/initiative-similarity.e2e.test.ts
tests/acceptance/integrate--decision-initiative-block-gate.e2e.test.ts
tests/acceptance/mw11-execution-lease.realdb.test.ts
tests/acceptance/o1-siri-adma-initiatives.e2e.test.ts
tests/acceptance/odbior--deccase--initiative-status-case.e2e.test.ts
tests/acceptance/odbior--ini005--canonical-start-execution.e2e.test.ts
tests/acceptance/odbior--pmoadm--pmo-admin-drift.e2e.test.ts
tests/acceptance/pmo-team-board.e2e.test.ts
tests/acceptance/red-pmo-500s.e2e.test.ts
tests/acceptance/red-pmo2-500s.e2e.test.ts
tests/acceptance/rvn-g4-mywork-commitment-decision-readback.e2e.test.ts
tests/acceptance/rvn-outbox-mywork-projection.e2e.test.ts
```

Lane B recovered them by running the same 14 files under `vitest.acceptance.config.ts` against the isolated
lane database with `NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres`:
**14 files → 4 failed / 10 passed; 105 tests → 14 failed / 91 passed.** So they execute and carry real
signal; the catalog gate simply never sees them.

### G2-D2 — 124 leased realDB tests are run without a database by the mandated command

110 further leased files match `*.pg.test.ts` / `*.realdb.test.ts` and ARE collected by the default config,
but the catalog G2 command sets no `DATABASE_URL`/`RUN_DB_TESTS`/`MOCK_DB`, so they skip or fail. Together
with the 14 above, **124 of 761 leased test files (16%) are realDB tests that the gate cannot prove**. This
accounts for the bulk of the 617 skipped tests and part of the 287 failures. Exit status alone is therefore
not evidence for this lane; a separate realDB pass is mandatory and Lane B runs one.

### Tooling correction

An earlier attempt to compute the collected set used `xargs -a`, which BSD/macOS `xargs` does not support;
with stderr suppressed it silently produced "0 collected". That was a harness error, not a finding — the
figure was recomputed with `cat … | xargs -n 200 npx vitest list --filesOnly`. Recorded because the same
mistake would silently zero out any denominator on macOS.

## REFUTATIONS — findings that did NOT survive verification

Recorded because a closure record that only accumulates alarms is not honest.

1. **`transformationCaseService.ts` CAS inconsistency is a syntax inconsistency, NOT a lost-update bug.**
   The earlier inventory flagged ~6 `UPDATE transformation_cases` sites lacking `AND version = ?`. Verified
   structurally: 34 UPDATE sites, 47 `SELECT … FOR UPDATE` row locks, 87 `expectedVersion`/version-conflict
   references; every updating function takes the row lock first, and call sites raise 409 on version
   mismatch before mutating. The residual genuine gap is narrow: `bindTransformationCaseProject` takes no
   `expectedVersion` parameter at all — safe from lost updates via the lock, but unable to report staleness
   to a caller. Severity: low. Not empirically raced, so the lock discipline is asserted structurally.

2. **The "one candidate → two initiatives" classic path is genuinely protected.**
   `initiativeCandidateService.acceptCandidate` routes through the canonical funnel and claims with a
   conditional `WHERE … AND initiative_id IS NULL`, reading back the winner on loss. The real defect is
   narrower and different: a SECOND subsystem claims the same row through DISJOINT columns (see INI-BVP-001).

3. **`routes/assessment/assessments.routes.ts` is dead code**, so it is NOT a second live
   "generate initiatives from assessment" writer — its aggregator `routes/assessment/index.ts` has no
   importer anywhere in `server/src`. One suspected duplicate writer eliminated.

4. **The acceptance harness does not have a zero-test vacuous-pass path.** No vitest config sets
   `passWithNoTests`, and Vitest 4 defaults it to `false`, so a zero-match run exits non-zero. The real
   vacuous-pass risk in that harness is `tests/acceptance/schema.mjs` swallowing per-file SQL errors, not
   the runner's exit plumbing.

5. **Case Workspace services are not orphans.** The "tests-only code" trap did not reproduce for
   `caseWorkspace/*Service.ts` — each has at least one production caller. The historical instance of that
   trap (the outbox worker that nothing invoked outside its own tests) is documented as already fixed at
   `server/src/index.ts` ~2013.

## Additional confirmed findings

- **`case_core` has a SECOND, unconditional write surface**: `/api/v10/teresa/case-intake/.../confirm`
  (`server/src/routes/v10/teresa.routes.ts:328-341` → `caseIntakeService.confirmWorkOrder`), mounted
  independently of `ENABLE_V8_GLOBAL`. Retiring `case_core` would mean retiring the whole Case Workspace UI
  AND the Teresa chat-intake flow. Recommendation: do not retire; harden.
- **`ie_outbox_events` is a write-only dead table** — exactly one production reference (an INSERT at
  `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts:570`), zero consumers.
  Same failure mode previously found and fixed for `case_workspace_event_outbox`.
- **`compileT01TransformationPlan()`** (`server/src/services/v8/transformationCaseService.ts:915-921`)
  returns a STATIC hard-coded blueprint identical for every case; several of its steps self-report
  `capabilityStatus: 'NOT_CONNECTED'`. The "conversation → plan" step is not derived from the conversation.
- **RBAC on initiative writes is unenforced at shipped defaults** — `requireInitiativeCapability(…, { shadow: true })`
  in `server/src/routes/pmo/initiatives.routes.ts`, and `server/src/middleware/effectiveCapability.middleware.ts`
  permits everyone unless `CAPABILITY_ENFORCE`/`EFFECTIVE_ACCESS_ENFORCE` is set. Systemic across the file.

## F4 — the "unstarted consumer" defect class: THREE confirmed instances

This repo has a recurring, high-severity failure mode: a well-built producer writes durable rows, and the
consumer that drains them is never started in production. It has bitten before (`case_workspace_event_outbox`
sat unconsumed until fixed — documented at `server/src/index.ts` ~2005-2016). Lane B found three more.

| # | producer | consumer | status |
| --- | --- | --- | --- |
| 1 | `ie_outbox_events` — INSERT at `server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork.ts:570` | none anywhere | write-only dead table (Opus-verified: exactly one production reference, an INSERT) |
| 2 | `v8_agent_canonical_projection_outbox` — writer in `server/src/services/v8/agentOperatorConsoleService.ts` | `processCanonicalProjectionOutbox` called only from the manual proof script `server/src/scripts/a11OperatorConsoleRealDbProof.ts` | never runs at boot or on cron |
| 3 | **`ai-tasks` BullMQ queue** — every agent-plan create/run/schedule enqueues onto it | `initWorker()` in `server/src/workers/aiWorker.ts:98` (the only `new Worker('ai-tasks', …)` in the repo, `:105`) | **zero callers** |

Instance 3 is the most severe and was verified independently by Opus:
- `grep -rn "new Worker("` over `server/src` (excluding tests) → one hit, `workers/aiWorker.ts:105`;
- `grep -rn "initWorker"` → only its own definition (`:98`), export (`:124`) and default export (`:126`) — no caller;
- `grep -rn "aiWorker"` outside the file itself → zero hits;
- no `Procfile`; `server/package.json` `start` is `node dist/src/index.js` only.

Consequence: a non-draft agent plan create, an explicit `/run`, or a scheduler-promoted plan is enqueued and
then **never executes** — it stalls in `planning`/`scheduled` forever, with no failure surfaced. The
duplicate-prevention machinery (execution fencing token in `server/migrations/941_ai_agent_plan_execution_lease.sql`,
run idempotency key in `942_ai_agent_plan_run_idempotency.sql`) is real, enforced CAS logic — but it guards a
path that never runs. Provider failures do fail closed when execution happens; the live failure mode is a
silent stall, not a false success.

Telemetry is near-absent on this surface: zero `logger.*` calls in `agentOperatorConsoleService.ts`, one in
`agentPlannerService.ts`, no metrics.

LEASE: `agentPlannerService.ts`, `agentFolderService.ts`, `agentOperatorConsoleService.ts`,
`agentCanonicalRunService.ts`, `workers/aiWorker.ts`, `server/src/index.ts`, `routes/ai/agent-plan.routes.ts`
and `agentPlanSchedulerJob.ts` are ALL outside every lane lease. The fix is two boot-wiring calls,
mechanically identical to the existing `case_workspace_event_outbox` fix — but Lane B may not make it.
→ `AGT-OPS-001` = `BLOCKED_OWNER` with an integrator change request.

## F5 — the Initiative→Execution link does not exist at schema level

Opus-verified against the live schema: `case_core` has **no `initiative_id` column**, and its only foreign
keys are `case_core_organization_id_fkey → organizations`, `case_core_project_id_fkey → projects`,
`case_core_sponsor_user_id_fkey → users`. There is no Initiative→Execution intake adapter in code either
(`caseWorkspace/intake.routes.ts` is Chat/Teresa→Case). The only Initiative-adjacent adapter runs the
REVERSE direction (a Case creates an Initiative as an output artifact).

So `EXE-BVP-001`'s required chain "Initiative → case → … → exactly one Results signal" breaks at step 1
structurally, not merely in implementation. It also breaks at the exits: no listener consumes
`case.closure_recorded`, and the only Results touchpoint is a manual, closure-independent scorecard-create
capability. → `FIX_REQUIRED`, and the "exactly one Results signal" requirement is architecturally
ambiguous (the Results object it should target is not agreed) rather than simply unbuilt.

Evidence is not an approval gate: `case_core.closure_evidence_ref` is a plain text column, and
`server/src/services/caseWorkspace/caseCoreService.ts:889` accepts any truthy string for
`COMPLETED_PARTIAL` closure with no lookup into `case_workspace_artifact_links`; the HTTP schema
(`cases.routes.ts:217-219`) imposes no format constraint either.

## F6 — read models: 2 persisted, 3 computed; one not reproducible even in principle

For `INI-MVP-PORTFOLIO-001` the five required read models split:
- persisted (real CRUD tables): **Resource** (`initiative_resources`), **Roadmap** (`roadmap_waves`);
- computed live, zero persistence: **Portfolio** (`server/src/services/v8/planningPortfolioReadService.ts:143`),
  **Timeline**, **Capacity**.
Timeline is anchored to `new Date()` on every call plus a data-presence-dependent fallback branch, so it is
**not reproducible even in principle** — "idempotent rebuild with restart/readback" is not merely unmet, it
is undefined for that model as currently designed. Capacity has two independent, non-shared implementations
(`CapacityController.ts` vs `workloadCapacityService.ts:377`) — the same duplication pattern as the four
health formulas. 4 of the 8 central files are outside the lease → integrator request required.
