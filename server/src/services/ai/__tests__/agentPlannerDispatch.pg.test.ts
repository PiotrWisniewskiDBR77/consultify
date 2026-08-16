import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_DB)('AGT-OPS-001 planner dispatch identity (real PostgreSQL)', () => {
  const suffix = randomUUID();
  const org = `codex_agt_ops_org_${suffix}`;
  const user = `codex_agt_ops_user_${suffix}`;
  let pool: Pool;
  let planner: typeof import('../agentPlannerService.js').agentPlannerService;
  let planId = '';

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    pool = new Pool({ connectionString: DATABASE_URL });
    await pool.query(`INSERT INTO organizations(id,name) VALUES($1,$1)`, [org]);
    ({ agentPlannerService: planner } = await import('../agentPlannerService.js'));
    const plan = await planner.createPlan({
      organizationId: org,
      userId: user,
      title: 'AGT OPS fixture',
      steps: [],
      isBackground: true,
    });
    planId = plan.id;
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM ai_agent_plan_steps WHERE plan_id=$1`, [planId]);
    await pool.query(`DELETE FROM ai_agent_plans WHERE id=$1 AND organization_id=$2`, [
      planId,
      org,
    ]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [org]);
    await pool.end();
  });

  it('concurrent same-key dispatch claims converge idempotently', async () => {
    const key = `dispatch:${suffix}`;
    const results = await Promise.all([
      planner.claimRunSubmission(planId, key),
      planner.claimRunSubmission(planId, key),
    ]);
    expect(results.sort()).toEqual(['already-mine', 'claimed']);
  });

  it('different retry identity conflicts and foreign tenant enqueue fails closed', async () => {
    expect(await planner.claimRunSubmission(planId, `other:${suffix}`)).toBe('conflict');
    await expect(
      planner.executeGovernedEnqueue({
        planId,
        organizationId: `foreign_${suffix}`,
        userId: user,
        dispatchKey: 'foreign',
        enqueue: async () => 'never',
      })
    ).rejects.toThrow('planner_enqueue_scope_mismatch');
  });

  it('cold connection reads one stable dispatch key', async () => {
    const cold = new Pool({ connectionString: DATABASE_URL });
    const row = await cold.query(
      `SELECT organization_id,run_idempotency_key FROM ai_agent_plans WHERE id=$1`,
      [planId]
    );
    await cold.end();
    expect(row.rows).toHaveLength(1);
    expect(row.rows[0].organization_id).toBe(org);
    expect(row.rows[0].run_idempotency_key).toBe(`dispatch:${suffix}`);
  });
});
