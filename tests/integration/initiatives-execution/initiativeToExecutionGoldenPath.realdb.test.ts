import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  decideHandoffAcceptance,
  requestHandoffAcceptance,
} from '../../../server/src/domain/initiatives-execution/handoffAcceptance';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import {
  decideSchedule,
  requestScheduleDecision,
} from '../../../server/src/domain/initiatives-execution/scheduleDecision';

const databaseUrl = process.env.IE_TEST_DATABASE_URL?.trim();
const realDb = databaseUrl ? describe : describe.skip;

realDb('INI-002 approved Initiative to exactly-one Execution golden path', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 6 });
  const uow = new PostgresMaterialCommandUnitOfWork(pool);
  const reader = new PostgresInitiativeReader(pool);
  const organizationId = 'org-ini-002';
  const initiativeId = 'initiative-ini-002';

  const envelope = (
    actorId: string,
    expectedVersion: number,
    clientRequestId: string,
    commandType: string,
    payload: Record<string, unknown>
  ) => ({
    organizationId,
    actorId,
    aggregateType: 'initiative',
    aggregateId: initiativeId,
    expectedVersion,
    clientRequestId,
    correlationId: `correlation:${clientRequestId}`,
    policyId: 'standard',
    policyVersion: 1,
    commandType,
    payload,
  });

  const scheduleRequest = {
    decisionId: 'schedule-decision-ini-002',
    authorityId: 'schedule-authority',
    executionManagerId: 'execution-manager',
    dueAt: '2026-08-20T12:00:00Z',
    portfolioScenarioId: 'portfolio-ini-002',
    portfolioScenarioVersion: 2,
    planScenarioId: 'plan-ini-002',
    planScenarioVersion: 3,
    capacityScenarioId: 'capacity-ini-002',
    capacityScenarioVersion: 4,
    commitmentIds: ['commitment-ini-002'],
    criticalPeriodIds: ['w1'],
    criticalDependencies: [],
    handoff: {
      scope: { in: ['Line 4'], out: [] },
      selectedOptions: { selected: 'SMED' },
      success: { criteria: ['Lead time'] },
      baseline: { window: 'October' },
      openWork: [],
      raid: [],
      outcomeRefs: ['kpi:lead-time'],
      sourceVersions: { initiative: 10, portfolio: 2, plan: 3, capacity: 4 },
    },
    selfApprovalAllowed: false,
  };

  beforeAll(async () => {
    for (const migration of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
    ]) {
      await pool.query(await readFile(path.resolve('server/migrations', migration), 'utf8'));
    }
  });

  beforeEach(async () => {
    for (const table of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ]) {
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [organizationId]);
    }
    await pool.query(
      `INSERT INTO ie_aggregate_state
        (organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES
        ($1,'initiative',$2,10,$3::jsonb),
        ($1,'portfolio_scenario','portfolio-ini-002',2,$4::jsonb),
        ($1,'plan_scenario','plan-ini-002',3,$5::jsonb),
        ($1,'capacity_scenario','capacity-ini-002',4,$6::jsonb),
        ($1,'resource_commitment','commitment-ini-002',2,$7::jsonb)`,
      [
        organizationId,
        initiativeId,
        JSON.stringify({
          initiativeId,
          projectId: 'project-ini-002',
          lifecycleState: 'APPROVED_BACKLOG',
          cardRefs: { 'summary-scope': { cardVersion: 2, aggregateVersion: 10 } },
        }),
        JSON.stringify({
          scenarioId: 'portfolio-ini-002',
          scenarioVersion: 2,
          status: 'PUBLISHED',
        }),
        JSON.stringify({
          scenarioId: 'plan-ini-002',
          scenarioVersion: 3,
          status: 'PUBLISHED',
          portfolioScenarioId: 'portfolio-ini-002',
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
        }),
        JSON.stringify({
          scenarioId: 'capacity-ini-002',
          scenarioVersion: 4,
          status: 'PUBLISHED',
          planScenarioId: 'plan-ini-002',
          planScenarioVersion: 3,
          windowUnit: 'WEEK',
          timezone: 'Europe/Warsaw',
          periods: [{ periodId: 'w1', supply: { knowledgeState: 'KNOWN', base: 2 } }],
        }),
        JSON.stringify({
          commitmentId: 'commitment-ini-002',
          capacityScenarioId: 'capacity-ini-002',
          capacityScenarioVersion: 4,
          initiativeId,
          status: 'CONFIRMED',
        }),
      ]
    );
  });

  afterAll(async () => pool.end());

  it('schedules, rejects wrong authority/stale CAS, survives concurrent delivery and cold-reopens one stable Execution ID', async () => {
    await requestScheduleDecision(
      uow,
      envelope(
        'initiative-owner',
        10,
        'schedule-request',
        'initiative.schedule.request',
        scheduleRequest
      )
    );
    const scheduled = await decideSchedule(
      uow,
      envelope('schedule-authority', 11, 'schedule-approve', 'initiative.schedule.decide', {
        decisionId: scheduleRequest.decisionId,
        outcome: 'APPROVED',
        rationale: 'Approved evidence and capacity',
        conditions: [],
        selfApprovalAllowed: false,
      })
    );
    const handoffPackageId = scheduled.response.handoffPackageId!;
    expect(handoffPackageId).toBe('handoff:initiative-ini-002:v12');

    await requestHandoffAcceptance(
      uow,
      envelope('initiative-owner', 12, 'handoff-request', 'initiative.handoff.request', {
        decisionId: 'handoff-decision-ini-002',
        handoffPackageId,
        handoffPackageVersion: 1,
        executionCaseId: 'execution-ini-002',
        authorityId: 'execution-manager',
        dueAt: '2026-08-21T12:00:00Z',
        rolloutChildren: { pilot: [], waves: [] },
      })
    );

    const acceptPayload = {
      decisionId: 'handoff-decision-ini-002',
      outcome: 'ACCEPT' as const,
      gaps: [],
      blockers: [],
      rationale: 'Execution baseline accepted',
    };
    const beforeNegative = await evidenceCounts(pool, organizationId);
    await expect(
      decideHandoffAcceptance(
        uow,
        envelope('wrong-manager', 13, 'wrong-authority', 'initiative.handoff.decide', acceptPayload)
      )
    ).rejects.toThrow(/authority/i);
    await expect(
      decideHandoffAcceptance(
        uow,
        envelope('execution-manager', 12, 'stale-cas', 'initiative.handoff.decide', acceptPayload)
      )
    ).rejects.toThrow(/version conflict/i);
    expect(await evidenceCounts(pool, organizationId)).toEqual(beforeNegative);

    const concurrent = await Promise.allSettled([
      decideHandoffAcceptance(
        uow,
        envelope(
          'execution-manager',
          13,
          'handoff-accept-a',
          'initiative.handoff.decide',
          acceptPayload
        )
      ),
      decideHandoffAcceptance(
        uow,
        envelope(
          'execution-manager',
          13,
          'handoff-accept-b',
          'initiative.handoff.decide',
          acceptPayload
        )
      ),
    ]);
    expect(concurrent.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const winningRequestId =
      concurrent[0].status === 'fulfilled' ? 'handoff-accept-a' : 'handoff-accept-b';
    const replay = await decideHandoffAcceptance(
      uow,
      envelope(
        'execution-manager',
        13,
        winningRequestId,
        'initiative.handoff.decide',
        acceptPayload
      )
    );
    expect(replay.status).toBe('REPLAYED');
    expect(replay.response.executionCaseId).toBe('execution-ini-002');

    const coldPool = new Pool({ connectionString: databaseUrl, max: 1 });
    try {
      const coldReader = new PostgresInitiativeReader(coldPool);
      await expect(
        coldReader.findExecutionCaseByInitiative(organizationId, initiativeId)
      ).resolves.toEqual(
        expect.objectContaining({
          executionCaseId: 'execution-ini-002',
          detail: expect.objectContaining({ state: 'ACTIVE', initiativeId }),
        })
      );
      await expect(
        coldReader.findExecutionCaseByInitiative('foreign-organization', initiativeId)
      ).resolves.toBeNull();
    } finally {
      await coldPool.end();
    }

    expect(await reader.listExecutionCases(organizationId)).toEqual([
      expect.objectContaining({ executionCaseId: 'execution-ini-002', initiativeId }),
    ]);
    expect(await evidenceCounts(pool, organizationId)).toEqual({
      receipts: 4,
      audits: 4,
      outbox: 4,
      executionCases: 1,
      executionRelations: 1,
    });
  });
});

async function evidenceCounts(pool: Pool, organizationId: string) {
  const result = await pool.query<{
    receipts: number;
    audits: number;
    outbox: number;
    execution_cases: number;
    execution_relations: number;
  }>(
    `SELECT
      (SELECT count(*)::int FROM ie_command_receipts WHERE organization_id=$1) receipts,
      (SELECT count(*)::int FROM ie_audit_events WHERE organization_id=$1) audits,
      (SELECT count(*)::int FROM ie_outbox_events WHERE organization_id=$1) outbox,
      (SELECT count(*)::int FROM ie_aggregate_state
        WHERE organization_id=$1 AND aggregate_type='execution_case') execution_cases,
      (SELECT count(*)::int FROM ie_aggregate_relations
        WHERE organization_id=$1 AND relation_type='INITIATIVE_EXECUTION_CASE') execution_relations`,
    [organizationId]
  );
  return {
    receipts: result.rows[0].receipts,
    audits: result.rows[0].audits,
    outbox: result.rows[0].outbox,
    executionCases: result.rows[0].execution_cases,
    executionRelations: result.rows[0].execution_relations,
  };
}
