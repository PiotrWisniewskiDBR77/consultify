/**
 * Inbox webhook fail-closed regression against a REAL Postgres database
 * (no mocks) — fix/inbox-failopen-stagegates-20260828, COMMIT 1.
 *
 * BUG: `server/src/routes/webhooks/inbox.routes.ts` used to FAIL OPEN when
 * `INBOX_WEBHOOK_SECRET` was not configured — `getOrgFromRequest`'s secret
 * check was `if (INBOX_WEBHOOK_SECRET && secret !== INBOX_WEBHOOK_SECRET)`,
 * which is a no-op when the env var is unset, so ANY caller could pass an
 * arbitrary `?orgId=` and have it accepted with zero verification. Confirmed
 * live against staging: `POST /api/webhooks/inbox/slack?orgId=org-b-victim`
 * with no token returned 200 and inserted a row into `inbox_connector_items`
 * for org B with attacker-controlled payload.
 *
 * FIX: the router now refuses ALL traffic under `/inbox` with 503 before
 * touching the database or accepting any orgId when the secret is not
 * configured — in every environment, not just production (unlike the
 * Stripe webhook route's `isProduction && !endpointSecret` guard, which
 * this router's comment explicitly says NOT to imitate for that exemption).
 * When the secret IS configured, behavior is unchanged: missing/wrong
 * secret → 401; correct secret → 200 + row inserted.
 *
 * This file drives the REAL Express router (`inbox.routes.ts`) end-to-end
 * against a REAL Postgres database — no mocked DB layer, no mocked
 * `getOrgFromRequest`. Because `INBOX_WEBHOOK_SECRET` is read into a
 * module-level `const` at import time, each scenario below uses
 * `vi.resetModules()` + a fresh dynamic `import()` so the module picks up
 * the env var as set for that scenario (mirrors the "reload the module
 * under a different env" pattern; the underlying DB connection itself is a
 * process-global singleton — see `server/src/database/Database.ts`'s
 * `GLOBAL_DB_KEY` — so this does NOT reopen the connection pool per import).
 *
 * DB: mirrors the `pgReachable()` precondition pattern used throughout this
 * repo's `*.realdb.test.ts` suite (e.g. table-platform.idor.realdb.test.ts):
 * every test starts with a fast connection probe and the whole suite
 * reports a clean, non-failing skip when no reachable Postgres is
 * configured. Point `DATABASE_URL` at a throwaway Postgres with the schema
 * migrated (`npm run db:migrate`) to get true, unmocked coverage:
 *
 *   docker run -d --name inbox-webhook-pg -e POSTGRES_USER=iris \
 *     -e POSTGRES_PASSWORD=iris_test -e POSTGRES_DB=iris_test \
 *     -p 59321:5432 pgvector/pgvector:pg16
 *   NODE_ENV=test DB_TYPE=postgres \
 *     DATABASE_URL=postgres://iris:iris_test@localhost:59321/iris_test \
 *     npx tsx server/scripts/migrate.postgres.ts
 *   DATABASE_URL=postgres://iris:iris_test@localhost:59321/iris_test \
 *     npx vitest run tests/integration/inbox-webhook.failclosed.realdb.test.ts
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import express from 'express';

// ---------------------------------------------------------------------------
// Force the app's database factory to use a REAL Postgres pool, but ONLY
// when a database is actually configured (mirrors table-platform.idor
// realdb test's env guard). Plain top-level statements are sufficient
// because none of the modules imported below touch the DB pool at
// module-evaluation time.
// ---------------------------------------------------------------------------
if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
}

// ---------------------------------------------------------------------------
// Connection probe (same contract as table-platform.idor.realdb.test.ts)
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

const REQUIRED_TABLES = ['organizations', 'inbox_connector_items', 'inbox_routing_rules'] as const;

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// App under test — REAL router, freshly imported per secret scenario so the
// module-level `INBOX_WEBHOOK_SECRET` const reflects the env at import time.
// ---------------------------------------------------------------------------

async function buildAppWithSecret(secret: string | undefined): Promise<express.Express> {
  vi.resetModules();
  if (secret === undefined) {
    delete process.env.INBOX_WEBHOOK_SECRET;
  } else {
    process.env.INBOX_WEBHOOK_SECRET = secret;
  }
  const mod = await import('../../server/src/routes/webhooks/inbox.routes.js');
  const router = (mod.default ?? mod) as express.Router;

  const app = express();
  app.use(express.json());
  app.use('/api/webhooks/inbox', router);
  return app;
}

function slackEventCallback(text: string) {
  return {
    type: 'event_callback',
    event: {
      type: 'message',
      channel: 'C_VICTIM_CHANNEL',
      text,
      user: 'U_ATTACKER',
      ts: `${Date.now() / 1000}`,
    },
  };
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface Harness {
  client: Client;
  orgId: string;
  cleanup: () => Promise<void>;
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
  const orgId = `org_inbox_victim_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'Inbox RealDB Victim Org', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgId]
  );

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM inbox_connector_items WHERE organization_id = $1`, [orgId]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    } catch {
      // Leaking a few rows is acceptable; a hung/throwing cleanup is not.
    }
    try {
      await client.end();
    } catch {
      // ignore
    }
  };

  return { client, orgId, cleanup };
}

async function countInboxRows(client: Client, orgId: string): Promise<number> {
  const result = await client.query<{ count: string }>(
    `SELECT COUNT(*)::text AS count FROM inbox_connector_items WHERE organization_id = $1`,
    [orgId]
  );
  return Number(result.rows[0]?.count ?? '0');
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Inbox webhook — fail-closed regression against a real Postgres database (no mocks)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;
  const savedSecret = process.env.INBOX_WEBHOOK_SECRET;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — inbox webhook fail-closed realdb tests skipped. ' +
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
    if (savedSecret === undefined) {
      delete process.env.INBOX_WEBHOOK_SECRET;
    } else {
      process.env.INBOX_WEBHOOK_SECRET = savedSecret;
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

  // (a) secret unset + ?orgId= a REAL, existing org → 503, zero rows.
  // If the fail-closed gate were absent, the pre-fix code would happily
  // accept this request (the org row exists) and insert a row — the exact
  // shape of the confirmed staging exploit.
  itDB('(a) INBOX_WEBHOOK_SECRET unset → 503, zero rows written (fail-closed)', async (h) => {
    const app = await buildAppWithSecret(undefined);
    const res = await request(app)
      .post(`/api/webhooks/inbox/slack?orgId=${encodeURIComponent(h.orgId)}`)
      .send(slackEventCallback('secret unset — should never be inserted'));

    expect(res.status).toBe(503);
    expect(await countInboxRows(h.client, h.orgId)).toBe(0);
  });

  // (b) secret configured, request has no/wrong secret → 401, zero rows.
  itDB('(b1) secret configured, no X-Inbox-Secret header → 401, zero rows', async (h) => {
    const app = await buildAppWithSecret('correct-horse-battery-staple');
    const res = await request(app)
      .post(`/api/webhooks/inbox/slack?orgId=${encodeURIComponent(h.orgId)}`)
      .send(slackEventCallback('no secret sent — should never be inserted'));

    expect(res.status).toBe(401);
    expect(await countInboxRows(h.client, h.orgId)).toBe(0);
  });

  itDB('(b2) secret configured, WRONG X-Inbox-Secret header → 401, zero rows', async (h) => {
    const app = await buildAppWithSecret('correct-horse-battery-staple');
    const res = await request(app)
      .post(`/api/webhooks/inbox/slack?orgId=${encodeURIComponent(h.orgId)}`)
      .set('X-Inbox-Secret', 'wrong-secret')
      .send(slackEventCallback('wrong secret sent — should never be inserted'));

    expect(res.status).toBe(401);
    expect(await countInboxRows(h.client, h.orgId)).toBe(0);
  });

  // (c) secret configured, CORRECT secret → 200 + row inserted (no regression).
  itDB('(c) secret configured, correct X-Inbox-Secret header → 200, row inserted', async (h) => {
    const app = await buildAppWithSecret('correct-horse-battery-staple');
    const res = await request(app)
      .post(`/api/webhooks/inbox/slack?orgId=${encodeURIComponent(h.orgId)}`)
      .set('X-Inbox-Secret', 'correct-horse-battery-staple')
      .send(slackEventCallback('legitimate slack message'));

    expect(res.status).toBe(200);
    expect(res.body?.received).toBe(true);
    expect(await countInboxRows(h.client, h.orgId)).toBe(1);
  });

  // Slack url_verification challenge must keep working even with no secret
  // configured — Slack's own handshake carries no org context and writes
  // nothing, so it is exempt from the fail-closed gate... EXCEPT the gate is
  // router-level and fires before the handler even inspects the body. This
  // is a deliberate, documented behavior change: Slack's initial app setup
  // handshake will also 503 until the secret is configured. That is the
  // correct tradeoff — silently special-casing "any request with this JSON
  // shape" would reopen a bypass surface.
  itDB(
    '(a2) url_verification challenge is ALSO refused with 503 when secret unset (documented tradeoff)',
    async (_h) => {
      const app = await buildAppWithSecret(undefined);
      const res = await request(app)
        .post(`/api/webhooks/inbox/slack`)
        .send({ type: 'url_verification', challenge: 'abc123' });

      // No orgId is involved in this request at all (Slack's handshake
      // carries none) — only the status matters here; row-count assertions
      // belong to the org-scoped scenarios above.
      expect(res.status).toBe(503);
    }
  );
});
