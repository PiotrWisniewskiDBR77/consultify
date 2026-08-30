/** @vitest-environment node */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { estimateAgentToolCostUsd } from '../toolCostEstimates.js';
import { reserveAgentResource } from '../../v8/agentResourceGovernanceService.js';

const enabled = process.env.RUN_DB_TESTS === '1' && process.env.RUN_REDIS_TESTS === '1';

describe.skipIf(!enabled)('DAY174 resource policy and cost — real PG + Redis', () => {
  const tag = randomUUID();
  const organizationId = `day174-resource-org-${tag}`;
  const projectId = `day174-resource-project-${tag}`;
  const userId = `day174-resource-user-${tag}`;
  let pool: Pool;

  beforeAll(async () => {
    expect(process.env.DB_TYPE).toBe('postgres');
    expect(process.env.MOCK_REDIS).toBe('false');
    expect(process.env.ENABLE_AI_TASKS_WORKER).toBe('true');
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => pool?.end());

  it('creates an enabled default policy on first use and charges deterministic tool cost', async () => {
    const estimatedCostUsd = estimateAgentToolCostUsd('search_web');
    expect(estimatedCostUsd).toBe(0.02);
    const decision = await reserveAgentResource({
      organizationId,
      projectId,
      runId: `run-${tag}`,
      userId,
      agentId: 'agent-planner',
      toolName: 'search_web',
      idempotencyKey: `first-${tag}`,
      estimatedCostUsd,
    });
    expect(decision).toMatchObject({ allowed: true, estimatedCostUsd: 0.02 });
    const policy = (
      await pool.query(
        `SELECT max_concurrent_executions,max_estimated_cost_usd_per_run,lease_seconds,enabled
           FROM v8_agent_resource_policies WHERE organization_id=$1 AND project_id=$2`,
        [organizationId, projectId]
      )
    ).rows[0];
    expect(Number(policy.max_concurrent_executions)).toBe(4);
    expect(Number(policy.max_estimated_cost_usd_per_run)).toBe(0.25);
    expect(Number(policy.lease_seconds)).toBe(300);
    expect(Number(policy.enabled)).toBe(1);
  });

  it('makes a low cost limit visibly deny the priced tool', async () => {
    await pool.query(
      `UPDATE v8_agent_resource_policies
          SET max_estimated_cost_usd_per_run=0.01
        WHERE organization_id=$1 AND project_id=$2`,
      [organizationId, projectId]
    );
    const decision = await reserveAgentResource({
      organizationId,
      projectId,
      runId: `low-run-${tag}`,
      userId,
      agentId: 'agent-planner',
      toolName: 'search_web',
      idempotencyKey: `low-${tag}`,
      estimatedCostUsd: estimateAgentToolCostUsd('search_web'),
    });
    expect(decision).toMatchObject({
      allowed: false,
      reason: 'resource_estimated_cost_limit_exceeded',
      estimatedCostUsd: 0.02,
    });
  });

  it('does not replace an explicitly disabled policy', async () => {
    const disabledProject = `${projectId}-disabled`;
    await pool.query(
      `INSERT INTO v8_agent_resource_policies
        (policy_id,organization_id,project_id,max_concurrent_executions,
         max_estimated_cost_usd_per_run,lease_seconds,enabled)
       VALUES ($1,$2,$3,1,1,300,0)`,
      [`disabled-${tag}`, organizationId, disabledProject]
    );
    await expect(
      reserveAgentResource({
        organizationId,
        projectId: disabledProject,
        runId: `disabled-run-${tag}`,
        userId,
        agentId: 'agent-planner',
        toolName: 'search_web',
        idempotencyKey: `disabled-${tag}`,
        estimatedCostUsd: 0.02,
      })
    ).rejects.toThrow('resource_policy_not_found');
  });
});
