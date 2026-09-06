/** @vitest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import { PostgresMaterialCommandUnitOfWork } from '../postgresMaterialCommandUnitOfWork.js';
import { mutatePlanScenario, type PlanScenario } from '../planScenario.js';

const NO_RETRY = { retry: 0 } as const;

describe('planScenario name — real PostgreSQL', NO_RETRY, () => {
  const organizationId = randomUUID();
  const actorId = randomUUID();
  const portfolioId = `portfolio-${randomUUID()}`;
  const namedPlanId = `plan-${randomUUID()}`;
  const legacyPlanId = `plan-${randomUUID()}`;
  let pool: Pool;

  const scenario = (scenarioId: string, name?: string): PlanScenario => ({
    scenarioId,
    ...(name ? { name } : {}),
    scenarioVersion: 0,
    status: 'DRAFT',
    portfolioScenarioId: portfolioId,
    portfolioScenarioVersion: 1,
    windowUnit: 'WEEK',
    timezone: 'Europe/Warsaw',
    periods: [
      { periodId: 'T1', start: '2026-09-07T00:00:00.000Z', end: '2026-09-14T00:00:00.000Z' },
    ],
    windows: [],
    assumptions: [],
    createdBy: '',
    updatedBy: '',
    publishedBy: null,
    publishedAt: null,
  });

  const create = (scenarioId: string, name?: string) =>
    mutatePlanScenario(new PostgresMaterialCommandUnitOfWork(pool), {
      organizationId,
      actorId,
      aggregateType: 'plan_scenario',
      aggregateId: scenarioId,
      expectedVersion: 0,
      clientRequestId: randomUUID(),
      correlationId: randomUUID(),
      policyId: 'p11-name-realpg',
      policyVersion: 1,
      commandType: 'plan.scenario.mutate',
      createIfMissing: true,
      payload: { operation: 'CREATE', scenario: scenario(scenarioId, name) },
    });

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: String(process.env.DATABASE_URL) });
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [
      organizationId,
      'P11 name fixture',
    ]);
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES($1,'portfolio_scenario',$2,1,$3::jsonb)`,
      [
        organizationId,
        portfolioId,
        JSON.stringify({
          scenarioId: portfolioId,
          scenarioVersion: 1,
          status: 'PUBLISHED',
          scope: { portfolioId: 'p11-fixture', goalIds: [], asOf: '2026-09-06T00:00:00.000Z' },
          model: { modelId: 'fixture', version: 1 },
          memberships: [],
          decompositionKeys: [],
          createdBy: actorId,
          updatedBy: actorId,
          publishedBy: actorId,
          publishedAt: '2026-09-06T00:00:00.000Z',
          previousPublishedVersion: null,
        }),
      ]
    );
  });

  afterAll(async () => {
    if (!pool) return;
    for (const table of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ])
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [organizationId]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
    await pool.end();
  });

  it('persists and reads name while an aggregate without name remains compatible', async () => {
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES($1,'plan_scenario',$2,1,$3::jsonb)`,
      [
        organizationId,
        legacyPlanId,
        JSON.stringify({
          ...scenario(legacyPlanId),
          scenarioVersion: 1,
          createdBy: actorId,
          updatedBy: actorId,
        }),
      ]
    );
    await create(namedPlanId, 'Plan transformacji DBR77');
    const rows = await pool.query<{ aggregate_id: string; payload_json: PlanScenario }>(
      `SELECT aggregate_id,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='plan_scenario' ORDER BY aggregate_id`,
      [organizationId]
    );
    const named = rows.rows.find((row) => row.aggregate_id === namedPlanId)?.payload_json;
    const legacy = rows.rows.find((row) => row.aggregate_id === legacyPlanId)?.payload_json;
    expect(named?.name).toBe('Plan transformacji DBR77');
    expect(legacy).toBeDefined();
    expect(Object.prototype.hasOwnProperty.call(legacy, 'name')).toBe(false);
    expect({ ...named, scenarioId: 'same', name: undefined }).toMatchObject({
      ...legacy,
      scenarioId: 'same',
    });
  });
});
