/**
 * M01-P03B — message feedback readback, against a REAL Postgres database
 * (no mocks).
 *
 * Finding M01-036 (P1): GET /api/conversations/:id never joined feedback
 * data onto messages, so `msg.feedback` was always undefined on real data —
 * InlineResponseFeedback.tsx's `existingFeedback` hydration prop (wired up
 * ahead of this fix) had nothing to consume, so a fresh reopen always
 * re-asked "rate this" for a message the user already rated.
 *
 * Root-cause correction to M01-036's literal wording: the finding named
 * `ai_feedback`, but the real runtime write path for a thumbs rating —
 * InlineResponseFeedback.tsx -> feedbackLearningService.submitFeedback() ->
 * Api.aiFeedback() -> POST /api/ai-feedback/response ->
 * adaptiveResponseService.processFeedback() — inserts into a DIFFERENT
 * table, `ai_response_feedback`. `ai_feedback` receives zero rows from any
 * reachable chat UI path. Joining `ai_feedback` would have compiled and run
 * but stayed permanently empty — the same "looks fixed, isn't" shape this
 * module has already produced three times (see the `POST /api/ai/report`
 * atrapa fixed under M01-010).
 *
 * A second, more severe bug was found while verifying this against a real
 * Postgres catalog (not just reading the migration file text, per this
 * module's standing "schema_migrations is not a reliable registry, trust
 * information_schema" lesson): `ai_response_feedback`'s sole producer,
 * add_response_feedback.sql, is EXCLUDED from the canonical Postgres
 * migration flow by migrate.postgres.ts's isSqliteOnlyMigration() heuristic
 * (any filename starting with "add_" is treated as legacy/seed and
 * skipped). On a canonically fresh Postgres database the table did not
 * exist at all — every real feedback POST would 500. Migration
 * 20260805_m01p03b_ai_response_feedback_fresh_db_gap.sql (additive,
 * CREATE TABLE IF NOT EXISTS) closes that gap; the first test below asserts
 * the table/columns exist via information_schema rather than assuming it
 * from either migration file's text.
 *
 * A third bug fixed in this packet: POST /api/ai-feedback/response had NO
 * ownership check at all — any authenticated user could attach a feedback
 * row to any messageId string, including one from a different
 * organization's conversation. The ownership tests below are also this
 * packet's negative control (b).
 *
 * Pattern: mirrors tests/integration/routes/conversations.attachments.realdb.test.ts
 * (M01-P04A) — pgReachable()/itDB() vacuous-skip, real Express router, real
 * verifyToken via E2E_MODE unsigned-JWT bypass, per-test unique org/user/
 * conversation rows, best-effort cleanup.
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';

import aiFeedbackRoutes from '../../../server/src/routes/ai/ai-feedback.routes.js';
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

async function columnsOf(client: Client, table: string): Promise<Set<string>> {
  const result = await client.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [table]
  );
  return new Set(result.rows.map((r) => r.column_name));
}

const REQUIRED_TABLES = [
  'conversations',
  'conversation_messages',
  'chat_projects',
  'organizations',
  'organization_members',
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
    name: 'M01-P03B RealDB Test User',
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
  app.use('/api/ai-feedback', aiFeedbackRoutes);
  app.use('/api/conversations', conversationsRoutes);
  return app;
}

interface Harness {
  client: Client;
  orgId: string;
  otherOrgId: string;
  userId: string;
  otherUserId: string; // same org as userId, used for team-scope tests
  foreignUserId: string; // different org entirely
  conversationId: string; // personal conversation owned by userId
  teamConversationId: string; // team-scope conversation in orgId
  foreignConversationId: string; // personal conversation owned by foreignUserId, in otherOrgId
  ai_response_feedback_columns: Set<string>;
  cleanup: () => Promise<void>;
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

async function insertMessage(
  client: Client,
  conversationId: string,
  content: string,
  role: 'user' | 'ai' = 'ai'
) {
  const row = await client.query<{ id: string }>(
    `INSERT INTO conversation_messages (id, conversation_id, role, content, message_type, created_at)
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'text', NOW()) RETURNING id`,
    [conversationId, role, content]
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

  const ai_response_feedback_columns = await columnsOf(client, 'ai_response_feedback');

  const tag = suffix();
  const orgId = `org_m01p03b_${tag}`;
  const otherOrgId = `org_m01p03b_other_${tag}`;
  const userId = `user_m01p03b_${tag}`;
  const otherUserId = `user_m01p03b_team_${tag}`;
  const foreignUserId = `user_m01p03b_foreign_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'M01-P03B RealDB Org', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'M01-P03B RealDB Other Org', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [otherOrgId]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'CONSULTANT', 'active', 'M01P03B', 'Test')
     ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, `${userId}@local.test`]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'CONSULTANT', 'active', 'M01P03B', 'Team')
     ON CONFLICT (id) DO NOTHING`,
    [otherUserId, orgId, `${otherUserId}@local.test`]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'CONSULTANT', 'active', 'M01P03B', 'Foreign')
     ON CONFLICT (id) DO NOTHING`,
    [foreignUserId, otherOrgId, `${foreignUserId}@local.test`]
  );
  // organization_members rows so both org members resolve team-chat permissions
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE') ON CONFLICT (id) DO NOTHING`,
    [`mem_${userId}`, orgId, userId]
  );
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE') ON CONFLICT (id) DO NOTHING`,
    [`mem_${otherUserId}`, orgId, otherUserId]
  );

  const convRes = await client.query<{ id: string }>(
    `INSERT INTO conversations (user_id, organization_id, title) VALUES ($1, $2, $3) RETURNING id`,
    [userId, orgId, `M01-P03B feedback test ${tag}`]
  );
  const conversationId = convRes.rows[0].id;

  const foreignConvRes = await client.query<{ id: string }>(
    `INSERT INTO conversations (user_id, organization_id, title) VALUES ($1, $2, $3) RETURNING id`,
    [foreignUserId, otherOrgId, `M01-P03B foreign org conversation ${tag}`]
  );
  const foreignConversationId = foreignConvRes.rows[0].id;

  const projectRes = await client.query<{ id: string }>(
    `INSERT INTO chat_projects (id, user_id, organization_id, name, scope)
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'team') RETURNING id`,
    [userId, orgId, `M01-P03B team project ${tag}`]
  );
  const projectId = projectRes.rows[0].id;

  const teamConvRes = await client.query<{ id: string }>(
    `INSERT INTO conversations (user_id, organization_id, title, chat_project_id) VALUES ($1, $2, $3, $4) RETURNING id`,
    [userId, orgId, `M01-P03B team conversation ${tag}`, projectId]
  );
  const teamConversationId = teamConvRes.rows[0].id;

  const cleanup = async () => {
    try {
      await client.query(
        `DELETE FROM ai_response_feedback WHERE user_id IN ($1, $2, $3)`,
        [userId, otherUserId, foreignUserId]
      );
      await client.query(
        `DELETE FROM conversation_messages WHERE conversation_id IN ($1, $2, $3)`,
        [conversationId, teamConversationId, foreignConversationId]
      );
      await client.query(`DELETE FROM conversations WHERE id IN ($1, $2, $3)`, [
        conversationId,
        teamConversationId,
        foreignConversationId,
      ]);
      await client.query(`DELETE FROM chat_projects WHERE id = $1`, [projectId]);
      await client.query(`DELETE FROM organization_members WHERE organization_id = $1`, [orgId]);
      await client.query(`DELETE FROM users WHERE organization_id IN ($1, $2)`, [
        orgId,
        otherOrgId,
      ]);
      await client.query(`DELETE FROM organizations WHERE id IN ($1, $2)`, [orgId, otherOrgId]);
    } catch {
      // best-effort
    }
    try {
      await client.end();
    } catch {
      // ignore
    }
  };

  return {
    client,
    orgId,
    otherOrgId,
    userId,
    otherUserId,
    foreignUserId,
    conversationId,
    teamConversationId,
    foreignConversationId,
    ai_response_feedback_columns,
    cleanup,
  };
}

describe('M01-P03B — message feedback readback against a real Postgres database', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — M01-P03B feedback realdb tests skipped.'
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
    'migration 20260805_m01p03b_ai_response_feedback_fresh_db_gap is actually applied (table + columns exist per information_schema, not assumed from migration file text)',
    async (h) => {
      const required = [
        'id',
        'user_id',
        'message_id',
        'conversation_id',
        'rating',
        'created_at',
      ];
      for (const col of required) {
        expect(h.ai_response_feedback_columns.has(col)).toBe(true);
      }
    }
  );

  itDB(
    'PERSISTENCE — POST /api/ai-feedback/response for a message the user owns really writes a row to ai_response_feedback (not a fabricated success)',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const messageId = await insertMessage(h.client, h.conversationId, 'AI answer to rate');

      const res = await request(app)
        .post('/api/ai-feedback/response')
        .set('Authorization', `Bearer ${token}`)
        .send({
          messageId,
          conversationId: h.conversationId,
          rating: 'positive',
          capability: 'chat',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.feedbackId).toBe('string');
      expect(res.body.feedbackId.length).toBeGreaterThan(0);

      const rows = await h.client.query(
        `SELECT user_id, message_id, conversation_id, rating FROM ai_response_feedback WHERE message_id = $1`,
        [messageId]
      );
      expect(rows.rows.length).toBe(1);
      expect(rows.rows[0]).toEqual({
        user_id: h.userId,
        message_id: messageId,
        conversation_id: h.conversationId,
        rating: 'positive',
      });
    }
  );

  itDB(
    'the client-supplied conversationId is NOT trusted blindly — persisted conversation_id is the DB-verified one for messageId',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const messageId = await insertMessage(h.client, h.conversationId, 'mismatched conv id test');

      const res = await request(app)
        .post('/api/ai-feedback/response')
        .set('Authorization', `Bearer ${token}`)
        .send({
          messageId,
          conversationId: 'not-the-real-conversation-id-just-made-up',
          rating: 'negative',
        });

      expect(res.status).toBe(201);
      const rows = await h.client.query(
        `SELECT conversation_id FROM ai_response_feedback WHERE message_id = $1`,
        [messageId]
      );
      expect(rows.rows[0].conversation_id).toBe(h.conversationId);
    }
  );

  itDB(
    'OWNERSHIP (M01-036 follow-up) — a messageId belonging to ANOTHER organization is rejected (404), not persisted',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const foreignMessageId = await insertMessage(
        h.client,
        h.foreignConversationId,
        'belongs to a different org entirely'
      );

      const res = await request(app)
        .post('/api/ai-feedback/response')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId: foreignMessageId, rating: 'positive' });

      expect(res.status).toBe(404);
      const rows = await h.client.query(
        `SELECT id FROM ai_response_feedback WHERE message_id = $1`,
        [foreignMessageId]
      );
      expect(rows.rows.length).toBe(0);
    }
  );

  itDB(
    'OWNERSHIP — a messageId that does not exist at all is rejected identically (404) — no existence oracle',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);

      const res = await request(app)
        .post('/api/ai-feedback/response')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId: `msg-does-not-exist-${suffix()}`, rating: 'positive' });

      expect(res.status).toBe(404);
    }
  );

  itDB(
    'OWNERSHIP — team membership grants access to a team-scope conversation message (positive case, not just the negative)',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.otherUserId, h.orgId); // NOT the conversation creator
      const messageId = await insertMessage(
        h.client,
        h.teamConversationId,
        'team conversation message'
      );

      const res = await request(app)
        .post('/api/ai-feedback/response')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId, rating: 'positive' });

      expect(res.status).toBe(201);
      const rows = await h.client.query(
        `SELECT user_id FROM ai_response_feedback WHERE message_id = $1`,
        [messageId]
      );
      expect(rows.rows[0].user_id).toBe(h.otherUserId);
    }
  );

  itDB(
    'HYDRATION / FRESH REOPEN (packet §7) — a rated message shows the rating on a fresh GET /api/conversations/:id, not from client memory',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const messageId = await insertMessage(h.client, h.conversationId, 'rate then reopen');

      const posted = await request(app)
        .post('/api/ai-feedback/response')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId, conversationId: h.conversationId, rating: 'positive' });
      expect(posted.status).toBe(201);

      // A fresh GET (new request, no shared in-memory state) is the
      // server-side equivalent of a hard reload re-fetching the message.
      const reopened = await request(app)
        .get(`/api/conversations/${h.conversationId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(reopened.status).toBe(200);
      const msg = (reopened.body.messages as any[]).find((m) => m.id === messageId);
      expect(msg).toBeTruthy();
      expect(msg.feedback).toBeTruthy();
      expect(msg.feedback.rating).toBe('positive');
    }
  );

  itDB(
    'HYDRATION — an UNRATED message has no feedback field on reopen (not a false positive)',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const messageId = await insertMessage(h.client, h.conversationId, 'never rated');

      const reopened = await request(app)
        .get(`/api/conversations/${h.conversationId}`)
        .set('Authorization', `Bearer ${token}`);
      expect(reopened.status).toBe(200);
      const msg = (reopened.body.messages as any[]).find((m) => m.id === messageId);
      expect(msg).toBeTruthy();
      expect(msg.feedback).toBeFalsy();
    }
  );

  itDB(
    'HYDRATION — re-rating the SAME message (positive then negative) shows the LATEST rating on reopen',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const messageId = await insertMessage(h.client, h.conversationId, 'changed my mind');

      const first = await request(app)
        .post('/api/ai-feedback/response')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId, conversationId: h.conversationId, rating: 'positive' });
      expect(first.status).toBe(201);

      // Ensure a distinct created_at ordering on databases with coarse clock
      // resolution.
      await new Promise((r) => setTimeout(r, 10));

      const second = await request(app)
        .post('/api/ai-feedback/response')
        .set('Authorization', `Bearer ${token}`)
        .send({ messageId, conversationId: h.conversationId, rating: 'negative' });
      expect(second.status).toBe(201);

      const reopened = await request(app)
        .get(`/api/conversations/${h.conversationId}`)
        .set('Authorization', `Bearer ${token}`);
      const msg = (reopened.body.messages as any[]).find((m) => m.id === messageId);
      expect(msg.feedback.rating).toBe('negative');
    }
  );

  itDB(
    'HYDRATION — a rating from a DIFFERENT user on a shared team-scope message is not shown as "my" rating',
    async (h) => {
      const app = buildApp();
      const ownerToken = makeE2EToken(h.userId, h.orgId);
      const teammateToken = makeE2EToken(h.otherUserId, h.orgId);
      const messageId = await insertMessage(
        h.client,
        h.teamConversationId,
        'rated by the teammate, not me'
      );

      const rated = await request(app)
        .post('/api/ai-feedback/response')
        .set('Authorization', `Bearer ${teammateToken}`)
        .send({ messageId, rating: 'positive' });
      expect(rated.status).toBe(201);

      // The conversation OWNER (a different user) reopens the same
      // conversation — they never rated this message themselves.
      const reopened = await request(app)
        .get(`/api/conversations/${h.teamConversationId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(reopened.status).toBe(200);
      const msg = (reopened.body.messages as any[]).find((m) => m.id === messageId);
      expect(msg).toBeTruthy();
      expect(msg.feedback).toBeFalsy();

      // But the teammate who actually rated it sees their own rating.
      const reopenedByTeammate = await request(app)
        .get(`/api/conversations/${h.teamConversationId}`)
        .set('Authorization', `Bearer ${teammateToken}`);
      const msgForTeammate = (reopenedByTeammate.body.messages as any[]).find(
        (m) => m.id === messageId
      );
      expect(msgForTeammate.feedback.rating).toBe('positive');
    }
  );

  itDB(
    'TENANT — a user from a DIFFERENT organization cannot read another org conversation (existing findAccessibleConversation() gate, unaffected by this packet)',
    async (h) => {
      const app = buildApp();
      const foreignToken = makeE2EToken(h.foreignUserId, h.otherOrgId);

      const res = await request(app)
        .get(`/api/conversations/${h.conversationId}`)
        .set('Authorization', `Bearer ${foreignToken}`);
      expect(res.status).toBe(404);
    }
  );
});
