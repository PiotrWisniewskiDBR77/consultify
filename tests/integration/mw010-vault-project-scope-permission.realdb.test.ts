/**
 * MW-10 — Vault `scope='project'` + explicit `project_id` permission proof,
 * against a REAL Postgres database and the REAL Express router (same harness
 * pattern as `mw010-vault-versioning.golden-flow.realdb.test.ts` and
 * `tests/integration/table-platform.idor.realdb.test.ts`).
 *
 * WHY THIS FILE EXISTS (CTO review 2026-08-02, point 2): the golden-flow test
 * only exercised `scope='user'` (private) documents. It never proved that a
 * user WITHOUT membership in the target project is actually blocked from
 * uploading/reading/listing versions/adding a version/restoring/deleting a
 * `scope='project'` document — organization membership alone is NOT the
 * boundary here, PROJECT membership is (`project_members`).
 *
 * ACTORS (all in the same organization unless noted):
 *   - member    — has a `project_members` row for the target project. role=USER.
 *   - peer      — same org, NO `project_members` row, NO privileged role. role=USER.
 *   - orgAdmin  — same org, NO `project_members` row, role=ADMIN. Included to
 *     document (not "fix" — this is pre-existing `ContextDocumentService
 *     .canAccessProject` behavior, untouched by MW-10) that org-privileged
 *     roles (admin/owner/manager/consultant) bypass the UPLOAD-time
 *     membership check by design (`hasPrivilegedProjectRole`,
 *     ContextDocumentService.ts:607). This does NOT extend to
 *     read/mutate/restore/delete — those go through `vaultDocumentAccess.ts`,
 *     which only recognizes the `isSuperAdmin` flag, not role strings. This
 *     asymmetry pre-dates MW-10 (upload's project-access check existed
 *     before this task; MW-10 only added the version endpoints, which reuse
 *     the SAME vaultDocumentAccess rules as the pre-existing document
 *     GET/PUT/DELETE).
 *   - stranger  — different organization entirely.
 *   - admin     — isSuperAdmin=true (+ role=ADMIN, so the pre-existing
 *     upload-time privileged-role check also passes; see the note above —
 *     without a privileged role string, `isSuperAdmin` alone is NOT read by
 *     the upload handler's `canAccessProject` call, a separate pre-existing
 *     nuance this file documents but does not change).
 *
 * PITFALL THIS FILE GUARDS AGAINST: `ContextDocumentService
 * .hasPrivilegedProjectRole` treats role `'admin'` (case-insensitive) as
 * privileged, and this repo's E2E auth bypass DEFAULTS an unset role claim
 * to `'ADMIN'` (auth.middleware.ts ~L1057). A negative test for "user
 * without membership" that forgets to set `role: 'USER'` on its token would
 * silently upload successfully via the privileged-role bypass — a false
 * negative that looks like a passing security test while proving nothing.
 * Every actor below sets its role explicitly for this reason.
 */

import { randomBytes } from 'node:crypto';

import express from 'express';
import { Client, type ClientConfig } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// This is a real multipart/router acceptance test. The global Vitest setup
// replaces multer with a memory-only stand-in, which does not provide the
// disk-backed `file.path` used by the production Vault route.
vi.unmock('multer');

if (process.env.DATABASE_URL || process.env.PGHOST || process.env.DB_HOST) {
  process.env.MOCK_DB = 'false';
  process.env.RUN_DB_TESTS = '1';
  process.env.DB_TYPE = 'postgres';
  process.env.E2E_MODE = 'true';
  process.env.POSTGRES_SKIP_INIT_IN_TEST = 'false';
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
}

const { default: knowledgeRoutes } = await import('../../server/src/routes/knowledge.routes.js');
const { default: KnowledgeService } = await import('../../server/src/services/KnowledgeService.js');

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
    return { connectionString: databaseUrl, connectionTimeoutMillis: PROBE_TIMEOUT_MS, statement_timeout: 30_000 };
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

function makeE2EToken(
  userId: string,
  organizationId: string,
  opts: { role?: string; isSuperAdmin?: boolean } = {}
): string {
  const header = base64UrlEncode({ alg: 'none', typ: 'JWT' });
  const payload = base64UrlEncode({
    e2e: true,
    id: userId,
    email: `${userId}@local.test`,
    name: 'MW-10 Project Scope Test User',
    // ★ Explicit on every call site — see file header PITFALL note. Never
    // rely on the E2E bypass's own default (`'ADMIN'`).
    role: opts.role || 'USER',
    userRole: opts.role || 'USER',
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

describe('MW-10 — Vault scope=project + explicit project_id permission proof (real Postgres)', () => {
  let reachable = false;
  let skipMessageEmitted = false;

  function emitSkipOnce(): void {
    if (skipMessageEmitted) return;
    skipMessageEmitted = true;
    // eslint-disable-next-line no-console
    console.error(
      '[skip] Postgres not reachable — MW-10 project-scope permission realdb tests skipped.'
    );
  }

  beforeAll(async () => {
    reachable = await pgReachable();
    if (!reachable) emitSkipOnce();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 120_000) =>
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
    'full matrix: member vs peer(no membership) vs orgAdmin(privileged role) vs cross-tenant stranger vs superadmin, ' +
      'for upload/read/list-versions/get-version/add-version/restore/delete',
    async () => {
      const t = tag();
      const orgId = `org-mw10-proj-${t}`;
      const otherOrgId = `org-mw10-proj-other-${t}`;
      const projectId = `proj-mw10-${t}`;

      const memberId = `user-mw10-member-${t}`;
      const peerId = `user-mw10-peer-${t}`;
      const orgAdminId = `user-mw10-orgadmin-${t}`;
      const strangerId = `user-mw10-stranger-${t}`;
      const superadminId = `user-mw10-super-${t}`;

      const app = buildApp();
      const memberToken = makeE2EToken(memberId, orgId, { role: 'USER' });
      const peerToken = makeE2EToken(peerId, orgId, { role: 'USER' });
      const orgAdminToken = makeE2EToken(orgAdminId, orgId, { role: 'ADMIN' });
      const strangerToken = makeE2EToken(strangerId, otherOrgId, { role: 'USER' });
      const superadminToken = makeE2EToken(superadminId, orgId, { role: 'ADMIN', isSuperAdmin: true });

      // ---- Seed org/project/membership directly (E2E bypass only ---------
      // auto-seeds users/organizations, never projects/project_members). Also
      // pre-seed the peer/orgAdmin/stranger/superadmin user rows by hitting
      // one authenticated route each — cheapest way to get the E2E bypass to
      // create their `users`/`organizations` rows before we touch FKs.
      for (const token of [memberToken, peerToken, orgAdminToken, strangerToken, superadminToken]) {
        await request(app).get('/api/knowledge/documents').set('Authorization', `Bearer ${token}`);
      }

      const config = buildClientConfig();
      const client = new Client(config as ClientConfig);
      await client.connect();
      const memberRowId = `pm-${t}`;
      try {
        await client.query(
          `INSERT INTO projects (id, organization_id, name, status, owner_id) VALUES ($1, $2, $3, 'active', $4)`,
          [projectId, orgId, 'MW-10 Project Scope Test', memberId]
        );
        await client.query(
          `INSERT INTO project_members (id, project_id, user_id, project_role) VALUES ($1, $2, $3, 'TASK_ASSIGNEE')`,
          [memberRowId, projectId, memberId]
        );

        // ================= 1. UPLOAD =====================================
        const memberUpload = await request(app)
          .post('/api/knowledge/documents')
          .set('Authorization', `Bearer ${memberToken}`)
          .field('scope', 'project')
          .field('project_id', projectId)
          .attach('file', Buffer.from('member upload v1'), {
            filename: 'mw010-proj.txt',
            contentType: 'text/plain',
          });
        expect(memberUpload.status).toBe(200);
        const docId = memberUpload.body.docId as string;

        const peerUpload = await request(app)
          .post('/api/knowledge/documents')
          .set('Authorization', `Bearer ${peerToken}`)
          .field('scope', 'project')
          .field('project_id', projectId)
          .attach('file', Buffer.from('peer upload attempt'), {
            filename: 'mw010-proj-peer.txt',
            contentType: 'text/plain',
          });
        expect(peerUpload.status).toBe(403);
        expect(peerUpload.body.error).toMatch(/dostępu do projektu/i);

        // Documents the PRE-EXISTING privileged-role bypass (not a leak this
        // task introduces or is asked to close — see file header).
        const orgAdminUpload = await request(app)
          .post('/api/knowledge/documents')
          .set('Authorization', `Bearer ${orgAdminToken}`)
          .field('scope', 'project')
          .field('project_id', projectId)
          .attach('file', Buffer.from('org admin upload via privileged role'), {
            filename: 'mw010-proj-admin.txt',
            contentType: 'text/plain',
          });
        expect(orgAdminUpload.status).toBe(200);

        const strangerUpload = await request(app)
          .post('/api/knowledge/documents')
          .set('Authorization', `Bearer ${strangerToken}`)
          .field('scope', 'project')
          .field('project_id', projectId)
          .attach('file', Buffer.from('stranger upload attempt'), {
            filename: 'mw010-proj-stranger.txt',
            contentType: 'text/plain',
          });
        // Cross-tenant: the project doesn't exist for their org at all.
        expect(strangerUpload.status).toBe(403);

        // ================= 2. READ (single doc) ==========================
        const memberRead = await request(app)
          .get(`/api/knowledge/documents/${docId}`)
          .set('Authorization', `Bearer ${memberToken}`);
        expect(memberRead.status).toBe(200);

        const peerRead = await request(app)
          .get(`/api/knowledge/documents/${docId}`)
          .set('Authorization', `Bearer ${peerToken}`);
        expect(peerRead.status).toBe(404);

        const strangerRead = await request(app)
          .get(`/api/knowledge/documents/${docId}`)
          .set('Authorization', `Bearer ${strangerToken}`);
        expect(strangerRead.status).toBe(404);

        const superadminRead = await request(app)
          .get(`/api/knowledge/documents/${docId}`)
          .set('Authorization', `Bearer ${superadminToken}`);
        expect(superadminRead.status).toBe(200);

        // ================= 3. LIST VERSIONS ===============================
        const memberVersions = await request(app)
          .get(`/api/knowledge/documents/${docId}/versions`)
          .set('Authorization', `Bearer ${memberToken}`);
        expect(memberVersions.status).toBe(200);
        expect(memberVersions.body.versions).toHaveLength(1);

        const peerVersions = await request(app)
          .get(`/api/knowledge/documents/${docId}/versions`)
          .set('Authorization', `Bearer ${peerToken}`);
        expect(peerVersions.status).toBe(404);

        // ================= 4. GET SINGLE VERSION ==========================
        const peerSingleVersion = await request(app)
          .get(`/api/knowledge/documents/${docId}/versions/1`)
          .set('Authorization', `Bearer ${peerToken}`);
        expect(peerSingleVersion.status).toBe(404);

        // ================= 5. ADD VERSION =================================
        // Member CAN read but is not superadmin — project-scope mutate is
        // superadmin-only (VLT-002, unchanged by MW-10; see
        // vaultDocumentAccess.ts). Peer can't even read, so it's 404 not 403.
        const memberAddVersion = await request(app)
          .post(`/api/knowledge/documents/${docId}/versions`)
          .set('Authorization', `Bearer ${memberToken}`)
          .field('expectedVersion', '1')
          .attach('file', Buffer.from('member tries to add v2'), {
            filename: 'mw010-proj.txt',
            contentType: 'text/plain',
          });
        expect(memberAddVersion.status).toBe(403);

        const peerAddVersion = await request(app)
          .post(`/api/knowledge/documents/${docId}/versions`)
          .set('Authorization', `Bearer ${peerToken}`)
          .field('expectedVersion', '1')
          .attach('file', Buffer.from('peer tries to add v2'), {
            filename: 'mw010-proj.txt',
            contentType: 'text/plain',
          });
        expect(peerAddVersion.status).toBe(404);

        const superadminAddVersion = await request(app)
          .post(`/api/knowledge/documents/${docId}/versions`)
          .set('Authorization', `Bearer ${superadminToken}`)
          .field('expectedVersion', '1')
          .attach('file', Buffer.from('superadmin adds v2'), {
            filename: 'mw010-proj.txt',
            contentType: 'text/plain',
          });
        expect(superadminAddVersion.status).toBe(201);
        expect(superadminAddVersion.body.currentVersion).toBe(2);

        // ================= 6. RESTORE =====================================
        const memberRestore = await request(app)
          .post(`/api/knowledge/documents/${docId}/versions/1/restore`)
          .set('Authorization', `Bearer ${memberToken}`)
          .send({ expectedVersion: 2 });
        expect(memberRestore.status).toBe(403);

        const peerRestore = await request(app)
          .post(`/api/knowledge/documents/${docId}/versions/1/restore`)
          .set('Authorization', `Bearer ${peerToken}`)
          .send({ expectedVersion: 2 });
        expect(peerRestore.status).toBe(404);

        // ================= 7. DELETE ======================================
        const memberDelete = await request(app)
          .delete(`/api/knowledge/documents/${docId}`)
          .set('Authorization', `Bearer ${memberToken}`);
        expect(memberDelete.status).toBe(403);

        const peerDelete = await request(app)
          .delete(`/api/knowledge/documents/${docId}`)
          .set('Authorization', `Bearer ${peerToken}`);
        expect(peerDelete.status).toBe(404);

        const superadminDelete = await request(app)
          .delete(`/api/knowledge/documents/${docId}`)
          .set('Authorization', `Bearer ${superadminToken}`);
        expect(superadminDelete.status).toBe(200);
        expect(superadminDelete.body.versionsRemoved).toBe(2);

        // ================= 8. NEGATIVE CONTROL — membership guard ========
        // FAIL case: prove a leak WOULD occur if the membership boundary
        // were only enforced at the DATA layer's imagination and not really
        // checked. `KnowledgeService.getDocumentById` has ZERO awareness of
        // project membership — it is org-scoped only. Calling it directly
        // (as a stand-in for "what if the route's canReadDocument gate were
        // removed/broken") returns the FULL document to anyone who knows the
        // org id, regardless of project membership.
        const rawDocForPeer = await (KnowledgeService as any).getDocumentById(orgId, orgAdminUpload.body.docId);
        expect(rawDocForPeer).not.toBeNull();
        expect(rawDocForPeer.id).toBe(orgAdminUpload.body.docId); // FAIL — the guard-free data layer leaks it

        // PASS case: the SAME document, through the REAL route (real
        // canReadDocument gate) as the SAME non-member peer, is blocked.
        const peerReadOrgAdminDoc = await request(app)
          .get(`/api/knowledge/documents/${orgAdminUpload.body.docId}`)
          .set('Authorization', `Bearer ${peerToken}`);
        expect(peerReadOrgAdminDoc.status).toBe(404); // PASS — route gate blocks it

        // ================= 9. NEGATIVE CONTROL — live membership toggle ===
        // Revoke the member's real membership row, prove access flips to
        // denied (the route re-checks membership on every request, it does
        // not cache/trust a prior grant); then restore it and prove access
        // returns. This is the literal "guard removed → leak-shaped gap
        // appears; guard restored → PASS" the review asked for, expressed as
        // a real data change rather than bypassed code.
        await client.query(`DELETE FROM project_members WHERE id = $1`, [memberRowId]);
        const memberReadAfterRevoke = await request(app)
          .get(`/api/knowledge/documents/${orgAdminUpload.body.docId}`)
          .set('Authorization', `Bearer ${memberToken}`);
        expect(memberReadAfterRevoke.status).toBe(404); // membership gone → access gone

        await client.query(
          `INSERT INTO project_members (id, project_id, user_id, project_role) VALUES ($1, $2, $3, 'TASK_ASSIGNEE')`,
          [memberRowId, projectId, memberId]
        );
        const memberReadAfterRestore = await request(app)
          .get(`/api/knowledge/documents/${orgAdminUpload.body.docId}`)
          .set('Authorization', `Bearer ${memberToken}`);
        expect(memberReadAfterRestore.status).toBe(200); // membership restored → PASS
      } finally {
        try {
          await client.query(`DELETE FROM knowledge_doc_versions WHERE organization_id = $1`, [orgId]);
          await client.query(`DELETE FROM knowledge_chunks WHERE doc_id IN (SELECT id FROM knowledge_docs WHERE organization_id = $1)`, [orgId]);
          await client.query(`DELETE FROM knowledge_docs WHERE organization_id = $1`, [orgId]);
          await client.query(`DELETE FROM project_members WHERE project_id = $1`, [projectId]);
          await client.query(`DELETE FROM projects WHERE id = $1`, [projectId]);
          await client.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [
            [orgId, otherOrgId],
          ]);
          await client.query(`DELETE FROM users WHERE organization_id = ANY($1)`, [[orgId, otherOrgId]]);
          await client.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgId, otherOrgId]]);
        } catch {
          /* best effort */
        }
        await client.end().catch(() => {});
      }
    }
  );

  afterAll(() => {
    // Each itDB block owns and cleans up its own rows.
  });
});
