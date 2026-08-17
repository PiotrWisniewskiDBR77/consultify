/** @vitest-environment node */
/**
 * CLAUDE-NEXT-LEGACY-CUTOVER — MATERIALS domain (presentations mount).
 *
 * Pins the guard composed with the REAL `presentations.routes.ts` router
 * (server/src/Gateway.ts:1172 mounts it at `/api/presentations`), exactly as
 * `financeSecondDoor.pg.test.ts` does for the finance-modeling mount: the
 * router file itself is never edited or mocked, only wrapped.
 *
 * Two writers are exercised against a deck id that does not exist, on
 * purpose: MATERIALS-W05 (`DELETE /decks/:id`) and MATERIALS-W03
 * (`PUT /decks/:deckId/autosave`) both 404 on a missing deck without needing
 * any deck fixture (deck_json, cards, ...) — the point of these tests is
 * "the guard does not refuse", not "the business logic succeeds", so a plain
 * 404 from the real handler is exactly the proof required: the request
 * reached the router.
 */
import { randomUUID } from 'node:crypto';
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createLegacyCutoverGuard } from '../legacyCutoverKernel.js';
import { MATERIALS_PRESENTATIONS_CUTOVER } from '../registry/materials.js';

const CONNECTION_STRING = process.env.DATABASE_URL || '';
const REAL_PG =
  process.env.RUN_DB_TESTS === '1' &&
  process.env.MOCK_DB === 'false' &&
  /^postgres/.test(CONNECTION_STRING) &&
  /localhost|127\.0\.0\.1/.test(CONNECTION_STRING);

process.env.NODE_ENV = 'test';
process.env.DB_TYPE = 'postgres';
// presentations.routes.ts calls the real verifyToken middleware internally
// (`router.use(verifyToken)` at presentations.routes.ts:1160). No bearer
// token is sent here, so without the bypass every call would 401 before
// reaching the leaf handler and this suite would only prove the guard runs
// ahead of authentication, not that the writer itself stays reachable.
process.env.ENABLE_TEST_AUTH_BYPASS = 'true';

const prefix = `mat-${randomUUID().slice(0, 8)}`;
const orgA = `${prefix}-org-a`;
const orgB = `${prefix}-org-b`;
const user = `${prefix}-user`;
const missingDeckId = `${prefix}-deck-missing`;

describe.skipIf(!REAL_PG)('Materials (presentations mount) cutover guard (fresh real PostgreSQL)', () => {
  let pool: Pool;
  let app: express.Express;

  // Tenant is chosen per-request via `x-test-org` so the SAME app can prove
  // tenant isolation without standing up two express apps.
  function authenticate(req: any, _res: any, next: any): void {
    const organizationId = String(req.headers['x-test-org'] || orgA);
    req.user = { id: user, organizationId, role: 'ADMIN' };
    req.userId = user;
    req.organizationId = organizationId;
    req.v8Context = { organizationId, userId: user, userRole: 'ADMIN' };
    next();
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: CONNECTION_STRING });
    const now = new Date().toISOString();
    for (const orgId of [orgA, orgB]) {
      await pool.query(
        `INSERT INTO organizations(id,name,plan,status,is_active,created_at)
         VALUES($1,$2,'enterprise','active',1,$3) ON CONFLICT (id) DO NOTHING`,
        [orgId, orgId, now]
      );
    }

    const presentationsRouter = (await import('../../../routes/presentations.routes.js')).default;
    app = express();
    app.use(express.json());
    app.use(authenticate);
    // Composed exactly as server/src/Gateway.ts:1172 mounts it: the guard
    // sits between authentication and the frozen router, so the router file
    // itself is never edited.
    app.use(
      '/api/presentations',
      createLegacyCutoverGuard(MATERIALS_PRESENTATIONS_CUTOVER),
      presentationsRouter
    );
    app.use((err: any, _req: any, res: any, _next: any) =>
      res.status(500).json({ error: String(err?.message || err) })
    );
  }, 90_000);

  afterAll(async () => {
    if (!pool) return;
    await pool.query(`DELETE FROM legacy_cutover_usage_events WHERE organization_id = ANY($1)`, [
      [orgA, orgB],
    ]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [[orgA, orgB]]);
    await pool.end();
  });

  it('registers the export writers as observed with no successor route, not disabled', () => {
    const w06 = MATERIALS_PRESENTATIONS_CUTOVER.writers.find((w) => w.writerId === 'MATERIALS-W06');
    const w07 = MATERIALS_PRESENTATIONS_CUTOVER.writers.find((w) => w.writerId === 'MATERIALS-W07');
    const w08 = MATERIALS_PRESENTATIONS_CUTOVER.writers.find((w) => w.writerId === 'MATERIALS-W08');
    for (const writer of [w06, w07, w08]) {
      expect(writer?.state).toBe('observed');
      expect(writer?.successor).toBeNull();
    }
    // Nothing in this domain config is disabled — the lane rule for a
    // telemetry-only rollout.
    expect(MATERIALS_PRESENTATIONS_CUTOVER.writers.every((w) => w.state !== 'disabled')).toBe(true);
  });

  it('does not block DELETE /decks/:id (MATERIALS-W05) on a missing deck', async () => {
    const response = await request(app)
      .delete(`/api/presentations/decks/${missingDeckId}`)
      .set('x-test-org', orgA)
      .set('x-request-id', `${prefix}-w05-delete`)
      .send();

    // The point: the guard must not have refused. The real handler's 404 for
    // a deck that does not exist proves the request reached it.
    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
    expect(response.status).toBe(404);

    const rows = await pool.query(
      `SELECT writer_id, access_kind, route_path, organization_id, tenant_resolution,
              legacy_table, legacy_id, identity_status, successor_path,
              canonical_artifact_id, canonical_business_version_id, canonical_working_revision_id
         FROM legacy_cutover_usage_events
        WHERE organization_id = $1 AND request_id = $2`,
      [orgA, `${prefix}-w05-delete`]
    );
    expect(rows.rows).toEqual([
      {
        writer_id: 'MATERIALS-W05',
        access_kind: 'legacy_uncovered_writer',
        route_path: `/api/presentations/decks/${missingDeckId}`,
        organization_id: orgA,
        tenant_resolution: 'resolved',
        legacy_table: 'presentation_decks',
        legacy_id: missingDeckId,
        // 'materials' has no entry in DOMAIN_IDENTITY_REGISTRIES, so identity
        // resolution is honestly not_applicable rather than a fabricated
        // resolved/not_migrated guess.
        identity_status: 'not_applicable',
        successor_path: null,
        canonical_artifact_id: null,
        canonical_business_version_id: null,
        canonical_working_revision_id: null,
      },
    ]);
  });

  it('does not block PUT /decks/:deckId/autosave (MATERIALS-W03) on a missing deck', async () => {
    const response = await request(app)
      .put(`/api/presentations/decks/${missingDeckId}/autosave`)
      .set('x-test-org', orgA)
      .set('x-request-id', `${prefix}-w03-autosave`)
      .send({ title: 'irrelevant' });

    expect(response.status).not.toBe(410);
    expect(response.status).not.toBe(409);
    expect(response.status).toBe(404);

    const rows = await pool.query(
      `SELECT writer_id, access_kind, route_path
         FROM legacy_cutover_usage_events
        WHERE organization_id = $1 AND request_id = $2`,
      [orgA, `${prefix}-w03-autosave`]
    );
    expect(rows.rows).toEqual([
      {
        writer_id: 'MATERIALS-W03',
        access_kind: 'legacy_uncovered_writer',
        route_path: `/api/presentations/decks/${missingDeckId}/autosave`,
      },
    ]);
  });

  it('idempotency: a retried x-request-id records exactly one row', async () => {
    const requestId = `${prefix}-w05-idem`;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await request(app)
        .delete(`/api/presentations/decks/${missingDeckId}-idem`)
        .set('x-test-org', orgA)
        .set('x-request-id', requestId)
        .send();
      expect(response.status).not.toBe(410);
      expect(response.status).not.toBe(409);
    }

    const rows = await pool.query(
      `SELECT COUNT(*)::int AS count FROM legacy_cutover_usage_events
        WHERE organization_id = $1 AND request_id = $2`,
      [orgA, requestId]
    );
    expect(rows.rows[0].count).toBe(1);
  });

  it('tenant isolation: two tenants sharing one x-request-id each get their own row', async () => {
    const sharedRequestId = `${prefix}-w05-shared`;
    const deckPath = `/api/presentations/decks/${missingDeckId}-shared`;

    const responseA = await request(app)
      .delete(deckPath)
      .set('x-test-org', orgA)
      .set('x-request-id', sharedRequestId)
      .send();
    const responseB = await request(app)
      .delete(deckPath)
      .set('x-test-org', orgB)
      .set('x-request-id', sharedRequestId)
      .send();

    expect(responseA.status).not.toBe(410);
    expect(responseA.status).not.toBe(409);
    expect(responseB.status).not.toBe(410);
    expect(responseB.status).not.toBe(409);

    const rows = await pool.query(
      `SELECT organization_id, tenant_resolution FROM legacy_cutover_usage_events
        WHERE request_id = $1 AND organization_id = ANY($2)
        ORDER BY organization_id`,
      [sharedRequestId, [orgA, orgB]]
    );
    expect(rows.rows).toEqual([
      { organization_id: orgA, tenant_resolution: 'resolved' },
      { organization_id: orgB, tenant_resolution: 'resolved' },
    ]);
  });
});
