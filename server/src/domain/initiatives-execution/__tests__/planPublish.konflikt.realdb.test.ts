/** @vitest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import { MaterialCommandValidationError } from '../materialCommand.js';
import { PostgresMaterialCommandUnitOfWork } from '../postgresMaterialCommandUnitOfWork.js';
import { mutatePlanScenario, type PlanScenario } from '../planScenario.js';

const NO_RETRY = { retry: 0 } as const;

describe('plan publication conflict confirmation — real PostgreSQL', NO_RETRY, () => {
  const organizationId = randomUUID();
  const actorId = randomUUID();
  const portfolioId = `portfolio-${randomUUID()}`;
  const planId = `plan-${randomUUID()}`;
  const initiativeId = `initiative-${randomUUID()}`;
  let pool: Pool;
  let draft: PlanScenario;

  const command = (
    expectedVersion: number,
    operation: 'CREATE' | 'PUBLISH',
    publishConfirmation?: { conflictCount: number; statement: string }
  ) => ({
    organizationId,
    actorId,
    aggregateType: 'plan_scenario',
    aggregateId: planId,
    expectedVersion,
    clientRequestId: randomUUID(),
    correlationId: randomUUID(),
    policyId: 'p11-publish-realpg',
    policyVersion: 1,
    commandType: 'plan.scenario.mutate',
    createIfMissing: operation === 'CREATE',
    payload: { operation, scenario: draft, publishConfirmation },
  });

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: String(process.env.DATABASE_URL) });
    draft = {
      scenarioId: planId,
      name: 'Plan z konfliktem',
      scenarioVersion: 0,
      status: 'DRAFT',
      portfolioScenarioId: portfolioId,
      portfolioScenarioVersion: 1,
      windowUnit: 'WEEK',
      timezone: 'Europe/Warsaw',
      periods: [
        { periodId: 'T1', start: '2026-09-07T00:00:00.000Z', end: '2026-09-14T00:00:00.000Z' },
      ],
      windows: [
        {
          initiativeId,
          initiativeVersion: 1,
          earliest: null,
          target: null,
          latest: null,
          confidence: 'LOW',
          rationale: 'Fixture conflict',
          dependencySnapshot: ['missing-dependency'],
          constraintSnapshot: [],
        },
      ],
      assumptions: [],
      createdBy: '',
      updatedBy: '',
      publishedBy: null,
      publishedAt: null,
    };
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [
      organizationId,
      'P11 publish fixture',
    ]);
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES
       ($1,'portfolio_scenario',$2,1,$3::jsonb),($1,'initiative',$4,1,$5::jsonb)`,
      [
        organizationId,
        portfolioId,
        JSON.stringify({
          scenarioId: portfolioId,
          scenarioVersion: 1,
          status: 'PUBLISHED',
          scope: { portfolioId: 'p11-fixture', goalIds: [], asOf: '2026-09-06T00:00:00.000Z' },
          model: { modelId: 'fixture', version: 1 },
          memberships: [
            {
              initiativeId,
              initiativeVersion: 1,
              disposition: 'INCLUDED',
              scoreDecomposition: {},
              rank: 1,
              rankOverride: null,
              coverage: { state: 'UNKNOWN', value: null, reason: 'fixture' },
              overlap: { state: 'UNKNOWN', value: null, reason: 'fixture' },
              roughDemand: { state: 'UNKNOWN', value: null, reason: 'fixture' },
              confidence: 'LOW',
              rationale: 'fixture',
            },
          ],
          decompositionKeys: [],
          createdBy: actorId,
          updatedBy: actorId,
          publishedBy: actorId,
          publishedAt: '2026-09-06T00:00:00.000Z',
          previousPublishedVersion: null,
        }),
        initiativeId,
        JSON.stringify({ initiativeId, lifecycleState: 'APPROVED_BACKLOG' }),
      ]
    );
    const created = await mutatePlanScenario(
      new PostgresMaterialCommandUnitOfWork(pool),
      command(0, 'CREATE')
    );
    draft = created.response;
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

  it('rejects without explicit confirmation and persists who, when and N after exact confirmation', async () => {
    const uow = new PostgresMaterialCommandUnitOfWork(pool);
    await expect(mutatePlanScenario(uow, command(1, 'PUBLISH'))).rejects.toBeInstanceOf(
      MaterialCommandValidationError
    );
    const unchanged = await pool.query(
      `SELECT version,payload_json->>'status' status FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='plan_scenario' AND aggregate_id=$2`,
      [organizationId, planId]
    );
    expect(unchanged.rows[0]).toMatchObject({ version: 1, status: 'DRAFT' });
    const published = await mutatePlanScenario(
      uow,
      command(1, 'PUBLISH', { conflictCount: 1, statement: 'Publikuję mimo 1 konfliktów' })
    );
    expect(published.response.conflictPublicationConfirmation).toMatchObject({
      confirmedBy: actorId,
      conflictCount: 1,
      statement: 'Publikuję mimo 1 konfliktów',
    });
    expect(
      Date.parse(published.response.conflictPublicationConfirmation?.confirmedAt ?? '')
    ).not.toBeNaN();
    const audit = await pool.query(
      `SELECT payload_json FROM ie_audit_events WHERE organization_id=$1 AND aggregate_type='plan_scenario' AND aggregate_id=$2 AND aggregate_version=2`,
      [organizationId, planId]
    );
    expect(audit.rows[0].payload_json.conflictPublicationConfirmation).toMatchObject({
      confirmedBy: actorId,
      conflictCount: 1,
    });
  });
});
