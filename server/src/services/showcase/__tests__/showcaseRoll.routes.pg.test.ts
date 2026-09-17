/**
 * SR-1 część 2 (Wpis 32, DEC-576) — SHOWCASE-ROLL udowodniony na PRAWDZIWYM
 * PostgreSQL, nie na atrapie `dbAll`/`dbTransaction`.
 *
 * ===========================================================================
 * DLACZEGO TEN PLIK ISTNIEJE
 * ===========================================================================
 * Serwis `showcaseDateRollService` generuje ~22 instrukcje UPDATE (po jednej na
 * tabelę z `SHOWCASE_DATE_FIELDS`) z arytmetyką dat zależną od `kind` kolumny
 * (date / timestamp / timestamptz / text-ISO / text-date) oraz od reguły
 * rekurencji (WARIANT B). Atrapa bazy nie potrafi odpowiedzieć na pytanie, które
 * jest sensem tego serwisu: „czy `to_char`/`make_interval`/`AT TIME ZONE`
 * rzeczywiście przesuwają TE kolumny o TE dni w shipped schemacie?". Usunięcie
 * kolumny z `SHOWCASE_DATE_FIELDS`, zły `kind`, albo literówka w nazwie tabeli
 * przechodzą na atrapie zielono — tu muszą dać czerwień.
 *
 * Co jest zmierzone (i falsyfikowalne mutacyjnie):
 *   1. Każde pole grupy (a) orga pokazowego z datą D i wodowskazem D−7 po
 *      przebiegu (today = D, delta = 7) ma wartość D+7 — we wszystkich 9
 *      tabelach grupy (a), we wszystkich `kind`.
 *   2. `created_at`/`updated_at` BEZ zmian (przesunięcie dat nie tyka audytu).
 *   3. Org spoza `orgIds` BEZ zmian (każdy UPDATE filtruje po orgu).
 *   4. WARIANT B: spotkanie jednorazowe +delta(10) → D+10, spotkanie cykliczne
 *      FREQ=WEEKLY +round(10/7)*7=7 → D+7 — w tym samym przebiegu.
 *   5. Wodowskaz + dowód przebiegu: `last_rolled_on`, `delta_days`, `per_table`
 *      zapisane atomowo z przesunięciami.
 *   6. Idempotencja: drugi przebieg tego samego dnia = `up_to_date`, 0 zmian,
 *      pola NIE przesunięte ponownie, `delta_days` wodowskazu ZACHOWANY (7).
 *
 * MUTACJA (wymagana przez Wpis 32): usuń jedną kolumnę z `SHOWCASE_DATE_FIELDS`
 * → odpowiadająca jej asercja „= D+7" daje czerwień (kolumna nie została
 * przesunięta). Zweryfikowano ręcznie — patrz meldunek.
 *
 * ===========================================================================
 * BRAMKA FAIL-CLOSED (czytana przy ładowaniu modułu, przed beforeAll)
 * ===========================================================================
 *   RUN_DB_TESTS nieustawione / ''/0/false/no/off → głośny skip z powodem;
 *   w CI (CI/GITHUB_ACTIONS) bez RUN_DB_TESTS      → THROW przy kolekcji (RC=1),
 *                                                    nigdy cichy zielony skip.
 *
 * Uruchomienie (kontener z puli B, zmigrowany ścisłym runnerem):
 *   docker run -d --name qoder-b-pg-1 -p 127.0.0.1:6610:5432 \
 *     -e POSTGRES_PASSWORD=qoder pgvector/pgvector:pg16
 *   NODE_ENV=test npx tsx server/scripts/migrate.postgres.ts --dir server/migrations
 *   RUN_DB_TESTS=1 MOCK_DB=false DB_TYPE=postgres \
 *     DATABASE_URL=postgres://postgres:qoder@127.0.0.1:6610/consultify_sr1 \
 *     npx vitest run server/src/services/showcase/__tests__/showcaseDateRoll.pg.test.ts
 *
 * SPRZĄTANIE: plik tworzy WYŁĄCZNIE własne wiersze z przedrostkiem `sr1-b-pg-`
 * i kasuje je w `afterAll`. Nie dotyka schematu — żadnego DROP/TRUNCATE.
 */

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildShowcaseDateRoll,
  type ShowcaseRollDb,
  type ShowcaseRollStatement,
  type ShowcaseRollTransactionResult,
} from '../showcaseDateRollService.js';

// ── Fail-closed gate (load-time) ────────────────────────────────────────────
const OPT_OUT = new Set(['', '0', 'false', 'no', 'off']);
const DB_TESTS_DEMANDED =
  process.env.RUN_DB_TESTS !== undefined &&
  !OPT_OUT.has(String(process.env.RUN_DB_TESTS).trim().toLowerCase());

const IN_CI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
if (IN_CI && !DB_TESTS_DEMANDED) {
  throw new Error(
    'RealPG evidence must never be skipped in CI: set RUN_DB_TESTS=1 and DATABASE_URL'
  );
}

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG =
  DB_TESTS_DEMANDED &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

// ── Fixtures ────────────────────────────────────────────────────────────────
const PREFIX = 'sr1-b-pg-';
const ORG_A = `${PREFIX}org-a`; // delta 7 — pełny przegląd grupy (a)
const ORG_W = `${PREFIX}org-w`; // delta 10 — dowód VARIANT B (weekly)
const ORG_OUT = `${PREFIX}org-out`; // wodowskaz D−7, ale POZA orgIds → bez zmian
const USER = `${PREFIX}user`;

/** Reference "now". Wszystkie pola grupy (a) seedowane wartością D. */
const D = '2026-09-17';
const D_PLUS_7 = '2026-09-24'; // D + delta(7)  — org A
const D_PLUS_10 = '2026-09-27'; // D + delta(10) — org W, spotkanie jednorazowe
const D_PLUS_7_W = '2026-09-24'; // D + round(10/7)*7=7 — org W, spotkanie weekly
const WM_A = '2026-09-10'; // D − 7  → delta 7
const WM_W = '2026-09-07'; // D − 10 → delta 10
const WM_OUT = '2026-09-10'; // D − 7, ale org nie będzie rollowany

const TODAY = new Date(`${D}T00:00:00.000Z`);

// Seed value helpers — format musi trafić w odpowiednią gałąź `shiftExpression`.
const ISO = `${D}T00:00:00.000Z`; // text ISO_TS branch
const DATEONLY = D; // text DATE_ONLY branch / date / timestamp
const TS = `${D} 00:00:00`; // timestamp without time zone
const FIXED_AUDIT = '2026-01-01T00:00:00.000Z'; // created_at/updated_at v8 — nie rollowane

let pool: pg.Pool | null = null;

/** Seam `ShowcaseRollDb` na żywym pg.Pool — transaction = BEGIN/…/COMMIT. */
function pgSeam(): ShowcaseRollDb {
  return {
    all: async <T,>(sql: string, params: unknown[] = []): Promise<T[]> => {
      const r = await pool!.query(sql, params as never[]);
      return r.rows as T[];
    },
    transaction: async (
      statements: ShowcaseRollStatement[]
    ): Promise<ShowcaseRollTransactionResult> => {
      const client = await pool!.connect();
      const results: ShowcaseRollTransactionResult['results'] = [];
      try {
        await client.query('BEGIN');
        for (const s of statements) {
          const r = await client.query(s.sql, s.params as never[]);
          results.push({ success: true, changes: r.rowCount ?? 0 });
        }
        await client.query('COMMIT');
        return { success: true, results };
      } catch (err) {
        await client.query('ROLLBACK').catch(() => undefined);
        return {
          success: false,
          results,
          error: err instanceof Error ? err.message : String(err),
        };
      } finally {
        client.release();
      }
    },
  };
}

const q = async (sql: string, params: unknown[] = []): Promise<any[]> =>
  (await pool!.query(sql, params as never[])).rows;

const one = async (sql: string, params: unknown[] = []): Promise<any> =>
  (await q(sql, params))[0];

beforeAll(async () => {
  if (!REAL_PG) return;
  pool = new pg.Pool({ connectionString: CONNECTION_STRING, max: 4 });

  // Rodzice (FK): organizations + users. Tylko id jest NOT NULL bez defaultu.
  await q(
    `INSERT INTO organizations (id, name, status, is_active) VALUES
       ($1,$2,'active',1),($3,$4,'active',1),($5,$6,'active',1)`,
    [ORG_A, 'SR1 A', ORG_W, 'SR1 W', ORG_OUT, 'SR1 OUT']
  );
  await q(`INSERT INTO users (id, email, password) VALUES ($1,$2,'x')`, [
    USER,
    `${PREFIX}u@example.test`,
  ]);

  // Wodowskazy: A i W mają historię (delta>0), OUT ma wodowskaz ale nie rollujemy.
  await q(
    `INSERT INTO showcase_date_roll (org_id, last_rolled_on) VALUES
       ($1,$2::date),($3,$4::date),($5,$6::date)`,
    [ORG_A, WM_A, ORG_W, WM_W, ORG_OUT, WM_OUT]
  );

  // ── GROUP (a): jedna encja na każdą z 9 tabel, wszystkie daty = D ──────────
  // 1. tasks — due_date timestamptz, milestone_target_date date, sla_due_at timestamp
  await q(
    `INSERT INTO tasks (id, organization_id, title, due_date, milestone_target_date, sla_due_at, created_at, updated_at)
     VALUES ($1,$2,$3,$4::timestamptz,$5::date,$6::timestamp, $7::timestamptz, $7::timestamptz)`,
    [`${PREFIX}task-a`, ORG_A, 'Task A', ISO, DATEONLY, ISO, FIXED_AUDIT]
  );
  // 2. calendar_events — start_at/end_at text(ISO)
  await q(
    `INSERT INTO calendar_events (id, organization_id, owner_id, title, start_at, end_at, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$3)`,
    [`${PREFIX}cal-a`, ORG_A, USER, 'Cal A', ISO, ISO]
  );
  // 3. decisions — deadline/escalation_deadline timestamp
  await q(
    `INSERT INTO decisions (id, organization_id, title, created_by, deadline, escalation_deadline)
     VALUES ($1,$2,$3,$4,$5::timestamp,$6::timestamp)`,
    [`${PREFIX}dec-a`, ORG_A, 'Dec A', USER, TS, TS]
  );
  // 4. initiatives — 8 kolumn (text date-only + timestamp)
  await q(
    `INSERT INTO initiatives (id, organization_id, name,
        planned_start_date, planned_end_date, baseline_start_date, baseline_end_date,
        forecast_start_date, forecast_end_date, start_date, end_date)
     VALUES ($1,$2,$3,$4::timestamp,$4::timestamp,$6,$6,$6,$6,$5::timestamp,$5::timestamp)`,
    [`${PREFIX}init-a`, ORG_A, 'Init A', DATEONLY, ISO, DATEONLY]
  );
  // 5. initiative_milestones — target_date/baseline_date date (FK → initiatives)
  await q(
    `INSERT INTO initiative_milestones (id, initiative_id, organization_id, name, target_date, baseline_date)
     VALUES ($1,$2,$3,$4,$5::date,$5::date)`,
    [`${PREFIX}mile-a`, `${PREFIX}init-a`, ORG_A, 'Mile A', DATEONLY]
  );
  // 6. meetings — jednorazowe (recurrence_rule NULL), start_at/end_at text(ISO)
  await q(
    `INSERT INTO meetings (id, organization_id, title, start_at, end_at, created_by, recurrence_rule)
     VALUES ($1,$2,$3,$4,$5,$6,NULL)`,
    [`${PREFIX}meet-a`, ORG_A, 'Meet A', ISO, ISO, USER]
  );
  // 7. v8_calendar_items — start_at/end_at text(ISO); created_at/updated_at text (nie rollowane)
  await q(
    `INSERT INTO v8_calendar_items (calendar_item_id, organization_id, item_type, source_system,
        source_object_ref, start_at, end_at, created_at, updated_at)
     VALUES ($1,$2,'meeting','consultify',$3,$4,$4,$5,$5)`,
    [`${PREFIX}v8-a`, ORG_A, `${PREFIX}ref`, ISO, FIXED_AUDIT]
  );
  // 8. interview_assignments — due_at timestamp
  await q(
    `INSERT INTO interview_assignments (id, organization_id, assignee_user_id, template_id, due_at)
     VALUES ($1,$2,$3,$4,$5::timestamp)`,
    [`${PREFIX}ia-a`, ORG_A, USER, `${PREFIX}tpl`, TS]
  );
  // 9. report_schedules — next_run_at timestamp
  await q(
    `INSERT INTO report_schedules (id, organization_id, schedule_name, cron_expression, next_run_at)
     VALUES ($1,$2,$3,'0 3 * * *',$4::timestamp)`,
    [`${PREFIX}rs-a`, ORG_A, 'RS A', TS]
  );

  // ── VARIANT B: org W, dwa spotkania (jednorazowe + weekly), delta 10 ────────
  await q(
    `INSERT INTO meetings (id, organization_id, title, start_at, end_at, created_by, recurrence_rule)
     VALUES ($1,$2,$3,$4,$5,$6,NULL),
            ($7,$2,$8,$4,$5,$6,'FREQ=WEEKLY;BYDAY=WE')`,
    [
      `${PREFIX}meet-w-one`, ORG_W, 'W one-off', ISO, ISO, USER,
      `${PREFIX}meet-w-wk`, 'W weekly',
    ]
  );

  // ── Org POZA listą: task z datą D, wodowskaz D−7 — musi zostać nietknięty ───
  await q(
    `INSERT INTO tasks (id, organization_id, title, due_date, created_at, updated_at)
     VALUES ($1,$2,$3,$4::timestamptz,$5::timestamptz,$5::timestamptz)`,
    [`${PREFIX}task-out`, ORG_OUT, 'Task OUT', ISO, FIXED_AUDIT]
  );
}, 120_000);

afterAll(async () => {
  if (!pool) return;
  // Kasuj w kolejności odwrotnej do FK. Wszystko ma przedrostek w id / org_id.
  await q(`DELETE FROM showcase_date_roll WHERE org_id LIKE $1`, [`${PREFIX}%`]).catch(() => undefined);
  await q(`DELETE FROM initiative_milestones WHERE id LIKE $1`, [`${PREFIX}%`]).catch(() => undefined);
  await q(`DELETE FROM initiatives WHERE id LIKE $1`, [`${PREFIX}%`]).catch(() => undefined);
  await q(`DELETE FROM decisions WHERE id LIKE $1`, [`${PREFIX}%`]).catch(() => undefined);
  await q(`DELETE FROM meetings WHERE id LIKE $1`, [`${PREFIX}%`]).catch(() => undefined);
  await q(`DELETE FROM calendar_events WHERE id LIKE $1`, [`${PREFIX}%`]).catch(() => undefined);
  await q(`DELETE FROM v8_calendar_items WHERE calendar_item_id LIKE $1`, [`${PREFIX}%`]).catch(() => undefined);
  await q(`DELETE FROM interview_assignments WHERE template_id LIKE $1`, [`${PREFIX}%`]).catch(() => undefined);
  await q(`DELETE FROM report_schedules WHERE id LIKE $1`, [`${PREFIX}%`]).catch(() => undefined);
  await q(`DELETE FROM tasks WHERE id LIKE $1`, [`${PREFIX}%`]).catch(() => undefined);
  await q(`DELETE FROM users WHERE id LIKE $1`, [`${PREFIX}%`]).catch(() => undefined);
  await q(`DELETE FROM organizations WHERE id LIKE $1`, [`${PREFIX}%`]).catch(() => undefined);
  await pool.end().catch(() => undefined);
  pool = null;
}, 60_000);

const guard = (name: string, fn: () => Promise<void>) =>
  (REAL_PG ? it : it.skip)(name, async () => {
    if (!pool) return;
    await fn();
  }, 60_000);

describe.skipIf(!REAL_PG)('SR-1 część 2 (Wpis 32) — showcase-roll na realnym PG', () => {
  // Przegląd audit-kolumn PRZED przebiegiem (do punktu 2).
  let auditBefore: { created_at: string; updated_at: string } | null = null;

  guard('przebieg orga A (delta 7) przesuwa WSZYSTKIE pola grupy (a) na D+7', async () => {
    auditBefore = await one(
      `SELECT created_at::text AS created_at, updated_at::text AS updated_at FROM tasks WHERE id=$1`,
      [`${PREFIX}task-a`]
    );

    const roll = buildShowcaseDateRoll(pgSeam());
    const results = await roll.roll({ today: TODAY, orgIds: [ORG_A, ORG_W] });

    expect(results).toHaveLength(2);
    const a = results.find((r) => r.orgId === ORG_A)!;
    expect(a.deltaDays).toBe(7);
    expect(a.lastRolledOn).toBe(D);
    expect(a.skipped).toBeUndefined();
    // per_table zlicza kandydatów w każdej z 9 tabel grupy (a), które seedowaliśmy.
    expect(a.perTable.tasks).toBe(1);
    expect(a.perTable.calendar_events).toBe(1);
    expect(a.perTable.decisions).toBe(1);
    expect(a.perTable.initiatives).toBe(1);
    expect(a.perTable.initiative_milestones).toBe(1);
    expect(a.perTable.meetings).toBe(1);
    expect(a.perTable.v8_calendar_items).toBe(1);
    expect(a.perTable.interview_assignments).toBe(1);
    expect(a.perTable.report_schedules).toBe(1);

    // 1. tasks — timestamptz / date / timestamp
    const t = await one(
      `SELECT to_char(due_date AT TIME ZONE 'UTC','YYYY-MM-DD') AS due,
              to_char(milestone_target_date,'YYYY-MM-DD') AS mile,
              to_char(sla_due_at,'YYYY-MM-DD') AS sla
         FROM tasks WHERE id=$1`,
      [`${PREFIX}task-a`]
    );
    expect(t.due).toBe(D_PLUS_7);
    expect(t.mile).toBe(D_PLUS_7);
    expect(t.sla).toBe(D_PLUS_7);

    // 2. calendar_events — text(ISO)
    const ce = await one(`SELECT start_at, end_at FROM calendar_events WHERE id=$1`, [
      `${PREFIX}cal-a`,
    ]);
    expect(ce.start_at).toBe(`${D_PLUS_7}T00:00:00.000Z`);
    expect(ce.end_at).toBe(`${D_PLUS_7}T00:00:00.000Z`);

    // 3. decisions — timestamp
    const dec = await one(
      `SELECT to_char(deadline,'YYYY-MM-DD') AS dl, to_char(escalation_deadline,'YYYY-MM-DD') AS esc
         FROM decisions WHERE id=$1`,
      [`${PREFIX}dec-a`]
    );
    expect(dec.dl).toBe(D_PLUS_7);
    expect(dec.esc).toBe(D_PLUS_7);

    // 4. initiatives — timestamp ×2 + text ×4 + timestamp ×2
    const ini = await one(
      `SELECT to_char(planned_start_date,'YYYY-MM-DD') AS ps,
              to_char(planned_end_date,'YYYY-MM-DD') AS pe,
              baseline_start_date AS bs, baseline_end_date AS be,
              forecast_start_date AS fs, forecast_end_date AS fe,
              to_char(start_date,'YYYY-MM-DD') AS sd,
              to_char(end_date,'YYYY-MM-DD') AS ed
         FROM initiatives WHERE id=$1`,
      [`${PREFIX}init-a`]
    );
    expect(ini.ps).toBe(D_PLUS_7);
    expect(ini.pe).toBe(D_PLUS_7);
    expect(ini.bs).toBe(D_PLUS_7);
    expect(ini.be).toBe(D_PLUS_7);
    expect(ini.fs).toBe(D_PLUS_7);
    expect(ini.fe).toBe(D_PLUS_7);
    expect(ini.sd).toBe(D_PLUS_7);
    expect(ini.ed).toBe(D_PLUS_7);

    // 5. initiative_milestones — date ×2
    const mile = await one(
      `SELECT to_char(target_date,'YYYY-MM-DD') AS tg, to_char(baseline_date,'YYYY-MM-DD') AS bl
         FROM initiative_milestones WHERE id=$1`,
      [`${PREFIX}mile-a`]
    );
    expect(mile.tg).toBe(D_PLUS_7);
    expect(mile.bl).toBe(D_PLUS_7);

    // 6. meetings (org A, jednorazowe) — text(ISO)
    const meet = await one(`SELECT start_at, end_at FROM meetings WHERE id=$1`, [
      `${PREFIX}meet-a`,
    ]);
    expect(meet.start_at).toBe(`${D_PLUS_7}T00:00:00.000Z`);
    expect(meet.end_at).toBe(`${D_PLUS_7}T00:00:00.000Z`);

    // 7. v8_calendar_items — start/end przesunięte; created_at/updated_at BEZ zmian
    const v8 = await one(
      `SELECT start_at, end_at, created_at, updated_at FROM v8_calendar_items WHERE calendar_item_id=$1`,
      [`${PREFIX}v8-a`]
    );
    expect(v8.start_at).toBe(`${D_PLUS_7}T00:00:00.000Z`);
    expect(v8.end_at).toBe(`${D_PLUS_7}T00:00:00.000Z`);
    expect(v8.created_at).toBe(FIXED_AUDIT);
    expect(v8.updated_at).toBe(FIXED_AUDIT);

    // 8. interview_assignments — timestamp
    const ia = await one(
      `SELECT to_char(due_at,'YYYY-MM-DD') AS due FROM interview_assignments WHERE template_id=$1`,
      [`${PREFIX}tpl`]
    );
    expect(ia.due).toBe(D_PLUS_7);

    // 9. report_schedules — timestamp
    const rs = await one(
      `SELECT to_char(next_run_at,'YYYY-MM-DD') AS nr FROM report_schedules WHERE id=$1`,
      [`${PREFIX}rs-a`]
    );
    expect(rs.nr).toBe(D_PLUS_7);

    // 2. created_at/updated_at taska BEZ zmian (przesunięcie dat nie tyka audytu)
    const auditAfter = await one(
      `SELECT created_at::text AS created_at, updated_at::text AS updated_at FROM tasks WHERE id=$1`,
      [`${PREFIX}task-a`]
    );
    expect(auditAfter.created_at).toBe(auditBefore!.created_at);
    expect(auditAfter.updated_at).toBe(auditBefore!.updated_at);

    // 5. Wodowskaz + dowód przebiegu zapisane atomowo
    const wm = await one(
      `SELECT to_char(last_rolled_on,'YYYY-MM-DD') AS lro, delta_days, per_table
         FROM showcase_date_roll WHERE org_id=$1`,
      [ORG_A]
    );
    expect(wm.lro).toBe(D);
    expect(wm.delta_days).toBe(7);
    expect(wm.per_table.tasks).toBe(1);
    expect(wm.per_table.initiatives).toBe(1);
  });

  guard('VARIANT B — org W (delta 10): jednorazowe +10, weekly +round(10/7)*7=7', async () => {
    const one_off = await one(`SELECT start_at, end_at FROM meetings WHERE id=$1`, [
      `${PREFIX}meet-w-one`,
    ]);
    expect(one_off.start_at).toBe(`${D_PLUS_10}T00:00:00.000Z`);
    expect(one_off.end_at).toBe(`${D_PLUS_10}T00:00:00.000Z`);

    const weekly = await one(`SELECT start_at, end_at FROM meetings WHERE id=$1`, [
      `${PREFIX}meet-w-wk`,
    ]);
    expect(weekly.start_at).toBe(`${D_PLUS_7_W}T00:00:00.000Z`);
    expect(weekly.end_at).toBe(`${D_PLUS_7_W}T00:00:00.000Z`);

    const wm = await one(`SELECT delta_days FROM showcase_date_roll WHERE org_id=$1`, [ORG_W]);
    expect(wm.delta_days).toBe(10);
  });

  guard('org POZA orgIds pozostaje nietknięty', async () => {
    const t = await one(
      `SELECT to_char(due_date AT TIME ZONE 'UTC','YYYY-MM-DD') AS due FROM tasks WHERE id=$1`,
      [`${PREFIX}task-out`]
    );
    expect(t.due).toBe(D); // wciąż 2026-09-17, NIE przesunięty
    const wm = await one(
      `SELECT to_char(last_rolled_on,'YYYY-MM-DD') AS lro FROM showcase_date_roll WHERE org_id=$1`,
      [ORG_OUT]
    );
    expect(wm.lro).toBe(WM_OUT); // wodowskaz nie nadpisany
  });

  guard('drugi przebieg tego samego dnia = up_to_date, 0 zmian, bez podwójnego przesunięcia', async () => {
    const roll = buildShowcaseDateRoll(pgSeam());
    const results = await roll.roll({ today: TODAY, orgIds: [ORG_A] });
    expect(results).toHaveLength(1);
    expect(results[0].skipped).toBe('up_to_date');
    expect(results[0].deltaDays).toBe(0);
    expect(results[0].perTable).toEqual({});

    // Pole NIE przesunięte ponownie (wciąż D+7, nie D+14).
    const t = await one(
      `SELECT to_char(due_date AT TIME ZONE 'UTC','YYYY-MM-DD') AS due FROM tasks WHERE id=$1`,
      [`${PREFIX}task-a`]
    );
    expect(t.due).toBe(D_PLUS_7);

    // delta_days wodowskazu ZACHOWANY (7), nie nadpisany zerem.
    const wm = await one(`SELECT delta_days FROM showcase_date_roll WHERE org_id=$1`, [ORG_A]);
    expect(wm.delta_days).toBe(7);
  });

  guard('dryRun liczy kandydatów i NIE zapisuje żadnego wiersza', async () => {
    // Nowy org z wodowskazem D−7; dryRun nie może przesunąć dat ani nadpisać wodowskazu.
    const ORG_DRY = `${PREFIX}org-dry`;
    await q(`INSERT INTO organizations (id, name, status, is_active) VALUES ($1,'SR1 DRY','active',1)`, [ORG_DRY]);
    await q(`INSERT INTO showcase_date_roll (org_id, last_rolled_on) VALUES ($1,$2::date)`, [ORG_DRY, WM_A]);
    await q(
      `INSERT INTO tasks (id, organization_id, title, due_date, created_at, updated_at)
       VALUES ($1,$2,$3,$4::timestamptz,$5::timestamptz,$5::timestamptz)`,
      [`${PREFIX}task-dry`, ORG_DRY, 'Task DRY', ISO, FIXED_AUDIT]
    );

    const roll = buildShowcaseDateRoll(pgSeam());
    const results = await roll.roll({ today: TODAY, orgIds: [ORG_DRY], dryRun: true });
    expect(results[0].skipped).toBe('dry_run');
    expect(results[0].deltaDays).toBe(7);
    expect(results[0].perTable.tasks).toBe(1);

    const t = await one(
      `SELECT to_char(due_date AT TIME ZONE 'UTC','YYYY-MM-DD') AS due FROM tasks WHERE id=$1`,
      [`${PREFIX}task-dry`]
    );
    expect(t.due).toBe(D); // bez przesunięcia
    const wm = await one(
      `SELECT to_char(last_rolled_on,'YYYY-MM-DD') AS lro FROM showcase_date_roll WHERE org_id=$1`,
      [ORG_DRY]
    );
    expect(wm.lro).toBe(WM_A); // wodowskaz nie nadpisany
  });
});
