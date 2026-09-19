/**
 * D-136 / DEC-685 (KANAL [D] Wpis 214) — RealPG dowód migracji 20262304.
 *
 * DEFECT THIS PINS: `scim.routes.ts` reads and writes five objects that no
 * applied migration ever created — `users.scim_external_id`,
 * `users.scim_provisioned`, `users.scim_last_sync_at`,
 * `idx_users_scim_external_id`, `idx_scim_conflicts_org`. The ledger row for
 * `656_v4_scim_enhanced.sql` is `skipped:cf5aec4e…` (applied_at
 * 2026-03-16T17:31:37.078Z), i.e. the file was recorded without being run, and
 * the copy that survives in `never-ran/` has since diverged. Measured on live
 * staging and on a fresh dump restore: 0 of 5 present.
 *
 * Because the route calls `DbPromise.all(..., { fallback: true })`
 * (scim.routes.ts:329), a missing column resolves to `[]` instead of throwing,
 * so SCIM answered `totalResults: 0` for 52 real users — a silent empty
 * directory, not a 500. Test T1 pins exactly that mechanism, before and after.
 *
 * Migration 20262304 adds the five objects; these tests go RED if any one of
 * them is removed from the file (T2/T3 read the migration from disk, they do
 * not mirror it), and T7/T8 pin the source contract: three `ADD COLUMN`, two
 * `CREATE INDEX`, and a down that drops ONLY those five objects (the D-133
 * lesson — a down must never touch another migration's table).
 *
 * Runner-level evidence (preflight `Pending migrations: 1`, UP→DOWN→UP RC=0,
 * `pg_dump -s` diffs) lives in `evidence/d136-scim-objects-20260919/`.
 *
 * FAIL-CLOSED GATE (standard W164b): in CI without RUN_DB_TESTS this file
 * throws at collection (RC=1); locally without RUN_DB_TESTS it skips.
 *
 * This file executes the DOWN (three DROP COLUMN), so it refuses any
 * DATABASE_URL that is not loopback.
 *
 * Uruchomienie (pula D, kontener qoder-d-pg-6, kopia dumpu stagingu):
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *     DATABASE_URL=postgresql://postgres:<hasło-lokalne>@127.0.0.1:6635/consultify_d136 \
 *     npx vitest run server/src/routes/integrations/__tests__/scimMissingObjects.pg.test.ts --retry=0
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { all as dbAll } from '../../../utils/DbPromise.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(HERE, '../../../../migrations');
const MIGRATION_FILE = '20262304_scim_missing_objects.sql';
const DOWN_FILE = path.join('rollback', '20262304_scim_missing_objects.down.sql');

const ENV_AT_LOAD = {
  RUN_DB_TESTS: process.env.RUN_DB_TESTS,
  DATABASE_URL: process.env.DATABASE_URL,
};

const OPT_OUT = new Set(['', '0', 'false', 'no', 'off']);
const DB_TESTS_DEMANDED =
  ENV_AT_LOAD.RUN_DB_TESTS !== undefined &&
  !OPT_OUT.has(String(ENV_AT_LOAD.RUN_DB_TESTS).trim().toLowerCase());

const IN_CI = Boolean(process.env.CI || process.env.GITHUB_ACTIONS);
if (IN_CI && !DB_TESTS_DEMANDED) {
  throw new Error(
    'RealPG evidence must never be skipped in CI: set RUN_DB_TESTS=1 and DATABASE_URL'
  );
}

const CONNECTION_STRING = ENV_AT_LOAD.DATABASE_URL ?? '';
const REAL_DB =
  DB_TESTS_DEMANDED &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');

if (REAL_DB) process.env.DB_TYPE = 'postgres';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);
if (REAL_DB) {
  const host = new URL(CONNECTION_STRING).hostname;
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new Error(
      `scimMissingObjects.pg.test.ts executes DROP COLUMN — refusing non-loopback host "${host}"`
    );
  }
}

/** Verbatim from scim.routes.ts:327-329 (SCIM GET /Users list branch). */
const ROUTE_LIST_QUERY = `SELECT id, email, first_name, last_name, is_active, scim_external_id, scim_last_sync_at, created_at
         FROM users WHERE organization_id = ? LIMIT ? OFFSET ?`;

const COLUMNS = ['scim_external_id', 'scim_provisioned', 'scim_last_sync_at'] as const;
const INDEXES = ['idx_users_scim_external_id', 'idx_scim_conflicts_org'] as const;

const ORG = 'org-d136-scim';
const USER_A = `user-d136-a-${Date.now()}`;
const USER_B = `user-d136-b-${Date.now()}`;
const USER_C = `user-d136-c-${Date.now()}`;
const EXTERNAL_ID = `ext-d136-${Date.now()}`;

describe.skipIf(!REAL_DB)('D-136 — SCIM missing objects (real PostgreSQL)', () => {
  let pool: pg.Pool;
  let client: pg.PoolClient;
  let usersColumnCountBefore = 0;
  let conflictLogColumnCountBefore = 0;

  const sql = (file: string): string => readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');

  /** Header prose mentions DDL it does not run ("CREATE TABLE block", "Drops ONLY"). */
  const codeOnly = (src: string): string => src.replace(/^\s*--.*$/gm, '');

  const presentColumns = async (): Promise<string[]> => {
    const { rows } = await client.query(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name = ANY($1::text[]) ORDER BY column_name`,
      [[...COLUMNS]]
    );
    return rows.map((r) => r.column_name);
  };

  const presentIndexes = async (): Promise<string[]> => {
    const { rows } = await client.query(
      `SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = ANY($1::text[]) ORDER BY indexname`,
      [[...INDEXES]]
    );
    return rows.map((r) => r.indexname);
  };

  const objectCount = async (): Promise<number> =>
    (await presentColumns()).length + (await presentIndexes()).length;

  const tableColumnCount = async (table: string): Promise<number> => {
    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1`,
      [table]
    );
    return rows[0].n;
  };

  const cleanup = async (): Promise<void> => {
    await client.query(`DELETE FROM users WHERE organization_id = $1`, [ORG]);
    await client.query(`DELETE FROM organizations WHERE id = $1`, [ORG]);
  };

  /**
   * Deterministic pre-state. The down file is tried first; if a previous run
   * left a partial object set (the mutation proof does exactly that) the down
   * cannot run, so the five objects are dropped explicitly by name.
   */
  const resetToBaseline = async (): Promise<void> => {
    await cleanup();
    if ((await objectCount()) === 0) return;
    try {
      await client.query(sql(DOWN_FILE));
    } catch {
      await client.query('ROLLBACK').catch(() => undefined);
    }
    if ((await objectCount()) === 0) return;
    for (const index of INDEXES) await client.query(`DROP INDEX IF EXISTS ${index}`);
    for (const column of COLUMNS) {
      await client.query(`ALTER TABLE users DROP COLUMN IF EXISTS ${column}`);
    }
  };

  beforeAll(async () => {
    pool = new pg.Pool({ connectionString: CONNECTION_STRING });
    client = await pool.connect();

    await resetToBaseline();

    usersColumnCountBefore = await tableColumnCount('users');
    conflictLogColumnCountBefore = await tableColumnCount('scim_conflict_log');

    await client.query(`INSERT INTO organizations (id, name) VALUES ($1, $2)`, [
      ORG,
      'D-136 SCIM probe org',
    ]);
  });

  afterAll(async () => {
    if (client) {
      // Leave the copy migrated, matching the runner cycle's final state.
      if ((await objectCount()) !== 5) {
        await resetToBaseline();
        await client.query(sql(MIGRATION_FILE));
      }
      await cleanup();
      client.release();
    }
    await pool?.end();
  });

  it('T0 preflight: kopia dumpu nie ma żadnego z 5 obiektów SCIM', async () => {
    expect(await presentColumns()).toEqual([]);
    expect(await presentIndexes()).toEqual([]);
  });

  it('T1 wpięcie PRE: zapytanie trasy SCIM milczy (fallback:true → []), a z fallback:false rzuca brak kolumny', async () => {
    await expect(dbAll(ROUTE_LIST_QUERY, [ORG, 10, 0], { fallback: true })).resolves.toEqual([]);
    await expect(
      dbAll(ROUTE_LIST_QUERY, [ORG, 10, 0], { fallback: false })
    ).rejects.toThrow(/scim_external_id/);
  });

  it('T2 UP z pliku migracji tworzy dokładnie te 5 obiektów', async () => {
    await client.query(sql(MIGRATION_FILE));
    expect(await presentColumns()).toEqual([...COLUMNS].sort());
    expect(await presentIndexes()).toEqual([...INDEXES].sort());
  });

  it('T3 typy, domyślne i definicje indeksów są zgodne z blobem historycznym', async () => {
    const { rows } = await client.query(
      `SELECT column_name, data_type, is_nullable, column_default
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name = ANY($1::text[])`,
      [[...COLUMNS]]
    );
    const byName = Object.fromEntries(rows.map((r) => [r.column_name, r]));

    expect(byName.scim_external_id.data_type).toBe('text');
    expect(byName.scim_external_id.is_nullable).toBe('YES');
    expect(byName.scim_external_id.column_default).toBeNull();

    expect(byName.scim_provisioned.data_type).toBe('boolean');
    expect(byName.scim_provisioned.column_default).toBe('false');

    expect(byName.scim_last_sync_at.data_type).toBe('timestamp with time zone');
    expect(byName.scim_last_sync_at.column_default).toBeNull();

    const { rows: idx } = await client.query(
      `SELECT indexname, indexdef FROM pg_indexes
        WHERE schemaname = 'public' AND indexname = ANY($1::text[])`,
      [[...INDEXES]]
    );
    const defs = Object.fromEntries(idx.map((r) => [r.indexname, r.indexdef]));

    expect(defs.idx_users_scim_external_id).toMatch(/UNIQUE INDEX/);
    expect(defs.idx_users_scim_external_id).toMatch(/ON (public\.)?users/);
    expect(defs.idx_users_scim_external_id).toMatch(/\(scim_external_id\)/);
    expect(defs.idx_users_scim_external_id).toMatch(
      /WHERE \(scim_external_id IS NOT NULL\)/
    );

    expect(defs.idx_scim_conflicts_org).toMatch(/INDEX/);
    expect(defs.idx_scim_conflicts_org).not.toMatch(/UNIQUE/);
    expect(defs.idx_scim_conflicts_org).toMatch(/ON (public\.)?scim_conflict_log/);
    expect(defs.idx_scim_conflicts_org).toMatch(/\(organization_id\)/);
  });

  it('T4 wpięcie PO: to samo zapytanie trasy zwraca wiersz z kluczami scim_*', async () => {
    await client.query(
      `INSERT INTO users (id, organization_id, email, first_name, last_name, is_active,
                          scim_external_id, scim_provisioned, scim_last_sync_at)
       VALUES ($1, $2, $3, 'Ada', 'Lovelace', '1', $4, TRUE, now())`,
      [USER_A, ORG, `d136-a-${Date.now()}@example.test`, EXTERNAL_ID]
    );

    const rows = await dbAll<any>(ROUTE_LIST_QUERY, [ORG, 10, 0], { fallback: true });
    // The route computes totalResults from this very array (scim.routes.ts:335).
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(USER_A);
    expect(rows[0].scim_external_id).toBe(EXTERNAL_ID);
    expect(Object.keys(rows[0])).toEqual(
      expect.arrayContaining(['scim_external_id', 'scim_last_sync_at'])
    );
    expect(rows[0].scim_last_sync_at).toBeInstanceOf(Date);
  });

  it('T5 unikalny indeks częściowy: duplikat external_id odrzucony, NULL wiele razy dozwolony', async () => {
    await expect(
      client.query(
        `INSERT INTO users (id, organization_id, email, scim_external_id)
         VALUES ($1, $2, $3, $4)`,
        [USER_B, ORG, `d136-b-${Date.now()}@example.test`, EXTERNAL_ID]
      )
    ).rejects.toMatchObject({ code: '23505' });

    await client.query(
      `INSERT INTO users (id, organization_id, email, scim_external_id)
       VALUES ($1, $2, $3, NULL)`,
      [USER_C, ORG, `d136-c-${Date.now()}@example.test`]
    );
    await client.query(
      `INSERT INTO users (id, organization_id, email, scim_external_id)
       VALUES ($1, $2, $3, NULL)`,
      [`user-d136-d-${Date.now()}`, ORG, `d136-d-${Date.now()}@example.test`]
    );

    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM users WHERE organization_id = $1`,
      [ORG]
    );
    expect(rows[0].n).toBe(3);
  });

  it('T6 idempotencja: ponowne zastosowanie UP nie zmienia schematu', async () => {
    const before = await objectCount();
    await client.query(sql(MIGRATION_FILE));
    expect(await objectCount()).toBe(before);
    expect(before).toBe(5);
  });

  it('T7 źródło migracji: dokładnie 3 ADD COLUMN IF NOT EXISTS + 2 CREATE INDEX IF NOT EXISTS, zero DROP', async () => {
    const up = codeOnly(sql(MIGRATION_FILE));
    expect(up.match(/ADD COLUMN IF NOT EXISTS/g) ?? []).toHaveLength(3);
    expect(up.match(/CREATE UNIQUE INDEX IF NOT EXISTS/g) ?? []).toHaveLength(1);
    expect(up.match(/CREATE (?:UNIQUE )?INDEX IF NOT EXISTS/g) ?? []).toHaveLength(2);
    for (const column of COLUMNS) expect(up).toContain(column);
    for (const index of INDEXES) expect(up).toContain(index);
    expect(up).not.toMatch(/\bDROP\b/i);
    expect(up).not.toMatch(/CREATE TABLE/i);
  });

  it('T8 DOWN cofa wyłącznie te 5 obiektów — bez DROP TABLE, tabele i reszta kolumn nietknięte', async () => {
    const down = sql(DOWN_FILE);
    const downCode = codeOnly(down);
    expect(downCode).not.toMatch(/DROP TABLE/i);
    expect(downCode.match(/DROP COLUMN IF EXISTS/g) ?? []).toHaveLength(3);
    expect(downCode.match(/DROP INDEX IF EXISTS/g) ?? []).toHaveLength(2);
    expect(downCode).toMatch(/RAISE EXCEPTION/); // fail-closed guard on provisioning data

    await cleanup(); // the T4 row carries SCIM state and would trip the guard
    await client.query(down);

    expect(await objectCount()).toBe(0);
    expect(await tableColumnCount('users')).toBe(usersColumnCountBefore);
    expect(await tableColumnCount('scim_conflict_log')).toBe(conflictLogColumnCountBefore);
  });
});
