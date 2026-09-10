/**
 * BLOKADA PILOTAZU — czlonkostwo TWORCY w nowo zalozonym projekcie.
 *
 * Pomiar 10.09 na zywym stagingu (baza pgvector): 23 z 25 projektow z
 * `owner_id` NIE mialy wlasciciela w `project_members`, bo kazda sciezka
 * tworzenia projektu robila `INSERT INTO projects` i nic wiecej. Skutkiem
 * byla odmowa 422 `INITIATIVE_OWNER_INELIGIBLE` przy pierwszej probie
 * utworzenia inicjatywy w swiezej organizacji.
 *
 * Ten test mierzy realny zapis na realnym Postgresie — nie na atrapie.
 * Atrapa (`Database.ts:686`) zwraca `changes:1` dla kazdego UPDATE niezaleznie
 * od WHERE, wiec zapis warunkowy zmierzony na niej nie znaczy nic.
 *
 * Uruchomienie:
 *   RUN_DB_TESTS=1 MOCK_DB=false NODE_ENV=test DB_TYPE=postgres \
 *   DATABASE_URL=... npx vitest run tests/integration/projectOwnerMembership.swiezyProjekt.realdb.test.ts
 */
import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from './_helpers/assertRealPostgres.js';

process.env.DB_TYPE = 'postgres';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';

const organizationId = randomUUID();
const wlascicielId = randomUUID();
const projektId = randomUUID();

let klient: Client;
let ensureProjectOwnerMembership: (
  projectId: string | null | undefined,
  userId: string | null | undefined,
  opts?: { projectRole?: string }
) => Promise<boolean>;

describe('czlonkostwo tworcy projektu — realny PostgreSQL', { retry: 0 }, () => {
  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    ({ ensureProjectOwnerMembership } = await import(
      '../../server/src/services/projectOwnerMembershipService.js'
    ));
    klient = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await klient.connect();
    await klient.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [
      organizationId,
      'P14 czlonkostwo tworcy',
    ]);
    await klient.query(`INSERT INTO users(id,email) VALUES($1,$2) ON CONFLICT DO NOTHING`, [
      wlascicielId,
      `${wlascicielId}@p14.test`,
    ]);
    await klient.query(
      `INSERT INTO projects(id,organization_id,name,status,owner_id) VALUES($1,$2,$3,'active',$4)`,
      [projektId, organizationId, 'Projekt zalozony przez tworce', wlascicielId]
    );
  });

  afterAll(async () => {
    if (!klient) return;
    await klient.query(`DELETE FROM project_members WHERE project_id=$1`, [projektId]);
    await klient.query(`DELETE FROM projects WHERE id=$1`, [projektId]);
    await klient.query(`DELETE FROM users WHERE id=$1`, [wlascicielId]);
    await klient.query(`DELETE FROM organizations WHERE id=$1`, [organizationId]);
    await klient.end();
  });

  it('dopisuje tworce do project_members i jest idempotentny', async () => {
    const przed = await klient.query<{ c: number }>(
      `SELECT count(*)::int AS c FROM project_members WHERE project_id=$1`,
      [projektId]
    );
    expect(przed.rows[0].c).toBe(0);

    await expect(ensureProjectOwnerMembership(projektId, wlascicielId)).resolves.toBe(true);

    const po = await klient.query<{ user_id: string; project_role: string }>(
      `SELECT user_id, project_role FROM project_members WHERE project_id=$1`,
      [projektId]
    );
    expect(po.rowCount).toBe(1);
    expect(po.rows[0].user_id).toBe(wlascicielId);
    expect(po.rows[0].project_role).toBe('PROJECT_MANAGER');

    // Drugie wywolanie nie duplikuje wiersza ani nie nadpisuje roli podniesionej reka.
    await klient.query(`UPDATE project_members SET project_role='PMO_LEAD' WHERE project_id=$1`, [
      projektId,
    ]);
    await expect(ensureProjectOwnerMembership(projektId, wlascicielId)).resolves.toBe(true);
    const poDrugim = await klient.query<{ project_role: string }>(
      `SELECT project_role FROM project_members WHERE project_id=$1`,
      [projektId]
    );
    expect(poDrugim.rowCount).toBe(1);
    expect(poDrugim.rows[0].project_role).toBe('PMO_LEAD');
  });

  it('brak identyfikatora projektu lub uzytkownika nie zapisuje niczego', async () => {
    await expect(ensureProjectOwnerMembership('', wlascicielId)).resolves.toBe(false);
    await expect(ensureProjectOwnerMembership(projektId, '')).resolves.toBe(false);
    await expect(ensureProjectOwnerMembership(null, null)).resolves.toBe(false);
  });
});
