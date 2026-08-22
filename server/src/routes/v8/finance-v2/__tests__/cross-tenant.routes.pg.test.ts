/**
 * Finance v3 canonical adapter — Pakiet B cross-tenant matrix, real
 * PostgreSQL + real HTTP.
 *
 * ★ KONTROLA NEGATYWNA — obowiązkowa (brief §"Kontrola negatywna"). For
 * every new endpoint family, org B requests a resource created by org A and
 * must be refused — AND the refusal is independently confirmed by a direct
 * SQL read (never trusting only the HTTP response body, per the brief's
 * "nigdy nie ufaj wartości zwróconej przez serwis — ten program był już
 * oszukany przez 'UPDATE 0 wygląda jak PASS'").
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

describe.skipIf(!REAL_PG)(
  'Finance v2 Pakiet B — cross-tenant matrix (real HTTP + real PostgreSQL)',
  () => {
    let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
    let financeV2Router: express.Router;

    const orgA = `org-pkgb-a-${randomUUID()}`;
    const orgB = `org-pkgb-b-${randomUUID()}`;
    const userA = `user-pkgb-a-${randomUUID()}`;
    const userB = `user-pkgb-b-${randomUUID()}`;

    function appAsOrg(orgId: string, userId: string) {
      const a = express();
      a.use(express.json());
      a.use((req: any, _res, next) => {
        req.user = { id: userId, organizationId: orgId, role: 'finance_admin' };
        req.v8Context = { organizationId: orgId, userId, userRole: 'finance_admin' };
        next();
      });
      a.use('/api/v8/finance-v2', financeV2Router);
      a.use((err: any, _req: any, res: any, _next: any) =>
        res.status(500).json({ error: String(err?.message || err) })
      );
      return a;
    }

    let appA: express.Express;
    let appB: express.Express;

    beforeAll(async () => {
      ({ withPinnedPostgresTransaction } =
        await import('../../../../database/PostgresDatabase.js'));
      financeV2Router = (await import('../index.js')).default;

      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?), (?, ?)`, [
          orgA,
          'PkgB Tenant A',
          orgB,
          'PkgB Tenant B',
        ])
      );
      await withPinnedPostgresTransaction(async (tx) => {
        await tx.queryRun(
          `INSERT INTO users (id, email, password, first_name, last_name, role, organization_id)
           VALUES (?, ?, 'test', 'Tenant', 'A', 'ADMIN', ?),
                  (?, ?, 'test', 'Tenant', 'B', 'ADMIN', ?)`,
          [userA, `${userA}@example.test`, orgA, userB, `${userB}@example.test`, orgB]
        );
        await tx.queryRun(
          `INSERT INTO organization_members (id, organization_id, user_id, role, status)
           VALUES (?, ?, ?, 'ADMIN', 'ACTIVE'), (?, ?, ?, 'ADMIN', 'ACTIVE')`,
          [randomUUID(), orgA, userA, randomUUID(), orgB, userB]
        );
      });

      appA = appAsOrg(orgA, userA);
      appB = appAsOrg(orgB, userB);
    });

    afterAll(async () => {
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`DELETE FROM compute_jobs WHERE organization_id IN (?, ?)`, [orgA, orgB])
      );
    });

    async function legacyUnknownManifestId(): Promise<string> {
      const row = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ engine_manifest_id: string }>(
          `SELECT engine_manifest_id FROM finance_engine_manifests WHERE engine_name = 'LEGACY_UNKNOWN' LIMIT 1`
        )
      );
      if (!row) throw new Error('LEGACY_UNKNOWN engine manifest not seeded');
      return row.engine_manifest_id;
    }

    it('GET /artifacts — returns only the active tenant registry and honors the canonical type filter', async () => {
      const ownBaseline = await request(appA)
        .post('/api/v8/finance-v2/artifacts')
        .send({ artifactType: 'BASELINE_MODEL', naturalKey: 'tenant-a-baseline' });
      const ownAnalysis = await request(appA)
        .post('/api/v8/finance-v2/artifacts')
        .send({ artifactType: 'HISTORICAL_ANALYSIS', naturalKey: 'tenant-a-analysis' });
      const foreignBaseline = await request(appB)
        .post('/api/v8/finance-v2/artifacts')
        .send({ artifactType: 'BASELINE_MODEL', naturalKey: 'tenant-b-baseline' });

      const list = await request(appA).get('/api/v8/finance-v2/artifacts');
      expect(list.status).toBe(200);
      expect(list.body.data.artifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ artifactId: ownBaseline.body.data.artifactId }),
          expect.objectContaining({ artifactId: ownAnalysis.body.data.artifactId }),
        ])
      );
      expect(list.body.data.artifacts).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ artifactId: foreignBaseline.body.data.artifactId }),
        ])
      );

      const filtered = await request(appA).get(
        '/api/v8/finance-v2/artifacts?artifactType=BASELINE_MODEL'
      );
      expect(filtered.status).toBe(200);
      expect(filtered.body.data.artifacts).toEqual([
        expect.objectContaining({
          artifactId: ownBaseline.body.data.artifactId,
          artifactType: 'BASELINE_MODEL',
        }),
      ]);

      const invalid = await request(appA).get(
        '/api/v8/finance-v2/artifacts?artifactType=NOT_A_FINANCE_TYPE'
      );
      expect(invalid.status).toBe(400);
      expect(invalid.body.code).toBe('INVALID_ARTIFACT_TYPE');
    });

    it('GET /artifacts/:id — org B reading org A artifact -> 404, SQL confirms row still belongs to org A', async () => {
      const created = await request(appA)
        .post('/api/v8/finance-v2/artifacts')
        .send({ artifactType: 'HISTORICAL_ANALYSIS' });
      const artifactId = created.body.data.artifactId;

      const crossRead = await request(appB).get(`/api/v8/finance-v2/artifacts/${artifactId}`);
      expect(crossRead.status).toBe(404);
      expect(crossRead.body.code).toBe('NOT_FOUND');

      const row = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ organization_id: string }>(
          `SELECT organization_id FROM finance_artifacts WHERE artifact_id = ?`,
          [artifactId]
        )
      );
      expect(row?.organization_id).toBe(orgA);
    });

    it('GET /artifacts/:id/versions — org B listing org A versions -> 404, not an empty [] leak', async () => {
      const created = await request(appA)
        .post('/api/v8/finance-v2/artifacts')
        .send({ artifactType: 'HISTORICAL_ANALYSIS' });
      const artifactId = created.body.data.artifactId;

      const res = await request(appB).get(`/api/v8/finance-v2/artifacts/${artifactId}/versions`);
      // Must be 404 (artifact does not exist FOR ORG B), not 200 with data:[] —
      // an empty array would look identical to "org owns it but has no versions".
      expect(res.status).toBe(404);
    });

    it('GET /artifacts/:id/capabilities — org B on org A artifact -> 404', async () => {
      const created = await request(appA)
        .post('/api/v8/finance-v2/artifacts')
        .send({ artifactType: 'HISTORICAL_ANALYSIS' });
      const artifactId = created.body.data.artifactId;

      const res = await request(appB).get(
        `/api/v8/finance-v2/artifacts/${artifactId}/capabilities`
      );
      expect(res.status).toBe(404);
    });

    it('POST /versions/:id/transitions — org B transitioning org A version -> 404 NOT_FOUND, SQL confirms version/status unchanged', async () => {
      const created = await request(appA)
        .post('/api/v8/finance-v2/artifacts')
        .send({ artifactType: 'HISTORICAL_ANALYSIS' });
      const bvId = created.body.data.currentBusinessVersion.businessVersionId;
      const versionBefore = created.body.data.currentBusinessVersion.version;

      const crossAttempt = await request(appB)
        .post(`/api/v8/finance-v2/versions/${bvId}/transitions`)
        .send({ action: 'submit_for_review', expectedVersion: versionBefore });
      expect(crossAttempt.status).toBe(404);
      expect(crossAttempt.body.code).toBe('NOT_FOUND');

      // Independent SQL read — never trust the HTTP response alone (brief's
      // "UPDATE 0 wygląda jak PASS" warning). Row must be byte-identical:
      // still DRAFT, still version 1.
      const row = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ status: string; version: number; organization_id: string }>(
          `SELECT status, version, organization_id FROM finance_business_versions WHERE business_version_id = ?`,
          [bvId]
        )
      );
      expect(row?.status).toBe('DRAFT');
      expect(row?.version).toBe(versionBefore);
      expect(row?.organization_id).toBe(orgA);

      // Legitimate same-org transition still works afterward — proves the
      // cross-tenant attempt did not corrupt the row in some other way.
      const legit = await request(appA)
        .post(`/api/v8/finance-v2/versions/${bvId}/transitions`)
        .send({ action: 'submit_for_review', expectedVersion: versionBefore });
      expect(legit.status).toBe(200);
      expect(legit.body.data.status).toBe('READY_FOR_REVIEW');
    });

    it('POST /versions/:id/compute-snapshot — org B on org A version -> 404 NOT_FOUND, SQL confirms zero snapshots created', async () => {
      const created = await request(appA)
        .post('/api/v8/finance-v2/artifacts')
        .send({ artifactType: 'BASELINE_MODEL' });
      const bvId = created.body.data.currentBusinessVersion.businessVersionId;

      const res = await request(appB)
        .post(`/api/v8/finance-v2/versions/${bvId}/compute-snapshot`)
        .send({});
      expect(res.status).toBe(404);

      const snapshots = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ compute_snapshot_id: string }>(
          `SELECT compute_snapshot_id FROM finance_compute_snapshots WHERE working_revision_id IN (SELECT working_revision_id FROM finance_working_revisions WHERE business_version_id = ?)`,
          [bvId]
        )
      );
      expect(snapshots.length).toBe(0);
    });

    it('GET /compute/jobs/:id — org B reading org A job -> 404, SQL confirms job untouched', async () => {
      const artifact = await request(appA)
        .post('/api/v8/finance-v2/artifacts')
        .send({ artifactType: 'BASELINE_MODEL' });
      const artifactId = artifact.body.data.artifactId;
      const engineManifestId = await legacyUnknownManifestId();

      const enqueueRes = await request(appA)
        .post('/api/v8/finance-v2/compute/jobs')
        .set('Idempotency-Key', `xt-${randomUUID()}`)
        .send({
          jobType: 'BASELINE_COMPUTE',
          inputArtifactId: artifactId,
          inputRevisionHash: 'xh',
          engineManifestId,
        });
      const jobId = enqueueRes.body.data.jobId;

      const crossGet = await request(appB).get(`/api/v8/finance-v2/compute/jobs/${jobId}`);
      expect(crossGet.status).toBe(404);

      const row = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ status: string; organization_id: string }>(
          `SELECT status, organization_id FROM compute_jobs WHERE id = ?`,
          [jobId]
        )
      );
      expect(row?.status).toBe('queued');
      expect(row?.organization_id).toBe(orgA);
    });

    it('POST /compute/jobs/:id/cancel — org B cancelling org A job -> 404, SQL confirms job still queued (not cancelled)', async () => {
      const artifact = await request(appA)
        .post('/api/v8/finance-v2/artifacts')
        .send({ artifactType: 'BASELINE_MODEL' });
      const artifactId = artifact.body.data.artifactId;
      const engineManifestId = await legacyUnknownManifestId();

      const enqueueRes = await request(appA)
        .post('/api/v8/finance-v2/compute/jobs')
        .set('Idempotency-Key', `xt-cancel-${randomUUID()}`)
        .send({
          jobType: 'BASELINE_COMPUTE',
          inputArtifactId: artifactId,
          inputRevisionHash: 'xh2',
          engineManifestId,
        });
      const jobId = enqueueRes.body.data.jobId;

      const crossCancel = await request(appB)
        .post(`/api/v8/finance-v2/compute/jobs/${jobId}/cancel`)
        .send({ reason: 'malicious cross-tenant cancel' });
      expect(crossCancel.status).toBe(404);

      // This is the exact "UPDATE 0 looks like PASS" trap the brief warns
      // about: a naive `UPDATE ... WHERE id=? AND organization_id=?` returning
      // zero rows must NOT be reported as success anywhere in the stack. Prove
      // it independently: the job must still be cancellable by its real owner.
      const row = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ status: string }>(`SELECT status FROM compute_jobs WHERE id = ?`, [jobId])
      );
      expect(row?.status).toBe('queued');

      const legitCancel = await request(appA)
        .post(`/api/v8/finance-v2/compute/jobs/${jobId}/cancel`)
        .send({ reason: 'real owner cancel' });
      expect(legitCancel.status).toBe(200);
      expect(legitCancel.body.data.status).toBe('cancelled');
    });

    it("POST /compute/jobs — org B cannot enqueue a job against org A's artifact -> 404 typed error, not a raw 500 (FK requires (artifact_id, organization_id) match)", async () => {
      const artifact = await request(appA)
        .post('/api/v8/finance-v2/artifacts')
        .send({ artifactType: 'BASELINE_MODEL' });
      const artifactId = artifact.body.data.artifactId;
      const engineManifestId = await legacyUnknownManifestId();

      // org B's enqueue attempt references org A's artifactId while
      // authenticated as org B -> the composite FK
      // fk_compute_jobs_artifact_org(input_artifact_id, organization_id) has no
      // matching row (artifactId, orgB), so the INSERT is rejected at the DB
      // level. Gate E FIX-B (LUKA 3, 2026-08-12): computeJobService.ts's
      // enqueue() now catches exactly this FK violation and throws a typed
      // ComputeJobArtifactMismatchError; compute.routes.ts maps it to the same
      // 404 shape every other tenant-scoped denial in this router already
      // returns — no more raw, unhandled 500.
      const res = await request(appB)
        .post('/api/v8/finance-v2/compute/jobs')
        .set('Idempotency-Key', `xt-enqueue-${randomUUID()}`)
        .send({
          jobType: 'BASELINE_COMPUTE',
          inputArtifactId: artifactId,
          inputRevisionHash: 'xh3',
          engineManifestId,
        });

      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('code', 'ARTIFACT_NOT_FOUND');

      const rows = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ id: string }>(
          `SELECT id FROM compute_jobs WHERE input_artifact_id = ? AND organization_id = ?`,
          [artifactId, orgB]
        )
      );
      expect(rows.length).toBe(0);
    });
  }
);
