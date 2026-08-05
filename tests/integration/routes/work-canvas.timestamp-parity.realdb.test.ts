/**
 * M01-P06A (M01-027c) — `work_canvas_drafts`/`work_canvas_proposals`
 * `created_at`/`updated_at` schema parity, proved against a REAL Postgres
 * database and the REAL Express router (same harness pattern as
 * `tests/integration/routes/work-canvas.cas.realdb.test.ts`).
 *
 * ROOT CAUSE THIS FILE GUARDS AGAINST: `760_work_canvas_runtime.sql`
 * declares these four columns as TEXT (ISO-8601 strings). `ensureStorage()`
 * in `server/src/routes/work-canvas.routes.ts` used to `CREATE TABLE IF NOT
 * EXISTS` the same two tables with TIMESTAMPTZ instead. On any environment
 * where `ensureStorage()` created the table FIRST (a fresh/staging database
 * that boots the app before `server/migrations` runs), `node-postgres` has
 * no type parser registered for OID 1184 in this codebase, so every read
 * handed the app a JS `Date` object. `hasDraftConflict()` /
 * `hasMissingOrStaleBaseToken()` then compared that `Date` against the
 * client's ISO-string `baseUpdatedAt` conflict token with strict `!==` — a
 * `Date` is never `===` a string, so EVERY save looked like a conflict: a
 * false 409 on every draft write, even though nobody else touched the
 * document. Demo was never affected (its table was created by the
 * migration, so it was always TEXT) — this is a "works on my [demo]
 * machine" bug that only bites a fresh environment.
 *
 * THIS FILE'S JOB (distinct from `work-canvas.cas.realdb.test.ts`, which
 * proves the atomic `WHERE updated_at = ?` guard on an already-TEXT table):
 * prove the SAME save→conflict→resolve contract holds regardless of WHICH
 * code path created the table, and prove the schema itself converged on the
 * canonical TEXT type. The KEY EVIDENCE for M01-027c is that this exact file
 * is run TWICE against two differently-provisioned databases and both runs
 * are green:
 *
 *   1) `server/scripts/migrate.postgres.ts --safe` against a fresh database
 *      (work_canvas_drafts/proposals created by `760_work_canvas_runtime.sql`
 *      + `943_work_canvas_timestamp_parity_postgres.sql` as a no-op).
 *   2) NO migrations at all — the app itself creates the tables via
 *      `ensureStorage()` on the first request (the exact "fresh/staging
 *      before migrations ran" scenario M01-027c describes).
 *
 * A third scenario (not exercised by this file, proved once by hand and
 * recorded in the M01-P06A packet return) is the UPGRADE path: a database
 * that already has the pre-fix TIMESTAMPTZ columns (simulating an
 * environment that booted with the buggy `ensureStorage()` before this fix
 * shipped) gets `943_work_canvas_timestamp_parity_postgres.sql` applied and
 * converges on the same TEXT schema with byte-identical ISO-8601 values
 * preserved for pre-existing rows.
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
    name: 'M01-P06A Timestamp Parity Test User',
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

const ISO_8601_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

let pgClient: Client | null = null;

async function cleanupDraft(draftId: string): Promise<void> {
  if (!pgClient) return;
  await pgClient
    .query('DELETE FROM work_canvas_versions WHERE draft_id = $1', [draftId])
    .catch(() => undefined);
  await pgClient
    .query('DELETE FROM work_canvas_proposals WHERE draft_id = $1', [draftId])
    .catch(() => undefined);
  await pgClient.query('DELETE FROM work_canvas_drafts WHERE id = $1', [draftId]).catch(() => undefined);
}

describe('M01-P06A — work_canvas_drafts/proposals timestamp parity (real Postgres)', () => {
  let reachable = false;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error('[skip] Postgres not reachable — M01-P06A timestamp parity realdb tests skipped.');
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

  // ---------------------------------------------------------------------
  // 1) SCHEMA PARITY — the literal M01-027c assertion. Whichever code path
  //    (migration or ensureStorage()) created these tables on THIS database,
  //    both must have converged on TEXT. This is the assertion negative
  //    control (a) targets: reverting ensureStorage()'s CREATE TABLE back to
  //    TIMESTAMPTZ and re-running against a FRESH (ensureStorage-first)
  //    database turns this red.
  // ---------------------------------------------------------------------
  itDB('work_canvas_drafts.created_at/updated_at are TEXT, not TIMESTAMPTZ', async () => {
    const t = tag();
    const orgId = `org-parity-${t}`;
    const userId = `user-parity-${t}`;
    const app = buildApp();
    const auth = { Authorization: `Bearer ${makeE2EToken(userId, orgId)}` };

    // Force ensureStorage()/the table to exist before we inspect it.
    const created = await request(app)
      .post('/api/work-canvas/drafts')
      .set(auth)
      .send({ conversationId: `conv-${t}`, kind: 'markdown', title: 'Parity probe', contentMd: '# x' })
      .expect(201);
    const draftId = String(created.body.data.id || created.body.data.draftId);

    try {
      const rows = await pgClient!.query<{ column_name: string; data_type: string }>(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'work_canvas_drafts'
           AND column_name IN ('created_at', 'updated_at')
         ORDER BY column_name`
      );
      expect(rows.rows).toEqual([
        { column_name: 'created_at', data_type: 'text' },
        { column_name: 'updated_at', data_type: 'text' },
      ]);
    } finally {
      await cleanupDraft(draftId);
    }
  });

  itDB('work_canvas_proposals.created_at/updated_at are TEXT, not TIMESTAMPTZ', async () => {
    const t = tag();
    const orgId = `org-parity-${t}`;
    const userId = `user-parity-${t}`;
    const app = buildApp();
    const auth = { Authorization: `Bearer ${makeE2EToken(userId, orgId)}` };

    const created = await request(app)
      .post('/api/work-canvas/drafts')
      .set(auth)
      .send({ conversationId: `conv-${t}`, kind: 'markdown', title: 'Proposal parity probe', contentMd: '# x' })
      .expect(201);
    const draftId = String(created.body.data.id || created.body.data.draftId);

    try {
      // `ensureStorage()` creates work_canvas_drafts, work_canvas_proposals
      // AND work_canvas_versions together in one memoized call — the POST
      // /drafts above (which awaits `ensureStorage()` before its INSERT)
      // already brought all three tables into existence, so the proposals
      // table can be inspected directly without going through
      // POST /drafts/:draftId/proposals. (That endpoint delegates to
      // `workCanvasService.createProposal`, which inserts a
      // `client_idempotency_key` column that only exists after migration
      // `800_chat_007_proposal_idempotency_key.sql` — a separate, known,
      // OUT-OF-SCOPE gap, M01-022 — and would 500 on a database that only
      // ever ran `ensureStorage()`, which is exactly the scenario this test
      // needs to exercise. Not this packet's finding; not touched here.)
      const rows = await pgClient!.query<{ column_name: string; data_type: string }>(
        `SELECT column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'work_canvas_proposals'
           AND column_name IN ('created_at', 'updated_at')
         ORDER BY column_name`
      );
      expect(rows.rows).toEqual([
        { column_name: 'created_at', data_type: 'text' },
        { column_name: 'updated_at', data_type: 'text' },
      ]);
    } finally {
      await cleanupDraft(draftId);
    }
  });

  // ---------------------------------------------------------------------
  // 2) NO FALSE 409 — the actual user-facing symptom. Negative control (b)
  //    targets this: reverting `normalizeTimestampToken`/`toDraft()` back to
  //    a raw `row.updated_at` pass-through, run against a database where the
  //    column is still TIMESTAMPTZ (or hasn't had 943 applied), turns this
  //    red — every save 409s even with a perfectly fresh, correct token.
  // ---------------------------------------------------------------------
  itDB('create -> save with a correct, freshly-read baseUpdatedAt succeeds (never a false 409)', async () => {
    const t = tag();
    const orgId = `org-parity-${t}`;
    const userId = `user-parity-${t}`;
    const app = buildApp();
    const auth = { Authorization: `Bearer ${makeE2EToken(userId, orgId)}` };

    const created = await request(app)
      .post('/api/work-canvas/drafts')
      .set(auth)
      .send({ conversationId: `conv-${t}`, kind: 'markdown', title: 'No false 409', contentMd: '# v0' })
      .expect(201);
    const draftId = String(created.body.data.id || created.body.data.draftId);
    const baseUpdatedAt = String(created.body.data.updatedAt);
    expect(baseUpdatedAt).toMatch(ISO_8601_RE);

    try {
      // The single most important assertion in this file: a save under the
      // token the server itself just handed back must be a 200, not a 409.
      const save = await request(app)
        .put(`/api/work-canvas/drafts/${draftId}`)
        .set(auth)
        .send({ baseUpdatedAt, title: 'No false 409 v1', contentMd: '# v1' })
        .expect(200);
      expect(save.body.data.updatedAt).toMatch(ISO_8601_RE);
      expect(save.body.data.updatedAt).not.toBe(baseUpdatedAt);

      // Operations endpoint (also owned by M01-P06A) — same contract.
      const opSave = await request(app)
        .post(`/api/work-canvas/drafts/${draftId}/operations`)
        .set(auth)
        .send({
          baseUpdatedAt: save.body.data.updatedAt,
          operation: { type: 'append_section', heading: 'Appended', contentMd: 'Appended body.' },
        })
        .expect(200);
      expect(opSave.body.data.draft.updatedAt).toMatch(ISO_8601_RE);
    } finally {
      await cleanupDraft(draftId);
    }
  });

  // ---------------------------------------------------------------------
  // 3) REAL CONFLICT -> "keep mine" / "load theirs" — the two client-side
  //    recovery paths `WorkCanvasDocumentPanel.tsx` offers
  //    (`resolveConflictKeepMine` / `resolveConflictLoadTheirs`), proved at
  //    the API layer they both call into. Negative control (c) targets the
  //    guard this depends on: with `hasMissingOrStaleBaseToken` neutered
  //    (always "fresh"), the first assertion below (409 on a stale token)
  //    goes red.
  // ---------------------------------------------------------------------
  itDB('real conflict -> "keep mine" resolves with the conflict\'s serverUpdatedAt', async () => {
    const t = tag();
    const orgId = `org-parity-${t}`;
    const userId = `user-parity-${t}`;
    const app = buildApp();
    const auth = { Authorization: `Bearer ${makeE2EToken(userId, orgId)}` };

    const created = await request(app)
      .post('/api/work-canvas/drafts')
      .set(auth)
      .send({ conversationId: `conv-${t}`, kind: 'markdown', title: 'Keep mine', contentMd: '# base' })
      .expect(201);
    const draftId = String(created.body.data.id || created.body.data.draftId);
    const staleBaseUpdatedAt = String(created.body.data.updatedAt);

    try {
      // A different writer (e.g. another tab) saves first, moving the
      // server's real updatedAt forward.
      const otherWriter = await request(app)
        .put(`/api/work-canvas/drafts/${draftId}`)
        .set(auth)
        .send({ baseUpdatedAt: staleBaseUpdatedAt, title: 'Other writer', contentMd: '# other writer' })
        .expect(200);
      const serverUpdatedAt = String(otherWriter.body.data.updatedAt);
      expect(serverUpdatedAt).not.toBe(staleBaseUpdatedAt);

      // This writer is still holding the ORIGINAL (now stale) token — a
      // real conflict, not a false one.
      const conflict = await request(app)
        .put(`/api/work-canvas/drafts/${draftId}`)
        .set(auth)
        .send({ baseUpdatedAt: staleBaseUpdatedAt, title: 'My local edit', contentMd: '# my local edit' })
        .expect(409);
      expect(conflict.body.code).toBe('CANVAS_DRAFT_CONFLICT');
      expect(conflict.body.data.currentDraft.updatedAt).toBe(serverUpdatedAt);

      // "Keep mine": resubmit the SAME local content, but re-based on the
      // conflict's serverUpdatedAt — exactly what
      // `resolveConflictKeepMine` in WorkCanvasDocumentPanel.tsx does.
      const keepMine = await request(app)
        .put(`/api/work-canvas/drafts/${draftId}`)
        .set(auth)
        .send({
          baseUpdatedAt: conflict.body.data.currentDraft.updatedAt,
          title: 'My local edit',
          contentMd: '# my local edit',
        })
        .expect(200);
      expect(keepMine.body.data.title).toBe('My local edit');
      expect(keepMine.body.data.contentMd).toBe('# my local edit');
    } finally {
      await cleanupDraft(draftId);
    }
  });

  itDB('real conflict -> "load theirs" reads back exactly the server\'s current state', async () => {
    const t = tag();
    const orgId = `org-parity-${t}`;
    const userId = `user-parity-${t}`;
    const app = buildApp();
    const auth = { Authorization: `Bearer ${makeE2EToken(userId, orgId)}` };

    const created = await request(app)
      .post('/api/work-canvas/drafts')
      .set(auth)
      .send({ conversationId: `conv-${t}`, kind: 'markdown', title: 'Load theirs', contentMd: '# base' })
      .expect(201);
    const draftId = String(created.body.data.id || created.body.data.draftId);
    const staleBaseUpdatedAt = String(created.body.data.updatedAt);

    try {
      const otherWriter = await request(app)
        .put(`/api/work-canvas/drafts/${draftId}`)
        .set(auth)
        .send({ baseUpdatedAt: staleBaseUpdatedAt, title: 'Theirs', contentMd: '# theirs' })
        .expect(200);

      const conflict = await request(app)
        .put(`/api/work-canvas/drafts/${draftId}`)
        .set(auth)
        .send({ baseUpdatedAt: staleBaseUpdatedAt, title: 'Mine (discarded)', contentMd: '# mine (discarded)' })
        .expect(409);
      expect(conflict.body.data.currentDraft.title).toBe('Theirs');

      // "Load theirs": the client discards local edits and adopts the
      // server's current state — proved here by a fresh, independent GET
      // (the server-side equivalent of what the client renders after
      // `resolveConflictLoadTheirs`), matching both the conflict payload's
      // `currentDraft` AND the other writer's save response exactly.
      const reread = await request(app).get(`/api/work-canvas/drafts/${draftId}`).set(auth).expect(200);
      expect(reread.body.data.draft.title).toBe('Theirs');
      expect(reread.body.data.draft.contentMd).toBe('# theirs');
      expect(reread.body.data.draft.updatedAt).toBe(otherWriter.body.data.updatedAt);
      expect(reread.body.data.draft.updatedAt).toBe(conflict.body.data.currentDraft.updatedAt);
    } finally {
      await cleanupDraft(draftId);
    }
  });

  // ---------------------------------------------------------------------
  // 4) FRESH REOPEN — a hard reload (brand-new GET, nothing carried over)
  //    must report exactly the last save's content and updatedAt. Included
  //    here (in addition to the equivalent scenario in
  //    `work-canvas.cas.realdb.test.ts`) because the M01-P06A packet lists
  //    "fresh reopen" as one of the states this fix must be proven against
  //    on BOTH a migration-created and an ensureStorage()-created database.
  // ---------------------------------------------------------------------
  itDB('fresh reopen after save reports identical content and updatedAt', async () => {
    const t = tag();
    const orgId = `org-parity-${t}`;
    const userId = `user-parity-${t}`;
    const app = buildApp();
    const auth = { Authorization: `Bearer ${makeE2EToken(userId, orgId)}` };

    const created = await request(app)
      .post('/api/work-canvas/drafts')
      .set(auth)
      .send({ conversationId: `conv-${t}`, kind: 'markdown', title: 'Reopen parity', contentMd: '# v0' })
      .expect(201);
    const draftId = String(created.body.data.id || created.body.data.draftId);

    try {
      const save = await request(app)
        .put(`/api/work-canvas/drafts/${draftId}`)
        .set(auth)
        .send({ baseUpdatedAt: created.body.data.updatedAt, title: 'Reopen parity v1', contentMd: '# v1' })
        .expect(200);

      const reopen = await request(app).get(`/api/work-canvas/drafts/${draftId}`).set(auth).expect(200);
      expect(reopen.body.data.draft.title).toBe('Reopen parity v1');
      expect(reopen.body.data.draft.contentMd).toBe('# v1');
      expect(reopen.body.data.draft.updatedAt).toBe(save.body.data.updatedAt);
      expect(reopen.body.data.draft.updatedAt).toMatch(ISO_8601_RE);
    } finally {
      await cleanupDraft(draftId);
    }
  });

  // ---------------------------------------------------------------------
  // 5) RESTORE endpoint (POST /drafts/:draftId/versions/:versionId/restore)
  //    — the third M01-P06A-owned CAS handler. Same "no false 409, real
  //    conflict still rejected" contract.
  // ---------------------------------------------------------------------
  itDB('restore honors the same CAS contract: correct token succeeds, stale token 409s', async () => {
    const t = tag();
    const orgId = `org-parity-${t}`;
    const userId = `user-parity-${t}`;
    const app = buildApp();
    const auth = { Authorization: `Bearer ${makeE2EToken(userId, orgId)}` };

    const created = await request(app)
      .post('/api/work-canvas/drafts')
      .set(auth)
      .send({ conversationId: `conv-${t}`, kind: 'markdown', title: 'Restore parity', contentMd: '# v0' })
      .expect(201);
    const draftId = String(created.body.data.id || created.body.data.draftId);

    try {
      // Produce a version snapshot to restore (autosave fires on a PUT whose
      // content differs from the previous contentMd).
      const save1 = await request(app)
        .put(`/api/work-canvas/drafts/${draftId}`)
        .set(auth)
        .send({ baseUpdatedAt: created.body.data.updatedAt, title: 'Restore parity v1', contentMd: '# v1 content' })
        .expect(200);

      const versions = await request(app)
        .get(`/api/work-canvas/drafts/${draftId}/versions`)
        .set(auth)
        .expect(200);
      expect(Array.isArray(versions.body.data)).toBe(true);
      expect(versions.body.data.length).toBeGreaterThan(0);
      const versionId = versions.body.data[0].id;

      // Stale token (pre-save1) must 409, not silently restore.
      const staleRestore = await request(app)
        .post(`/api/work-canvas/drafts/${draftId}/versions/${versionId}/restore`)
        .set(auth)
        .send({ baseUpdatedAt: created.body.data.updatedAt })
        .expect(409);
      expect(staleRestore.body.code).toBe('CANVAS_DRAFT_CONFLICT');

      // Correct, freshly-read token must succeed (no false 409).
      const restore = await request(app)
        .post(`/api/work-canvas/drafts/${draftId}/versions/${versionId}/restore`)
        .set(auth)
        .send({ baseUpdatedAt: save1.body.data.updatedAt })
        .expect(200);
      expect(restore.body.data.draft.updatedAt).toMatch(ISO_8601_RE);
    } finally {
      await cleanupDraft(draftId);
    }
  });
});
