import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupInitiativesExecutionOrg } from '../../support/initiativesExecutionOrgCleanup';
import {
  decideSchedule,
  requestScheduleDecision,
} from '../../../server/src/domain/initiatives-execution/scheduleDecision';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
const url = process.env.IE_TEST_DATABASE_URL?.trim();
const real = url ? describe : describe.skip;
real('Schedule Decision and Handoff Package realDB', () => {
  const pool = new Pool({ connectionString: url, max: 3 }),
    uow = new PostgresMaterialCommandUnitOfWork(pool),
    reader = new PostgresInitiativeReader(pool);
  const org = 'org-ie062',
    initiativeId = 'initiative-ie062';
  const handoff = {
    scope: { in: ['Line 4'], out: ['Line 5'] },
    selectedOptions: { selected: 'SMED' },
    success: { criteria: ['Lead time'] },
    baseline: { window: 'October' },
    openWork: [{ id: 'condition-1' }],
    raid: [{ id: 'risk-1' }],
    outcomeRefs: ['kpi:lead-time'],
    sourceVersions: { initiative: 10, portfolio: 2, plan: 3, capacity: 4 },
  };
  const requestPayload = {
    decisionId: 'schedule-decision-1',
    authorityId: 'schedule-authority',
    executionManagerId: 'execution-manager',
    dueAt: '2026-08-20T12:00:00Z',
    portfolioScenarioId: 'portfolio-ie062',
    portfolioScenarioVersion: 2,
    planScenarioId: 'plan-ie062',
    planScenarioVersion: 3,
    capacityScenarioId: 'capacity-ie062',
    capacityScenarioVersion: 4,
    commitmentIds: ['commitment-ie062'],
    criticalPeriodIds: ['w1'],
    criticalDependencies: [{ dependencyId: 'dep-1', state: 'RESOLVED' as const, critical: true }],
    handoff,
    selfApprovalAllowed: false,
  };
  const env = (actor: string, version: number, key: string, type: string, payload: any) => ({
    organizationId: org,
    actorId: actor,
    aggregateType: 'initiative',
    aggregateId: initiativeId,
    expectedVersion: version,
    clientRequestId: key,
    correlationId: key,
    policyId: 'standard',
    policyVersion: 1,
    commandType: type,
    payload,
  });
  beforeAll(async () => {
    for (const f of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
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
    const portfolio = { scenarioId: 'portfolio-ie062', scenarioVersion: 2, status: 'PUBLISHED' };
    const plan = {
      scenarioId: 'plan-ie062',
      scenarioVersion: 3,
      status: 'PUBLISHED',
      portfolioScenarioId: 'portfolio-ie062',
      portfolioScenarioVersion: 2,
      windowUnit: 'WEEK',
      timezone: 'Europe/Warsaw',
      windows: [
        {
          initiativeId,
          initiativeVersion: 10,
          earliest: '2026-10-01T00:00:00Z',
          target: '2026-10-15T00:00:00Z',
          latest: '2026-10-31T00:00:00Z',
        },
      ],
    };
    const capacity = {
      scenarioId: 'capacity-ie062',
      scenarioVersion: 4,
      status: 'PUBLISHED',
      planScenarioId: 'plan-ie062',
      planScenarioVersion: 3,
      windowUnit: 'WEEK',
      timezone: 'Europe/Warsaw',
      periods: [{ periodId: 'w1', supply: { knowledgeState: 'KNOWN', base: 2 } }],
    };
    const commitment = {
      commitmentId: 'commitment-ie062',
      capacityScenarioId: 'capacity-ie062',
      capacityScenarioVersion: 4,
      initiativeId,
      status: 'CONFIRMED',
    };
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)VALUES($1,'initiative',$2,10,$3::jsonb),($1,'portfolio_scenario','portfolio-ie062',2,$4::jsonb),($1,'plan_scenario','plan-ie062',3,$5::jsonb),($1,'capacity_scenario','capacity-ie062',4,$6::jsonb),($1,'resource_commitment','commitment-ie062',2,$7::jsonb)`,
      [
        org,
        initiativeId,
        JSON.stringify({
          initiativeId,
          projectId: 'p1',
          lifecycleState: 'APPROVED_BACKLOG',
          cardRefs: {
            'summary-scope': { cardVersion: 2, aggregateVersion: 10 },
            options: { cardVersion: 3, aggregateVersion: 10 },
          },
        }),
        JSON.stringify(portfolio),
        JSON.stringify(plan),
        JSON.stringify(capacity),
        JSON.stringify(commitment),
      ]
    );
  });
  afterAll(async () => {
    await cleanupInitiativesExecutionOrg(pool, org);
    await pool.end();
  });
  it('replays request, rejects self approval and stale sources, then atomically schedules with immutable handoff', async () => {
    const first = await requestScheduleDecision(
      uow,
      env('owner', 10, 'request', 'initiative.schedule.request', requestPayload)
    );
    const replay = await requestScheduleDecision(
      uow,
      env('owner', 10, 'request', 'initiative.schedule.request', requestPayload)
    );
    expect(replay.status).toBe('REPLAYED');
    expect(first.response.cardVersions).toEqual({ 'summary-scope': 2, options: 3 });
    await expect(
      decideSchedule(
        uow,
        env('owner', 11, 'self', 'initiative.schedule.decide', {
          decisionId: 'schedule-decision-1',
          outcome: 'APPROVED',
          rationale: 'self',
          conditions: [],
          selfApprovalAllowed: false,
        })
      )
    ).rejects.toThrow();
    await pool.query(
      `UPDATE ie_aggregate_state SET payload_json=jsonb_set(payload_json,'{scenarioVersion}','5') WHERE organization_id=$1 AND aggregate_type='capacity_scenario'`,
      [org]
    );
    await expect(
      decideSchedule(
        uow,
        env('schedule-authority', 11, 'stale', 'initiative.schedule.decide', {
          decisionId: 'schedule-decision-1',
          outcome: 'APPROVED',
          rationale: 'approve',
          conditions: [],
          selfApprovalAllowed: false,
        })
      )
    ).rejects.toThrow(/stale|mismatched/);
    await pool.query(
      `UPDATE ie_aggregate_state SET payload_json=jsonb_set(payload_json,'{scenarioVersion}','4') WHERE organization_id=$1 AND aggregate_type='capacity_scenario'`,
      [org]
    );
    const approved = await decideSchedule(
      uow,
      env('schedule-authority', 11, 'approve', 'initiative.schedule.decide', {
        decisionId: 'schedule-decision-1',
        outcome: 'APPROVED',
        rationale: 'All critical evidence accepted',
        conditions: [],
        selfApprovalAllowed: false,
      })
    );
    expect(approved.response.handoffPackageId).toBe('handoff:initiative-ie062:v12');
    const initiative = await pool.query(
      `SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative'`,
      [org]
    );
    expect(initiative.rows[0].payload_json.lifecycleState).toBe('SCHEDULED');
    expect(await reader.findHandoffPackage(org, 'handoff:initiative-ie062:v12')).toEqual(
      expect.objectContaining({ version: 1, initiativeId })
    );
    expect(
      (
        await pool.query(
          `SELECT count(*)::int n FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='execution_case'`,
          [org]
        )
      ).rows[0].n
    ).toBe(0);
  });
});
