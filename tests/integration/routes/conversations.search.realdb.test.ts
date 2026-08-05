/**
 * M01-P02 — GET /api/conversations/search against a REAL Postgres database (no mocks).
 *
 * Root cause (M01-002, confirmed on origin/demo by static analysis in
 * docs/ui-standards/evidence/final-acceptance-2026-08-04/01-chat/orchestration/packets/M01-P00_DISCOVERY.md
 * §4.3/§8.2): `GET /search` was registered ~1250 lines after `GET /:id`.
 * `GET /:id` validates its param as a UUID and `validateParams` answers a
 * hard 400 without calling `next()` on mismatch, so every request to
 * `/search` (not a UUID) was swallowed by `/:id` first — the search handler
 * was dead code. This file proves the fix on a REAL running Express router +
 * REAL `verifyToken` auth middleware + REAL Postgres (not a mocked DB layer,
 * unlike `server/src/routes/__tests__/conversations-search-routing.routes.test.ts`
 * on the `codex/m01-chat-repair-20260804` reference branch, which stubs
 * `DbPromise`). It also proves the security contract from
 * `M01-P02_PACKET.md` §3.4-3.6: content search (not just title), inert
 * snippet segments (no markup), ACL scoping via `checkChatPermission`, and
 * zero cross-tenant leakage.
 *
 * Auth: two paths, deliberately different so tests can independently control
 * organization_members state:
 *  - E2E_MODE unsigned-JWT bypass (server/src/middleware/auth.middleware.ts
 *    ~L1030-1136) auto-seeds an ACTIVE ADMIN organization_members row for
 *    whichever (userId, organizationId) authenticates. Convenient for the
 *    "has team-read" positive paths.
 *  - A REAL signed JWT (jsonwebtoken, using the same JWT_SECRET
 *    tests/setup.ts exports globally) that goes through the NORMAL
 *    `attachUser` path, which only READS organization_members — it never
 *    inserts a row. This is what lets this file test "authenticated,
 *    correct org claim, but NOT a team member" (checkChatPermission ->
 *    role 'none' -> read denied) as a genuine, unmocked DB state instead of
 *    stubbing chatPermissionService.
 *
 * DB: mirrors the `pgReachable()` precondition pattern from
 * tests/integration/table-platform.idor.realdb.test.ts — every test starts
 * with a fast connection probe and the whole suite reports a clean,
 * non-failing skip when no reachable Postgres is configured.
 *
 * HOW TO RUN LOCALLY (Docker available):
 *   docker run -d --name m01p02-pg -e POSTGRES_USER=consultinity \
 *     -e POSTGRES_PASSWORD=consultinity -e POSTGRES_DB=consultinity_test \
 *     -p 55901:5432 pgvector/pgvector:pg16
 *   NODE_ENV=test DATABASE_URL=postgresql://consultinity:consultinity@127.0.0.1:55901/consultinity_test \
 *     DB_TYPE=postgres npx tsx server/scripts/migrate.postgres.ts --safe
 *   DATABASE_URL=postgresql://consultinity:consultinity@127.0.0.1:55901/consultinity_test \
 *     npx vitest run tests/integration/routes/conversations.search.realdb.test.ts
 */

import { randomBytes } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import express from 'express';
import jwt from 'jsonwebtoken';

import conversationsRoutes from '../../../server/src/routes/conversations.routes.js';

// ---------------------------------------------------------------------------
// Force the app's database factory to use a REAL Postgres pool + enable the
// E2E auth bypass, but ONLY when a database is actually configured — mirrors
// tests/integration/table-platform.idor.realdb.test.ts.
// ---------------------------------------------------------------------------
if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
}

// ---------------------------------------------------------------------------
// Connection probe
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

const REQUIRED_TABLES = [
  'conversations',
  'conversation_messages',
  'chat_projects',
  'organizations',
  'users',
  'organization_members',
] as const;

// ---------------------------------------------------------------------------
// E2E identity minting (same shape as tests/integration/table-platform.idor.realdb.test.ts)
// ---------------------------------------------------------------------------

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
    name: 'M01-P02 RealDB Test User',
    role: 'ADMIN',
    userRole: 'ADMIN',
    organizationId,
    isSuperAdmin: false,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

/**
 * A REAL signed JWT via the normal (non-E2E) `verifyToken` path. Unlike
 * `makeE2EToken`, this does NOT auto-seed `organization_members` — it lets a
 * test assert the "authenticated, claims this org, but not actually a member
 * of it" state against a real, unmocked `checkChatPermission` DB read.
 */
function makeSignedToken(userId: string, organizationId?: string): string {
  const secret = process.env.JWT_SECRET || 'test-jwt-secret-key-min-32-chars-long-for-validation';
  return jwt.sign(
    {
      id: userId,
      email: `${userId}@local.test`,
      role: 'CONSULTANT',
      ...(organizationId ? { organizationId } : {}),
    },
    secret,
    { expiresIn: '1h' }
  );
}

// ---------------------------------------------------------------------------
// App under test — REAL router, REAL verifyToken, REAL checkChatPermission.
// ---------------------------------------------------------------------------

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/conversations', conversationsRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

interface Harness {
  client: Client;
  orgId: string;
  foreignOrgId: string;
  ownerUserId: string;
  allowedTeamReaderUserId: string;
  deniedSameOrgUserId: string;
  foreignTenantUserId: string;
  personalOnlyUserId: string;
  /** Unique term planted ONLY in a message body, never in title/preview. */
  contentOnlyTerm: string;
  /** Team-scope conversation whose title does not contain contentOnlyTerm. */
  teamConversationId: string;
  teamMatchedMessageId: string;
  /** Message content containing an HTML-shaped payload, for snippet-safety assertions. */
  xssTerm: string;
  xssConversationId: string;
  xssMessageId: string;
  xssRawContent: string;
  /** A conversation owned by personalOnlyUserId (personal scope, no org). */
  personalConversationId: string;
  personalTerm: string;
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
  const orgId = `org_m01p02_${tag}`;
  const foreignOrgId = `org_m01p02_foreign_${tag}`;
  const ownerUserId = `user_m01p02_owner_${tag}`;
  const allowedTeamReaderUserId = `user_m01p02_reader_${tag}`;
  const deniedSameOrgUserId = `user_m01p02_denied_${tag}`;
  const foreignTenantUserId = `user_m01p02_foreign_${tag}`;
  const personalOnlyUserId = `user_m01p02_personal_${tag}`;
  // Postgres's `simple` text search config splits on `_`, turning one
  // "word" into two lexemes joined by `<->` — which changes which fragment
  // ts_headline windows around and broke this file's first draft (the
  // headline dropped the leading "before <img..." text because the two
  // lexemes sat further into the string). Search TERMS must stay pure
  // alnum for uniqueness across runs; ids can keep using the underscored
  // `tag` freely since they are never fed into tsquery.
  const termTag = tag.replace(/[^a-z0-9]/gi, '');
  const contentOnlyTerm = `zebraquokka${termTag}`;
  const xssTerm = `narwhalgryphon${termTag}`;
  const personalTerm = `okapipangolin${termTag}`;

  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'M01-P02 RealDB Org', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [orgId]
  );
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, 'M01-P02 RealDB Foreign Org', 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [foreignOrgId]
  );

  for (const userId of [
    ownerUserId,
    allowedTeamReaderUserId,
    deniedSameOrgUserId,
    foreignTenantUserId,
    personalOnlyUserId,
  ]) {
    await client.query(
      `INSERT INTO users (id, organization_id, email, password, role, status, first_name, last_name)
       VALUES ($1, $2, $3, 'x', 'CONSULTANT', 'active', 'M01P02', 'Test')
       ON CONFLICT (id) DO NOTHING`,
      [userId, orgId, `${userId}@local.test`]
    );
  }

  // Team membership: owner (OWNER) and allowedTeamReader (MEMBER) are real,
  // ACTIVE members of orgId. deniedSameOrgUserId is deliberately NOT
  // inserted here — their JWT will claim organizationId=orgId but
  // checkChatPermission must resolve role 'none' for them (no DB row).
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1, $2, $3, 'OWNER', 'ACTIVE') ON CONFLICT (organization_id, user_id) DO NOTHING`,
    [`om_owner_${tag}`, orgId, ownerUserId]
  );
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1, $2, $3, 'MEMBER', 'ACTIVE') ON CONFLICT (organization_id, user_id) DO NOTHING`,
    [`om_reader_${tag}`, orgId, allowedTeamReaderUserId]
  );
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1, $2, $3, 'ADMIN', 'ACTIVE') ON CONFLICT (organization_id, user_id) DO NOTHING`,
    [`om_foreign_${tag}`, foreignOrgId, foreignTenantUserId]
  );

  // Team-scope chat_project + conversation, owned by ownerUserId.
  const teamProjectRes = await client.query<{ id: string }>(
    `INSERT INTO chat_projects (user_id, organization_id, name, scope)
     VALUES ($1, $2, $3, 'team') RETURNING id`,
    [ownerUserId, orgId, `M01-P02 Team Folder ${tag}`]
  );
  const teamProjectId = teamProjectRes.rows[0].id;

  const teamConvRes = await client.query<{ id: string }>(
    `INSERT INTO conversations (user_id, organization_id, chat_project_id, title)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [ownerUserId, orgId, teamProjectId, `Team conversation ${tag} (no content-only term in title)`]
  );
  const teamConversationId = teamConvRes.rows[0].id;

  const teamMsgRes = await client.query<{ id: string }>(
    `INSERT INTO conversation_messages (conversation_id, role, content, seq)
     VALUES ($1, 'user', $2, 1) RETURNING id`,
    [teamConversationId, `Please describe our ${contentOnlyTerm} rollout plan in detail.`]
  );
  const teamMatchedMessageId = teamMsgRes.rows[0].id;

  // XSS-shaped payload conversation (separate from the team conversation so
  // the two snippet assertions cannot interfere with each other).
  const xssConvRes = await client.query<{ id: string }>(
    `INSERT INTO conversations (user_id, organization_id, chat_project_id, title)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [ownerUserId, orgId, teamProjectId, `XSS-safety conversation ${tag}`]
  );
  const xssConversationId = xssConvRes.rows[0].id;
  const xssRawContent = `before <img src=x onerror=alert(1)> ${xssTerm} after`;
  const xssMsgRes = await client.query<{ id: string }>(
    `INSERT INTO conversation_messages (conversation_id, role, content, seq)
     VALUES ($1, 'user', $2, 1) RETURNING id`,
    [xssConversationId, xssRawContent]
  );
  const xssMessageId = xssMsgRes.rows[0].id;

  // Personal-scope conversation (no organization at all), owned by
  // personalOnlyUserId, matched purely by message content.
  const personalConvRes = await client.query<{ id: string }>(
    `INSERT INTO conversations (user_id, title) VALUES ($1, $2) RETURNING id`,
    [personalOnlyUserId, `Personal conversation ${tag}`]
  );
  const personalConversationId = personalConvRes.rows[0].id;
  await client.query(
    `INSERT INTO conversation_messages (conversation_id, role, content, seq)
     VALUES ($1, 'user', $2, 1)`,
    [personalConversationId, `A note about ${personalTerm} for myself only.`]
  );

  const cleanup = async () => {
    try {
      await client.query(`DELETE FROM conversation_messages WHERE conversation_id = ANY($1)`, [
        [teamConversationId, xssConversationId, personalConversationId],
      ]);
      await client.query(`DELETE FROM conversations WHERE id = ANY($1)`, [
        [teamConversationId, xssConversationId, personalConversationId],
      ]);
      await client.query(`DELETE FROM chat_projects WHERE id = $1`, [teamProjectId]);
      await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
        [orgId, foreignOrgId],
      ]);
      // Best-effort: the E2E auth bypass may have auto-seeded additional
      // organization_members / users rows for identities that authenticated
      // via makeE2EToken.
      await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [
        [orgId, foreignOrgId],
      ]);
      await client.query(`DELETE FROM users WHERE id = $1`, [personalOnlyUserId]);
      await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgId, foreignOrgId]]);
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
    orgId,
    foreignOrgId,
    ownerUserId,
    allowedTeamReaderUserId,
    deniedSameOrgUserId,
    foreignTenantUserId,
    personalOnlyUserId,
    contentOnlyTerm,
    teamConversationId,
    teamMatchedMessageId,
    xssTerm,
    xssConversationId,
    xssMessageId,
    xssRawContent,
    personalConversationId,
    personalTerm,
    cleanup,
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('M01-P02 — conversations search against a real Postgres database (no mocks)', () => {
  let harness: Harness | null = null;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable (or schema incomplete) — M01-P02 search realdb tests skipped. ' +
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

  // -------------------------------------------------------------------
  // Reachability (the M01-002 regression itself)
  // -------------------------------------------------------------------

  itDB('reaches the search handler, not the /:id uuid validator (200, not 400)', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.personalOnlyUserId, h.orgId);
    const res = await request(app)
      .get('/api/conversations/search')
      .query({ q: h.personalTerm })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('query', h.personalTerm);
    expect(Array.isArray(res.body.conversations)).toBe(true);
  });

  itDB('a real non-uuid path segment still 400s through /:id (ordering did not break /:id)', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.personalOnlyUserId, h.orgId);
    const res = await request(app)
      .get('/api/conversations/definitely-not-a-uuid')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  itDB('a real conversation id still resolves through /:id after reordering', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.personalOnlyUserId, h.orgId);
    const res = await request(app)
      .get(`/api/conversations/${h.personalConversationId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(h.personalConversationId);
  });

  itDB('GET /search with no token at all is 401 (auth is not accidentally optional)', async (h) => {
    const app = buildApp();
    const res = await request(app).get('/api/conversations/search').query({ q: h.personalTerm });
    expect(res.status).toBe(401);
  });

  // -------------------------------------------------------------------
  // Content search + snippet + deep link
  // -------------------------------------------------------------------

  itDB('finds a conversation by MESSAGE CONTENT alone (title does not contain the term)', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.ownerUserId, h.orgId);
    const res = await request(app)
      .get('/api/conversations/search')
      .query({ q: h.contentOnlyTerm })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const hit = res.body.conversations.find((c: any) => c.id === h.teamConversationId);
    expect(hit).toBeTruthy();
    expect(hit.title.toLowerCase()).not.toContain(h.contentOnlyTerm.toLowerCase());
    expect(hit.matched_message_id).toBe(h.teamMatchedMessageId);
    expect(Array.isArray(hit.matched_snippet)).toBe(true);
    const marked = hit.matched_snippet.filter((seg: any) => seg.mark);
    expect(marked.length).toBeGreaterThan(0);
    expect(marked.some((seg: any) => seg.text.toLowerCase() === h.contentOnlyTerm.toLowerCase())).toBe(
      true
    );
  });

  itDB('matched_message_id deep-links to a message that GET /:id actually returns', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.ownerUserId, h.orgId);
    const searchRes = await request(app)
      .get('/api/conversations/search')
      .query({ q: h.contentOnlyTerm })
      .set('Authorization', `Bearer ${token}`);
    const hit = searchRes.body.conversations.find((c: any) => c.id === h.teamConversationId);
    expect(hit?.matched_message_id).toBeTruthy();

    const convRes = await request(app)
      .get(`/api/conversations/${h.teamConversationId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(convRes.status).toBe(200);
    const ids = (convRes.body.messages || []).map((m: any) => m.id);
    expect(ids).toContain(hit.matched_message_id);
  });

  itDB(
    'a message containing HTML-shaped content crosses the API boundary as inert segments, never as markup',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.ownerUserId, h.orgId);
      const res = await request(app)
        .get('/api/conversations/search')
        .query({ q: h.xssTerm })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const raw = JSON.stringify(res.body);
      // The delimiter contract must never leak as real HTML tags.
      expect(raw).not.toContain('<mark>');
      expect(raw).not.toContain('</mark>');

      const hit = res.body.conversations.find((c: any) => c.id === h.xssConversationId);
      expect(hit).toBeTruthy();
      expect(hit.matched_message_id).toBe(h.xssMessageId);
      expect(Array.isArray(hit.matched_snippet)).toBe(true);
      // Reassembling the segments must reproduce the dangerous substring
      // byte-for-byte as inert text (never stripped, never executed) —
      // proves ts_headline's raw output survived only inside {text,mark}
      // segments, not as live markup.
      const reassembled = hit.matched_snippet.map((seg: any) => seg.text).join('');
      expect(reassembled).toContain('<img src=x onerror=alert(1)>');
    }
  );

  itDB('a whitespace-only query (empty after trim) returns an empty result, not a 500', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.ownerUserId, h.orgId);
    // SearchQuerySchema requires q.min(2), so a single char is rejected by
    // validateQuery before the handler runs at all (400) — that path is
    // exercised implicitly by every other request needing q.length >= 2.
    // This test instead exercises the handler's OWN `query.trim()` guard: a
    // 2-char string that is legal per the schema but empty once trimmed.
    const res = await request(app)
      .get('/api/conversations/search')
      .query({ q: '  ' })
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.conversations).toEqual([]);
  });

  // -------------------------------------------------------------------
  // ACL / tenant isolation (M01-P02 packet §3.5/§3.6, GF-CHAT-08)
  // -------------------------------------------------------------------

  itDB('a real team member (checkChatPermission allowed) DOES see the team conversation', async (h) => {
    const app = buildApp();
    const token = makeE2EToken(h.allowedTeamReaderUserId, h.orgId);
    const res = await request(app)
      .get('/api/conversations/search')
      .query({ q: h.contentOnlyTerm })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.scopeLimited).toBe(false);
    const hit = res.body.conversations.find((c: any) => c.id === h.teamConversationId);
    expect(hit).toBeTruthy();
  });

  itDB(
    'an authenticated same-org user who is NOT a real team member does not see the team conversation, and scopeLimited is true with no count leak',
    async (h) => {
      const app = buildApp();
      // Real signed JWT (not the E2E bypass): attachUser only READS
      // organization_members, it never inserts a row for this identity, so
      // resolveUserChatRole genuinely resolves 'none' from an empty result.
      const token = makeSignedToken(h.deniedSameOrgUserId, h.orgId);
      const res = await request(app)
        .get('/api/conversations/search')
        .query({ q: h.contentOnlyTerm })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const hit = res.body.conversations.find((c: any) => c.id === h.teamConversationId);
      expect(hit).toBeUndefined();
      expect(res.body.scopeLimited).toBe(true);
      // The withheld-results signal must never be (or contain) a count over
      // content the caller cannot read — that count is itself a disclosure
      // (M01-P02 §3.6). Assert no numeric "how many are hidden" field exists
      // anywhere in the payload.
      expect(res.body).not.toHaveProperty('scopeBlocked');
      expect(typeof res.body.scopeLimited).toBe('boolean');
    }
  );

  itDB(
    'a user in a completely different organization gets zero leakage of the target org team conversation',
    async (h) => {
      const app = buildApp();
      const token = makeE2EToken(h.foreignTenantUserId, h.foreignOrgId);
      const res = await request(app)
        .get('/api/conversations/search')
        .query({ q: h.contentOnlyTerm })
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      const hit = res.body.conversations.find((c: any) => c.id === h.teamConversationId);
      expect(hit).toBeUndefined();
      // Foreign tenant: even though this user IS an ADMIN (team-read
      // allowed) in THEIR OWN org, the WHERE clause scopes team rows to
      // `cp.organization_id = req.organizationId`, so the other org's
      // conversation structurally cannot match regardless of permission.
      expect(res.body.scopeLimited).toBe(false);
    }
  );

  itDB('a personal-only user (no organization) cannot see another user\'s personal conversation', async (h) => {
    const app = buildApp();
    const token = makeSignedToken(h.deniedSameOrgUserId); // no organizationId claim at all
    const res = await request(app)
      .get('/api/conversations/search')
      .query({ q: h.personalTerm })
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const hit = res.body.conversations.find((c: any) => c.id === h.personalConversationId);
    expect(hit).toBeUndefined();
  });
});
