/** @vitest-environment node */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import type { PlanDependencyAnalysisResult } from '../../../services/ai/planDependencyAnalysisService.js';
import { createPlanAnalysisProposal } from '../planAnalysisProposal.js';
import { PostgresInitiativeReader } from '../postgresInitiativeReader.js';
import { PostgresMaterialCommandUnitOfWork } from '../postgresMaterialCommandUnitOfWork.js';
import type { PlanScenario } from '../planScenario.js';

const NO_RETRY = { retry: 0 } as const;

describe('DEC-497 P2 E1 — real Plan snapshot → AI proposal → PostgreSQL readback', NO_RETRY, () => {
  const organizationId = randomUUID();
  const actorId = randomUUID();
  const scenarioId = `plan-${randomUUID()}`;
  const foundationId = `foundation-${randomUUID()}`;
  const rolloutId = `rollout-${randomUUID()}`;
  const trainingId = `training-${randomUUID()}`;
  const proposalId = `proposal-${randomUUID()}`;
  let pool: Pool;

  const scenario: PlanScenario = {
    scenarioId,
    scenarioVersion: 3,
    status: 'DRAFT',
    portfolioScenarioId: `portfolio-${randomUUID()}`,
    portfolioScenarioVersion: 1,
    windowUnit: 'WEEK',
    timezone: 'Europe/Warsaw',
    periods: [
      { periodId: 'W1', start: '2026-09-14T00:00:00.000Z', end: '2026-09-21T00:00:00.000Z' },
      { periodId: 'W2', start: '2026-09-21T00:00:00.000Z', end: '2026-09-28T00:00:00.000Z' },
    ],
    windows: [foundationId, rolloutId, trainingId].map((initiativeId, index) => ({
      initiativeId,
      initiativeVersion: 1,
      earliest: '2026-09-14T00:00:00.000Z',
      target: index === 0 ? '2026-09-14T00:00:00.000Z' : '2026-09-21T00:00:00.000Z',
      latest: '2026-09-28T00:00:00.000Z',
      confidence: 'MEDIUM',
      rationale: 'Real plan fixture',
      dependencySnapshot: index === 0 ? [] : index === 1 ? [foundationId] : [rolloutId],
      constraintSnapshot: [],
    })),
    assumptions: [],
    createdBy: actorId,
    updatedBy: actorId,
    publishedBy: null,
    publishedAt: null,
  };

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: String(process.env.DATABASE_URL), max: 3 });
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [
      organizationId,
      'S3 Plan analysis RealPG',
    ]);
    await pool.query(
      `INSERT INTO initiatives(
         id, organization_id, name, status, summary, problem_statement, hypothesis,
         business_value, scope_in, scope_out, deliverables, planned_start_date, planned_end_date
       ) VALUES
       ($1,$3,'Data foundation','APPROVED','Create governed source data','Planning lacks governed data',
        'If the source is governed, rollout decisions use stable evidence','Reliable planning','["data"]','[]','["governed dataset"]',$4,$5),
       ($2,$3,'Operating rollout','APPROVED','Deploy the new operating process','Teams use inconsistent process',
        'If the governed source exists, rollout can proceed','Adoption','["rollout"]','[]','["deployed process"]',$5,$6),
       ($7,$3,'Team training','APPROVED','Train teams on the target process','Teams need operating guidance',
        'If the rollout is stable, training accelerates adoption','Adoption','["training"]','[]','["trained teams"]',$5,$6)`,
      [
        foundationId,
        rolloutId,
        organizationId,
        '2026-09-14T00:00:00.000Z',
        '2026-09-21T00:00:00.000Z',
        '2026-09-28T00:00:00.000Z',
        trainingId,
      ]
    );
    await pool.query(
      `INSERT INTO initiative_dependencies(
         id,organization_id,from_initiative_id,to_initiative_id,type,created_by
       ) VALUES($1,$2,$3,$4,'FINISH_TO_START',$5)`,
      [randomUUID(), organizationId, rolloutId, foundationId, actorId]
    );
    await pool.query(
      `INSERT INTO ie_aggregate_state(
         organization_id,aggregate_type,aggregate_id,version,payload_json
       ) VALUES($1,'plan_scenario',$2,3,$3::jsonb)`,
      [organizationId, scenarioId, JSON.stringify(scenario)]
    );
  });

  afterAll(async () => {
    if (!pool) return;
    for (const table of [
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ])
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM initiative_dependencies WHERE organization_id=$1`, [
      organizationId,
    ]);
    await pool.query(`DELETE FROM initiatives WHERE organization_id=$1`, [organizationId]);
    await pool.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await pool.end();
  });

  it('persists grounded absolute and conditional path evidence from the exact real snapshot', async () => {
    const reader = new PostgresInitiativeReader(pool);
    const context = await reader.listPlanDependencyAnalysisContext(organizationId, [
      foundationId,
      rolloutId,
      trainingId,
    ]);
    expect(context).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: foundationId, summary: 'Create governed source data' }),
        expect.objectContaining({
          id: rolloutId,
          existingDependencies: [{ predecessorId: foundationId, relationType: 'FINISH_TO_START' }],
        }),
      ])
    );

    const dependencyAnalysis: PlanDependencyAnalysisResult = {
      source: 'AI',
      model: 'contract-test-model',
      analyzedAt: '2026-09-14T01:00:00.000Z',
      inputScenarioVersion: 3,
      observations: [
        {
          observationId: 'absolute-source-before-rollout',
          predecessorId: foundationId,
          successorId: rolloutId,
          kind: 'ABSOLUTE',
          condition: null,
          rationale: 'The rollout consumes the governed source deliverable.',
          evidenceRefs: ['deliverables', 'scopeIn', 'existingDependencies'],
          confidence: 'HIGH',
        },
        {
          observationId: 'conditional-training-window',
          predecessorId: rolloutId,
          successorId: trainingId,
          kind: 'CONDITIONAL',
          condition: 'Only if the first rollout cohort trains on production data.',
          rationale: 'A sandbox cohort can start earlier.',
          evidenceRefs: ['plannedStartDate', 'summary'],
          confidence: 'MEDIUM',
        },
      ],
      criticalPaths: [
        {
          pathId: 'absolute-path',
          kind: 'ABSOLUTE',
          initiativeIds: [foundationId, rolloutId],
          condition: null,
          rationale: 'The governed source is a hard gate.',
        },
      ],
    };
    const result = await createPlanAnalysisProposal(new PostgresMaterialCommandUnitOfWork(pool), {
      organizationId,
      actorId,
      aggregateType: 'plan_analysis_proposal',
      aggregateId: proposalId,
      expectedVersion: 0,
      clientRequestId: randomUUID(),
      correlationId: randomUUID(),
      policyId: 'dec-497-p2-e1',
      policyVersion: 1,
      commandType: 'plan-analysis.create',
      createIfMissing: true,
      payload: {
        scenarioId,
        inputAggregateVersion: 3,
        dependencyAnalysis,
      },
    });
    expect(result.response.analysisSource).toBe('AI');
    expect(result.response.dependencyObservations.map((item) => item.kind)).toEqual([
      'ABSOLUTE',
      'CONDITIONAL',
    ]);

    const stored = await pool.query<{ version: number; payload_json: Record<string, any> }>(
      `SELECT version,payload_json FROM ie_aggregate_state
        WHERE organization_id=$1 AND aggregate_type='plan_analysis_proposal' AND aggregate_id=$2`,
      [organizationId, proposalId]
    );
    expect(stored.rows[0].version).toBe(1);
    expect(stored.rows[0].payload_json.inputScenarioVersion).toBe(3);
    expect(stored.rows[0].payload_json.analysisModel).toBe('contract-test-model');
    expect(stored.rows[0].payload_json.criticalPaths[0].initiativeIds).toEqual([
      foundationId,
      rolloutId,
    ]);
  });
});
