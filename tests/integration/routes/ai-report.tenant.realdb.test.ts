/**
 * M01-P03 §8 — POST /api/ai/report tenant enforcement, proved against a REAL
 * Postgres database and the REAL Express router (same harness pattern as the
 * M01-P06 `work-canvas.cas.realdb.test.ts`).
 *
 * WHY THIS FILE EXISTS: reading `server/src/routes/ai.routes.ts`'s `/report`
 * handler (owned by this packet — `src/services/api.ts`'s
 * `reportMessageFeedback`/`reportMessage` client methods call it) found it
 * logged whatever `messageId` the caller sent with NO ownership check at
 * all — a user could tag an arbitrary conversation's message (any tenant) as
 * "harmful" without ever having access to that conversation. Not a data-read
 * risk (the endpoint returns nothing about the message), but exactly the
 * class of action the packet's own contract forbids: "tenant: akcja na
 * cudzej wiadomości odrzucona" (an action on someone else's message must be
 * rejected). Fixed in `ai.routes.ts` by resolving the message's
 * conversation and checking `user_id`/`organization_id` before logging,
 * matching the ownership pattern already used by `POST /:id/branch` and
 * `POST /:id/messages/:messageId/save-to-context` in
 * `conversations.routes.ts` (read, not modified — those files are owned by
 * lane A / P02, not this packet).
 */
import { randomBytes, randomUUID } from 'node:crypto';

import express from 'express';
import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
  process.env.POSTGRES_SKIP_INIT_IN_TEST = 'false';
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
}

const { default: aiRoutes } = await import('../../../server/src/routes/ai.routes.js');

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
      statement_timeout: 30_000,
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
    statement_timeout: 30_000,
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
      /* best effort */
    }
  }
}

function base64UrlEncode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), 'utf8')
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
    name: 'M01-P03 Report Tenant Test User',
    role: 'USER',
    userRole: 'USER',
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
  app.use('/api/ai', aiRoutes);
  return app;
}

function tag(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

let pgClient: Client | null = null;

async function cleanup(conversationId: string): Promise<void> {
  if (!pgClient) return;
  await pgClient
    .query('DELETE FROM conversation_messages WHERE conversation_id = $1', [conversationId])
    .catch(() => undefined);
  await pgClient
    .query('DELETE FROM conversations WHERE id = $1', [conversationId])
    .catch(() => undefined);
}

describe('M01-P03 — POST /api/ai/report tenant enforcement (real Postgres)', () => {
  let reachable = false;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error('[skip] Postgres not reachable — M01-P03 ai/report tenant realdb tests skipped.');
  }

  beforeAll(async () => {
    reachable = await pgReachable();
    if (!reachable) {
      emitSkipOnce();
      return;
    }
    const config = buildClientConfig();
    pgClient = new Client(config as ClientConfig);
    await pgClient.connect();
  }, 30_000);

  afterAll(async () => {
    if (pgClient) {
      await pgClient.end().catch(() => undefined);
      pgClient = null;
    }
  });

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) {
          expect(true).toBe(true);
          return;
        }
        await fn();
      },
      timeoutMs
    );

  itDB(
    'rejects reporting a message from a DIFFERENT organization with 404 (no existence leak) and accepts reporting your own',
    async () => {
      const t = tag();
      const ownerOrgId = `org-report-owner-${t}`;
      const ownerUserId = `user-report-owner-${t}`;
      const strangerOrgId = `org-report-stranger-${t}`;
      const strangerUserId = `user-report-stranger-${t}`;
      const app = buildApp();
      const ownerAuth = { Authorization: `Bearer ${makeE2EToken(ownerUserId, ownerOrgId)}` };
      const strangerAuth = {
        Authorization: `Bearer ${makeE2EToken(strangerUserId, strangerOrgId)}`,
      };

      // Seed both users' rows via the E2E bypass (it auto-creates users/orgs
      // on first authenticated request, never conversations/messages).
      await request(app).get('/api/ai/memory/metrics').set(ownerAuth);
      await request(app).get('/api/ai/memory/metrics').set(strangerAuth);

      const conversationId = `conv-report-${t}`;
      const messageId = randomUUID();
      await pgClient!.query(
        `INSERT INTO conversations (id, user_id, organization_id, title)
         VALUES ($1, $2, $3, 'Report tenant test')`,
        [conversationId, ownerUserId, ownerOrgId]
      );
      await pgClient!.query(
        `INSERT INTO conversation_messages (id, conversation_id, role, content, author_user_id)
         VALUES ($1, $2, 'ai', 'Content the stranger must not be able to report.', $3)`,
        [messageId, conversationId, ownerUserId]
      );

      try {
        // A different organization, reporting a message it cannot see.
        const strangerRes = await request(app)
          .post('/api/ai/report')
          .set(strangerAuth)
          .send({ messageId, reason: 'harmful' });
        expect(strangerRes.status).toBe(404);
        expect(strangerRes.body.success).toBe(false);

        // The owning organization can report its own message.
        const ownerRes = await request(app)
          .post('/api/ai/report')
          .set(ownerAuth)
          .send({ messageId, reason: 'harmful' });
        expect(ownerRes.status).toBe(200);
        expect(ownerRes.body.success).toBe(true);
      } finally {
        await cleanup(conversationId);
      }
    }
  );

  itDB('rejects reporting a message id that does not exist with 404', async () => {
    const t = tag();
    const orgId = `org-report-${t}`;
    const userId = `user-report-${t}`;
    const app = buildApp();
    const auth = { Authorization: `Bearer ${makeE2EToken(userId, orgId)}` };
    await request(app).get('/api/ai/memory/metrics').set(auth);

    const res = await request(app)
      .post('/api/ai/report')
      .set(auth)
      .send({ messageId: randomUUID(), reason: 'incorrect' });
    expect(res.status).toBe(404);
  });
});
