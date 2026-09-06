/**
 * Ile ZAPYTAN kosztuje lista realizacji (`GET /runtime-v1/execution-cases`).
 *
 * ZMIERZONY DEFEKT (1.12-R2, 2026-09-06):
 * `initiativesExecutionRuntime.routes.ts` mial po `listExecutionCases()`
 * SEKWENCYJNA petle `for (...) { await findById(); await authorize(); }` —
 * 1 + N zapytan jedno po drugim. To jest pierwsza z trzech warstw defektu
 * „Zasoby wisza": zakladka Zasoby zaczyna liczyc swoj limit 12 s na realizacje
 * DOPIERO po tej liscie (`ExecutionResourcesSurface.tsx` -> `executionCaseFanOut.ts`).
 *
 * KONTRAKT: koszt listy NIE ROSNIE z liczba realizacji. Przy 6 realizacjach
 * odczyt ma zmiescic sie w <= 3 zapytaniach (1 lista + 1 zbiorczy odczyt
 * inicjatyw; trzecie miejsce to zapas na przyszly odczyt zbiorczy, nie na petle).
 *
 * DOWOD MUTACYJNY: przywrocenie petli `for (const item of cases) { await
 * deps.reader.findById(...) }` -> 7 zapytan -> ten test na czerwono.
 *
 * Uruchomienie: wymaga `DATABASE_URL` wskazujacego PUSTA baze testowa
 * (test tworzy wlasny schemat migracja 932 i sprzata po sobie). Bez
 * `DATABASE_URL` zestaw jest pomijany.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PostgresInitiativeReader } from '../../../server/src/domain/initiatives-execution/postgresInitiativeReader';
import { createInitiativesExecutionRuntimeRouter } from '../../../server/src/routes/pmo/initiativesExecutionRuntime.routes';

const databaseUrl = process.env.DATABASE_URL?.trim();
const describeRealDb = databaseUrl ? describe : describe.skip;

const ORG = 'r2-query-count-org';
const PROJECT = 'r2-query-count-project';
const CASE_COUNT = 6;

describeRealDb('GET /runtime-v1/execution-cases — koszt w zapytaniach', () => {
  const pool = new Pool({ connectionString: databaseUrl, max: 5 });
  let queries: string[] = [];
  // Licznik siedzi MIEDZY czytnikiem a pula, wiec liczy dokladnie te zapytania,
  // ktore wysyla kod trasy — nie te, ktorymi test przygotowuje dane.
  const countingPool = {
    query: (...args: unknown[]) => {
      queries.push(typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0]));
      return (pool.query as (...a: unknown[]) => Promise<unknown>)(...args);
    },
  } as unknown as Pool;

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).user = { id: 'r2-user', organizationId: ORG, role: 'USER' };
    next();
  });
  app.use(
    '/runtime-v1',
    createInitiativesExecutionRuntimeRouter({
      unitOfWork: {} as any,
      reader: new PostgresInitiativeReader(countingPool),
      authorize: async (_actor, projectId) => projectId === PROJECT,
      resolvePolicy: async () =>
        ({
          policyId: 'standard',
          version: 1,
          baseline: 'STANDARD',
          strictness: 1,
          source: 'PROJECT',
          config: {},
        }) as any,
    })
  );

  beforeAll(async () => {
    const migration = await readFile(
      path.resolve('server/migrations', '932_initiatives_execution_material_commands.sql'),
      'utf8'
    );
    await pool.query(migration);
  });

  afterAll(async () => {
    await pool.query(`DELETE FROM ie_aggregate_state WHERE organization_id = $1`, [ORG]);
    await pool.end();
  });

  beforeEach(async () => {
    await pool.query(`DELETE FROM ie_aggregate_state WHERE organization_id = $1`, [ORG]);
    for (let i = 0; i < CASE_COUNT; i += 1) {
      await pool.query(
        `INSERT INTO ie_aggregate_state (organization_id, aggregate_type, aggregate_id, version, payload_json)
         VALUES ($1,'initiative',$2,1,$3::jsonb)`,
        [ORG, `init-${i}`, JSON.stringify({ id: `init-${i}`, projectId: PROJECT, title: `Inicjatywa ${i}` })]
      );
      await pool.query(
        `INSERT INTO ie_aggregate_state (organization_id, aggregate_type, aggregate_id, version, payload_json)
         VALUES ($1,'execution_case',$2,1,$3::jsonb)`,
        [
          ORG,
          `case-${i}`,
          JSON.stringify({
            initiativeId: `init-${i}`,
            state: 'ACTIVE',
            executionManagerId: 'r2-user',
            handoffPackageId: `handoff-${i}`,
          }),
        ]
      );
    }
    queries = [];
  });

  it(`zwraca ${CASE_COUNT} realizacji w co najwyzej 3 zapytaniach (nie 1+N)`, async () => {
    const response = await request(app).get('/runtime-v1/execution-cases').expect(200);

    expect(response.body.cases).toHaveLength(CASE_COUNT);
    expect(response.body.cases[0].initiativeTitle).toMatch(/^Inicjatywa /);
    expect(queries.length).toBeLessThanOrEqual(3);
  });

  it('koszt NIE rosnie, gdy realizacji jest dwa razy wiecej', async () => {
    for (let i = CASE_COUNT; i < CASE_COUNT * 2; i += 1) {
      await pool.query(
        `INSERT INTO ie_aggregate_state (organization_id, aggregate_type, aggregate_id, version, payload_json)
         VALUES ($1,'initiative',$2,1,$3::jsonb)`,
        [ORG, `init-${i}`, JSON.stringify({ id: `init-${i}`, projectId: PROJECT, title: `Inicjatywa ${i}` })]
      );
      await pool.query(
        `INSERT INTO ie_aggregate_state (organization_id, aggregate_type, aggregate_id, version, payload_json)
         VALUES ($1,'execution_case',$2,1,$3::jsonb)`,
        [
          ORG,
          `case-${i}`,
          JSON.stringify({
            initiativeId: `init-${i}`,
            state: 'ACTIVE',
            executionManagerId: 'r2-user',
            handoffPackageId: `handoff-${i}`,
          }),
        ]
      );
    }
    queries = [];

    const response = await request(app).get('/runtime-v1/execution-cases').expect(200);

    expect(response.body.cases).toHaveLength(CASE_COUNT * 2);
    expect(queries.length).toBeLessThanOrEqual(3);
  });

  it('nie pokazuje realizacji z projektu, do ktorego brak uprawnien', async () => {
    await pool.query(
      `UPDATE ie_aggregate_state SET payload_json = jsonb_set(payload_json,'{projectId}','"obcy-projekt"')
        WHERE organization_id=$1 AND aggregate_type='initiative' AND aggregate_id='init-0'`,
      [ORG]
    );

    const response = await request(app).get('/runtime-v1/execution-cases').expect(200);

    expect(response.body.cases).toHaveLength(CASE_COUNT - 1);
    expect(response.body.cases.map((row: any) => row.executionCaseId)).not.toContain('case-0');
  });
});
