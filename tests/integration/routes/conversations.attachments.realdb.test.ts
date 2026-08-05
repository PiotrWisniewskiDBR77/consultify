/**
 * M01-P04A — POST/GET/DELETE /api/conversations/:id/messages/:messageId/attachments,
 * against a REAL Postgres database (no mocks).
 *
 * Packet requirements exercised here (see
 * docs/ui-standards/evidence/final-acceptance-2026-08-04/01-chat/orchestration/packets/M01-P04A_PACKET.md):
 *
 *   §3.1 (P0.4 / GF-CHAT-02) — the pointer endpoint must never display a
 *   rejected or never-ingested file as "ready". Before this packet,
 *   `conversation_message_attachments` had NO status column at all — "ready"
 *   was purely a client-remembered UI state, never attested by the server.
 *   Migration 942_chat_m01p04a_attachment_status.sql adds status/status_reason/
 *   status_detail; `resolveAttachmentStatus()` in conversations.routes.ts
 *   computes it server-side from the caller-claimed mime/sizeBytes/targetId,
 *   re-validated against the same matrix ai.routes.ts already enforces on
 *   real ingest (25MB file / 6MB URL, fixed mime allow-list).
 *
 *   §3.3 — documented format/size matrix, enforced (not just described).
 *
 *   §6/§8 — idempotency: re-attaching the same targetId to the same message
 *   must not create an orphaned duplicate row. Backed by the partial unique
 *   index `uq_msg_attachments_message_target` (kind IN ('file','link')).
 *
 *   §8 — tenant ACL: a targetId (knowledge_docs row) belonging to another
 *   organization must be unreachable. This closes a confirmed, not assumed,
 *   gap: `knowledge_docs` had NO organization_id column at all before this
 *   migration (verified against 000_z_core_baseline.sql) — ai.routes.ts's
 *   `UPDATE knowledge_docs SET organization_id = ?` was silently no-op'ing
 *   against a nonexistent column (`{ fallback: true }`).
 *
 * `server/src/routes/conversations.routes.ts` attachment handlers (and the
 * `metadata.attachments` auto-bridge inside `POST /:id/messages`) ARE this
 * packet's owned surface — this file both exercises AND was used to drive
 * the fix, unlike the P01/P02 realdb files which only exercise routes they
 * do not own.
 *
 * Pattern: mirrors tests/integration/routes/conversations.messages.idempotency.realdb.test.ts
 * (M01-P01) and conversations.search.realdb.test.ts (M01-P02) — pgReachable()/
 * itDB() vacuous-skip, real Express router, real verifyToken via E2E_MODE
 * unsigned-JWT bypass, per-test unique org/user/conversation rows, best-effort
 * cleanup.
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

const REQUIRED_TABLES = [
  'conversations',
  'conversation_messages',
  'conversation_message_attachments',
  'knowledge_docs',
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
    name: 'M01-P04A RealDB Test User',
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
  conversationId: string;
  attachmentStatusColumnsApplied: boolean;
  knowledgeDocsOrgColumnApplied: boolean;
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

async function insertKnowledgeDoc(
  client: Client,
  opts: { docId: string; organizationId: string | null; filename?: string }
) {
  await client.query(
    `INSERT INTO knowledge_docs (id, filename, filepath, status, organization_id, created_at)
     VALUES ($1, $2, '', 'indexed', $3, NOW())
     ON CONFLICT (id) DO NOTHING`,
    [opts.docId, opts.filename || 'test.pdf', opts.organizationId]
  );
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

  const attachmentStatusColumnsApplied = await columnExists(
    client,
    'conversation_message_attachments',
    'status'
  );
  const knowledgeDocsOrgColumnApplied = await columnExists(
    client,
    'knowledge_docs',
    'organization_id'
  );

  const tag = suffix();
  const orgId = `org_m01p04a_${tag}`;
  const otherOrgId = `org_m01p04a_other_${tag}`;
  const userId = `user_m01p04a_${tag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'M01-P04A RealDB Org', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'M01-P04A RealDB Other Org', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [otherOrgId]
  );
  await client.query(
    `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
     VALUES ($1, $2, $3, 'x', 'CONSULTANT', 'active', 'M01P04A', 'Test')
     ON CONFLICT (id) DO NOTHING`,
    [userId, orgId, `${userId}@local.test`]
  );

  const convRes = await client.query<{ id: string }>(
    `INSERT INTO conversations (user_id, organization_id, title) VALUES ($1, $2, $3) RETURNING id`,
    [userId, orgId, `M01-P04A attachments test ${tag}`]
  );
  const conversationId = convRes.rows[0].id;

  const cleanup = async () => {
    try {
      await client.query(
        `DELETE FROM conversation_message_attachments WHERE conversation_id = $1`,
        [conversationId]
      );
      await client.query(`DELETE FROM conversation_messages WHERE conversation_id = $1`, [
        conversationId,
      ]);
      await client.query(`DELETE FROM conversations WHERE id = $1`, [conversationId]);
      await client.query(`DELETE FROM knowledge_docs WHERE filename LIKE $1`, [
        `m01p04a-${tag}-%`,
      ]);
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
    conversationId,
    attachmentStatusColumnsApplied,
    knowledgeDocsOrgColumnApplied,
    cleanup,
  };
}

describe('M01-P04A — attachment pointer endpoints against a real Postgres database', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — M01-P04A attachments realdb tests skipped.'
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
    'migration 942_chat_m01p04a_attachment_status is actually applied (status columns + knowledge_docs.organization_id exist)',
    async (h) => {
      // Exactly the risk class the coordinator flagged after lane C found
      // migration 800 deployed-but-not-applied on demo, and lane B found a
      // TIMESTAMPTZ/TEXT type mismatch on ensureStorage() — assert the schema
      // this packet depends on, never assume it from the migration file text.
      expect(h.attachmentStatusColumnsApplied).toBe(true);
      expect(h.knowledgeDocsOrgColumnApplied).toBe(true);
    }
  );

  itDB('a valid, in-matrix file attachment is honestly marked "ready" (P0.4)', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.userId, h.orgId);
    const messageId = await insertMessage(h.client, h.conversationId, 'here is a file');
    const docId = `doc-ready-${suffix()}`;
    await insertKnowledgeDoc(h.client, {
      docId,
      organizationId: h.orgId,
      filename: `m01p04a-${docId}-report.pdf`,
    });

    const res = await request(app)
      .post(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        kind: 'file',
        targetId: docId,
        displayName: 'report.pdf',
        mime: 'application/pdf',
        sizeBytes: 1_000_000,
      });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ready');
    expect(res.body.status_reason).toBeFalsy();

    const rows = await h.client.query(
      `SELECT status FROM conversation_message_attachments WHERE message_id = $1`,
      [messageId]
    );
    expect(rows.rows).toEqual([{ status: 'ready' }]);
  });

  itDB(
    'an oversized file is honestly marked "failed" — never fabricated as "ready" (matrix enforcement)',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const messageId = await insertMessage(h.client, h.conversationId, 'here is a huge file');
      const docId = `doc-oversized-${suffix()}`;
      await insertKnowledgeDoc(h.client, {
        docId,
        organizationId: h.orgId,
        filename: `m01p04a-${docId}-huge.pdf`,
      });

      const res = await request(app)
        .post(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          kind: 'file',
          targetId: docId,
          displayName: 'huge.pdf',
          mime: 'application/pdf',
          sizeBytes: 26 * 1024 * 1024, // 1MB over the 25MB matrix limit
        });

      expect(res.status).toBe(201); // the POST succeeds — it honestly PERSISTS a failed pointer
      expect(res.body.status).toBe('failed');
      expect(res.body.status_reason).toBe('SIZE_LIMIT_EXCEEDED');
    }
  );

  itDB(
    'an unsupported mime type is honestly marked "failed" (matrix enforcement)',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const messageId = await insertMessage(h.client, h.conversationId, 'here is an exe');
      const docId = `doc-badmime-${suffix()}`;
      await insertKnowledgeDoc(h.client, {
        docId,
        organizationId: h.orgId,
        filename: `m01p04a-${docId}-payload.exe`,
      });

      const res = await request(app)
        .post(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          kind: 'file',
          targetId: docId,
          displayName: 'payload.exe',
          mime: 'application/x-msdownload',
          sizeBytes: 1000,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('failed');
      expect(res.body.status_reason).toBe('UNSUPPORTED_FORMAT');
    }
  );

  itDB(
    'a file kind with no targetId (ingest never completed) is honestly marked "failed", not "ready"',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const messageId = await insertMessage(h.client, h.conversationId, 'ingest never finished');

      const res = await request(app)
        .post(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          kind: 'file',
          displayName: 'never-ingested.pdf',
          mime: 'application/pdf',
          sizeBytes: 1000,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('failed');
      expect(res.body.status_reason).toBe('INGEST_NOT_COMPLETED');
    }
  );

  itDB(
    'ready status SURVIVES a fresh reopen (GET after POST, simulating hard reload) (packet §7)',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const messageId = await insertMessage(h.client, h.conversationId, 'reopen test');
      const docId = `doc-reopen-${suffix()}`;
      await insertKnowledgeDoc(h.client, {
        docId,
        organizationId: h.orgId,
        filename: `m01p04a-${docId}-reopen.pdf`,
      });

      const created = await request(app)
        .post(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'file', targetId: docId, displayName: 'reopen.pdf', mime: 'application/pdf' });
      expect(created.status).toBe(201);

      // A fresh GET (new request, no shared in-memory state) is the server-side
      // equivalent of a hard reload re-fetching the message's attachments.
      const reopened = await request(app)
        .get(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
        .set('Authorization', `Bearer ${token}`);
      expect(reopened.status).toBe(200);
      expect(reopened.body.attachments).toHaveLength(1);
      expect(reopened.body.attachments[0].status).toBe('ready');
      expect(reopened.body.attachments[0].id).toBe(created.body.id);
    }
  );

  itDB(
    'deleted attachment does NOT come back after reopen (packet §7)',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const messageId = await insertMessage(h.client, h.conversationId, 'delete test');
      const docId = `doc-delete-${suffix()}`;
      await insertKnowledgeDoc(h.client, {
        docId,
        organizationId: h.orgId,
        filename: `m01p04a-${docId}-delete.pdf`,
      });

      const created = await request(app)
        .post(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'file', targetId: docId, displayName: 'delete.pdf', mime: 'application/pdf' });
      expect(created.status).toBe(201);

      const del = await request(app)
        .delete(
          `/api/conversations/${h.conversationId}/messages/${messageId}/attachments/${created.body.id}`
        )
        .set('Authorization', `Bearer ${token}`);
      expect(del.status).toBe(200);

      const reopened = await request(app)
        .get(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
        .set('Authorization', `Bearer ${token}`);
      expect(reopened.body.attachments).toHaveLength(0);
    }
  );

  itDB(
    'IDEMPOTENCY (packet §6/§8) — re-attaching the SAME targetId to the SAME message does not create an orphaned duplicate row',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const messageId = await insertMessage(h.client, h.conversationId, 'idempotency test');
      const docId = `doc-idem-${suffix()}`;
      await insertKnowledgeDoc(h.client, {
        docId,
        organizationId: h.orgId,
        filename: `m01p04a-${docId}-idem.pdf`,
      });
      const payload = {
        kind: 'file',
        targetId: docId,
        displayName: 'idem.pdf',
        mime: 'application/pdf',
        sizeBytes: 1000,
      };

      const first = await request(app)
        .post(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send(payload);
      expect(first.status).toBe(201);

      const retry = await request(app)
        .post(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send(payload);
      expect(retry.status).toBe(200); // 200, not 201 — no new row was created
      expect(retry.body.id).toBe(first.body.id);

      const rows = await h.client.query(
        `SELECT id FROM conversation_message_attachments WHERE message_id = $1 AND target_id = $2`,
        [messageId, docId]
      );
      expect(rows.rows.length).toBe(1);
    }
  );

  itDB(
    'concurrent identical attach requests still collapse to one row (race path)',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const messageId = await insertMessage(h.client, h.conversationId, 'race test');
      const docId = `doc-race-${suffix()}`;
      await insertKnowledgeDoc(h.client, {
        docId,
        organizationId: h.orgId,
        filename: `m01p04a-${docId}-race.pdf`,
      });
      const payload = {
        kind: 'file',
        targetId: docId,
        displayName: 'race.pdf',
        mime: 'application/pdf',
      };

      const [a, b] = await Promise.all([
        request(app)
          .post(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
          .set('Authorization', `Bearer ${token}`)
          .send(payload),
        request(app)
          .post(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
          .set('Authorization', `Bearer ${token}`)
          .send(payload),
      ]);

      expect([a.status, b.status].sort()).toEqual([200, 201]);
      expect(a.body.id).toBe(b.body.id);

      const rows = await h.client.query(
        `SELECT id FROM conversation_message_attachments WHERE message_id = $1 AND target_id = $2`,
        [messageId, docId]
      );
      expect(rows.rows.length).toBe(1);
    }
  );

  itDB(
    'NEGATIVE CONTROL — a DIFFERENT targetId on the same message is NOT deduped (idempotency is conditional on the target actually matching)',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const messageId = await insertMessage(h.client, h.conversationId, 'two distinct files');
      const docIdA = `doc-two-a-${suffix()}`;
      const docIdB = `doc-two-b-${suffix()}`;
      await insertKnowledgeDoc(h.client, {
        docId: docIdA,
        organizationId: h.orgId,
        filename: `m01p04a-${docIdA}-a.pdf`,
      });
      await insertKnowledgeDoc(h.client, {
        docId: docIdB,
        organizationId: h.orgId,
        filename: `m01p04a-${docIdB}-b.pdf`,
      });

      const first = await request(app)
        .post(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'file', targetId: docIdA, displayName: 'a.pdf', mime: 'application/pdf' });
      expect(first.status).toBe(201);

      const second = await request(app)
        .post(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send({ kind: 'file', targetId: docIdB, displayName: 'b.pdf', mime: 'application/pdf' });
      expect(second.status).toBe(201); // a NEW row, not a dedup hit
      expect(second.body.id).not.toBe(first.body.id);

      const rows = await h.client.query(
        `SELECT id FROM conversation_message_attachments WHERE message_id = $1`,
        [messageId]
      );
      expect(rows.rows.length).toBe(2);
    }
  );

  itDB(
    'ACL (P0.9 / GF-CHAT-08) — a targetId belonging to ANOTHER organization is rejected (403), not persisted, and its real filename is never revealed',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const messageId = await insertMessage(h.client, h.conversationId, 'cross-tenant attempt');
      const foreignDocId = `doc-foreign-${suffix()}`;
      await insertKnowledgeDoc(h.client, {
        docId: foreignDocId,
        organizationId: h.otherOrgId, // belongs to a DIFFERENT org
        filename: `m01p04a-${foreignDocId}-SECRET-OTHER-ORG-CONTRACT.pdf`,
      });

      const res = await request(app)
        .post(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          kind: 'file',
          targetId: foreignDocId,
          displayName: 'guessed.pdf',
          mime: 'application/pdf',
        });

      expect(res.status).toBe(403);
      // The real filename of the foreign document must never appear in the response.
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain('SECRET-OTHER-ORG-CONTRACT');

      // Nothing was persisted — no "failed: access_denied" row either (that
      // would itself be an enumeration oracle distinguishing "not yours" from
      // "doesn't exist" across repeated attempts).
      const rows = await h.client.query(
        `SELECT id FROM conversation_message_attachments WHERE message_id = $1`,
        [messageId]
      );
      expect(rows.rows.length).toBe(0);
    }
  );

  itDB(
    'ACL — a targetId that does not exist at all is rejected identically to a cross-tenant one (no existence oracle)',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const messageId = await insertMessage(h.client, h.conversationId, 'nonexistent doc attempt');

      const resMissing = await request(app)
        .post(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          kind: 'file',
          targetId: `doc-does-not-exist-${suffix()}`,
          displayName: 'ghost.pdf',
          mime: 'application/pdf',
        });

      expect(resMissing.status).toBe(403);
      const rows = await h.client.query(
        `SELECT id FROM conversation_message_attachments WHERE message_id = $1`,
        [messageId]
      );
      expect(rows.rows.length).toBe(0);
    }
  );

  itDB(
    'the metadata.attachments auto-bridge on POST /:id/messages applies the SAME status/ACL/idempotency rules and does not double-insert with the dedicated endpoint',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.userId, h.orgId);
      const docId = `doc-bridge-${suffix()}`;
      await insertKnowledgeDoc(h.client, {
        docId,
        organizationId: h.orgId,
        filename: `m01p04a-${docId}-bridge.pdf`,
      });

      // Simulates useConversationStore.ts's real flow: create a message whose
      // metadata already carries the attachment...
      const msgRes = await request(app)
        .post(`/api/conversations/${h.conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          role: 'user',
          content: 'message with an inline attachment',
          metadata: {
            attachments: [
              { kind: 'file', docId, filename: 'bridge.pdf', mimeType: 'application/pdf', size: 1000 },
            ],
          },
        });
      expect(msgRes.status).toBe(201);
      const messageId = msgRes.body.id;

      // ...then the client ALSO calls the dedicated pointer endpoint with the
      // same targetId for the same message (exactly what useConversationStore.ts
      // does today, unconditionally, right after message creation succeeds).
      const dedicated = await request(app)
        .post(`/api/conversations/${h.conversationId}/messages/${messageId}/attachments`)
        .set('Authorization', `Bearer ${token}`)
        .send({
          kind: 'file',
          targetId: docId,
          displayName: 'bridge.pdf',
          mime: 'application/pdf',
          sizeBytes: 1000,
        });
      expect([200, 201]).toContain(dedicated.status);

      const rows = await h.client.query(
        `SELECT status FROM conversation_message_attachments WHERE message_id = $1 AND target_id = $2`,
        [messageId, docId]
      );
      // Exactly ONE row — not two — despite both write paths firing for the
      // same message+targetId. This is the orphaned-duplicate bug the packet
      // flagged (§6/§8) fixed at the storage layer.
      expect(rows.rows.length).toBe(1);
      expect(rows.rows[0].status).toBe('ready');
    }
  );
});
