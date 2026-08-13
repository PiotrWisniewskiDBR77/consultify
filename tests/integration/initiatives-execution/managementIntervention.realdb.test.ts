import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createExecutionTask } from '../../../server/src/domain/initiatives-execution/executionWork';
import {
  draftInterventionCase,
  ingestManagementSignal,
  managementSignalFingerprint,
  transitionInterventionCase,
} from '../../../server/src/domain/initiatives-execution/managementIntervention';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
const url = process.env.IE_TEST_DATABASE_URL?.trim(),
  real = url ? describe : describe.skip;
real('Management Intervention realDB', () => {
  const pool = new Pool({ connectionString: url, max: 2 }),
    uow = new PostgresMaterialCommandUnitOfWork(pool),
    reader = new PostgresInitiativeReader(pool);
  const org = 'org-ie074',
    caseId = 'case-ie074',
    initiativeId = 'initiative-ie074',
    interventionId = 'intervention-1';
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
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES
       ($1,'execution_case',$2,1,$3::jsonb),
       ($1,'execution_case','risk-1',1,$4::jsonb),
       ($1,'execution_case','milestone-1',1,$5::jsonb)`,
      [
        org,
        caseId,
        JSON.stringify({ executionCaseId: caseId, initiativeId, state: 'ACTIVE' }),
        JSON.stringify({ executionCaseId: 'risk-1', projectId: 'operations-transformation-2027' }),
        JSON.stringify({
          executionCaseId: 'milestone-1',
          projectId: 'operations-transformation-2027',
        }),
      ]
    );
  });
  afterAll(async () => pool.end());
  const env = (
    type: string,
    id: string,
    actor: string,
    version: number,
    key: string,
    commandType: string,
    payload: any,
    create = false
  ) => ({
    organizationId: org,
    actorId: actor,
    aggregateType: type,
    aggregateId: id,
    expectedVersion: version,
    clientRequestId: key,
    correlationId: key,
    policyId: 'management-control',
    policyVersion: 1,
    commandType,
    createIfMissing: create,
    payload,
  });
  it('merges two signals into one case, replays without duplicates, observes canonical action receipt and keeps ineffective case open/escalated', async () => {
    const signals = [] as any[];
    for (const [rule, source] of [
      ['risk-critical', 'risk-1'],
      ['delay-critical', 'milestone-1'],
    ]) {
      const id = managementSignalFingerprint({
        ruleId: rule,
        sourceType: 'execution_case',
        sourceId: source,
      });
      const payload = {
        ruleId: rule,
        sourceType: 'execution_case',
        sourceId: source,
        sourceVersions: { case: 1 },
        severity: 'CRITICAL' as const,
        occurredAt: '2026-08-10T10:00:00.000Z',
        evidenceRef: `evidence:${source}`,
      };
      const applied = await ingestManagementSignal(
        uow,
        env(
          'management_signal',
          id,
          'producer',
          0,
          `signal-${source}`,
          'management-signal.ingest',
          payload,
          true
        )
      );
      const replay = await ingestManagementSignal(
        uow,
        env(
          'management_signal',
          id,
          'producer',
          0,
          `signal-${source}`,
          'management-signal.ingest',
          payload,
          true
        )
      );
      expect(replay.status).toBe('REPLAYED');
      signals.push({ signalId: id, signalVersion: applied.aggregateVersion, fingerprint: id });
    }
    const draft = {
      signalRefs: signals,
      ownerId: 'owner',
      authorityId: 'authority',
      slaAt: '2026-08-12T10:00:00.000Z',
      hypotheses: ['Capacity conflict'],
      evidenceRefs: ['e:1'],
      counterEvidenceRefs: ['e:counter'],
      unknowns: ['Supplier response'],
      blastRadiusRefs: [{ ref: 'case:1', version: 1 }],
      options: [
        {
          optionId: 'none',
          kind: 'DO_NOTHING' as const,
          label: 'Do nothing',
          impacts: [{ targetRef: 'case:1', effect: 'Delay may grow' }],
          confidence: 'MEDIUM' as const,
          reversibility: 'REVERSIBLE' as const,
        },
        {
          optionId: 'act',
          kind: 'ACTION' as const,
          label: 'Create recovery task',
          impacts: [{ targetRef: 'case:1', effect: 'Owner mobilized' }],
          confidence: 'HIGH' as const,
          reversibility: 'REVERSIBLE' as const,
        },
      ],
    };
    await draftInterventionCase(
      uow,
      env(
        'intervention_case',
        interventionId,
        'owner',
        0,
        'draft',
        'intervention.draft',
        draft,
        true
      )
    );
    expect(
      (
        await draftInterventionCase(
          uow,
          env(
            'intervention_case',
            interventionId,
            'owner',
            0,
            'draft',
            'intervention.draft',
            draft,
            true
          )
        )
      ).status
    ).toBe('REPLAYED');
    const action = (actor: string, v: number, key: string, payload: any) =>
      transitionInterventionCase(
        uow,
        env('intervention_case', interventionId, actor, v, key, 'intervention.transition', payload)
      );
    await action('owner', 1, 'request', { action: 'REQUEST' });
    await action('authority', 2, 'decide', {
      action: 'DECIDE',
      outcome: 'APPROVED',
      selectedOptionId: 'act',
      rationale: 'Best reversible response',
    });
    await createExecutionTask(
      uow,
      env(
        'execution_task',
        'recovery-task',
        'owner',
        0,
        'canonical-action',
        'execution.task.create',
        {
          expectedCaseVersion: 1,
          executionCaseId: caseId,
          initiativeId,
          title: 'Recovery',
          description: 'Canonical intervention action',
          assigneeId: 'worker',
          ownerId: 'owner',
          dueAt: '2026-08-15T12:00:00.000Z',
          slaAt: '2026-08-14T12:00:00.000Z',
          evidenceRefs: [],
          blockerDecisionIds: [],
          dependencyTaskIds: [],
        },
        true
      )
    );
    await action('owner', 3, 'apply', {
      action: 'APPLY',
      targetReceiptClientRequestId: 'canonical-action',
      targetAggregateType: 'execution_task',
      targetAggregateId: 'recovery-task',
      expectedTargetVersion: 1,
      expectedTargetState: 'OPEN',
      verifyBy: '2026-08-20T10:00:00.000Z',
      expectedEffect: 'Delay risk reduced',
      measurementSource: { ref: 'schedule:case-1', version: 2 },
    });
    await action('reviewer', 4, 'verify', {
      action: 'VERIFY',
      outcome: 'INEFFECTIVE',
      evidenceRefs: ['measure:1'],
    });
    const cases = await reader.listInterventionCases(org);
    expect(cases).toEqual([
      expect.objectContaining({
        interventionId,
        status: 'ESCALATED',
        signalRefs: expect.arrayContaining(signals),
        targetCommand: expect.objectContaining({ clientRequestId: 'canonical-action' }),
        verification: expect.objectContaining({ outcome: 'INEFFECTIVE' }),
      }),
    ]);
    expect(await reader.listInterventionCases('foreign')).toEqual([]);
    expect(await reader.listManagementSignals(org)).toHaveLength(2);
    const evidence = await pool.query(
      `SELECT (SELECT count(*)::int FROM ie_command_receipts WHERE organization_id=$1) receipts,(SELECT count(*)::int FROM ie_audit_events WHERE organization_id=$1) audits,(SELECT count(*)::int FROM ie_outbox_events WHERE organization_id=$1) outbox,(SELECT count(*)::int FROM ie_aggregate_relations WHERE organization_id=$1 AND target_id=$2) relations`,
      [org, interventionId]
    );
    expect(evidence.rows[0]).toMatchObject({ receipts: 8, audits: 8, outbox: 8, relations: 2 });
  });

  it('resolves a Capacity Scenario signal through exact Plan and Portfolio project lineage', async () => {
    await pool.query(
      `INSERT INTO ie_aggregate_state
         (organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES
         ($1,'portfolio_scenario','portfolio-capacity-lineage',2,$2::jsonb),
         ($1,'plan_scenario','plan-capacity-lineage',2,$3::jsonb),
         ($1,'capacity_scenario','capacity-lineage',2,$4::jsonb)`,
      [
        org,
        JSON.stringify({
          scenarioId: 'portfolio-capacity-lineage',
          scope: { portfolioId: 'operations-transformation-2027' },
        }),
        JSON.stringify({
          scenarioId: 'plan-capacity-lineage',
          portfolioScenarioId: 'portfolio-capacity-lineage',
          status: 'PUBLISHED',
          windowUnit: 'MONTH',
          timezone: 'Europe/Warsaw',
          periods: [
            {
              periodId: '2026-P10',
              start: '2026-10-01T00:00:00.000Z',
              end: '2026-11-01T00:00:00.000Z',
            },
          ],
        }),
        JSON.stringify({
          scenarioId: 'capacity-lineage',
          planScenarioId: 'plan-capacity-lineage',
        }),
      ]
    );
    const signalId = managementSignalFingerprint({
      ruleId: 'CAPACITY_CONFLICT',
      sourceType: 'capacity_scenario',
      sourceId: 'capacity-lineage',
    });
    const result = await ingestManagementSignal(
      uow,
      env(
        'management_signal',
        signalId,
        'producer',
        0,
        'capacity-lineage-signal',
        'management-signal.ingest',
        {
          ruleId: 'CAPACITY_CONFLICT',
          sourceType: 'capacity_scenario',
          sourceId: 'capacity-lineage',
          sourceVersions: { capacityScenarioVersion: 2 },
          severity: 'CRITICAL',
          occurredAt: '2026-08-10T12:00:00.000Z',
          evidenceRef: 'capacity:conflict:v2',
        },
        true
      )
    );
    expect(result.response).toMatchObject({
      signalId,
      projectId: 'operations-transformation-2027',
      sourceId: 'capacity-lineage',
    });
  });
});
