/** @vitest-environment node */
/**
 * E2b — BEZPIECZENSTWO: czlonek organizacji edytuje CUDZA INICJATYWE.
 *
 * Pomiar przed naprawa (2026-09-10, kopia `consultify_kopia_e2b`, konta jednej
 * organizacji DBR77): `PUT /api/initiatives/<cudza>` = HTTP 200 i NADPISANY
 * tytul w bazie — identycznie przy `CAPABILITY_ENFORCE=shadow` i `=enforce`.
 * Przyczyna: `requireGovernedInitiativeCapability` wymuszal `shadow: false`, a
 * sciezka bez shadow wola `next()` bez zadnego sprawdzenia, dopoki globalne
 * `EFFECTIVE_ACCESS_ENFORCE`/`EFFECTIVE_ACCESS_SHADOW` sa nieustawione — a nie
 * ma ich ani w `server.env`, ani na staging/demo/produkcji. Bramka byla wiec
 * CALKOWICIE BEZCZYNNA, mimo komentarza w kodzie glszacego cos odwrotnego.
 *
 * PULAPKA (CLAUDE.md): atrapa bazy `server/src/database/Database.ts:686`
 * zwraca `changes: 1` dla KAZDEGO UPDATE niezaleznie od WHERE. Dlatego ten
 * plik dziala WYLACZNIE na realnym Postgresie (`RUN_DB_TESTS=1 MOCK_DB=false
 * DB_TYPE=postgres DATABASE_URL=postgres://...`); bez tego `describe.skipIf`
 * pomija go zamiast klamac na zielono. Kazdy przypadek odmowy sprawdza STAN
 * BAZY, nie sam kod HTTP.
 *
 * MUTACJE (maja zaswiecic na czerwono):
 *  M1 — usun `ownerPredicate` z bramek w `initiatives.routes.ts` (zostawiajac
 *       `objectScoped: true`) => odmowa dla WSZYSTKICH, w tym dla wlasciciela
 *       i tworcy (fail-closed), wiec testy „200" czerwone.
 *  M2 — usun `enforceMode: 'enforce'` z tych bramek => wszystkie testy „403"
 *       czerwone (powrot do bezczynnej bramki).
 */
import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import jwt from 'jsonwebtoken';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import config from '../../server/src/config/Config.js';
import initiativesRouter from '../../server/src/routes/pmo/initiatives.routes.js';

const databaseUrl = process.env.DATABASE_URL || '';
const realDb =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  databaseUrl.startsWith('postgres');

describe.skipIf(!realDb).sequential('E2b — zakres obiektowy edycji inicjatyw', () => {
  const przyrostek = randomUUID().slice(0, 8);
  const org = `e2b-org-${przyrostek}`;
  const projekt = `e2b-proj-${przyrostek}`;
  const czlonekA = `e2b-member-a-${przyrostek}`;
  const czlonekB = `e2b-member-b-${przyrostek}`;
  const wlascicielIni = `e2b-ini-owner-${przyrostek}`;
  const administrator = `e2b-admin-${przyrostek}`;
  const inicjatywaA = `e2b-ini-a-${przyrostek}`;
  const inicjatywaB = `e2b-ini-b-${przyrostek}`;
  const inicjatywaC = `e2b-ini-c-${przyrostek}`;
  const runtimeCudza = `e2b-rt-b-${przyrostek}`;
  const runtimeWlasna = `e2b-rt-o-${przyrostek}`;

  let pool: Pool;
  let app: Express;

  const token = (id: string, role: string) =>
    jwt.sign(
      {
        id,
        email: `${id}@test.invalid`,
        organizationId: org,
        organization_id: org,
        role,
      },
      config.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '10m' }
    );

  const tytul = async (id: string): Promise<string | null> => {
    const { rows } = await pool.query('SELECT title FROM initiatives WHERE id = $1', [id]);
    return rows[0]?.title ?? null;
  };
  const status = async (id: string): Promise<string | null> => {
    const { rows } = await pool.query('SELECT status FROM initiatives WHERE id = $1', [id]);
    return rows[0]?.status ?? null;
  };

  beforeAll(async () => {
    if (!realDb) throw new Error('wymagany realny PostgreSQL');
    process.env.DB_TYPE = 'postgres';
    pool = new Pool({ connectionString: databaseUrl });

    await pool.query('INSERT INTO organizations(id,name) VALUES($1,$2)', [org, 'E2b ownership']);
    await pool.query('INSERT INTO projects(id,organization_id,name) VALUES($1,$2,$3)', [
      projekt,
      org,
      'E2b ownership project',
    ]);

    for (const [id, rola] of [
      [czlonekA, 'MEMBER'],
      [czlonekB, 'MEMBER'],
      [wlascicielIni, 'MEMBER'],
      [administrator, 'ADMIN'],
    ] as const) {
      await pool.query(
        `INSERT INTO users(id,organization_id,email,password,role,status)
         VALUES($1,$2,$3,'unused',$4,'active')`,
        [id, org, `${id}@test.invalid`, rola]
      );
      await pool.query(
        `INSERT INTO organization_members(id,organization_id,user_id,role,status)
         VALUES($1,$2,$3,$4,'ACTIVE')`,
        [randomUUID(), org, id, rola]
      );
    }

    // Rola projektowa INITIATIVE_OWNER trzyma `initiative.update.own` — to
    // wlasnie ona przed naprawa przechodzila bramke na KAZDEJ inicjatywie
    // projektu (sufiks wlasnosci bez pytania o obiekt).
    await pool.query(
      `INSERT INTO project_members(id,project_id,user_id,project_role,normalized_project_role)
       VALUES($1,$2,$3,'INITIATIVE_OWNER','INITIATIVE_OWNER')`,
      [randomUUID(), projekt, wlascicielIni]
    );

    for (const [id, tworca, wlasciciel, nazwa] of [
      [inicjatywaA, czlonekA, czlonekA, 'inicjatywa czlonka A'],
      [inicjatywaB, czlonekB, czlonekB, 'inicjatywa czlonka B'],
      // C: tworca to B, ale wlascicielem wykonawczym jest ktos inny — sprawdza,
      // ze wlasciciel NIE bedacy tworca tez przechodzi.
      [inicjatywaC, czlonekB, wlascicielIni, 'inicjatywa wlasciciela'],
    ] as const) {
      await pool.query(
        `INSERT INTO initiatives(id,organization_id,project_id,name,title,status,created_by,owner_execution_id)
         VALUES($1,$2,$3,$4,$4,'DRAFT',$5,$6)`,
        [id, org, projekt, nazwa, tworca, wlasciciel]
      );
    }

    // runtime-v1 czyta inicjatywy z `ie_aggregate_state` (inny agregat niz
    // tabela `initiatives`); wlasnosc niesie pole `initiativeOwnerId`.
    for (const [id, wlasciciel, nazwa] of [
      [runtimeCudza, czlonekB, 'runtime cudza (B)'],
      [runtimeWlasna, wlascicielIni, 'runtime wlasna wlasciciela'],
    ] as const) {
      await pool.query(
        `INSERT INTO ie_aggregate_state(organization_id,aggregate_type,aggregate_id,version,payload_json)
         VALUES($1,'initiative',$2,1,$3::jsonb)`,
        [
          org,
          id,
          JSON.stringify({
            initiativeId: id,
            projectId: projekt,
            title: nazwa,
            problem: 'problem e2b',
            initiativeOwnerId: wlasciciel,
            lifecycleState: 'REGISTERED',
            updatedAt: new Date().toISOString(),
          }),
        ]
      );
    }

    app = express();
    app.use(express.json());
    app.use('/api/initiatives', initiativesRouter);
  }, 60_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query('DELETE FROM ie_aggregate_state WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM initiatives WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM project_members WHERE project_id = $1', [projekt]);
    await pool.query('DELETE FROM organization_members WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM users WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM project_role_templates WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM projects WHERE organization_id = $1', [org]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [org]);
    await pool.end();
  }, 60_000);

  it('MEMBER edytuje WLASNA inicjatywe (jest jej tworca) -> 200 i tytul zmieniony w bazie', async () => {
    const odp = await request(app)
      .put(`/api/initiatives/${inicjatywaA}`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`)
      .send({ title: 'wlasna po edycji' });

    expect(odp.status).toBe(200);
    await expect(tytul(inicjatywaA)).resolves.toBe('wlasna po edycji');
  }, 30_000);

  it('MEMBER edytuje CUDZA inicjatywe (PUT) -> 403 z kodem zakresu obiektowego, baza nietknieta', async () => {
    const przed = await tytul(inicjatywaB);

    const odp = await request(app)
      .put(`/api/initiatives/${inicjatywaB}`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`)
      .send({ title: 'WLAM' });

    expect(odp.status).toBe(403);
    expect(odp.body.code).toBe('CAPABILITY_OBJECT_OWNERSHIP_REQUIRED');
    expect(odp.body.required).toBe('initiative.update');
    // Klucz: stan BAZY, nie sam kod HTTP.
    await expect(tytul(inicjatywaB)).resolves.toBe(przed);
  }, 30_000);

  it('MEMBER edytuje CUDZA inicjatywe (PATCH alias) -> 403, baza nietknieta', async () => {
    const przed = await tytul(inicjatywaB);

    const odp = await request(app)
      .patch(`/api/initiatives/${inicjatywaB}`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`)
      .send({ title: 'WLAM PATCH' });

    expect(odp.status).toBe(403);
    expect(odp.body.code).toBe('CAPABILITY_OBJECT_OWNERSHIP_REQUIRED');
    await expect(tytul(inicjatywaB)).resolves.toBe(przed);
  }, 30_000);

  it('WLASCICIEL inicjatywy (nie tworca) edytuje ja -> 200 i tytul zmieniony w bazie', async () => {
    const odp = await request(app)
      .put(`/api/initiatives/${inicjatywaC}`)
      .set('Authorization', `Bearer ${token(wlascicielIni, 'MEMBER')}`)
      .send({ title: 'wlasciciel po edycji' });

    expect(odp.status).toBe(200);
    await expect(tytul(inicjatywaC)).resolves.toBe('wlasciciel po edycji');
  }, 30_000);

  it('WLASCICIEL JEDNEJ inicjatywy nie edytuje CUDZEJ w tym samym projekcie -> 403', async () => {
    const przed = await tytul(inicjatywaB);

    const odp = await request(app)
      .put(`/api/initiatives/${inicjatywaB}`)
      .set('Authorization', `Bearer ${token(wlascicielIni, 'MEMBER')}`)
      .send({ title: 'WLAM WLASCICIELA' });

    expect(odp.status).toBe(403);
    expect(odp.body.code).toBe('CAPABILITY_OBJECT_OWNERSHIP_REQUIRED');
    await expect(tytul(inicjatywaB)).resolves.toBe(przed);
  }, 30_000);

  it('ADMIN edytuje CUDZA inicjatywe -> 200 (nie zablokowalismy administracji)', async () => {
    const odp = await request(app)
      .put(`/api/initiatives/${inicjatywaB}`)
      .set('Authorization', `Bearer ${token(administrator, 'ADMIN')}`)
      .send({ title: 'admin po edycji' });

    expect(odp.status).toBe(200);
    await expect(tytul(inicjatywaB)).resolves.toBe('admin po edycji');
  }, 30_000);

  it('MEMBER zmienia status CUDZEJ inicjatywy -> 403, status w bazie bez zmian', async () => {
    const przed = await status(inicjatywaB);

    const odp = await request(app)
      .patch(`/api/initiatives/${inicjatywaB}/status`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`)
      .send({ status: 'PENDING_APPROVAL' });

    expect(odp.status).toBe(403);
    expect(odp.body.code).toBe('CAPABILITY_OBJECT_OWNERSHIP_REQUIRED');
    expect(odp.body.required).toBe('initiative.status.change');
    await expect(status(inicjatywaB)).resolves.toBe(przed);
  }, 30_000);

  it('MEMBER usuwa CUDZA inicjatywe -> 403, wiersz nadal w bazie', async () => {
    const odp = await request(app)
      .delete(`/api/initiatives/${inicjatywaB}`)
      .set('Authorization', `Bearer ${token(czlonekA, 'MEMBER')}`);

    expect(odp.status).toBe(403);
    expect(String(odp.body.code || '')).toMatch(/^CAPABILITY_/);
    await expect(tytul(inicjatywaB)).resolves.not.toBeNull();
  }, 30_000);

  it('runtime-v1: WLASCICIEL jednej inicjatywy zmienia metadane CUDZEJ -> 403', async () => {
    const odp = await request(app)
      .patch(`/api/initiatives/runtime-v1/initiatives/${runtimeCudza}/metadata`)
      .set('Authorization', `Bearer ${token(wlascicielIni, 'MEMBER')}`)
      .send({ expectedVersion: 1, clientRequestId: `e2b-wlam-${przyrostek}`, title: 'WLAM META' });

    expect(odp.status).toBe(403);
    expect(odp.body?.error?.code).toBe('CAPABILITY_REQUIRED');
    const { rows } = await pool.query(
      `SELECT payload_json->>'title' AS title FROM ie_aggregate_state WHERE aggregate_id = $1`,
      [runtimeCudza]
    );
    expect(rows[0]?.title).toBe('runtime cudza (B)');
  }, 30_000);

  it('runtime-v1: ten sam wlasciciel na SWOJEJ inicjatywie przechodzi autoryzacje', async () => {
    const odp = await request(app)
      .patch(`/api/initiatives/runtime-v1/initiatives/${runtimeWlasna}/metadata`)
      .set('Authorization', `Bearer ${token(wlascicielIni, 'MEMBER')}`)
      .send({ expectedVersion: 1, clientRequestId: `e2b-own-${przyrostek}`, title: 'META WLASNA' });

    // Kontrola przeciwstawna do poprzedniego przypadku: interesuje nas, ze
    // bramka NIE odmawia. Sam zapis idzie dalej przez silnik runtime i moze
    // paść z innego powodu (na czystej kopii bazy brakuje wiersza bazowego
    // polityki `ie_governance_policies` PRODUCT/DEFAULT — `resolvePolicy`
    // zwraca wtedy 500 juz ZA bramka), dlatego asercja mowi wprost: nie 403.
    expect(odp.status).not.toBe(403);
  }, 30_000);
});
