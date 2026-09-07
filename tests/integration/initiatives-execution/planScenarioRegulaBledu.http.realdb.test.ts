import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';

/**
 * P15-K1 (DEC-421) — trasa runtime na ekranie.
 *
 * POMIAR 07.09 (zrzuty 30/31/32-formularz-nowy-plan): drugi plan na tej samej
 * wersji portfela konczyl sie HTTP 500 `INITIATIVES_EXECUTION_RUNTIME_FAILED`,
 * a bledna wersja portfela — bezimiennym 400 `COMMAND_VALIDATION_FAILED`.
 *
 * MUTACJE (dowod RED):
 *  - drugi plan: przywroc `relationType: PLAN_SCENARIO_PORTFOLIO:${v}` i stary
 *    indeks UNIQUE (organization_id, relation_type, target_type, target_id) -> 500;
 *  - regula: usun wpis 'Exact published Portfolio Scenario not found' z
 *    DOMAIN_RULE_BY_MESSAGE -> 400 COMMAND_VALIDATION_FAILED bez pola `rule`.
 */
const url = process.env.IE_TEST_DATABASE_URL?.trim();
const real = url ? describe : describe.skip;

real('P15-K1 — plan-scenarios: 201/201 i regula zamiast 500', () => {
  const pool = new Pool({ connectionString: url, max: 1 });
  const org = 'org-p15-k1-http';
  const portfolioScope = 'portfolio-p15-k1-http';
  const portfolioId = 'portfolio-scenario-p15-k1-http';
  const initiativeOne = 'initiative-p15-k1-one';
  const initiativeTwo = 'initiative-p15-k1-two';
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as unknown as { user: unknown }).user = {
      id: 'user-p15-k1',
      organizationId: org,
      role: 'USER',
    };
    next();
  });
  app.use(
    '/runtime-v1',
    createInitiativesExecutionRuntimeRouter({
      unitOfWork: new PostgresMaterialCommandUnitOfWork(pool),
      reader: new PostgresInitiativeReader(pool),
      authorize: async (actor, projectId) =>
        actor.organizationId === org && projectId === portfolioScope,
      resolvePolicy: async () => ({
        policyId: 'p15-k1-http',
        version: 1,
        baseline: 'STANDARD' as const,
        strictness: 1,
        source: 'ORGANIZATION' as const,
        config: { selfApproval: true, enforceGateGovernance: false, gates: {}, roleBindings: [] },
      }),
    })
  );

  const scenario = (scenarioId: string, portfolioScenarioVersion: number) => ({
    scenarioId,
    name: `Plan ${scenarioId}`,
    scenarioVersion: 0,
    status: 'DRAFT',
    portfolioScenarioId: portfolioId,
    portfolioScenarioVersion,
    windowUnit: 'WEEK',
    timezone: 'Europe/Warsaw',
    periods: [
      { periodId: 'T1', start: '2026-09-07T00:00:00.000Z', end: '2026-09-14T00:00:00.000Z' },
    ],
    windows: [initiativeOne, initiativeTwo].map((initiativeId) => ({
      initiativeId,
      initiativeVersion: 1,
      earliest: null,
      target: null,
      latest: null,
      confidence: 'LOW',
      rationale: 'P15-K1 http fixture',
      dependencySnapshot: [],
      constraintSnapshot: [],
    })),
    assumptions: [],
    createdBy: '',
    updatedBy: '',
    publishedBy: null,
    publishedAt: null,
  });

  const cleanup = async () => {
    for (const table of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ])
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [org]);
  };

  beforeAll(async () => {
    await cleanup();
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES
       ($1,'portfolio_scenario',$2,1,$3::jsonb),($1,'initiative',$4,1,$5::jsonb),($1,'initiative',$6,1,$7::jsonb)`,
      [
        org,
        portfolioId,
        JSON.stringify({
          scenarioId: portfolioId,
          scenarioVersion: 1,
          status: 'PUBLISHED',
          scope: { portfolioId: portfolioScope, goalIds: [], asOf: '2026-09-06T00:00:00.000Z' },
          model: { modelId: 'fixture', version: 1 },
          memberships: [initiativeOne, initiativeTwo].map((initiativeId, index) => ({
            initiativeId,
            initiativeVersion: 1,
            disposition: 'INCLUDED',
            scoreDecomposition: {},
            rank: index + 1,
            rankOverride: null,
            coverage: { state: 'UNKNOWN', value: null, reason: 'fixture' },
            overlap: { state: 'UNKNOWN', value: null, reason: 'fixture' },
            roughDemand: { state: 'UNKNOWN', value: null, reason: 'fixture' },
            confidence: 'LOW',
            rationale: 'fixture',
          })),
          decompositionKeys: [],
          createdBy: 'user-p15-k1',
          updatedBy: 'user-p15-k1',
          publishedBy: 'user-p15-k1',
          publishedAt: '2026-09-06T00:00:00.000Z',
          previousPublishedVersion: null,
        }),
        initiativeOne,
        JSON.stringify({ initiativeId: initiativeOne, lifecycleState: 'APPROVED_BACKLOG' }),
        initiativeTwo,
        JSON.stringify({ initiativeId: initiativeTwo, lifecycleState: 'APPROVED_BACKLOG' }),
      ]
    );
  });

  afterAll(async () => {
    await cleanup();
    await pool.end();
  });

  it('zaklada dwa plany na tej samej wersji portfela — 201 i 201', async () => {
    const first = await request(app)
      .post('/runtime-v1/plan-scenarios/plan-p15-k1-a')
      .send({
        expectedVersion: 0,
        clientRequestId: 'p15-k1-a',
        operation: 'CREATE',
        scenario: scenario('plan-p15-k1-a', 1),
      });
    const second = await request(app)
      .post('/runtime-v1/plan-scenarios/plan-p15-k1-b')
      .send({
        expectedVersion: 0,
        clientRequestId: 'p15-k1-b',
        operation: 'CREATE',
        scenario: scenario('plan-p15-k1-b', 1),
      });
    expect([first.status, second.status]).toEqual([201, 201]);
  });

  it('bledna wersja portfela wraca jako 400 z kodem reguly, nie jako 500', async () => {
    const response = await request(app)
      .post('/runtime-v1/plan-scenarios/plan-p15-k1-c')
      .send({
        expectedVersion: 0,
        clientRequestId: 'p15-k1-c',
        operation: 'CREATE',
        scenario: scenario('plan-p15-k1-c', 99),
      });
    expect(response.status).toBe(400);
    expect(response.body.rule).toBe('PORTFOLIO_VERSION_MISMATCH');
    expect(response.body.error.rule).toBe('PORTFOLIO_VERSION_MISMATCH');
  });
});
