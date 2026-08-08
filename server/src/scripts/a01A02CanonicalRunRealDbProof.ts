import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
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
    CREATE TABLE v8_execution_runs (
      run_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, state TEXT NOT NULL,
      plan_version INTEGER NOT NULL, goal TEXT NOT NULL, updated_at TEXT, resolved_at TEXT
    );
    CREATE TABLE v8_run_state_transitions (
      transition_id TEXT PRIMARY KEY, run_id TEXT NOT NULL, from_state TEXT NOT NULL,
      to_state TEXT NOT NULL, triggered_by TEXT NOT NULL, reason TEXT, transitioned_at TEXT NOT NULL
    );
    CREATE TABLE transformation_cases (
      transformation_case_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, execution_run_id TEXT,
      conversation_id TEXT, lineage_id TEXT NOT NULL, status TEXT NOT NULL, lifecycle_stage TEXT NOT NULL,
      context_snapshot_id TEXT, project_id TEXT
    );
    CREATE TABLE v8_context_snapshots (
      snapshot_id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, project_id TEXT,
      source_context_refs JSONB NOT NULL DEFAULT '[]', drift_events JSONB NOT NULL DEFAULT '[]'
    );
    CREATE TABLE transformation_stage_proposals (
      proposal_id TEXT PRIMARY KEY, transformation_case_id TEXT NOT NULL, organization_id TEXT NOT NULL,
      lifecycle_stage TEXT, proposal_type TEXT, status TEXT, reviewed_by_user_id TEXT, created_at TEXT, updated_at TEXT
    );
    CREATE TABLE transformation_final_output_runs (
      run_id TEXT PRIMARY KEY, transformation_case_id TEXT NOT NULL, organization_id TEXT NOT NULL, status TEXT NOT NULL
    );
    CREATE TABLE transformation_case_audit_events (
      audit_event_id TEXT PRIMARY KEY, transformation_case_id TEXT NOT NULL, organization_id TEXT NOT NULL,
      event_type TEXT, actor_user_id TEXT, correlation_id TEXT, created_at TEXT
    );
  `);
  const canonicalRunId = '00000000-0000-4000-8000-000000000102';
  await pool.query(
    `INSERT INTO v8_execution_runs VALUES ($1, 'org-a02', 'planning', 7, 'Execute transformation', '2026-08-07T09:00:00Z', NULL)`,
    [canonicalRunId]
  );
  await pool.query(
    `INSERT INTO v8_context_snapshots VALUES ('snapshot-a02','org-a02','project-a02','[]','[]')`
  );
  await pool.query(
    `INSERT INTO transformation_cases VALUES ('case-a02', 'org-a02', $1, 'conversation-a02', 'lineage-a02', 'active', 'execution', 'snapshot-a02', 'project-a02')`,
    [canonicalRunId]
  );
  await pool.query(
    `INSERT INTO v8_run_state_transitions VALUES ('transition-seed', $1, 'drafting', 'planning', 'owner-a02', 'Plan approved', '2026-08-07T08:00:00Z')`,
    [canonicalRunId]
  );
  await pool.query(
    fs.readFileSync(
      new URL('../../migrations/20260807_v8_agent_context_grounding.sql', import.meta.url),
      'utf8'
    )
  );
  await pool.query(
    adaptQuery(
      fs.readFileSync(
        new URL('../../migrations/20260807_v8_agent_run_identity.sql', import.meta.url),
        'utf8'
      )
    )
  );
  const service = await import('../services/v8/agentCanonicalRunService.js');
  const executionDrift = await service.getCanonicalTransformationRun({
    transformationCaseId: 'case-a02',
    organizationId: 'org-a02',
  });
  assert.equal(executionDrift.canonicalRunId, canonicalRunId);
  assert.equal(executionDrift.projectedState, 'applying');
  assert.equal(executionDrift.stateDrift, true);
  const applying = await service.reconcileCanonicalTransformationRun({
    transformationCaseId: 'case-a02',
    organizationId: 'org-a02',
    actorUserId: 'operator-a02',
    reason: 'Accepted execution start proves applying state.',
  });
  assert.equal(applying.actualState, 'applying');
  assert.equal(applying.stateDrift, false);
  const firstAliasProjection = await service.projectCanonicalRunAfterExternalTransition({
    canonicalRunId,
    organizationId: 'org-a02',
    aliasType: 'wave8_run',
    externalId: 'agent8-restart-proof',
    actorUserId: 'operator-a02',
    reason: 'Wave8 execution checkpoint persisted.',
  });
  assert.equal(firstAliasProjection.stateDrift, false);
  const wave8Runtime = await import('../services/wave8AgentRuntimeService.js');
  const boundedRun = await wave8Runtime.launchWave8Agent({
    canonicalRunId,
    organizationId: 'org-a02',
    userId: 'operator-a02',
    agentId: 'research-agent',
    goal: 'Bounded A02 projection proof',
  });
  assert.equal(boundedRun.run.canonicalRunId, canonicalRunId);
  const automaticWaveAlias = await pool.query(
    `SELECT canonical_run_id FROM v8_agent_run_aliases WHERE organization_id = 'org-a02' AND alias_type = 'wave8_run' AND external_id = $1`,
    [boundedRun.run.runId]
  );
  assert.equal(automaticWaveAlias.rows[0].canonical_run_id, canonicalRunId);
  await wave8Runtime.launchWave8Agent({
    canonicalRunId,
    organizationId: 'org-a02',
    userId: 'operator-a02',
    agentId: 'research-agent',
    goal: 'Bounded durable schedule projection proof',
    schedule: {
      cadence: 'once',
      nextRunAt: '2026-08-09T09:00:00.000Z',
      ownerUserId: 'operator-a02',
      timezone: 'Europe/Warsaw',
    },
  });
  const schedule = await pool.query(
    `SELECT schedule_id, canonical_run_id FROM wave8_agent_schedules WHERE organization_id = 'org-a02'`
  );
  assert.equal(schedule.rows[0].canonical_run_id, canonicalRunId);
  await wave8Runtime.transitionWave8AgentSchedule({
    organizationId: 'org-a02',
    scheduleId: schedule.rows[0].schedule_id,
    actorUserId: 'operator-a02',
    action: 'pause',
  });
  const scheduleAlias = await pool.query(
    `SELECT canonical_run_id FROM v8_agent_run_aliases WHERE organization_id = 'org-a02' AND alias_type = 'schedule' AND external_id = $1`,
    [schedule.rows[0].schedule_id]
  );
  assert.equal(scheduleAlias.rows[0].canonical_run_id, canonicalRunId);
  for (const migration of [
    '672_enterprise_agent_planner.sql',
    '941_ai_agent_plan_execution_lease.sql',
    '942_ai_agent_plan_run_idempotency.sql',
    '20260807_v8_multi_agent_work_manager.sql',
  ]) {
    await pool.query(
      fs.readFileSync(new URL(`../../migrations/${migration}`, import.meta.url), 'utf8')
    );
  }
  await pool.query(
    fs.readFileSync(
      new URL(
        '../../migrations/20260808_v8_agent_canonical_projection_bindings.sql',
        import.meta.url
      ),
      'utf8'
    )
  );
  const planner = await import('../services/ai/agentPlannerService.js');
  const agentPlan = await planner.agentPlannerService.createPlan({
    canonicalRunId,
    organizationId: 'org-a02',
    userId: 'operator-a02',
    title: 'Canonical planner projection proof',
    steps: [{ toolName: 'search_knowledge_base', toolInput: { query: 'A02' } }],
  });
  const scheduledPlan = await planner.agentPlannerService.schedulePlan(
    agentPlan.id,
    '2026-08-09T12:00:00.000Z'
  );
  assert.equal(scheduledPlan.status, 'scheduled');
  assert.equal(scheduledPlan.canonicalRunId, canonicalRunId);
  const manager = await import('../services/v8/multiAgentWorkManagerService.js');
  const graph = await manager.createWorkGraph({
    executionRunId: canonicalRunId,
    organizationId: 'org-a02',
    leadAgentId: 'lead-a02',
    createdBy: 'operator-a02',
    mode: 'sequential',
    tasks: [
      {
        key: 'bounded',
        specialistAgentId: 'research-agent',
        title: 'Bounded work',
        objective: 'Prove durable graph projection',
      },
    ],
  });
  const claimed = await manager.claimReadyBranchTasks({
    graphId: graph.graphId,
    organizationId: 'org-a02',
    workerId: 'worker-a02',
  });
  assert.equal(claimed.length, 1);
  const plannerAndGraphAliases = await pool.query(
    `SELECT alias_type, external_id, canonical_run_id FROM v8_agent_run_aliases
      WHERE organization_id = 'org-a02' AND external_id IN ($1, $2) ORDER BY alias_type`,
    [agentPlan.id, graph.graphId]
  );
  assert.deepEqual(
    plannerAndGraphAliases.rows.map((row) => row.alias_type),
    ['agent_plan', 'work_graph']
  );
  await pool.query(
    `UPDATE transformation_cases SET lifecycle_stage = 'final_outputs' WHERE transformation_case_id = 'case-a02'`
  );
  await pool.query(
    `INSERT INTO transformation_final_output_runs VALUES ('output-a02', 'case-a02', 'org-a02', 'completed')`
  );
  const finalDrift = await service.getCanonicalTransformationRun({
    transformationCaseId: 'case-a02',
    organizationId: 'org-a02',
  });
  assert.equal(finalDrift.projectedState, 'completed');
  const completed = await service.reconcileCanonicalTransformationRun({
    transformationCaseId: 'case-a02',
    organizationId: 'org-a02',
    actorUserId: 'operator-a02',
    reason: 'Verified Word and PowerPoint output readback completed.',
  });
  assert.equal(completed.actualState, 'completed');
  assert.equal(completed.stateDrift, false);
  assert.equal(completed.canonicalRunId, canonicalRunId);
  const audit = await pool.query(
    `SELECT from_state, to_state, actor_user_id FROM v8_agent_run_reconciliation_events ORDER BY created_at`
  );
  assert.deepEqual(
    audit.rows.map((row) => [row.from_state, row.to_state]),
    [
      ['planning', 'applying'],
      ['applying', 'completed'],
    ]
  );
  assert.ok(audit.rows.every((row) => row.actor_user_id === 'operator-a02'));
  assert.equal(
    await service.getCanonicalTransformationRun({
      transformationCaseId: 'case-a02',
      organizationId: 'org-foreign',
    }),
    null
  );
  await assert.rejects(
    service.registerCanonicalRunAlias({
      canonicalRunId,
      organizationId: 'org-foreign',
      aliasType: 'wave8_run',
      externalId: 'agent8-restart-proof',
    }),
    /canonical_run_identity_not_found/
  );
  const restartWorker = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      fileURLToPath(new URL('./a02CanonicalProjectionRestartWorker.ts', import.meta.url)),
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: databaseUrl,
        A02_AGENT_PLAN_ID: agentPlan.id,
        A02_WORK_GRAPH_ID: graph.graphId,
      },
      encoding: 'utf8',
    }
  );
  assert.equal(
    restartWorker.status,
    0,
    `restart worker failed: ${restartWorker.stderr || restartWorker.stdout}`
  );
  const restartProof = JSON.parse(restartWorker.stdout.trim().split('\n').at(-1) || '{}');
  assert.deepEqual(restartProof, {
    restartReplay: true,
    aliasCount: 3,
    duplicateTransitions: 0,
  });
  const aliasCount = await pool.query(
    `SELECT COUNT(*)::int AS count FROM v8_agent_run_aliases WHERE organization_id = 'org-a02' AND external_id = 'agent8-restart-proof'`
  );
  assert.equal(aliasCount.rows[0].count, 1);
  console.log(
    JSON.stringify({
      proof: 'A01_A02_REALDB_GREEN',
      oneCanonicalRunId: canonicalRunId,
      identityBackfill: true,
      executionDriftDetected: true,
      applyingReconciled: true,
      finalOutputProjectedCompleted: true,
      completedReconciled: true,
      transitionAndReconciliationAudit: audit.rows.length,
      tenantIsolation: true,
      restartReplay: true,
      aliasCountAfterRestart: aliasCount.rows[0].count,
      restartAliasTypesVerified: restartProof.aliasCount,
      duplicateTransitionsAfterRestart: 0,
      automaticWave8Projection: true,
      automaticScheduleProjection: true,
      automaticAgentPlanProjection: true,
      automaticWorkGraphProjection: true,
    })
  );
}

main().finally(() => pool.end());
