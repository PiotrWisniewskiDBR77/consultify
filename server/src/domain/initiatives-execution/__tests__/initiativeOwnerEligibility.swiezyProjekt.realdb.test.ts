/** @vitest-environment node */

/**
 * BLOKADA PILOTAZU (pomiar 10.09 na zywym stagingu, baza pgvector):
 * w SWIEZO zalozonej organizacji `POST /api/initiatives/runtime-v1/source-proposals`
 * zwracalo 422 `INITIATIVE_OWNER_INELIGIBLE`, bo `isEligibleInitiativeOwner`
 * wymagalo wiersza w `project_members`, a ZADNA sciezka tworzenia projektu
 * (`ProjectController.createProject`, `resolveOrCreateSystemPortfolioProject`,
 * `CreateProjectHandler`) tego wiersza nie zakladala.
 *
 * POMIAR (zywy staging 10.09): 23 z 25 projektow z `owner_id` NIE mialy
 * wlasciciela w `project_members`. Dwa wyjatki to projekty Northwind — tam
 * czlonkow wstawia SEED danych pokazowych, nie kod produkcyjny. Czyli
 * „w Northwind dziala" jest wlasciwoscia fikstury, nie regula systemu.
 *
 * Ten test odtwarza dokladnie ten uklad: organizacja + wlasciciel ACTIVE +
 * projekt bez ani jednego wiersza w `project_members`.
 */
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../../tests/integration/_helpers/assertRealPostgres.js';
import { PostgresInitiativeReader } from '../postgresInitiativeReader.js';

const NO_RETRY = { retry: 0 } as const;

describe('uprawniony wlasciciel inicjatywy w swiezej organizacji — realny PostgreSQL', NO_RETRY, () => {
  const organizationId = randomUUID();
  const obcaOrganizacjaId = randomUUID();
  const wlascicielId = randomUUID();
  const czlonekId = randomUUID();
  const zawieszonyId = randomUUID();
  const obcyId = randomUUID();
  const projektId = randomUUID();
  const projektZCzlonkiemId = randomUUID();
  let pool: Pool;
  let reader: PostgresInitiativeReader;

  beforeAll(async () => {
    await assertRealPostgresTestEnvironment();
    pool = new Pool({ connectionString: String(process.env.DATABASE_URL) });
    for (const [id, nazwa] of [
      [organizationId, 'P14 swieza organizacja'],
      [obcaOrganizacjaId, 'P14 obca organizacja'],
    ] as const) {
      await pool.query(`INSERT INTO organizations(id,name,status) VALUES($1,$2,'active')`, [id, nazwa]);
    }
    for (const [id, org, rola, status] of [
      [wlascicielId, organizationId, 'OWNER', 'ACTIVE'],
      [czlonekId, organizationId, 'MEMBER', 'ACTIVE'],
      [zawieszonyId, organizationId, 'MEMBER', 'REVOKED'],
      [obcyId, obcaOrganizacjaId, 'OWNER', 'ACTIVE'],
    ] as const) {
      await pool.query(`INSERT INTO users(id,email) VALUES($1,$2) ON CONFLICT DO NOTHING`, [
        id,
        `${id}@p14.test`,
      ]);
      await pool.query(
        `INSERT INTO organization_members(organization_id,user_id,role,status) VALUES($1,$2,$3,$4)`,
        [org, id, rola, status]
      );
    }
    // Projekt zalozony tak, jak zaklada go dzis `createProject`: BEZ project_members.
    await pool.query(
      `INSERT INTO projects(id,organization_id,name,status,owner_id) VALUES($1,$2,$3,'active',$4)`,
      [projektId, organizationId, 'Swiezy projekt bez czlonkow', wlascicielId]
    );
    await pool.query(
      `INSERT INTO projects(id,organization_id,name,status,owner_id) VALUES($1,$2,$3,'active',$4)`,
      [projektZCzlonkiemId, organizationId, 'Projekt z jawnym czlonkiem', null]
    );
    await pool.query(
      `INSERT INTO project_members(project_id,user_id,project_role) VALUES($1,$2,'TASK_ASSIGNEE')`,
      [projektZCzlonkiemId, czlonekId]
    );
    reader = new PostgresInitiativeReader(pool);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM project_members WHERE project_id = ANY($1)`, [
      [projektId, projektZCzlonkiemId],
    ]);
    await pool.query(`DELETE FROM projects WHERE id = ANY($1)`, [[projektId, projektZCzlonkiemId]]);
    await pool.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
      [organizationId, obcaOrganizacjaId],
    ]);
    await pool.query(`DELETE FROM users WHERE id = ANY($1)`, [
      [wlascicielId, czlonekId, zawieszonyId, obcyId],
    ]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [
      [organizationId, obcaOrganizacjaId],
    ]);
    await pool.end();
  });

  it('wlasciciel organizacji moze byc wlascicielem inicjatywy w projekcie bez ani jednego czlonka', async () => {
    const liczbaCzlonkow = await pool.query(
      `SELECT count(*)::int AS c FROM project_members WHERE project_id=$1`,
      [projektId]
    );
    expect(liczbaCzlonkow.rows[0].c).toBe(0);
    await expect(
      reader.isEligibleInitiativeOwner(organizationId, projektId, wlascicielId)
    ).resolves.toBe(true);
  });

  it('jawny czlonek projektu pozostaje uprawniony', async () => {
    await expect(
      reader.isEligibleInitiativeOwner(organizationId, projektZCzlonkiemId, czlonekId)
    ).resolves.toBe(true);
  });

  it('zwykly czlonek organizacji NIE jest uprawniony w projekcie, do ktorego nie nalezy', async () => {
    await expect(
      reader.isEligibleInitiativeOwner(organizationId, projektId, czlonekId)
    ).resolves.toBe(false);
  });

  it('czlonek organizacji bez statusu ACTIVE nie jest uprawniony', async () => {
    await expect(
      reader.isEligibleInitiativeOwner(organizationId, projektId, zawieszonyId)
    ).resolves.toBe(false);
  });

  it('uzytkownik z innej organizacji nie jest uprawniony', async () => {
    await expect(
      reader.isEligibleInitiativeOwner(organizationId, projektId, obcyId)
    ).resolves.toBe(false);
  });
});
