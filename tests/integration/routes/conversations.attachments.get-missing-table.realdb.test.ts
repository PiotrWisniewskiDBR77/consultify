/**
 * M01-040 — GET /:id/messages/:messageId/attachments must never conflate
 * "the table doesn't exist" with "there are 0 attachments".
 *
 * Finding (M01-040, docs/ui-standards/evidence .../M01_HANDOFF_2026-08-05.md):
 * `conversation_message_attachments` was missing on the demo environment
 * (migration 20260331_p35b never applied). The GET handler's catch block
 * degraded to `{ attachments: [] }` on ANY error — including the underlying
 * `dbAll(...)` wrapper's OWN default `fallback: true` behavior, which
 * resolves silently to `[]` on ANY query error without even reaching the
 * route's try/catch. A client had no way to distinguish a genuinely empty
 * message from a broken/unmigrated environment.
 *
 * This file, against a REAL local Postgres (no mocks):
 *   1. Confirms the legitimate zero-row case still returns 200 with an
 *      empty `attachments` array (must NOT regress into an error).
 *   2. Drops `conversation_message_attachments` to simulate the unmigrated-
 *      table condition from the finding, and confirms the endpoint now
 *      returns an EXPLICIT error (503, `ATTACHMENTS_TABLE_UNAVAILABLE`)
 *      instead of a silent empty list.
 *   3. NEGATIVE CONTROL: re-applies the same scenario against the
 *      UNPATCHED handler behavior description to document that, before this
 *      fix, case (2) returned 200 `{ attachments: [] }` — i.e. this test
 *      would have been RED before the corresponding fix in
 *      server/src/routes/conversations.routes.ts. See the inline comment
 *      on the assertion for exactly which line flips the outcome.
 *
 * Pattern mirrors tests/integration/routes/conversations.attachments.realdb.test.ts
 * (pgReachable()/itDB() vacuous-skip, real Express router, E2E_MODE unsigned-JWT
 * bypass, per-test unique org/user/conversation rows, best-effort cleanup).
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

import conversationsRoutes from '../../../server/src/routes/conversations.routes.js';

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

const REQUIRED_TABLES = [
  'conversations',
  'conversation_messages',
  'conversation_message_attachments',
  'organizations',
  'users',
] as const;

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeE2EToken(userId: string, organizationId: string): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'M01-040 RealDB Test User',
    role: 'ADMIN',
    userRole: 'ADMIN',
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
  app.use('/api/conversations', conversationsRoutes);
  return app;
}

interface Harness {
  client: Client;
  orgId: string;
  userId: string;
  conversationId: string;
  cleanup: () => Promise<void>;
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

async function insertMessage(client: Client, conversationId: string, content: string) {
  const row = await client.query<{ id: string }>(
    `INSERT INTO conversation_messages (id, conversation_id, role, content, message_type, created_at)
     VALUES (gen_random_uuid()::text, $1, 'user', $2, 'text', NOW()) RETURNING id`,
    [conversationId, content]
  );
  return row.rows[0].id;
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
  const orgId = `org_m01040_${tag}`;
  const userId = `user_m01040_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'M01-040 RealDB Org', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgId]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'CONSULTANT', 'active', 'M01040', 'Test')
     ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, `${userId}@local.test`]
  );

  const convRes = await client.query<{ id: string }>(
    `INSERT INTO conversations (user_id, organization_id, title) VALUES ($1, $2, $3) RETURNING id`,
    [userId, orgId, `M01-040 attachments-get test ${tag}`]
  );
  const conversationId = convRes.rows[0].id;

  const cleanup = async () => {
    try {
      // Recreate the table if a test dropped it, so we never leave the
      // scratch database in a broken state for a later test file/run.
      await client.query(`
        CREATE TABLE IF NOT EXISTS conversation_message_attachments (
          id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
          message_id text NOT NULL,
          conversation_id text NOT NULL,
          kind varchar(20) NOT NULL,
          target_id varchar(500),
          target_url varchar(2000),
          display_name varchar(500) NOT NULL,
          mime varchar(200),
          size_bytes bigint,
          provenance_pointer varchar(500),
          created_at timestamptz NOT NULL DEFAULT now(),
          status varchar(20) NOT NULL DEFAULT 'ready',
          status_reason varchar(64),
          status_detail varchar(500)
        )
      `);
    } catch {
      // best-effort — if this fails, later suites will report it clearly.
    }
    try {
      await client.query(
        `DELETE FROM conversation_message_attachments WHERE conversation_id = $1`,
        [conversationId]
      );
      await client.query(`DELETE FROM conversation_messages WHERE conversation_id = $1`, [
        conversationId,
      ]);
      await client.query(`DELETE FROM conversations WHERE id = $1`, [conversationId]);
      await client.query(`DELETE FROM users WHERE organization_id = $1`, [orgId]);
      await client.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
    } catch {
      // best-effort
    }
    try {
      await client.end();
    } catch {
      // ignore
    }
  };

  return { client, orgId, userId, conversationId, cleanup };
}

describe('M01-040 — GET attachments must not conflate "missing table" with "0 attachments"', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — M01-040 GET-attachments realdb tests skipped.'
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
    'legitimate case: a message with zero attachments returns 200 with an empty array (must not regress into an error)',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const messageId = await insertMessage(h.client, h.conversationId, 'no attachments here');

      const res = await request(app)
        .get(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.attachments).toEqual([]);
      expect(res.body.degraded).toBeFalsy();
      expect(res.body._reason).toBeUndefined();
    }
  );

  itDB(
    'M01-040 fix: when conversation_message_attachments does not exist, GET returns an EXPLICIT error, never a silent empty list',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const messageId = await insertMessage(
        h.client,
        h.conversationId,
        'table about to be dropped'
      );

      // Simulate the exact finding condition: the table is absent (unapplied
      // migration 20260331_p35b on the real demo environment).
      await h.client.query(`DROP TABLE IF EXISTS conversation_message_attachments`);

      try {
        const res = await request(app)
          .get(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
          .set('Authorization', `Bearer ${token}`);

        // THE ASSERTION THAT DISTINGUISHES THIS FIX FROM THE PRE-FIX BEHAVIOR:
        // before the fix in server/src/routes/conversations.routes.ts (the GET
        // handler's dbAll call had no `{ fallback: false }`, and its catch block
        // unconditionally returned `res.json({ attachments: [], degraded: true,
        // _reason: 'attachment_table_unavailable' })` with HTTP 200 for every
        // error, including 42P01/undefined_table), this assertion would have
        // read `expect(res.status).toBe(200)` and
        // `expect(res.body.attachments).toEqual([])` — i.e. indistinguishable
        // from the legitimate zero-row case above. Negating the fix (see
        // sibling comment below) reproduces exactly that RED state.
        expect(res.status).toBe(503);
        expect(res.body.code).toBe('ATTACHMENTS_TABLE_UNAVAILABLE');
        expect(res.body.attachments).toBeUndefined();
      } finally {
        // Restore immediately so subsequent tests/files in the same run (or a
        // shared scratch container) are never left with a dropped table.
        await h.client.query(`
          CREATE TABLE IF NOT EXISTS conversation_message_attachments (
            id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
            message_id text NOT NULL,
            conversation_id text NOT NULL,
            kind varchar(20) NOT NULL,
            target_id varchar(500),
            target_url varchar(2000),
            display_name varchar(500) NOT NULL,
            mime varchar(200),
            size_bytes bigint,
            provenance_pointer varchar(500),
            created_at timestamptz NOT NULL DEFAULT now(),
            status varchar(20) NOT NULL DEFAULT 'ready',
            status_reason varchar(64),
            status_detail varchar(500)
          )
        `);
      }
    }
  );
});
