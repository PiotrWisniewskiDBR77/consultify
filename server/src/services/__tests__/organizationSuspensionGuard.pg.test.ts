/**
 * DEC-91 / TRI-MUST-12 — organization suspension enforcement, proved against a
 * REAL PostgreSQL rather than against a mock that agrees with itself.
 *
 * ===========================================================================
 * WHY A REAL DATABASE
 * ===========================================================================
 * The unit suites inject a `dbGet` double. A double will happily answer a
 * query against a column that does not exist, a table spelled differently, or
 * a status vocabulary nobody writes. The claim that actually matters for
 * DEC-91 — "a tenant that the SUPERADMIN suspend endpoint marked as suspended
 * is refused, and its neighbour is not" — can only be settled against the
 * schema the product really ships.
 *
 * So this suite:
 *   1. creates its OWN scratch database (nothing pre-existing is touched, and
 *      `CREATE TABLE IF NOT EXISTS` cannot silently no-op against a table an
 *      earlier run left behind);
 *   2. applies the REAL project migrations that define `organizations`,
 *      `users` and `organization_members`;
 *   3. writes the tenant rows the way the product writes them — via the exact
 *      `UPDATE organizations SET status = ...` statement the superadmin
 *      suspend/reactivate handlers use;
 *   4. drives the REAL exported `verifyToken` (and therefore `attachUser` and
 *      the guard) with a Postgres-backed `dbGet`.
 *
 * Step 4 is the falsifiable one: remove the guard call from `attachUser` and
 * the suspended-tenant case below passes the request through instead of 403ing.
 *
 * ===========================================================================
 * FAIL-CLOSED GATE
 * ===========================================================================
 * Keyed on `RUN_DB_TESTS` READ AT MODULE LOAD, so the suite cannot talk itself
 * out of running:
 *   - unset (or ``/`0`/`false`/`no`/`off`) → skip, loudly, with a reason;
 *   - set to anything else                 → a missing/unreachable PostgreSQL
 *                                            is a FAILURE, never a green skip.
 *
 * How it was actually run for DEC-91:
 *
 *   docker run -d --name cx-suspend-pg -e POSTGRES_PASSWORD=postgres \
 *     -e POSTGRES_DB=consultify_test -p 4323:5432 pgvector/pgvector:pg16
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *     DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:4323/consultify_test \
 *     npx vitest run server/src/services/__tests__/organizationSuspensionGuard.pg.test.ts
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextFunction, Response } from 'express';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  type AuthRequest,
  setDependencies,
  verifyToken,
} from '../../middleware/auth.middleware.js';
import {
  __testing__,
  invalidateOrganizationSuspensionCache,
  isOrganizationSuspended,
} from '../organizationSuspensionGuard.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(HERE, '../../../migrations');

/** Real project migrations that define the tables this suite needs. */
const REQUIRED_MIGRATIONS = [
  '000_initdb_core_tables.sql', // organizations, users
  // organizations.updated_at — the baseline table above does NOT have it, but
  // the production suspend/reactivate statement writes it. Applying the real
  // alignment migration keeps `setOrgStatus` below byte-identical to the
  // handler instead of quietly dropping the clause to suit the fixture.
  '20260303_schema_alignment.sql',
  '20260412_organization_switch_log.sql', // organization_members
];

/** Read ONCE, before any beforeAll can mutate process.env. */
const ENV_AT_LOAD = {
  RUN_DB_TESTS: process.env.RUN_DB_TESTS,
  DATABASE_URL: process.env.DATABASE_URL,
};

const OPT_OUT = new Set(['', '0', 'false', 'no', 'off']);
const DB_TESTS_DEMANDED =
  ENV_AT_LOAD.RUN_DB_TESTS !== undefined &&
  !OPT_OUT.has(String(ENV_AT_LOAD.RUN_DB_TESTS).trim().toLowerCase());

const SUSPENDED_ORG = 'pgorg-suspended';
const ACTIVE_ORG = 'pgorg-active';

let pool: pg.Pool | null = null;
let adminPool: pg.Pool | null = null;
let scratchDbName = '';
let skipReason = 'RUN_DB_TESTS is not set';
let usable = false;

/** `?` placeholders (the codebase's dialect) -> `$n`, as the runtime adapter does. */
const toPositional = (sql: string): string => {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
};

/** dbGet backed by the real scratch database. */
const pgDbGet = async <T>(sql: string, params: unknown[] = []): Promise<T | undefined> => {
  if (!pool) throw new Error('pool not ready');
  const result = await pool.query(toPositional(sql), params as never[]);
  return (result.rows[0] as T) ?? undefined;
};

const baseUrl = (): URL | null => {
  const raw = ENV_AT_LOAD.DATABASE_URL;
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
};

beforeAll(async () => {
  if (!DB_TESTS_DEMANDED) {
    skipReason = 'RUN_DB_TESTS is not set — this suite skips on purpose';
    return;
  }

  const url = baseUrl();
  if (!url) {
    throw new Error(
      '[DEC-91 pg] FAIL-CLOSED: RUN_DB_TESTS demanded a real database but ' +
        'DATABASE_URL is missing or unparseable. Unset RUN_DB_TESTS to skip.'
    );
  }

  // Scratch database, so nothing pre-existing is touched and IF NOT EXISTS
  // cannot no-op against a leftover table.
  scratchDbName = `dec91_suspend_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const adminUrl = new URL(url.toString());
  adminUrl.pathname = '/postgres';
  adminPool = new pg.Pool({ connectionString: adminUrl.toString(), max: 1 });
  await adminPool.query(`CREATE DATABASE "${scratchDbName}"`);

  const scratchUrl = new URL(url.toString());
  scratchUrl.pathname = `/${scratchDbName}`;
  pool = new pg.Pool({ connectionString: scratchUrl.toString(), max: 4 });

  for (const file of REQUIRED_MIGRATIONS) {
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    await pool.query(sql);
  }

  // Two tenants and one member each. Both start ACTIVE, so the suspension
  // below is a real transition and not a fixture that was born blocked.
  await pool.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1,$2,$3,$4), ($5,$6,$7,$8)`,
    [SUSPENDED_ORG, 'Tenant A', 'pro', 'active', ACTIVE_ORG, 'Tenant B', 'pro', 'active']
  );
  await pool.query(
    `INSERT INTO users (id, organization_id, email, password, role, status)
     VALUES ($1,$2,$3,$4,$5,$6), ($7,$8,$9,$10,$11,$12)`,
    [
      `user-of-${SUSPENDED_ORG}`,
      SUSPENDED_ORG,
      'a@example.test',
      'x',
      'ADMIN',
      'active',
      `user-of-${ACTIVE_ORG}`,
      ACTIVE_ORG,
      'b@example.test',
      'x',
      'ADMIN',
      'active',
    ]
  );
  await pool.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1,$2,$3,$4,$5), ($6,$7,$8,$9,$10)`,
    [
      `m-${SUSPENDED_ORG}`,
      SUSPENDED_ORG,
      `user-of-${SUSPENDED_ORG}`,
      'ADMIN',
      'ACTIVE',
      `m-${ACTIVE_ORG}`,
      ACTIVE_ORG,
      `user-of-${ACTIVE_ORG}`,
      'ADMIN',
      'ACTIVE',
    ]
  );

  usable = true;
}, 120_000);

afterAll(async () => {
  __testing__.reset();
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

/**
 * Suspend / reactivate through the EXACT statement the superadmin handlers use
 * (`superadmin.routes.ts` #1 / #1b), then invalidate exactly as they do.
 */
const setOrgStatus = async (orgId: string, status: string): Promise<void> => {
  await pool!.query(
    'UPDATE organizations SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
    [status, orgId]
  );
  invalidateOrganizationSuspensionCache(orgId);
};

interface Captured {
  status: number | null;
  body: Record<string, unknown> | null;
  passed: boolean;
}

/** Drive the real verifyToken against the real database for one tenant. */
const request = async (orgId: string, url = '/api/initiatives'): Promise<Captured> => {
  const claims = {
    id: `user-of-${orgId}`,
    email: `${orgId}@example.test`,
    name: 'Member',
    role: 'ADMIN',
    organizationId: orgId,
    isSuperAdmin: false,
  };

  setDependencies({
    jwt: {
      verify: (_t: string, _s: string, ...rest: unknown[]) => {
        (rest[rest.length - 1] as (e: unknown, d: unknown) => void)(null, claims);
      },
      decode: () => claims,
    } as never,
    config: { JWT_SECRET: 'dec91-test-secret' },
    PermissionService: { can: () => true } as never,
    dbGet: pgDbGet as never,
  });

  const captured: Captured = { status: null, body: null, passed: false };
  const req = {
    headers: { authorization: 'Bearer aaa.bbb.ccc' },
    body: {},
    query: {},
    cookies: {},
    method: 'GET',
    url,
    originalUrl: url,
    path: url,
  } as unknown as AuthRequest;
  const res = {
    status(code: number) {
      captured.status = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      captured.body = body;
      return this;
    },
    setHeader() {
      return this;
    },
  } as unknown as Response;
  const next: NextFunction = () => {
    captured.passed = true;
  };

  await verifyToken(req, res, next);
  return captured;
};

const guard = (name: string, fn: () => Promise<void>) =>
  it(name, async () => {
    if (!usable) {
      // eslint-disable-next-line no-console
      console.warn(`[DEC-91 pg] SKIPPED: ${skipReason}`);
      return;
    }
    await fn();
  }, 60_000);

describe('DEC-91 organization suspension against a real PostgreSQL', () => {
  guard('baseline: both tenants are active and both pass', async () => {
    __testing__.reset();
    expect((await request(SUSPENDED_ORG)).passed).toBe(true);
    expect((await request(ACTIVE_ORG)).passed).toBe(true);
  });

  guard('suspending tenant A refuses A and leaves tenant B untouched', async () => {
    await setOrgStatus(SUSPENDED_ORG, 'suspended');

    const blocked = await request(SUSPENDED_ORG);
    expect(blocked.status).toBe(403);
    expect(blocked.body).toMatchObject({ code: 'ORG_SUSPENDED' });
    expect(blocked.passed).toBe(false);

    // NEGATIVE CONTROL: the suspension is tenant-scoped, not global.
    const neighbour = await request(ACTIVE_ORG);
    expect(neighbour.status).toBeNull();
    expect(neighbour.passed).toBe(true);
  });

  guard('the guard reads the real organizations.status column', async () => {
    invalidateOrganizationSuspensionCache();
    await expect(isOrganizationSuspended(SUSPENDED_ORG, pgDbGet as never)).resolves.toBe(true);
    await expect(isOrganizationSuspended(ACTIVE_ORG, pgDbGet as never)).resolves.toBe(false);
    // A tenant id that is not in the table is not a suspension.
    await expect(isOrganizationSuspended('pgorg-nonexistent', pgDbGet as never)).resolves.toBe(
      false
    );
  });

  guard('an already-issued token keeps failing while the tenant stays suspended', async () => {
    // Same principal, several requests, no re-login: enforcement is on the
    // request, not on the session handshake.
    for (const url of ['/api/initiatives', '/api/results', '/api/finance/budgets']) {
      const result = await request(SUSPENDED_ORG, url);
      expect(result.status, url).toBe(403);
      expect(result.passed, url).toBe(false);
    }
  });

  guard('superadmin and logout surfaces stay reachable for the suspended tenant', async () => {
    for (const url of [
      '/api/superadmin/tenants/pgorg-suspended/reactivate',
      '/api/auth/logout',
      '/api/health/data-context',
    ]) {
      const result = await request(SUSPENDED_ORG, url);
      expect(result.status, url).toBeNull();
      expect(result.passed, url).toBe(true);
    }
  });

  guard('reactivation restores access once the cache is invalidated', async () => {
    expect((await request(SUSPENDED_ORG)).status).toBe(403);

    await setOrgStatus(SUSPENDED_ORG, 'active');

    const restored = await request(SUSPENDED_ORG);
    expect(restored.status).toBeNull();
    expect(restored.passed).toBe(true);

    const row = await pgDbGet<{ status: string }>('SELECT status FROM organizations WHERE id = ?', [
      SUSPENDED_ORG,
    ]);
    expect(row?.status).toBe('active');
  });
});
