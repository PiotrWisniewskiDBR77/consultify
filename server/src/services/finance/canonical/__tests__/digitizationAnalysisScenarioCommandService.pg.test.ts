import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const DATABASE_URL = process.env.DATABASE_URL ?? '';
const runRealDb =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  DATABASE_URL.startsWith('postgres');
const describeRealDb = runRealDb ? describe : describe.skip;
const prefix = `fin-da-scenario-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`,
  orgB = `${prefix}-org-b`,
  actor = `${prefix}-actor`,
  analysisId = `${prefix}-analysis`;
async function db() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  return client;
}
let service: typeof import('../digitizationAnalysisScenarioCommandService.js');

beforeAll(async () => {
  if (!runRealDb) return;
  const name = new URL(DATABASE_URL).pathname.slice(1);
  if (
    process.env.FIN_DA_SCENARIO_ALLOW_CLEANUP !== '1' ||
    !name.startsWith(process.env.FIN_DA_SCENARIO_DB_PREFIX || 'never-match')
  )
    throw new Error('Scenario command proof requires an explicitly guarded disposable DB');
  const client = await db();
  try {
    await client.query(
      `INSERT INTO organizations(id,name) VALUES($1,'Scenario A'),($2,'Scenario B')`,
      [orgA, orgB]
    );
    await client.query(
      `INSERT INTO users(id,organization_id,email,first_name,last_name,role) VALUES($1,$2,$3,'Scenario','Owner','ADMIN')`,
      [actor, orgA, `${actor}@test.local`]
    );
    await client.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status,created_at) VALUES($1,$2,$3,'OWNER','ACTIVE',now())`,
      [randomUUID(), orgA, actor]
    );
    await client.query(
      `INSERT INTO digitization_analyses(id,name,status,organization_id,created_by,created_at,updated_at) VALUES($1,'Scenarios','draft',$2,$3,now(),now())`,
      [analysisId, orgA, actor]
    );
  } finally {
    await client.end();
  }
  service = await import('../digitizationAnalysisScenarioCommandService.js');
});

afterAll(async () => {
  if (!runRealDb) return;
  const client = await db();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL session_replication_role=replica`);
    await client.query(
      `DELETE FROM finance_digitization_analysis_scenario_command_receipts WHERE organization_id=ANY($1::text[])`,
      [[orgA, orgB]]
    );
    await client.query(
      `DELETE FROM analysis_financial_scenarios WHERE organization_id=ANY($1::text[])`,
      [[orgA, orgB]]
    );
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
      `SELECT ((SELECT count(*) FROM finance_digitization_analysis_scenario_command_receipts WHERE organization_id=ANY($1::text[]))+(SELECT count(*) FROM analysis_financial_scenarios WHERE organization_id=ANY($1::text[]))+(SELECT count(*) FROM digitization_analyses WHERE organization_id=ANY($1::text[]))+(SELECT count(*) FROM organizations WHERE id=ANY($1::text[])))::text residue,(SELECT count(*)::text FROM pg_trigger WHERE NOT tgisinternal AND tgenabled <> 'O') disabled,(SELECT count(*)::text FROM pg_locks WHERE locktype='advisory') locks`,
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

describeRealDb('ECO-W05/W06 canonical scenario commands (real PostgreSQL)', () => {
  it('upserts deterministically and activates exactly one scenario under retries', async () => {
    const optimisticInput = {
      organizationId: orgA,
      userId: actor,
      analysisId,
      idempotencyKey: `${prefix}-upsert-opt`,
      expectedVersion: 1,
      scenarioType: 'optimistic',
      name: 'Growth',
      financialData: { initialInvestment: 100, annualCostSavings: 50 },
    };
    const optimistic = await Promise.all(
      Array.from({ length: 6 }, () => service.upsertDigitizationAnalysisScenario(optimisticInput))
    );
    expect(new Set(optimistic.map((result) => result.scenarioId))).toHaveLength(1);
    expect(optimistic.filter((result) => !result.replay)).toHaveLength(1);
    const conservative = await service.upsertDigitizationAnalysisScenario({
      organizationId: orgA,
      userId: actor,
      analysisId,
      idempotencyKey: `${prefix}-upsert-con`,
      expectedVersion: 2,
      scenarioType: 'conservative',
      financialData: { initialInvestment: 100, annualCostSavings: 20 },
    });
    const activateInput = {
      organizationId: orgA,
      userId: actor,
      analysisId,
      scenarioId: optimistic[0].scenarioId,
      idempotencyKey: `${prefix}-activate`,
      expectedVersion: 3,
    };
    const activated = await Promise.all(
      Array.from({ length: 6 }, () => service.activateDigitizationAnalysisScenario(activateInput))
    );
    expect(new Set(activated.map((result) => result.receiptId))).toHaveLength(1);
    expect(activated.filter((result) => !result.replay)).toHaveLength(1);
    const client = await db();
    try {
      expect(
        (
          await client.query(
            `SELECT id,scenario_type,is_active FROM analysis_financial_scenarios WHERE analysis_id=$1 ORDER BY scenario_type`,
            [analysisId]
          )
        ).rows
      ).toEqual([
        { id: conservative.scenarioId, scenario_type: 'conservative', is_active: false },
        { id: optimistic[0].scenarioId, scenario_type: 'optimistic', is_active: true },
      ]);
      expect(
        (
          await client.query(`SELECT command_version FROM digitization_analyses WHERE id=$1`, [
            analysisId,
          ])
        ).rows[0].command_version
      ).toBe(4);
      await expect(
        client.query(
          `UPDATE finance_digitization_analysis_scenario_command_receipts SET commanded_by=commanded_by WHERE organization_id=$1`,
          [orgA]
        )
      ).rejects.toMatchObject({ code: '55000' });
    } finally {
      await client.end();
    }
  });

  it('fails closed on stale CAS, collision, missing target and foreign tenant', async () => {
    await expect(
      service.upsertDigitizationAnalysisScenario({
        organizationId: orgA,
        userId: actor,
        analysisId,
        idempotencyKey: `${prefix}-stale`,
        expectedVersion: 1,
        scenarioType: 'base',
        financialData: {},
      })
    ).rejects.toMatchObject({ code: 'DIGITIZATION_ANALYSIS_VERSION_CONFLICT', status: 409 });
    await expect(
      service.upsertDigitizationAnalysisScenario({
        organizationId: orgA,
        userId: actor,
        analysisId,
        idempotencyKey: `${prefix}-upsert-opt`,
        expectedVersion: 1,
        scenarioType: 'optimistic',
        name: 'Collision',
        financialData: {},
      })
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_PAYLOAD_COLLISION', status: 409 });
    await expect(
      service.activateDigitizationAnalysisScenario({
        organizationId: orgA,
        userId: actor,
        analysisId,
        scenarioId: `${prefix}-missing`,
        idempotencyKey: `${prefix}-missing`,
        expectedVersion: 4,
      })
    ).rejects.toMatchObject({ code: 'SCENARIO_NOT_FOUND', status: 404 });
    await expect(
      service.activateDigitizationAnalysisScenario({
        organizationId: orgB,
        userId: actor,
        analysisId,
        scenarioId: `${prefix}-missing`,
        idempotencyKey: `${prefix}-foreign`,
        expectedVersion: 4,
      })
    ).rejects.toMatchObject({ code: 'ORG_MEMBERSHIP_REVOKED', status: 403 });
  });
});
