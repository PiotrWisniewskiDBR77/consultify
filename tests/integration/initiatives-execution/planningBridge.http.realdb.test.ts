/** @vitest-environment node */

/**
 * P15-K2 (DEC-421, decyzja D1') — MOST inicjatyw modułu na trasie runtime.
 *
 * POMIAR 07.09 (evidence/p15-k2/przed.json, własne API :4153 na kopii bazy):
 * moduł ma 72 wiersze w `initiatives`, a plan widział wyłącznie 5 agregatów
 * `ie_aggregate_state/initiative` z seedu P11. CREATE planu z oknem na inicjatywę
 * modułu spoza seedu = HTTP 400 `PLAN_MEMBER_NOT_APPROVED`; istniejący most
 * `adoptions/accepted-classic` = HTTP 422 `INITIATIVE_OWNER_INELIGIBLE`
 * (wymaga wiersza w `project_members`, których w bazie jest 0).
 *
 * MUTACJE (dowód RED, wykonane ręcznie i cofnięte — patrz evidence/p15-k2/mutacje.txt):
 *  (a) `registerModuleInitiativeForPlanning.ts` → zdejmij warunek statusu w
 *      `assertPlannable` (zwróć `{ conditional: false }` od razu): DRAFT przechodzi,
 *      test „odmawia inicjatywie w statusie Szkic" pada;
 *  (b) `initiativesExecutionRuntime.routes.ts` → nie wołaj `ensureWorkingPortfolio`
 *      (`const portfolioRef = null`): CREATE bez portfela wraca 404, testy portfela padają.
 */

import { randomUUID } from 'node:crypto';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { PostgresMaterialCommandUnitOfWork } from '../../../server/src/domain/initiatives-execution/postgresMaterialCommandUnitOfWork';
import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';
import { assertRealPostgresTestEnvironment } from '../_helpers/assertRealPostgres';

const NO_RETRY = { retry: 0 } as const;

describe('P15-K2 — most inicjatyw modułu i portfel roboczy (realny PostgreSQL)', NO_RETRY, () => {
  const organizationId = randomUUID();
  const actorId = randomUUID();
  const approvedIds = Array.from({ length: 5 }, () => `k2-approved-${randomUUID()}`);
  const draftId = `k2-draft-${randomUUID()}`;
  const pendingId = `k2-pending-${randomUUID()}`;
  const workingPortfolioId = `portfolio-${organizationId}-roboczy`;
  let pool: Pool;
  let app: express.Express;

  const insertInitiative = async (id: string, name: string, status: string, start: string) =>
    pool.query(
      `INSERT INTO initiatives(id, organization_id, name, status, planned_start_date, planned_end_date, required_capacity_fte)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, organizationId, name, status, start, '2026-11-30T00:00:00.000Z', 0]
    );

  const periods = Array.from({ length: 12 }, (_, index) => {
    const start = new Date(Date.UTC(2026, 8, 7));
    start.setUTCDate(start.getUTCDate() + index * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 7);
    return {
      periodId: `Tydzień ${index + 1}`,
      start: start.toISOString(),
      end: end.toISOString(),
    };
  });

  const planBody = (
    scenarioId: string,
    windows: Array<{ initiativeId: string; initiativeVersion: number }>
  ) => ({
    expectedVersion: 0,
    clientRequestId: `create-${scenarioId}`,
    operation: 'CREATE' as const,
    portfolio: 'auto' as const,
    scenario: {
      scenarioId,
      name: `Plan ${scenarioId}`,
      scenarioVersion: 0,
      status: 'DRAFT' as const,
      portfolioScenarioId: '',
      portfolioScenarioVersion: 0,
      windowUnit: 'WEEK',
      timezone: 'Europe/Warsaw',
      periods,
      windows: windows.map((window) => ({
        ...window,
        earliest: periods[0].start,
        target: periods[0].start,
        latest: periods[periods.length - 1].end,
        confidence: 'MEDIUM' as const,
        rationale: 'Okno z wyboru PMO w generatorze planu.',
        dependencySnapshot: [],
        constraintSnapshot: [],
      })),
      assumptions: [],
      createdBy: '',
      updatedBy: '',
      publishedBy: null,
      publishedAt: null,
    },
  });

  const register = (initiativeId: string, body: Record<string, unknown>) =>
    request(app)
      .post(`/runtime-v1/planning/initiatives/${encodeURIComponent(initiativeId)}/register`)
      .send(body);

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: String(process.env.DATABASE_URL), max: 2 });
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [
      organizationId,
      'P15-K2 fixture',
    ]);
    for (const [index, id] of approvedIds.entries())
      await insertInitiative(id, `Zatwierdzona ${index + 1}`, 'APPROVED', '2026-09-21T00:00:00.000Z');
    await insertInitiative(draftId, 'Szkic', 'DRAFT', '2026-09-21T00:00:00.000Z');
    await insertInitiative(pendingId, 'Do zatwierdzenia', 'PENDING_APPROVAL', '2026-09-21T00:00:00.000Z');

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as unknown as { user: unknown }).user = {
        id: actorId,
        organizationId,
        role: 'USER',
      };
      next();
    });
    app.use(
      '/runtime-v1',
      createInitiativesExecutionRuntimeRouter({
        unitOfWork: new PostgresMaterialCommandUnitOfWork(pool),
        reader: new PostgresInitiativeReader(pool),
        authorize: async (actor) => actor.organizationId === organizationId,
        resolvePolicy: async () => ({
          policyId: 'p15-k2-http',
          version: 1,
          baseline: 'STANDARD' as const,
          strictness: 1,
          source: 'ORGANIZATION' as const,
          config: { selfApproval: true, enforceGateGovernance: false, gates: {}, roleBindings: [] },
        }),
      })
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
      'initiatives',
    ])
      await pool.query(`DELETE FROM ${table} WHERE organization_id=$1`, [organizationId]);
    await pool.query('DELETE FROM organizations WHERE id=$1', [organizationId]);
    await pool.end();
  });

  it('przyjmuje zatwierdzoną inicjatywę modułu do planowania i nie duplikuje jej przy powtórce', async () => {
    const first = await register(approvedIds[0], { clientRequestId: randomUUID() });
    expect(first.status).toBe(201);
    expect(first.body.response.lifecycleState).toBe('APPROVED_BACKLOG');
    expect(first.body.response.planning.source).toBe('MODULE_INITIATIVE');
    expect(first.body.response.conditional).toBe(false);

    // Idempotencja: INNY clientRequestId, te same dane modułu — bez podbicia wersji.
    const second = await register(approvedIds[0], { clientRequestId: randomUUID() });
    expect(second.status).toBe(200);
    expect(second.body.aggregateVersion).toBe(first.body.aggregateVersion);

    const stored = await pool.query(
      `SELECT count(*)::int AS ile, max(version) AS wersja FROM ie_aggregate_state
        WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id=$2`,
      [organizationId, approvedIds[0]]
    );
    expect(stored.rows[0].ile).toBe(1);
    expect(Number(stored.rows[0].wersja)).toBe(first.body.aggregateVersion);
  });

  it('odmawia inicjatywie w statusie Szkic regułą INITIATIVE_NOT_PLANNABLE, nie błędem 500', async () => {
    const response = await register(draftId, { clientRequestId: randomUUID() });
    expect(response.status).toBe(400);
    expect(response.body.rule).toBe('INITIATIVE_NOT_PLANNABLE');
    expect(response.body.error.rule).toBe('INITIATIVE_NOT_PLANNABLE');
  });

  it('bierze inicjatywę „do zatwierdzenia" wyłącznie jako warunkową i tylko za zgodą', async () => {
    const withoutConsent = await register(pendingId, { clientRequestId: randomUUID() });
    expect(withoutConsent.status).toBe(400);
    expect(withoutConsent.body.rule).toBe('INITIATIVE_NOT_PLANNABLE');

    const withConsent = await register(pendingId, {
      clientRequestId: randomUUID(),
      allowConditional: true,
    });
    expect(withConsent.status).toBe(201);
    expect(withConsent.body.response.conditional).toBe(true);
  });

  it('lista kwalifikujących się pokazuje zatwierdzone i do zatwierdzenia, bez szkicu', async () => {
    const response = await request(app).get('/runtime-v1/planning/plannable-initiatives');
    expect(response.status).toBe(200);
    const ids = response.body.initiatives.map((item: { id: string }) => item.id);
    expect(ids).toEqual(expect.arrayContaining([...approvedIds, pendingId]));
    expect(ids).not.toContain(draftId);
  });

  it('zakłada plan z 5 inicjatyw modułu BEZ portfela — portfel roboczy powstaje i jest opublikowany', async () => {
    const versions = new Map<string, number>();
    for (const initiativeId of approvedIds) {
      const registered = await register(initiativeId, { clientRequestId: randomUUID() });
      expect([200, 201]).toContain(registered.status);
      versions.set(initiativeId, registered.body.aggregateVersion);
    }
    const windows = approvedIds.map((initiativeId) => ({
      initiativeId,
      initiativeVersion: versions.get(initiativeId) ?? 1,
    }));
    const planId = `plan-k2-${randomUUID()}`;
    const created = await request(app)
      .post(`/runtime-v1/plan-scenarios/${planId}`)
      .send(planBody(planId, windows));
    expect(created.status).toBe(201);
    expect(created.body.response.portfolioScenarioId).toBe(workingPortfolioId);
    expect(created.body.response.windows).toHaveLength(5);

    const portfolio = await request(app).get(
      `/runtime-v1/portfolio-scenarios/${encodeURIComponent(workingPortfolioId)}`
    );
    expect(portfolio.status).toBe(200);
    expect(portfolio.body.scenario.status).toBe('PUBLISHED');
    expect(portfolio.body.scenario.memberships).toHaveLength(5);
    expect(portfolio.body.scenario.scenarioVersion).toBe(
      created.body.response.portfolioScenarioVersion
    );
    expect(String(portfolio.body.scenario.name)).toContain('Portfel roboczy');

    const register_ = await request(app).get('/runtime-v1/plan-scenarios');
    const row = register_.body.scenarios.find((item: { id: string }) => item.id === planId);
    expect(row.initiativeCount).toBe(5);
    expect(String(row.portfolioRef.name)).toContain('Portfel roboczy');

    // Para negatywna K1: DRUGI plan z tych samych inicjatyw = 201, nie 500.
    const secondPlanId = `plan-k2-${randomUUID()}`;
    const secondPlan = await request(app)
      .post(`/runtime-v1/plan-scenarios/${secondPlanId}`)
      .send(planBody(secondPlanId, windows));
    expect(secondPlan.status).toBe(201);
    expect(secondPlan.body.response.portfolioScenarioId).toBe(workingPortfolioId);
  });
});
