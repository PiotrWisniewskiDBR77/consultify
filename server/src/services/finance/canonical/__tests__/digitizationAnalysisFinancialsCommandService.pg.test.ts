import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const runRealDb =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const describeRealDb = runRealDb ? describe : describe.skip;
const prefix = `fin-da-financials-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const actor = `${prefix}-actor`;
const analysisId = `${prefix}-analysis`;
async function db() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}
let service: typeof import('../digitizationAnalysisFinancialsCommandService.js');

beforeAll(async () => {
  if (!runRealDb) return;
  const name = new URL(DATABASE_URL).pathname.slice(1);
  if (
    process.env.FIN_DA_FINANCIALS_ALLOW_CLEANUP !== '1' ||
    !name.startsWith(process.env.FIN_DA_FINANCIALS_DB_PREFIX || 'never-match')
  )
    throw new Error('Digitization financials proof requires an explicitly guarded disposable DB');
  const client = await db();
  try {
    await client.query(
      `INSERT INTO organizations(id,name) VALUES($1,'Financials A'),($2,'Financials B')`,
      [orgA, orgB]
    );
    await client.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role) VALUES($1,$2,$3,'Financials','Owner','ADMIN')`,
      [actor, orgA, `${actor}@test.local`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at) VALUES($1,$2,$3,'OWNER','ACTIVE',now())`,
      [randomUUID(), orgA, actor]
    );
    await client.query(
      `INSERT INTO digitization_analyses(id,name,status,organization_id,created_by,created_at,updated_at) VALUES($1,'Financial graph','draft',$2,$3,now(),now())`,
      [analysisId, orgA, actor]
    );
  } finally {
    await client.end();
  }
  service = await import('../digitizationAnalysisFinancialsCommandService.js');
});

afterAll(async () => {
  if (!runRealDb) return;
  const client = await db();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL session_replication_role=replica`);
    await client.query(
      `DELETE FROM finance_digitization_analysis_financials_receipts WHERE organization_id=ANY($1::text[])`,
      [[orgA, orgB]]
    );
    await client.query(
      `DELETE FROM analysis_financial_scenarios WHERE organization_id=ANY($1::text[])`,
      [[orgA, orgB]]
    );
    await client.query(`DELETE FROM analysis_financials WHERE organization_id=ANY($1::text[])`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM digitization_analyses WHERE organization_id=ANY($1::text[])`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM organization_members WHERE organization_id=ANY($1::text[])`, [
      [orgA, orgB],
    ]);
    await client.query(`DELETE FROM users WHERE id=$1`, [actor]);
    await client.query(`DELETE FROM organizations WHERE id=ANY($1::text[])`, [[orgA, orgB]]);
    await client.query('COMMIT');
    const state = await client.query<{ residue: string; disabled: string; locks: string }>(
      `SELECT ((SELECT count(*) FROM finance_digitization_analysis_financials_receipts WHERE organization_id=ANY($1::text[]))+(SELECT count(*) FROM analysis_financial_scenarios WHERE organization_id=ANY($1::text[]))+(SELECT count(*) FROM analysis_financials WHERE organization_id=ANY($1::text[]))+(SELECT count(*) FROM digitization_analyses WHERE organization_id=ANY($1::text[]))+(SELECT count(*) FROM organizations WHERE id=ANY($1::text[])))::text residue,(SELECT count(*)::text FROM pg_trigger WHERE NOT tgisinternal AND tgenabled <> 'O') disabled,(SELECT count(*)::text FROM pg_locks WHERE locktype='advisory') locks`,
      [[orgA, orgB]]
    );
    expect(state.rows[0]).toEqual({ residue: '0', disabled: '0', locks: '0' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
});

describeRealDb('ECO-W04 canonical digitization financial graph (real PostgreSQL)', () => {
  const body = {
    expectedVersion: 1,
    costs: [
      { year: 0, amount: 100000, description: 'CAPEX' },
      { year: 1, amount: 10000, description: 'OPEX' },
    ],
    benefits: [{ year: 1, amount: 50000, description: 'Annual savings' }],
    discountRate: 10,
    investmentHorizon: 5,
  };

  it('persists financials, metrics and exactly three scenarios once under retries', async () => {
    const input = {
      organizationId: orgA,
      userId: actor,
      analysisId,
      idempotencyKey: `${prefix}-key`,
      body,
    };
    const results = await Promise.all(
      Array.from({ length: 6 }, () => service.persistDigitizationAnalysisFinancialsCommand(input))
    );
    expect(new Set(results.map((result) => result.receiptId))).toHaveLength(1);
    expect(results.filter((result) => !result.replay)).toHaveLength(1);
    expect(results[0].metrics.npv).not.toBeNull();
    const client = await db();
    try {
      expect(
        (
          await client.query(
            `SELECT initial_investment,annual_operating_cost,annual_cost_savings,discount_rate,analysis_horizon_years FROM analysis_financials WHERE analysis_id=$1`,
            [analysisId]
          )
        ).rows[0]
      ).toEqual({
        initial_investment: 100000,
        annual_operating_cost: 10000,
        annual_cost_savings: 50000,
        discount_rate: 10,
        analysis_horizon_years: 5,
      });
      expect(
        (
          await client.query(
            `SELECT scenario_type,is_active FROM analysis_financial_scenarios WHERE analysis_id=$1 ORDER BY scenario_type`,
            [analysisId]
          )
        ).rows
      ).toEqual([
        { scenario_type: 'base', is_active: true },
        { scenario_type: 'conservative', is_active: false },
        { scenario_type: 'optimistic', is_active: false },
      ]);
      expect(
        (
          await client.query(`SELECT command_version FROM digitization_analyses WHERE id=$1`, [
            analysisId,
          ])
        ).rows[0].command_version
      ).toBe(2);
      await expect(
        client.query(
          `UPDATE finance_digitization_analysis_financials_receipts SET persisted_by=persisted_by WHERE organization_id=$1`,
          [orgA]
        )
      ).rejects.toMatchObject({ code: '55000' });
    } finally {
      await client.end();
    }
  });

  it('fails closed on stale CAS, collision, foreign tenant and unknown input', async () => {
    await expect(
      service.persistDigitizationAnalysisFinancialsCommand({
        organizationId: orgA,
        userId: actor,
        analysisId,
        idempotencyKey: `${prefix}-stale`,
        body,
      })
    ).rejects.toMatchObject({ code: 'DIGITIZATION_ANALYSIS_VERSION_CONFLICT', status: 409 });
    await expect(
      service.persistDigitizationAnalysisFinancialsCommand({
        organizationId: orgA,
        userId: actor,
        analysisId,
        idempotencyKey: `${prefix}-key`,
        body: { ...body, discountRate: 12 },
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_COLLISION', status: 409 });
    await expect(
      service.persistDigitizationAnalysisFinancialsCommand({
        organizationId: orgB,
        userId: actor,
        analysisId,
        idempotencyKey: `${prefix}-foreign`,
        body: { ...body, expectedVersion: 2 },
      })
    ).rejects.toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED', status: 403 });
    await expect(
      service.persistDigitizationAnalysisFinancialsCommand({
        organizationId: orgA,
        userId: actor,
        analysisId,
        idempotencyKey: `${prefix}-unknown`,
        body: { ...body, silentWrite: true },
      })
    ).rejects.toMatchObject({ code: 'INVALID_FINANCIALS', status: 400 });
  });
});
