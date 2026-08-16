/**
 * MAT-MVP-DOC-001 / MAT-BVP-001 (Lane C, closure) — document version
 * lineage + checkpoint/rollback CAS. Real PostgreSQL regression, NO mocked
 * DB (`DbPromise`/`Database` are exercised for real — only the auth/rbac
 * middleware is stubbed, to inject a tenant identity without a full JWT
 * flow, matching the established harness in
 * `server/src/routes/__tests__/document-studio-cross-org-idor.test.ts`).
 *
 * DEFECTS THIS PINS (see the task brief's "THE REAL GAPS"):
 *   1. `document_version_snapshots` had no `content_hash` / no persisted
 *      `parent_version_id` — lineage was only reconstructable by
 *      `version_number` ordering, and a tampered/duplicated version was
 *      undetectable. Migration `20260912_claude_c_document_version_
 *      lineage.sql` adds both columns; `createDocumentVersionSnapshot` /
 *      `createCheckpointSnapshotWithCas` now populate them.
 *   2. `createDocumentSnapshot` / `rollbackDocumentToVersion` had NO CAS
 *      guard of their own (only an OPT-IN `Idempotency-Key` header) — a
 *      double-click could create two checkpoints or apply two rollbacks.
 *      Both now carry a real, Postgres-adjudicated CAS guard, independent
 *      of any idempotency header.
 *   3. Zero realDB coverage existed for checkpoint/rollback/lineage before
 *      this file — every prior DOC test mocked `DbPromise`.
 *
 * Isolation: every test uses freshly generated `claude_c_org_*` /
 * `claude_c_doc_*` ids, so this file neither depends on nor disturbs rows
 * written by any other test file, and never truncates shared tables.
 *
 * HOW TO RUN LOCALLY:
 *   DATABASE_URL="postgresql://consultinity:consultinity@127.0.0.1:55432/consultinity" \
 *   DB_TYPE=postgres CI=true MOCK_DB=false \
 *     npx vitest run tests/document-version-lineage --config server/vitest.config.ts \
 *       --no-file-parallelism --maxWorkers=1
 *
 * NOTE on config: the ROOT `vitest.config.ts`'s `include` list does not
 * cover `tests/document-version-lineage/**` (verified empirically — a bare
 * `npx vitest run tests/document-version-lineage` reports "No test files
 * found, exiting with code 1", an HONEST failure, not a false-green empty
 * run). `server/vitest.config.ts`'s broader `tests/**` include covers it.
 * Both root and server configs hard-code `DB_TYPE=sqlite` / `NODE_ENV=test`
 * in their own `test.env` block (overriding the shell's `DB_TYPE=postgres`
 * — verified empirically too), but `DatabaseConfig.getDatabaseType()`
 * ALWAYS resolves to `'postgres'` regardless of `DB_TYPE` (SQLite has been
 * fully removed from this repo), and the mock-DB gate in `Database.ts`
 * only trips on `NODE_ENV==='test' && MOCK_DB !== 'false'` — so exporting
 * `MOCK_DB=false` (which the config does NOT override) is what actually
 * keeps this suite off the mock, confirmed by querying `SELECT version()`
 * through the app's own `DbPromise` layer in `beforeAll` below.
 */

import { randomUUID } from 'node:crypto';

import express, { type Express } from 'express';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const REAL_DB = process.env.MOCK_DB === 'false' && Boolean(process.env.DATABASE_URL);

// ---------------------------------------------------------------------------
// Auth harness — mirrors document-studio-cross-org-idor.test.ts exactly.
// Only the IDENTITY layer is stubbed; DbPromise/Database are real.
// ---------------------------------------------------------------------------
let mockUser: { id: string; organizationId: string; role: string } | null = null;

vi.mock('../../../middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, _res: any, next: () => void) => {
    if (mockUser) {
      req.userId = mockUser.id;
      req.userRole = mockUser.role;
      req.organizationId = mockUser.organizationId;
      req.user = mockUser;
    }
    next();
  },
}));

vi.mock('../../../middleware/rbac.middleware.js', () => ({
  requireOrgAccess: () => (_req: any, _res: any, next: () => void) => next(),
}));

function asUser(id: string, organizationId: string, role = 'OWNER'): void {
  mockUser = { id, organizationId, role };
}

async function freshApp(): Promise<Express> {
  const mod = await import('../../../routes/document-studio.routes.js');
  const app = express();
  app.use(express.json());
  app.use('/api/document-studio', mod.default);
  return app;
}

// ---------------------------------------------------------------------------
// Fixture — seed a wave5 `report` artifact carrying a minimal, valid
// DocumentSchema, EXACTLY the shape `materializeDocumentArtifact` itself
// writes (`artifactType: 'report'`, `contentJson`, and
// `metadata.documentStudioSchema`) — see `documentStudioService.ts:1107-
// 1139`. This is the real production seeding shape, not a synthetic one.
// ---------------------------------------------------------------------------
function minimalSchema(params: { artifactId: string; title: string }) {
  const nowIso = new Date().toISOString();
  return {
    title: params.title,
    documentId: params.artifactId,
    artifactId: params.artifactId,
    documentType: 'executive_memo',
    language: 'en',
    audience: ['Board'],
    goal: 'decide',
    communicationRegister: 'executive',
    density: 'medium',
    languageStyle: 'consulting_neutral',
    confidentiality: 'internal',
    formattingSchema: {
      fonts: { body: 'Aptos 11', heading: 'Aptos Display' },
      headingStyles: { h1: '16pt bold', h2: '13pt bold', h3: '11pt bold' },
      tableStyles: { default: 'consultify_clean_table' },
      listStyles: { bullet: 'consultify_bullet', numbered: 'consultify_numbered' },
      page: { size: 'A4', marginsCm: { top: 2, bottom: 2, left: 2.3, right: 2.3 } },
      headers: { enabled: true },
      footers: { enabled: true, pageNumbering: true, confidentialityLabel: true },
      toc: true,
      coverPage: true,
      appendixStyle: 'lettered',
      citationStyle: 'inline_marker',
    },
    sections: [],
    sourceRefs: [],
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

async function seedDocument(params: {
  organizationId: string;
  userId: string;
  artifactId: string;
  title: string;
}): Promise<void> {
  const { createWave5Artifact } = await import(
    '../../../services/wave5ArtifactRuntimeService.js'
  );
  // Mirrors `materializeDocumentArtifact`'s own sequence
  // (`documentStudioService.ts:1123-1196`): create the wave5 row, THEN
  // initialize lifecycle state. Without this second step,
  // `__forceTransitionDocumentStatusForRollback` (rollback's step 5) throws
  // "no lifecycle state for artifact" — `getDocumentStatusOrDefault` is
  // lenient and defaults to 'draft' for checkpoint/read paths, but the
  // rollback FORCE-transition is not.
  const { initializeDocumentLifecycle } = await import(
    '../../../services/documentStudio/documentLifecycleService.js'
  );
  const schema = minimalSchema(params);
  await createWave5Artifact({
    organizationId: params.organizationId,
    userId: params.userId,
    artifactType: 'report',
    title: params.title,
    content: `seed content for ${params.artifactId}`,
    canonicalFormat: 'markdown',
    contentMd: `seed content for ${params.artifactId}`,
    contentJson: schema,
    contentSchemaVersion: 'document_studio_v1',
    metadata: { documentStudioSchema: schema },
    externalArtifactId: params.artifactId,
  });
  initializeDocumentLifecycle({
    organizationId: params.organizationId,
    artifactId: params.artifactId,
    actorId: params.userId,
  });
}

// ---------------------------------------------------------------------------
// Cleanup bookkeeping — every org id this file invents, so the rows it
// deliberately leaves behind (durability is the whole point) can be
// removed afterwards. Ids are unique per test, never touching another
// file's data.
// ---------------------------------------------------------------------------
const createdOrgs: string[] = [];
function freshOrg(): string {
  const id = `claude_c_org_${randomUUID()}`;
  createdOrgs.push(id);
  return id;
}
function freshArtifactId(): string {
  return `claude_c_doc_${randomUUID()}`;
}

describe.skipIf(!REAL_DB)('Document version lineage + checkpoint/rollback CAS — real PostgreSQL', () => {
  beforeEach(() => {
    mockUser = null;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (createdOrgs.length === 0) return;
    const { Pool } = await import('pg');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const tables = [
        'document_version_snapshots',
        'document_studio_schema_overlay',
        'document_studio_editor_audit',
        'document_lifecycle_states',
        'wave5_artifact_versions',
        'wave5_artifacts',
      ];
      for (const table of tables) {
        await pool.query(`DELETE FROM ${table} WHERE organization_id = ANY($1)`, [createdOrgs]);
      }
      for (const table of tables) {
        const residue = await pool.query(
          `SELECT COUNT(*)::int AS n FROM ${table} WHERE organization_id = ANY($1)`,
          [createdOrgs]
        );
        if (residue.rows[0]?.n !== 0) {
          throw new Error(`cleanup left ${residue.rows[0]?.n} row(s) behind in ${table}`);
        }
      }
    } finally {
      await pool.end();
    }
  });

  it('a real PostgreSQL connection answers through the app DbPromise layer (not a mock)', async () => {
    const { all } = await import('../../../utils/DbPromise.js');
    const rows = await all<{ v: string }>('SELECT version() AS v', [], { fallback: false });
    expect(rows).toHaveLength(1);
    expect(rows[0].v).toMatch(/PostgreSQL/);
  });

  it('checkpoint writes content_hash + explicit parent chain; identical content -> identical hash; changed content -> different hash', async () => {
    const ORG = freshOrg();
    const USER = `claude_c_user_${randomUUID()}`;
    const ARTIFACT = freshArtifactId();
    await seedDocument({ organizationId: ORG, userId: USER, artifactId: ARTIFACT, title: 'Baseline' });

    const app = await freshApp();
    asUser(USER, ORG);

    const c1 = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/snapshots`)
      .send({ label: 'v1' });
    expect(c1.status).toBe(201);
    expect(c1.body.snapshot.contentHash).toEqual(expect.any(String));
    expect(c1.body.snapshot.parentVersionId).toBeNull();

    // Same live content, no intervening edit — a second checkpoint MUST hash
    // identically to the first.
    const c2 = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/snapshots`)
      .send({ label: 'v2-same-content' });
    expect(c2.status).toBe(201);
    expect(c2.body.snapshot.parentVersionId).toBe(c1.body.snapshot.versionId);
    expect(c2.body.snapshot.contentHash).toBe(c1.body.snapshot.contentHash);

    // Now actually change the content via the real manual-save path.
    const live = await request(app).get(`/api/document-studio/${ARTIFACT}`);
    expect(live.status).toBe(200);
    const save = await request(app)
      .put(`/api/document-studio/${ARTIFACT}/content`)
      .send({ sections: [], expectedVersion: live.body.schema.updatedAt, title: 'Changed title' });
    expect(save.status).toBe(200);

    const c3 = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/snapshots`)
      .send({ label: 'v3-changed-content' });
    expect(c3.status).toBe(201);
    expect(c3.body.snapshot.parentVersionId).toBe(c2.body.snapshot.versionId);
    expect(c3.body.snapshot.contentHash).not.toBe(c2.body.snapshot.contentHash);

    // Cold readback (part c) — force a genuinely fresh module graph (empty
    // in-process snapshot cache, empty schema-overlay cache, ...) so this
    // assertion can only pass if the chain actually survived in Postgres,
    // not because the warm process's cache still remembers it.
    vi.resetModules();
    const cold = await freshApp();
    const lineageRes = await request(cold).get(`/api/document-studio/${ARTIFACT}/lineage`);
    expect(lineageRes.status).toBe(200);
    const chain = lineageRes.body.lineage as Array<{
      versionId: string;
      versionNumber: number;
      parentVersionId: string | null;
      contentHash: string | null;
    }>;
    expect(chain.map((e) => e.versionNumber)).toEqual([1, 2, 3]);
    expect(chain[0].parentVersionId).toBeNull();
    expect(chain[1].parentVersionId).toBe(chain[0].versionId);
    expect(chain[2].parentVersionId).toBe(chain[1].versionId);
    expect(chain[0].contentHash).toBe(chain[1].contentHash);
    expect(chain[2].contentHash).not.toBe(chain[1].contentHash);
  }, 30000); // this test's `vi.resetModules()` cold-readback step re-runs
  // `ensureWave5ArtifactRuntimeSchema()`'s CREATE TABLE IF NOT EXISTS pass,
  // which was observed to take 6+s under host load (SLOW QUERY log) — the
  // default 10s timeout flaked on this one specific test under load.

  it('two CONCURRENT checkpoints with the same expected version: exactly one applies, the loser gets 409 checkpoint_conflict', async () => {
    const ORG = freshOrg();
    const USER = `claude_c_user_${randomUUID()}`;
    const ARTIFACT = freshArtifactId();
    await seedDocument({ organizationId: ORG, userId: USER, artifactId: ARTIFACT, title: 'Concurrent checkpoint' });

    const app = await freshApp();
    asUser(USER, ORG);

    // Both callers assert "no snapshot exists yet" (expectedVersion: null) —
    // the double-click case: two requests fired before either has completed,
    // neither has observed the other's write.
    const [r1, r2] = await Promise.all([
      request(app).post(`/api/document-studio/${ARTIFACT}/snapshots`).send({ expectedVersion: null }),
      request(app).post(`/api/document-studio/${ARTIFACT}/snapshots`).send({ expectedVersion: null }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);
    const conflictRes = r1.status === 409 ? r1 : r2;
    expect(conflictRes.body.code).toBe('DOC_CHECKPOINT_CONFLICT');
    expect(conflictRes.body.conflict.yourVersion).toBeNull();

    const list = await request(app).get(`/api/document-studio/${ARTIFACT}/snapshots`);
    expect(list.body.snapshots).toHaveLength(1);
  });

  it('two CONCURRENT rollbacks with the same expected version: exactly one applies, the loser gets 409 rollback_conflict', async () => {
    const ORG = freshOrg();
    const USER = `claude_c_user_${randomUUID()}`;
    const ARTIFACT = freshArtifactId();
    await seedDocument({ organizationId: ORG, userId: USER, artifactId: ARTIFACT, title: 'Concurrent rollback' });

    const app = await freshApp();
    asUser(USER, ORG);

    const c1 = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/snapshots`)
      .send({ label: 'baseline' });
    expect(c1.status).toBe(201);
    const targetVersionId = c1.body.snapshot.versionId as string;

    const live = await request(app).get(`/api/document-studio/${ARTIFACT}`);
    const expectedVersion = live.body.schema.updatedAt as string;

    const [r1, r2] = await Promise.all([
      request(app)
        .post(`/api/document-studio/${ARTIFACT}/snapshots/${targetVersionId}/rollback`)
        .send({ expectedVersion }),
      request(app)
        .post(`/api/document-studio/${ARTIFACT}/snapshots/${targetVersionId}/rollback`)
        .send({ expectedVersion }),
    ]);

    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 409]);
    const conflictRes = r1.status === 409 ? r1 : r2;
    expect(conflictRes.body.code).toBe('DOC_ROLLBACK_CONFLICT');
    expect(conflictRes.body.conflict.yourVersion).toBe(expectedVersion);
  });

  it('stale expected-version -> 409 for both checkpoint and rollback', async () => {
    const ORG = freshOrg();
    const USER = `claude_c_user_${randomUUID()}`;
    const ARTIFACT = freshArtifactId();
    await seedDocument({ organizationId: ORG, userId: USER, artifactId: ARTIFACT, title: 'Stale version' });

    const app = await freshApp();
    asUser(USER, ORG);

    const c1 = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/snapshots`)
      .send({ label: 'v1' });
    expect(c1.status).toBe(201);

    // Checkpoint: caller wrongly believes the latest is some other id.
    const staleCheckpoint = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/snapshots`)
      .send({ expectedVersion: 'claude_c_not_the_real_latest' });
    expect(staleCheckpoint.status).toBe(409);
    expect(staleCheckpoint.body.code).toBe('DOC_CHECKPOINT_CONFLICT');
    expect(staleCheckpoint.body.conflict.serverVersion.versionId).toBe(c1.body.snapshot.versionId);

    // Rollback: caller wrongly believes the live document's updatedAt.
    const staleRollback = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/snapshots/${c1.body.snapshot.versionId}/rollback`)
      .send({ expectedVersion: 'claude_c_not_the_real_updated_at' });
    expect(staleRollback.status).toBe(409);
    expect(staleRollback.body.code).toBe('DOC_ROLLBACK_CONFLICT');
    expect(staleRollback.body.conflict.serverVersion).toEqual(expect.any(String));
    expect(staleRollback.body.conflict.serverVersion).not.toBe('claude_c_not_the_real_updated_at');
  });

  it('cross-tenant read/checkpoint/rollback are denied (tenant-scoped, deny-by-default)', async () => {
    const VICTIM_ORG = freshOrg();
    const VICTIM_USER = `claude_c_user_${randomUUID()}`;
    const ATTACKER_ORG = freshOrg();
    const ATTACKER_USER = `claude_c_user_${randomUUID()}`;
    const ARTIFACT = freshArtifactId();
    await seedDocument({
      organizationId: VICTIM_ORG,
      userId: VICTIM_USER,
      artifactId: ARTIFACT,
      title: 'Victim document',
    });

    const app = await freshApp();
    asUser(VICTIM_USER, VICTIM_ORG);
    const c1 = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/snapshots`)
      .send({ label: 'victim-only' });
    expect(c1.status).toBe(201);
    const victimVersionId = c1.body.snapshot.versionId as string;

    // Switch identity to the attacker tenant, same app instance (same
    // in-process caches) so a cache-scoping bug, not just a DB WHERE
    // clause, would be caught.
    asUser(ATTACKER_USER, ATTACKER_ORG);

    const listRes = await request(app).get(`/api/document-studio/${ARTIFACT}/snapshots`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.snapshots).toEqual([]);

    const lineageRes = await request(app).get(`/api/document-studio/${ARTIFACT}/lineage`);
    expect(lineageRes.status).toBe(200);
    expect(lineageRes.body.lineage).toEqual([]);

    const checkpointRes = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/snapshots`)
      .send({ label: 'attacker-attempt' });
    expect(checkpointRes.status).toBe(404);

    const rollbackRes = await request(app)
      .post(`/api/document-studio/${ARTIFACT}/snapshots/${victimVersionId}/rollback`)
      .send({});
    expect(rollbackRes.status).toBe(404);

    // Prove the victim's own data is untouched by the attacker's attempts.
    asUser(VICTIM_USER, VICTIM_ORG);
    const victimList = await request(app).get(`/api/document-studio/${ARTIFACT}/snapshots`);
    expect(victimList.body.snapshots).toHaveLength(1);
  });
});
