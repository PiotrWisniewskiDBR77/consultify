/**
 * M01-P06 §8 — Canvas draft save CAS, proved against a REAL Postgres database
 * and the REAL Express router (same harness pattern as
 * `tests/integration/mw010-vault-project-scope-permission.realdb.test.ts`).
 *
 * WHY THIS FILE EXISTS: `tests/integration/routes/work-canvas.routes.test.ts`
 * mocks `server/src/utils/DbPromise.js` entirely (`dbRunMock.mockResolvedValue
 * ({ changes: 1 })`), so it can assert the APPLICATION-level comparison
 * (`hasDraftConflict` / `hasMissingOrStaleBaseToken`) but it can never prove
 * the write is actually atomic — a mock cannot race with itself. The M01-P06
 * contract is explicit that a mere app-level comparison is NOT CAS ("Samo
 * porównanie w aplikacji to NIE jest CAS; potrzebne obie połowy" — the lesson
 * from Notatnik's legacy writer, where the same class of bug shipped because
 * only the in-app SELECT-then-compare half existed). This file proves the
 * OTHER half: the `UPDATE ... WHERE id = ? AND organization_id = ? AND
 * updated_at = ?` guard added to `PUT /drafts/:draftId`,
 * `POST /drafts/:draftId/operations` and `POST /drafts/:draftId/versions/:id
 * /restore` in `server/src/routes/work-canvas.routes.ts`.
 *
 * Negative control (c) from the M01-P06 packet: "test CAS serwerowego pada,
 * gdy serwer przestanie sprawdzać token" — verified by hand: reverting
 * `PUT /drafts/:draftId` to the old permissive `hasDraftConflict` (accepts a
 * missing token as "no conflict") turns "rejects a PUT with no baseUpdatedAt
 * token…" from PASS to FAIL (409 → 200). See the M01-P06 report for the exact
 * before/after run.
 *
 * HONEST LIMIT on the second test ("two concurrent PUTs racing…"): run
 * through `Promise.all` + supertest against a single Node process, the two
 * requests are NOT proven to reach Postgres inside the same read-modify-write
 * window — Node's event loop / connection handling can serialize the two
 * `ownedDraft()` SELECTs enough that the pre-existing app-level
 * `hasDraftConflict` comparison alone already catches the second writer. That
 * test therefore demonstrates the OBSERVABLE contract (never two 200s, no
 * lost update, exactly one 409) under real concurrent load — it does not, by
 * itself, isolate the `AND updated_at = ?` WHERE-clause guard as the specific
 * cause. That guard's necessity for a genuine simultaneous-read race (e.g.
 * two app instances, two DB connections, true TOCTOU) is established by code
 * review of the SQL (WHERE clause + `changes === 0` check), the same pattern
 * this codebase already relies on elsewhere for optimistic concurrency — not
 * re-derived here as a second, independently-failing negative control.
 */
import { randomBytes } from 'node:crypto';

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

const { default: workCanvasRoutes } = await import('../../../server/src/routes/work-canvas.routes.js');

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
    name: 'M01-P06 CAS Test User',
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
  app.use('/api/work-canvas', workCanvasRoutes);
  return app;
}

function tag(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

let pgClient: Client | null = null;

async function cleanupDraft(draftId: string): Promise<void> {
  if (!pgClient) return;
  await pgClient
    .query('DELETE FROM work_canvas_versions WHERE draft_id = $1', [draftId])
    .catch(() => undefined);
  await pgClient
    .query('DELETE FROM work_canvas_drafts WHERE id = $1', [draftId])
    .catch(() => undefined);
}

describe('M01-P06 — Canvas draft save CAS (real Postgres)', () => {
  let reachable = false;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error('[skip] Postgres not reachable — M01-P06 CAS realdb tests skipped.');
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
    'rejects a PUT with no baseUpdatedAt token instead of silently overwriting',
    async () => {
      const t = tag();
      const orgId = `org-cas-${t}`;
      const userId = `user-cas-${t}`;
      const app = buildApp();
      const token = makeE2EToken(userId, orgId);
      const auth = { Authorization: `Bearer ${token}` };

      const created = await request(app)
        .post('/api/work-canvas/drafts')
        .set(auth)
        .send({ conversationId: `conv-${t}`, kind: 'markdown', title: 'CAS doc', contentMd: '# CAS doc' })
        .expect(201);
      const draftId = String(created.body.data.id || created.body.data.draftId);
      expect(draftId).toBeTruthy();

      try {
        // No baseUpdatedAt at all — must be rejected, not treated as "no conflict".
        const res = await request(app)
          .put(`/api/work-canvas/drafts/${draftId}`)
          .set(auth)
          .send({ title: 'Overwritten without a token', contentMd: '# Overwritten' })
          .expect(409);
        expect(res.body.code).toBe('CANVAS_DRAFT_CONFLICT');

        // Prove nothing was written: the draft still has its original content.
        const readBack = await request(app)
          .get(`/api/work-canvas/drafts/${draftId}`)
          .set(auth)
          .expect(200);
        expect(readBack.body.data.draft.title).toBe('CAS doc');
      } finally {
        await cleanupDraft(draftId);
      }
    }
  );

  itDB(
    'two concurrent PUTs racing on the SAME base token: exactly one wins, the loser gets a 409 (not a lost update)',
    async () => {
      const t = tag();
      const orgId = `org-cas-${t}`;
      const userId = `user-cas-${t}`;
      const app = buildApp();
      const token = makeE2EToken(userId, orgId);
      const auth = { Authorization: `Bearer ${token}` };

      const created = await request(app)
        .post('/api/work-canvas/drafts')
        .set(auth)
        .send({
          conversationId: `conv-${t}`,
          kind: 'markdown',
          title: 'Race doc',
          contentMd: '# Race doc',
        })
        .expect(201);
      const draftId = String(created.body.data.id || created.body.data.draftId);
      const baseUpdatedAt = String(created.body.data.updatedAt);
      expect(draftId).toBeTruthy();
      expect(baseUpdatedAt).toBeTruthy();

      try {
        // Both writers read the SAME base token (the state immediately after
        // create) and race to save under it — exactly the "two sessions, one
        // stale" scenario the M01-P06 packet describes. Only a REAL atomic
        // WHERE-clause guard (not an app-level SELECT-then-compare) can
        // guarantee one loses instead of both landing and one silently
        // clobbering the other (a lost update).
        const [writerA, writerB] = await Promise.all([
          request(app)
            .put(`/api/work-canvas/drafts/${draftId}`)
            .set(auth)
            .send({ baseUpdatedAt, title: 'Writer A', contentMd: '# Writer A' }),
          request(app)
            .put(`/api/work-canvas/drafts/${draftId}`)
            .set(auth)
            .send({ baseUpdatedAt, title: 'Writer B', contentMd: '# Writer B' }),
        ]);

        const statuses = [writerA.status, writerB.status].sort();
        // Exactly one 200 and one 409 — never two 200s (that would be the
        // lost-update bug: both requests believed they held a valid token
        // and one silently overwrote the other with no conflict signal).
        expect(statuses).toEqual([200, 409]);

        const winner = writerA.status === 200 ? writerA : writerB;
        const loser = writerA.status === 200 ? writerB : writerA;
        expect(loser.body.code).toBe('CANVAS_DRAFT_CONFLICT');

        // The persisted content is EXACTLY the winner's — not a merge, not
        // the loser's, and the draft is not left in a half-written state.
        const readBack = await request(app)
          .get(`/api/work-canvas/drafts/${draftId}`)
          .set(auth)
          .expect(200);
        expect(readBack.body.data.draft.title).toBe(winner.body.data.title);
      } finally {
        await cleanupDraft(draftId);
      }
    }
  );

  itDB(
    'GET /shared/:token does not leak a draft to a different organization, and revoke kills the link immediately',
    async () => {
      const t = tag();
      const ownerOrgId = `org-cas-owner-${t}`;
      const ownerUserId = `user-cas-owner-${t}`;
      const strangerOrgId = `org-cas-stranger-${t}`;
      const strangerUserId = `user-cas-stranger-${t}`;
      const app = buildApp();
      const ownerAuth = { Authorization: `Bearer ${makeE2EToken(ownerUserId, ownerOrgId)}` };
      const strangerAuth = {
        Authorization: `Bearer ${makeE2EToken(strangerUserId, strangerOrgId)}`,
      };

      const created = await request(app)
        .post('/api/work-canvas/drafts')
        .set(ownerAuth)
        .send({
          conversationId: `conv-${t}`,
          kind: 'markdown',
          title: 'Owner-only content',
          contentMd: '# Secret owner content',
        })
        .expect(201);
      const draftId = String(created.body.data.id || created.body.data.draftId);

      try {
        const shared = await request(app)
          .post(`/api/work-canvas/drafts/${draftId}/share`)
          .set(ownerAuth)
          .send({})
          .expect(200);
        const token = String(shared.body.data.share.token);
        expect(token).toMatch(/^[0-9a-f]{32}$/i);

        // Same org, has the token: can read.
        const ownerRead = await request(app)
          .get(`/api/work-canvas/shared/${token}`)
          .set(ownerAuth)
          .expect(200);
        expect(ownerRead.body.data.contentMd).toContain('Secret owner content');

        // Different organization, has the SAME token (e.g. forwarded the
        // link): the org-scoped query in GET /shared/:token must not find a
        // cross-tenant row — a 404, not the content.
        await request(app)
          .get(`/api/work-canvas/shared/${token}`)
          .set(strangerAuth)
          .expect(404);

        // Revoke: the owner's own org loses access immediately too — a
        // revoked share is not still readable by anyone, including its
        // creator.
        await request(app)
          .delete(`/api/work-canvas/drafts/${draftId}/share`)
          .set(ownerAuth)
          .send({})
          .expect(200);
        await request(app)
          .get(`/api/work-canvas/shared/${token}`)
          .set(ownerAuth)
          .expect(404);
      } finally {
        await cleanupDraft(draftId);
      }
    }
  );

  /**
   * M01-P06 packet §7 — create → save → FRESH reopen → identical content AND
   * lastSavedAt. "Fresh reopen" per the packet means a hard reload, not a
   * re-render: the client's `lastSavedAt` is set directly from the server's
   * `updatedAt` on a successful save (see `persistDraft` in
   * `WorkCanvasDocumentPanel.tsx`: `lastSavedAt: savedAt` where `savedAt =
   * savedDraft.updatedAt`). A hard reload does nothing but issue a brand-new
   * `GET /drafts/:draftId` with no client state carried over — so the
   * faithful server-side equivalent of "fresh reopen" is a SEPARATE,
   * independent GET call (not reusing anything from the save response) and
   * asserting it returns exactly the saved content and exactly the
   * `updatedAt` the save response reported. Two save cycles are exercised
   * (not just one) so this also proves the SECOND fresh-reopen still tracks
   * the LATEST save, not the first.
   */
  itDB('create → save → fresh reopen: identical content and lastSavedAt (real Postgres, two cycles)', async () => {
    const t = tag();
    const orgId = `org-cas-${t}`;
    const userId = `user-cas-${t}`;
    const app = buildApp();
    const auth = { Authorization: `Bearer ${makeE2EToken(userId, orgId)}` };

    const created = await request(app)
      .post('/api/work-canvas/drafts')
      .set(auth)
      .send({
        conversationId: `conv-${t}`,
        kind: 'markdown',
        title: 'Reopen doc v0',
        contentMd: '# Reopen doc\n\nInitial content.',
      })
      .expect(201);
    const draftId = String(created.body.data.id || created.body.data.draftId);
    expect(draftId).toBeTruthy();

    try {
      // ---- Cycle 1: save, then a FRESH, independent GET (fresh reopen) ----
      const save1 = await request(app)
        .put(`/api/work-canvas/drafts/${draftId}`)
        .set(auth)
        .send({
          baseUpdatedAt: created.body.data.updatedAt,
          title: 'Reopen doc v1',
          contentMd: '# Reopen doc\n\nFirst save.',
        })
        .expect(200);
      const lastSavedAt1 = String(save1.body.data.updatedAt);
      expect(lastSavedAt1).toBeTruthy();

      // A brand-new request with nothing carried over from `save1` — the
      // server-side equivalent of a hard reload re-fetching the draft.
      const reopen1 = await request(app)
        .get(`/api/work-canvas/drafts/${draftId}`)
        .set(auth)
        .expect(200);
      expect(reopen1.body.data.draft.title).toBe('Reopen doc v1');
      expect(reopen1.body.data.draft.contentMd).toBe('# Reopen doc\n\nFirst save.');
      // The exact field the client maps 1:1 onto its `lastSavedAt` display.
      expect(reopen1.body.data.draft.updatedAt).toBe(lastSavedAt1);

      // ---- Cycle 2: a SECOND save, fresh reopen must track the NEW state,
      // not cycle 1's — proves this isn't just "first save happens to stick". ----
      const save2 = await request(app)
        .put(`/api/work-canvas/drafts/${draftId}`)
        .set(auth)
        .send({
          baseUpdatedAt: lastSavedAt1,
          title: 'Reopen doc v2',
          contentMd: '# Reopen doc\n\nSecond save, different content.',
        })
        .expect(200);
      const lastSavedAt2 = String(save2.body.data.updatedAt);
      expect(lastSavedAt2).toBeTruthy();
      expect(lastSavedAt2).not.toBe(lastSavedAt1);

      const reopen2 = await request(app)
        .get(`/api/work-canvas/drafts/${draftId}`)
        .set(auth)
        .expect(200);
      expect(reopen2.body.data.draft.title).toBe('Reopen doc v2');
      expect(reopen2.body.data.draft.contentMd).toBe(
        '# Reopen doc\n\nSecond save, different content.'
      );
      expect(reopen2.body.data.draft.updatedAt).toBe(lastSavedAt2);
    } finally {
      await cleanupDraft(draftId);
    }
  });
});
