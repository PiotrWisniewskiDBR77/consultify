/** @vitest-environment node */
/**
 * [ODMROZENIE 06_EXECUTION DEC-453] P16-R1 — plan zasobow na REALNYM PostgreSQL.
 *
 * PO CO OSOBNY TEST NA ZYWEJ BAZIE: testy jednostkowe obok podstawiaja
 * `DbPromise.all`, wiec dowodza arytmetyki, a NIE tego, ze zapytanie da sie
 * wykonac na prawdziwym schemacie (`tasks.actual_hours`, `tasks.created_at`,
 * typy `real`/`timestamptz`, `LOWER(status)`). Kolumny `start_date` /
 * `planned_start` w tabeli `tasks` NIE ISTNIEJA (pomiar 07.09) — poczatkiem
 * okna jest `created_at` i to tez sprawdza ten test.
 *
 * Test zaklada WLASNA organizacje, osobe i dwa zadania `proba-r1-*`, a na
 * koncu je kasuje. Zaden istniejacy rekord nie jest ruszany.
 *
 * Uruchomienie:
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *   DATABASE_URL=postgresql://…/consultify_p16r1 npx vitest run <ten plik>
 */
import { randomUUID } from 'node:crypto';

import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { assertRealPostgresTestEnvironment } from '../../../../tests/integration/_helpers/assertRealPostgres.js';

const NO_RETRY = { retry: 0 } as const;

describe('P16-R1: popyt bez zaleglosci, zaleglosc osobno (realny PostgreSQL)', NO_RETRY, () => {
  const sufiks = randomUUID().replaceAll('-', '').slice(0, 12);
  const orgId = `proba-r1-org-${sufiks}`;
  const userId = `proba-r1-user-${sufiks}`;
  const zadanieZalegle = `proba-r1-zalegle-${sufiks}`;
  const zadaniePrzyszle = `proba-r1-przyszle-${sufiks}`;
  let sql: Client;
  let getExecutionResourcePlan: typeof import('../workloadCapacityService.js').getExecutionResourcePlan;

  const dzien = (przesuniecie: number) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + przesuniecie);
    return d.toISOString();
  };

  beforeAll(async () => {
    process.env.DB_TYPE = 'postgres';
    await assertRealPostgresTestEnvironment();
    sql = new Client({ connectionString: String(process.env.DATABASE_URL) });
    await sql.connect();

    await sql.query(
      `INSERT INTO organizations (id, name, plan, status, is_active, created_at)
       VALUES ($1, $2, 'enterprise', 'active', 1, now())`,
      [orgId, `proba-r1-${sufiks}`]
    );
    await sql.query(
      `INSERT INTO users (id, organization_id, email, password, first_name, last_name,
                          role, status, weekly_capacity_hours, availability_percent, created_at)
       VALUES ($1, $2, $3, 'x', 'Proba', 'R1', 'ADMIN', 'active', 40, 100, now())`,
      [userId, orgId, `proba-r1-${sufiks}@example.test`]
    );
    // Zalegle: termin 10 dni temu, 12 h szacunku, 2 h juz zrobione -> 10 h.
    await sql.query(
      `INSERT INTO tasks (id, organization_id, title, status, assignee_id, owner_id,
                          due_date, estimated_hours, actual_hours, created_at)
       VALUES ($1, $2, 'proba-r1 zadanie zalegle', 'todo', $3, $3, $4, 12, 2, $5)`,
      [zadanieZalegle, orgId, userId, dzien(-10), dzien(-20)]
    );
    // Przyszle: termin za 3 dni, 8 h, zaczete dzisiaj.
    await sql.query(
      `INSERT INTO tasks (id, organization_id, title, status, assignee_id, owner_id,
                          due_date, estimated_hours, actual_hours, created_at)
       VALUES ($1, $2, 'proba-r1 zadanie przyszle', 'in_progress', $3, $3, $4, 8, 0, $5)`,
      [zadaniePrzyszle, orgId, userId, dzien(3), dzien(0)]
    );

    ({ getExecutionResourcePlan } = await import('../workloadCapacityService.js'));
  });

  afterAll(async () => {
    // Dane demo sa twarza produktu — proba sprzata po sobie w calosci.
    if (!sql) return;
    await sql.query('DELETE FROM tasks WHERE organization_id = $1', [orgId]);
    await sql.query('DELETE FROM users WHERE id = $1', [userId]);
    await sql.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    const zostalo = await sql.query(
      "SELECT count(*)::int AS ile FROM tasks WHERE id LIKE 'proba-r1-%'",
      []
    );
    expect(Number(zostalo.rows[0].ile)).toBe(0);
    await sql.end();
  });

  it('zadanie po terminie siedzi w zaleglosci, a popyt tygodnia zna tylko zadanie przyszle', async () => {
    const plan = await getExecutionResourcePlan(orgId, { weeks: 4 });

    const osoba = plan.people.find((p) => p.userId === userId);
    expect(osoba).toBeTruthy();
    // 12 h szacunku - 2 h zrobione = 10 h zaleglosci, JEDNA liczba.
    expect(osoba!.backlogHours).toBe(10);
    expect(osoba!.backlogTaskIds).toEqual([zadanieZalegle]);
    expect(osoba!.backlogTasks[0].daysOverdue).toBeGreaterThanOrEqual(9);

    const wiersze = plan.rows.filter((r) => r.userId === userId);
    const popytRazem = wiersze.reduce((suma, r) => suma + r.demandHours, 0);
    // Caly popyt to WYLACZNIE zadanie przyszle (8 h), rozlozone po tygodniach.
    expect(popytRazem).toBeCloseTo(8, 1);
    // Zaleglosc nie doklada sie do zadnego tygodnia.
    expect(wiersze.every((r) => r.demandHours <= 8)).toBe(true);
    expect(wiersze.filter((r) => r.backlogHours > 0)).toHaveLength(1);
    expect(wiersze[0].backlogHours).toBe(10);
    expect(wiersze[0].supplyHours).toBe(40);
  });
});
