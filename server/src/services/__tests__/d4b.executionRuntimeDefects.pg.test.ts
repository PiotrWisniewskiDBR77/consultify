/**
 * D4b (DECYZJA 3) — DWA DEFEKTY RUNTIME REALIZACJI NA PRAWDZIWYM POSTGRESIE.
 * [ODMROZENIE 06_EXECUTION DEC-453]
 *
 * Czego NIE da sie zmierzyc bez realnej bazy (i dlaczego ten plik istnieje):
 *   (1) `delayDetectionService.ts` filtrowal zadania przez
 *       `t.status NOT IN ('DONE','CANCELLED')` WIELKIMI literami, a slownik
 *       `tasks.status` jest MALYMI (`task.validators.ts:14-23`). Atrapa bazy
 *       tego repo nie egzekwuje wielkosci liter tak jak PG, wiec „zielono" na
 *       atrapie nic nie znaczy — dowodem jest ZADANIE `done` PO TERMINIE,
 *       ktore NIE MA prawa dac sygnalu.
 *   (2) `workloadCapacityService.getRoleWeeklySupply` porownywalo
 *       `COALESCE(u.is_active, 1) = 1`, a `users.is_active` jest kolumna TEXT.
 *       PG rzuca `operator does not exist: text = integer`; wyjatek byl polykany
 *       i PODAZ ROL wracala PUSTA. Tylko realny PG wywraca sie na tym typie —
 *       atrapa policzy cokolwiek.
 *
 * URUCHOMIENIE (bez tych trzech zmiennych plik jest POMIJANY — `describe.skipIf`
 * — i nigdy nie daje falszywej zieleni):
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54418/consultify_kopia_d44 \
 *   npx vitest run server/src/services/__tests__/d4b.executionRuntimeDefects.pg.test.ts
 *
 * PULAPKA, ktorej ten plik unika: `NODE_ENV=test` BEZ `RUN_DB_TESTS=1`
 * podstawia atrape bazy — wtedy „zielono" znaczy „nie mierzylem".
 *
 * SPRZATANIE: plik zaklada WLASNA organizacje probna z przedrostkiem
 * `proba-d4b-` i kasuje wszystko w `afterAll`. Zero DROP/TRUNCATE, zero
 * dotykania danych pokazowych Northwind.
 */
import { randomUUID } from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG) process.env.DB_TYPE = 'postgres';

const PRZEDROSTEK = 'proba-d4b-';
const slug = (etykieta: string) =>
  etykieta
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

describe.skipIf(!REAL_PG)('D4b · defekty runtime Realizacji · RealPG', () => {
  let pool: any;
  const orgId = randomUUID();
  const projektId = randomUUID();
  const inicjatywaId = randomUUID();
  const osobaAktywna = randomUUID();
  const osobaBezFlagi = randomUUID();
  const osobaWylaczona = randomUUID();
  const zadaniePoTerminieOtwarte = randomUUID();
  const zadaniePoTerminieDone = randomUUID();
  const zadaniePoTerminieCancelled = randomUUID();

  const wczoraj = new Date(Date.now() - 5 * 86_400_000).toISOString();

  const wstawZadanie = async (id: string, tytul: string, status: string) =>
    pool.query(
      `INSERT INTO tasks (id, organization_id, project_id, initiative_id, title, status,
                          priority, due_date, estimated_hours, assignee_id, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'high', $7, 8, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, orgId, projektId, inicjatywaId, tytul, status, wczoraj, osobaAktywna]
    );

  beforeAll(async () => {
    const { Pool } = await import('pg');
    pool = new Pool({ connectionString: CONNECTION_STRING });

    await pool.query(`INSERT INTO organizations (id, name, is_active) VALUES ($1, $2, 1)`, [
      orgId,
      `${PRZEDROSTEK}org`,
    ]);
    // TRZY warianty `users.is_active`, ktore realnie wystepuja w bazie:
    // '1' (tekst), NULL (nikt nie wpisal) i 'false' (jawnie wylaczony).
    await pool.query(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name, role,
                          job_title, weekly_capacity_hours, availability_percent, is_active)
       VALUES ($1,$4,$5,'x','Anna','Active','MEMBER','Probe Engineer',40,100,'1'),
              ($2,$4,$6,'x','Bob','NoFlag','MEMBER','Probe Planner',40,100,NULL),
              ($3,$4,$7,'x','Cara','Off','MEMBER','Probe Analyst',40,100,'false')`,
      [
        osobaAktywna,
        osobaBezFlagi,
        osobaWylaczona,
        orgId,
        `${PRZEDROSTEK}a@example.test`,
        `${PRZEDROSTEK}b@example.test`,
        `${PRZEDROSTEK}c@example.test`,
      ]
    );
    await pool.query(
      `INSERT INTO projects (id, organization_id, name, status) VALUES ($1,$2,$3,'active')`,
      [projektId, orgId, `${PRZEDROSTEK}projekt`]
    );
    await pool.query(
      `INSERT INTO initiatives (id, organization_id, project_id, name, title, status, priority, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$4,'IN_EXECUTION','high',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      [inicjatywaId, orgId, projektId, `${PRZEDROSTEK}inicjatywa`]
    );

    await wstawZadanie(zadaniePoTerminieOtwarte, `${PRZEDROSTEK}otwarte-po-terminie`, 'todo');
    await wstawZadanie(zadaniePoTerminieDone, `${PRZEDROSTEK}ukonczone-po-terminie`, 'done');
    await wstawZadanie(
      zadaniePoTerminieCancelled,
      `${PRZEDROSTEK}anulowane-po-terminie`,
      'cancelled'
    );
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM tasks WHERE organization_id = $1`, [orgId]);
    await pool.query(`DELETE FROM initiatives WHERE organization_id = $1`, [orgId]);
    await pool.query(`DELETE FROM projects WHERE organization_id = $1`, [orgId]);
    await pool.query(`DELETE FROM users WHERE organization_id = $1`, [orgId]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    await pool.end();
  });

  // ==========================================================================
  // (1) delayDetectionService — zadanie UKONCZONE nie daje sygnalu
  // ==========================================================================
  it('(1) zadanie `done` po terminie NIE daje sygnalu, otwarte daje', async () => {
    const { detectDelaySignals } = await import('../delayDetectionService.js');
    const sygnaly = await detectDelaySignals(orgId);
    const idZadan = sygnaly.filter((s) => s.entityType === 'TASK').map((s) => s.entityId);

    expect(idZadan).toContain(zadaniePoTerminieOtwarte);
    expect(idZadan).not.toContain(zadaniePoTerminieDone);
    expect(idZadan).not.toContain(zadaniePoTerminieCancelled);
  });

  it('(1) MUTACJA RED: filtr WIELKIMI literami wpuszcza `done` i `cancelled`', async () => {
    // Dokladnie zapytanie SPRZED naprawy. Jesli PG mialby dopasowywac
    // 'done' do 'DONE', ta asercja byla by falszywa i test by o tym powiedzial.
    const mutant = await pool.query(
      `SELECT t.id FROM tasks t
         JOIN initiatives i ON i.id = t.initiative_id
        WHERE i.organization_id = $1
          AND t.status NOT IN ('DONE', 'CANCELLED')
          AND t.due_date IS NOT NULL AND t.due_date < CURRENT_TIMESTAMP`,
      [orgId]
    );
    const idMutanta = mutant.rows.map((r: { id: string }) => r.id);
    expect(idMutanta).toContain(zadaniePoTerminieDone);
    expect(idMutanta).toContain(zadaniePoTerminieCancelled);

    // A naprawiony warunek ich NIE wpuszcza.
    const naprawiony = await pool.query(
      `SELECT t.id FROM tasks t
         JOIN initiatives i ON i.id = t.initiative_id
        WHERE i.organization_id = $1
          AND LOWER(COALESCE(t.status, '')) NOT IN ('done', 'cancelled')
          AND t.due_date IS NOT NULL AND t.due_date < CURRENT_TIMESTAMP`,
      [orgId]
    );
    const idNaprawionego = naprawiony.rows.map((r: { id: string }) => r.id);
    expect(idNaprawionego).not.toContain(zadaniePoTerminieDone);
    expect(idNaprawionego).not.toContain(zadaniePoTerminieCancelled);
    expect(idNaprawionego).toContain(zadaniePoTerminieOtwarte);
  });

  // ==========================================================================
  // (2) workloadCapacityService — podaz rol > 0 i szanuje jawne wylaczenie
  // ==========================================================================
  it('(2) podaz rol jest NIEPUSTA i liczy osobe z NULL-em w is_active', async () => {
    const { getRoleWeeklySupply } = await import('../workloadCapacityService.js');
    const podaz = await getRoleWeeklySupply(orgId, slug);

    const etykiety = podaz.map((r) => r.roleLabel).sort();
    expect(podaz.length).toBeGreaterThan(0);
    expect(etykiety).toContain('Probe Engineer');
    // NULL w `is_active` = „nikt nie wpisal", nie „wylaczony".
    expect(etykiety).toContain('Probe Planner');
    // Jawne 'false' MUSI wypasc — inaczej naprawa byla by „wpusc wszystkich".
    expect(etykiety).not.toContain('Probe Analyst');
    for (const rola of podaz) expect(rola.fteWeekly).toBeGreaterThan(0);
  });

  it('(2) MUTACJA RED: `COALESCE(is_active, 1) = 1` wywraca sie na kolumnie TEXT', async () => {
    const typ = await pool.query(
      `SELECT data_type FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'is_active'`
    );
    expect(typ.rows[0].data_type).toBe('text');

    await expect(
      pool.query(
        `SELECT u.id FROM users u WHERE u.organization_id = $1 AND COALESCE(u.is_active, 1) = 1`,
        [orgId]
      )
    ).rejects.toThrow(/operator does not exist|text = integer|cannot be matched/i);
  });
});
