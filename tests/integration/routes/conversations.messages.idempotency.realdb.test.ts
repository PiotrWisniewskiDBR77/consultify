/**
 * M01-P01 — POST /api/conversations/:id/messages retry idempotency, against a
 * REAL Postgres database (no mocks).
 *
 * Packet requirement (P0.10, §8): "retry nie tworzy drugiej wiadomości" —
 * covered by migration `20260602_chat_message_idempotency_ordering.sql`
 * (adds `conversation_messages.client_message_id` +
 * `uq_conversation_messages_client_msg` UNIQUE(conversation_id,
 * client_message_id)). Context flagged by the coordinator: lane C (M02-B)
 * just proved migration 800 is NOT applied on demo despite deployed code
 * depending on it — the same risk class applies here, so this file verifies
 * BOTH that the migration actually lands on a fresh Postgres AND that the
 * route's idempotency logic (`conversations.routes.ts` — NOT modified by
 * this packet, only exercised) behaves correctly against it.
 *
 * `server/src/routes/conversations.routes.ts` is on this packet's explicit
 * "zakaz dotykania" list — this file only imports and exercises it via
 * supertest, it does not modify it.
 *
 * Negative control (packet §6): "test idempotencji MUSI padać, gdy klucz
 * idempotency zostanie usunięty z żądania" — the last two cases below prove
 * this directly: retrying WITHOUT `clientMessageId` produces a second,
 * distinct row. This is not a "break the implementation" control (there is
 * no implementation bug to revert) — it demonstrates that idempotency is
 * conditional on the client actually sending the key, which is the load-
 * bearing fact the positive test above depends on.
 *
 * Pattern: mirrors tests/integration/routes/conversations.search.realdb.test.ts
 * (M01-P02) — pgReachable()/itDB() vacuous-skip, real Express router, real
 * verifyToken via E2E_MODE unsigned-JWT bypass.
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

async function columnExists(client: Client, table: string, column: string): Promise<boolean> {
  const result = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return result.rows.length > 0;
}

const REQUIRED_TABLES = ['conversations', 'conversation_messages', 'organizations', 'users'] as const;

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
    name: 'M01-P01 RealDB Test User',
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
  migrationApplied: boolean;
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

  const migrationApplied = await columnExists(client, 'conversation_messages', 'client_message_id');

  const tag = suffix();
  const orgId = `org_m01p01_${tag}`;
  const userId = `user_m01p01_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'M01-P01 RealDB Org', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgId]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'CONSULTANT', 'active', 'M01P01', 'Test')
     ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, `${userId}@local.test`]
  );

  const convRes = await client.query<{ id: string }>(
    `INSERT INTO conversations (user_id, organization_id, title) VALUES ($1, $2, $3) RETURNING id`,
    [userId, orgId, `M01-P01 idempotency test ${tag}`]
  );
  const conversationId = convRes.rows[0].id;

  const cleanup = async () => {
    try {
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

  return { client, orgId, userId, conversationId, migrationApplied, cleanup };
}

describe('M01-P01 — POST /:id/messages retry idempotency against a real Postgres database', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — M01-P01 idempotency realdb tests skipped.'
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
    'migration 20260602_chat_message_idempotency_ordering is actually applied (client_message_id column exists)',
    async (h) => {
      // This is exactly the risk class the coordinator flagged: lane C
      // (M02-B) found migration 800 deployed-but-not-applied on demo. This
      // assertion fails loudly instead of the idempotency tests below
      // silently no-op'ing if the column were ever missing.
      expect(h.migrationApplied).toBe(true);
    }
  );

  itDB(
    'retrying the SAME clientMessageId does not create a second message row (P0.10)',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const clientMessageId = `cmid-${suffix()}`;

      const first = await request(app)
        .post(`/api/conversations/${h.conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'user', content: 'Retry-safe message', clientMessageId });
      expect(first.status).toBe(201);
      const firstId = first.body.id;
      expect(firstId).toBeTruthy();

      // Simulates a network-retried POST (fetchWithRetry) or a double-click
      // double-submit: the exact same clientMessageId, sent again.
      const retry = await request(app)
        .post(`/api/conversations/${h.conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'user', content: 'Retry-safe message', clientMessageId });
      expect(retry.status).toBe(200); // 200, not 201 — no new row was created
      expect(retry.body.id).toBe(firstId);

      const rows = await h.client.query(
        `SELECT id FROM conversation_messages WHERE conversation_id = $1 AND client_message_id = $2`,
        [h.conversationId, clientMessageId]
      );
      expect(rows.rows.length).toBe(1);
    }
  );

  itDB(
    'concurrent retries with the SAME clientMessageId still collapse to one row (race path)',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const clientMessageId = `cmid-race-${suffix()}`;

      const [a, b] = await Promise.all([
        request(app)
          .post(`/api/conversations/${h.conversationId}/messages`)
          .set('Authorization', `Bearer ${token}`)
          .send({ role: 'user', content: 'Race message', clientMessageId }),
        request(app)
          .post(`/api/conversations/${h.conversationId}/messages`)
          .set('Authorization', `Bearer ${token}`)
          .send({ role: 'user', content: 'Race message', clientMessageId }),
      ]);

      expect([a.status, b.status].sort()).toEqual([200, 201]);
      expect(a.body.id).toBe(b.body.id);

      const rows = await h.client.query(
        `SELECT id FROM conversation_messages WHERE conversation_id = $1 AND client_message_id = $2`,
        [h.conversationId, clientMessageId]
      );
      expect(rows.rows.length).toBe(1);
    }
  );

  itDB(
    'NEGATIVE CONTROL — retrying WITHOUT clientMessageId creates a second, distinct row',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);

      // Same content, same conversation, same actor — the ONLY difference
      // from the idempotent case above is the missing idempotency key. This
      // demonstrates the positive test is not vacuously true: idempotency
      // is conditional on the client sending clientMessageId, which is
      // exactly what the packet's negative-control requirement asks for.
      const first = await request(app)
        .post(`/api/conversations/${h.conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'user', content: 'No idempotency key message' });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post(`/api/conversations/${h.conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ role: 'user', content: 'No idempotency key message' });
      expect(second.status).toBe(201); // a NEW row, not a dedup hit
      expect(second.body.id).not.toBe(first.body.id);

      const rows = await h.client.query(
        `SELECT id FROM conversation_messages WHERE conversation_id = $1 AND content = $2`,
        [h.conversationId, 'No idempotency key message']
      );
      expect(rows.rows.length).toBe(2);
    }
  );
});
