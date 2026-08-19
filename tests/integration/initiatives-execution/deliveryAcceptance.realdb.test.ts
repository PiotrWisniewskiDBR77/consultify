import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupInitiativesExecutionOrg } from '../../support/initiativesExecutionOrgCleanup';
import {
  decideDeliveryAcceptance,
  decideResultsAcceptance,
  requestDeliveryAcceptance,
  requestResultsAcceptance,
} from '../../../server/src/domain/initiatives-execution/deliveryAcceptance';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
const url = process.env.IE_TEST_DATABASE_URL?.trim(),
  real = url ? describe : describe.skip;
real('Delivery and Results Acceptance realDB', () => {
  const pool = new Pool({ connectionString: url, max: 2 }),
    uow = new PostgresMaterialCommandUnitOfWork(pool),
    reader = new PostgresInitiativeReader(pool),
    org = 'org-ie080',
    initiativeId = 'initiative-ie080',
    caseId = 'case-ie080',
    deliveryId = 'delivery-1',
    packId = 'benefits-pack-1',
    resultsId = 'results-case-stable';
  const env = (
    type: string,
    id: string,
    actor: string,
    v: number,
    key: string,
    commandType: string,
    payload: any,
    create = false
  ) => ({
    organizationId: org,
    actorId: actor,
    aggregateType: type,
    aggregateId: id,
    expectedVersion: v,
    clientRequestId: key,
    correlationId: key,
    policyId: type,
    policyVersion: 1,
    commandType,
    createIfMissing: create,
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
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)VALUES($1,'initiative',$2,5,$3::jsonb),($1,'execution_case',$4,3,$5::jsonb)`,
      [
        org,
        initiativeId,
        JSON.stringify({ initiativeId, lifecycleState: 'IN_EXECUTION' }),
        caseId,
        JSON.stringify({ executionCaseId: caseId, initiativeId, state: 'ACTIVE' }),
      ]
    );
  });
  afterAll(async () => {
    await cleanupInitiativesExecutionOrg(pool, 'org-ie080');
    await pool.end();
  });
  const request = {
    initiativeId,
    executionCaseId: caseId,
    initiativeVersion: 5,
    executionCaseVersion: 3,
    authorityId: 'delivery-authority',
    ownerId: 'delivery-owner',
    baselineRef: { ref: 'baseline:1', version: 2 },
    scopeRef: { ref: 'scope:1', version: 3 },
    deliverableRefs: [{ ref: 'deliverable:1', version: 1 }],
    milestoneRefs: [{ ref: 'milestone:1', version: 1 }],
    openTaskRefs: [],
    openDecisionRefs: [],
    riskResiduals: [],
    financeActualRefs: [{ ref: 'finance-actuals:1', version: 4 }],
    operationalHandoverRef: { ref: 'handover:1', version: 1 },
    benefitOwnerId: 'benefit-owner',
    kpiMeasurementContractRefs: [{ ref: 'kpi-contract:1', version: 2 }],
  };
  it('delivers atomically, creates immutable pack, preserves DELIVERED on Results rejection and replays safely', async () => {
    await requestDeliveryAcceptance(
      uow,
      env(
        'delivery_acceptance',
        deliveryId,
        'delivery-owner',
        0,
        'delivery-request',
        'delivery-acceptance.request',
        request,
        true
      )
    );
    expect((await reader.listMyAcceptanceWork(org, 'delivery-authority')).delivery).toHaveLength(1);
    const accepted = await decideDeliveryAcceptance(
      uow,
      env(
        'delivery_acceptance',
        deliveryId,
        'delivery-authority',
        1,
        'delivery-decide',
        'delivery-acceptance.decide',
        { outcome: 'ACCEPT', rationale: 'Delivery evidence accepted', packId }
      )
    );
    expect((accepted.response as any).status).toBe('ACCEPTED');
    expect(await reader.findBenefitsHandoffPack(org, packId)).toEqual(
      expect.objectContaining({
        packId,
        benefitOwnerId: 'benefit-owner',
        financeActualRefs: [{ ref: 'finance-actuals:1', version: 4 }],
      })
    );
    await requestResultsAcceptance(
      uow,
      env(
        'results_acceptance',
        resultsId,
        'results-owner',
        0,
        'results-request',
        'results-acceptance.request',
        { packId, packVersion: 1, initiativeId, authorityId: 'results-authority' },
        true
      )
    );
    expect((await reader.listMyAcceptanceWork(org, 'results-authority')).results).toEqual([
      expect.objectContaining({ resultsCaseId: resultsId, status: 'PENDING' }),
    ]);
    const payload = {
      outcome: 'REJECT_WITH_BLOCKERS' as const,
      rationale: 'KPI baseline not independently verified',
      gaps: [],
      blockers: [
        {
          description: 'Verify KPI baseline',
          ownerId: 'benefit-owner',
          dueAt: '2026-08-20T10:00:00.000Z',
        },
      ],
    };
    await decideResultsAcceptance(
      uow,
      env(
        'results_acceptance',
        resultsId,
        'results-authority',
        1,
        'results-decide',
        'results-acceptance.decide',
        payload
      )
    );
    expect(
      (
        await decideResultsAcceptance(
          uow,
          env(
            'results_acceptance',
            resultsId,
            'results-authority',
            1,
            'results-decide',
            'results-acceptance.decide',
            payload
          )
        )
      ).status
    ).toBe('REPLAYED');
    const initiative = await pool.query(
      `SELECT version,payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2`,
      [org, initiativeId]
    );
    expect(initiative.rows[0].payload_json.lifecycleState).toBe('DELIVERED');
    expect(initiative.rows[0].payload_json.expected_roi).toBeUndefined();
    expect(await reader.listResultsAcceptances('foreign')).toEqual([]);
  });
  it('fails closed when an open residual has no accountable owner/evidence', async () => {
    await requestDeliveryAcceptance(
      uow,
      env(
        'delivery_acceptance',
        deliveryId,
        'delivery-owner',
        0,
        'bad-request',
        'delivery-acceptance.request',
        {
          ...request,
          openTaskRefs: [{ taskId: 'open-1', version: 1, ownerId: null, evidenceRefs: [] }],
        },
        true
      )
    );
    await expect(
      decideDeliveryAcceptance(
        uow,
        env(
          'delivery_acceptance',
          deliveryId,
          'delivery-authority',
          1,
          'bad-decide',
          'delivery-acceptance.decide',
          { outcome: 'ACCEPT_WITH_RESIDUALS', rationale: 'Try', packId }
        )
      )
    ).rejects.toThrow('owner and evidence');
  });
});
