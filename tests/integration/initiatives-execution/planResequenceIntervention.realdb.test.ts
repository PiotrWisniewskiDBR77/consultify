import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupInitiativesExecutionOrg } from '../../support/initiativesExecutionOrgCleanup';
import {
  createCapacityOptions,
  selectCapacityOption,
} from '../../../server/src/domain/initiatives-execution/capacityOptions';
import {
  createMaterialChange,
  materialSnapshotHash,
  transitionMaterialChange,
} from '../../../server/src/domain/initiatives-execution/materialChange';
import {
  draftInterventionCase,
  ingestManagementSignal,
  managementSignalFingerprint,
  transitionInterventionCase,
} from '../../../server/src/domain/initiatives-execution/managementIntervention';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';

const url = process.env.IE_TEST_DATABASE_URL?.trim(),
  real = url ? describe : describe.skip;
real('ACO-43 governed Plan resequence Intervention realDB', () => {
  const pool = new Pool({ connectionString: url, max: 1 }),
    uow = new PostgresMaterialCommandUnitOfWork(pool),
    reader = new PostgresInitiativeReader(pool);
  const org = 'org-aco43',
    planId = 'plan-aco43',
    capacityId = 'capacity-aco43',
    comparisonId = 'options-aco43';
  const oldPlan = {
    scenarioId: planId,
    portfolioScenarioId: 'portfolio-aco43',
    scenarioVersion: 1,
    status: 'PUBLISHED',
    windowUnit: 'WEEK',
    timezone: 'Europe/Warsaw',
    periods: [{ periodId: '2026-W33', start: '2026-08-10', end: '2026-08-16' }],
    memberships: [
      { initiativeId: 'initiative-a', order: 1 },
      { initiativeId: 'initiative-b', order: 2 },
    ],
  };
  const newPlan = {
    ...oldPlan,
    memberships: [
      { initiativeId: 'initiative-b', order: 1 },
      { initiativeId: 'initiative-a', order: 2 },
    ],
  };
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
    policyId: type,
    policyVersion: 1,
    commandType,
    createIfMissing: create,
    payload,
  });
  beforeAll(async () => {
    for (const file of [
      '932_initiatives_execution_material_commands.sql',
      '933_initiative_card_versions.sql',
    ])
      await pool.query(await readFile(path.resolve('server/migrations', file), 'utf8'));
  });
  beforeEach(async () => {
    for (const table of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ])
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [org]);
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES
      ($1,'portfolio_scenario','portfolio-aco43',2,$9::jsonb),
      ($1,'plan_scenario',$2,1,$3::jsonb),($1,'capacity_scenario',$4,1,$5::jsonb),
      ($1,'initiative','initiative-a',7,$6::jsonb),($1,'execution_case','case-a',3,$7::jsonb),($1,'execution_task','task-a',2,$8::jsonb)`,
      [
        org,
        planId,
        JSON.stringify(oldPlan),
        capacityId,
        JSON.stringify({
          scenarioId: capacityId,
          status: 'PUBLISHED',
          planScenarioId: planId,
          planScenarioVersion: 1,
        }),
        JSON.stringify({ initiativeId: 'initiative-a' }),
        JSON.stringify({ executionCaseId: 'case-a', initiativeId: 'initiative-a' }),
        JSON.stringify({
          taskId: 'task-a',
          executionCaseId: 'case-a',
          initiativeId: 'initiative-a',
          status: 'OPEN',
        }),
        JSON.stringify({
          scenarioId: 'portfolio-aco43',
          scope: { portfolioId: 'operations-transformation-2027' },
        }),
      ]
    );
  });
  afterAll(async () => {
    await cleanupInitiativesExecutionOrg(pool, 'org-aco43');
    await pool.end();
  });
  const range = {
    low: 1,
    base: 2,
    high: 3,
    unit: 'days',
    knowledgeState: 'KNOWN' as const,
    confidence: 'HIGH' as const,
    sourceRefs: [{ ref: 'model:1', version: 1 }],
  };
  const option = (optionId: string, kind: 'RESEQUENCE' | 'SCOPE_SPLIT' | 'ADD_CAPACITY') => ({
    optionId,
    kind,
    assumptions: [
      {
        assumption: 'Stable demand',
        ownerId: 'planner',
        sourceRef: { ref: 'demand:1', version: 1 },
        knowledgeState: 'KNOWN' as const,
      },
    ],
    affectedMemberships: [{ initiativeId: 'initiative-a', membershipVersion: 1 }],
    affectedPeriods: ['2026-W33'],
    affectedResources: [{ resourceRef: 'team-a', version: 1 }],
    impact: { date: range, scope: range, cost: range, risk: range },
    rationale: kind,
  });
  it('links selected option through approved MaterialChange receipt to Intervention and the same Plan readback', async () => {
    await createCapacityOptions(
      uow,
      env(
        'capacity_options',
        comparisonId,
        'planner',
        0,
        'options-create',
        'capacity-options.create',
        {
          planRef: { scenarioId: planId, version: 1 },
          capacityRef: { scenarioId: capacityId, version: 1 },
          options: [
            option('resequence', 'RESEQUENCE'),
            option('split', 'SCOPE_SPLIT'),
            option('add', 'ADD_CAPACITY'),
          ],
        },
        true
      )
    );
    await selectCapacityOption(
      uow,
      env(
        'capacity_options',
        comparisonId,
        'planner',
        1,
        'options-select',
        'capacity-options.select',
        { optionId: 'resequence', nextKind: 'MATERIAL_CHANGE' }
      )
    );
    const known = { knowledgeState: 'KNOWN' as const, refs: [{ ref: 'impact:1', version: 1 }] };
    const changeDraft = {
      target: {
        kind: 'PLANNING_BASELINE',
        aggregateType: 'plan_scenario',
        aggregateId: planId,
        version: 1,
      },
      oldSnapshot: oldPlan,
      newSnapshot: newPlan,
      diff: [{ path: 'memberships', oldValue: oldPlan.memberships, newValue: newPlan.memberships }],
      classification: 'MATERIAL',
      tolerance: {
        policyRef: 'plan-tolerance',
        policyVersion: 1,
        withinTolerance: false,
        rationale: 'Sequence materially changed',
      },
      blastRadius: {
        tasks: known,
        decisions: known,
        milestones: known,
        risks: known,
        capacity: known,
        approvals: known,
        handoff: known,
      },
      reversibility: 'REVERSIBLE',
      ownerId: 'planner',
      authorityId: 'plan-authority',
      governedInputRef: {
        kind: 'CAPACITY_OPTION',
        comparisonId,
        comparisonVersion: 2,
        optionId: 'resequence',
      },
    };
    await createMaterialChange(
      uow,
      env(
        'material_change',
        'mc-aco43',
        'planner',
        0,
        'mc-create',
        'material-change.create',
        changeDraft,
        true
      )
    );
    await createMaterialChange(
      uow,
      env(
        'material_change',
        'mc-rejected',
        'planner',
        0,
        'mc-rejected-create',
        'material-change.create',
        changeDraft,
        true
      )
    );
    await transitionMaterialChange(
      uow,
      env(
        'material_change',
        'mc-rejected',
        'planner',
        1,
        'mc-rejected-request',
        'material-change.transition',
        { action: 'REQUEST' }
      )
    );
    await transitionMaterialChange(
      uow,
      env(
        'material_change',
        'mc-rejected',
        'plan-authority',
        2,
        'mc-rejected-decide',
        'material-change.transition',
        { action: 'DECIDE', outcome: 'REJECT', conditions: [], rationale: 'Rejected alternative' }
      )
    );
    await expect(
      transitionMaterialChange(
        uow,
        env(
          'material_change',
          'mc-rejected',
          'planner',
          3,
          'mc-rejected-publish',
          'material-change.transition',
          { action: 'PUBLISH' }
        )
      )
    ).rejects.toThrow('Approved change owner publishes');
    const mc = (actor: string, version: number, key: string, payload: any) =>
      transitionMaterialChange(
        uow,
        env(
          'material_change',
          'mc-aco43',
          actor,
          version,
          key,
          'material-change.transition',
          payload
        )
      );
    await mc('planner', 1, 'mc-request', { action: 'REQUEST' });
    await mc('plan-authority', 2, 'mc-approve', {
      action: 'DECIDE',
      outcome: 'APPROVE',
      conditions: [],
      rationale: 'Governed resequence accepted',
    });
    await mc('planner', 3, 'mc-publish', { action: 'PUBLISH' });
    const signalId = managementSignalFingerprint({
      ruleId: 'capacity-overload',
      sourceType: 'plan_scenario',
      sourceId: planId,
    });
    await ingestManagementSignal(
      uow,
      env(
        'management_signal',
        signalId,
        'producer',
        0,
        'signal',
        'management-signal.ingest',
        {
          ruleId: 'capacity-overload',
          sourceType: 'plan_scenario',
          sourceId: planId,
          sourceVersions: { plan: 1 },
          severity: 'CRITICAL',
          occurredAt: '2026-08-10T10:00:00.000Z',
          evidenceRef: 'capacity:overload',
        },
        true
      )
    );
    await draftInterventionCase(
      uow,
      env(
        'intervention_case',
        'intervention-aco43',
        'owner',
        0,
        'intervention-draft',
        'intervention.draft',
        {
          signalRefs: [{ signalId, signalVersion: 1, fingerprint: signalId }],
          ownerId: 'owner',
          authorityId: 'authority',
          slaAt: '2026-08-12T00:00:00.000Z',
          hypotheses: ['Sequence causes overload'],
          evidenceRefs: ['capacity:overload'],
          counterEvidenceRefs: [],
          unknowns: [],
          blastRadiusRefs: [{ ref: `plan:${planId}`, version: 1 }],
          options: [
            {
              optionId: 'none',
              kind: 'DO_NOTHING',
              label: 'Do nothing',
              impacts: [{ targetRef: planId, effect: 'Overload persists' }],
              confidence: 'HIGH',
              reversibility: 'REVERSIBLE',
            },
            {
              optionId: 'resequence',
              kind: 'ACTION',
              label: 'Apply governed resequence',
              impacts: [{ targetRef: planId, effect: 'Load moves' }],
              confidence: 'HIGH',
              reversibility: 'REVERSIBLE',
            },
          ],
        },
        true
      )
    );
    const intervention = (actor: string, version: number, key: string, payload: any) =>
      transitionInterventionCase(
        uow,
        env(
          'intervention_case',
          'intervention-aco43',
          actor,
          version,
          key,
          'intervention.transition',
          payload
        )
      );
    await intervention('owner', 1, 'intervention-request', { action: 'REQUEST' });
    await intervention('authority', 2, 'intervention-decide', {
      action: 'DECIDE',
      outcome: 'APPROVED',
      selectedOptionId: 'resequence',
      rationale: 'Use governed Plan change',
    });
    const application = {
      action: 'APPLY',
      targetReceiptClientRequestId: 'mc-publish',
      targetAggregateType: 'material_change',
      targetAggregateId: 'mc-aco43',
      expectedTargetVersion: 4,
      expectedTargetState: 'PUBLISHED',
      planChange: {
        planScenarioId: planId,
        oldVersion: 1,
        newVersion: 2,
        oldHash: materialSnapshotHash(oldPlan),
        newHash: materialSnapshotHash(newPlan),
        selectedCapacityOptionRef: { comparisonId, comparisonVersion: 2, optionId: 'resequence' },
        affected: {
          initiatives: [{ id: 'initiative-a', version: 7 }],
          executionCases: [{ id: 'case-a', version: 3 }],
          tasks: [{ id: 'task-a', version: 2 }],
        },
      },
      verifyBy: '2026-08-20T00:00:00.000Z',
      expectedEffect: 'Overload reduced after resequence',
      measurementSource: { ref: 'capacity:scenario', version: 2 },
    };
    await expect(
      intervention('owner', 3, 'apply-stale', {
        ...application,
        planChange: { ...application.planChange, newHash: 'stale-hash' },
      })
    ).rejects.toThrow('Plan Material Change');
    expect((await intervention('owner', 3, 'apply', application)).status).toBe('APPLIED');
    expect((await intervention('owner', 3, 'apply', application)).status).toBe('REPLAYED');
    const plan = await reader.findPlanScenario(org, planId);
    expect(plan?.version).toBe(2);
    expect(plan?.governedChanges).toHaveLength(1);
    expect(plan?.governedChanges[0]).toMatchObject({
      interventionId: 'intervention-aco43',
      planChange: {
        before: expect.objectContaining({ version: 1 }),
        after: expect.objectContaining({ version: 2 }),
        capacityOptionInput: expect.objectContaining({ optionId: 'resequence' }),
      },
    });
    expect((await reader.listInterventionCases(org))[0]).toMatchObject({
      targetCommand: { clientRequestId: 'mc-publish', commandType: 'material-change.transition' },
      planChange: { planScenarioId: planId, affected: { tasks: [{ id: 'task-a', version: 2 }] } },
      verifyBy: '2026-08-20T00:00:00.000Z',
    });
    const task = await pool.query(
      `SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='execution_task' AND aggregate_id='task-a'`,
      [org]
    );
    expect(task.rows[0].payload_json).toMatchObject({ taskId: 'task-a', status: 'OPEN' });
    expect(task.rows[0].payload_json.planChange).toBeUndefined();
  });

  it('keeps tenant readback isolated', async () => {
    expect(await reader.findPlanScenario('foreign', planId)).toBeNull();
  });
});
