/** @vitest-environment node */
/**
 * [ODMROZENIE 06_EXECUTION DEC-453] Lista realizacji i pojedyncza realizacja
 * MUSZA odpowiadac na to samo pytanie o widocznosc.
 *
 * POMIAR PRZED (2026-09-08, kopia bazy stagingu, organizacja DBR77):
 * `GET /api/initiatives/runtime-v1/execution-cases` zwracal 6 realizacji, ale
 * `GET …/execution-cases/a3e05d4a-…--acceptance--execution-case/work` NIE
 * ODPOWIADAL w ogole (`curl -m 45` → `http=000`). Po zalozeniu straznika cyklu
 * ta sama realizacja odpowiadala 404 w 0,03 s — i wtedy widac bylo drugi defekt
 * w calej okazalosci: lista wpuszczala realizacje, ktorej `canViewAggregate`
 * i tak nie pozwala otworzyc, bo `authorizeProjects` wymaga
 * `projectIds.length > 0`. Na ekranie: baner „Nie udalo sie pobrac zasobow
 * z 1 realizacji" przy KAZDYM wejsciu w Prace i Zasoby.
 *
 * PRZYCZYNA: lista pytala `authorize()` o `projectId` rowny `undefined`
 * (inicjatywa akceptacyjna DBR77 nie ma `projectId`) i dostawala zgode.
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Client } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';
import config from '../../config/Config.js';
import { ApiGateway } from '../../Gateway.js';

const NO_RETRY = { retry: 0 } as const;

describe('realizacja bez rodowodu projektu nie wchodzi na liste', NO_RETRY, () => {
  const organizationId = randomUUID();
  const userId = randomUUID();
  const projectId = randomUUID();
  const zdrowaInicjatywa = randomUUID();
  const zdrowaRealizacja = randomUUID();
  // Ksztalt 1:1 z DBR77: `initiativeId` wskazuje sam siebie, `projectId` brak.
  const sierotaInicjatywa = `${organizationId}--acceptance--initiative`;
  const sierotaRealizacja = `${organizationId}--acceptance--execution-case`;
  let app: Express;
  let sql: Client;
  let authorization: string;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();
    await sql.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [
      organizationId,
      'Rodowod realizacji',
    ]);
    await sql.query(
      `INSERT INTO users(id,organization_id,email,password,role,status)
       VALUES($1,$2,$3,'local-only','OWNER','active')`,
      [userId, organizationId, `${userId}@test.invalid`]
    );
    await sql.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status)
       VALUES($1,$2,$3,'OWNER','ACTIVE')`,
      [randomUUID(), organizationId, userId]
    );
    await sql.query(`INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$3)`, [
      projectId,
      organizationId,
      'Projekt rodowodu',
    ]);
    await sql.query(
      `INSERT INTO ie_aggregate_state
         (organization_id,aggregate_type,aggregate_id,version,payload_json)
       VALUES
         ($1,'initiative',$2,1,$3::jsonb),
         ($1,'execution_case',$4,1,$5::jsonb),
         ($1,'initiative',$6,1,$7::jsonb),
         ($1,'execution_case',$8,1,$9::jsonb)`,
      [
        organizationId,
        zdrowaInicjatywa,
        JSON.stringify({
          initiativeId: zdrowaInicjatywa,
          title: 'Realizacja z projektem',
          projectId,
          initiativeOwnerId: userId,
          lifecycleState: 'IN_EXECUTION',
        }),
        zdrowaRealizacja,
        JSON.stringify({
          executionCaseId: zdrowaRealizacja,
          initiativeId: zdrowaInicjatywa,
          state: 'ACTIVE',
          executionManagerId: userId,
          handoffPackageId: 'handoff-zdrowy',
        }),
        sierotaInicjatywa,
        JSON.stringify({
          initiativeId: sierotaInicjatywa,
          title: 'Poprawa realizacji korzyści programu',
          initiativeOwnerId: userId,
          lifecycleState: 'EXECUTING',
        }),
        sierotaRealizacja,
        JSON.stringify({
          executionCaseId: sierotaRealizacja,
          initiativeId: sierotaInicjatywa,
          state: 'ACTIVE',
          executionManagerId: userId,
          handoffPackageId: 'handoff-sierota',
        }),
      ]
    );
    authorization = `Bearer ${jwt.sign(
      { id: userId, userId, organizationId, organization_id: organizationId, role: 'OWNER' },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    )}`;
    app = express();
    app.use(express.json());
    ApiGateway.getInstance().initializeRoutes(app);
  }, 30_000);

  afterAll(async () => {
    if (!sql) return;
    await sql.query(`DELETE FROM ie_aggregate_state WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM organization_members WHERE organization_id=$1`, [organizationId]);
    await sql.query(`DELETE FROM users WHERE id=$1`, [userId]);
    await sql.query(`DELETE FROM projects WHERE id=$1`, [projectId]);
    await sql.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await sql.end();
  });

  it('uses the explicitly selected PostgreSQL engine', () => {
    expect(process.env.DB_TYPE).toBe('postgres');
  });

  it('lista pokazuje realizacje z projektem, a pomija te bez rodowodu', async () => {
    const response = await request(app)
      .get('/api/initiatives/runtime-v1/execution-cases')
      .set('Authorization', authorization);

    expect(response.status, JSON.stringify(response.body)).toBe(200);
    const identyfikatory = response.body.cases.map(
      (item: { executionCaseId: string }) => item.executionCaseId
    );
    expect(identyfikatory).toContain(zdrowaRealizacja);
    expect(identyfikatory).not.toContain(sierotaRealizacja);
  });

  it('realizacja bez rodowodu ODPOWIADA 404, zamiast wisiec bez konca', async () => {
    const start = Date.now();
    const response = await request(app)
      .get(`/api/initiatives/runtime-v1/execution-cases/${sierotaRealizacja}/work`)
      .set('Authorization', authorization);

    expect(response.status).toBe(404);
    // Przed straznikiem cyklu to wywolanie nie konczylo sie nigdy.
    expect(Date.now() - start).toBeLessThan(5_000);
  }, 20_000);
});
