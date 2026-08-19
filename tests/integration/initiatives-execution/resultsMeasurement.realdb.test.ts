import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanupInitiativesExecutionOrg } from '../../support/initiativesExecutionOrgCleanup';
import { createEffectivenessCase } from '../../../server/src/domain/initiatives-execution/effectivenessClosure';
import {
  createFinanceReconciliation,
  createResultsKpiObservation,
} from '../../../server/src/domain/initiatives-execution/resultsMeasurement';
import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';

const url = process.env.IE_TEST_DATABASE_URL?.trim(),
  real = url ? describe : describe.skip;
real('ACO-53/54 Results and Finance authoritative bridge realDB', () => {
  const pool = new Pool({ connectionString: url, max: 1 });
  const uow = new PostgresMaterialCommandUnitOfWork(pool),
    reader = new PostgresInitiativeReader(pool);
  const org = 'org-aco5354',
    resultsId = 'results-5354',
    initiativeId = 'initiative-5354';
  const env = (
    type: string,
    id: string,
    actor: string,
    key: string,
    commandType: string,
    payload: any
  ) => ({
    organizationId: org,
    actorId: actor,
    aggregateType: type,
    aggregateId: id,
    expectedVersion: 0,
    clientRequestId: key,
    correlationId: key,
    policyId: type,
    policyVersion: 1,
    commandType,
    createIfMissing: true,
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
       ($1,'results_acceptance',$2,2,$3::jsonb),($1,'initiative',$4,10,$5::jsonb),
       ($1,'benefits_handoff_pack','pack-5354',1,$6::jsonb)`,
      [
        org,
        resultsId,
        JSON.stringify({ resultsCaseId: resultsId, initiativeId, status: 'ACCEPTED' }),
        initiativeId,
        JSON.stringify({ initiativeId, lifecycleState: 'BENEFITS_TRACKING' }),
        JSON.stringify({ packId: 'pack-5354', initiativeId }),
      ]
    );
  });
  afterAll(async () => {
    await cleanupInitiativesExecutionOrg(pool, org);
    await pool.end();
  });
  const baseObservation = {
    resultsCaseRef: { resultsCaseId: resultsId, version: 2 },
    kpiId: 'weekly-case-throughput',
    baselineValue: 95,
    observedValue: 58,
    targetValue: 58,
    formula: 'count(case_id)/week',
    unit: 'cases/week',
    currency: null,
    window: { start: '2026-08-03T00:00:00.000Z', end: '2026-08-10T00:00:00.000Z', cadence: 'P1W' },
    sourceRef: { ref: 'results:kpi:weekly-case-throughput', version: 7 },
    asOf: '2026-08-10T00:00:00.000Z',
    confidence: 'HIGH' as const,
    knowledgeState: 'KNOWN' as const,
    measurementState: 'MEASURED' as const,
    financeReconciliationRef: null,
    rationale: 'Accepted Results weekly observation',
    producerId: 'results-owner',
  };

  it('persists weekly 95→58 Results truth once and Effectiveness stores refs while review can snapshot it', async () => {
    const command = env(
      'results_kpi_observation',
      'obs-weekly-58',
      'results-owner',
      'obs-create',
      'results-observation.create',
      baseObservation
    );
    expect((await createResultsKpiObservation(uow, command)).status).toBe('APPLIED');
    expect((await createResultsKpiObservation(uow, command)).status).toBe('REPLAYED');
    await createEffectivenessCase(
      uow,
      env(
        'effectiveness_case',
        'effect-5354',
        'benefit-owner',
        'effect-create',
        'effectiveness.create',
        {
          initiativeId,
          executionCaseId: 'case-5354',
          benefitsHandoffPackRef: { packId: 'pack-5354', version: 1 },
          resultsAcceptanceRef: { resultsCaseId: resultsId, version: 2 },
          observationRefs: [{ observationId: 'obs-weekly-58', version: 1 }],
          benefitOwnerId: 'benefit-owner',
          reviewerId: 'reviewer',
          closureAuthorityId: 'closer',
        }
      )
    );
    const effect = (await reader.listEffectivenessCases(org))[0] as any;
    expect(effect).toMatchObject({
      observationRefs: [{ observationId: 'obs-weekly-58', version: 1 }],
      measurements: [],
    });
    expect(effect.observedValue).toBeUndefined();
    expect(await reader.listResultsKpiObservations(org, resultsId)).toEqual([
      expect.objectContaining({
        observationId: 'obs-weekly-58',
        baselineValue: 95,
        observedValue: 58,
      }),
    ]);
    expect(await reader.listResultsKpiObservations('foreign', resultsId)).toEqual([]);
  });

  it('fails financial measured truth closed when Finance is unavailable/stale, but allows explicit NOT_MEASURED', async () => {
    await createFinanceReconciliation(
      uow,
      env(
        'finance_reconciliation',
        'fin-unavailable',
        'finance-owner',
        'fin-unavailable',
        'finance-reconciliation.create',
        {
          projectId: 'project-ie053',
          status: 'UNAVAILABLE',
          sourceRef: { ref: 'finance:ledger', version: 4 },
          asOf: '2026-08-10T00:00:00.000Z',
          currency: 'PLN',
          amount: null,
          rationale: 'Period not reconciled',
          ownerId: 'finance-owner',
        }
      )
    );
    const financial = {
      ...baseObservation,
      kpiId: 'weekly-margin',
      currency: 'PLN',
      unit: 'PLN',
      financeReconciliationRef: { reconciliationId: 'fin-unavailable', version: 1 },
    };
    await expect(
      createResultsKpiObservation(
        uow,
        env(
          'results_kpi_observation',
          'obs-fin-bad',
          'results-owner',
          'obs-fin-bad',
          'results-observation.create',
          financial
        )
      )
    ).rejects.toThrow('FINANCE_RECONCILIATION_UNAVAILABLE_OR_STALE');
    await createResultsKpiObservation(
      uow,
      env(
        'results_kpi_observation',
        'obs-not-measured',
        'results-owner',
        'obs-not-measured',
        'results-observation.create',
        {
          ...financial,
          observedValue: null,
          measurementState: 'NOT_MEASURED',
          knowledgeState: 'UNKNOWN',
          confidence: 'UNKNOWN',
          rationale: 'Explicitly not measured pending reconciliation',
        }
      )
    );
    await createFinanceReconciliation(
      uow,
      env(
        'finance_reconciliation',
        'fin-available',
        'finance-owner',
        'fin-available',
        'finance-reconciliation.create',
        {
          projectId: 'project-ie053',
          status: 'AVAILABLE',
          sourceRef: { ref: 'finance:ledger', version: 5 },
          asOf: '2026-08-10T00:00:00.000Z',
          currency: 'PLN',
          amount: 58,
          rationale: 'Reconciled and closed period',
          ownerId: 'finance-owner',
        }
      )
    );
    await createResultsKpiObservation(
      uow,
      env(
        'results_kpi_observation',
        'obs-fin-good',
        'results-owner',
        'obs-fin-good',
        'results-observation.create',
        {
          ...financial,
          financeReconciliationRef: { reconciliationId: 'fin-available', version: 1 },
          rationale: 'Measured against reconciled ledger',
        }
      )
    );
    expect(await reader.findResultsKpiObservation(org, 'obs-not-measured')).toMatchObject({
      measurementState: 'NOT_MEASURED',
      observedValue: null,
      financeReconciliationRef: { reconciliationId: 'fin-unavailable', version: 1 },
    });
    expect(await reader.findFinanceReconciliation('foreign', 'fin-unavailable')).toBeNull();
    expect(await reader.findResultsKpiObservation(org, 'obs-fin-good')).toMatchObject({
      measurementState: 'MEASURED',
      observedValue: 58,
    });
  });
});
