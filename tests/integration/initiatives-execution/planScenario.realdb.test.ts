import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  mutatePlanScenario,
  type PlanScenario,
} from '../../../server/src/domain/initiatives-execution/planScenario';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { mutateCapacityScenario } from '../../../server/src/domain/initiatives-execution/capacityScenario';
const url = process.env.IE_TEST_DATABASE_URL?.trim();
const real = url ? describe : describe.skip;
real('Plan Scenario realDB', () => {
  const pool = new Pool({ connectionString: url, max: 3 });
  const uow = new PostgresMaterialCommandUnitOfWork(pool);
  const reader = new PostgresInitiativeReader(pool);
  const org = 'org-ie060',
    planId = 'plan-ie060',
    initiativeId = 'initiative-ie060';
  const base: PlanScenario = {
    scenarioId: planId,
    scenarioVersion: 0,
    status: 'DRAFT',
    portfolioScenarioId: 'portfolio-ie060',
    portfolioScenarioVersion: 1,
    windowUnit: 'WEEK',
    timezone: 'Europe/Warsaw',
    periods: [
      { periodId: '2026-Q4-A', start: '2026-09-28T00:00:00Z', end: '2026-11-02T00:00:00Z' },
    ],
    windows: [
      {
        initiativeId,
        initiativeVersion: 4,
        earliest: '2026-10-01T00:00:00Z',
        target: '2026-10-15T00:00:00Z',
        latest: '2026-10-31T00:00:00Z',
        confidence: 'LOW',
        rationale: 'Supplier constraint',
        dependencySnapshot: [],
        constraintSnapshot: [
          { constraintId: 'supplier', state: 'UNKNOWN', detail: 'Awaiting confirmation' },
        ],
      },
    ],
    assumptions: ['No capacity commitment'],
    createdBy: '',
    updatedBy: '',
    publishedBy: null,
    publishedAt: null,
  };
  const env = (version: number, id: string, operation: 'CREATE' | 'UPDATE' | 'PUBLISH') => ({
    organizationId: org,
    actorId: 'planner',
    aggregateType: 'plan_scenario',
    aggregateId: planId,
    expectedVersion: version,
    clientRequestId: id,
    correlationId: id,
    policyId: 'standard',
    policyVersion: 1,
    commandType: 'plan.scenario.mutate',
    createIfMissing: operation === 'CREATE',
    payload: { operation, scenario: base },
  });
  beforeAll(async () => {
    for (const f of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
      '935_plan_scenario_time_basis.sql',
    ])
      await pool.query(await readFile(path.resolve('server/migrations', f), 'utf8'));
  });
  beforeEach(async () => {
    for (const t of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ])
      await pool.query(`DELETE FROM ${t} WHERE organization_id=$1`, [org]);
    const portfolio = {
      scenarioId: 'portfolio-ie060',
      scenarioVersion: 1,
      status: 'PUBLISHED',
      scope: { portfolioId: 'p1', goalIds: [], asOf: '2026-08-09T20:00:00Z' },
      model: { modelId: 'm1', version: 1 },
      memberships: [{ initiativeId, initiativeVersion: 4, disposition: 'INCLUDED' }],
    };
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)VALUES($1,'portfolio_scenario','portfolio-ie060',1,$2::jsonb),($1,'initiative',$3,4,$4::jsonb)`,
      [
        org,
        JSON.stringify(portfolio),
        initiativeId,
        JSON.stringify({ initiativeId, projectId: 'p1', lifecycleState: 'APPROVED_BACKLOG' }),
      ]
    );
  });
  afterAll(async () => pool.end());
  it('versions draft moves and publishes immutably without writing Initiative dates or lifecycle', async () => {
    await mutatePlanScenario(uow, env(0, 'create', 'CREATE'));
    base.windows[0].target = '2026-10-20T00:00:00Z';
    await mutatePlanScenario(uow, env(1, 'move', 'UPDATE'));
    await mutatePlanScenario(uow, env(2, 'publish', 'PUBLISH'));
    const history = await pool.query(
      `SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='plan_scenario_version' ORDER BY aggregate_id`,
      [org]
    );
    expect(history.rows.map((r) => r.payload_json.status)).toEqual([
      'SUPERSEDED',
      'SUPERSEDED',
      'PUBLISHED',
    ]);
    const initiative = await pool.query(
      `SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2`,
      [org, initiativeId]
    );
    expect(initiative.rows[0].payload_json).toEqual({
      initiativeId,
      projectId: 'p1',
      lifecycleState: 'APPROVED_BACKLOG',
    });
    expect(
      (
        await pool.query(`SELECT count(*)::int n FROM ie_audit_events WHERE organization_id=$1`, [
          org,
        ])
      ).rows[0].n
    ).toBe(3);
    expect(await reader.listPlanScenarios(org)).toEqual([
      expect.objectContaining({
        id: planId,
        state: 'PUBLISHED',
        version: 3,
        timeBasis: {
          windowUnit: 'WEEK',
          timezone: 'Europe/Warsaw',
          periods: base.periods,
          knowledgeState: 'KNOWN',
        },
        portfolioRef: { scenarioId: 'portfolio-ie060', scenarioVersion: 1 },
      }),
    ]);
    const known = {
      knowledgeState: 'KNOWN' as const,
      low: 8,
      base: 10,
      high: 12,
      sourceRef: 'capacity-ledger',
      sourceVersion: 1,
      asOf: '2026-09-20T00:00:00Z',
      confidence: 'HIGH' as const,
      ownerId: 'resource-owner',
      reason: null,
    };
    const capacity = await mutateCapacityScenario(uow, {
      organizationId: org,
      actorId: 'resource-owner',
      aggregateType: 'capacity_scenario',
      aggregateId: 'capacity-ie060',
      expectedVersion: 0,
      clientRequestId: 'capacity-create',
      correlationId: 'capacity-create',
      policyId: 'standard',
      policyVersion: 1,
      commandType: 'capacity.scenario.mutate',
      createIfMissing: true,
      payload: {
        operation: 'CREATE',
        scenario: {
          scenarioId: 'capacity-ie060',
          scenarioVersion: 0,
          status: 'DRAFT',
          planScenarioId: planId,
          planScenarioVersion: 3,
          windowUnit: base.windowUnit,
          timezone: base.timezone,
          periods: base.periods.map((period) => ({ ...period, demand: known, supply: known })),
          constraints: [],
          proposedAssignments: [],
          createdBy: '',
          updatedBy: '',
          publishedBy: null,
          publishedAt: null,
        },
      },
    });
    expect(capacity.response).toMatchObject({
      planScenarioId: planId,
      planScenarioVersion: 3,
      windowUnit: 'WEEK',
      timezone: 'Europe/Warsaw',
    });
  });
  it('blocks publish when the referenced Portfolio version is stale', async () => {
    await mutatePlanScenario(uow, env(0, 'create-stale', 'CREATE'));
    await pool.query(
      `UPDATE ie_aggregate_state SET payload_json=jsonb_set(payload_json,'{scenarioVersion}','2') WHERE organization_id=$1 AND aggregate_type='portfolio_scenario'`,
      [org]
    );
    await expect(mutatePlanScenario(uow, env(1, 'publish-stale', 'PUBLISH'))).rejects.toThrow(
      /stale/
    );
  });
});
