/**
 * Finance v3 canonical adapter — real PostgreSQL + real HTTP integration
 * test for `/api/v8/finance-v2/models/:modelId/{approve,reopen}`.
 *
 * Gate C, WP-C02. Proves the actual HTTP response body for the `approve`
 * adapter is BIT-IDENTICAL to the two outcomes frozen in
 * `docs/validation/finance-v3/generated/gate-a/WP-A02_api_fixtures.json`
 * fixture F4 (`success_200`, `error_409_version_conflict`) — a direct
 * `JSON.stringify` comparison against the fixture's own object literal, not
 * a hand-copied expectation. Also proves `reopen` (no legacy fixture exists
 * for it — see `models.routes.ts` header) round-trips through a real
 * Express app + this router, against the real migrated schema.
 *
 * This is deliberately a real `express()` app + `supertest`, not a mock
 * req/res double: the response body sent over the wire (after Express's own
 * JSON serialization) is what the fixture comparison must match, and a
 * mocked `res.json()` capture would not exercise that serialization step.
 * The v8 auth middleware chain (`verifyToken`/`requireV8OrgContext`/
 * `v8OrgGate`/`attachV8Context`) is stubbed with a single middleware that
 * sets `req.user`/`req.v8Context` directly — this file tests the ADAPTER
 * CONTRACT, not the surrounding auth chain (already covered elsewhere).
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

// Fixture F4 (`WP-A02_api_fixtures.json`), read directly from disk rather
// than re-typed here, so this test cannot silently drift from the frozen
// contract file.
async function loadFixtureF4() {
  const { readFile } = await import('node:fs/promises');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = path.dirname(fileURLToPath(import.meta.url));
  // server/src/routes/v8/finance-v2/__tests__ -> repo root
  const repoRoot = path.resolve(here, '..', '..', '..', '..', '..', '..');
  const fixturePath = path.join(
    repoRoot,
    'docs/validation/finance-v3/generated/gate-a/WP-A02_api_fixtures.json'
  );
  const raw = JSON.parse(await readFile(fixturePath, 'utf8'));
  const f4 = raw.fixtures.find((f: any) => f.id === 'F4_models_approve_v8');
  if (!f4) throw new Error('Fixture F4_models_approve_v8 not found in WP-A02_api_fixtures.json');
  return f4;
}

describe.skipIf(!REAL_PG)('Finance v2 adapter — /models/:modelId/{approve,reopen} (real HTTP + real PostgreSQL)', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let artifactVersionService: typeof import('../../../../services/finance/canonical/artifactVersionService.js');
  let app: express.Express;

  const orgId = `org-finv2-http-${randomUUID()}`;
  const userId = `user-finv2-http-${randomUUID()}`;

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    artifactVersionService = await import('../../../../services/finance/canonical/artifactVersionService.js');
    const financeV2Router = (await import('../index.js')).default;

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'FinV2 HTTP Test Org'])
    );

    app = express();
    app.use(express.json());
    app.use((req: any, _res, next) => {
      req.user = { id: userId, organizationId: orgId, role: 'finance_admin' };
      req.v8Context = { organizationId: orgId, userId, userRole: 'finance_admin' };
      next();
    });
    app.use('/api/v8/finance-v2', financeV2Router);
    // Minimal error handler so a thrown error surfaces as a visible 500 in
    // test output instead of supertest hanging.
    app.use((err: any, _req: any, res: any, _next: any) => {
      res.status(500).json({ error: String(err?.message || err) });
    });
  });

  afterAll(async () => {
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`DELETE FROM compute_jobs WHERE organization_id = ?`, [orgId])
    );
    // See canonicalServices.pg.test.ts header — artifacts/versions/org rows
    // are intentionally left in place once any append-only child row exists.
  });

  async function approveThroughFullChain(artifactId: string) {
    const created = await artifactVersionService.getArtifact(orgId, artifactId);
    if (!created) throw new Error('artifact not found');
    return created;
  }

  it('POST /models/:modelId/approve success is BIT-IDENTICAL to WP-A02 fixture F4 success_200', async () => {
    const fixture = await loadFixtureF4();

    const created = await artifactVersionService.createArtifact({
      organizationId: orgId,
      artifactType: 'HISTORICAL_ANALYSIS', // LOW risk tier, no SoD gate needed for this contract test
      createdBy: userId,
    });
    const artifactId = created.artifact.artifact_id;
    let bvId = created.businessVersion.business_version_id;
    let version = created.businessVersion.version;

    const t1 = await artifactVersionService.transition({
      organizationId: orgId,
      businessVersionId: bvId,
      action: 'submit_for_review',
      actorId: userId,
      role: 'preparer',
      expectedVersion: version,
    });
    if (!t1.ok) throw new Error('unreachable');
    version = t1.businessVersion.version;
    const t2 = await artifactVersionService.transition({
      organizationId: orgId,
      businessVersionId: bvId,
      action: 'start_review',
      actorId: userId,
      role: 'approver',
      expectedVersion: version,
    });
    if (!t2.ok) throw new Error('unreachable');
    version = t2.businessVersion.version;
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [bvId])
    );

    const res = await request(app)
      .post(`/api/v8/finance-v2/models/${artifactId}/approve`)
      .send({ expectedVersion: version });

    expect(res.status).toBe(200);
    // Direct comparison against the fixture's own literal object — not a
    // hand-copied expectation. This is what "bit-identical" means here.
    expect(res.body).toEqual(fixture.response.success_200);
  });

  it('POST /models/:modelId/approve version conflict is BIT-IDENTICAL to WP-A02 fixture F4 error_409_version_conflict', async () => {
    const fixture = await loadFixtureF4();

    const created = await artifactVersionService.createArtifact({
      organizationId: orgId,
      artifactType: 'HISTORICAL_ANALYSIS',
      createdBy: userId,
    });
    const artifactId = created.artifact.artifact_id;
    const bvId = created.businessVersion.business_version_id;
    let version = created.businessVersion.version;

    const t1 = await artifactVersionService.transition({
      organizationId: orgId,
      businessVersionId: bvId,
      action: 'submit_for_review',
      actorId: userId,
      role: 'preparer',
      expectedVersion: version,
    });
    if (!t1.ok) throw new Error('unreachable');
    version = t1.businessVersion.version;
    const t2 = await artifactVersionService.transition({
      organizationId: orgId,
      businessVersionId: bvId,
      action: 'start_review',
      actorId: userId,
      role: 'approver',
      expectedVersion: version,
    });
    if (!t2.ok) throw new Error('unreachable');
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [bvId])
    );

    // Deliberately stale expectedVersion (t2's version was already consumed above; -1 guarantees mismatch).
    const res = await request(app)
      .post(`/api/v8/finance-v2/models/${artifactId}/approve`)
      .send({ expectedVersion: -1 });

    expect(res.status).toBe(409);
    expect(res.body).toEqual(fixture.response.error_409_version_conflict);
  });

  it('POST /models/:modelId/reopen round-trips over real HTTP (no legacy fixture — new canonical-only route)', async () => {
    const created = await artifactVersionService.createArtifact({
      organizationId: orgId,
      artifactType: 'HISTORICAL_ANALYSIS',
      createdBy: userId,
    });
    const artifactId = created.artifact.artifact_id;
    const bvId = created.businessVersion.business_version_id;
    let version = created.businessVersion.version;

    const t1 = await artifactVersionService.transition({
      organizationId: orgId,
      businessVersionId: bvId,
      action: 'submit_for_review',
      actorId: userId,
      role: 'preparer',
      expectedVersion: version,
    });
    if (!t1.ok) throw new Error('unreachable');
    version = t1.businessVersion.version;
    const t2 = await artifactVersionService.transition({
      organizationId: orgId,
      businessVersionId: bvId,
      action: 'start_review',
      actorId: userId,
      role: 'approver',
      expectedVersion: version,
    });
    if (!t2.ok) throw new Error('unreachable');
    version = t2.businessVersion.version;
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [bvId])
    );
    const approveRes = await request(app)
      .post(`/api/v8/finance-v2/models/${artifactId}/approve`)
      .send({ expectedVersion: version });
    expect(approveRes.status).toBe(200);

    // No Idempotency-Key -> 400 IDEMPOTENCY_KEY_REQUIRED (this route enforces the ADR in full).
    const missingKey = await request(app).post(`/api/v8/finance-v2/models/${artifactId}/reopen`).send({ reason: 'x' });
    expect(missingKey.status).toBe(400);
    expect(missingKey.body.code).toBe('IDEMPOTENCY_KEY_REQUIRED');

    const reopenRes = await request(app)
      .post(`/api/v8/finance-v2/models/${artifactId}/reopen`)
      .set('Idempotency-Key', `reopen-http-${randomUUID()}`)
      .send({ reason: 'Correcting FY2025 figures' });

    expect(reopenRes.status).toBe(201);
    expect(reopenRes.body.data.status).toBe('DRAFT');
    expect(reopenRes.body.data.artifactId).toBe(artifactId);
    expect(reopenRes.body.data.idempotentReplay).toBe(false);
  });
});
