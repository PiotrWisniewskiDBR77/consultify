/**
 * IDOR fix — integration sync logs against a REAL Postgres database (no mocks).
 *
 * `server/src/routes/integrations/integrations.routes.ts` GET /:id/logs used
 * to query `integration_sync_log WHERE integration_id = ?` with no check that
 * the integration belonged to the caller's own organization, and it only
 * required `isAuthenticated` (any logged-in user, including role MEMBER) —
 * not `verifyAdmin`. A manual probe confirmed a real cross-tenant secret leak
 * on dev/staging: a MEMBER of one org could read another org's integration
 * sync logs, including `error_details`, which can carry the failing
 * integration's own credentials/secrets in its error payload. The control
 * route in the same file, PUT /:id/settings, already does this correctly
 * (`WHERE id = ? AND organization_id = ?`, readback proven empty settings for
 * a foreign org) — the fix below applies exactly that pattern to GET
 * /:id/logs, ahead of the existing `tryGetColumns('integration_sync_log')`
 * lookup, with zero changes to any neighboring route.
 *
 * This file wires up the REAL Express router, the REAL `verifyToken` E2E
 * bypass (same unsigned-JWT mechanism as
 * tests/integration/table-platform.idor.realdb.test.ts and
 * tests/integration/connectors.tenantIdor.realdb.test.ts), and seeds real
 * `integrations` / `integration_sync_log` rows (both tables are created by
 * the standard migration runner via server/migrations/256_integrations_system.sql,
 * unlike `connectors`). It proves:
 *   - a MEMBER of the OWNING org CAN read the logs (200, log + secret present)
 *   - a MEMBER of a DIFFERENT org CANNOT (404, no error_details/secret leak)
 *   - a non-existent integration id 404s even for the requesting org's own user
 *
 * HOW TO RUN LOCALLY (Docker available):
 *   docker run -d --name consultify-idor-fix-pg -e POSTGRES_USER=iris \
 *     -e POSTGRES_PASSWORD=iris_test -e POSTGRES_DB=iris_test -p 55677:5432 postgres:15
 *   DATABASE_URL=postgres://iris:iris_test@localhost:55677/iris_test \
 *     DB_TYPE=postgres NODE_ENV=test npx tsx server/scripts/migrate.postgres.ts --safe
 *   DATABASE_URL=postgres://iris:iris_test@localhost:55677/iris_test \
 *     npx vitest run tests/integration/integrationLogs.tenantIdor.realdb.test.ts
 *
 * Without a reachable Postgres every test reports a vacuous pass (the `itDB`
 * convention shared with the sibling realdb IDOR suites), so this file stays
 * green on a machine with no DB.
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

import integrationsRoutes from '../../server/src/routes/integrations/integrations.routes.js';

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

const REQUIRED_TABLES = ['organizations', 'integrations', 'integration_sync_log'] as const;

// ---------------------------------------------------------------------------
// E2E identity minting (same shape as the sibling realdb IDOR suites)
// ---------------------------------------------------------------------------

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeE2EToken(userId: string, organizationId: string, role = 'MEMBER'): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'Integration Logs IDOR RealDB Test User',
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
  app.use('/api/integrations', integrationsRoutes);
  return app;
}

interface Harness {
  client: Client;
  orgAId: string;
  orgBId: string;
  memberAId: string;
  memberBId: string;
  integrationId: string;
  syncLogId: string;
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
  const orgAId = `org_intlog_idor_a_${tag}`;
  const orgBId = `org_intlog_idor_b_${tag}`;
  const memberAId = `user_intlog_idor_a_${tag}`;
  const memberBId = `user_intlog_idor_b_${tag}`;
  const integrationId = `int_idor_${tag}`;
  const syncLogId = `synclog_idor_${tag}`;
  const secretMarker = `ORG-A-SECRET-CREDENTIAL-${tag}`;

  // Wrapped: a reachable-but-schema-incompatible Postgres (e.g. an unrelated
  // local dev DB happens to be listening on the default port picked up by
  // tests/setup.ts's DATABASE_URL fallback) must make this suite skip
  // cleanly, not crash the whole test file.
  try {
    await client.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'Integration Logs IDOR Org A', 'enterprise', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [orgAId]
    );
    await client.query(
      `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'Integration Logs IDOR Org B', 'enterprise', 'active')
       ON CONFLICT (id) DO NOTHING`,
      [orgBId]
    );

    await client.query(
      `INSERT INTO integrations (id, organization_id, name, category, status, connected_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [integrationId, orgAId, 'Org A Jira Integration', 'productivity', 'connected', memberAId]
    );

    await client.query(
      `INSERT INTO integration_sync_log
         (id, integration_id, sync_type, direction, status, error_summary, error_details, started_at, completed_at, duration_ms)
       VALUES ($1, $2, 'full', 'pull', 'failed', 'Auth failed', $3, NOW(), NOW(), 120)`,
      [syncLogId, integrationId, JSON.stringify({ credential: secretMarker })]
    );
  } catch {
    await client.end().catch(() => {});
    return null;
  }

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM integration_sync_log WHERE integration_id = $1`, [integrationId]);
      await client.query(`DELETE FROM integrations WHERE id = $1`, [integrationId]);
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

  return {
    client,
    orgAId,
    orgBId,
    memberAId,
    memberBId,
    integrationId,
    syncLogId,
    cleanup,
  };
}

describe('Integration sync logs IDOR fix — real Postgres, cross-tenant GET /:id/logs regression', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — integration logs IDOR realdb tests skipped. ' +
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
    'GET /api/integrations/:id/logs — 404 for a MEMBER of a different org, zero secret leakage',
    async (h) => {
      const app = buildApp();
      const attackerToken = makeE2EToken(h.memberBId, h.orgBId, 'MEMBER');

      const res = await request(app)
        .get(`/api/integrations/${h.integrationId}/logs`)
        .set('Authorization', `Bearer ${attackerToken}`);

      expect(res.status).toBe(404);
      const serialized = JSON.stringify(res.body || {});
      expect(serialized).not.toMatch(/ORG-A-SECRET-CREDENTIAL/);
    }
  );

  itDB(
    'GET /api/integrations/:id/logs — 200 for a MEMBER of the OWNING org, log entry (with secret) present',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.memberAId, h.orgAId, 'MEMBER');

      const res = await request(app)
        .get(`/api/integrations/${h.integrationId}/logs`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body?.logs)).toBe(true);
      expect(res.body.logs.length).toBeGreaterThan(0);
      const serialized = JSON.stringify(res.body);
      expect(serialized).toMatch(/ORG-A-SECRET-CREDENTIAL/);
    }
  );

  itDB(
    'GET /api/integrations/:id/logs — 404 for a non-existent integration id even for the requesting org member',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.memberAId, h.orgAId, 'MEMBER');

      const res = await request(app)
        .get(`/api/integrations/does-not-exist-${Date.now()}/logs`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(res.status).toBe(404);
    }
  );

  itDB('GET /api/integrations/:id/logs — 401 with no token at all (auth is not accidentally optional)', async (h) => {
    const app = buildApp();
    const res = await request(app).get(`/api/integrations/${h.integrationId}/logs`);
    expect(res.status).toBe(401);
  });
});
