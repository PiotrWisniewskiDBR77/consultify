/**
 * Dowód dla seeda „Wyniki · DBR77" (`server/scripts/seed-wyniki-dbr77.ts`)
 * na REALNYM Postgresie — cztery twierdzenia, których nie da się sprawdzić
 * na atrapie bazy (atrapa zwraca `changes:1` dla każdego UPDATE-u i nie ma
 * ani ograniczeń CHECK, ani kluczy obcych, ani indeksów unikalnych):
 *
 *   1. `--apply` wstawia dokładnie zaplanowaną liczbę wierszy,
 *   2. powtórny `--apply` nie dokłada ANI JEDNEGO wiersza (idempotencja
 *      po deterministycznych identyfikatorach, nie po „mniej więcej"),
 *   3. `--rollback` zeruje wiersze seeda,
 *   4. wiersze CUDZEJ organizacji są nietknięte po apply i po rollbacku.
 *
 * Plus dowód, że dane są WIDOCZNE przez realną ścieżkę odczytu aplikacji
 * (listScorecards / listOkrSets / listRoiCases / getScorecardStatusDistribution),
 * a nie tylko obecne w tabelach — repozytoria filtrują przez
 * `rvn_platform_resource_visibility`, więc wiersz bez wpisu widoczności
 * istnieje w bazie i jednocześnie nie istnieje dla ekranu.
 *
 * Uruchomienie:
 *   NODE_ENV=test DB_TYPE=postgres RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://... npx vitest run \
 *     src/services/resultsVnext/__tests__/seedWynikiDbr77.pg.test.ts --retry=0
 */
import { randomUUID } from 'node:crypto';

import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  applySeed,
  buildContext,
  buildPlan,
  countExisting,
  plannedCounts,
  rollbackSeed,
  type SeedContext,
  type SeedPlan,
} from '../../../../scripts/seed-wyniki-dbr77.js';

const DATABASE_URL = process.env.DATABASE_URL?.trim();
const ENABLED = Boolean(DATABASE_URL) && process.env.RUN_DB_TESTS === '1';
const d = ENABLED ? describe : describe.skip;

const RUN = randomUUID().slice(0, 8);
const ORG_ID = `seedtest-dbr77-${RUN}`;
const ORG_NAME = `DBR77 SeedTest ${RUN}`;
const FOREIGN_ORG_ID = `seedtest-obcy-${RUN}`;
const OWNER_ID = `seedtest-owner-${RUN}`;
const MEMBER_ID = `seedtest-member-${RUN}`;
const FOREIGN_USER_ID = `seedtest-obcy-user-${RUN}`;
const FOREIGN_KPI_ID = randomUUID();
const FOREIGN_POLICY_ID = randomUUID();

let pool: Pool;
let ctx: SeedContext;
let plan: SeedPlan;

async function foreignRowFingerprint(): Promise<Record<string, string>> {
  const res = await pool.query(
    `SELECT
       (SELECT count(*)::text FROM rvn_kpi_definitions WHERE organization_id = $1) AS kpis,
       (SELECT count(*)::text FROM rvn_platform_visibility_policies WHERE organization_id = $1) AS policies,
       (SELECT count(*)::text FROM users WHERE organization_id = $1) AS users,
       (SELECT count(*)::text FROM organizations WHERE id = $1) AS orgs`,
    [FOREIGN_ORG_ID]
  );
  return res.rows[0] as unknown as Record<string, string>;
}

const TOTALS_SQL = `SELECT (
   (SELECT count(*) FROM rvn_kpi_definitions) +
   (SELECT count(*) FROM rvn_kpi_measurements) +
   (SELECT count(*) FROM rvn_kpi_scorecard_items) +
   (SELECT count(*) FROM okr_vnext_key_results) +
   (SELECT count(*) FROM okr_vnext_checkins) +
   (SELECT count(*) FROM rvn_roi_cases) +
   (SELECT count(*) FROM rvn_platform_resource_visibility)
 )::text AS n`;

d('seed Wyniki DBR77 — realny Postgres', () => {
  beforeAll(async () => {
    pool = new Pool({ connectionString: DATABASE_URL, max: 3 });
    await pool.query(`INSERT INTO organizations(id,name) VALUES ($1,$2),($3,$4)`, [
      ORG_ID,
      ORG_NAME,
      FOREIGN_ORG_ID,
      `Obca Firma ${RUN}`,
    ]);
    await pool.query(
      `INSERT INTO users(id,organization_id,email,password,first_name,last_name,role,status) VALUES
         ($1,$2,$3,'x','Piotr','Wiśniewski','OWNER','active'),
         ($4,$2,$5,'x','Anna','Kowalska','ADMIN','active'),
         ($6,$7,$8,'x','Obcy','Użytkownik','OWNER','active')`,
      [
        OWNER_ID, ORG_ID, `owner-${RUN}@seedtest.local`,
        MEMBER_ID, `member-${RUN}@seedtest.local`,
        FOREIGN_USER_ID, FOREIGN_ORG_ID, `obcy-${RUN}@seedtest.local`,
      ]
    );
    await pool.query(
      `INSERT INTO organization_members(id,organization_id,user_id,role,status) VALUES
         ($1,$2,$3,'OWNER','ACTIVE'),($4,$2,$5,'ADMIN','ACTIVE'),($6,$7,$8,'OWNER','ACTIVE')`,
      [
        `${RUN}-m1`, ORG_ID, OWNER_ID,
        `${RUN}-m2`, MEMBER_ID,
        `${RUN}-m3`, FOREIGN_ORG_ID, FOREIGN_USER_ID,
      ]
    );
    await pool.query(
      `INSERT INTO rvn_platform_visibility_policies
         (policy_id,organization_id,domain,policy_version,visibility_mode,created_by)
       VALUES ($1,$2,'kpi',1,'OPEN_ORG',$3)`,
      [FOREIGN_POLICY_ID, FOREIGN_ORG_ID, FOREIGN_USER_ID]
    );
    await pool.query(
      `INSERT INTO rvn_kpi_definitions
         (kpi_id,organization_id,kpi_code,status,owner_user_id,created_by)
       VALUES ($1,$2,'OBCY_KPI','active',$3,$3)`,
      [FOREIGN_KPI_ID, FOREIGN_ORG_ID, FOREIGN_USER_ID]
    );

    const client = await pool.connect();
    try {
      ctx = await buildContext(client, ORG_NAME, false);
      plan = buildPlan(ctx.org.id, ctx.owners);
    } finally {
      client.release();
    }
  }, 180_000);

  afterAll(async () => {
    if (!pool) return;
    const client = await pool.connect();
    try {
      await rollbackSeed(client, ctx, plan);
    } catch {
      /* sprzątanie nie może przykryć wyniku testu */
    } finally {
      client.release();
    }
    // Sprzątanie jest best-effort: `rvn_roi_visibility_governance` jest
    // append-only (trigger blokuje DELETE) i trzyma klucz obcy na
    // organizations, więc w jednorazowej bazie testowej część wierszy
    // zostaje. Błąd sprzątania nie może przykryć wyniku testu.
    const safe = async (sql: string, params: unknown[]) => {
      try {
        await pool.query(sql, params);
      } catch {
        /* jednorazowa baza — sprzątanie nie jest twierdzeniem testu */
      }
    };
    await safe(`DELETE FROM rvn_kpi_definitions WHERE organization_id = ANY($1::text[])`, [[ORG_ID, FOREIGN_ORG_ID]]);
    await safe(`DELETE FROM rvn_platform_visibility_policies WHERE organization_id = ANY($1::text[])`, [[ORG_ID, FOREIGN_ORG_ID]]);
    await safe(`UPDATE okr_vnext_programs SET active_policy_version_id = NULL WHERE organization_id = $1`, [ORG_ID]);
    await safe(`DELETE FROM okr_vnext_program_policy_versions WHERE organization_id = $1`, [ORG_ID]);
    await safe(`DELETE FROM okr_vnext_programs WHERE organization_id = $1`, [ORG_ID]);
    await safe(`DELETE FROM organization_members WHERE organization_id = ANY($1::text[])`, [[ORG_ID, FOREIGN_ORG_ID]]);
    await safe(`DELETE FROM users WHERE organization_id = ANY($1::text[])`, [[ORG_ID, FOREIGN_ORG_ID]]);
    await safe(`DELETE FROM organizations WHERE id = ANY($1::text[])`, [[ORG_ID, FOREIGN_ORG_ID]]);
    await pool.end();
  }, 180_000);

  it('plan jest niepusty i przed apply w bazie nie ma ANI JEDNEGO wiersza seeda', async () => {
    const client = await pool.connect();
    try {
      const planned = plannedCounts(ctx, plan);
      expect(planned.kpiDefinitions).toBe(138);
      expect(planned.kpiMeasurements).toBeGreaterThan(1000);
      expect(planned.scorecards).toBe(3);
      expect(planned.okrSets).toBe(3);
      expect(planned.roiCases).toBe(3);
      const before = await countExisting(client, ctx, plan);
      for (const [key, value] of Object.entries(before)) expect([key, value]).toEqual([key, 0]);
    } finally {
      client.release();
    }
  }, 180_000);

  it('apply wstawia dokładnie tyle wierszy, ile zaplanowano', async () => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await buildContext(client, ORG_NAME, true);
      await applySeed(client, ctx, plan);
      await client.query('COMMIT');
      const after = await countExisting(client, ctx, plan);
      expect(after).toEqual(plannedCounts(ctx, plan));
    } finally {
      client.release();
    }
  }, 600_000);

  it('powtórny apply nie dokłada ani jednego wiersza (idempotencja)', async () => {
    const client = await pool.connect();
    try {
      const totalsBefore = await client.query(TOTALS_SQL);
      await client.query('BEGIN');
      await buildContext(client, ORG_NAME, true);
      await applySeed(client, ctx, plan);
      await client.query('COMMIT');
      const totalsAfter = await client.query(TOTALS_SQL);
      expect(totalsAfter.rows[0]?.n).toBe(totalsBefore.rows[0]?.n);
    } finally {
      client.release();
    }
  }, 600_000);

  it('dane są widoczne przez realną ścieżkę odczytu aplikacji, nie tylko obecne w tabelach', async () => {
    const { listScorecards, getScorecardStatusDistribution } = await import(
      '../kpi/kpiScorecardRepository.js'
    );
    const { listOkrSets } = await import('../okr/okrSetRepository.js');
    const { listRoiCases } = await import('../roi/roiRepository.js');

    const scorecards = await listScorecards({ userId: ctx.owners[0]!, organizationId: ctx.org.id });
    expect(scorecards.map((s) => s.name).sort()).toEqual(
      ['KPI jakości — sierpień 2026', 'KPI produkcji — Q3 2026', 'Plant Balanced Scorecard — Zakład DBR77'].sort()
    );

    const main = scorecards.find((s) => s.name.startsWith('Plant Balanced Scorecard'))!;
    const distribution = await getScorecardStatusDistribution({
      userId: ctx.owners[0]!,
      organizationId: ctx.org.id,
      scorecardId: main.scorecardId,
      asOf: '2026-09-05T00:00:00.000Z',
    });
    expect(distribution).toMatchObject({ safe: 93, warning: 21, critical: 8, missing: 16, totalVisible: 138 });

    const sets = await listOkrSets({ userId: ctx.owners[0]!, organizationId: ctx.org.id });
    expect(sets.filter((s) => s.title.startsWith('OKR'))).toHaveLength(3);

    const roi = await listRoiCases({ userId: ctx.owners[0]!, organizationId: ctx.org.id });
    expect(roi.map((r) => r.title).sort()).toEqual(
      ['Automatyzacja magazynu WIP', 'Robotyzacja gniazda spawalniczego', 'System wizyjny kontroli jakości'].sort()
    );
  }, 300_000);

  it('rollback zostawia zero wierszy seeda, a wiersze cudzej organizacji są nietknięte', async () => {
    const foreignBefore = await foreignRowFingerprint();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await rollbackSeed(client, ctx, plan);
      await client.query('COMMIT');
      const after = await countExisting(client, ctx, plan);
      for (const [key, value] of Object.entries(after)) expect([key, value]).toEqual([key, 0]);
    } finally {
      client.release();
    }
    expect(await foreignRowFingerprint()).toEqual(foreignBefore);
    expect(foreignBefore.kpis).toBe('1');
    expect(foreignBefore.policies).toBe('1');
  }, 600_000);
});
