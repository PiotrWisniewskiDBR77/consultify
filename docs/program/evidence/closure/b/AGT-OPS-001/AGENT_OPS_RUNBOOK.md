# Agent runtime operator runbook — `ai_agent_plans` + `v8_agent_canonical_projection_outbox`

Written as part of `AGT-OPS-001` (Lane B closure). No runbook for this
subsystem existed before this document — see `AGENT_OPS_ANALYSIS.md` §8 in
this same directory for the evidence trail.

**Read this first:** as of this writing (SHA `64f507859c717494ffa5e83fae550173c9382230`),
**both write paths described below have zero production consumers.** This
runbook documents how to detect that condition and how to recover it
manually until the underlying boot-wiring gap is fixed (see "Known root
cause" at the end — fix is out of Lane B's lease, see `AGENT_OPS_ANALYSIS.md` §7).

---

## 1. Detection

### 1a. Stuck agent plans (`ai_agent_plans`)

A plan is stuck if it has been `planning` (with a `run_idempotency_key` set,
i.e. someone clicked "Uruchom") or `scheduled` (past its `scheduled_at`) for
longer than a few minutes with no progress.

```sql
-- Plans that were explicitly run but never started executing.
SELECT id, organization_id, user_id, status, run_idempotency_key,
       created_at, updated_at
FROM ai_agent_plans
WHERE status = 'planning'
  AND run_idempotency_key IS NOT NULL
  AND updated_at < NOW() - INTERVAL '5 minutes'
ORDER BY updated_at ASC;

-- Scheduled plans whose time has passed but never got picked up.
SELECT id, organization_id, user_id, status, scheduled_at, updated_at
FROM ai_agent_plans
WHERE status = 'scheduled'
  AND scheduled_at < NOW() - INTERVAL '5 minutes'
ORDER BY scheduled_at ASC;

-- Plans that DID start executing but whose lease has expired (crashed
-- executor, or an executor that never got picked up post-claim — should not
-- happen if the invariant "an executor only claims what it will process
-- immediately" holds, but check anyway).
SELECT id, organization_id, user_id, status,
       execution_owner_token, execution_lease_expires_at, execution_heartbeat_at
FROM ai_agent_plans
WHERE status = 'executing'
  AND execution_lease_expires_at < NOW()
ORDER BY execution_lease_expires_at ASC;
```

### 1b. Stuck canonical projection outbox (`v8_agent_canonical_projection_outbox`)

```sql
-- Rows that were written (operator cancelled a work graph) but never
-- reached 'applied'.
SELECT outbox_id, organization_id, execution_run_id, alias_type, external_id,
       status, attempt_count, claim_owner, claimed_at, last_error, created_at
FROM v8_agent_canonical_projection_outbox
WHERE status IN ('pending', 'claimed', 'failed')
  AND created_at < NOW() - INTERVAL '5 minutes'
ORDER BY created_at ASC;

-- Quick health count by status (run this periodically; a nonzero 'pending'
-- count that never drains is the signature of the dead-consumer bug).
SELECT status, count(*) FROM v8_agent_canonical_projection_outbox GROUP BY status;
```

If the `pending`/`claimed` count for either table only ever grows and never
drops, the consumer is not running — see "Known root cause" below.

---

## 2. Diagnosis

1. Confirm no consumer process is running. On the deployed environment,
   check whatever process list Railway exposes (or `ps aux` on the box) for
   a BullMQ `Worker` on queue `ai-tasks`. As of this SHA there is **none** —
   `server/src/workers/aiWorker.ts`'s `initWorker()` is never called from
   `server/src/index.ts` or any Procfile/Dockerfile entry (verified in
   `AGENT_OPS_ANALYSIS.md` §3). If you find this has since been fixed,
   update this runbook.
2. Confirm no consumer process is running for the operator console outbox.
   `processCanonicalProjectionOutbox` (`server/src/services/v8/agentOperatorConsoleService.ts:303`)
   is only called from `server/src/scripts/a11OperatorConsoleRealDbProof.ts`
   as of this SHA — verified in `AGENT_OPS_ANALYSIS.md` §2.
3. Check Redis connectivity if you suspect the *queue* itself (not the
   consumer) is the problem — `server/src/config/QueueConfig.js` and
   `MOCK_REDIS` env var. If `MOCK_REDIS=true`, `aiQueue.add()` will actually
   throw a 503 (`AI queue unavailable`, see `server/src/queues/aiQueue.ts:20-30`)
   rather than silently accepting the job — that failure mode is different
   from (and easier to detect than) the dead-consumer case, because
   `tryDispatchBackgroundExecution` catches it and logs
   `'[AgentPlanRoutes] Background dispatch unavailable, plan left pending'`
   (`server/src/routes/ai/agent-plan.routes.ts:143-149`) and the route
   response's `dispatch` field will read `'unavailable'` instead of
   `'enqueued'`. If `dispatch: 'enqueued'` was returned but the plan never
   progresses, that confirms the dead-consumer case, not a queue-connection
   problem.
4. For a specific stuck plan, inspect its steps to see how far it got before
   the last real code path touched it:
   ```sql
   SELECT step_index, tool_name, status, error_message, started_at, completed_at
   FROM ai_agent_plan_steps
   WHERE plan_id = '<plan-id>'
   ORDER BY step_index;
   ```
   All steps `pending` with a plan `status='planning'`/`'scheduled'` and a
   set `run_idempotency_key` means the plan was enqueued and never touched —
   the dead-consumer signature.

---

## 3. Recovery (manual, until the boot-wiring gap is fixed)

### 3a. Manually run the agent plan background worker once

There is no supported CLI entry point for this today. The safest manual
recovery is to run the BullMQ worker process directly against production
Redis for a short, supervised window:

```bash
# From a machine with the same env vars as the API service (REDIS_URL etc.),
# inside the server/ package:
node -e "
  import('./dist/src/workers/aiWorker.js').then(({ initWorker }) => {
    const worker = initWorker();
    if (!worker) { console.error('worker did not start (MOCK_REDIS=true or Redis unreachable)'); process.exit(1); }
    console.log('ai-tasks worker started; will drain the queue and exit after 5 minutes idle');
    setTimeout(() => worker.close().then(() => process.exit(0)), 5 * 60 * 1000);
  });
"
```

This will drain any currently-queued `AGENT_BACKGROUND_TASK` jobs, including
ones enqueued long ago. **Caution:** because nothing has ever consumed this
queue, there may be an unknown backlog; watch memory/CPU and the plan
`status` transitions in `ai_agent_plans` while it runs. Stop it (`Ctrl+C` /
kill) if it appears to be processing plans in a way that looks unsafe (e.g.
a plan whose org/user no longer exists, or a plan far too old to still be
relevant to re-run against a live provider).

### 3b. Force a stuck plan back to a clean state without executing it

If you decide a stuck plan should NOT be executed (e.g. it is stale or the
org no longer wants it), release it cleanly so a future retry from the UI
works normally:

```sql
-- Release a stuck 'planning' plan's run claim so the user can click "Uruchom" again.
UPDATE ai_agent_plans
SET run_idempotency_key = NULL, updated_at = NOW()
WHERE id = '<plan-id>' AND status = 'planning';

-- Force-fail a plan stuck in 'executing' with an expired lease (crashed
-- executor) instead of waiting for a natural reclaim.
UPDATE ai_agent_plans
SET status = 'failed',
    error_message = 'manually_recovered_stale_execution_lease',
    execution_owner_token = NULL,
    execution_lease_expires_at = NULL,
    execution_heartbeat_at = NULL,
    updated_at = NOW()
WHERE id = '<plan-id>' AND status = 'executing' AND execution_lease_expires_at < NOW();
```

Do NOT manually set a plan's `status` to `'completed'` — that fabricates a
success that never happened and will corrupt anything downstream that reads
plan results (`result_summary`, `ai_agent_plan_steps.result_json`).

### 3c. Manually drain the canonical projection outbox

```bash
# Same pattern as 3a — run once, supervised, against production DB access:
node -e "
  import('./dist/src/services/v8/agentOperatorConsoleService.js').then(async (svc) => {
    const results = await svc.processCanonicalProjectionOutbox({ workerId: 'manual-runbook-recovery', limit: 50 });
    console.log(JSON.stringify(results, null, 2));
  });
"
```

Re-run with a higher `limit` or in a loop until the pending/failed count
(query in §1b) reaches zero. Rows that keep landing back in `status='failed'`
have a `last_error` column — read it directly:

```sql
SELECT outbox_id, execution_run_id, external_id, attempt_count, last_error
FROM v8_agent_canonical_projection_outbox
WHERE status = 'failed'
ORDER BY updated_at DESC;
```

### 3d. Reset a permanently-failing outbox row

If a row is failing deterministically (e.g. the underlying
`v8_execution_runs` row was deleted or its canonical run alias is broken)
and cannot be applied, mark it terminally so it stops being retried and
document why in an incident note:

```sql
UPDATE v8_agent_canonical_projection_outbox
SET status = 'applied', applied_at = NOW(), last_error = 'manually_closed_unresolvable:<reason>'
WHERE outbox_id = '<outbox-id>' AND status = 'failed';
```

Treat this as a last resort — it means the operator's cancellation may never
have been reflected in the canonical run projection. Cross-check
`v8_agent_work_graphs`/`v8_agent_branch_tasks` status directly to confirm the
underlying cancellation did take effect (it is written in the same
transaction as the outbox row, see `AGENT_OPS_ANALYSIS.md` §2, so it usually
has, independent of the outbox's fate).

---

## 4. Known root cause (do this instead of manual recovery, long-term)

Both dead-consumer bugs have a known, mechanically simple fix, modeled
exactly on the pattern already used for `case_workspace_event_outbox` in
`server/src/index.ts:2006-2019`:

1. Add a boot-time call to `aiWorker.initWorker()` (or an equivalent
   supervised start) in `server/src/index.ts`, near the other outbox/queue
   drains (`server/src/index.ts:1983-2019`).
2. Add a boot-time or cron-scheduled call to
   `agentOperatorConsoleService.processCanonicalProjectionOutbox()` — either
   as a new interval similar to `startPlatformOutboxDrainCron`
   (`server/src/services/resultsVnext/platform/platformOutboxDrainCron.js`,
   started at `server/src/index.ts:1999-2001`), or as a new entry in
   `server/src/cron/Scheduler.ts` alongside `agentPlanSchedulerJob`.

**Both target files (`server/src/index.ts`, and whichever file hosts the new
cron/worker start call) are outside the Lane B path lease** as of
`docs/cleanup/agents/generated/CLAUDE_LANE_B_PATH_LEASE.json`
(`authorityHead c40a9ba58e28ccc78bdef8d1f61f64db60e088eb`) — see
`AGENT_OPS_ANALYSIS.md` §7. This runbook's manual-recovery steps (§3) are the
correct stand-in until that lease/ownership question is resolved by an
integrator.
