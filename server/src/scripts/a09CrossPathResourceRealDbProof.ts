import assert from 'node:assert/strict';
import fs from 'node:fs';

import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });

async function main() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(
    fs.readFileSync(
      new URL('../../migrations/20260808_v8_agent_resource_governance.sql', import.meta.url),
      'utf8'
    )
  );
  await pool.query(
    `INSERT INTO v8_agent_resource_policies
      (policy_id,organization_id,project_id,max_concurrent_executions,
       max_estimated_cost_usd_per_run,lease_seconds,enabled)
     VALUES ('cross-path-policy','org-cross','project-cross',2,10,300,1)`
  );
  const { executeWithAgentResourceReservation } =
    await import('../services/v8/agentResourceGovernanceService.js');
  const paths = ['wave8', 'planner', 'work_graph', 'a06'] as const;
  const callbackCounts = { wave8: 0, planner: 0, work_graph: 0, a06: 0 };
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const concurrent = Array.from({ length: 12 }, (_, index) => {
    const path = paths[index % paths.length];
    return executeWithAgentResourceReservation({
      organizationId: 'org-cross',
      projectId: 'project-cross',
      runId: 'canonical-cross',
      userId: 'user-cross',
      agentId: `${path}-agent`,
      toolName: `${path}.execute`,
      idempotencyKey: `${path}:concurrent:${index}`,
      estimatedCostUsd: 0.1,
      execute: async () => {
        callbackCounts[path] += 1;
        await gate;
        return path;
      },
    });
  });
  while (true) {
    const decisions = await pool.query(
      `SELECT COUNT(*)::int AS count FROM v8_agent_resource_reservations
       WHERE organization_id='org-cross' AND run_id='canonical-cross'`
    );
    if (decisions.rows[0].count === 12) break;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  release();
  const results = await Promise.all(concurrent);
  const totalCallbacks = Object.values(callbackCounts).reduce((sum, value) => sum + value, 0);
  assert.equal(totalCallbacks, 2);
  assert.equal(results.filter((result) => result.allowed).length, 2);
  assert.equal(results.filter((result) => !result.allowed).length, 10);

  await pool.query(
    `UPDATE v8_agent_resource_policies
        SET max_concurrent_executions=10,max_estimated_cost_usd_per_run=0.8
      WHERE policy_id='cross-path-policy'`
  );
  let budgetCallbacks = 0;
  const budgetResults = await Promise.all(
    paths.map((path) =>
      executeWithAgentResourceReservation({
        organizationId: 'org-cross',
        projectId: 'project-cross',
        runId: 'canonical-budget-cross',
        userId: 'user-cross',
        agentId: `${path}-agent`,
        toolName: `${path}.execute`,
        idempotencyKey: `${path}:budget`,
        estimatedCostUsd: 0.4,
        execute: async () => {
          budgetCallbacks += 1;
          return path;
        },
      })
    )
  );
  assert.equal(budgetCallbacks, 2);
  assert.equal(budgetResults.filter((result) => result.allowed).length, 2);
  const unknownActual = await pool.query(
    `SELECT COUNT(*)::int AS count FROM v8_agent_resource_reservations
     WHERE actual_cost_usd IS NOT NULL OR actual_usage_source <> 'UNKNOWN'`
  );
  assert.equal(unknownActual.rows[0].count, 0);

  console.log(
    JSON.stringify({
      proof: 'A09_CROSS_PATH_RESOURCE_REALDB_GREEN',
      paths,
      canonicalRun: 'canonical-cross',
      concurrentAttempts: 12,
      maxConcurrent: 2,
      totalCallbacks,
      durableDenied: 10,
      budgetUsd: 0.8,
      estimatesUsd: [0.4, 0.4, 0.4],
      budgetCallbacks,
      aggregateAcrossPaths: true,
      providerActualUsage: 'UNKNOWN',
    })
  );
}

main().finally(() => pool.end());
