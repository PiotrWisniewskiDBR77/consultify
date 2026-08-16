# AGT-OPS-001 — Agent runtime operability analysis

Lane B, task `AGT-OPS-001`. Evidence-only (no source files touched). Worktree:
`/Users/piotrwisniewski/Developer/consultify-closure-claude-b`. Base SHA at
inspection time: `64f507859c717494ffa5e83fae550173c9382230` (`git rev-parse HEAD`).
DB used for §6: lane container `consultify-closure-b-64f50785`, database
`consultinity`, user `consultinity`.

All claims below are cited `path:line`. Anything not directly observed is
marked **NOT_VERIFIED**.

---

## 1. Agent runtime inventory — what actually constitutes "the agent runtime"

There are **two independent execution systems** that both call themselves
"agent", with different owners, different tables, and (critically) different
consumer status:

### 1a. `agentPlannerService` / "Uruchom agenta z Teresy" (Plan mode)

- Service: `server/src/services/ai/agentPlannerService.ts` (1261 lines).
- Companion: `server/src/services/ai/agentFolderService.ts` (folders for
  plans, "Moje procesy" — `server/src/services/ai/agentFolderService.ts:1-20`).
- Route: `server/src/routes/ai/agent-plan.routes.ts` — full CRUD + run/approve/
  schedule/cancel, documented in its own header
  (`server/src/routes/ai/agent-plan.routes.ts:15-34`).
- Mount chain (traced, all confirmed present in this worktree):
  1. `server/src/routes/ai/agent-plan.routes.ts` imported and mounted at
     `/agent-plan` in `server/src/routes/ai/index.ts:10,81`.
  2. `routes/ai/index.ts`'s router (`aiDomainRoutes`) imported into
     `server/src/Gateway.ts:45` and mounted at `app.use('/api/ai', aiDomainRoutes)`
     — `server/src/Gateway.ts:570`.
  3. Effective route: **`/api/ai/agent-plan`** (+ subpaths). No `v8FeatureGate`
     or other flag wraps this mount (`server/src/Gateway.ts:568-571` — plain
     `app.use`, unlike the `v8FeatureGate`-wrapped mounts a few lines below).
- Flag: `src/utils/agentPlanFlag.ts` (`ff_agentPlan`) gates only the **frontend**
  panel (`AgentPlanPanel`). Its own header states explicitly the backend
  router "istnieje niezależnie od tej flagi" (`src/utils/agentPlanFlag.ts:10-13`).
  Default resolution: query → localStorage → `VITE_AGENT_PLAN` → **default ON**
  (`src/utils/agentPlanFlag.ts:38-46`, comment: "HP-4 domknięty ... default ON").
  **Conclusion: the backend endpoint is live in production for every
  authenticated user regardless of any flag state.**

### 1b. `agentOperatorConsoleService` / `agentCanonicalRunService` (V8 operator console)

- Service: `server/src/services/v8/agentOperatorConsoleService.ts` (313 lines).
- Companion: `server/src/services/v8/agentCanonicalRunService.ts` (canonical
  run alias registry — `export`s at lines 18, 49, 126, 200, 224, 248).
- Route families, all mounted inside `server/src/routes/v8/index.ts`:
  - `/agent-process-templates` → `server/src/routes/v8/index.ts:92`
  - `/agent-operations` → `server/src/routes/v8/index.ts:93` (also a bootstrap
    sub-router mounted earlier at line 74, before the tenant-activation gate)
  - `/agent-quality` → `server/src/routes/v8/index.ts:94`
  - `/agent-proposals` → `server/src/routes/v8/index.ts:95`
  - `/multi-agent` → `server/src/routes/v8/index.ts:126`
- `v8Router` (the module these all live inside) is imported at
  `server/src/Gateway.ts:399` and mounted as
  `app.use('/api/v8', v8FeatureGate, v8Router)` — `server/src/Gateway.ts:1394`.
- Gate: `v8FeatureGate` (`server/src/middleware/v8FeatureGate.middleware.ts:14-21`)
  is a **hard 404** unless `process.env.ENABLE_V8_GLOBAL === 'true'`. There is
  a second, org-level gate (`v8OrgGate` / `createV8ModuleGate`,
  `server/src/middleware/v8FeatureGate.middleware.ts:27-109`) that falls back
  to "allow" when an org has zero explicit V8 flag rows AND
  `NODE_ENV !== 'production'` (`allowImplicitOrgRowsFallback`,
  `server/src/middleware/v8FeatureGate.middleware.ts:7,42`). In production
  with no explicit org flag row, the org-level gate 404s too.
  **Actual value of `ENABLE_V8_GLOBAL` on the demo/prod deployment was NOT
  checked (no access to Railway env from this worktree) — NOT_VERIFIED,
  but the code default (env var absent/unset) is OFF (404).**

### Two systems, two data models

`agentPlannerService` writes `ai_agent_plans` / `ai_agent_plan_steps`.
`agentOperatorConsoleService` reads/writes `v8_execution_runs`,
`v8_agent_work_graphs`, `v8_agent_branch_tasks`,
`v8_agent_canonical_projection_outbox`, `v8_agent_operator_recovery_events`
(`server/src/services/v8/agentOperatorConsoleService.ts:18-40, 275-289`).
They are bridged only via `agentCanonicalRunService.projectCanonicalRunAfterExternalTransition`
(`server/src/services/v8/agentOperatorConsoleService.ts:6,310`) and a
`canonical_run_id` column on `ai_agent_plans` (confirmed live, §6).

---

## 2. Outbox — `v8_agent_canonical_projection_outbox`

**Verdict: write-only table, zero production consumer. Same failure category
as the pre-fix `case_workspace_event_outbox` and the still-broken
`ie_outbox_events`.**

Evidence:

- Writer: `agentOperatorConsoleService.recoverAgentRunTarget` inserts a row
  with `status='pending'` on every operator cancellation
  (`server/src/services/v8/agentOperatorConsoleService.ts:285`).
- Claim: `processCanonicalProjectionOutbox` claims `pending`/`failed` rows
  with `FOR UPDATE SKIP LOCKED` and marks them `claimed` with
  `claim_owner`/`claimed_at`/`attempt_count` (`server/src/services/v8/agentOperatorConsoleService.ts:303-310`),
  then applies them via `projectCanonicalRunAfterExternalTransition` and
  flips to `applied` or `failed` (`server/src/services/v8/agentOperatorConsoleService.ts:310`).
  This claim/lease implementation itself is correct and well-built, exactly
  as the prior inventory reported.
- **Callers of `processCanonicalProjectionOutbox` in the entire repo (verified
  by `grep -rn "processCanonicalProjectionOutbox" --include="*.ts" .`,
  excluding `node_modules`):**
  - `server/src/scripts/a11OperatorConsoleRealDbProof.ts:236-237` — a one-off,
    manually-run proof/verification script.
  - The function's own definition
    (`server/src/services/v8/agentOperatorConsoleService.ts:303`).
  - **Nothing else.** No cron entry in `server/src/cron/Scheduler.ts`, no
    call from `server/src/index.ts`, no route handler that runs it on a
    schedule or on request.
- `server/src/index.ts` boots several outbox/queue drains explicitly and by
  name (`startNotificationOutboxDrainCron` — `server/src/index.ts:1989-1991`;
  `startPlatformOutboxDrainCron` — `server/src/index.ts:1999-2001`;
  `startCaseWorkspaceOutboxWorker` — `server/src/index.ts:2013-2016`, with an
  explicit comment at `server/src/index.ts:2006-2011` documenting that this
  exact one was previously write-only and had to be fixed). **There is no
  equivalent boot line for `v8_agent_canonical_projection_outbox`.**

Live-schema confirmation (§6): the table exists with `status`, `claim_owner`,
`claimed_at`, `attempt_count`, `applied_at`, `last_error` columns exactly as
the code implies, and a `status` CHECK constrained to
`pending|claimed|applied|failed`. The lane DB currently has 0 rows (fresh
test DB — not evidence of production behavior, only schema confirmation).

**Category: confirmed write-only / zero consumer**, alongside `ie_outbox_events`.
Rows written by `recoverAgentRunTarget` (an operator-triggered work-graph
cancellation) will sit in `pending` forever in any real deployment unless an
operator manually runs the proof script or some other undiscovered process
invokes `processCanonicalProjectionOutbox`. Practical effect: a cancellation
recorded via `v8_agent_operator_recovery_events` and the underlying
`v8_agent_work_graphs`/`v8_agent_branch_tasks` status updates **does** take
effect synchronously inside the same transaction
(`server/src/services/v8/agentOperatorConsoleService.ts:279-284`) — the
outbox row is only for propagating the transition into the *canonical run*
projection (`agentCanonicalRunService`). So the immediate operator-facing
effect of a cancellation is real; what silently never happens is the
canonical-run-level reconciliation this outbox exists to drive.

---

## 3. `ai_agent_plans` dispatch — a second, separate write-only queue

This was not explicitly asked for as its own numbered item but is the more
consequential finding and directly affects §4 below, so it is documented
here as part of the outbox picture.

- Every non-draft plan create (`POST /api/ai/agent-plan`,
  `server/src/routes/ai/agent-plan.routes.ts:230-322`) and every explicit run
  (`POST /:id/run`, `server/src/routes/ai/agent-plan.routes.ts:377-462`) calls
  `tryDispatchBackgroundExecution` (`server/src/routes/ai/agent-plan.routes.ts:169-197`),
  which enqueues a BullMQ job `AGENT_BACKGROUND_TASK` onto the `ai-tasks`
  queue (`server/src/routes/ai/agent-plan.routes.ts:188-192`, using
  `server/src/queues/aiQueue.ts:50` — a plain producer-side `new Queue('ai-tasks', ...)`).
- The scheduler cron (`server/src/jobs/agentPlanSchedulerJob.ts`) — which
  **is** wired into `server/src/cron/Scheduler.ts:735` and therefore does run
  at boot — promotes `scheduled` plans and resumed `wait_until` steps by
  enqueuing the **same** `AGENT_BACKGROUND_TASK` job onto the same queue
  (`server/src/jobs/agentPlanSchedulerJob.ts:1-16, 27-46`).
- The only consumer of the `ai-tasks` queue anywhere in the codebase is
  `server/src/workers/aiWorker.ts`, specifically `initWorker()`
  (`server/src/workers/aiWorker.ts:98-121`), which does
  `new Worker('ai-tasks', processor, redisConfig)` — the **only**
  `new Worker(` call in the entire `server/src` tree (verified by
  `grep -rn "new Worker(" server/src --include="*.ts"`, excluding tests).
- **`initWorker()` has zero callers anywhere in the repository.** Verified by:
  - `grep -rn "initWorker" server/src` → only its own definition/export in
    `server/src/workers/aiWorker.ts:98,124,126` (and an unrelated stale copy
    under `server/src/_backup/ts-js-collisions/`, which is dead/backup code
    by its own directory name, not part of the running server).
  - `grep -rln "aiWorker" --include="*.ts" .` (repo-wide, excluding
    `node_modules`) → only `server/src/routes/ai/agent-plan.routes.ts:53`
    (a **comment** citing the line number, not an import) and a stale
    structural-report JSON under `tests/migration/reports/`.
  - `server/src/index.ts` has no reference to `aiWorker`/`initWorker` at all
    (checked directly).
  - Deploy-time process definitions checked: `Procfile.organization-context-worker`
    (only defines `web`/`worker` processes for the *organization-context*
    worker, unrelated), `railway.json`, `railway.api.json` (single Dockerfile
    service, no second worker process), `Dockerfile.api` (`CMD`/`ENTRYPOINT`
    only run the API server, `Dockerfile.api:386,418`). No deployed process
    anywhere starts a BullMQ `Worker` for `ai-tasks`.

**Conclusion: `ai-tasks` is a write-only BullMQ queue in this codebase.**
Every agent plan that is dispatched (non-draft create, explicit `/run`, or
the scheduler cron promoting a `scheduled`/`wait_until` plan) is enqueued and
then **never picked up**. The plan silently stays in whatever status it was
in before dispatch (`planning` or `scheduled`) — it never reaches
`executing`, so it never reaches `completed`, `completed_with_errors`, or
`failed` either. This is the same anti-pattern as `case_workspace_event_outbox`
before its fix and `ie_outbox_events` today, just one layer removed (a queue,
not a DB outbox table) and with no equivalent fix landed yet.

This directly means the elaborate lease/fencing/idempotency machinery in
§4 below (`claimExecution`, heartbeat renewal, retry-with-backoff) is
correct, tested code that **never runs in a real deployment**, because
nothing ever calls `agentPlannerService.executePlan` / `executeBackgroundPlan`
outside of unit/integration tests and the one BullMQ processor case branch
that itself is never invoked (`server/src/workers/aiWorker.ts:81-84`).

---

## 4. Duplicate prevention (`ai_agent_plans` fencing + idempotency)

Both mechanisms are enforced in code, not merely present as columns —
verified independent of whether the execution path is ever reached (§3):

### 941 — execution lease / fencing token

- Migration: `server/migrations/941_ai_agent_plan_execution_lease.sql` adds
  `execution_owner_token`, `execution_fencing_token` (default 0),
  `execution_lease_expires_at`, `execution_heartbeat_at`, plus a partial
  index on `(status, execution_lease_expires_at) WHERE status='executing'`.
- Enforcement: `claimExecution()` does an atomic `UPDATE ... WHERE id=? AND
  (status IN ('planning','scheduled','awaiting_approval','paused') OR
  (status='executing' AND (lease IS NULL OR lease <= now())))`
  (`server/src/services/ai/agentPlannerService.ts:223-243`) — a real
  compare-and-swap: only one caller can flip status to `executing` and bump
  the fencing token; a second concurrent caller gets `result.changes === 0`
  and returns `null` (`server/src/services/ai/agentPlannerService.ts:249`),
  which the route/worker treats as "someone else has it"
  (`server/src/services/ai/agentPlannerService.ts:493-495`).
- Lease TTL: 300s, heartbeat renewed every 60s during execution
  (`server/src/services/ai/agentPlannerService.ts:128-129, 566-573`), so a
  crashed executor's lease naturally expires and becomes reclaimable by the
  `WHERE` clause above — no separate reaper process is needed for this part.
- Step writes are gated by the same fencing token
  (`guardedStepRun`/lease WHERE clause pattern at
  `server/src/services/ai/agentPlannerService.ts:322-327,335`), so a
  lease-losing executor cannot silently keep writing results after another
  owner reclaims the plan.

### 942 — run-submission idempotency

- Migration: `server/migrations/942_ai_agent_plan_run_idempotency.sql` adds
  nullable `run_idempotency_key`.
- Enforcement: `claimRunSubmission()` does `UPDATE ... SET run_idempotency_key=?
  WHERE id=? AND status='planning' AND run_idempotency_key IS NULL`
  (`server/src/services/ai/agentPlannerService.ts:280-297`) — again a real
  CAS, not just a stored value. The route (`POST /:id/run`,
  `server/src/routes/ai/agent-plan.routes.ts:377-462`) uses the three
  possible outcomes (`already-mine` / `conflict` / claimed) to return an
  idempotent replay, a 409, or to proceed exactly once
  (`server/src/routes/ai/agent-plan.routes.ts:415-462`). A failed/unavailable
  dispatch releases the claim so a genuine later retry is not permanently
  blocked (`server/src/routes/ai/agent-plan.routes.ts:451-455`, backed by
  `releaseRunSubmissionClaim` at `server/src/services/ai/agentPlannerService.ts:305-317`).

**Both mechanisms are real, tested-looking CAS logic — not decorative
columns.** The important caveat is §3: since the background dispatch is
never consumed, in practice these guards currently only prevent duplicate
*enqueue* / duplicate *replaceSteps*, not duplicate *execution*, because no
execution is currently happening at all in a real deployment.

---

## 5. Restart / long-run / provider failure behaviour

- **Restart while executing:** covered by the lease/fencing mechanism above
  (§4). If the process holding a lease dies mid-plan, the lease naturally
  expires after 300s and `claimExecution`'s `WHERE` clause allows a fresh
  claim (`server/src/services/ai/agentPlannerService.ts:223-243`). This is
  correct **in principle** — it has simply never been exercised in
  production because nothing currently reaches `executing` at all (§3).
- **Long-run (wait steps):** `wait_until` steps compute an explicit
  `resumeAt` and park the plan in `awaiting_approval`
  (`server/src/services/ai/agentPlannerService.ts:508-523`); the same
  never-consumed scheduler cron is responsible for resuming them
  (`server/src/jobs/agentPlanSchedulerJob.ts:12-16`) — also currently inert
  end-to-end for the same reason as §3 (the cron enqueues correctly, but
  nothing dequeues).
- **Provider/tool failure — fails closed, not falsely successful:**
  `runToolWithRetry` retries up to 3 attempts with a fixed 400ms delay and
  re-throws the last error if all attempts fail
  (`server/src/services/ai/agentPlannerService.ts:1237-1258`); the caller
  catches that, sets the step to `status='failed'` with an explicit
  `error_message`, persists it, and emits an `agent_step_complete` event with
  `success:false` (`server/src/services/ai/agentPlannerService.ts:606-627`).
  A failed step does **not** stop the plan (explicit "continue-on-error"
  design decision documented at
  `server/src/services/ai/agentPlannerService.ts:461-478`) but the plan's
  final status becomes `completed_with_errors`, never a silent `completed`
  (per the same doc comment). **No path was found that reports false success
  for a provider failure** — the visible failure modes are either an
  explicit `failed` step/plan, or (per §3) the plan simply never starts
  executing and stays stuck in `planning`/`scheduled` with no error surfaced
  to the user at all (a *silent stall*, which is arguably worse than a
  false success for operability, though not a false-success bug per se).
- There is no request-level timeout wrapper visible around the tool call
  itself in `runToolWithRetry`
  (`server/src/services/ai/agentPlannerService.ts:1237-1258`) — timeout
  behaviour, if any, would have to come from the underlying
  `toolExecutor`/provider client. **NOT_VERIFIED**: whether the AI provider
  client itself enforces a timeout was out of scope for this pass (would
  require reading `toolDefinitions.ts` / the underlying LLM client, which is
  a large surface outside this task's file list).

---

## 6. Live-schema check (lane DB)

Run against `consultify-closure-b-64f50785`, database `consultinity`:

- `v8_agent_canonical_projection_outbox` — **exists**, columns match code
  usage exactly: `outbox_id, organization_id, execution_run_id, alias_type,
  external_id, actor_user_id, reason, status (default 'pending', CHECK IN
  pending/claimed/applied/failed), attempt_count (default 0), claim_owner,
  claimed_at, applied_at, last_error, created_at, updated_at`. Unique
  constraint on `(organization_id, execution_run_id, alias_type, external_id,
  reason)`. 0 rows (fresh lane DB, not evidence of production volume).
- `ai_agent_plans` — **exists**, includes all of `execution_owner_token,
  execution_fencing_token (bigint, default 0), execution_lease_expires_at,
  execution_heartbeat_at, run_idempotency_key, folder_id, canonical_run_id`
  plus a partial index `idx_ai_agent_plans_execution_lease` on
  `(status, execution_lease_expires_at) WHERE status='executing'`. 0 rows.
- `ai_agent_plan_steps` — **exists**, columns match code usage
  (`plan_id, step_index, tool_name, tool_input_json, status, result_json,
  error_message, requires_approval, approved_by, approved_at, started_at,
  completed_at, duration_ms`), FK to `ai_agent_plans(id) ON DELETE CASCADE`.

Full `\d` output captured during this session; not reproduced verbatim here
to keep this document readable, but every column named in §2/§3/§4 above was
directly confirmed present with the type/constraint stated.

---

## 7. Lease reality — can this task even be closed from Lane B?

Checked with the exact command specified in the task brief:
`jq -r '.files[]' docs/cleanup/agents/generated/CLAUDE_LANE_B_PATH_LEASE.json | grep -qxF "<path>"`.

| File | In Lane B lease? |
|---|---|
| `server/src/services/ai/agentPlannerService.ts` | **NO** |
| `server/src/services/ai/agentFolderService.ts` | **NO** |
| `server/src/services/v8/agentOperatorConsoleService.ts` | **NO** |
| `server/src/services/v8/agentCanonicalRunService.ts` | **NO** |
| `server/src/workers/aiWorker.ts` | **NO** |
| `server/src/index.ts` | **NO** (checked directly; not in original file list but confirmed absent by the same grep pattern) |
| `server/src/routes/ai/agent-plan.routes.ts` | **NO** |
| `server/src/jobs/agentPlanSchedulerJob.ts` | **NO** |

Lease file: `docs/cleanup/agents/generated/CLAUDE_LANE_B_PATH_LEASE.json`,
2066 total leased paths for Lane B, `authorityHead: c40a9ba58e28ccc78bdef8d1f61f64db60e088eb`.
None of the eight files above appear anywhere in it.

**This confirms the task brief's suspicion: every file that would need to
change to fix the dead `ai-tasks` consumer or the dead
`v8_agent_canonical_projection_outbox` consumer is outside every lease this
executor can touch.** The fix (adding a boot-time call analogous to
`startCaseWorkspaceOutboxWorker()` for `aiWorker.initWorker()`, and an
analogous cron/boot call for `processCanonicalProjectionOutbox`) is
mechanically simple and directly modeled on the pattern already used for
`case_workspace_event_outbox`/`notification_outbox`/`platform` outbox drains
in `server/src/index.ts:1983-2019` — but it cannot be made from this lane
without an integrator or a lease grant.

---

## 8. Telemetry

- `agentOperatorConsoleService.ts` has **zero** `logger.*` calls anywhere in
  the file (`grep -c "logger\." server/src/services/v8/agentOperatorConsoleService.ts`
  → 0). Failures inside `processCanonicalProjectionOutbox` are recorded only
  as a `last_error` column value on the outbox row itself
  (`server/src/services/v8/agentOperatorConsoleService.ts:310`) — nothing is
  emitted to structured logs or any metrics system if a projection fails.
- `agentPlannerService.ts` has exactly **one** `logger.*` call in 1261 lines
  (a `logger.warn` inside `runToolWithRetry`,
  `server/src/services/ai/agentPlannerService.ts:1252`). Lease loss,
  persistence failures (`AgentExecutionLeaseLostError`,
  `AgentResultPersistenceError`), and dispatch failures are raised as
  JS exceptions/return values but not logged at the service layer — the
  route layer (`agent-plan.routes.ts`) does its own logging (10 `logger.*`
  calls, e.g. `server/src/routes/ai/agent-plan.routes.ts:143-146` for
  dispatch-unavailable) but only covers the HTTP-request-time path, not the
  (currently inert, §3) background-worker path.
- Correlation IDs: found exactly one usage in this whole surface —
  `getAgentRunOperationalSnapshot` passes `correlationId: input.executionRunId`
  into some downstream call (`server/src/services/v8/agentOperatorConsoleService.ts:92`).
  No correlation ID threading was found in the outbox writer/claimer
  functions themselves, nor in `agentPlannerService`'s dispatch/execute path.
- No Prometheus-style metrics (`Counter`/`Histogram`/`Gauge`) or any
  `metrics.*` calls exist anywhere in `agentPlannerService.ts` or
  `agentOperatorConsoleService.ts` (checked directly; the repo does use such
  patterns elsewhere, e.g. `resultsVnext/platform/*`, but not here).
- **Net assessment: telemetry for this subsystem is thin to absent.** Given
  §2/§3 (both write paths currently have zero consumer), the near-total lack
  of logging/metrics on the write side is exactly why these dead-consumer
  bugs are invisible until someone greps for `new Worker(` or
  `processCanonicalProjectionOutbox` callers by hand, as this analysis did.
  There is no dashboard, alert, or log line that would tell an operator
  "N rows have been `pending` in `v8_agent_canonical_projection_outbox` for
  longer than X minutes" or "N agent plans have been stuck in `planning`
  after a non-draft dispatch for longer than X minutes." A runbook alone does
  not fix this — see the runbook's own limitations note.

- **Existing runbook:** none found for this subsystem specifically.
  `docs/product/V3_SPRINT_AGENT_RUNBOOK.md` exists but documents an unrelated
  process (how to run a *Claude coding agent* per V3 sprint) — not this
  runtime agent-execution system. A new runbook was written for this task:
  `docs/program/evidence/closure/b/AGT-OPS-001/AGENT_OPS_RUNBOOK.md`.

---

## Summary of findings by severity

1. **CRITICAL — `ai-tasks` BullMQ queue has zero consumers anywhere in the
   deployed system.** Every dispatched agent plan (non-draft create, `/run`,
   or scheduler-promoted `scheduled`/`wait_until` plan) is enqueued and then
   never executed. Plans silently stall in `planning`/`scheduled` forever.
   File to fix (`server/src/index.ts`) is **outside every Lane B lease**.
2. **CRITICAL — `v8_agent_canonical_projection_outbox` has zero consumers
   anywhere in the deployed system**, except a manual one-off proof script.
   Rows written on operator work-graph cancellation never reach `applied`.
   File to fix (`server/src/index.ts` or a new cron entry) is **outside
   every Lane B lease**.
3. **Solid — duplicate-prevention mechanics (941 lease/fencing, 942 run
   idempotency) are real, enforced CAS logic**, not decorative — but they
   guard a code path (`executePlan`/`claimExecution`) that never currently
   runs in production because of finding #1.
4. **Solid — provider/tool failure fails closed** (explicit `failed`
   status + `error_message`, no false-success path found) *when execution
   actually happens*. In practice today, the dominant failure mode a user
   would see is not "false success" but "plan never starts" (finding #1).
5. **Weak — telemetry is nearly absent** on the write side of both outbox
   paths (zero structured logs in `agentOperatorConsoleService.ts`; one log
   line in `agentPlannerService.ts`), which is a direct contributor to why
   findings #1 and #2 are undetectable without manual code archaeology.
6. **No pre-existing runbook** for this subsystem; one was written as part
   of this task (`AGENT_OPS_RUNBOOK.md`, same directory).

## Recommended verdict

**BLOCKED_OWNER.**

Rationale: `AGT-OPS-001` asks this task to establish and, implicitly, help
close the loop on outbox/restart/duplicate-prevention/telemetry/runbook for
the agent runtime. The investigation is complete and evidence-backed. The
duplicate-prevention and fail-closed-on-provider-failure requirements are
**already satisfied** by existing, correct code (§3 lease/fencing, §4
provider failure handling) — those sub-requirements can be marked done.
However, the outbox requirement surfaces two CRITICAL, previously
undocumented zero-consumer bugs (§2, §3) that are the same category of
defect this repo has already hit twice (`case_workspace_event_outbox`,
`ie_outbox_events`), and the fix for both requires editing
`server/src/index.ts` (and/or a new cron registration) — a file confirmed
**outside every Lane B lease** (§7). This task cannot be closed
`DONE_CURRENT_SHA` because the runtime does not actually execute agent plans
end-to-end today, and it cannot be `FIX_REQUIRED` from this lane because the
fix is mechanically simple but structurally forbidden here (no source edits
permitted, and the target file has no lease grant). It is not `PARTIAL`
either, because "partial" would understate that the core dispatch mechanism
is completely inert, not degraded. This is an integrator/owner decision:
either grant a lease for `server/src/index.ts` (and possibly
`server/src/jobs/agentPlanSchedulerJob.ts` if a dedicated consumer job is
preferred over reusing `aiWorker.ts`) to a lane that can land the two boot
wiring calls, or route this as its own follow-up task explicitly scoped to
`server/src/index.ts`.
