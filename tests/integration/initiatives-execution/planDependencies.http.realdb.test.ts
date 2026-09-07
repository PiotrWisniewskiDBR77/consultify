/** @vitest-environment node */

/**
 * P15-K3 (DEC-421, §4.7 D3') — „Po inicjatywie" trafia do BAZY i do solvera.
 *
 * POMIAR 07.09: `initiative_dependencies` istnieje (migracja 292) i ma 0 wierszy,
 * a runtime-v1 nie miał ANI JEDNEJ trasy, która by do niej pisała — zależność
 * dało się wpisać wyłącznie ręcznie w `dependencySnapshot` okna planu (martwy
 * edytor), więc żaden zapis nie przeżywał przeładowania.
 *
 * Ten test idzie PRZEZ TRASĘ na realnym PostgreSQL: zapis → wiersz w tabeli →
 * `dependencySnapshot` agregatu po ponownym „przyjmij do planowania" → cykl
 * odrzucony regułą 400, nie 500.
 *
 * MUTACJE (dowód RED — zakładane ręcznie i cofane, evidence/p15-k3/mutacje.txt):
 *  (c1) `postgresMaterialCommandUnitOfWork.replaceInitiativeDependencies` bez
 *       pętli INSERT → wiersz nie powstaje, testy zapisu i snapshotu padają;
 *  (c2) trasa bez `findInitiativeDependencyCycle` → koło zapisuje się cicho,
 *       test „cykl odrzucony regułą" pada.
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

describe('P15-K3 — zależności inicjatyw w planie (realny PostgreSQL)', NO_RETRY, () => {
  const organizationId = randomUUID();
  const actorId = randomUUID();
  const first = `k3-first-${randomUUID()}`;
  const second = `k3-second-${randomUUID()}`;
  const third = `k3-third-${randomUUID()}`;
  let pool: Pool;
  let app: express.Express;

  const insertInitiative = (id: string, name: string) =>
    pool.query(
      `INSERT INTO initiatives(id, organization_id, name, status, planned_start_date, planned_end_date, required_capacity_fte)
       VALUES ($1,$2,$3,'APPROVED','2026-09-21T00:00:00.000Z','2026-11-30T00:00:00.000Z',0)`,
      [id, organizationId, name]
    );

  const setDependencies = (initiativeId: string, dependsOn: string[]) =>
    request(app)
      .post(`/runtime-v1/planning/initiatives/${encodeURIComponent(initiativeId)}/dependencies`)
      .send({ clientRequestId: randomUUID(), dependsOn });

  const register = (initiativeId: string) =>
    request(app)
      .post(`/runtime-v1/planning/initiatives/${encodeURIComponent(initiativeId)}/register`)
      .send({ clientRequestId: randomUUID() });

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: String(process.env.DATABASE_URL), max: 2 });
    await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [
      organizationId,
      'P15-K3 fixture',
    ]);
    await insertInitiative(first, 'Pierwsza');
    await insertInitiative(second, 'Druga');
    await insertInitiative(third, 'Trzecia');

    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      (req as unknown as { user: unknown }).user = { id: actorId, organizationId, role: 'USER' };
      next();
    });
    app.use(
      '/runtime-v1',
      createInitiativesExecutionRuntimeRouter({
        unitOfWork: new PostgresMaterialCommandUnitOfWork(pool),
        reader: new PostgresInitiativeReader(pool),
        authorize: async (actor) => actor.organizationId === organizationId,
        resolvePolicy: async () => ({
          policyId: 'p15-k3-http',
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
      'initiative_dependencies',
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

  it('zapisuje „druga po pierwszej" do initiative_dependencies', async () => {
    const response = await setDependencies(second, [first]);
    expect(response.status).toBe(200);
    expect(response.body.dependsOn).toEqual([first]);

    const stored = await pool.query(
      `SELECT to_initiative_id, type FROM initiative_dependencies
        WHERE organization_id=$1 AND from_initiative_id=$2`,
      [organizationId, second]
    );
    expect(stored.rows).toHaveLength(1);
    expect(stored.rows[0].to_initiative_id).toBe(first);
    expect(stored.rows[0].type).toBe('FINISH_TO_START');
  });

  it('zapisana zależność trafia do dependencySnapshot agregatu planowania (czyta ją solver)', async () => {
    const registered = await register(second);
    expect([200, 201]).toContain(registered.status);
    expect(registered.body.response.dependencySnapshot).toEqual([first]);
  });

  it('kolejny zapis ZASTĘPUJE komplet, a pusta lista kasuje zależności', async () => {
    expect((await setDependencies(second, [first, third])).body.dependsOn).toEqual(
      [first, third].sort()
    );
    const cleared = await setDependencies(second, []);
    expect(cleared.status).toBe(200);
    expect(cleared.body.dependsOn).toEqual([]);
    const stored = await pool.query(
      `SELECT count(*)::int AS ile FROM initiative_dependencies
        WHERE organization_id=$1 AND from_initiative_id=$2`,
      [organizationId, second]
    );
    expect(stored.rows[0].ile).toBe(0);
  });

  it('cykl jest odrzucony regułą 400 PRZED zapisem, nie błędem 500', async () => {
    expect((await setDependencies(second, [first])).status).toBe(200);
    const cycle = await setDependencies(first, [second]);
    expect(cycle.status).toBe(400);
    expect(cycle.body.rule).toBe('INITIATIVE_DEPENDENCY_CYCLE');
    expect(cycle.body.path).toContain(first);

    const stored = await pool.query(
      `SELECT count(*)::int AS ile FROM initiative_dependencies
        WHERE organization_id=$1 AND from_initiative_id=$2`,
      [organizationId, first]
    );
    expect(stored.rows[0].ile).toBe(0);
  });

  it('DELETE zdejmuje jedną zależność i zostawia resztę', async () => {
    await setDependencies(third, [first, second]);
    const removed = await request(app).delete(
      `/runtime-v1/planning/initiatives/${encodeURIComponent(third)}/dependencies/${encodeURIComponent(first)}`
    );
    expect(removed.status).toBe(200);
    expect(removed.body.dependsOn).toEqual([second]);
  });

  it('zależność do nieistniejącej inicjatywy jest odrzucona regułą, nie zapisana', async () => {
    const response = await setDependencies(third, ['nie-ma-takiej']);
    expect(response.status).toBe(400);
    expect(response.body.rule).toBe('DEPENDENCY_INITIATIVE_NOT_FOUND');
  });
});
