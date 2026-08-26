import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ControlKpiReadModel } from '../../server/src/services/executionControl/controlKpiReadModel.js';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const REAL_DB =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');

describe.skipIf(!REAL_DB)('Day 17 X.4 control KPI policy — real PostgreSQL', () => {
  const suffix = randomUUID().slice(0, 8);
  const orgA = `day17_x4_org_a_${suffix}`;
  const orgB = `day17_x4_org_b_${suffix}`;
  const policyId = `day17_x4_policy_${suffix}`;
  let pool: Pool;
  let model: ControlKpiReadModel;

  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL });
    model = new ControlKpiReadModel(pool);
    await pool.query(
      `INSERT INTO execution_control_kpi_policies
         (policy_id, organization_id, name, parameters)
       VALUES ($1, $2, 'Foreign policy', $3::jsonb)`,
      [
        policyId,
        orgB,
        JSON.stringify({
          impactWeights: {},
          atRiskThresholdDays: 1,
          capacitySaturationThreshold: 1,
          capacityBuffer: 1,
          decisionSlaDays: 1,
        }),
      ]
    );
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM execution_control_kpi_policies WHERE policy_id = $1`, [policyId]);
    await pool.end();
  });

  it('does not resolve another tenant policy or change any family denominator', async () => {
    const result = await model.read(orgA, '2026-08-24', policyId);
    expect(result.policy.policyId).toBeNull();
    expect(result.policy.resolved).toBe(false);
    expect(result.families).toHaveLength(8);
    expect(result.families.every((family) => family.denominator === null)).toBe(true);
  });
});
