/**
 * Finance v3 canonical adapter — Pakiet B priority (a) REST surface, real
 * PostgreSQL + real HTTP integration tests.
 *
 * Covers `artifacts.routes.ts` / `versions.routes.ts` / `compute.routes.ts`
 * happy paths and error shapes. Same scaffold as
 * `models.routes.pg.test.ts`: real `express()` app + `supertest`, a stub
 * middleware sets `req.user`/`req.v8Context` directly (this file tests the
 * ROUTER + SERVICE contract, not the surrounding v8 auth chain — that is
 * covered separately by `mount-proof.pg.test.ts` against the REAL chain).
 *
 * Same env-var contract as this repo's other `.pg.test.ts` suites.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const CONNECTION_STRING = process.env.DATABASE_URL ?? '';
const REAL_PG_REQUESTED =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  CONNECTION_STRING.startsWith('postgres');
if (REAL_PG_REQUESTED) {
  process.env.DB_TYPE = 'postgres';
}
const REAL_PG = REAL_PG_REQUESTED;

describe.skipIf(!REAL_PG)('Finance v2 Pakiet B — artifacts/versions/compute (real HTTP + real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let app: express.Express;

  const orgId = `org-pkgb-${randomUUID()}`;
  const userId = `user-pkgb-${randomUUID()}`;

  function appAs(role: string) {
    const a = express();
    a.use(express.json());
    a.use((req: any, _res, next) => {
      req.user = { id: userId, organizationId: orgId, role };
      req.v8Context = { organizationId: orgId, userId, userRole: role };
      next();
    });
    a.use('/api/v8/finance-v2', financeV2Router);
    a.use((err: any, _req: any, res: any, _next: any) => {
      res.status(500).json({ error: String(err?.message || err) });
    });
    return a;
  }

  let financeV2Router: express.Router;

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'PkgB Test Org'])
    );

    app = appAs('finance_admin');
  });

  afterAll(async () => {
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`DELETE FROM compute_jobs WHERE organization_id = ?`, [orgId])
    );
  });

  // -------------------------------------------------------------------
  // Artifacts
  // -------------------------------------------------------------------

  it('POST /artifacts creates an artifact + v1 DRAFT business version', async () => {
    const res = await request(app)
      .post('/api/v8/finance-v2/artifacts')
      .send({ artifactType: 'HISTORICAL_ANALYSIS', naturalKey: `nk-${randomUUID()}` });

    expect(res.status).toBe(201);
    expect(res.body.data.artifactType).toBe('HISTORICAL_ANALYSIS');
    expect(res.body.data.currentBusinessVersion.status).toBe('DRAFT');
    expect(res.body.data.currentBusinessVersion.version).toBe(1);
    expect(res.body.meta).toEqual({ version: 'v2', contract: 'finance_v3_canonical_v1' });
  });

  it('POST /artifacts with an invalid artifactType -> 400 INVALID_ARTIFACT_TYPE', async () => {
    const res = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'NOT_A_TYPE' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ARTIFACT_TYPE');
  });

  it('GET /artifacts/:id returns the artifact with its current version summary', async () => {
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'BASELINE_MODEL' });
    const artifactId = created.body.data.artifactId;

    const res = await request(app).get(`/api/v8/finance-v2/artifacts/${artifactId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.artifactId).toBe(artifactId);
    expect(res.body.data.currentBusinessVersion.status).toBe('DRAFT');
  });

  it('GET /artifacts/:id for an unknown id -> 404 NOT_FOUND', async () => {
    const res = await request(app).get(`/api/v8/finance-v2/artifacts/${randomUUID()}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('GET /artifacts/:id/versions lists versions in version_no order', async () => {
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'HISTORICAL_ANALYSIS' });
    const artifactId = created.body.data.artifactId;

    const res = await request(app).get(`/api/v8/finance-v2/artifacts/${artifactId}/versions`);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].versionNo).toBe(1);
    expect(res.body.data[0].status).toBe('DRAFT');
  });

  it('GET /artifacts/:id/capabilities reflects role + status via lifecycleService.allowedActionsFromStatus', async () => {
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'HISTORICAL_ANALYSIS' });
    const artifactId = created.body.data.artifactId;

    // finance_admin on a DRAFT version can submit_for_review (T2 allows preparer/finance_admin).
    const asAdmin = await request(app).get(`/api/v8/finance-v2/artifacts/${artifactId}/capabilities`);
    expect(asAdmin.status).toBe(200);
    expect(asAdmin.body.data.role).toBe('finance_admin');
    expect(asAdmin.body.data.allowedActions).toContain('submit_for_review');

    // viewer role (unmapped org role) has zero mutating actions on DRAFT.
    const viewerRes = await request(appAs('some_unmapped_role')).get(`/api/v8/finance-v2/artifacts/${artifactId}/capabilities`);
    expect(viewerRes.status).toBe(200);
    expect(viewerRes.body.data.role).toBe('viewer');
    expect(viewerRes.body.data.allowedActions).toEqual([]);
  });

  // -------------------------------------------------------------------
  // Versions / transitions
  // -------------------------------------------------------------------

  it('GET /versions/:id + POST /versions/:id/transitions drive DRAFT -> READY_FOR_REVIEW -> IN_REVIEW', async () => {
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'HISTORICAL_ANALYSIS' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;

    const getRes = await request(app).get(`/api/v8/finance-v2/versions/${bvId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.status).toBe('DRAFT');
    let version = getRes.body.data.version;

    const t1 = await request(app)
      .post(`/api/v8/finance-v2/versions/${bvId}/transitions`)
      .send({ action: 'submit_for_review', expectedVersion: version });
    expect(t1.status).toBe(200);
    expect(t1.body.data.status).toBe('READY_FOR_REVIEW');
    version = t1.body.data.version;

    const t2 = await request(app)
      .post(`/api/v8/finance-v2/versions/${bvId}/transitions`)
      .send({ action: 'start_review', expectedVersion: version });
    expect(t2.status).toBe(200);
    expect(t2.body.data.status).toBe('IN_REVIEW');
  });

  it('POST /versions/:id/transitions with a stale expectedVersion -> 409 VERSION_CONFLICT', async () => {
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'HISTORICAL_ANALYSIS' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;

    const res = await request(app)
      .post(`/api/v8/finance-v2/versions/${bvId}/transitions`)
      .send({ action: 'submit_for_review', expectedVersion: 999 });
    expect(res.status).toBe(409);
    expect(res.body.code).toBe('VERSION_CONFLICT');
  });

  it('POST /versions/:id/transitions missing expectedVersion -> 400 EXPECTED_VERSION_REQUIRED', async () => {
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'HISTORICAL_ANALYSIS' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;

    const res = await request(app).post(`/api/v8/finance-v2/versions/${bvId}/transitions`).send({ action: 'submit_for_review' });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('EXPECTED_VERSION_REQUIRED');
  });

  it('POST /versions/:id/transitions with action=approve -> 400 INVALID_ACTION (approve routes through /models/:id/approve)', async () => {
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'HISTORICAL_ANALYSIS' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;

    const res = await request(app)
      .post(`/api/v8/finance-v2/versions/${bvId}/transitions`)
      .send({ action: 'approve', expectedVersion: 1 });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('INVALID_ACTION');
  });

  it('POST /versions/:id/compute-snapshot freezes a snapshot for the current working revision (T8a)', async () => {
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'BASELINE_MODEL' });
    const bvId = created.body.data.currentBusinessVersion.businessVersionId;

    const res = await request(app).post(`/api/v8/finance-v2/versions/${bvId}/compute-snapshot`).send({});
    expect(res.status).toBe(201);
    expect(res.body.data.reused).toBe(false);
    expect(res.body.data.computeSnapshotId).toBeTruthy();

    // Calling again for the SAME still-current working revision reuses it (200, reused=true).
    const res2 = await request(app).post(`/api/v8/finance-v2/versions/${bvId}/compute-snapshot`).send({});
    expect(res2.status).toBe(200);
    expect(res2.body.data.reused).toBe(true);
    expect(res2.body.data.computeSnapshotId).toBe(res.body.data.computeSnapshotId);
  });

  // -------------------------------------------------------------------
  // Compute jobs
  // -------------------------------------------------------------------

  async function seedArtifactForCompute() {
    const created = await request(app).post('/api/v8/finance-v2/artifacts').send({ artifactType: 'BASELINE_MODEL' });
    return created.body.data.artifactId as string;
  }

  async function legacyUnknownManifestId(): Promise<string> {
    const row = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ engine_manifest_id: string }>(
        `SELECT engine_manifest_id FROM finance_engine_manifests WHERE engine_name = 'LEGACY_UNKNOWN' LIMIT 1`
      )
    );
    if (!row) throw new Error('LEGACY_UNKNOWN engine manifest not seeded — migrations not applied?');
    return row.engine_manifest_id;
  }

  it('POST /compute/jobs enqueues, GET returns queued status, POST cancel moves to cancelled', async () => {
    const artifactId = await seedArtifactForCompute();
    const engineManifestId = await legacyUnknownManifestId();
    const idempotencyKey = `enqueue-${randomUUID()}`;

    const enqueueRes = await request(app)
      .post('/api/v8/finance-v2/compute/jobs')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        jobType: 'BASELINE_COMPUTE',
        inputArtifactId: artifactId,
        inputRevisionHash: 'hash-1',
        engineManifestId,
      });
    expect(enqueueRes.status).toBe(201);
    expect(enqueueRes.body.data.status).toBe('queued');
    expect(enqueueRes.body.data.wasExisting).toBe(false);
    const jobId = enqueueRes.body.data.jobId;

    // Idempotent replay — same key -> 200, wasExisting=true, same jobId.
    const replay = await request(app)
      .post('/api/v8/finance-v2/compute/jobs')
      .set('Idempotency-Key', idempotencyKey)
      .send({
        jobType: 'BASELINE_COMPUTE',
        inputArtifactId: artifactId,
        inputRevisionHash: 'hash-1',
        engineManifestId,
      });
    expect(replay.status).toBe(200);
    expect(replay.body.data.wasExisting).toBe(true);
    expect(replay.body.data.jobId).toBe(jobId);

    const statusRes = await request(app).get(`/api/v8/finance-v2/compute/jobs/${jobId}`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.status).toBe('queued');
    expect(statusRes.body.data.inputRevisionHash).toBe('hash-1');

    const cancelRes = await request(app).post(`/api/v8/finance-v2/compute/jobs/${jobId}/cancel`).send({ reason: 'test cancel' });
    expect(cancelRes.status).toBe(200);
    expect(cancelRes.body.data.status).toBe('cancelled');

    const afterCancel = await request(app).get(`/api/v8/finance-v2/compute/jobs/${jobId}`);
    expect(afterCancel.body.data.status).toBe('cancelled');
  });

  it('POST /compute/jobs without Idempotency-Key -> 400 IDEMPOTENCY_KEY_REQUIRED', async () => {
    const artifactId = await seedArtifactForCompute();
    const engineManifestId = await legacyUnknownManifestId();

    const res = await request(app)
      .post('/api/v8/finance-v2/compute/jobs')
      .send({ jobType: 'BASELINE_COMPUTE', inputArtifactId: artifactId, inputRevisionHash: 'h', engineManifestId });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
  });

  it('GET /compute/jobs/:id for an unknown id -> 404 NOT_FOUND', async () => {
    const res = await request(app).get(`/api/v8/finance-v2/compute/jobs/${randomUUID()}`);
    expect(res.status).toBe(404);
    expect(res.body.code).toBe('NOT_FOUND');
  });

  it('POST /compute/jobs/:id/cancel on an already-terminal job -> 404 (not cancellable, no leak of "already done" vs "never existed")', async () => {
    const artifactId = await seedArtifactForCompute();
    const engineManifestId = await legacyUnknownManifestId();
    const idempotencyKey = `terminal-${randomUUID()}`;

    const enqueueRes = await request(app)
      .post('/api/v8/finance-v2/compute/jobs')
      .set('Idempotency-Key', idempotencyKey)
      .send({ jobType: 'BASELINE_COMPUTE', inputArtifactId: artifactId, inputRevisionHash: 'h2', engineManifestId });
    const jobId = enqueueRes.body.data.jobId;

    const first = await request(app).post(`/api/v8/finance-v2/compute/jobs/${jobId}/cancel`).send({});
    expect(first.status).toBe(200);

    const second = await request(app).post(`/api/v8/finance-v2/compute/jobs/${jobId}/cancel`).send({});
    expect(second.status).toBe(404);
    expect(second.body.code).toBe('NOT_FOUND');
  });
});
