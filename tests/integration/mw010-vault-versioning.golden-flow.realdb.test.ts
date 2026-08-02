/**
 * MW-10 — Vault canonical versioning golden flow, against a REAL Postgres
 * database (no mocks), through the REAL Express router
 * (`server/src/routes/knowledge.routes.ts`) and the REAL `verifyToken`
 * middleware.
 *
 * Mirrors the harness pattern in `tests/integration/table-platform.idor.realdb.test.ts`:
 * REAL router + REAL auth (E2E_MODE unsigned-JWT bypass, same as
 * `tests/e2e/tools/collab-*.spec.ts`) + a `pgReachable()` precondition that
 * reports a clean, non-failing skip when no Postgres is configured.
 *
 * HOW TO RUN LOCALLY:
 *   docker run -d --name consultify-mw010-pg -e POSTGRES_USER=iris \
 *     -e POSTGRES_PASSWORD=iris_test -e POSTGRES_DB=iris_test -p 54810:5432 postgres:15
 *   NODE_ENV=test DATABASE_URL=postgres://iris:iris_test@localhost:54810/iris_test \
 *     npm run db:migrate
 *   NODE_ENV=test DATABASE_URL=postgres://iris:iris_test@localhost:54810/iris_test \
 *     npx vitest run tests/integration/mw010-vault-versioning.golden-flow.realdb.test.ts
 *
 * NOTE on schema: `knowledge_docs.organization_id/owner_id/scope/chunk_count`
 * are NOT created by any `.sql` migration file — they are added at RUNTIME by
 * `PostgresDatabase.ts` `initDb()`, which fires automatically the first time
 * the pool is created (see `getPool()` ~L470-500, awaited by every query path,
 * `initDbPromise`). This test relies on that same automatic bootstrap — it
 * does not need to call it explicitly, the first `request(app)...` call does.
 */

import { randomBytes } from 'node:crypto';

import express from 'express';
import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

// ---------------------------------------------------------------------------
// Force the real Postgres target + E2E auth bypass, ONLY when a database is
// actually configured (mirrors table-platform.idor.realdb.test.ts's guard).
// Must run before importing the router (module-level dynamic imports of
// quota middleware are side-effect-free, but env must be correct before any
// query fires).
// ---------------------------------------------------------------------------
if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
  // `tests/setup.ts` defaults this to 'true' for the whole vitest run (fast
  // unit-test boot). This file needs the REAL runtime schema bootstrap
  // (`PostgresDatabase.ts` `initDb()`, which is what actually adds
  // `knowledge_docs.organization_id`/`owner_id`/`scope`/`chunk_count` — none
  // of those columns exist in any `.sql` migration file, see file header) —
  // override the setup-file default so `initDb()` is NOT skipped.
  process.env.POSTGRES_SKIP_INIT_IN_TEST = 'false';
  // Deterministic, no external network cost: KnowledgeService.processDocument
  // swallows embedding failures (try/catch → null), so clearing these keys
  // makes indexing exercise the real code path without ever calling OpenAI.
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
}

const { default: knowledgeRoutes } = await import('../../server/src/routes/knowledge.routes.js');

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
      // best-effort
    }
  }
}

// ---------------------------------------------------------------------------
// E2E identity minting (same shape as table-platform.idor.realdb.test.ts /
// tests/e2e/tools/collab-*.spec.ts)
// ---------------------------------------------------------------------------

function base64UrlEncode(obj: unknown): string {
  const json = JSON.stringify(obj);
  return Buffer.from(json, 'utf8')
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeE2EToken(
  userId: string,
  organizationId: string,
  opts: { isSuperAdmin?: boolean } = {}
): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'MW-10 RealDB Test User',
    role: 'ADMIN',
    userRole: 'ADMIN',
    organizationId,
    isSuperAdmin: opts.isSuperAdmin === true,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  return `${header}.${payload}.e2e`;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/knowledge', knowledgeRoutes);
  return app;
}

function tag(): string {
  return `${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('MW-10 — Vault canonical versioning golden flow (real Postgres)', () => {
  let reachable = false;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable — MW-10 vault versioning realdb tests skipped. ' +
        'See file header for the docker run + migrate + vitest command to exercise this suite locally.'
    );
  }

  beforeAll(async () => {
    reachable = await pgReachable();
    if (!reachable) emitSkipOnce();
  }, 30_000);

  // Mirrors the `itDB` convention used across the realdb suite: a clean
  // vacuous pass when no Postgres is configured, instead of failing
  // `npm run test:integration` on a machine with no DB.
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

  itDB('migration table exists with the expected shape (fresh migration ran cleanly)', async () => {
    const config = buildClientConfig();
    const client = new Client(config as ClientConfig);
    await client.connect();
    try {
      const cols = await client.query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns
          WHERE table_name = 'knowledge_doc_versions'`
      );
      const names = new Set(cols.rows.map((r) => r.column_name));
      for (const expected of [
        'version_id',
        'document_id',
        'organization_id',
        'version_number',
        'origin',
        'restored_from_version',
        'content_hash',
        'deleted_at',
      ]) {
        expect(names.has(expected)).toBe(true);
      }
    } finally {
      await client.end();
    }
  });

  itDB(
    'golden flow: upload→v1, edit→v2, history, restore→v3, fresh reopen, concurrent stale edit→409, ' +
      'owner/private permission parity, cross-tenant isolation, delete/cleanup',
    async () => {
      const t = tag();
      const orgId = `org-mw10-${t}`;
      const otherOrgId = `org-mw10-other-${t}`;
      const ownerId = `user-mw10-owner-${t}`;
      const peerId = `user-mw10-peer-${t}`; // same org, NOT the owner
      const strangerId = `user-mw10-stranger-${t}`; // different org entirely

      const app = buildApp();
      const ownerToken = makeE2EToken(ownerId, orgId);
      const peerToken = makeE2EToken(peerId, orgId);
      const strangerToken = makeE2EToken(strangerId, otherOrgId);

      // ---- 1. upload → v1 ---------------------------------------------
      const uploadRes = await request(app)
        .post('/api/knowledge/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('scope', 'user')
        .attach('file', Buffer.from('MW-10 content v1', 'utf8'), {
          filename: 'mw010-golden.txt',
          contentType: 'text/plain',
        });

      expect(uploadRes.status).toBe(200);
      expect(uploadRes.body.docId).toBeTruthy();
      expect(uploadRes.body.version).toBe(1);
      const docId = uploadRes.body.docId as string;

      // ---- 2. edit → v2 (CAS with the version we just got back) -------
      const editRes = await request(app)
        .post(`/api/knowledge/documents/${docId}/versions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('expectedVersion', '1')
        .attach('file', Buffer.from('MW-10 content v2', 'utf8'), {
          filename: 'mw010-golden.txt',
          contentType: 'text/plain',
        });

      expect(editRes.status).toBe(201);
      expect(editRes.body.currentVersion).toBe(2);
      expect(editRes.body.version.origin).toBe('edit');
      expect(editRes.body.version.versionId).toBeTruthy();

      // ---- 3. history — stable IDs, author, timestamp ------------------
      const historyRes = await request(app)
        .get(`/api/knowledge/documents/${docId}/versions`)
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(historyRes.status).toBe(200);
      expect(historyRes.body.currentVersion).toBe(2);
      expect(historyRes.body.versions).toHaveLength(2);
      const [v2, v1] = historyRes.body.versions; // DESC order
      expect(v2.versionNumber).toBe(2);
      expect(v1.versionNumber).toBe(1);
      expect(v2.versionId).not.toBe(v1.versionId);
      expect(v2.createdBy).toBe(ownerId);
      expect(v1.createdBy).toBe(ownerId);
      expect(typeof v2.createdAt).toBe('string');
      expect(typeof v1.createdAt).toBe('string');
      // Content snapshots differ → distinct hashes, proving v1's content
      // was never overwritten by the v2 write.
      expect(v1.contentHash).not.toBe(v2.contentHash);

      // ---- 4. restore → v3 (restore v1's content); history NOT overwritten
      const restoreRes = await request(app)
        .post(`/api/knowledge/documents/${docId}/versions/1/restore`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ expectedVersion: 2 });

      expect(restoreRes.status).toBe(201);
      expect(restoreRes.body.currentVersion).toBe(3);
      expect(restoreRes.body.restoredFromVersion).toBe(1);
      expect(restoreRes.body.version.origin).toBe('restore');
      expect(restoreRes.body.version.restoredFromVersion).toBe(1);

      const historyAfterRestore = await request(app)
        .get(`/api/knowledge/documents/${docId}/versions`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(historyAfterRestore.body.versions).toHaveLength(3);
      // v1 and v2 are still there, byte-identical to before — restore never
      // rewrites history, it only appends.
      const stillV1 = historyAfterRestore.body.versions.find((v: any) => v.versionNumber === 1);
      const stillV2 = historyAfterRestore.body.versions.find((v: any) => v.versionNumber === 2);
      expect(stillV1.versionId).toBe(v1.versionId);
      expect(stillV2.versionId).toBe(v2.versionId);
      // v3's content is a COPY of v1's content → same hash, but its own
      // version row/file (provenance, not aliasing).
      const v3 = historyAfterRestore.body.versions.find((v: any) => v.versionNumber === 3);
      expect(v3.contentHash).toBe(v1.contentHash);
      expect(v3.versionId).not.toBe(v1.versionId);

      // ---- 5. fresh GET / hard reload opens the SAME current version ---
      const reopenRes = await request(app)
        .get(`/api/knowledge/documents/${docId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(reopenRes.status).toBe(200);
      expect(reopenRes.body.version).toBe(3);
      expect(reopenRes.body.currentVersion.versionNumber).toBe(3);
      expect(reopenRes.body.currentVersion.contentHash).toBe(v1.contentHash);
      expect(reopenRes.body.permissions).toEqual({ canEdit: true, canDelete: true });

      // A second, independent "reload" request must land on the exact same
      // version — no drift between requests.
      const reopenAgain = await request(app)
        .get(`/api/knowledge/documents/${docId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(reopenAgain.body.version).toBe(3);
      expect(reopenAgain.body.currentVersion.versionId).toBe(reopenRes.body.currentVersion.versionId);

      // ---- 6. concurrent stale edit → 409, NOT last-write-wins ---------
      // Client still thinks current version is 2 (stale) — the real current
      // is 3 (from the restore above). Must be rejected, not silently
      // applied on top of v3.
      const staleEditRes = await request(app)
        .post(`/api/knowledge/documents/${docId}/versions`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('expectedVersion', '2')
        .attach('file', Buffer.from('MW-10 stale racer content', 'utf8'), {
          filename: 'mw010-golden.txt',
          contentType: 'text/plain',
        });
      expect(staleEditRes.status).toBe(409);
      expect(staleEditRes.body.code).toBe('VAULT_VERSION_CONFLICT');
      expect(staleEditRes.body.currentVersion).toBe(3);

      // Prove the CAS rejection didn't leak a partial version row/pointer
      // bump: history still shows exactly 3 versions, current still 3.
      const historyAfterConflict = await request(app)
        .get(`/api/knowledge/documents/${docId}/versions`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(historyAfterConflict.body.versions).toHaveLength(3);
      expect(historyAfterConflict.body.currentVersion).toBe(3);

      // ---- 7. owner/private permission parity (document AND version) ---
      // Peer is in the SAME org but is NOT the owner of this private doc.
      const peerGetDoc = await request(app)
        .get(`/api/knowledge/documents/${docId}`)
        .set('Authorization', `Bearer ${peerToken}`);
      expect(peerGetDoc.status).toBe(404); // must not leak existence

      const peerGetVersions = await request(app)
        .get(`/api/knowledge/documents/${docId}/versions`)
        .set('Authorization', `Bearer ${peerToken}`);
      expect(peerGetVersions.status).toBe(404); // version endpoint = same rule as doc

      const peerGetSingleVersion = await request(app)
        .get(`/api/knowledge/documents/${docId}/versions/1`)
        .set('Authorization', `Bearer ${peerToken}`);
      expect(peerGetSingleVersion.status).toBe(404);

      // ---- 8. user without edit/restore right cannot mutate versions ---
      const peerNewVersion = await request(app)
        .post(`/api/knowledge/documents/${docId}/versions`)
        .set('Authorization', `Bearer ${peerToken}`)
        .field('expectedVersion', '3')
        .attach('file', Buffer.from('peer should not be able to write this', 'utf8'), {
          filename: 'mw010-golden.txt',
          contentType: 'text/plain',
        });
      // canReadDocument is false for the peer → 404 (existence not leaked),
      // never a silent write.
      expect(peerNewVersion.status).toBe(404);

      const peerRestore = await request(app)
        .post(`/api/knowledge/documents/${docId}/versions/1/restore`)
        .set('Authorization', `Bearer ${peerToken}`)
        .send({ expectedVersion: 3 });
      expect(peerRestore.status).toBe(404);

      // Verify the peer's attempts left ZERO trace — no new version, no
      // pointer movement.
      const historyAfterPeerAttempts = await request(app)
        .get(`/api/knowledge/documents/${docId}/versions`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(historyAfterPeerAttempts.body.versions).toHaveLength(3);
      expect(historyAfterPeerAttempts.body.currentVersion).toBe(3);

      // ---- 9. org/cross-tenant isolation --------------------------------
      const strangerGetDoc = await request(app)
        .get(`/api/knowledge/documents/${docId}`)
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(strangerGetDoc.status).toBe(404);

      const strangerList = await request(app)
        .get('/api/knowledge/documents')
        .set('Authorization', `Bearer ${strangerToken}`);
      expect(strangerList.status).toBe(200);
      expect(
        (strangerList.body as any[]).some((d) => d.id === docId)
      ).toBe(false); // cross-tenant doc must never appear in another org's list

      // ---- 10. delete leaves no accessible orphan versions --------------
      const deleteRes = await request(app)
        .delete(`/api/knowledge/documents/${docId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.versionsRemoved).toBe(3);

      const getAfterDelete = await request(app)
        .get(`/api/knowledge/documents/${docId}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(getAfterDelete.status).toBe(404);

      const versionsAfterDelete = await request(app)
        .get(`/api/knowledge/documents/${docId}/versions`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(versionsAfterDelete.status).toBe(404);

      // Direct DB check: every version row is soft-deleted, none orphaned.
      const config = buildClientConfig();
      const dbClient = new Client(config as ClientConfig);
      await dbClient.connect();
      try {
        const rows = await dbClient.query(
          `SELECT version_number, deleted_at FROM knowledge_doc_versions WHERE document_id = $1`,
          [docId]
        );
        expect(rows.rows).toHaveLength(3);
        for (const row of rows.rows) {
          expect(row.deleted_at).not.toBeNull();
        }
      } finally {
        await dbClient.end();
        // Best-effort cleanup of the E2E-seeded org/user rows.
        const cleanupClient = new Client(config as ClientConfig);
        try {
          await cleanupClient.connect();
          await cleanupClient.query(`DELETE FROM knowledge_doc_versions WHERE document_id = $1`, [
            docId,
          ]);
          await cleanupClient.query(`DELETE FROM knowledge_chunks WHERE doc_id = $1`, [docId]);
          await cleanupClient.query(`DELETE FROM knowledge_docs WHERE id = $1`, [docId]);
          await cleanupClient.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
            [orgId, otherOrgId],
          ]);
          await cleanupClient.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [
            [orgId, otherOrgId],
          ]);
          await cleanupClient.query(`DELETE FROM organizations WHERE id = ANY($1)`, [
            [orgId, otherOrgId],
          ]);
        } catch {
          // Leaking a few E2E test rows is acceptable; a hung/throwing
          // cleanup is not.
        } finally {
          await cleanupClient.end().catch(() => {});
        }
      }
    }
  );

  itDB(
    'negative control: permission bypass at the SERVICE layer succeeds (FAIL, proves the vulnerability ' +
      'is real) — the same attack through the REAL ROUTE is blocked (PASS)',
    async () => {
      const t = tag();
      const orgId = `org-mw10-neg-${t}`;
      const ownerId = `user-mw10-neg-owner-${t}`;
      const peerId = `user-mw10-neg-peer-${t}`;

      const app = buildApp();
      const ownerToken = makeE2EToken(ownerId, orgId);
      const peerToken = makeE2EToken(peerId, orgId);

      // Seed a private document as the owner via the real upload route (also
      // seeds the owner's org/user rows through the E2E bypass).
      const uploadRes = await request(app)
        .post('/api/knowledge/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('scope', 'user')
        .attach('file', Buffer.from('negative control content', 'utf8'), {
          filename: 'mw010-negctrl.txt',
          contentType: 'text/plain',
        });
      expect(uploadRes.status).toBe(200);
      const docId = uploadRes.body.docId as string;

      // Seed the peer identity (same org) by hitting an authenticated route
      // once — the E2E bypass auto-creates users/organization_members rows.
      await request(app)
        .get('/api/knowledge/documents')
        .set('Authorization', `Bearer ${peerToken}`);

      // FAIL case — reproduce the PRE-MW-10 bug directly at the service
      // layer: `KnowledgeService.deleteDocument` only ever checked
      // `organization_id`, never ownership. Calling it directly (bypassing
      // the route's `canDeleteDocument` gate this task adds) proves the
      // underlying vulnerability is real, not a strawman: an arbitrary user
      // in the same org CAN delete another user's private document if
      // nothing gates it.
      const { default: KnowledgeService } = await import(
        '../../server/src/services/KnowledgeService.js'
      );
      const bypassResult = await (KnowledgeService as any).deleteDocument(orgId, docId);
      expect(bypassResult.deleted).toBe(true); // FAIL — confirms the vulnerability reproduces

      // Re-seed a second private document (the first is now gone from the
      // bypass above) to test the REAL route path clean.
      const uploadRes2 = await request(app)
        .post('/api/knowledge/documents')
        .set('Authorization', `Bearer ${ownerToken}`)
        .field('scope', 'user')
        .attach('file', Buffer.from('negative control content 2', 'utf8'), {
          filename: 'mw010-negctrl-2.txt',
          contentType: 'text/plain',
        });
      const docId2 = uploadRes2.body.docId as string;

      // PASS case — the SAME attack, through the REAL route this task
      // guards with `canDeleteDocument`, is blocked.
      const routeAttack = await request(app)
        .delete(`/api/knowledge/documents/${docId2}`)
        .set('Authorization', `Bearer ${peerToken}`);
      expect(routeAttack.status).toBe(404); // PASS — gate blocks it, existence not leaked

      const stillThere = await request(app)
        .get(`/api/knowledge/documents/${docId2}`)
        .set('Authorization', `Bearer ${ownerToken}`);
      expect(stillThere.status).toBe(200); // owner's document survives the blocked attack

      // Cleanup.
      const config = buildClientConfig();
      const cleanupClient = new Client(config as ClientConfig);
      try {
        await cleanupClient.connect();
        await cleanupClient.query(`DELETE FROM knowledge_doc_versions WHERE document_id = ANY($1)`, [
          [docId, docId2],
        ]);
        await cleanupClient.query(`DELETE FROM knowledge_chunks WHERE doc_id = ANY($1)`, [
          [docId, docId2],
        ]);
        await cleanupClient.query(`DELETE FROM knowledge_docs WHERE id = ANY($1)`, [[docId, docId2]]);
        await cleanupClient.query(`DELETE FROM organization_members WHERE organization_id = $1`, [
          orgId,
        ]);
        await cleanupClient.query(`DELETE FROM users WHERE organization_id = $1`, [orgId]);
        await cleanupClient.query(`DELETE FROM organizations WHERE id = $1`, [orgId]);
      } catch {
        // best-effort
      } finally {
        await cleanupClient.end().catch(() => {});
      }
    }
  );

  afterAll(() => {
    // No shared harness to tear down — each `itDB` block owns and cleans up
    // its own rows.
  });
});
