/**
 * M20 — IDOR regression against a REAL Postgres database (no mocks).
 *
 * The existing regression suite (tests/integration/routes/table-platform.idor.regression.test.ts)
 * proves the *shape* of the guard by stubbing `PermissionsService.canAccessBase` and the DB layer —
 * it verifies the route calls the guard with the right arguments, not that the guard's own SQL
 * actually enforces the org boundary against a real database. This file closes that gap: it wires
 * up the REAL Express router (`table-platform.routes.ts`), the REAL `verifyToken` auth middleware,
 * and the REAL `PermissionsService.canAccessBase` (which runs `SELECT organization_id, created_by
 * FROM tp_bases WHERE id = $1` against Postgres) — two distinct organizations, two distinct users,
 * one `tp_bases` row seeded directly in org A, and a cross-org request from a user in org B.
 *
 * Auth: uses the same E2E_MODE unsigned-JWT bypass (server/src/middleware/auth.middleware.ts
 * ~L1030-1123) that tests/e2e/tools/collab-*.spec.ts rely on for real two-user Playwright runs —
 * here it lets us mint two distinct (userId, organizationId) identities without a login flow, while
 * still exercising the REAL `verifyToken` code path (not a mocked middleware).
 *
 * DB: mirrors the `pgReachable()` precondition pattern from
 * tests/integration/presentations/_helpers/alert-worker-pg-harness.ts — every test starts with a
 * fast connection probe and the whole suite reports a clean, non-failing skip when no reachable
 * Postgres is configured (e.g. a laptop with no `docker run postgres` container up). CI / a dev box
 * with Postgres reachable via DATABASE_URL / PGHOST gets true, unmocked coverage.
 *
 * HOW TO RUN LOCALLY (Docker available):
 *   docker run -d --name consultify-idor-pg -e POSTGRES_USER=iris -e POSTGRES_PASSWORD=iris_test \
 *     -e POSTGRES_DB=iris_test -p 5434:5432 postgres:15
 *   NODE_ENV=test DB_TYPE=postgres DATABASE_URL=postgres://iris:iris_test@localhost:5434/iris_test \
 *     npm run db:migrate   # --safe: tolerates the handful of pre-existing out-of-order migration
 *                           # gaps already known in this repo (see MEMORY finding "Staging schema
 *                           # drift"); tp_bases/tp_tables/tp_row_policies/organizations/users land fine.
 *   DATABASE_URL=postgres://iris:iris_test@localhost:5434/iris_test \
 *     npx vitest run tests/integration/table-platform.idor.realdb.test.ts
 *
 * Without a reachable Postgres (no DATABASE_URL/PGHOST, or connection fails) every test below
 * reports a vacuous pass via the `itDB` helper — exactly the `alert-worker.integration.test.ts`
 * convention — so `npm run test:integration` stays green on a machine with no DB.
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

import tablePlatformRoutes from '../../server/src/routes/table-platform.routes.js';

// ---------------------------------------------------------------------------
// Force the app's database factory to use a REAL Postgres pool + enable the
// E2E auth bypass, but ONLY when a database is actually configured — mirrors
// the `vi.hoisted()` env guard in alert-worker.integration.test.ts. Plain
// top-level statements are sufficient here (unlike that file) because none
// of the modules imported above touch the DB pool or read these env vars at
// module-evaluation time: `getDatabase()` connects lazily on first query,
// and `verifyToken` reads `process.env.E2E_MODE` inside its request handler,
// not at import time. This runs before any `beforeAll`/`it` body, which is
// the only place a real request (and therefore a real DB touch) happens.
// ---------------------------------------------------------------------------
if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  // Required for the unsigned-JWT auth bypass in auth.middleware.ts to
  // activate. Scoped to "DB is actually configured" so this file has zero
  // env footprint on a machine with no Postgres (harness stays null, no
  // request is ever issued, see `itDB`).
  process.env.E2E_MODE = 'true';
}

// ---------------------------------------------------------------------------
// Connection probe (same contract as alert-worker-pg-harness.ts's pgReachable)
// ---------------------------------------------------------------------------

const PROBE_TIMEOUT_MS = 2_000;

function readDatabaseUrl(): string | null {
  const raw = process.env.DATABASE_URL;
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.includes('${{')) return null;
  return trimmed;
}

function buildClientConfig(): ClientConfig | null {
  const databaseUrl = readDatabaseUrl();
  if (databaseUrl) {
    return {
      connectionString: databaseUrl,
      connectionTimeoutMillis: PROBE_TIMEOUT_MS,
      statement_timeout: 5_000,
    };
  }
  const host = process.env.PGHOST || process.env.DB_HOST;
  if (!host) return null;
  return {
    host,
    port: Number(process.env.PGPORT || process.env.DB_PORT || 5432),
    database: process.env.PGDATABASE || process.env.DB_NAME || 'postgres',
    user: process.env.PGUSER || process.env.DB_USER || 'postgres',
    password: process.env.PGPASSWORD || process.env.DB_PASSWORD || '',
    connectionTimeoutMillis: PROBE_TIMEOUT_MS,
    statement_timeout: 5_000,
  };
}

async function pgReachable(): Promise<boolean> {
  const config = buildClientConfig();
  if (!config) return false;
  const probe = new Client(config);
  try {
    await probe.connect();
    await probe.query('SELECT 1');
    return true;
  } catch {
    return false;
  } finally {
    try {
      await probe.end();
    } catch {
      // best-effort
    }
  }
}

async function tablesExist(client: Client, names: readonly string[]): Promise<boolean> {
  const result = await client.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY($1)`,
    [names as unknown as string[]]
  );
  const found = new Set(result.rows.map((r) => r.table_name));
  return names.every((n) => found.has(n));
}

const REQUIRED_TABLES = ['tp_bases', 'tp_tables', 'tp_row_policies', 'organizations', 'users'] as const;

// ---------------------------------------------------------------------------
// E2E identity minting (same shape as tests/e2e/tools/collab-*.spec.ts)
// ---------------------------------------------------------------------------

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8').toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function makeE2EToken(userId: string, organizationId: string): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'IDOR RealDB Test User',
    role: 'ADMIN',
    userRole: 'ADMIN',
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

// ---------------------------------------------------------------------------
// App under test — REAL router, REAL verifyToken, REAL PermissionsService.
// ---------------------------------------------------------------------------

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/table-platform', tablePlatformRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface Harness {
  client: Client;
  orgAId: string;
  orgBId: string;
  userAId: string;
  userBId: string;
  baseId: string;
  tableId: string;
  cleanup: () => Promise<void>;
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

async function setupHarness(): Promise<Harness | null> {
  if (!(await pgReachable())) return null;
  const config = buildClientConfig();
  if (!config) return null;

  const client = new Client(config);
  try {
    await client.connect();
  } catch {
    return null;
  }

  try {
    if (!(await tablesExist(client, REQUIRED_TABLES))) {
      await client.end().catch(() => {});
      return null;
    }
  } catch {
    await client.end().catch(() => {});
    return null;
  }

  const tag = suffix();
  const orgAId = `org_idor_a_${tag}`;
  const orgBId = `org_idor_b_${tag}`;
  const userAId = `user_idor_a_${tag}`;
  const userBId = `user_idor_b_${tag}`;
  // Owned by neither test user, so PermissionsService.canAccessBase's
  // `created_by === userId` shortcut can never accidentally grant access —
  // the only path to `allowed === true` is the `organization_id === orgId`
  // check, which is exactly the guard this file is proving.
  const createdBy = `user_idor_creator_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'IDOR RealDB Org A', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgAId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'IDOR RealDB Org B', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgBId]
  );

  const baseRes = await client.query<{ id: string }>(
    `INSERT INTO tp_bases (workspace_id, organization_id, name, created_by)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [`ws_idor_${tag}`, orgAId, 'IDOR RealDB Base (org A)', createdBy]
  );
  const baseId = baseRes.rows[0].id;

  const tableRes = await client.query<{ id: string }>(
    `INSERT INTO tp_tables (base_id, name, created_by) VALUES ($1, $2, $3) RETURNING id`,
    [baseId, 'IDOR RealDB Table (org A)', createdBy]
  );
  const tableId = tableRes.rows[0].id;

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM tp_row_policies WHERE table_id = $1`, [tableId]);
      await client.query(`DELETE FROM tp_tables WHERE id = $1`, [tableId]);
      await client.query(`DELETE FROM tp_bases WHERE id = $1`, [baseId]);
      // Best-effort: the E2E auth bypass auto-seeds `users` rows for whichever
      // identities actually authenticate (organizations/users.middleware.ts
      // ~L1076-1114); clean up anything it created for these test orgs.
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[orgAId, orgBId]]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgAId, orgBId]]);
    } catch {
      // Leaking a few rows is acceptable; a hung/throwing cleanup is not.
    }
    try {
      await client.end();
    } catch {
      // ignore
    }
  };

  return { client, orgAId, orgBId, userAId, userBId, baseId, tableId, cleanup };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('M20 — IDOR regression against a real Postgres database (no mocks)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — table-platform IDOR realdb tests skipped. ' +
        'See file header for the docker run + migrate + vitest command to exercise this suite locally.'
    );
  }

  beforeAll(async () => {
    harness = await setupHarness();
    if (!harness) emitSkipOnce();
  }, 30_000);

  afterAll(async () => {
    if (harness) {
      await harness.cleanup();
      harness = null;
    }
  });

  // Mirrors the `itDB` convention in alert-worker.integration.test.ts: when
  // the harness is unavailable, report a clean vacuous pass instead of
  // failing `npm run test:integration` on a machine with no Postgres.
  const itDB = (name: string, fn: (h: Harness) => Promise<void>, timeoutMs = 20_000) =>
    it(
      name,
      async () => {
        if (!harness) {
          expect(true).toBe(true);
          return;
        }
        await fn(harness);
      },
      timeoutMs
    );

  itDB('GET /bases/:baseId — 403 for a real user in a different real org (cross-org attack)', async (h) => {
    const app = buildApp();
    const attackerToken = makeE2EToken(h.userBId, h.orgBId);

    const res = await request(app)
      .get(`/api/table-platform/bases/${h.baseId}`)
      .set('Authorization', `Bearer ${attackerToken}`);

    expect(res.status).toBe(403);
    expect(res.body?.error).toMatch(/access denied/i);
  });

  itDB('GET /bases/:baseId — succeeds (no 403) for a real user in the SAME real org', async (h) => {
    const app = buildApp();
    const ownerOrgToken = makeE2EToken(h.userAId, h.orgAId);

    const res = await request(app)
      .get(`/api/table-platform/bases/${h.baseId}`)
      .set('Authorization', `Bearer ${ownerOrgToken}`);

    expect(res.status).not.toBe(403);
    expect(res.status).toBe(200);
    expect(res.body?.id).toBe(h.baseId);
  });

  itDB(
    'POST /tables/:tableId/row-policies — 403 for a real user in a different real org (write path)',
    async (h) => {
      const app = buildApp();
      const attackerToken = makeE2EToken(h.userBId, h.orgBId);

      const res = await request(app)
        .post(`/api/table-platform/tables/${h.tableId}/row-policies`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ name: 'Attacker policy', role: 'viewer' });

      expect(res.status).toBe(403);
      expect(res.body?.error).toMatch(/access denied/i);

      // Belt-and-suspenders: the attacker's request must not have left a row
      // behind even if the status code assertion above were ever weakened.
      const leaked = await h.client.query('SELECT id FROM tp_row_policies WHERE table_id = $1', [h.tableId]);
      expect(leaked.rows.length).toBe(0);
    }
  );

  itDB('GET /bases/:baseId — 401 with no token at all (sanity: auth is not accidentally optional)', async (h) => {
    const app = buildApp();
    const res = await request(app).get(`/api/table-platform/bases/${h.baseId}`);
    expect(res.status).toBe(401);
  });
});
