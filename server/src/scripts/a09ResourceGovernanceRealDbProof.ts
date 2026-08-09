import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';

import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });
const execFileAsync = promisify(execFile);

async function seedPolicy(input: {
  policyId: string;
  organizationId: string;
  projectId: string;
  maxConcurrent: number;
  maxCost: number;
}) {
  await pool.query(
    `INSERT INTO v8_agent_resource_policies
      (policy_id, organization_id, project_id, max_concurrent_executions,
       max_estimated_cost_usd_per_run, lease_seconds, enabled)
     VALUES ($1,$2,$3,$4,$5,300,1)`,
    [input.policyId, input.organizationId, input.projectId, input.maxConcurrent, input.maxCost]
  );
}

async function main(): Promise<void> {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(
    fs.readFileSync(
      new URL('../../migrations/20260808_v8_agent_resource_governance.sql', import.meta.url),
      'utf8'
    )
  );
  await seedPolicy({
    policyId: 'policy-concurrency',
    organizationId: 'org-a09',
    projectId: 'project-concurrency',
    maxConcurrent: 2,
    maxCost: 100,
  });
  await seedPolicy({
    policyId: 'policy-budget',
    organizationId: 'org-a09',
    projectId: 'project-budget',
    maxConcurrent: 20,
    maxCost: 1,
  });
  await seedPolicy({
    policyId: 'policy-restart',
    organizationId: 'org-a09',
    projectId: 'project-restart',
    maxConcurrent: 1,
    maxCost: 10,
  });

  const { executeWithAgentResourceReservation, reserveAgentResource } =
    await import('../services/v8/agentResourceGovernanceService.js');
  let callbacks = 0;
  let releaseCallbacks!: () => void;
  const callbackGate = new Promise<void>((resolve) => {
    releaseCallbacks = resolve;
  });
  const attempts = Array.from({ length: 20 }, (_, index) =>
    executeWithAgentResourceReservation({
      organizationId: 'org-a09',
      projectId: 'project-concurrency',
      runId: 'run-concurrency',
      userId: 'user-a09',
      agentId: 'execution-agent',
      toolName: 'bounded-tool',
      idempotencyKey: `concurrent-${index}`,
      estimatedCostUsd: 0.1,
      execute: async () => {
        callbacks += 1;
        await callbackGate;
        return 'ok';
      },
    })
  );
  // Keep the two admitted callbacks active until every concurrent admission has
  // durably decided. Releasing earlier would turn this into a throughput test,
  // not a max-concurrency proof.
  while (true) {
    const decided = await pool.query(
      `SELECT COUNT(*)::int AS count FROM v8_agent_resource_reservations
       WHERE project_id='project-concurrency'`
    );
    if (decided.rows[0].count === 20) break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  releaseCallbacks();
  const concurrentResults = await Promise.all(attempts);
  assert.equal(callbacks, 2);
  assert.equal(concurrentResults.filter((item) => item.allowed).length, 2);
  const concurrentRows = await pool.query(
    `SELECT status, COUNT(*)::int AS count FROM v8_agent_resource_reservations
     WHERE project_id='project-concurrency' GROUP BY status`
  );
  assert.equal(
    concurrentRows.rows.find((row) => row.status === 'settled')?.count,
    2
  );
  assert.equal(concurrentRows.rows.find((row) => row.status === 'denied')?.count, 18);

  let budgetCallbacks = 0;
  const budgetResults = await Promise.all(
    ['budget-a', 'budget-b'].map((idempotencyKey) =>
      executeWithAgentResourceReservation({
        organizationId: 'org-a09',
        projectId: 'project-budget',
        runId: 'run-budget',
        userId: 'user-a09',
        agentId: 'execution-agent',
        toolName: 'bounded-tool',
        idempotencyKey,
        estimatedCostUsd: 0.6,
        execute: async () => {
          budgetCallbacks += 1;
          return 'ok';
        },
      })
    )
  );
  assert.equal(budgetCallbacks, 1);
  assert.equal(budgetResults.filter((item) => item.allowed).length, 1);

  let replayCallbacks = 0;
  const replayBase = {
    organizationId: 'org-a09',
    projectId: 'project-budget',
    runId: 'run-replay',
    userId: 'user-a09',
    agentId: 'execution-agent',
    toolName: 'bounded-tool',
    idempotencyKey: 'replay-key',
    estimatedCostUsd: 0.4,
    execute: async () => {
      replayCallbacks += 1;
      return 'once';
    },
  };
  await executeWithAgentResourceReservation(replayBase);
  const replay = await executeWithAgentResourceReservation(replayBase);
  assert.equal(replayCallbacks, 1);
  assert.equal(replay.replayed, true);
  assert.equal(
    (
      await pool.query(
        `SELECT COUNT(*)::int AS count FROM v8_agent_resource_reservations
         WHERE organization_id='org-a09' AND idempotency_key='replay-key'`
      )
    ).rows[0].count,
    1
  );

  const restartWorker = await execFileAsync(
    'npx',
    ['tsx', 'src/scripts/a09ResourceGovernanceRestartWorker.ts'],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        MOCK_DB: 'false',
        RUN_DB_TESTS: '1',
        DATABASE_URL: databaseUrl,
      },
    }
  );
  assert.match(restartWorker.stdout, /A09_RESTART_WORKER_RESERVED/);
  const recovered = await reserveAgentResource({
    organizationId: 'org-a09',
    projectId: 'project-restart',
    runId: 'run-after-restart',
    userId: 'user-a09',
    agentId: 'execution-agent',
    toolName: 'bounded-tool',
    idempotencyKey: 'after-restart-key',
    estimatedCostUsd: 0.2,
    now: '2026-08-08T10:01:00.000Z',
  });
  assert.equal(recovered.allowed, true);
  assert.equal(
    (
      await pool.query(
        `SELECT status FROM v8_agent_resource_reservations
         WHERE organization_id='org-a09' AND idempotency_key='stale-key'`
      )
    ).rows[0].status,
    'expired'
  );

  await assert.rejects(
    reserveAgentResource({
      organizationId: 'org-foreign',
      projectId: 'project-budget',
      runId: 'run-foreign',
      userId: 'user-a09',
      agentId: 'execution-agent',
      toolName: 'bounded-tool',
      idempotencyKey: 'foreign-key',
      estimatedCostUsd: 0.1,
    }),
    /resource_policy_not_found/
  );
  const actualUsage = await pool.query(
    `SELECT COUNT(*)::int AS count FROM v8_agent_resource_reservations
     WHERE actual_cost_usd IS NOT NULL OR actual_usage_source <> 'UNKNOWN'`
  );
  assert.equal(actualUsage.rows[0].count, 0);

  console.log(
    JSON.stringify({
      proof: 'A09_RESOURCE_GOVERNANCE_REALDB_GREEN',
      concurrencyAttempts: 20,
      concurrencyCallbacks: callbacks,
      concurrencySettled: 2,
      concurrencyDenied: 18,
      budgetCallbacks,
      budgetAllowed: 1,
      idempotentReplayCallbacks: replayCallbacks,
      idempotentReservationRows: 1,
      expiredLeaseRecovered: true,
      tenantFailClosed: true,
      providerActualUsage: 'UNKNOWN',
    })
  );
}

main().finally(() => pool.end());
