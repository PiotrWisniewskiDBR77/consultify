/** @vitest-environment node */

/**
 * P15-K1 (DEC-421, decyzja D4) — klucz relacji ma niesc TOZSAMOSC zrodla.
 *
 * POWOD ISTNIENIA: przed ta paczka `relation_type` niosl NUMER WERSJI
 * (`PLAN_SCENARIO_PORTFOLIO:1`, `PLAN_SCENARIO_MEMBER:1:<inicjatywa>`), a tabela
 * `ie_aggregate_relations` miala UNIQUE `(organization_id, relation_type,
 * target_type, target_id)`. Skutek zmierzony 07.09: DRUGI plan zalozony na tej
 * samej wersji portfela wpadal w `23505` i wracal do uzytkownika jako HTTP 500
 * `INITIATIVES_EXECUTION_RUNTIME_FAILED` bez przyczyny na ekranie.
 *
 * MUTACJA (dowod RED): przywroc w `planScenario.ts` stary `relationType`
 * z numerem wersji i stary indeks UNIQUE — drugi CREATE znow konczy sie `23505`.
 */

import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import { PostgresMaterialCommandUnitOfWork } from '../postgresMaterialCommandUnitOfWork.js';
import { mutatePlanScenario, type PlanScenario } from '../planScenario.js';

const NO_RETRY = { retry: 0 } as const;

describe('P15-K1 — tozsamosc w kluczu relacji planu (realny PostgreSQL)', NO_RETRY, () => {
  const organizationId = randomUUID();
  const actorId = randomUUID();
  const portfolioId = `portfolio-${randomUUID()}`;
  const planAId = `plan-a-${randomUUID()}`;
  const planBId = `plan-b-${randomUUID()}`;
  const initiativeOne = `initiative-1-${randomUUID()}`;
  const initiativeTwo = `initiative-2-${randomUUID()}`;
  let pool: Pool;

  const draftFor = (planId: string): PlanScenario => ({
    scenarioId: planId,
    name: `Plan ${planId}`,
    scenarioVersion: 0,
    status: 'DRAFT',
    portfolioScenarioId: portfolioId,
    portfolioScenarioVersion: 1,
    windowUnit: 'WEEK',
    timezone: 'Europe/Warsaw',
    periods: [
      { periodId: 'T1', start: '2026-09-07T00:00:00.000Z', end: '2026-09-14T00:00:00.000Z' },
      { periodId: 'T2', start: '2026-09-14T00:00:00.000Z', end: '2026-09-21T00:00:00.000Z' },
    ],
    windows: [initiativeOne, initiativeTwo].map((initiativeId) => ({
      initiativeId,
      initiativeVersion: 1,
      earliest: null,
      target: null,
      latest: null,
      confidence: 'LOW',
      rationale: 'P15-K1 fixture',
      dependencySnapshot: [],
      constraintSnapshot: [],
    })),
    assumptions: [],
    createdBy: '',
    updatedBy: '',
    publishedBy: null,
    publishedAt: null,
  });

  const command = (planId: string, clientRequestId: string) => ({
    organizationId,
    actorId,
    aggregateType: 'plan_scenario',
    aggregateId: planId,
    expectedVersion: 0,
    clientRequestId,
    correlationId: randomUUID(),
    policyId: 'p15-k1-relation-identity',
    policyVersion: 1,
    commandType: 'plan.scenario.mutate',
    createIfMissing: true,
    payload: { operation: 'CREATE' as const, scenario: draftFor(planId) },
  });

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: String(process.env.DATABASE_URL) });
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [
      organizationId,
      'P15-K1 fixture',
    ]);
    await pool.query(
      `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json) VALUES
       ($1,'portfolio_scenario',$2,1,$3::jsonb),($1,'initiative',$4,1,$5::jsonb),($1,'initiative',$6,1,$7::jsonb)`,
      [
        organizationId,
        portfolioId,
        JSON.stringify({
          scenarioId: portfolioId,
          scenarioVersion: 1,
          status: 'PUBLISHED',
          scope: { portfolioId: 'p15-k1', goalIds: [], asOf: '2026-09-06T00:00:00.000Z' },
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
          createdBy: actorId,
          updatedBy: actorId,
          publishedBy: actorId,
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
    if (!pool) return;
    for (const table of [
      'ie_aggregate_relations',
      'ie_command_receipts',
      'ie_audit_events',
      'ie_outbox_events',
      'ie_aggregate_state',
    ])
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [organizationId]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
    await pool.end();
  });

  it('zaklada DWA plany na tej samej wersji portfela i zapisuje obie relacje', async () => {
    const uow = new PostgresMaterialCommandUnitOfWork(pool);
    const first = await mutatePlanScenario(uow, command(planAId, randomUUID()));
    const second = await mutatePlanScenario(uow, command(planBId, randomUUID()));

    expect(first.response.scenarioVersion).toBe(1);
    expect(second.response.scenarioVersion).toBe(1);

    const portfolioRelations = await pool.query<{ source_id: string; relation_type: string }>(
      `SELECT source_id, relation_type FROM ie_aggregate_relations
        WHERE organization_id=$1 AND target_type='portfolio_scenario_version'
        ORDER BY source_id`,
      [organizationId]
    );
    expect(portfolioRelations.rows.map((r) => r.source_id).sort()).toEqual(
      [planAId, planBId].sort()
    );
    for (const row of portfolioRelations.rows) {
      expect(row.relation_type).toBe('PLAN_SCENARIO_PORTFOLIO');
    }

    const memberRelations = await pool.query<{ n: string }>(
      `SELECT count(*)::text n FROM ie_aggregate_relations
        WHERE organization_id=$1 AND relation_type='PLAN_SCENARIO_MEMBER'`,
      [organizationId]
    );
    expect(memberRelations.rows[0].n).toBe('4');
  });

  it('powtorzony CREATE z tym samym clientRequestId nie duplikuje relacji', async () => {
    const uow = new PostgresMaterialCommandUnitOfWork(pool);
    const planId = `plan-idem-${randomUUID()}`;
    const clientRequestId = randomUUID();
    const first = await mutatePlanScenario(uow, command(planId, clientRequestId));
    const replay = await mutatePlanScenario(uow, command(planId, clientRequestId));

    expect(replay.response.scenarioVersion).toBe(first.response.scenarioVersion);
    const rows = await pool.query<{ n: string }>(
      `SELECT count(*)::text n FROM ie_aggregate_relations
        WHERE organization_id=$1 AND source_id=$2`,
      [organizationId, planId]
    );
    expect(rows.rows[0].n).toBe('3');
  });
});
