import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  decideClosureCase,
  requestClosureCase,
} from '../../../server/src/domain/initiatives-execution/closureDecision';
import {
  archiveClosedInitiative,
  closeEffectiveInitiative,
  createEffectivenessCase,
  transitionEffectiveness,
} from '../../../server/src/domain/initiatives-execution/effectivenessClosure';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';

const url = process.env.IE_TEST_DATABASE_URL?.trim(),
  real = url ? describe : describe.skip;
real('ACO-55–57 Effectiveness Review, Closure and Archive realDB', () => {
  const pool = new Pool({ connectionString: url, max: 1 });
  const uow = new PostgresMaterialCommandUnitOfWork(pool),
    reader = new PostgresInitiativeReader(pool);
  const org = 'org-ie081',
    initiativeId = 'initiative-ie081',
    caseId = 'case-ie081';
  const packId = 'pack-ie081',
    resultsId = 'results-ie081',
    effectId = 'effect-ie081';
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
       ($1,'initiative',$2,10,$3::jsonb),($1,'execution_case',$4,5,$5::jsonb),
       ($1,'benefits_handoff_pack',$6,1,$7::jsonb),($1,'results_acceptance',$8,2,$9::jsonb),
       ($1,'results_kpi_observation','obs-1',1,$10::jsonb)`,
      [
        org,
        initiativeId,
        JSON.stringify({ initiativeId, projectId: 'p1', lifecycleState: 'BENEFITS_TRACKING' }),
        caseId,
        JSON.stringify({ executionCaseId: caseId, initiativeId, state: 'ACTIVE' }),
        packId,
        JSON.stringify({ packId, initiativeId, benefitOwnerId: 'benefit-owner' }),
        resultsId,
        JSON.stringify({ resultsCaseId: resultsId, initiativeId, packId, status: 'ACCEPTED' }),
        JSON.stringify({
          observationId: 'obs-1',
          resultsCaseRef: { resultsCaseId: resultsId, version: 2 },
          kpiId: 'weekly-throughput',
          baselineValue: 95,
          observedValue: 58,
          targetValue: 58,
          formula: 'weekly_cases',
          unit: 'cases/week',
          currency: null,
          window: {
            start: '2026-06-01T00:00:00.000Z',
            end: '2026-06-08T00:00:00.000Z',
            cadence: 'P1W',
          },
          sourceRef: { ref: 'results-store:weekly-throughput', version: 7 },
          asOf: '2026-06-08T00:00:00.000Z',
          confidence: 'HIGH',
          knowledgeState: 'KNOWN',
          measurementState: 'MEASURED',
          financeReconciliationRef: null,
          rationale: 'Accepted Results observation',
          producerId: 'results-owner',
        }),
      ]
    );
  });
  afterAll(async () => pool.end());
  const createAndReview = async (outcome: string, suffix = '') => {
    const id = `${effectId}${suffix}`;
    await createEffectivenessCase(
      uow,
      env(
        'effectiveness_case',
        id,
        'benefit-owner',
        0,
        `create${suffix}`,
        'effectiveness.create',
        {
          initiativeId,
          executionCaseId: caseId,
          benefitsHandoffPackRef: { packId, version: 1 },
          resultsAcceptanceRef: { resultsCaseId: resultsId, version: 2 },
          observationRefs: [{ observationId: 'obs-1', version: 1 }],
          benefitOwnerId: 'benefit-owner',
          reviewerId: 'reviewer',
          closureAuthorityId: 'closer',
        },
        true
      )
    );
    const move = (actor: string, version: number, key: string, payload: any) =>
      transitionEffectiveness(
        uow,
        env(
          'effectiveness_case',
          id,
          actor,
          version,
          `${key}${suffix}`,
          'effectiveness.transition',
          payload
        )
      );
    await move('benefit-owner', 1, 'request', { action: 'REQUEST_REVIEW' });
    const reviewed = await move('reviewer', 2, 'review', {
      action: 'DECIDE',
      outcome,
      rationale: 'Independent evidence review',
      expectedInitiativeVersion: 10,
      snapshotId: `effectiveness-snapshot${suffix || '-1'}`,
    });
    return { id, reviewed };
  };
  const closureRequest = (id = 'closure-case-1', legalHold = false) =>
    requestClosureCase(
      uow,
      env(
        'closure_case',
        id,
        'closure-requester',
        0,
        `${id}-request`,
        'closure.request',
        {
          initiativeId,
          executionCaseId: caseId,
          expectedInitiativeVersion: 11,
          expectedExecutionCaseVersion: 5,
          effectivenessSnapshotRef: { snapshotId: 'effectiveness-snapshot-1', version: 1 },
          authorityId: 'closer',
          lessons: ['Keep benefit measurement owner from mobilization'],
          lineageRefs: [{ ref: 'results:results-ie081', version: 2 }],
          followUps: [
            {
              kind: 'OWNED_ITEM',
              itemId: 'follow-1',
              description: 'Quarterly sustainment check',
              ownerId: 'benefit-owner',
              dueAt: '2026-10-01T00:00:00.000Z',
            },
          ],
          retention: {
            classification: 'TRANSFORMATION_RECORD',
            policyRef: { ref: 'retention-policy', version: 3 },
            legalHold,
          },
        },
        true
      )
    );

  it('atomically reviews, creates immutable snapshot, closes through an independent Closure Case, then archives', async () => {
    const { reviewed } = await createAndReview('EFFECTIVE');
    expect(reviewed.response as any).toMatchObject({
      status: 'REVIEWED',
      reviewOutcome: 'CONFIRMED',
      reviewHistory: [
        expect.objectContaining({ requestedOutcome: 'EFFECTIVE', canonicalOutcome: 'CONFIRMED' }),
      ],
    });
    expect(await reader.findEffectivenessSnapshot(org, 'effectiveness-snapshot-1')).toMatchObject({
      outcome: 'CONFIRMED',
      reviewedBy: 'reviewer',
      observations: [
        expect.objectContaining({
          observationId: 'obs-1',
          baselineValue: 95,
          observedValue: 58,
          sourceRef: { ref: 'results-store:weekly-throughput', version: 7 },
        }),
      ],
    });
    expect((await reader.findById(org, initiativeId))?.initiative.lifecycleState).toBe(
      'EFFECTIVENESS_REVIEWED'
    );
    await closureRequest();
    const closeCommand = env(
      'closure_case',
      'closure-case-1',
      'closer',
      1,
      'closure-close',
      'closure.decide',
      {
        outcome: 'CLOSE',
        rationale: 'Lessons and residual ownership accepted',
        snapshotId: 'closure-1',
        expectedInitiativeVersion: 11,
        expectedExecutionCaseVersion: 5,
      }
    );
    expect((await decideClosureCase(uow, closeCommand)).status).toBe('APPLIED');
    expect((await decideClosureCase(uow, closeCommand)).status).toBe('REPLAYED');
    expect((await reader.findById(org, initiativeId))?.initiative.lifecycleState).toBe('CLOSED');
    expect(await reader.findClosureSnapshot(org, 'closure-1')).toMatchObject({
      effectivenessOutcome: 'CONFIRMED',
      lessons: [expect.any(String)],
      retention: { classification: 'TRANSFORMATION_RECORD', legalHold: false },
    });
    await archiveClosedInitiative(
      uow,
      env(
        'archive_manifest',
        'archive-1',
        'records-manager',
        0,
        'archive',
        'initiative.archive',
        {
          initiativeId,
          expectedInitiativeVersion: 12,
          closureSnapshotRef: { snapshotId: 'closure-1', version: 1 },
          retentionPolicyRef: { ref: 'retention-policy', version: 3 },
          legalHold: false,
          exportRefs: [{ ref: 'export:closure-1', version: 1 }],
        },
        true
      )
    );
    expect((await reader.findById(org, initiativeId))?.initiative.lifecycleState).toBe('ARCHIVED');
    expect(await reader.listClosureCases('foreign')).toEqual([]);
  });

  it('keeps RETURN/CORRECTIVE and legal hold out of CLOSED, and blocks retired direct close', async () => {
    await createAndReview('NOT_VERIFIED');
    expect(await reader.findEffectivenessSnapshot(org, 'effectiveness-snapshot-1')).toMatchObject({
      outcome: 'RETURN_FOR_MEASUREMENT',
    });
    await closureRequest('closure-case-1', true);
    await expect(
      decideClosureCase(
        uow,
        env('closure_case', 'closure-case-1', 'closer', 1, 'held-close', 'closure.decide', {
          outcome: 'CLOSE',
          rationale: 'Cannot close under hold',
          snapshotId: 'closure-held',
          expectedInitiativeVersion: 11,
          expectedExecutionCaseVersion: 5,
        })
      )
    ).rejects.toThrow('legal hold');
    await decideClosureCase(
      uow,
      env('closure_case', 'closure-case-1', 'closer', 1, 'corrective', 'closure.decide', {
        outcome: 'CORRECTIVE',
        rationale: 'Continue owned measurement correction',
        snapshotId: '',
        expectedInitiativeVersion: 11,
        expectedExecutionCaseVersion: 5,
      })
    );
    expect((await reader.findById(org, initiativeId))?.initiative.lifecycleState).toBe(
      'EFFECTIVENESS_REVIEWED'
    );
    await expect(
      closeEffectiveInitiative(
        uow,
        env('effectiveness_case', effectId, 'closer', 4, 'legacy-close', 'effectiveness.close', {
          snapshotId: 'legacy',
          rationale: 'bypass',
          expectedInitiativeVersion: 11,
          expectedExecutionCaseVersion: 5,
        })
      )
    ).rejects.toThrow('governed Closure Case');
  });
});
