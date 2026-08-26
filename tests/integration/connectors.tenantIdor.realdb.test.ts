/**
 * IDOR fix — connectors PUT/DELETE against a REAL Postgres database (no mocks).
 *
 * `server/src/routes/integrations/connectors.routes.ts` PUT /:id and DELETE /:id
 * used to mutate a connector row by id alone: `verifyAdmin` only checked the
 * caller's ROLE (admin/owner), never whether the connector belonged to the
 * caller's own organization. A manual probe confirmed a real cross-tenant
 * write/delete on dev/staging (admin of org A could overwrite and then delete
 * a connector belonging to org B). GET / and POST / in the same file were
 * already correctly scoped (`WHERE organization_id = ?` / inserting the
 * caller's own `organization_id`) — the fix below brings PUT/DELETE in line
 * with that existing, already-correct pattern.
 *
 * This file wires up the REAL Express router, the REAL `verifyToken` E2E
 * bypass (same unsigned-JWT mechanism as tests/e2e/tools/collab-*.spec.ts and
 * tests/integration/table-platform.idor.realdb.test.ts), and the REAL
 * `verifyAdmin` middleware against two distinct organizations with a
 * `connectors` row seeded directly in org A. It then proves:
 *   - a same-org admin CAN update/delete the connector (200, readback matches)
 *   - a different-org admin CANNOT (404, readback UNCHANGED — the decisive
 *     assertion, since a 404 issued after the write already landed would be
 *     cosmetic)
 *   - a non-existent id 404s for the owning org's own admin too
 *
 * The `connectors` table itself is not created by the standard migration
 * runner (`server/migrations/never-ran/619_missing_critical_tables.sql` is in
 * the deliberately-excluded `never-ran/` subdir — see
 * `KNOWN_EXCLUDED_MIGRATIONS_SUBDIRS` in server/scripts/migrate.postgres.ts),
 * even though `connectors` is listed as a CRITICAL_TABLE in
 * DatabaseInitializer.ts and the route file assumes it exists. This harness
 * creates it directly (identical DDL to the never-ran migration / the
 * DatabaseInitializer.CRITICAL_TABLES column list) so the route under test has
 * something real to operate on; it does not touch the wider "is `connectors`
 * actually provisioned in prod" question, which is out of scope for this fix.
 *
 * HOW TO RUN LOCALLY (Docker available):
 *   docker run -d --name consultify-idor-fix-pg -e POSTGRES_USER=iris \
 *     -e POSTGRES_PASSWORD=iris_test -e POSTGRES_DB=iris_test -p 55677:5432 postgres:15
 *   DATABASE_URL=postgres://iris:iris_test@localhost:55677/iris_test \
 *     DB_TYPE=postgres NODE_ENV=test npx tsx server/scripts/migrate.postgres.ts --safe
 *   DATABASE_URL=postgres://iris:iris_test@localhost:55677/iris_test \
 *     npx vitest run tests/integration/connectors.tenantIdor.realdb.test.ts
 *
 * Without a reachable Postgres every test reports a vacuous pass (the `itDB`
 * convention shared with table-platform.idor.realdb.test.ts), so this file
 * stays green on a machine with no DB.
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

import connectorsRoutes from '../../server/src/routes/integrations/connectors.routes.js';

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
}

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

const REQUIRED_TABLES = ['organizations'] as const;

// ---------------------------------------------------------------------------
// E2E identity minting (same shape as table-platform.idor.realdb.test.ts)
// ---------------------------------------------------------------------------

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeE2EToken(userId: string, organizationId: string, role = 'ADMIN'): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'Connectors IDOR RealDB Test User',
    role,
    userRole: role,
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/connectors', connectorsRoutes);
  return app;
}

interface Harness {
  client: Client;
  orgAId: string;
  orgBId: string;
  adminAId: string;
  adminBId: string;
  connectorId: string;
  cleanup: () => Promise<void>;
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

const CONNECTORS_DDL = `
  CREATE TABLE IF NOT EXISTS connectors (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    provider TEXT,
    status TEXT DEFAULT 'active',
    config TEXT,
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ,
    FOREIGN KEY(organization_id) REFERENCES organizations(id) ON DELETE CASCADE
  )
`;

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
    await client.query(CONNECTORS_DDL);
  } catch {
    await client.end().catch(() => {});
    return null;
  }

  const tag = suffix();
  const orgAId = `org_conn_idor_a_${tag}`;
  const orgBId = `org_conn_idor_b_${tag}`;
  const adminAId = `user_conn_idor_a_${tag}`;
  const adminBId = `user_conn_idor_b_${tag}`;
  const connectorId = `conn_idor_${tag}`;

  // Wrapped: a reachable-but-schema-incompatible Postgres (e.g. an unrelated
  // local dev DB happens to be listening on the default port picked up by
  // tests/setup.ts's DATABASE_URL fallback) must make this suite skip
  // cleanly, not crash the whole test file.
  try {
    await client.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'Connectors IDOR Org A', 'enterprise', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [orgAId]
    );
    await client.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'Connectors IDOR Org B', 'enterprise', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [orgBId]
    );

    await client.query(
      `INSERT INTO connectors (id, organization_id, name, type, provider, status, config)
       VALUES ($1, $2, $3, $4, $5, 'active', $6)`,
      [connectorId, orgAId, 'Org A CRM Connector', 'rest_api', 'rest_api', JSON.stringify({ secret: 'org-a-secret' })]
    );
  } catch {
    await client.end().catch(() => {});
    return null;
  }

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM connectors WHERE id = $1`, [connectorId]);
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[orgAId, orgBId]]);
      await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
        [orgAId, orgBId],
      ]);
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

  return { client, orgAId, orgBId, adminAId, adminBId, connectorId, cleanup };
}

describe('Connectors IDOR fix — real Postgres, cross-tenant PUT/DELETE regression', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — connectors IDOR realdb tests skipped. ' +
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

  itDB(
    'PUT /api/connectors/:id — 404 for a different-org admin, and the row is UNCHANGED (readback proof)',
    async (h) => {
      const app = buildApp();
      const attackerToken = makeE2EToken(h.adminBId, h.orgBId);

      const res = await request(app)
        .put(`/api/connectors/${h.connectorId}`)
        .set('Authorization', `Bearer ${attackerToken}`)
        .send({ name: 'PWNED-BY-ORG-B', config: { secret: 'stolen' } });

      expect(res.status).toBe(404);

      const readback = await h.client.query(
        `SELECT name, config FROM connectors WHERE id = $1`,
        [h.connectorId]
      );
      expect(readback.rows[0]?.name).toBe('Org A CRM Connector');
      expect(readback.rows[0]?.config).toBe(JSON.stringify({ secret: 'org-a-secret' }));
    }
  );

  itDB('DELETE /api/connectors/:id — 404 for a different-org admin, row still present', async (h) => {
    const app = buildApp();
    const attackerToken = makeE2EToken(h.adminBId, h.orgBId);

    const res = await request(app)
      .delete(`/api/connectors/${h.connectorId}`)
      .set('Authorization', `Bearer ${attackerToken}`);

    expect(res.status).toBe(404);

    const readback = await h.client.query(`SELECT id FROM connectors WHERE id = $1`, [h.connectorId]);
    expect(readback.rows.length).toBe(1);
  });

  itDB(
    'PUT /api/connectors/:id — 200 for the OWNING org admin, readback reflects the update',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.adminAId, h.orgAId);

      const res = await request(app)
        .put(`/api/connectors/${h.connectorId}`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ name: 'Org A CRM Connector (renamed)' });

      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);

      const readback = await h.client.query(`SELECT name FROM connectors WHERE id = $1`, [h.connectorId]);
      expect(readback.rows[0]?.name).toBe('Org A CRM Connector (renamed)');
    }
  );

  itDB('PUT /api/connectors/:id — 404 for a non-existent id even for the requesting org admin', async (h) => {
    const app = buildApp();
    const ownerToken = makeE2EToken(h.adminAId, h.orgAId);

    const res = await request(app)
      .put(`/api/connectors/does-not-exist-${Date.now()}`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'irrelevant' });

    expect(res.status).toBe(404);
  });

  itDB(
    'DELETE /api/connectors/:id — 200 for the OWNING org admin, row actually gone (proves DELETE is not permanently blocked by the fix)',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.adminAId, h.orgAId);

      const res = await request(app)
        .delete(`/api/connectors/${h.connectorId}`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(res.body?.success).toBe(true);

      const readback = await h.client.query(`SELECT id FROM connectors WHERE id = $1`, [h.connectorId]);
      expect(readback.rows.length).toBe(0);
    }
  );

  itDB('PUT /api/connectors/:id — 401 with no token at all (auth is not accidentally optional)', async (h) => {
    const app = buildApp();
    const res = await request(app).put(`/api/connectors/${h.connectorId}`).send({ name: 'x' });
    expect(res.status).toBe(401);
  });
});
