/**
 * Case Workspace — E4 packet, closing the standing EVIDENCE_MISSING: "the
 * 30-minute Run" (docs/product/case-workspace/RESUME_HANDOFF_2026-08-12.md
 * §182, and every session before it back to 2026-08-11 — see
 * docs/product/case-workspace/14_COMPLETE_DOD_EPICS_ACCEPTANCE_AND_CLAUDE_PROMPT.md
 * DoD-I's "A 30-minute active Run has no unbounded DOM/event growth...").
 *
 * ===========================================================================
 * WHY THIS IS A GENUINE >=30 MINUTE WALL-CLOCK RUN, NOT A CLOCK SUBSTITUTE
 * ===========================================================================
 * `docs/product/case-workspace/` was searched for any canon permitting a
 * controlled-clock/fake-timer substitute for this specific evidence item —
 * none was found (grep for "fake.timer|clock-controlled|controlled.clock"
 * across that tree turns up nothing naming this gap). This suite therefore
 * does the real thing: it drives a real Run through real service calls
 * against a real PostgreSQL, with an explicit gate
 * (`n4CompletionGateMs`, computed from the Run's own persisted
 * `startedAt`) that REFUSES to complete the terminal node until
 * `Date.now() >= startedAtMs + 30*60*1000`. Every property below (retry,
 * waits, outbox backoff/dead-letter/reconciliation, the process restart) is
 * proved with its OWN real timing well inside that 30-minute window — none
 * of them are what stretches the clock; the explicit gate is, and it is
 * real, unconditional `setTimeout`/polling wall-clock waiting, never a
 * mocked/advanced timer. `it()`'s own inline timeout (fourth argument below)
 * is deliberately set well above 30 minutes because an inline timeout
 * overrides `--testTimeout` (a documented trap in this program's own
 * session history).
 *
 * ===========================================================================
 * WHAT THIS SUITE PROVES, AND HOW
 * ===========================================================================
 *  1. >=30 minute wall-clock Run           -> `runDurationMs` assertion, §5.
 *  2. REAL separate-process restart        -> Process A (claims+starts an
 *     mid-attempt, no in-       attempt on node n2's retried NodeRun, then is
 *     process fake                          SIGKILLed via its OWN process
 *                                            group) and Process B (a fresh,
 *                                            independently-spawned process
 *                                            that reclaims the expired lease
 *                                            and finishes the attempt) — same
 *                                            `detached:true` +
 *                                            `process.kill(-pid,'SIGKILL')`
 *                                            idiom as
 *                                            integration/outboxWorker.pg.test.ts's
 *                                            own real-process-restart case.
 *  3. Status correctly recovered            -> `reclaimExpiredNodeRunLease`
 *                                            outcome + DB readback from a
 *                                            THIRD connection (the test's own
 *                                            `control` pool), never from
 *                                            either killed/spawned process's
 *                                            memory.
 *  4. NO duplicate NodeRun                  -> exactly one `node_run_id` for
 *                                            n2's RETRIED lineage survives
 *                                            the crash (assert count = 1,
 *                                            attempt count = 3: FAILED_RETRYABLE,
 *                                            TIMED_OUT-from-reclaim, SUCCEEDED).
 *  5. Waits                                 -> a real TIMER `CaseWait` on n3,
 *                                            due ~3 minutes out, claimed only
 *                                            once genuinely due, resolved.
 *  6. Retry                                 -> n2's FIRST NodeRun exhausts its
 *                                            budget (maxAttempts=1, the
 *                                            default every startRun/advanceRun
 *                                            call uses) straight to
 *                                            FAILED_TERMINAL; `retryNode`
 *                                            (the sanctioned operator command)
 *                                            opens a SECOND NodeRun with
 *                                            maxAttempts=3, which itself
 *                                            retries via `retry_not_before`
 *                                            (real ~8s backoff) before the
 *                                            crash/restart above finishes it.
 *  7. Outbox delivery + per-row backoff     -> a synthetic
 *                                            `longrun.backoff.probe` event
 *                                            whose registered handler fails
 *                                            the first 3 deliveries
 *                                            (deliveryAttemptCount 0,1,2) and
 *                                            succeeds the 4th — polled and
 *                                            logged in real time, then
 *                                            asserted against
 *                                            `computeRetryBackoffMs`.
 *  8. Dead-letter                           -> a synthetic
 *                                            `longrun.deadletter.probe` event
 *                                            whose handler always throws,
 *                                            left to reach
 *                                            DEAD_LETTER_ATTEMPT_THRESHOLD
 *                                            (10) attempts under its own real
 *                                            exponential backoff (~8.5
 *                                            minutes, comfortably inside the
 *                                            30-minute window).
 *  9. Reconciliation                        -> `outboxWorker.runOutboxReconciliationSweep`
 *                                            called for real at the end,
 *                                            asserted to sample the
 *                                            dead-lettered probe event.
 * 10. Final result                          -> Run COMPLETED,
 *                                            outcomeStatus ACCEPTED.
 * 11. Full correlation chain                -> one query,
 *                                            `WHERE run_id = $1 ORDER BY
 *                                            sequence_number`, across every
 *                                            aggregate type (RUN, NODE_RUN,
 *                                            WAIT) tied to this Run — proving
 *                                            an operator can reconstruct the
 *                                            whole story, including the crash
 *                                            recovery, from ONE ledger.
 *
 * ===========================================================================
 * ISOLATION — a dedicated scratch database, not the shared case_workspace_test
 * ===========================================================================
 * This suite is deliberately NOT run against `case_workspace_test` (the
 * database several other concurrent packets use): a 30+ minute suite sharing
 * that database would both be perturbed by, and perturb, unrelated work. It
 * targets a private scratch database (`cw_e4_longrun` at the time this was
 * written) via `DATABASE_URL`, created once with
 * `CREATE DATABASE cw_e4_longrun;` and migrated via
 * `server/scripts/migrate.postgres.ts` run FROM THE REPO ROOT (the runner
 * resolves `server/migrations` relative to `cwd`).
 *
 * ===========================================================================
 * GATE
 * ===========================================================================
 *   cd server && DB_TYPE=postgres LC_ALL=C NODE_ENV=test RUN_DB_TESTS=1 \
 *   MOCK_DB=false POSTGRES_SKIP_INIT_IN_TEST=1 \
 *   DATABASE_URL=postgresql://case_workspace:case_workspace@127.0.0.1:55432/cw_e4_longrun \
 *   npx vitest run src/services/caseWorkspace/__tests__/longRun/thirtyMinuteRun.pg.test.ts \
 *   --environment node --testTimeout=2400000
 */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { cpus, loadavg, tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as caseCoreService from '../../caseCoreService.js';
import * as casePlanVersionService from '../../casePlanVersionService.js';
import type { CanonicalGraph } from '../../casePlanVersionService.js';
import * as eventOutboxService from '../../eventOutboxService.js';
import { computeRetryBackoffMs, DEAD_LETTER_ATTEMPT_THRESHOLD } from '../../eventOutboxService.js';
import * as nodeRunService from '../../nodeRunService.js';
import * as outboxWorker from '../../outboxWorker.js';
import * as runLifecycleService from '../../runLifecycleService.js';
import * as waitSubscriptionService from '../../waitSubscriptionService.js';

// ---------------------------------------------------------------------------
// Gate — same convention as every other *.pg.test.ts in this packet.
// ---------------------------------------------------------------------------

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_DB_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

const REACHABLE = REAL_DB_REQUESTED ? await canReachWithSchema(CONNECTION_STRING) : false;

async function canReachWithSchema(connectionString: string): Promise<boolean> {
  const probe = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 5000 });
  try {
    const cols = await probe.query(
      `SELECT count(*)::int AS present FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'case_workspace_event_outbox'
          AND column_name = 'next_retry_at'`
    );
    return Number(cols.rows[0]?.present ?? 0) === 1;
  } catch {
    return false;
  } finally {
    await probe.end().catch(() => undefined);
  }
}

if (!REACHABLE) {
  // eslint-disable-next-line no-console
  console.warn(
    `[E4 30-minute-Run suite SKIPPED — clean skip, not a failure] needs DB_TYPE=postgres NODE_ENV=test ` +
      `RUN_DB_TESTS=1 MOCK_DB=false, a reachable DATABASE_URL with 20260812a's next_retry_at column applied. ` +
      `requested=${REAL_DB_REQUESTED} reachable=${REACHABLE}`
  );
}

const suite = REACHABLE ? describe.sequential : describe.skip;

// ---------------------------------------------------------------------------
// Evidence directory — raw, timestamped, append-only. Written as the run
// progresses (not only at the end) so a crash of THIS test process still
// leaves a partial trail on disk.
// ---------------------------------------------------------------------------

// NOTE: `new URL('../../../../../..', import.meta.url)` from this file's own
// directory (server/src/services/caseWorkspace/__tests__/longRun/) already
// lands at the REPO ROOT (6 levels up), same as SERVER_DIR's sibling
// computation would if it used the same 6-'..' count on this file's location
// — verified empirically with `node -e` against the real file path. An
// earlier version of this constant appended one MORE '..' here, which wrote
// every evidence file one directory ABOVE the repo root
// (.../dev/docs/product/... instead of .../dev/<repo>/docs/product/...) for
// the entire real run before this was caught mid-run and fixed; that run's
// evidence was recovered by moving the files from the wrong location — see
// the packet report.
//
// SECOND, SEPARATE HAZARD (found by the coordinator on 2026-08-12): this file
// lives under src/services/caseWorkspace/, so it is matched by the DEFAULT
// suite glob. Every full-suite run therefore re-ran the 30-minute gate (both
// measured runs took ~1806s for exactly this reason) AND overwrote the
// COMMITTED evidence of the accepted run — leaving a pack whose run.log came
// from one execution and whose DB snapshots came from another. That is worse
// than no evidence, because it looks consistent and is not.
//
// So the repo path is now OPT-IN. By default this test writes to a scratch
// directory and the committed evidence is never touched. To produce a new
// accepted evidence pack, set CW_LONGRUN_EVIDENCE_DIR explicitly.
// Run this file on its own; exclude '**/longRun/**' from ordinary suite runs.
const EVIDENCE_DIR = process.env.CW_LONGRUN_EVIDENCE_DIR
  ? path.resolve(process.env.CW_LONGRUN_EVIDENCE_DIR)
  : mkdtempSync(path.join(tmpdir(), 'cw-longrun-evidence-'));

function evidencePath(name: string): string {
  return path.join(EVIDENCE_DIR, name);
}

function logLine(logFile: string, line: string): void {
  const stamped = `[${new Date().toISOString()}] ${line}\n`;
  // eslint-disable-next-line no-console
  console.log(stamped.trimEnd());
  try {
    appendFileSync(logFile, stamped, 'utf8');
  } catch {
    // Evidence logging must never fail the run itself.
  }
}

function writeJsonEvidence(name: string, data: unknown): void {
  writeFileSync(evidencePath(name), JSON.stringify(data, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Process-spawn machinery — the SAME idiom
// integration/outboxWorker.pg.test.ts's own "REAL separate-process restart"
// case uses: `tsx` does not exec-replace, so `detached: true` + `process.kill
// (-pid, 'SIGKILL')` is the only way to kill the WHOLE tree (launcher + the
// real worker grandchild) rather than orphaning it.
// ---------------------------------------------------------------------------

const SERVER_DIR = path.resolve(fileURLToPath(new URL('../../../../../..', import.meta.url)));
const TSX_BIN = path.join(SERVER_DIR, 'node_modules', '.bin', 'tsx');
const NODE_RUN_SERVICE_ABS = path.resolve(fileURLToPath(new URL('../../nodeRunService.ts', import.meta.url)));

function killProcessTree(child: ReturnType<typeof spawn>): void {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, 'SIGKILL');
  } catch {
    try {
      child.kill('SIGKILL');
    } catch {
      // already gone.
    }
  }
}

interface SpawnedDriver {
  child: ReturnType<typeof spawn>;
  pid: number;
  stdout: string[];
  stderr: string[];
}

/**
 * Spawns a real, separate `tsx` process running a tiny generated script that
 * imports the REAL production `nodeRunService.ts` by absolute path (exactly
 * `server/src/index.ts`'s own runtime code path, never a copy). Resolves once
 * the script prints a `READY:` line (so the caller knows the requested
 * action landed) or rejects if it exits first / times out.
 */
async function spawnDriver(
  scriptBody: string,
  env: Record<string, string>,
  tmpDir: string,
  readyPrefix: string,
  readyTimeoutMs = 20_000
): Promise<SpawnedDriver> {
  const scriptPath = path.join(tmpDir, `e4-driver-${randomUUID()}.mjs`);
  const script = [
    `import * as nodeRunService from ${JSON.stringify(NODE_RUN_SERVICE_ABS)};`,
    scriptBody,
  ].join('\n');
  writeFileSync(scriptPath, script, 'utf8');

  const child = spawn(TSX_BIN, [scriptPath], {
    cwd: SERVER_DIR,
    env: { ...process.env, ...env },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  const stdout: string[] = [];
  const stderr: string[] = [];
  child.stdout?.on('data', (chunk) => stdout.push(String(chunk)));
  child.stderr?.on('data', (chunk) => stderr.push(String(chunk)));

  const pid = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(
        new Error(
          `driver never printed "${readyPrefix}". stdout=${stdout.join('')} stderr=${stderr.join('')}`
        )
      );
    }, readyTimeoutMs);
    child.stdout?.on('data', (chunk) => {
      if (String(chunk).includes(readyPrefix)) {
        clearTimeout(timer);
        resolve(child.pid as number);
      }
    });
    child.on('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`driver exited early (code ${code}). stdout=${stdout.join('')} stderr=${stderr.join('')}`));
    });
  });

  return { child, pid, stdout, stderr };
}

async function waitForExit(child: ReturnType<typeof spawn>, timeoutMs = 15_000): Promise<number | null> {
  return new Promise((resolve) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        resolve(null);
      }
    }, timeoutMs);
    child.on('exit', (code) => {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        resolve(code);
      }
    });
  });
}

/**
 * Extracts `key=value` out of a marker line printed by a spawned driver
 * script. Needed because `spawn()`'s own `child.pid` is the `tsx` LAUNCHER's
 * pid, not the real worker grandchild's (see `spawnDriver`'s own header) — the
 * marker line's `process.pid`, printed from INSIDE the actual worker script,
 * is the pid that genuinely matters for "is this really a different OS
 * process" assertions.
 */
function extractMarkerField(line: string, key: string): string | null {
  const match = line.match(new RegExp(`${key}=(\\S+)`));
  return match ? match[1]! : null;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollUntil(predicate: () => Promise<boolean>, timeoutMs: number, intervalMs = 500): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() >= deadline) return false;
    await sleep(intervalMs);
  }
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

suite('E4 — a genuine >=30 minute Case Workspace Run: crash/restart, retry, waits, outbox resilience', () => {
  let control: Pool;
  const logFile = evidencePath('run.log');

  beforeAll(async () => {
    if (!existsSync(EVIDENCE_DIR)) mkdirSync(EVIDENCE_DIR, { recursive: true });
    writeFileSync(
      logFile,
      `E4 30-minute Run — evidence log started ${new Date().toISOString()}\n` +
        `machine load @ start: ${JSON.stringify(loadavg())}\n` +
        `cpus: ${cpus().length}\n\n`,
      'utf8'
    );
    control = new Pool({ connectionString: CONNECTION_STRING, max: 8 });
  }, 60_000);

  afterAll(async () => {
    await control?.end().catch(() => undefined);
  }, 60_000);

  // -------------------------------------------------------------------------
  // Seeding — org/project/actor/case/plan, a real 4-node linear graph:
  // n1 -> n2 -> n3 -> n4 (entry n1, terminal n4). Adapted from
  // integration/runRuntime.pg.test.ts's own seedPublishedCase.
  // -------------------------------------------------------------------------

  async function seedMemberedUser(orgId: string, label: string): Promise<string> {
    const userId = `e4-user-${label}-${randomUUID()}`;
    await control.query(`INSERT INTO users (id, organization_id, email) VALUES ($1, $2, $3)`, [
      userId,
      orgId,
      `${userId}@example.test`,
    ]);
    await control.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
         VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE')`,
      [`e4-member-${randomUUID()}`, orgId, userId]
    );
    return userId;
  }

  async function seedPublishedCase(): Promise<{
    orgId: string;
    projectId: string;
    caseId: string;
    casePlanVersionId: string;
    actorId: string;
  }> {
    const suffix = randomUUID();
    const orgId = `e4-org-${suffix}`;
    const projectId = `e4-project-${suffix}`;
    await control.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      orgId,
      `E4 30-minute Run org`,
    ]);
    await control.query(`INSERT INTO projects (id, organization_id, name) VALUES ($1, $2, $3)`, [
      projectId,
      orgId,
      `E4 30-minute Run project`,
    ]);
    const actorId = await seedMemberedUser(orgId, 'driver');
    const created = await caseCoreService.createCase({
      projectId,
      organizationId: orgId,
      caseProfile: 'STANDARD',
      contractedClosureType: 'DELIVERY_COMPLETED',
      createdByActorId: actorId,
    });

    const graph: CanonicalGraph = {
      schemaVersion: '1',
      graphId: `graph-e4-${suffix}`,
      entryNodeIds: ['n1'],
      terminalNodeIds: ['n4'],
      nodes: [
        { nodeId: 'n1', type: 'CAPABILITY' },
        { nodeId: 'n2', type: 'CAPABILITY' },
        { nodeId: 'n3', type: 'CAPABILITY' },
        { nodeId: 'n4', type: 'CAPABILITY' },
      ],
      edges: [
        { edgeId: 'e1', sourceNodeId: 'n1', targetNodeId: 'n2', edgeType: 'SEQUENCE' },
        { edgeId: 'e2', sourceNodeId: 'n2', targetNodeId: 'n3', edgeType: 'SEQUENCE' },
        { edgeId: 'e3', sourceNodeId: 'n3', targetNodeId: 'n4', edgeType: 'SEQUENCE' },
      ],
    };
    const draft = await casePlanVersionService.createPlanDraft({
      caseId: created.caseId,
      semanticGraph: graph,
      createdByActorId: actorId,
    });
    const proposed = await casePlanVersionService.proposePlanVersion(
      draft.casePlanVersionId,
      { actorUserId: actorId },
      draft.version
    );
    const published = await casePlanVersionService.publishPlanVersion(
      draft.casePlanVersionId,
      { actorUserId: actorId },
      proposed.version
    );

    return { orgId, projectId, caseId: created.caseId, casePlanVersionId: published.casePlanVersionId, actorId };
  }

  async function teardown(params: { orgId: string; projectId: string }): Promise<void> {
    const q = (sql: string, values: unknown[]) => control.query(sql, values).catch(() => undefined);
    await q(
      `DELETE FROM case_workspace_node_run_attempts
        WHERE node_run_id IN (SELECT node_run_id FROM case_workspace_node_runs
          WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1))`,
      [params.projectId]
    );
    await q(
      `DELETE FROM case_workspace_waits WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1)`,
      [params.projectId]
    );
    await q(
      `DELETE FROM case_workspace_node_runs WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1)`,
      [params.projectId]
    );
    await q(
      `DELETE FROM case_workspace_runs WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1)`,
      [params.projectId]
    );
    await q(
      `DELETE FROM case_workspace_run_bindings WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1)`,
      [params.projectId]
    );
    await q(
      `DELETE FROM v8_execution_runs WHERE run_id IN (
         SELECT run_id FROM case_workspace_run_bindings WHERE case_id IN (SELECT case_id FROM case_core WHERE project_id = $1))`,
      [params.projectId]
    );
    await q(`DELETE FROM case_core WHERE project_id = $1`, [params.projectId]);
    await q(`DELETE FROM projects WHERE id = $1`, [params.projectId]);
    await q(`DELETE FROM case_workspace_event_outbox WHERE organization_id = $1`, [params.orgId]);
    await q(`DELETE FROM organization_members WHERE organization_id = $1`, [params.orgId]);
    await q(`DELETE FROM users WHERE organization_id = $1`, [params.orgId]);
    await q(`DELETE FROM organizations WHERE id = $1`, [params.orgId]);
  }

  it(
    'drives a real Run >= 30 minutes wall clock through retry, a real process crash+restart mid-attempt, ' +
      'a timer wait, and outbox per-row backoff/dead-letter/reconciliation, ending COMPLETED/ACCEPTED',
    async () => {
      const fx = await seedPublishedCase();
      let tmpDir: string | null = null;
      // SELF-CAUGHT BUG (see packet report): an earlier iteration of this
      // test called `killProcessTree(processA.child)` only after a couple of
      // `expect(...)` assertions that ran BETWEEN spawning Process A and
      // killing it. When one of those assertions itself threw (which
      // genuinely happened once, from a real bug in a DIFFERENT assertion —
      // see the report), execution jumped straight to `finally` and
      // Process A was NEVER killed: a real orphaned `tsx` process (launcher +
      // its real worker grandchild) sat alive on the machine for ~18 minutes
      // until caught and killed by hand. Tracking every spawned child here,
      // independently of where the happy path calls killProcessTree, and
      // sweeping this array in `finally` regardless of outcome, is what
      // makes that class of leak structurally impossible instead of merely
      // unlikely.
      const spawnedChildren: Array<ReturnType<typeof spawn>> = [];
      const startWallClock = Date.now();
      logLine(logFile, `SEEDED org=${fx.orgId} case=${fx.caseId} actor=${fx.actorId}`);

      try {
        tmpDir = mkdtempSync(path.join(tmpdir(), 'e4-longrun-'));

        // ---------------------------------------------------------------
        // Probe outbox events — seeded once, delivered/failed for real by
        // whichever process is ticking the worker loop at the time (this
        // orchestrator process, the whole run). §7/§8 "outbox delivery,
        // per-row backoff, dead-letter, reconciliation".
        // ---------------------------------------------------------------
        const backoffProbeEventId = `cwevt-e4-backoff-${randomUUID()}`;
        const deadLetterProbeEventId = `cwevt-e4-deadletter-${randomUUID()}`;
        await control.query(
          `INSERT INTO case_workspace_event_outbox
             (event_id, event_type, schema_version, organization_id, aggregate_type, aggregate_id,
              case_id, actor_user_id, redacted_summary, correlation_id)
           VALUES
             ($1, 'longrun.backoff.probe', 1, $2, 'CASE', $3, $3, $4, '{}'::jsonb, $5),
             ($6, 'longrun.deadletter.probe', 1, $2, 'CASE', $3, $3, $4, '{}'::jsonb, $7)`,
          [
            backoffProbeEventId,
            fx.orgId,
            fx.caseId,
            fx.actorId,
            `e4-corr-backoff-${backoffProbeEventId}`,
            deadLetterProbeEventId,
            `e4-corr-deadletter-${deadLetterProbeEventId}`,
          ]
        );

        const backoffDeliveryTimestamps: number[] = [];
        eventOutboxService.subscribeToOutboxDelivery((event) => {
          if (event.eventType === 'longrun.backoff.probe') {
            backoffDeliveryTimestamps.push(Date.now());
            if (event.deliveryAttemptCount < 3) {
              throw new Error(`synthetic backoff failure #${event.deliveryAttemptCount + 1}`);
            }
            return;
          }
          if (event.eventType === 'longrun.deadletter.probe') {
            throw new Error('synthetic permanent failure — always dead-letters');
          }
        });

        outboxWorker.startCaseWorkspaceOutboxWorker({
          forceEnable: true,
          organizationId: fx.orgId,
          intervalMs: 3_000,
          batchSize: 20,
        });
        logLine(logFile, `outbox worker loop started (in-process), probes seeded`);

        // ---------------------------------------------------------------
        // Run: create + start. GATE is computed from the Run's OWN
        // persisted startedAt — the real source of truth for "how long has
        // this Run actually been running", read straight back from
        // Postgres, not from this process's own clock at call time.
        // ---------------------------------------------------------------
        const run = await runLifecycleService.createRun(
          { caseId: fx.caseId, casePlanVersionId: fx.casePlanVersionId, idempotencyKey: `e4-run-${randomUUID()}` },
          fx.actorId
        );
        const started = await runLifecycleService.startRun(run.runId, fx.actorId);
        if (started.outcome !== 'started') throw new Error('unreachable: run did not start');
        const runId = run.runId;
        const runStartedAtMs = Date.parse(started.run.startedAt as string);
        expect(Number.isFinite(runStartedAtMs)).toBe(true);
        const GATE_MS = runStartedAtMs + 30 * 60 * 1000;
        logLine(
          logFile,
          `RUN STARTED runId=${runId} startedAt=${started.run.startedAt} GATE(30min)=${new Date(GATE_MS).toISOString()}`
        );

        // =================================================================
        // n1 — quick, uneventful success.
        // =================================================================
        const n1 = await nodeRunService.getLatestNodeRunForNode(runId, 'n1', fx.actorId);
        if (!n1) throw new Error('unreachable: n1 missing');
        {
          const claim = await nodeRunService.claimNodeRun(n1.nodeRunId, { leaseMs: 60_000 });
          if (claim.outcome !== 'claimed') throw new Error('unreachable: n1 not claimable');
          const attempt = await nodeRunService.startNodeRunAttempt(
            n1.nodeRunId,
            { leaseOwner: claim.leaseOwner, fencingToken: claim.fencingToken, timeoutMs: 60_000 },
            claim.nodeRun.version
          );
          await nodeRunService.completeNodeRunAttempt(
            n1.nodeRunId,
            {
              attemptId: attempt.attempt.attemptId,
              leaseOwner: claim.leaseOwner,
              fencingToken: claim.fencingToken,
              outcome: 'SUCCEEDED',
            },
            attempt.nodeRun.version
          );
        }
        const afterN1 = await runLifecycleService.advanceRun(runId, fx.actorId);
        expect(afterN1.createdNodeRunIds).toHaveLength(1);
        logLine(logFile, `n1 SUCCEEDED, advanceRun -> ${afterN1.run.status}, created ${afterN1.createdNodeRunIds}`);

        // =================================================================
        // n2, FIRST life — maxAttempts defaults to 1 (every startRun/
        // advanceRun-created NodeRun does; neither passes maxAttempts
        // through). A single FAILED_RETRYABLE outcome therefore has NO
        // budget left and is promoted straight to FAILED_TERMINAL — proving
        // that "retryable failure with no budget IS terminal" rule for
        // real, and setting up the case for retryNode below.
        // =================================================================
        const n2First = await nodeRunService.getLatestNodeRunForNode(runId, 'n2', fx.actorId);
        if (!n2First) throw new Error('unreachable: n2 missing');
        expect(n2First.maxAttempts).toBe(1);
        {
          const claim = await nodeRunService.claimNodeRun(n2First.nodeRunId, { leaseMs: 60_000 });
          if (claim.outcome !== 'claimed') throw new Error('unreachable: n2 (first) not claimable');
          const attempt = await nodeRunService.startNodeRunAttempt(
            n2First.nodeRunId,
            { leaseOwner: claim.leaseOwner, fencingToken: claim.fencingToken, timeoutMs: 60_000 },
            claim.nodeRun.version
          );
          const completed = await nodeRunService.completeNodeRunAttempt(
            n2First.nodeRunId,
            {
              attemptId: attempt.attempt.attemptId,
              leaseOwner: claim.leaseOwner,
              fencingToken: claim.fencingToken,
              outcome: 'FAILED_RETRYABLE',
              errorCode: 'E4_SYNTHETIC_TRANSIENT',
            },
            attempt.nodeRun.version
          );
          expect(completed.nodeRun.status).toBe('FAILED_TERMINAL');
        }
        const afterN2FirstFail = await runLifecycleService.advanceRun(runId, fx.actorId);
        expect(afterN2FirstFail.run.status).toBe('BLOCKED');
        logLine(logFile, `n2 (first NodeRun) FAILED_TERMINAL (no budget), Run -> BLOCKED`);

        // =================================================================
        // n2, SECOND life — the sanctioned operator command `retryNode`
        // opens a genuinely NEW NodeRun (this is intentional, documented
        // multi-row history, NOT the "no duplicate NodeRun" property under
        // test below — that property is about the CRASH not fabricating an
        // EXTRA row for THIS SAME retried lineage). maxAttempts=3 gives it
        // real attempt-level retry budget.
        // =================================================================
        const retried = await runLifecycleService.retryNode(runId, 'n2', fx.actorId, {
          maxAttempts: 3,
          idempotencyKey: 'e4-n2-retry',
        });
        expect(retried.run.status).toBe('RUNNING');
        const n2RetriedId = retried.nodeRun.nodeRunId;
        logLine(logFile, `retryNode -> new NodeRun n2RetriedId=${n2RetriedId} maxAttempts=3, Run -> RUNNING`);

        const RETRY_DELAY_MS = 8_000;
        let n2Version: number;
        {
          const claim = await nodeRunService.claimNodeRun(n2RetriedId, { leaseMs: 60_000 });
          if (claim.outcome !== 'claimed') throw new Error('unreachable: n2 (retried) not claimable');
          const attempt = await nodeRunService.startNodeRunAttempt(
            n2RetriedId,
            { leaseOwner: claim.leaseOwner, fencingToken: claim.fencingToken, timeoutMs: 60_000 },
            claim.nodeRun.version
          );
          const completed = await nodeRunService.completeNodeRunAttempt(
            n2RetriedId,
            {
              attemptId: attempt.attempt.attemptId,
              leaseOwner: claim.leaseOwner,
              fencingToken: claim.fencingToken,
              outcome: 'FAILED_RETRYABLE',
              errorCode: 'E4_SYNTHETIC_TRANSIENT',
              retryDelayMs: RETRY_DELAY_MS,
            },
            attempt.nodeRun.version
          );
          expect(completed.nodeRun.status).toBe('RETRY_SCHEDULED');
          n2Version = completed.nodeRun.version;
          expect(completed.nodeRun.retryNotBefore).not.toBeNull();
        }
        logLine(logFile, `n2 (retried) attempt#1 FAILED_RETRYABLE -> RETRY_SCHEDULED, real backoff ${RETRY_DELAY_MS}ms`);

        // Real wall-clock wait for retry_not_before to actually elapse.
        await pollUntil(
          async () => {
            const row = await control.query<{ retry_not_before: string | null }>(
              `SELECT retry_not_before FROM case_workspace_node_runs WHERE node_run_id = $1`,
              [n2RetriedId]
            );
            const rnb = row.rows[0]?.retry_not_before;
            return !!rnb && Date.parse(rnb) <= Date.now();
          },
          RETRY_DELAY_MS + 15_000,
          500
        );

        // =================================================================
        // THE CRASH — attempt #2 of n2's retried NodeRun is claimed and
        // started by a REAL, SEPARATE OS process (Process A), which then
        // does NOTHING else: it prints a READY marker and idles, so this
        // orchestrator can SIGKILL its whole process group mid-attempt.
        // =================================================================
        const CRASH_LEASE_MS = 8_000;
        const beforeCrashSnapshot = await control.query(
          `SELECT node_run_id, status, attempt, max_attempts, lease_owner, lease_expires_at, version
             FROM case_workspace_node_runs WHERE node_run_id = $1`,
          [n2RetriedId]
        );
        expect(beforeCrashSnapshot.rows[0]?.status).toBe('RETRY_SCHEDULED');

        const processA = await spawnDriver(
          `
          const nodeRunId = process.env.CW_NODE_RUN_ID;
          const leaseOwner = 'e4-process-A-' + process.pid;
          const leaseMs = Number(process.env.CW_LEASE_MS);
          (async () => {
            const claim = await nodeRunService.claimNodeRun(nodeRunId, { leaseOwner, leaseMs });
            if (claim.outcome !== 'claimed') {
              process.stderr.write('CLAIM_FAILED:' + JSON.stringify(claim) + '\\n');
              process.exit(1);
            }
            const attempt = await nodeRunService.startNodeRunAttempt(
              nodeRunId,
              { leaseOwner, fencingToken: claim.fencingToken, timeoutMs: 60000 },
              claim.nodeRun.version
            );
            process.stdout.write(
              'READY_TO_DIE pid=' + process.pid +
              ' nodeRunId=' + nodeRunId +
              ' attemptId=' + attempt.attempt.attemptId +
              ' leaseOwner=' + leaseOwner +
              ' fencingToken=' + claim.fencingToken + '\\n'
            );
            setInterval(() => {}, 60000); // keep-alive until SIGKILLed
          })().catch((err) => { process.stderr.write(String(err && err.stack || err) + '\\n'); process.exit(1); });
          `,
          { CW_NODE_RUN_ID: n2RetriedId, CW_LEASE_MS: String(CRASH_LEASE_MS) },
          tmpDir,
          'READY_TO_DIE'
        );
        spawnedChildren.push(processA.child); // BEFORE any assertion can throw — see the note above.
        const readyLine = processA.stdout.join('').split('\n').find((l) => l.includes('READY_TO_DIE')) ?? '';
        // The `tsx` LAUNCHER pid `spawn()` handed back (processA.pid) is NOT
        // the pid that actually claimed the lease — tsx does not
        // exec-replace, so the real worker is a separate grandchild. Its OWN
        // pid, printed from inside the running script, is what the DB's
        // lease_owner actually contains.
        const workerAPid = extractMarkerField(readyLine, 'pid');
        expect(workerAPid).not.toBeNull();
        logLine(
          logFile,
          `Process A (launcher pid=${processA.pid}, real worker pid=${workerAPid}) claimed+started attempt#2: ${readyLine}`
        );

        const midCrashSnapshot = await control.query(
          `SELECT node_run_id, status, attempt, lease_owner, lease_expires_at, current_attempt_id, version
             FROM case_workspace_node_runs WHERE node_run_id = $1`,
          [n2RetriedId]
        );
        expect(midCrashSnapshot.rows[0]?.status).toBe('RUNNING');
        expect(midCrashSnapshot.rows[0]?.lease_owner).toContain(String(workerAPid));
        const killWallClock = Date.now();

        writeJsonEvidence('01-before-restart-db-snapshot.json', {
          capturedAtIso: new Date(killWallClock).toISOString(),
          processALauncherPid: processA.pid,
          processAWorkerPid: workerAPid,
          n2RetriedNodeRun: midCrashSnapshot.rows[0],
        });

        killProcessTree(processA.child);
        await waitForExit(processA.child, 5_000);
        logLine(logFile, `Process A (pid=${processA.pid}) SIGKILLed at ${new Date(killWallClock).toISOString()}`);

        // Postgres notices the dead backend and releases anything it held —
        // same allowance integration/outboxWorker.pg.test.ts's own stuck-lease
        // case uses.
        await sleep(500);

        // Confirm the crash actually stranded the row (still RUNNING, no
        // completion happened) before recovering it — a real interruption,
        // not a race this test happened to win.
        const afterKillSnapshot = await control.query<{ status: string }>(
          `SELECT status FROM case_workspace_node_runs WHERE node_run_id = $1`,
          [n2RetriedId]
        );
        expect(afterKillSnapshot.rows[0]?.status).toBe('RUNNING');

        // Real wall-clock wait for the CRASH_LEASE_MS lease to actually
        // expire (Postgres' clock, via lease_expires_at — not assumed).
        const leaseExpired = await pollUntil(
          async () => {
            const row = await control.query<{ lease_expires_at: string | null }>(
              `SELECT lease_expires_at FROM case_workspace_node_runs WHERE node_run_id = $1`,
              [n2RetriedId]
            );
            const exp = row.rows[0]?.lease_expires_at;
            return !!exp && Date.parse(exp) <= Date.now();
          },
          CRASH_LEASE_MS + 15_000,
          500
        );
        expect(leaseExpired).toBe(true);
        logLine(logFile, `lease genuinely expired, safe to reclaim`);

        // =================================================================
        // THE RESTART — a SECOND, independently-spawned, fresh OS process
        // (Process B) reclaims the expired lease (mandatory reconcile
        // callback, per reclaimExpiredNodeRunLease's own contract — this
        // synthetic domain has no external side effect to read back, so
        // alreadyApplied:false is the honest verdict) and finishes the
        // node from there.
        // =================================================================
        const processB = await spawnDriver(
          `
          const nodeRunId = process.env.CW_NODE_RUN_ID;
          const leaseOwner = 'e4-process-B-' + process.pid;
          (async () => {
            const reclaim = await nodeRunService.reclaimExpiredNodeRunLease(
              nodeRunId,
              () => ({ alreadyApplied: false, detail: { reason: 'e4-synthetic-no-external-effect' } }),
              { leaseOwner, leaseMs: 60000 }
            );
            if (reclaim.outcome !== 'reclaimed') {
              process.stderr.write('RECLAIM_FAILED:' + JSON.stringify(reclaim) + '\\n');
              process.exit(1);
            }
            const attempt = await nodeRunService.startNodeRunAttempt(
              nodeRunId,
              { leaseOwner, fencingToken: reclaim.fencingToken, timeoutMs: 60000 },
              reclaim.nodeRun.version
            );
            const completed = await nodeRunService.completeNodeRunAttempt(
              nodeRunId,
              {
                attemptId: attempt.attempt.attemptId,
                leaseOwner,
                fencingToken: reclaim.fencingToken,
                outcome: 'SUCCEEDED',
              },
              attempt.nodeRun.version
            );
            process.stdout.write('READY_RECOVERED pid=' + process.pid + ' nodeRunId=' + nodeRunId + ' status=' + completed.nodeRun.status + '\\n');
          })().catch((err) => { process.stderr.write(String(err && err.stack || err) + '\\n'); process.exit(1); });
          `,
          { CW_NODE_RUN_ID: n2RetriedId },
          tmpDir,
          'READY_RECOVERED',
          20_000
        );
        spawnedChildren.push(processB.child); // BEFORE any assertion can throw — see the note above.
        expect(processB.pid).not.toBe(processA.pid); // distinct tsx launcher pids too
        await waitForExit(processB.child, 10_000);
        const recoveredLine = processB.stdout.join('').split('\n').find((l) => l.includes('READY_RECOVERED')) ?? '';
        const workerBPid = extractMarkerField(recoveredLine, 'pid');
        expect(workerBPid).not.toBeNull();
        // The decisive identity check: the REAL worker process (not the tsx
        // launcher) that recovered the node is a genuinely different OS
        // process from the one that crashed.
        expect(workerBPid).not.toBe(workerAPid);
        logLine(
          logFile,
          `Process B (launcher pid=${processB.pid}, real worker pid=${workerBPid}, DIFFERENT from A's ${workerAPid}) recovered: ${recoveredLine}`
        );

        const afterRestartSnapshot = await control.query(
          `SELECT node_run_id, status, attempt, max_attempts, lease_owner, version
             FROM case_workspace_node_runs WHERE node_run_id = $1`,
          [n2RetriedId]
        );
        expect(afterRestartSnapshot.rows[0]?.status).toBe('SUCCEEDED');

        const n2RetriedAttempts = await control.query<{
          attempt_number: number;
          status: string;
          error_code: string | null;
        }>(
          `SELECT attempt_number, status, error_code FROM case_workspace_node_run_attempts
             WHERE node_run_id = $1 ORDER BY attempt_number ASC`,
          [n2RetriedId]
        );
        // Exactly 3 attempts on the SAME node_run_id: FAILED_RETRYABLE,
        // TIMED_OUT (the abandoned crashed attempt, closed by the reclaim),
        // SUCCEEDED (Process B's real recovery attempt).
        expect(n2RetriedAttempts.rows.map((r) => r.status)).toEqual([
          'FAILED_RETRYABLE',
          'TIMED_OUT',
          'SUCCEEDED',
        ]);

        // NO DUPLICATE NodeRun for this retried lineage: still exactly one
        // node_run_id for it, despite the crash.
        const n2RetriedRowCount = await control.query<{ n: string }>(
          `SELECT count(*)::int AS n FROM case_workspace_node_runs WHERE node_run_id = $1`,
          [n2RetriedId]
        );
        expect(Number(n2RetriedRowCount.rows[0]?.n)).toBe(1);
        // And exactly TWO NodeRun rows total for node 'n2' in this run —
        // the original FAILED_TERMINAL life plus this one retryNode-created
        // life. Two, not three: the crash did not mint an extra row.
        const n2TotalRowCount = await control.query<{ n: string }>(
          `SELECT count(*)::int AS n FROM case_workspace_node_runs WHERE run_id = $1 AND node_id = 'n2'`,
          [runId]
        );
        expect(Number(n2TotalRowCount.rows[0]?.n)).toBe(2);

        writeJsonEvidence('02-after-restart-db-snapshot.json', {
          capturedAtIso: new Date().toISOString(),
          processBLauncherPid: processB.pid,
          processBWorkerPid: workerBPid,
          n2RetriedNodeRun: afterRestartSnapshot.rows[0],
          n2RetriedAttempts: n2RetriedAttempts.rows,
          n2TotalNodeRunRowsForRun: Number(n2TotalRowCount.rows[0]?.n),
        });

        const afterN2Recovered = await runLifecycleService.advanceRun(runId, fx.actorId);
        expect(afterN2Recovered.createdNodeRunIds).toHaveLength(1);
        logLine(logFile, `advanceRun after recovery -> ${afterN2Recovered.run.status}, created n3`);

        // =================================================================
        // n3 — a real TIMER CaseWait, due ~3 minutes out, claimed only once
        // genuinely due.
        // =================================================================
        const n3 = await nodeRunService.getLatestNodeRunForNode(runId, 'n3', fx.actorId);
        if (!n3) throw new Error('unreachable: n3 missing');
        const n3Claim = await nodeRunService.claimNodeRun(n3.nodeRunId, { leaseMs: 10 * 60_000 });
        if (n3Claim.outcome !== 'claimed') throw new Error('unreachable: n3 not claimable');
        const n3Attempt = await nodeRunService.startNodeRunAttempt(
          n3.nodeRunId,
          { leaseOwner: n3Claim.leaseOwner, fencingToken: n3Claim.fencingToken, timeoutMs: 10 * 60_000 },
          n3Claim.nodeRun.version
        );

        const WAIT_DUE_MS = 3 * 60_000;
        const waitCorrelationKey = `e4-n3-wait-${runId}`;
        const wait = await waitSubscriptionService.createWait(
          {
            caseId: fx.caseId,
            runId,
            nodeRunId: n3.nodeRunId,
            waitType: 'TIMER',
            correlationKey: waitCorrelationKey,
            dueAt: new Date(Date.now() + WAIT_DUE_MS).toISOString(),
          },
          fx.actorId
        );
        logLine(logFile, `n3 CaseWait created waitId=${wait.waitId} dueAt=${wait.dueAt}`);

        // Real wall-clock wait: NOTE `claimTimerWait` itself has no due-date
        // gate (it is a raw CAS claim primitive, guarded only on
        // wait_type/status/lease — confirmed empirically: an early call
        // against a not-yet-due wait returns 'claimed', not 'not_claimable').
        // The due-date gate lives one layer up, in the SCHEDULER'S OWN query
        // `listDueTimerWaitsForClaim`, which a real scheduler consults BEFORE
        // ever calling claimTimerWait. That is the honest production pattern
        // this test follows: confirm the wait is genuinely NOT yet due per
        // that scheduler query, then poll it for real until it is.
        const notYetDue = await waitSubscriptionService.listDueTimerWaitsForClaim(new Date(), 50);
        expect(notYetDue.map((w) => w.waitId)).not.toContain(wait.waitId);

        // ---- concurrently, poll+log the outbox probes while we wait ----
        const probeLogDeadline = Date.now() + WAIT_DUE_MS + 60_000;
        let backoffProbeDelivered = false;
        let deadLetterProbeDeadLettered = false;
        while (Date.now() < probeLogDeadline && !(backoffProbeDelivered && deadLetterProbeDeadLettered)) {
          const rows = await control.query<{
            event_id: string;
            event_type: string;
            delivered_at: string | null;
            delivery_attempt_count: number;
            next_retry_at: string | null;
          }>(
            `SELECT event_id, event_type, delivered_at, delivery_attempt_count, next_retry_at
               FROM case_workspace_event_outbox WHERE event_id IN ($1, $2)`,
            [backoffProbeEventId, deadLetterProbeEventId]
          );
          for (const row of rows.rows) {
            logLine(
              logFile,
              `PROBE ${row.event_type} attempts=${row.delivery_attempt_count} delivered=${row.delivered_at !== null} nextRetryAt=${row.next_retry_at ?? 'null'}`
            );
            if (row.event_type === 'longrun.backoff.probe' && row.delivered_at !== null) backoffProbeDelivered = true;
            if (
              row.event_type === 'longrun.deadletter.probe' &&
              Number(row.delivery_attempt_count) >= DEAD_LETTER_ATTEMPT_THRESHOLD
            ) {
              deadLetterProbeDeadLettered = true;
            }
          }
          const dueSoon = await control.query<{ due_at: string }>(
            `SELECT due_at FROM case_workspace_waits WHERE wait_id = $1`,
            [wait.waitId]
          );
          if (Date.parse(dueSoon.rows[0]?.due_at ?? '') <= Date.now()) break;
          await sleep(5_000);
        }

        // Real wall-clock wait for the rest of the wait's due time, if any
        // remains (the probe-logging loop above may have exited early once
        // both probes settled).
        await pollUntil(async () => Date.now() >= Date.parse(wait.dueAt as string), WAIT_DUE_MS + 60_000, 2_000);

        const waitClaim = await waitSubscriptionService.claimTimerWait(wait.waitId, { leaseMs: 30_000 });
        expect(waitClaim.outcome).toBe('claimed');
        if (waitClaim.outcome !== 'claimed') throw new Error('unreachable');
        const waitBeforeResolve = await waitSubscriptionService.getWait(wait.waitId, fx.actorId);
        if (!waitBeforeResolve) throw new Error('unreachable: wait disappeared');
        const resolved = await waitSubscriptionService.resolveWait(
          wait.waitId,
          {
            satisfiedByEventId: `e4-synthetic-satisfaction-${wait.waitId}`,
            timerClaim: { ownerToken: waitClaim.ownerToken, fencingToken: waitClaim.fencingToken },
          },
          waitBeforeResolve.version
        );
        expect(resolved.status).toBe('SATISFIED');
        logLine(logFile, `n3 CaseWait SATISFIED at ${resolved.satisfiedAt}`);

        await nodeRunService.completeNodeRunAttempt(
          n3.nodeRunId,
          {
            attemptId: n3Attempt.attempt.attemptId,
            leaseOwner: n3Claim.leaseOwner,
            fencingToken: n3Claim.fencingToken,
            outcome: 'SUCCEEDED',
          },
          n3Attempt.nodeRun.version
        );
        const afterN3 = await runLifecycleService.advanceRun(runId, fx.actorId);
        expect(afterN3.createdNodeRunIds).toHaveLength(1);
        logLine(logFile, `n3 SUCCEEDED, advanceRun -> ${afterN3.run.status}, created n4`);

        // =================================================================
        // n4 — the terminal node. Claimed and started now, but its
        // completion is GATED on real wall-clock time reaching GATE_MS
        // (Run.startedAt + 30 minutes). This is what guarantees the whole
        // Run is a genuine >=30 minute wall-clock Run, not an artifact of
        // how long the steps above happened to take.
        // =================================================================
        const n4 = await nodeRunService.getLatestNodeRunForNode(runId, 'n4', fx.actorId);
        if (!n4) throw new Error('unreachable: n4 missing');
        const n4Claim = await nodeRunService.claimNodeRun(n4.nodeRunId, { leaseMs: 40 * 60_000 });
        if (n4Claim.outcome !== 'claimed') throw new Error('unreachable: n4 not claimable');
        const n4Attempt = await nodeRunService.startNodeRunAttempt(
          n4.nodeRunId,
          { leaseOwner: n4Claim.leaseOwner, fencingToken: n4Claim.fencingToken, timeoutMs: 40 * 60_000 },
          n4Claim.nodeRun.version
        );

        const memoryLatencySamples: Array<{
          atIso: string;
          elapsedFromRunStartMs: number;
          rssBytes: number;
          heapUsedBytes: number;
          loadavg: number[];
          outboxTickDurationMsP50: number | null;
          outboxTickDurationMsP95: number | null;
          outboxTicks: number;
        }> = [];

        while (Date.now() < GATE_MS) {
          const remainingMs = GATE_MS - Date.now();
          const mem = process.memoryUsage();
          const metrics = outboxWorker.getOutboxWorkerMetrics();
          const sample = {
            atIso: new Date().toISOString(),
            elapsedFromRunStartMs: Date.now() - runStartedAtMs,
            rssBytes: mem.rss,
            heapUsedBytes: mem.heapUsed,
            loadavg: loadavg(),
            outboxTickDurationMsP50: metrics.tickDurationMsP50,
            outboxTickDurationMsP95: metrics.tickDurationMsP95,
            outboxTicks: metrics.ticks,
          };
          memoryLatencySamples.push(sample);
          logLine(
            logFile,
            `IDLE-GATE remaining=${Math.ceil(remainingMs / 1000)}s rss=${(mem.rss / (1024 * 1024)).toFixed(1)}MiB ` +
              `outboxTicks=${metrics.ticks} p50=${metrics.tickDurationMsP50}ms p95=${metrics.tickDurationMsP95}ms`
          );
          await sleep(Math.min(15_000, Math.max(1_000, remainingMs)));
        }

        expect(Date.now()).toBeGreaterThanOrEqual(GATE_MS);
        logLine(logFile, `GATE reached — completing n4`);

        await nodeRunService.completeNodeRunAttempt(
          n4.nodeRunId,
          {
            attemptId: n4Attempt.attempt.attemptId,
            leaseOwner: n4Claim.leaseOwner,
            fencingToken: n4Claim.fencingToken,
            outcome: 'SUCCEEDED',
          },
          n4Attempt.nodeRun.version
        );
        const afterN4 = await runLifecycleService.advanceRun(runId, fx.actorId);
        expect(afterN4.run.status).toBe('COMPLETED');

        const finalOutcome = await runLifecycleService.recordRunOutcome(
          runId,
          'ACCEPTED',
          fx.actorId,
          afterN4.run.version
        );
        expect(finalOutcome.outcomeStatus).toBe('ACCEPTED');

        const finalRun = await runLifecycleService.getRun(runId, fx.actorId);
        if (!finalRun) throw new Error('unreachable: run disappeared');
        const runDurationMs = Date.parse(finalRun.completedAt as string) - Date.parse(finalRun.startedAt as string);
        logLine(
          logFile,
          `RUN COMPLETED status=${finalRun.status} outcome=${finalRun.outcomeStatus} ` +
            `startedAt=${finalRun.startedAt} completedAt=${finalRun.completedAt} durationMs=${runDurationMs}`
        );

        // =================================================================
        // FINAL ASSERTIONS
        // =================================================================

        // 1. >=30 minute wall-clock Run.
        expect(runDurationMs).toBeGreaterThanOrEqual(30 * 60 * 1000);

        // 7/8/9. Outbox: backoff probe delivered after exactly 3 failures
        // with a real exponential schedule; dead-letter probe reached the
        // threshold and never delivered; reconciliation sweep samples it.
        const backoffProbeFinal = await eventOutboxService.getOutboxEvent(backoffProbeEventId);
        expect(backoffProbeFinal?.deliveredAt).not.toBeNull();
        expect(backoffProbeFinal?.deliveryAttemptCount).toBe(3);
        expect(backoffDeliveryTimestamps.length).toBeGreaterThanOrEqual(4);
        for (let i = 1; i < 4 && i < backoffDeliveryTimestamps.length; i += 1) {
          const observedGapMs = backoffDeliveryTimestamps[i]! - backoffDeliveryTimestamps[i - 1]!;
          const expectedFloorMs = computeRetryBackoffMs(i); // attemptNumber i (1-based failures)
          // Real scheduling jitter (worker tick cadence 3s + DB latency)
          // means the observed gap is >= the computed backoff floor, minus
          // a small tolerance for clock/measurement skew.
          expect(observedGapMs).toBeGreaterThanOrEqual(expectedFloorMs - 1_500);
        }

        const deadLetterProbeFinal = await eventOutboxService.getOutboxEvent(deadLetterProbeEventId);
        expect(deadLetterProbeFinal?.deliveredAt).toBeNull();
        expect(deadLetterProbeFinal?.deliveryAttemptCount).toBeGreaterThanOrEqual(DEAD_LETTER_ATTEMPT_THRESHOLD);

        const deadLetterList = await eventOutboxService.listDeadLetterEvents({ organizationId: fx.orgId });
        expect(deadLetterList.map((e) => e.eventId)).toContain(deadLetterProbeEventId);

        const reconciliation = await outboxWorker.runOutboxReconciliationSweep({ organizationId: fx.orgId });
        expect(reconciliation.sample.map((e) => e.eventId)).toContain(deadLetterProbeEventId);

        // 11. Full correlation chain — every event tied to this Run, across
        // every aggregate type, in true insertion order.
        const correlationChain = await control.query<{
          event_type: string;
          aggregate_type: string;
          sequence_number: string;
          node_run_id: string | null;
          correlation_id: string;
        }>(
          `SELECT event_type, aggregate_type, sequence_number, node_run_id, correlation_id
             FROM case_workspace_event_outbox WHERE run_id = $1 ORDER BY sequence_number ASC`,
          [runId]
        );
        expect(correlationChain.rows.length).toBeGreaterThan(10);
        expect(correlationChain.rows.every((r) => !!r.correlation_id)).toBe(true);
        const chainEventTypes = correlationChain.rows.map((r) => r.event_type);
        for (const expectedType of [
          'run.created',
          'run.started',
          'run.retry_node_resumed',
          'node.lease_reclaimed',
          'wait.registered',
          'wait.claimed',
          'wait.satisfied',
          'run.outcome_recorded',
        ]) {
          expect(chainEventTypes).toContain(expectedType);
        }

        writeJsonEvidence('03-final-db-snapshot.json', {
          run: finalRun,
          runDurationMs,
          backoffProbe: backoffProbeFinal,
          backoffDeliveryTimestamps,
          deadLetterProbe: deadLetterProbeFinal,
          reconciliationSample: reconciliation,
          correlationChain: correlationChain.rows,
        });
        writeJsonEvidence('04-memory-and-latency.json', {
          machineLoadAtStart: loadavg(),
          cpuCount: cpus().length,
          samples: memoryLatencySamples,
          wallClockTestDurationMs: Date.now() - startWallClock,
        });

        outboxWorker.stopCaseWorkspaceOutboxWorker();
        eventOutboxService.clearOutboxDeliverySubscribers();
      } finally {
        outboxWorker.stopCaseWorkspaceOutboxWorker();
        eventOutboxService.clearOutboxDeliverySubscribers();
        // Sweep every spawned child, regardless of whether it was already
        // deliberately killed/exited on the happy path — killProcessTree is
        // a no-op against an already-gone pid (see its own try/catch). This
        // is what makes the orphan class of bug documented above
        // structurally impossible: no assertion thrown anywhere between a
        // spawn and its own kill call can skip this cleanup.
        for (const child of spawnedChildren) killProcessTree(child);
        if (tmpDir) rmSync(tmpDir, { recursive: true, force: true });
        await teardown(fx);
      }
    },
    40 * 60 * 1000 // inline timeout — MUST be set here; it overrides --testTimeout.
  );
});
