/**
 * B2 / N-2·N-3 (DEC-575) — `getUserOrganizations` proved against a REAL
 * PostgreSQL, not against a regex on a mock.
 *
 * ===========================================================================
 * WHY THIS FILE EXISTS
 * ===========================================================================
 * `organizationService.userOrganizations.test.ts` asserts the SHAPE of the SQL
 * string with regexes over a `dbAll` double. A double answers happily when the
 * query names a column that does not exist, a table spelled differently, or a
 * status vocabulary nobody writes — so that suite stays green even if the query
 * would throw against the shipped schema. CTO point 5 (KANAL Wpis 13) is exactly
 * this: "dowodzi kształtu SQL-regexem na mocku, nie działania zapytania".
 *
 * This suite drives the REAL exported `getUserOrganizations` against a scratch
 * database built from the REAL project migrations, and asserts on the ROWS that
 * come back. The three defects the fix targets are each falsifiable here:
 *
 *   1. membership status casing — `UPPER(TRIM(m.status)) = 'ACTIVE'`. A member
 *      row written 'active' (lowercase) and one written ' ACTIVE ' (padded) must
 *      BOTH be listed; a 'REVOKED' row must not. The pre-fix `m.status='ACTIVE'`
 *      dropped the first two.
 *   2. dead tenant — `AND o.is_active = 1`. An org with is_active = 0 and an
 *      otherwise ACTIVE membership must NOT be listed (switch-organization would
 *      403 it; a menu entry for it is a dead position).
 *   3. deterministic order on name ties — `ORDER BY is_current DESC, o.name ASC,
 *      o.id ASC`. Two orgs both named 'Tie' must come back id-ordered, so a no-op
 *      UPDATE cannot reshuffle the switcher.
 *
 * ===========================================================================
 * FAIL-CLOSED GATE (read at module load, before any beforeAll can mutate env)
 * ===========================================================================
 *   RUN_DB_TESTS unset / ''/0/false/no/off → skip loudly with a reason;
 *   RUN_DB_TESTS set to anything else      → a missing/unreachable PostgreSQL is
 *                                            a FAILURE, never a green skip.
 *
 * How it was run for B2 (PG18, B port pool):
 *
 *   docker run -d --name qoder-b-pg-1 -p 127.0.0.1:6610:5432 \
 *     -e POSTGRES_PASSWORD=qoder -e POSTGRES_DB=postgres pgvector/pgvector:pg18
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *     DATABASE_URL=postgresql://postgres:qoder@127.0.0.1:6610/postgres \
 *     npx vitest run server/src/services/__tests__/organizationService.userOrganizations.pg.test.ts
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import type { IDatabase } from '../../database/IDatabase.js';
import { getUserOrganizations, setDependencies } from '../organizationService.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(HERE, '../../../migrations');

/**
 * Real project migrations that build the exact schema this query reads, applied
 * in FK-safe order. All three are PostgreSQL-safe (no SQLite `DATETIME` /
 * `INSERT OR IGNORE` idioms), verified by grep before being chosen:
 *   - 000_initdb_core_tables.sql        → organizations (id, name, status,
 *                                         billing_status, is_active, …), users
 *   - 777_organizations_missing_columns → organizations.industry (the SELECT
 *                                         names it; initdb does not create it)
 *   - 20260412_organization_switch_log  → organization_members (FK → both above,
 *                                         so it must come last)
 */
const REQUIRED_MIGRATIONS = [
  '000_initdb_core_tables.sql',
  '777_organizations_missing_columns.sql',
  '20260412_organization_switch_log.sql',
];

const ENV_AT_LOAD = {
  RUN_DB_TESTS: process.env.RUN_DB_TESTS,
  DATABASE_URL: process.env.DATABASE_URL,
};

const OPT_OUT = new Set(['', '0', 'false', 'no', 'off']);
const DB_TESTS_DEMANDED =
  ENV_AT_LOAD.RUN_DB_TESTS !== undefined &&
  !OPT_OUT.has(String(ENV_AT_LOAD.RUN_DB_TESTS).trim().toLowerCase());

const USER = 'u-n2n3';
const ORG = {
  current: 'org-n2n3-alpha', // is_current anchor, name 'Alpha'
  lowercase: 'org-n2n3-beta', // membership 'active' — proves UPPER()
  inactiveOrg: 'org-n2n3-dead', // is_active 0 — proves the o.is_active filter
  tieD: 'org-n2n3-tie-d', // name 'Tie', id sorts before tie-e
  tieE: 'org-n2n3-tie-e', // name 'Tie' — proves the o.id tiebreaker
  padded: 'org-n2n3-zulu', // membership ' ACTIVE ' — proves TRIM()
  revoked: 'org-n2n3-revoked', // membership 'REVOKED' — must be excluded
} as const;

let pool: pg.Pool | null = null;
let adminPool: pg.Pool | null = null;
let scratchDbName = '';
let skipReason = 'RUN_DB_TESTS is not set';
let usable = false;

/**
 * Minimal `IDatabase` seam over the scratch pool. `DbPromise.all` has ALREADY
 * translated `?` → `$n` before it reaches `db.all`, so this runs the query text
 * byte-for-byte as the service authored it against the real migrated schema. If
 * a column the SELECT names does not exist, the query errors here — which is the
 * whole point the mock-based suite could never prove.
 */
function scratchDatabase(): IDatabase {
  return {
    all: (sql: string, params: unknown[], cb: (err: Error | null, rows?: unknown[]) => void) => {
      pool!.query(sql, params as never[])
        .then((result) => cb(null, result.rows))
        .catch((err: Error) => cb(err));
    },
  } as unknown as IDatabase;
}

function baseUrl(): URL | null {
  const raw = ENV_AT_LOAD.DATABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

beforeAll(async () => {
  if (!DB_TESTS_DEMANDED) {
    skipReason = 'RUN_DB_TESTS is not set — this suite skips on purpose';
    return;
  }

  const url = baseUrl();
  if (!url) {
    throw new Error(
      '[B2 N-2/N-3 pg] FAIL-CLOSED: RUN_DB_TESTS demanded a real database but ' +
        'DATABASE_URL is missing or unparseable. Unset RUN_DB_TESTS to skip.'
    );
  }

  // Empty scratch database — nothing pre-existing is touched, and `IF NOT EXISTS`
  // cannot silently no-op against a table an earlier run left behind. This is the
  // "fresh strict migrate from an empty DB" the CTO asked for.
  scratchDbName = `b2_n2n3_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const adminUrl = new URL(url.toString());
  adminUrl.pathname = '/postgres';
  adminPool = new pg.Pool({ connectionString: adminUrl.toString(), max: 1 });
  await adminPool.query(`CREATE DATABASE "${scratchDbName}"`);

  const scratchUrl = new URL(url.toString());
  scratchUrl.pathname = `/${scratchDbName}`;
  pool = new pg.Pool({ connectionString: scratchUrl.toString(), max: 4 });

  for (const file of REQUIRED_MIGRATIONS) {
    await pool.query(readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8'));
  }

  // The user's own base org is the `current` anchor (u.organization_id feeds the
  // COALESCE fallback for is_current).
  await pool.query(
    `INSERT INTO organizations (id, name, status, is_active, billing_status, industry)
     VALUES ($1,$2,$3,$4,$5,$6), ($7,$8,$9,$10,$11,$12), ($13,$14,$15,$16,$17,$18),
            ($19,$20,$21,$22,$23,$24), ($25,$26,$27,$28,$29,$30), ($31,$32,$33,$34,$35,$36),
            ($37,$38,$39,$40,$41,$42)`,
    [
      ORG.current, 'Alpha', 'active', 1, 'ACTIVE', 'General',
      ORG.lowercase, 'Beta', 'active', 1, 'ACTIVE', 'General',
      ORG.inactiveOrg, 'Dead', 'active', 0, 'ACTIVE', 'General',
      ORG.tieD, 'Tie', 'active', 1, 'ACTIVE', 'General',
      ORG.tieE, 'Tie', 'active', 1, 'ACTIVE', 'General',
      ORG.padded, 'Zulu', 'active', 1, 'ACTIVE', 'General',
      ORG.revoked, 'Revoked', 'active', 1, 'ACTIVE', 'General',
    ]
  );
  await pool.query(
    `INSERT INTO users (id, organization_id, email, password, role, status)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [USER, ORG.current, 'n2n3@example.test', 'x', 'ADMIN', 'active']
  );
  // One membership per org for the SAME user. role must satisfy the CHECK
  // (OWNER/ADMIN/MEMBER/CONSULTANT). status casing/whitespace is the variable
  // under test. The two 'Tie' rows are inserted E-before-D so heap/scan order
  // differs from id order — the assertion below is therefore not passing merely
  // by insertion luck. HONESTY NOTE (measured): on a fresh small scratch DB
  // PostgreSQL still returns the tie pair in id order even when `o.id ASC` is
  // removed, so the SQL tiebreaker is NOT mutation-falsifiable in this harness;
  // the determinism guarantee that IS mutation-proved lives in the controller JS
  // sort test (point 4). The SQL tiebreaker is kept as defense-in-depth matching
  // the staging defect (order reshuffled after a no-op UPDATE).
  const memberships: Array<[string, string, string]> = [
    [ORG.current, 'MEMBER', 'ACTIVE'],
    [ORG.lowercase, 'MEMBER', 'active'], // lowercase → UPPER() must keep it
    [ORG.inactiveOrg, 'MEMBER', 'ACTIVE'], // org is_active 0 → must be dropped
    [ORG.tieE, 'MEMBER', 'ACTIVE'], // inserted before tieD → scan order ≠ id order
    [ORG.tieD, 'MEMBER', 'ACTIVE'],
    [ORG.padded, 'MEMBER', ' ACTIVE '], // padded → TRIM() must keep it
    [ORG.revoked, 'MEMBER', 'REVOKED'], // non-active → must be dropped
  ];
  for (const [orgId, role, status] of memberships) {
    await pool.query(
      `INSERT INTO organization_members (id, organization_id, user_id, role, status)
       VALUES ($1,$2,$3,$4,$5)`,
      [`m-${orgId}`, orgId, USER, role, status]
    );
  }

  setDependencies({ db: scratchDatabase() });
  usable = true;
}, 180_000);

afterAll(async () => {
  await pool?.end().catch(() => undefined);
  pool = null;
  if (adminPool && scratchDbName) {
    await adminPool
      .query(`DROP DATABASE IF EXISTS "${scratchDbName}" WITH (FORCE)`)
      .catch(() => undefined);
  }
  await adminPool?.end().catch(() => undefined);
  adminPool = null;
}, 120_000);

const guard = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!usable) {
      // eslint-disable-next-line no-console
      console.warn(`[B2 N-2/N-3 pg] SKIPPED: ${skipReason}`);
      return;
    }
    await fn();
  }, 60_000);

describe('B2 N-2/N-3 — getUserOrganizations against a real PostgreSQL', () => {
  guard('lists exactly the live, ACTIVE-membership tenants in deterministic order', async () => {
    const rows = await getUserOrganizations(USER, ORG.current);
    const ids = rows.map((r) => r.id);

    // is_current DESC puts Alpha first; the rest by name ASC then id ASC.
    // Dead (is_active 0) and Revoked (membership REVOKED) are absent.
    expect(ids).toEqual([ORG.current, ORG.lowercase, ORG.tieD, ORG.tieE, ORG.padded]);
    expect(ids).not.toContain(ORG.inactiveOrg);
    expect(ids).not.toContain(ORG.revoked);

    // is_current is a real boolean from the PG expression, true only for Alpha.
    expect(rows.map((r) => r.is_current)).toEqual([true, false, false, false, false]);
    // The SELECT really names industry / billing_status against the live schema.
    expect(rows[0]).toMatchObject({ id: ORG.current, name: 'Alpha', industry: 'General' });
  });

  guard('point 1 — membership status is matched case- and whitespace-insensitively', async () => {
    const rows = await getUserOrganizations(USER, ORG.current);
    const ids = rows.map((r) => r.id);
    // 'active' (lowercase) and ' ACTIVE ' (padded) survive UPPER(TRIM(...)).
    expect(ids).toContain(ORG.lowercase);
    expect(ids).toContain(ORG.padded);
    // 'REVOKED' does not.
    expect(ids).not.toContain(ORG.revoked);
  });

  guard('point 2 — an inactive ORGANIZATION is never listed', async () => {
    const rows = await getUserOrganizations(USER, ORG.current);
    expect(rows.map((r) => r.id)).not.toContain(ORG.inactiveOrg);
  });

  guard('point 3 — equal names come back id-ordered, stable across a no-op UPDATE', async () => {
    const before = (await getUserOrganizations(USER, ORG.current)).map((r) => r.id);
    // The staging defect: a no-op UPDATE reshuffled tie rows because ORDER BY had
    // no final tiebreaker. With `o.id ASC` the order is pinned.
    await pool!.query(
      `UPDATE organizations SET name = name WHERE id IN ($1,$2)`,
      [ORG.tieD, ORG.tieE]
    );
    const after = (await getUserOrganizations(USER, ORG.current)).map((r) => r.id);
    expect(after).toEqual(before);
    const tieOrder = after.filter((id) => id === ORG.tieD || id === ORG.tieE);
    expect(tieOrder).toEqual([ORG.tieD, ORG.tieE]);
  });

  guard('is_current falls back to the user base org when no currentOrgId is given', async () => {
    const rows = await getUserOrganizations(USER);
    const current = rows.find((r) => r.is_current);
    expect(current?.id).toBe(ORG.current);
  });

  guard('a different user sees none of these tenants (read stays user-scoped)', async () => {
    await pool!.query(
      `INSERT INTO users (id, organization_id, email, password, role, status)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      ['u-other', ORG.current, 'other@example.test', 'x', 'ADMIN', 'active']
    );
    const rows = await getUserOrganizations('u-other', ORG.current);
    expect(rows).toEqual([]);
  });
});
