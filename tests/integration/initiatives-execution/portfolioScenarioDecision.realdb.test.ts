import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  mutatePortfolioScenario,
  type PortfolioScenario,
} from '../../../server/src/domain/initiatives-execution/portfolioScenario';
import {
  decidePortfolio,
  requestPortfolioDecision,
} from '../../../server/src/domain/initiatives-execution/portfolioDecision';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
const url = process.env.IE_TEST_DATABASE_URL?.trim();
const real = url ? describe : describe.skip;
real('Portfolio Scenario and per-Initiative Decision realDB', () => {
  const pool = new Pool({ connectionString: url, max: 3 });
  const uow = new PostgresMaterialCommandUnitOfWork(pool);
  const org = 'org-ie050';
  const scenarioId = 'scenario-ie050';
  const initiativeId = 'initiative-ie050';
  const base: PortfolioScenario = {
    scenarioId,
    scenarioVersion: 0,
    status: 'DRAFT',
    scope: { portfolioId: 'portfolio-p1', goalIds: ['goal-1'], asOf: '2026-08-09T20:00:00Z' },
    model: { modelId: 'vcr', version: 1 },
    decompositionKeys: ['fit'],
    createdBy: '',
    updatedBy: '',
    publishedBy: null,
    publishedAt: null,
    previousPublishedVersion: null,
    memberships: [
      {
        initiativeId,
        initiativeVersion: 5,
        disposition: 'CONDITIONAL',
        scoreDecomposition: { fit: 8 },
        rank: 1,
        rankOverride: {
          actorId: 'portfolio-owner',
          reason: 'Mandatory lane',
          previousRank: 2,
          newRank: 1,
        },
        coverage: { state: 'UNKNOWN', value: null, reason: 'MECE denominator unknown' },
        overlap: { state: 'ESTIMATED', value: ['qms'], basis: 'review:v1' },
        roughDemand: {
          state: 'ESTIMATED',
          value: { unit: 'FTE', low: 1, base: 2, high: 3 },
          basis: 'owner estimate',
        },
        confidence: 'LOW',
        rationale: 'Conditional comparison',
      },
    ],
  };
  const env = (
    aggregateType: string,
    aggregateId: string,
    actorId: string,
    expectedVersion: number,
    clientRequestId: string,
    commandType: string,
    payload: any
  ) => ({
    organizationId: org,
    actorId,
    aggregateType,
    aggregateId,
    expectedVersion,
    clientRequestId,
    correlationId: clientRequestId,
    policyId: 'standard',
    policyVersion: 1,
    commandType,
    createIfMissing: aggregateType === 'portfolio_scenario' && expectedVersion === 0,
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
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)VALUES($1,'initiative',$2,5,$3::jsonb)`,
      [
        org,
        initiativeId,
        JSON.stringify({
          initiativeId,
          projectId: 'portfolio-p1',
          lifecycleState: 'READY_FOR_DECISION',
          cardRefs: { options: { cardVersion: 2, aggregateVersion: 5 } },
        }),
      ]
    );
  });
  afterAll(async () => pool.end());
  it('versions and publishes without lifecycle mutation, then one independent Decision approves only one Initiative', async () => {
    await mutatePortfolioScenario(
      uow,
      env(
        'portfolio_scenario',
        scenarioId,
        'portfolio-owner',
        0,
        'create',
        'portfolio.scenario.mutate',
        { operation: 'CREATE', scenario: base }
      )
    );
    await mutatePortfolioScenario(
      uow,
      env(
        'portfolio_scenario',
        scenarioId,
        'portfolio-owner',
        1,
        'publish',
        'portfolio.scenario.mutate',
        { operation: 'PUBLISH', scenario: base }
      )
    );
    let initiative = await pool.query(
      `SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2`,
      [org, initiativeId]
    );
    expect(initiative.rows[0].payload_json.lifecycleState).toBe('READY_FOR_DECISION');
    const request = await requestPortfolioDecision(
      uow,
      env(
        'initiative',
        initiativeId,
        'portfolio-owner',
        5,
        'request',
        'initiative.portfolio.request',
        {
          decisionId: 'pd-1',
          authorityId: 'sponsor',
          scenarioId,
          scenarioVersion: 2,
          dueAt: '2026-08-20T12:00:00Z',
          selfApprovalAllowed: false,
        }
      )
    );
    expect(request.response.cardVersions).toEqual({ options: 2 });
    await decidePortfolio(
      uow,
      env('initiative', initiativeId, 'sponsor', 6, 'approve', 'initiative.portfolio.decide', {
        decisionId: 'pd-1',
        outcome: 'CONDITIONALLY_APPROVED',
        rationale: 'Approve with Finance reconciliation',
        conditions: ['Finance reconciliation'],
        mergeTargetInitiativeId: null,
        selfApprovalAllowed: false,
      })
    );
    initiative = await pool.query(
      `SELECT payload_json FROM ie_aggregate_state WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2`,
      [org, initiativeId]
    );
    expect(initiative.rows[0].payload_json.lifecycleState).toBe('APPROVED_BACKLOG');
    expect(
      (
        await pool.query(`SELECT count(*)::int n FROM ie_audit_events WHERE organization_id=$1`, [
          org,
        ])
      ).rows[0].n
    ).toBe(4);
  });
});
