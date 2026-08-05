/**
 * M01-P03A — conversation branching against a REAL Postgres database
 * (no mocks). Finding M01-035 (P1): `BranchSelector.tsx` was fully orphaned
 * (imported nowhere in src/) and `conversationBranchingService.ts` was
 * independently confirmed dead. This file exercises the REAL, owned surface:
 *
 *   POST /api/conversations/:id/branch  — extended (M01-P03A) to persist a
 *   `conversation_branches` row (migration 672_enterprise_agent_planner.sql
 *   — the LIVE schema; the archived 282_conversation_branches.sql
 *   root_message_id/is_main shape is dead and was never applied to the
 *   demo/live schema). Before this packet, `conversations.parent_
 *   conversation_id` was written via column-defensive `cAdd()` but that
 *   column DOES NOT EXIST in any migration (confirmed via
 *   `grep -rn "parent_conversation_id" server/migrations/` = zero hits, and
 *   via `\d conversations` on a freshly-migrated Postgres instance) — the
 *   parent/child link was silently dropped on every branch, and there was
 *   no way to list branches at all.
 *
 *   GET /api/conversations/:id/branches — new (M01-P03A). Lists branches
 *   forked FROM :id, and reports :id's own parent lineage if :id is itself
 *   a branch — this is what a fresh reopen uses to prove a branch still
 *   exists and still points at the correct parent/fork message.
 *
 * Pattern: mirrors tests/integration/routes/conversations.attachments.realdb.test.ts
 * (M01-P04A) — pgReachable()/itDB() vacuous-skip, real Express router, real
 * verifyToken via E2E_MODE unsigned-JWT bypass, per-test unique org/user/
 * conversation rows, best-effort cleanup.
 *
 * Negative controls (proven red manually via `git stash`/targeted revert,
 * screenshotted/logged, then restored + `git diff` confirmed — NOT baked
 * into this suite as a toggle, per the "no fallback success" rule):
 *   (a) BranchSelector unmount — tests/components/AIChat/UnifiedChatPanel.test.tsx
 *       "mounts the branch selector..." fails if the JSX mount block is removed.
 *   (b) persistence — "a branch is listed by GET /:id/branches after being
 *       created by POST /:id/branch" below fails if recordConversationBranch()
 *       is not called / its INSERT is broken.
 *   (c) tenant isolation — "a conversation belonging to another organization
 *       is unreachable" below fails if the organization_id predicate is
 *       stripped from the ownership check.
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
  'conversation_branches',
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
    name: 'M01-P03A RealDB Test User',
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
  otherOrgId: string;
  userId: string;
  otherUserId: string;
  conversationId: string;
  /** The random per-run tag baked into every title this harness creates —
   * use it to scope a brand-new, message-count-clean conversation per test
   * (see insertConversation()) while staying covered by the title-LIKE
   * cleanup sweep. */
  tag: string;
  conversationBranchesColumnsOk: boolean;
  cleanup: () => Promise<void>;
}

function suffix(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

async function insertMessage(
  client: Client,
  conversationId: string,
  content: string,
  seq: number
) {
  // M01-P03A: production message inserts always stamp `created_at` from JS
  // (`new Date().toISOString()` in conversations.routes.ts, millisecond
  // precision — Date has no finer resolution). Using Postgres-side `NOW()`
  // here (microsecond precision) is NOT representative of real data and, we
  // found by actually running this against Postgres, breaks the branch
  // route's own `created_at <= cutoff` fork-point query: the pg driver
  // reads a `timestamp` column back as a JS `Date` (truncating to ms), so
  // `cutoff.toISOString()` ends up strictly LESS than the microsecond-
  // precision value actually stored — the fork message excludes itself.
  // `date_trunc('milliseconds', ...)` makes the fixture match what
  // production ever actually writes.
  const row = await client.query<{ id: string }>(
    `INSERT INTO conversation_messages (id, conversation_id, role, content, message_type, seq, created_at)
     VALUES (
       gen_random_uuid()::text, $1, 'user', $2, 'text', $3::bigint,
       date_trunc('milliseconds', NOW() + ($3::bigint * interval '1 second'))
     )
     RETURNING id`,
    [conversationId, content, seq]
  );
  return row.rows[0].id;
}

/**
 * A fresh, empty, per-test conversation — used by any test that asserts an
 * exact copied-message COUNT, so an earlier test's inserts into the shared
 * harness conversation can never leak in and inflate the number.
 */
async function insertConversation(h: Harness, label: string): Promise<string> {
  const res = await h.client.query<{ id: string }>(
    `INSERT INTO conversations (user_id, organization_id, title) VALUES ($1, $2, $3) RETURNING id`,
    [h.userId, h.orgId, `M01-P03A ${label} ${h.tag}`]
  );
  return res.rows[0].id;
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

  const branchCols = await columnsOf(client, 'conversation_branches');
  const conversationBranchesColumnsOk = [
    'id',
    'conversation_id',
    'parent_branch_id',
    'fork_message_id',
    'branch_name',
    'created_by',
    'created_at',
  ].every((c) => branchCols.has(c));

  const tag = suffix();
  const orgId = `org_m01p03a_${tag}`;
  const otherOrgId = `org_m01p03a_other_${tag}`;
  const userId = `user_m01p03a_${tag}`;
  const otherUserId = `user_m01p03a_other_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'M01-P03A RealDB Org', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'M01-P03A RealDB Other Org', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [otherOrgId]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'CONSULTANT', 'active', 'M01P03A', 'Test')
     ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, `${userId}@local.test`]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'CONSULTANT', 'active', 'M01P03A', 'Other')
     ON CONFLICT (id) DO NOTHING`,
    [otherUserId, otherOrgId, `${otherUserId}@local.test`]
  );

  const convRes = await client.query<{ id: string }>(
    `INSERT INTO conversations (user_id, organization_id, title) VALUES ($1, $2, $3) RETURNING id`,
    [userId, orgId, `M01-P03A branch test ${tag}`]
  );
  const conversationId = convRes.rows[0].id;

  const cleanup = async () => {
    try {
      // Every branch (and nested branch-of-a-branch) created in this test
      // tree carries the run's `tag` in its title, because the server sets
      // a branch's title to `${source.title} (Branch)` — the tag propagates
      // down the whole chain. One title-based sweep therefore covers the
      // root conversation AND every descendant branch, without needing to
      // track server-minted branch ids individually.
      await client.query(
        `DELETE FROM conversation_branches WHERE conversation_id IN (
           SELECT id FROM conversations WHERE title LIKE $1
         ) OR id IN (
           SELECT id FROM conversations WHERE title LIKE $1
         )`,
        [`%${tag}%`]
      );
      await client.query(
        `DELETE FROM conversation_messages WHERE conversation_id IN (
           SELECT id FROM conversations WHERE title LIKE $1
         )`,
        [`%${tag}%`]
      );
      await client.query(`DELETE FROM conversations WHERE title LIKE $1`, [`%${tag}%`]);
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
    conversationId,
    tag,
    conversationBranchesColumnsOk,
    cleanup,
  };
}

describe('M01-P03A — conversation branching against a real Postgres database', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — M01-P03A branching realdb tests skipped.'
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
    'migration 672_enterprise_agent_planner is actually applied: conversation_branches has the real shape (not the archived 282 root_message_id/is_main shape)',
    async (h) => {
      expect(h.conversationBranchesColumnsOk).toBe(true);
    }
  );

  itDB(
    'conversations.parent_conversation_id genuinely does not exist (confirms the pre-M01-P03A silent data loss this packet fixes)',
    async (h) => {
      const cols = await columnsOf(h.client, 'conversations');
      expect(cols.has('parent_conversation_id')).toBe(false);
    }
  );

  itDB(
    'POST /:id/branch creates a new conversation, copies messages up to the fork point, and PERSISTS a conversation_branches row (negative control b: fails if recordConversationBranch is removed/broken)',
    async (h) => {
      const sourceId = await insertConversation(h, 'persistence-src');
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const msg1 = await insertMessage(h.client, sourceId, 'first', 1);
      await insertMessage(h.client, sourceId, 'second (after fork point)', 2);

      const res = await request(app)
        .post(`/api/conversations/${sourceId}/branch`)
        .set('Authorization', `Bearer ${token}`)
        .send({ forkMessageId: msg1, branchName: 'Alt path A' });

      expect(res.status).toBe(201);
      const newId = res.body?.conversation?.id;
      expect(typeof newId).toBe('string');
      expect(res.body.copiedMessages).toBe(1);
      expect(res.body.branch).toBeTruthy();
      expect(res.body.branch.id).toBe(newId);
      expect(res.body.branch.conversationId).toBe(sourceId);
      expect(res.body.branch.forkMessageId).toBe(msg1);
      expect(res.body.branch.branchName).toBe('Alt path A');

      // Assert directly against the database — not just the HTTP response —
      // this is the actual persistence proof.
      const row = await h.client.query(
        `SELECT conversation_id, fork_message_id, branch_name, created_by
           FROM conversation_branches WHERE id = $1`,
        [newId]
      );
      expect(row.rows).toEqual([
        {
          conversation_id: sourceId,
          fork_message_id: msg1,
          branch_name: 'Alt path A',
          created_by: h.userId,
        },
      ]);

      const copiedMsgs = await h.client.query(
        `SELECT content FROM conversation_messages WHERE conversation_id = $1`,
        [newId]
      );
      expect(copiedMsgs.rows).toEqual([{ content: 'first' }]);
    }
  );

  itDB(
    'GET /:id/branches lists a branch created by POST /:id/branch, with correct messageCount (fresh-reopen proof: a brand-new request/app instance, not the same in-memory response)',
    async (h) => {
      const sourceId = await insertConversation(h, 'list-src');
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const m1 = await insertMessage(h.client, sourceId, 'root msg 1', 1);
      await insertMessage(h.client, sourceId, 'root msg 2', 2);

      const createRes = await request(app)
        .post(`/api/conversations/${sourceId}/branch`)
        .set('Authorization', `Bearer ${token}`)
        .send({ forkMessageId: m1, branchName: 'Fresh-reopen branch' });
      expect(createRes.status).toBe(201);
      const branchId = createRes.body.conversation.id;

      // Simulate a fresh reopen: brand-new Express app + brand-new request,
      // no shared in-memory state with the POST above.
      const freshApp = buildApp();
      const listRes = await request(freshApp)
        .get(`/api/conversations/${sourceId}/branches`)
        .set('Authorization', `Bearer ${token}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.isBranch).toBe(false);
      const found = (listRes.body.branches || []).find((b: any) => b.id === branchId);
      expect(found).toBeTruthy();
      expect(found.conversationId).toBe(sourceId);
      expect(found.forkMessageId).toBe(m1);
      expect(found.branchName).toBe('Fresh-reopen branch');
      expect(found.messageCount).toBe(1);
    }
  );

  itDB(
    'GET /:id/branches on the BRANCH itself reports correct parent lineage (isBranch, parentConversationId, forkMessageId) — the exact check a client uses to prove a branch "still points at the right parent/message" after reopen',
    async (h) => {
      const sourceId = await insertConversation(h, 'lineage-src');
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const m1 = await insertMessage(h.client, sourceId, 'lineage root', 1);

      const createRes = await request(app)
        .post(`/api/conversations/${sourceId}/branch`)
        .set('Authorization', `Bearer ${token}`)
        .send({ forkMessageId: m1, branchName: 'Lineage branch' });
      const branchId = createRes.body.conversation.id;

      const freshApp = buildApp();
      const selfRes = await request(freshApp)
        .get(`/api/conversations/${branchId}/branches`)
        .set('Authorization', `Bearer ${token}`);

      expect(selfRes.status).toBe(200);
      expect(selfRes.body.isBranch).toBe(true);
      expect(selfRes.body.parentConversationId).toBe(sourceId);
      expect(selfRes.body.forkMessageId).toBe(m1);
      expect(selfRes.body.branchName).toBe('Lineage branch');
      expect(selfRes.body.parentBranchId).toBe(null);
    }
  );

  itDB(
    'nested branching: a branch-of-a-branch chains parent_branch_id correctly',
    async (h) => {
      const sourceId = await insertConversation(h, 'nested-src');
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const m1 = await insertMessage(h.client, sourceId, 'gen0', 1);

      const gen1Res = await request(app)
        .post(`/api/conversations/${sourceId}/branch`)
        .set('Authorization', `Bearer ${token}`)
        .send({ forkMessageId: m1, branchName: 'Gen1' });
      const gen1Id = gen1Res.body.conversation.id;

      // Branch gen1 itself — no forkMessageId given, so the server falls
      // back to the last copied message.
      const gen2Res = await request(app)
        .post(`/api/conversations/${gen1Id}/branch`)
        .set('Authorization', `Bearer ${token}`)
        .send({ branchName: 'Gen2' });
      expect(gen2Res.status).toBe(201);
      const gen2Id = gen2Res.body.conversation.id;

      const row = await h.client.query(
        `SELECT parent_branch_id FROM conversation_branches WHERE id = $1`,
        [gen2Id]
      );
      expect(row.rows[0].parent_branch_id).toBe(gen1Id);
    }
  );

  itDB(
    'a conversation belonging to another organization is unreachable via POST /:id/branch (negative control c: fails if the organization_id predicate is stripped)',
    async (h) => {
      const otherConvRes = await h.client.query<{ id: string }>(
        `INSERT INTO conversations (user_id, organization_id, title) VALUES ($1, $2, $3) RETURNING id`,
        [h.otherUserId, h.otherOrgId, `M01-P03A other-org conv ${suffix()}`]
      );
      const otherConvId = otherConvRes.rows[0].id;

      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId); // caller is in orgId, NOT otherOrgId

      const res = await request(app)
        .post(`/api/conversations/${otherConvId}/branch`)
        .set('Authorization', `Bearer ${token}`)
        .send({});
      expect(res.status).toBe(404);

      // Cleanup this one extra row (not covered by the title-tag sweep since
      // it uses a fresh suffix()).
      await h.client.query(`DELETE FROM conversations WHERE id = $1`, [otherConvId]);
    }
  );

  itDB(
    'a conversation belonging to another organization is unreachable via GET /:id/branches (tenant isolation on the list endpoint too)',
    async (h) => {
      const otherConvRes = await h.client.query<{ id: string }>(
        `INSERT INTO conversations (user_id, organization_id, title) VALUES ($1, $2, $3) RETURNING id`,
        [h.otherUserId, h.otherOrgId, `M01-P03A other-org conv ${suffix()}`]
      );
      const otherConvId = otherConvRes.rows[0].id;

      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);

      const res = await request(app)
        .get(`/api/conversations/${otherConvId}/branches`)
        .set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(404);

      await h.client.query(`DELETE FROM conversations WHERE id = $1`, [otherConvId]);
    }
  );

  itDB(
    'branching without a forkMessageId falls back to the last message as the anchor (whole-thread branch still gets a valid, non-null fork_message_id)',
    async (h) => {
      const sourceId = await insertConversation(h, 'fallback-anchor-src');
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      await insertMessage(h.client, sourceId, 'a', 1);
      const last = await insertMessage(h.client, sourceId, 'b', 2);

      const res = await request(app)
        .post(`/api/conversations/${sourceId}/branch`)
        .set('Authorization', `Bearer ${token}`)
        .send({ branchName: 'Whole thread' });

      expect(res.status).toBe(201);
      expect(res.body.copiedMessages).toBe(2);
      expect(res.body.branch.forkMessageId).toBe(last);
    }
  );
});
