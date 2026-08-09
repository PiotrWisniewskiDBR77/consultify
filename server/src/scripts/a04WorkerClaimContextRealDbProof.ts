import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { Pool } from 'pg';
import { adaptQuery } from '../database/PostgresDatabase.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });
const proofDb = {
  query: (text: string, params: unknown[] = []) => pool.query(adaptQuery(text), params),
  get(
    text: string,
    params: unknown[] = [],
    callback?: (error: Error | null, row: unknown) => void
  ) {
    const promise = pool.query(adaptQuery(text), params).then((result) => result.rows[0] ?? null);
    if (callback)
      void promise.then(
        (row) => callback(null, row),
        (error) => callback(error as Error, null)
      );
    return callback ? proofDb : promise;
  },
  all(
    text: string,
    params: unknown[] = [],
    callback?: (error: Error | null, rows: unknown[]) => void
  ) {
    const promise = pool.query(adaptQuery(text), params).then((result) => result.rows);
    if (callback)
      void promise.then(
        (rows) => callback(null, rows),
        (error) => callback(error as Error, [])
      );
    return callback ? proofDb : promise;
  },
  run(text: string, params: unknown[] = [], callback?: (error: Error | null) => void) {
    const promise = pool
      .query(adaptQuery(text), params)
      .then((result) => ({ changes: result.rowCount ?? 0 }));
    if (callback)
      void promise.then(
        (result) => callback.call({ changes: result.changes }, null),
        (error) => callback.call({ changes: 0 }, error as Error)
      );
    return callback ? proofDb : promise;
  },
  exec: (text: string) => pool.query(text).then(() => undefined),
  serialize(callback: () => void) {
    callback();
  },
  close: () => Promise.resolve(),
};
(globalThis as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;
(process as unknown as Record<string, unknown>).__CONSULTIFY_GLOBAL_DB_INSTANCE__ = proofDb;

async function main(): Promise<void> {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(`
    CREATE TABLE transformation_cases (
      transformation_case_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL,
      execution_run_id TEXT NOT NULL, context_snapshot_id TEXT NOT NULL, project_id TEXT,
      lineage_id TEXT NOT NULL DEFAULT 'lineage', conversation_id TEXT,
      status TEXT NOT NULL DEFAULT 'active', lifecycle_stage TEXT NOT NULL DEFAULT 'execution'
    );
    CREATE TABLE v8_execution_runs (
      run_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'applying',
      plan_version INT NOT NULL DEFAULT 1, goal TEXT NOT NULL DEFAULT 'proof', updated_at TEXT, resolved_at TEXT
    );
    CREATE TABLE v8_agent_run_identities (
      canonical_run_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL,
      transformation_case_id TEXT NOT NULL, lineage_id TEXT NOT NULL
    );
    CREATE TABLE v8_context_snapshots (
      snapshot_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT,
      source_context_refs JSONB NOT NULL DEFAULT '[]', drift_events JSONB NOT NULL DEFAULT '[]'
    );
    CREATE TABLE v8_agent_context_revalidations (
      revalidation_id TEXT PRIMARY KEY, canonical_run_id TEXT NOT NULL, organization_id TEXT NOT NULL,
      transformation_case_id TEXT NOT NULL, snapshot_id TEXT NOT NULL, decision TEXT NOT NULL,
      reason TEXT NOT NULL, source_digest TEXT NOT NULL, policy_digest TEXT NOT NULL,
      drift_json JSONB NOT NULL, checked_by_user_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE v8_agent_working_memory_bindings (
      binding_id TEXT PRIMARY KEY, canonical_run_id TEXT NOT NULL, organization_id TEXT NOT NULL,
      memory_entry_id TEXT NOT NULL, source_ref TEXT NOT NULL, content_digest TEXT NOT NULL,
      char_count INTEGER NOT NULL, UNIQUE(canonical_run_id, memory_entry_id)
    );
    CREATE TABLE v8_agent_run_aliases (
      alias_id TEXT PRIMARY KEY, canonical_run_id TEXT NOT NULL, organization_id TEXT NOT NULL,
      alias_type TEXT NOT NULL, external_id TEXT NOT NULL, created_at TEXT NOT NULL,
      UNIQUE(organization_id,alias_type,external_id)
    );
    CREATE TABLE transformation_stage_proposals (
      proposal_id TEXT PRIMARY KEY, transformation_case_id TEXT, organization_id TEXT,
      lifecycle_stage TEXT, proposal_type TEXT, status TEXT, reviewed_by_user_id TEXT,
      created_at TEXT, updated_at TEXT
    );
    CREATE TABLE transformation_final_output_runs (
      run_id TEXT PRIMARY KEY, transformation_case_id TEXT, organization_id TEXT, status TEXT
    );
    CREATE TABLE transformation_case_audit_events (
      audit_event_id TEXT PRIMARY KEY, transformation_case_id TEXT, organization_id TEXT,
      event_type TEXT, actor_user_id TEXT, correlation_id TEXT, created_at TEXT
    );
    CREATE TABLE v8_run_state_transitions (
      transition_id TEXT PRIMARY KEY, run_id TEXT, from_state TEXT, to_state TEXT,
      triggered_by TEXT, reason TEXT, transitioned_at TEXT
    );
    CREATE TABLE v8_agent_run_reconciliation_events (
      reconciliation_id TEXT PRIMARY KEY, canonical_run_id TEXT, organization_id TEXT,
      transformation_case_id TEXT, from_state TEXT, to_state TEXT, actor_user_id TEXT,
      reason TEXT, projection_json TEXT, created_at TEXT
    );
  `);
  for (const fixture of [
    { suffix: 'clean', project: 'project-1', snapshotProject: 'project-1', drift: '[]' },
    {
      suffix: 'drift',
      project: 'project-1',
      snapshotProject: 'project-1',
      drift: '[{"type":"changed"}]',
    },
    { suffix: 'scope', project: 'project-1', snapshotProject: 'project-other', drift: '[]' },
  ]) {
    await pool.query(`INSERT INTO v8_context_snapshots VALUES ($1,'org-1',$2,'[]',$3::jsonb)`, [
      `snap-${fixture.suffix}`,
      fixture.snapshotProject,
      fixture.drift,
    ]);
    await pool.query(
      `INSERT INTO transformation_cases
        (transformation_case_id,organization_id,execution_run_id,context_snapshot_id,project_id,lineage_id)
       VALUES ($1,'org-1',$2,$3,$4,$5)`,
      [
        `case-${fixture.suffix}`,
        `run-${fixture.suffix}`,
        `snap-${fixture.suffix}`,
        fixture.project,
        `lineage-${fixture.suffix}`,
      ]
    );
    await pool.query(`INSERT INTO v8_execution_runs (run_id,organization_id) VALUES ($1,'org-1')`, [
      `run-${fixture.suffix}`,
    ]);
    await pool.query(`INSERT INTO v8_agent_run_identities VALUES ($1,'org-1',$2,$3)`, [
      `run-${fixture.suffix}`,
      `case-${fixture.suffix}`,
      `lineage-${fixture.suffix}`,
    ]);
  }

  const runtime = await import('../services/wave8AgentRuntimeService.js');
  await runtime.ensureWave8AgentRuntimeSchema();
  const insertSchedule = async (id: string, runId: string): Promise<void> => {
    await pool.query(
      `INSERT INTO wave8_agent_schedules
        (schedule_id,organization_id,agent_id,owner_user_id,cadence,goal,timezone,next_run_at,
         scheduler_mode,status,timeout_seconds,max_attempts,mandate_json,canonical_run_id)
       VALUES ($1,'org-1','research-agent','owner-1','once','proof','UTC','2026-08-01T00:00:00.000Z',
         'durable_cron_worker','active',30,3,'{}',$2)`,
      [id, runId]
    );
  };
  await insertSchedule('schedule-clean', 'run-clean');
  let cleanCallbacks = 0;
  const executeClean = async () => {
    cleanCallbacks += 1;
    return { run: { runId: `worker-run-${cleanCallbacks}` } };
  };
  await Promise.all([
    runtime.processDueWave8AgentSchedules({
      organizationId: 'org-1',
      workerId: 'worker-a',
      executeSchedule: executeClean,
    }),
    runtime.processDueWave8AgentSchedules({
      organizationId: 'org-1',
      workerId: 'worker-b',
      executeSchedule: executeClean,
    }),
  ]);
  assert.equal(cleanCallbacks, 1);

  await insertSchedule('schedule-drift', 'run-drift');
  let blockedCallbacks = 0;
  const blockedExecutor = async () => {
    blockedCallbacks += 1;
    return { run: { runId: 'must-not-run' } };
  };
  await runtime.processDueWave8AgentSchedules({
    organizationId: 'org-1',
    workerId: 'worker-drift',
    executeSchedule: blockedExecutor,
  });
  assert.equal(blockedCallbacks, 0);
  const driftSchedule = await pool.query(
    `SELECT status,blocked_reason FROM wave8_agent_schedules WHERE schedule_id='schedule-drift'`
  );
  assert.equal(driftSchedule.rows[0].status, 'blocked_context');
  const restartWorker = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      fileURLToPath(new URL('./a04WorkerClaimRestartWorker.ts', import.meta.url)),
    ],
    { env: { ...process.env, DATABASE_URL: databaseUrl }, encoding: 'utf8' }
  );
  assert.equal(
    restartWorker.status,
    0,
    `restart worker failed: ${restartWorker.stderr || restartWorker.stdout}`
  );
  const restartReadback = JSON.parse(restartWorker.stdout.trim().split('\n').at(-1) || '{}');
  assert.deepEqual(restartReadback, { restartProcess: true, callbacks: 0, processed: 0 });

  await insertSchedule('schedule-scope', 'run-scope');
  await runtime.processDueWave8AgentSchedules({
    organizationId: 'org-1',
    workerId: 'worker-scope',
    executeSchedule: blockedExecutor,
  });
  assert.equal(blockedCallbacks, 0);

  await pool.query(`
    CREATE TABLE ai_agent_plans (
      id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, user_id TEXT NOT NULL,
      status TEXT NOT NULL, canonical_run_id TEXT, error_message TEXT, updated_at TIMESTAMP DEFAULT NOW()
    );
    INSERT INTO ai_agent_plans VALUES ('plan-drift','org-1','owner-1','scheduled','run-drift',NULL,NOW());
  `);
  const planner = await import('../services/ai/agentPlannerService.js');
  const plannerGate = await planner.agentPlannerService.gateScheduledWorkerDispatch({
    planId: 'plan-drift',
    organizationId: 'org-1',
    userId: 'owner-1',
  });
  assert.equal(plannerGate.allowed, false);
  const plannerReadback = await pool.query(
    `SELECT status,error_message FROM ai_agent_plans WHERE id='plan-drift'`
  );
  assert.equal(plannerReadback.rows[0].status, 'paused');

  await pool.query(`
    CREATE TABLE v8_agent_work_graphs (
      graph_id TEXT PRIMARY KEY, execution_run_id TEXT NOT NULL, organization_id TEXT NOT NULL,
      status TEXT NOT NULL, synthesis_json TEXT, updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE TABLE v8_agent_branch_tasks (
      task_id TEXT PRIMARY KEY, graph_id TEXT NOT NULL, organization_id TEXT NOT NULL,
      status TEXT NOT NULL, dependencies_json TEXT DEFAULT '[]', attempt_count INT DEFAULT 0,
      max_attempts INT DEFAULT 3, lease_owner TEXT, lease_expires_at TEXT, updated_at TIMESTAMP DEFAULT NOW()
    );
    INSERT INTO v8_agent_work_graphs VALUES ('graph-drift','run-drift','org-1','planned',NULL,NOW());
    INSERT INTO v8_agent_branch_tasks (task_id,graph_id,organization_id,status) VALUES ('task-drift','graph-drift','org-1','pending');
  `);
  const manager = await import('../services/v8/multiAgentWorkManagerService.js');
  const graphClaims = await manager.claimReadyBranchTasks({
    graphId: 'graph-drift',
    organizationId: 'org-1',
    workerId: 'graph-worker',
  });
  assert.equal(graphClaims.length, 0);
  const graphReadback = await pool.query(
    `SELECT status,synthesis_json FROM v8_agent_work_graphs WHERE graph_id='graph-drift'`
  );
  assert.equal(graphReadback.rows[0].status, 'blocked');

  const context = await import('../services/v8/agentContextGroundingService.js');
  const tenantDecision = await context.revalidateCanonicalRunContextForWorker({
    canonicalRunId: 'run-clean',
    organizationId: 'org-foreign',
    actorUserId: 'foreign-worker',
    workerKind: 'wave8_schedule',
    externalId: 'foreign',
  });
  assert.equal(tenantDecision.decision, 'blocked_snapshot');

  const decisions = await pool.query(
    `SELECT decision,COUNT(*)::int count FROM v8_agent_context_revalidations GROUP BY decision ORDER BY decision`
  );
  const driftCount = decisions.rows.find((row) => row.decision === 'blocked_drift')?.count || 0;
  assert.equal(driftCount, 3);
  assert.equal(decisions.rows.find((row) => row.decision === 'blocked_scope')?.count, 1);
  assert.equal(decisions.rows.find((row) => row.decision === 'allowed')?.count, 1);
  console.log(
    JSON.stringify({
      proof: 'A04_WORKER_CLAIM_REALDB_GREEN',
      cleanExactlyOnce: cleanCallbacks === 1,
      driftZeroCallbacks: blockedCallbacks === 0,
      scopeZeroCallbacks: blockedCallbacks === 0,
      tenantFailClosed: tenantDecision.decision === 'blocked_snapshot',
      durableBlockedReadback: true,
      plannerRecoverablePaused: plannerReadback.rows[0].status === 'paused',
      workGraphRecoverableBlocked: graphReadback.rows[0].status === 'blocked',
      restartNoDuplicateExecution: restartReadback.callbacks === 0,
      concurrentNoDuplicateExecution: cleanCallbacks === 1,
      durableDecisions: decisions.rows,
    })
  );
}

main().finally(() => pool.end());
