import assert from 'node:assert/strict';
import fs from 'node:fs';

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
  await pool.query(
    adaptQuery(
      fs.readFileSync(
        new URL('../../migrations/20260807_v8_multi_agent_work_manager.sql', import.meta.url),
        'utf8'
      )
    )
  );
  await pool.query(
    adaptQuery(
      fs.readFileSync(
        new URL('../../migrations/20260323_v8_execution_spine.sql', import.meta.url),
        'utf8'
      )
    )
  );
  await pool.query(
    adaptQuery(
      fs.readFileSync(
        new URL('../../migrations/20260323_v8_execution_spine_approval_flow.sql', import.meta.url),
        'utf8'
      )
    )
  );
  const executionRunId = '00000000-0000-4000-8000-000000000808';
  await pool.query(
    `INSERT INTO v8_execution_runs
      (run_id, organization_id, context_snapshot_id, initiator_user_id, state, plan_version, goal, metadata)
     VALUES ($1, 'org-a08', 'snapshot-a08', 'owner-a08', 'planning', 1, 'Prepare governed multi-agent recommendation', '{}')`,
    [executionRunId]
  );
  const manager = await import('../services/v8/multiAgentWorkManagerService.js');
  const created = await manager.createWorkGraph({
    executionRunId,
    organizationId: 'org-a08',
    leadAgentId: 'lead-teresa',
    createdBy: 'owner-a08',
    mode: 'router_parallel',
    budget: { maxCostUsd: 10, maxTokens: 20_000 },
    tasks: [
      {
        key: 'research',
        specialistAgentId: 'research-agent',
        title: 'Evidence',
        objective: 'Gather evidence',
        toolScope: [],
        budget: { timeoutSeconds: 30, maxTokens: 10_000, maxCostUsd: 5 },
      },
      {
        key: 'finance',
        specialistAgentId: 'sheets-finance-agent',
        title: 'Finance',
        objective: 'Prepare scenarios',
        toolScope: [],
        budget: { timeoutSeconds: 30, maxTokens: 10_000, maxCostUsd: 5 },
      },
    ],
  });
  const executed = await manager.executeReadyWorkGraphBranches({
    graphId: created.graphId,
    organizationId: 'org-a08',
    userId: 'owner-a08',
    workerId: 'worker-a08',
  });
  assert.equal(executed.length, 2);
  assert.ok(executed.every((branch) => branch.status === 'completed' && branch.runId));
  const synthesis = await manager.synthesizeWorkGraph({
    graphId: created.graphId,
    organizationId: 'org-a08',
  });
  assert.equal(synthesis.status, 'completed');
  assert.equal(synthesis.outputs.length, 2);
  const review = await manager.proposeWorkGraphSynthesis({
    graphId: created.graphId,
    organizationId: 'org-a08',
    actorUserId: 'owner-a08',
  });
  assert.equal(review.runState, 'waiting_for_review');
  const approvalReadback = await pool.query(
    `SELECT r.state, p.status, p.approval_class, p.resolved_by
     FROM v8_execution_runs r JOIN v8_action_proposals p ON p.execution_run_id = r.run_id
     WHERE r.run_id = $1`,
    [executionRunId]
  );
  assert.equal(approvalReadback.rows[0].state, 'waiting_for_review');
  assert.equal(approvalReadback.rows[0].status, 'pending_review');
  assert.equal(approvalReadback.rows[0].approval_class, 'requires_human_approval');
  assert.equal(approvalReadback.rows[0].resolved_by, null);
  assert.equal(await manager.getWorkGraph(created.graphId, 'org-foreign'), null);
  const readback = await manager.getWorkGraph(created.graphId, 'org-a08');
  assert.equal(readback.tasks.length, 2);
  assert.ok(
    readback.tasks.every(
      (task: any) => JSON.parse(task.evidence_json)[0]?.type === 'wave8_agent_run'
    )
  );
  const usage = readback.tasks.map((task: any) => JSON.parse(task.usage_json));
  assert.ok(usage.every((meter: any) => meter.source === 'deterministic_local_runtime'));
  assert.ok(usage.every((meter: any) => meter.totalTokens > 0 && meter.totalTokens <= 10_000));
  assert.ok(usage.every((meter: any) => meter.costUsd === 0 && meter.durationMs >= 0));

  const conflictGraph = await manager.createWorkGraph({
    executionRunId,
    organizationId: 'org-a08',
    leadAgentId: 'lead-teresa',
    createdBy: 'owner-a08',
    mode: 'router_parallel',
    tasks: [
      {
        key: 'finance-view',
        specialistAgentId: 'sheets-finance-agent',
        title: 'Finance view',
        objective: 'Assess GO decision',
      },
      {
        key: 'risk-view',
        specialistAgentId: 'governance-agent',
        title: 'Risk view',
        objective: 'Assess GO decision',
      },
    ],
  });
  const conflictBranches = await manager.claimReadyBranchTasks({
    graphId: conflictGraph.graphId,
    organizationId: 'org-a08',
    workerId: 'conflict-worker',
  });
  assert.equal(conflictBranches.length, 2);
  for (const branch of conflictBranches) {
    const finance = branch.task_id === conflictGraph.taskIds['finance-view'];
    await manager.completeBranchTask({
      taskId: branch.task_id,
      organizationId: 'org-a08',
      workerId: 'conflict-worker',
      output: { claims: [{ key: 'go_decision', value: finance }] },
      evidence: [{ type: finance ? 'financial_analysis' : 'risk_analysis', ref: branch.task_id }],
      confidence: finance ? 0.91 : 0.82,
    });
  }
  const blockedSynthesis = await manager.synthesizeWorkGraph({
    graphId: conflictGraph.graphId,
    organizationId: 'org-a08',
  });
  assert.equal(blockedSynthesis.status, 'blocked');
  assert.equal(blockedSynthesis.contradictions.length, 1);
  const resolved = await manager.resolveWorkGraphContradiction({
    graphId: conflictGraph.graphId,
    organizationId: 'org-a08',
    actorUserId: 'owner-a08',
    claimKey: 'go_decision',
    resolutionType: 'choose_branch',
    sourceTaskId: conflictGraph.taskIds['finance-view'],
    selectedValue: true,
    rationale:
      'Reconciled finance model is current; risk conditions move into approval conditions.',
  });
  assert.deepEqual(resolved, { graphStatus: 'completed', unresolvedCount: 0 });
  const resolutionReadback = await pool.query(
    `SELECT claim_key, source_task_id, selected_value_json, rationale, resolved_by
       FROM v8_agent_contradiction_resolutions WHERE graph_id = $1`,
    [conflictGraph.graphId]
  );
  assert.equal(resolutionReadback.rows.length, 1);
  assert.equal(resolutionReadback.rows[0].resolved_by, 'owner-a08');
  assert.equal(resolutionReadback.rows[0].source_task_id, conflictGraph.taskIds['finance-view']);
  assert.equal(JSON.parse(resolutionReadback.rows[0].selected_value_json), true);

  const retryGraph = await manager.createWorkGraph({
    executionRunId,
    organizationId: 'org-a08',
    leadAgentId: 'lead-teresa',
    createdBy: 'owner-a08',
    mode: 'sequential',
    tasks: [
      {
        key: 'retryable',
        specialistAgentId: 'research-agent',
        title: 'Retryable dependency',
        objective: 'Recover after transient dependency failure',
        maxAttempts: 2,
      },
    ],
  });
  let retryClaim = await manager.claimReadyBranchTasks({
    graphId: retryGraph.graphId,
    organizationId: 'org-a08',
    workerId: 'retry-worker-1',
  });
  await manager.failBranchTask({
    taskId: retryClaim[0].task_id,
    organizationId: 'org-a08',
    workerId: 'retry-worker-1',
    error: 'external_dependency_temporarily_unavailable',
  });
  await manager.retryBranchTask({
    taskId: retryGraph.taskIds.retryable,
    organizationId: 'org-a08',
  });
  retryClaim = await manager.claimReadyBranchTasks({
    graphId: retryGraph.graphId,
    organizationId: 'org-a08',
    workerId: 'retry-worker-2',
  });
  assert.equal(retryClaim.length, 1);
  await manager.failBranchTask({
    taskId: retryClaim[0].task_id,
    organizationId: 'org-a08',
    workerId: 'retry-worker-2',
    error: 'external_dependency_still_unavailable',
  });
  await assert.rejects(
    manager.retryBranchTask({
      taskId: retryGraph.taskIds.retryable,
      organizationId: 'org-a08',
    }),
    /branch_retry_not_allowed/
  );
  const retryReadback = await manager.getWorkGraph(retryGraph.graphId, 'org-a08');
  assert.equal(Number(retryReadback.tasks[0].attempt_count), 2);
  assert.equal(retryReadback.tasks[0].status, 'failed');

  const cancelledGraph = await manager.createWorkGraph({
    executionRunId,
    organizationId: 'org-a08',
    leadAgentId: 'lead-teresa',
    createdBy: 'owner-a08',
    mode: 'sequential',
    tasks: [
      {
        key: 'future-work',
        specialistAgentId: 'research-agent',
        title: 'Future work',
        objective: 'Must never execute after cancellation',
      },
    ],
  });
  await manager.cancelWorkGraph({ graphId: cancelledGraph.graphId, organizationId: 'org-a08' });
  const cancelledReadback = await manager.getWorkGraph(cancelledGraph.graphId, 'org-a08');
  assert.equal(cancelledReadback.graph.status, 'cancelled');
  assert.equal(cancelledReadback.tasks[0].status, 'cancelled');
  assert.equal(
    (
      await manager.claimReadyBranchTasks({
        graphId: cancelledGraph.graphId,
        organizationId: 'org-a08',
        workerId: 'post-cancel-worker',
      })
    ).length,
    0
  );
  console.log(
    JSON.stringify({
      proof: 'A08_REALDB_GREEN',
      graphId: created.graphId,
      executionRunId,
      completedBranches: 2,
      evidenceReadback: true,
      synthesis: synthesis.status,
      tenantIsolation: true,
      proposalId: review.proposalId,
      proposalStatus: 'pending_review',
      humanApprovalRequired: true,
      noAutoApproval: true,
      runtimeUsageMetered: true,
      branchBudgetsEnforced: true,
      contradictionBlockedFirst: true,
      reviewedContradictionResolved: true,
      resolutionLineageReadback: true,
      boundedRetryRealDb: true,
      safeCancellationRealDb: true,
    })
  );
}

main().finally(() => pool.end());
