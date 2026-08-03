/** @vitest-environment node */

/**
 * MAT-010 — Codex FINAL review, Blockers 1 & 2.
 *
 * Blocker 1 (multi-instance idempotency): `withRequestBoundIdempotencyLock`
 * (the prior round's in-process mutex) only protects callers inside ONE Node
 * process. Codex required proof that two INDEPENDENT execution contexts
 * racing the same `Idempotency-Key` still converge on exactly one durable
 * mutation. This file builds TWO separate Express app instances from
 * `vi.resetModules()`-fresh imports of every Document Studio module
 * (`documentStudioService`, `documentLifecycleService`,
 * `documentVersionSnapshotService`, `documentShareLinkService`, and the
 * routes themselves) — each instance has its OWN, completely independent
 * copies of every in-memory Map (`lifecycleStore`, `snapshotStore`,
 * `registryStore`, `hydratedOrgs`, …) — while both share the SAME real
 * Postgres connection. This is the closest a single Vitest process can get
 * to "two horizontally-scaled instances" without literally forking two OS
 * processes: zero shared in-process state, only the DB in common, exactly
 * matching a real multi-instance deployment.
 *
 * Blocker 2 (restart recovery): the SAME two-instance infrastructure proves
 * restart recovery directly — "instance B" IS a fresh process from
 * checkpoint/restore/share_minted's point of view (none of its module-level
 * state existed before this test built it). Performing the operation via
 * "app A", then retrying the identical `Idempotency-Key` via "app B" (which
 * never saw the first request, never populated its own caches from it) and
 * asserting the SAME durable result with no second mutation IS the restart-
 * recovery proof: the retry's correctness cannot be coming from in-process
 * state `app B` never had.
 *
 * REQUIRES `NODE_ENV=test RUN_DB_TESTS=1` with `DATABASE_URL` pointed at a
 * real, migrated Postgres. Run:
 *
 *   DATABASE_URL=postgresql://consultinity:consultinity@localhost:PORT/consultinity \
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 \
 *   npx vitest run --retry=0 \
 *     tests/integration/routes/artifactLineage.mat010-multi-instance.postgres.integration.test.ts
 *
 * `--retry=0` is deliberate (institutional memory: `retry: 1` hides fixture
 * collisions and makes race tests lie).
 */
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const SUFFIX = uuidv4().slice(0, 8);
const ORG_A = `org-mat010mi-a-${SUFFIX}`;
const USER_A = `user-mat010mi-a-${SUFFIX}`;

// vi.mock calls are hoisted to the top of the module by vitest and remain
// active across `vi.resetModules()` — resetModules clears the RESOLVED
// module cache (so a fresh `import()` re-evaluates every module's top-level
// state), it does not un-mock anything. This is exactly what makes the
// "two independent instances, same mocks" setup below possible.
vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    const orgId = req.headers['x-test-org-id'];
    const userId = req.headers['x-test-user-id'];
    if (!orgId || !userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.userId = userId;
    req.organizationId = orgId;
    req.userRole = 'OWNER';
    req.user = { id: userId, organizationId: orgId, role: 'OWNER' };
    next();
  },
}));

vi.mock('../../../server/src/middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/demoGuard.middleware.js', () => ({
  demoContextMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/rateLimiting.middleware.js', () => ({
  apiAuthRateLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

vi.mock('../../../server/src/middleware/requireAudit.middleware.js', () => ({
  requireAudit: (req: any, _res: unknown, next: () => void) => {
    req.emitAuditEvent = async () => undefined;
    next();
  },
}));

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../../../server/src/services/notificationService.js', () => ({
  send: vi.fn().mockResolvedValue(null),
  default: { send: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../../server/src/services/OrgPoliciesService.js', () => ({
  requireNoLegalHold: vi.fn().mockResolvedValue(undefined),
  OrgPoliciesError: class OrgPoliciesError extends Error {},
}));

vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: vi.fn().mockResolvedValue(null),
  getArtifactByOrigin: vi.fn().mockResolvedValue({ artifactId: 'stub-artifact', publishState: null }),
  getArtifactByOriginUnscoped: vi.fn().mockResolvedValue(null),
  adoptRunArtifactForWorkbook: vi.fn().mockResolvedValue(null),
  getArtifactRun: vi.fn().mockResolvedValue(null),
  mapPresentationStatusToDeliveryState: vi.fn().mockReturnValue('draft'),
  deriveArtifactVisibilityScope: vi.fn().mockReturnValue('private'),
}));

vi.mock('../../../server/src/services/v8/reportsPresModelService.js', () => ({
  recordCompletedExport: vi.fn().mockResolvedValue(null),
  recordFailedExport: vi.fn().mockResolvedValue(null),
  default: {
    recordCompletedExport: vi.fn().mockResolvedValue(null),
    recordFailedExport: vi.fn().mockResolvedValue(null),
  },
}));

function authHeaders(orgId: string, userId: string) {
  return { 'x-test-org-id': orgId, 'x-test-user-id': userId };
}

/**
 * Builds a completely fresh Express app for `document-studio.routes.ts`,
 * backed by fresh copies of every dependent service module. `vi.resetModules()`
 * clears vitest's module cache so the subsequent dynamic `import()` calls
 * re-evaluate every module from scratch — fresh `lifecycleStore`,
 * `snapshotStore`, `registryStore`, `hydratedOrgs` Sets, everything —
 * simulating a brand-new process that shares nothing with any previously
 * built instance except the real Postgres it's pointed at.
 */
async function buildFreshAppInstance(): Promise<express.Express> {
  vi.resetModules();
  const { default: documentStudioRoutes, documentShareLinkPublicRoutes } = await import(
    '../../../server/src/routes/document-studio.routes.js'
  );
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use('/api/document-studio', documentShareLinkPublicRoutes);
  app.use('/api/document-studio', documentStudioRoutes);
  return app;
}

describe('MAT-010 — multi-instance idempotency & restart recovery (Codex final review, Blockers 1 & 2, real Postgres)', () => {
  let pool: Pool;
  const createdDocIds: string[] = [];

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || process.env.RUN_DB_TESTS !== '1') {
      throw new Error(
        'This suite requires NODE_ENV=test RUN_DB_TESTS=1 with DATABASE_URL pointed at a real, migrated Postgres.'
      );
    }
    pool = new Pool({ connectionString: process.env.DATABASE_URL });
    await pool.query(`INSERT INTO organizations (id) VALUES ($1) ON CONFLICT DO NOTHING`, [
      ORG_A,
    ]);
  });

  afterAll(async () => {
    if (createdDocIds.length) {
      await pool.query(`DELETE FROM document_version_snapshots WHERE artifact_id = ANY($1)`, [
        createdDocIds,
      ]);
      await pool.query(`DELETE FROM document_share_links WHERE artifact_id = ANY($1)`, [
        createdDocIds,
      ]);
      await pool.query(`DELETE FROM document_lifecycle_states WHERE artifact_id = ANY($1)`, [
        createdDocIds,
      ]);
      await pool.query(`DELETE FROM wave5_artifacts WHERE artifact_id = ANY($1)`, [createdDocIds]);
    }
    await pool.query(`DELETE FROM v8_artifact_origin_links WHERE organization_id = $1`, [ORG_A]);
    // round-5 redesign — operation claims now live in their own dedicated
    // table (`operationClaimService.ts`), separate from the lineage outbox
    // below; every claim this file's HTTP requests created needs its own
    // cleanup line.
    await pool.query(`DELETE FROM artifact_lineage_operation_claims WHERE organization_id = $1`, [
      ORG_A,
    ]);
    await pool.query(`DELETE FROM artifact_lineage_pending_events WHERE organization_id = $1`, [
      ORG_A,
    ]);
    await pool.query(`DELETE FROM artifact_lineage_events WHERE organization_id = $1`, [ORG_A]);
    await pool.query(`DELETE FROM artifact_lineage_receipts WHERE organization_id = $1`, [ORG_A]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [ORG_A]);
    await pool.end();
  });

  /** Seeds a document artifact + lifecycle row directly via SQL — the same
   * fixture shape the routes test file uses — WITHOUT touching any
   * in-process module state (there is none shared across instances here). */
  async function seedDocument(title: string) {
    const artifactId = `doc-mat010mi-${uuidv4()}`;
    const nowIso = new Date().toISOString();
    const schema = {
      artifactId,
      title,
      documentType: 'report',
      language: 'pl',
      createdAt: nowIso,
      updatedAt: nowIso,
      sections: [
        {
          sectionId: 'sec-1',
          heading: 'Wprowadzenie',
          blocks: [{ blockId: 'b-1', type: 'paragraph', content: 'Treść.', isAssumption: false }],
        },
      ],
    };
    await pool.query(
      `INSERT INTO wave5_artifacts
         (artifact_id, organization_id, artifact_type, status, title, content,
          current_version, citations_json, source_refs_json, provenance_json,
          created_by, created_at, updated_at, canonical_format,
          content_json_native, content_schema_version)
       VALUES ($1, $2, 'document', 'draft', $3, $4, 1, '[]', '[]', '{}',
               $5, $6, $6, 'markdown', $7, '1')`,
      [artifactId, ORG_A, title, '# ' + title, USER_A, nowIso, JSON.stringify(schema)]
    );
    await pool.query(
      `INSERT INTO document_lifecycle_states
         (artifact_id, organization_id, status, status_changed_at,
          status_changed_by, status_reason, history_json, updated_at)
       VALUES ($1, $2, 'draft', $3, $4, 'fixture', '[]'::jsonb, $3)
       ON CONFLICT (artifact_id, organization_id) DO NOTHING`,
      [artifactId, ORG_A, nowIso, USER_A]
    );
    createdDocIds.push(artifactId);
    return artifactId;
  }

  async function dbEventTypes(sourceRecordId: string): Promise<string[]> {
    const r = await pool.query(
      `SELECT e.event_type
         FROM artifact_lineage_events e
         JOIN artifact_lineage_receipts rc ON rc.receipt_id = e.receipt_id
        WHERE rc.organization_id = $1 AND rc.source_record_id = $2
        ORDER BY e.sequence_no ASC`,
      [ORG_A, sourceRecordId]
    );
    return r.rows.map((x) => x.event_type);
  }

  // =====================================================================
  // BLOCKER 1 — two independent instances, genuinely concurrent, same key.
  // =====================================================================
  it('BLOCKER 1 (checkpoint) — two independent app instances racing the SAME Idempotency-Key produce EXACTLY ONE checkpoint, and both HTTP responses agree on the same snapshot', async () => {
    const artifactId = await seedDocument('MAT-010MI Checkpoint Multi-Instance');
    const appA = await buildFreshAppInstance();
    const appB = await buildFreshAppInstance();
    const idemKey = `idem-mi-checkpoint-${uuidv4()}`;

    const [resA, resB] = await Promise.all([
      request(appA)
        .post(`/api/document-studio/${artifactId}/snapshots`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
        .send({ label: 'instance A', reason: 'manual' }),
      request(appB)
        .post(`/api/document-studio/${artifactId}/snapshots`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
        .send({ label: 'instance B', reason: 'manual' }),
    ]);

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    const versionIds = [resA.body?.snapshot?.versionId, resB.body?.snapshot?.versionId];
    expect(versionIds[0]).toBeTruthy();
    expect(versionIds[0]).toBe(versionIds[1]);
    const replayFlags = [resA.body.idempotentReplay, resB.body.idempotentReplay];
    expect(replayFlags.filter((f) => f === true)).toHaveLength(1);
    expect(replayFlags.filter((f) => !f)).toHaveLength(1);

    expect(await dbEventTypes(artifactId)).toEqual(['checkpoint']);
    const snapshotRows = await pool.query(
      `SELECT version_id FROM document_version_snapshots WHERE artifact_id = $1`,
      [artifactId]
    );
    expect(snapshotRows.rows).toHaveLength(1);
  });

  it('BLOCKER 1 (share_minted) — two independent app instances racing the SAME Idempotency-Key produce EXACTLY ONE live share link, and both HTTP responses return the same token', async () => {
    const artifactId = await seedDocument('MAT-010MI Share Multi-Instance');
    const appA = await buildFreshAppInstance();
    const appB = await buildFreshAppInstance();
    const idemKey = `idem-mi-share-${uuidv4()}`;

    const [resA, resB] = await Promise.all([
      request(appA)
        .post(`/api/document-studio/${artifactId}/share-links`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
        .send({ accessScope: 'read', label: 'A' }),
      request(appB)
        .post(`/api/document-studio/${artifactId}/share-links`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
        .send({ accessScope: 'read', label: 'B' }),
    ]);

    expect(resA.status).toBe(201);
    expect(resB.status).toBe(201);
    expect(resA.body.shareLink.shareLinkId).toBe(resB.body.shareLink.shareLinkId);
    expect(resA.body.shareLink.token).toBe(resB.body.shareLink.token);
    const replayFlags = [resA.body.idempotentReplay, resB.body.idempotentReplay];
    expect(replayFlags.filter((f) => f === true)).toHaveLength(1);
    expect(replayFlags.filter((f) => !f)).toHaveLength(1);

    expect(await dbEventTypes(artifactId)).toEqual(['share_minted']);
    const linkRows = await pool.query(
      `SELECT share_link_id FROM document_share_links WHERE artifact_id = $1`,
      [artifactId]
    );
    expect(linkRows.rows).toHaveLength(1);
  });

  it('BLOCKER 1 (restore) — two independent app instances racing the SAME Idempotency-Key produce EXACTLY ONE rollback_revert snapshot, and both HTTP responses agree on the same result', async () => {
    const artifactId = await seedDocument('MAT-010MI Restore Multi-Instance');
    const seedApp = await buildFreshAppInstance();
    const snap = await request(seedApp)
      .post(`/api/document-studio/${artifactId}/snapshots`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ label: 'target', reason: 'manual' })
      .expect(201);
    const versionId = snap.body?.snapshot?.versionId;
    expect(typeof versionId).toBe('string');

    const appA = await buildFreshAppInstance();
    const appB = await buildFreshAppInstance();
    const idemKey = `idem-mi-restore-${uuidv4()}`;

    const [resA, resB] = await Promise.all([
      request(appA)
        .post(`/api/document-studio/${artifactId}/snapshots/${versionId}/rollback`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
        .send({ reason: 'A' }),
      request(appB)
        .post(`/api/document-studio/${artifactId}/snapshots/${versionId}/rollback`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
        .send({ reason: 'B' }),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);
    const revertIds = [resA.body?.revertSnapshot?.versionId, resB.body?.revertSnapshot?.versionId];
    expect(revertIds[0]).toBeTruthy();
    expect(revertIds[0]).toBe(revertIds[1]);
    const replayFlags = [resA.body.idempotentReplay, resB.body.idempotentReplay];
    expect(replayFlags.filter((f) => f === true)).toHaveLength(1);
    expect(replayFlags.filter((f) => !f)).toHaveLength(1);

    expect(await dbEventTypes(artifactId)).toEqual(['checkpoint', 'restore']);
    const snapshotRows = await pool.query(
      `SELECT version_id FROM document_version_snapshots WHERE artifact_id = $1`,
      [artifactId]
    );
    expect(snapshotRows.rows).toHaveLength(2); // the target + the one revert
  });

  // =====================================================================
  // BLOCKER 2 — restart recovery. "app B" below never saw the original
  // request; its correctness cannot come from in-process state it never had.
  // =====================================================================
  it('BLOCKER 2 (checkpoint) — perform in "process A", retry the same Idempotency-Key against a genuinely fresh "process B": same durable snapshot, zero second mutation', async () => {
    const artifactId = await seedDocument('MAT-010MI Checkpoint Restart');
    const idemKey = `idem-restart-checkpoint-${uuidv4()}`;

    const appA = await buildFreshAppInstance();
    const first = await request(appA)
      .post(`/api/document-studio/${artifactId}/snapshots`)
      .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
      .send({ label: 'original', reason: 'manual' })
      .expect(201);
    expect(first.body.idempotentReplay).toBeFalsy();
    const versionId = first.body.snapshot.versionId;

    // "process A" is gone — appA is simply never referenced again. appB is
    // built from a FRESH module cache: none of appA's in-memory state
    // (snapshotStore, hydratedOrgs, ...) exists in appB's world at all.
    const appB = await buildFreshAppInstance();
    const retry = await request(appB)
      .post(`/api/document-studio/${artifactId}/snapshots`)
      .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
      .send({ label: 'original', reason: 'manual' })
      .expect(201);

    expect(retry.body.idempotentReplay).toBe(true);
    expect(retry.body.snapshot.versionId).toBe(versionId);
    expect(await dbEventTypes(artifactId)).toEqual(['checkpoint']);
    const snapshotRows = await pool.query(
      `SELECT version_id FROM document_version_snapshots WHERE artifact_id = $1`,
      [artifactId]
    );
    expect(snapshotRows.rows).toHaveLength(1);
  });

  it('BLOCKER 2 (restore) — perform in "process A", retry against a fresh "process B": same durable result, zero second rollback', async () => {
    const artifactId = await seedDocument('MAT-010MI Restore Restart');
    const seedApp = await buildFreshAppInstance();
    const snap = await request(seedApp)
      .post(`/api/document-studio/${artifactId}/snapshots`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ label: 'target', reason: 'manual' })
      .expect(201);
    const versionId = snap.body.snapshot.versionId;

    const idemKey = `idem-restart-restore-${uuidv4()}`;
    const appA = await buildFreshAppInstance();
    const first = await request(appA)
      .post(`/api/document-studio/${artifactId}/snapshots/${versionId}/rollback`)
      .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
      .send({ reason: 'original' })
      .expect(200);
    expect(first.body.idempotentReplay).toBeFalsy();
    const revertVersionId = first.body.revertSnapshot.versionId;

    const appB = await buildFreshAppInstance();
    const retry = await request(appB)
      .post(`/api/document-studio/${artifactId}/snapshots/${versionId}/rollback`)
      .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
      .send({ reason: 'original' })
      .expect(200);

    expect(retry.body.idempotentReplay).toBe(true);
    expect(retry.body.revertSnapshot.versionId).toBe(revertVersionId);
    expect(retry.body.restoredFrom.versionId).toBe(versionId);
    expect(await dbEventTypes(artifactId)).toEqual(['checkpoint', 'restore']);
    const snapshotRows = await pool.query(
      `SELECT version_id FROM document_version_snapshots WHERE artifact_id = $1`,
      [artifactId]
    );
    expect(snapshotRows.rows).toHaveLength(2);
  });

  it('BLOCKER 2 (share_minted) — perform in "process A", retry against a fresh "process B": returns the SAME usable token, zero second live credential minted', async () => {
    const artifactId = await seedDocument('MAT-010MI Share Restart');
    const idemKey = `idem-restart-share-${uuidv4()}`;

    const appA = await buildFreshAppInstance();
    const first = await request(appA)
      .post(`/api/document-studio/${artifactId}/share-links`)
      .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
      .send({ accessScope: 'read', label: 'original' })
      .expect(201);
    expect(first.body.idempotentReplay).toBeFalsy();
    const shareLinkId = first.body.shareLink.shareLinkId;
    const token = first.body.shareLink.token;
    expect(typeof token).toBe('string');

    const appB = await buildFreshAppInstance();
    const retry = await request(appB)
      .post(`/api/document-studio/${artifactId}/share-links`)
      .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
      .send({ accessScope: 'read', label: 'original' })
      .expect(201);

    expect(retry.body.idempotentReplay).toBe(true);
    expect(retry.body.shareLink.shareLinkId).toBe(shareLinkId);
    // THE decisive assertion for Blocker 2's share_minted requirement: the
    // SAME usable (raw) token comes back from a process that never saw the
    // original mint — proving it was durably persisted (in
    // `document_share_links.token`, confirmed pre-existing/unchanged by this
    // round, not a new plaintext-storage decision) and correctly re-read,
    // not reconstructed from in-memory state `appB` never had.
    expect(retry.body.shareLink.token).toBe(token);

    // The token is genuinely live and usable from the fresh instance too.
    await request(appB)
      .post('/api/document-studio/share-links/document')
      .send({ token })
      .expect(200);

    expect(await dbEventTypes(artifactId)).toEqual(['share_minted', 'public_open']);
    const linkRows = await pool.query(
      `SELECT share_link_id FROM document_share_links WHERE artifact_id = $1`,
      [artifactId]
    );
    expect(linkRows.rows).toHaveLength(1);
  });
});
