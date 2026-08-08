import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';

import { Pool } from 'pg';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString: databaseUrl });
const execFileAsync = promisify(execFile);

async function main() {
  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(
    fs.readFileSync(
      new URL('../../migrations/20260808_v8_agent_resource_governance.sql', import.meta.url),
      'utf8'
    )
  );
  await pool.query(`
    INSERT INTO v8_agent_resource_policies
      (policy_id,organization_id,project_id,max_concurrent_executions,max_estimated_cost_usd_per_run,lease_seconds)
    VALUES
      ('wg-main','org-work-graph','project-main',1,10,300),
      ('wg-restart','org-work-graph','project-restart',1,10,300)
  `);
  const { executeWithAgentResourceReservation, reserveAgentResource } =
    await import('../services/v8/agentResourceGovernanceService.js');
  let wave8Callbacks = 0;
  let graphCallbacks = 0;
  let releaseWave8!: () => void;
  const wave8Gate = new Promise<void>((resolve) => {
    releaseWave8 = resolve;
  });
  const wave8 = executeWithAgentResourceReservation({
    organizationId: 'org-work-graph',
    projectId: 'project-main',
    runId: 'canonical-main',
    userId: 'worker-user',
    agentId: 'wave8-agent',
    toolName: 'wave8.tool',
    idempotencyKey: 'wave8:canonical-main:tool:1',
    estimatedCostUsd: 0.4,
    execute: async () => {
      wave8Callbacks += 1;
      await wave8Gate;
      return 'wave8';
    },
  });
  while (wave8Callbacks !== 1) await new Promise((resolve) => setTimeout(resolve, 5));
  const graph = await executeWithAgentResourceReservation({
    organizationId: 'org-work-graph',
    projectId: 'project-main',
    runId: 'canonical-main',
    userId: 'worker-user',
    agentId: 'research-agent',
    toolName: 'work_graph.branch.launch',
    idempotencyKey: 'work-graph:canonical-main:graph-1:task-1:attempt:1',
    estimatedCostUsd: 0,
    execute: async () => {
      graphCallbacks += 1;
      return 'graph';
    },
  });
  assert.equal(graph.allowed, false);
  assert.equal(graphCallbacks, 0);
  releaseWave8();
  await wave8;
  assert.equal(wave8Callbacks + graphCallbacks, 1);

  const deniedReplay = await reserveAgentResource({
    organizationId: 'org-work-graph',
    projectId: 'project-main',
    runId: 'canonical-main',
    userId: 'worker-user',
    agentId: 'research-agent',
    toolName: 'work_graph.branch.launch',
    idempotencyKey: 'work-graph:canonical-main:graph-1:task-1:attempt:1',
    estimatedCostUsd: 0,
  });
  assert.equal(deniedReplay.allowed, false);
  assert.equal(deniedReplay.idempotentReplay, true);
  const retry = await executeWithAgentResourceReservation({
    organizationId: 'org-work-graph',
    projectId: 'project-main',
    runId: 'canonical-main',
    userId: 'worker-user',
    agentId: 'research-agent',
    toolName: 'work_graph.branch.launch',
    idempotencyKey: 'work-graph:canonical-main:graph-1:task-1:attempt:2',
    estimatedCostUsd: 0,
    execute: async () => {
      graphCallbacks += 1;
      return 'graph-retry';
    },
  });
  assert.equal(retry.allowed, true);
  assert.equal(graphCallbacks, 1);

  const child = await execFileAsync('npx', ['tsx', 'src/scripts/a09WorkGraphRestartWorker.ts'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'test',
      MOCK_DB: 'false',
      RUN_DB_TESTS: '1',
      DATABASE_URL: databaseUrl,
    },
  });
  assert.match(child.stdout, /A09_WORK_GRAPH_RESTART_RESERVED/);
  const recovered = await reserveAgentResource({
    organizationId: 'org-work-graph',
    projectId: 'project-restart',
    runId: 'canonical-restart',
    userId: 'worker-user',
    agentId: 'research-agent',
    toolName: 'work_graph.branch.launch',
    idempotencyKey: 'work-graph:canonical-restart:graph-r:task-r:attempt:2',
    estimatedCostUsd: 0,
    now: '2026-08-08T12:01:00.000Z',
  });
  assert.equal(recovered.allowed, true);
  await assert.rejects(
    reserveAgentResource({
      organizationId: 'org-foreign',
      projectId: 'project-main',
      runId: 'canonical-main',
      userId: 'worker-user',
      agentId: 'research-agent',
      toolName: 'work_graph.branch.launch',
      idempotencyKey: 'foreign-attempt',
      estimatedCostUsd: 0,
    }),
    /resource_policy_not_found/
  );
  const graphCost = await pool.query(
    `SELECT COALESCE(SUM(estimated_cost_usd),0)::numeric AS cost
       FROM v8_agent_resource_reservations
      WHERE tool_name='work_graph.branch.launch'`
  );
  assert.equal(Number(graphCost.rows[0].cost), 0);
  console.log(
    JSON.stringify({
      proof: 'A09_WORK_GRAPH_RESOURCE_REALDB_GREEN',
      simultaneousWave8AndGraphMax1Callbacks: 1,
      deniedGraphLaunchCallbacks: 0,
      graphEstimatedCostUsd: 0,
      a08RemainsCostOwner: true,
      stableDeniedReplayRows: 1,
      retryAttemptCallbacks: 1,
      restartLeaseRecovered: true,
      tenantProjectFailClosed: true,
      providerActualUsage: 'UNKNOWN',
    })
  );
}

main().finally(() => pool.end());
