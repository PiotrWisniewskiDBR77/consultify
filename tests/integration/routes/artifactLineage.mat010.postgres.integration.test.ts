/** @vitest-environment node */

/**
 * MAT-010 — canonical artifact lineage receipts, against a REAL Postgres.
 *
 * Boots the real production `artifactLineage.routes.ts` and `workbook.routes.ts`
 * routers against whatever `DATABASE_URL` points at, so the golden flow is
 * proven through the actual HTTP surface plus the actual lineage hooks embedded
 * in the frozen Workbook routes.
 *
 * EVERY assertion that matters is made against REAL DB STATE read back through
 * a separate `pg.Pool`, not against HTTP status codes alone — this repo's
 * institutional lesson is that status-only checks are blind to the
 * "applied, then errored" class of bug.
 *
 * REQUIRES `NODE_ENV=test RUN_DB_TESTS=1` with `DATABASE_URL` pointed at a real,
 * migrated Postgres. `NODE_ENV=test` WITHOUT `RUN_DB_TESTS=1` silently swaps in
 * a mock DB (see `server/src/database/Database.ts`) and this entire suite would
 * pass against nothing. Run:
 *
 *   DATABASE_URL=postgresql://consultinity:consultinity@localhost:28777/consultinity \
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 \
 *   npx vitest run --retry=0 \
 *     tests/integration/routes/artifactLineage.mat010.postgres.integration.test.ts
 *
 * `--retry=0` is deliberate (institutional memory: `retry: 1` hides fixture
 * collisions and makes race tests lie).
 */
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// vi.mock calls are hoisted to the top of the module by vitest.
vi.mock('../../../server/src/middleware/auth.middleware.js', () => ({
  verifyToken: (req: any, res: any, next: () => void) => {
    const orgId = req.headers['x-test-org-id'];
    const userId = req.headers['x-test-user-id'];
    if (req.headers['x-test-unauth'] === '1' || !orgId || !userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.userId = userId;
    req.organizationId = orgId;
    req.user = { id: userId, organizationId: orgId, role: 'admin' };
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

// The artifact-run registry is a different subsystem; MAT-010 resolves the
// canonical artifact id by reading `v8_artifact_origin_links` DIRECTLY, and the
// tests below insert REAL rows into that table to prove resolution works.
vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: vi.fn().mockResolvedValue(null),
  adoptRunArtifactForWorkbook: vi.fn().mockResolvedValue(null),
  getArtifactRun: vi.fn().mockResolvedValue(null),
  mapPresentationStatusToDeliveryState: vi.fn().mockReturnValue('draft'),
  deriveArtifactVisibilityScope: vi.fn().mockReturnValue('private'),
}));

const SUFFIX = uuidv4().slice(0, 8);
const ORG_A = `org-mat010-a-${SUFFIX}`;
const ORG_B = `org-mat010-b-${SUFFIX}`;
const USER_A = `user-mat010-a-${SUFFIX}`;
const USER_B = `user-mat010-b-${SUFFIX}`;

function authHeaders(orgId: string, userId: string) {
  return { 'x-test-org-id': orgId, 'x-test-user-id': userId };
}

describe('MAT-010 — canonical artifact lineage receipts (real Postgres)', () => {
  let app: express.Express;
  let pool: Pool;
  let lineageService: typeof import('../../../server/src/services/lineage/artifactLineageService.js');
  const createdWorkbookIds: string[] = [];
  const createdReceiptOrgs: string[] = [ORG_A, ORG_B];

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || process.env.RUN_DB_TESTS !== '1') {
      throw new Error(
        'This suite requires NODE_ENV=test RUN_DB_TESTS=1 with DATABASE_URL pointed at a real, migrated Postgres.'
      );
    }
    const { default: workbookRoutes } = await import(
      '../../../server/src/routes/workbook.routes.js'
    );
    const { default: lineageRoutes } = await import(
      '../../../server/src/routes/artifactLineage.routes.js'
    );
    lineageService = await import(
      '../../../server/src/services/lineage/artifactLineageService.js'
    );

    app = express();
    app.use(express.json());
    app.use('/api/workbook', workbookRoutes);
    app.use('/api/artifact-lineage', lineageRoutes);

    pool = new Pool({ connectionString: process.env.DATABASE_URL });
  });

  afterAll(async () => {
    // Hygiene (CLAUDE.md): probes clean up after themselves, zero test records.
    if (createdWorkbookIds.length) {
      await pool.query(`DELETE FROM generated_workbook_versions WHERE workbook_id = ANY($1)`, [
        createdWorkbookIds,
      ]);
      await pool.query(`DELETE FROM generated_workbooks WHERE id = ANY($1)`, [createdWorkbookIds]);
      await pool.query(`DELETE FROM v8_artifact_origin_links WHERE origin_record_id = ANY($1)`, [
        createdWorkbookIds,
      ]);
    }
    await pool.query(
      `DELETE FROM artifact_lineage_pending_events WHERE organization_id = ANY($1)`,
      [createdReceiptOrgs]
    );
    await pool.query(
      `DELETE FROM artifact_lineage_events WHERE organization_id = ANY($1)`,
      [createdReceiptOrgs]
    );
    await pool.query(
      `DELETE FROM artifact_lineage_receipts WHERE organization_id = ANY($1)`,
      [createdReceiptOrgs]
    );
    await pool.end();
  });

  // ── DB read-back helpers (real state, never HTTP echoes) ────────────────
  async function dbReceipts(orgId: string, sourceRecordId: string) {
    const r = await pool.query(
      `SELECT * FROM artifact_lineage_receipts
        WHERE organization_id = $1 AND source_record_id = $2`,
      [orgId, sourceRecordId]
    );
    return r.rows;
  }

  async function dbEvents(receiptId: string) {
    const r = await pool.query(
      `SELECT * FROM artifact_lineage_events WHERE receipt_id = $1 ORDER BY sequence_no ASC`,
      [receiptId]
    );
    return r.rows;
  }

  /** The durable outbox, read straight from Postgres. */
  async function dbPending(orgId: string, sourceRecordId: string) {
    const r = await pool.query(
      `SELECT * FROM artifact_lineage_pending_events
        WHERE organization_id = $1 AND source_record_id = $2
        ORDER BY created_at ASC`,
      [orgId, sourceRecordId]
    );
    return r.rows;
  }

  async function createBlankWorkbook(orgId: string, userId: string, title: string) {
    const res = await request(app)
      .post('/api/workbook/blank')
      .set(authHeaders(orgId, userId))
      .send({ title })
      .expect(201);
    createdWorkbookIds.push(res.body.id);
    return res.body.id as string;
  }

  /** Inserts a REAL origin link, the same row shape `registerArtifactOrigin`
   *  writes, so canonical-id resolution is exercised against real data. */
  async function linkCanonicalArtifact(
    orgId: string,
    workbookId: string,
    artifactId: string
  ) {
    await pool.query(
      `INSERT INTO v8_artifact_origin_links
         (link_id, artifact_id, organization_id, origin_runtime, origin_record_id, is_primary_origin, created_at)
       VALUES ($1, $2, $3, 'sheet', $4, 1, NOW())`,
      [uuidv4(), artifactId, orgId, workbookId]
    );
  }

  // =====================================================================
  // GOLDEN FLOW
  // =====================================================================
  // MAT-010 review round: this test chains 9+ real sequential HTTP round-trips
  // through the real Express app (create -> version -> checkpoint -> export ->
  // share -> public-open -> revoke -> public-read -> trace-read), each doing
  // real Postgres I/O. The suite's default 10s testTimeout (server/vitest.config.ts)
  // is too tight on a loaded host — measured ~16s on independent re-run,
  // producing a false-negative timeout with the flow itself fully correct
  // (re-ran with a longer timeout: passes). Scoped to just this one slow,
  // legitimately-multi-step test rather than raising the suite-wide default.
  it('golden flow: create -> receipt -> version -> checkpoint -> export -> share -> public open -> revoke -> public 404 -> owner reopens with same artifactId and complete lineage', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Golden Flow');

    // (1) CREATE — the receipt must exist in the DB immediately, from the hook.
    let receipts = await dbReceipts(ORG_A, id);
    expect(receipts).toHaveLength(1);
    const receiptId = receipts[0].receipt_id;
    expect(receipts[0].artifact_kind).toBe('workbook');
    expect(receipts[0].origin_runtime).toBe('sheet');
    expect(JSON.parse(receipts[0].source_context_json).source).toBe('workbook_blank_manual');

    // The registry mock returns null, so no canonical id yet — exactly the
    // degraded case the design anticipates. Register the link for real now and
    // prove it gets backfilled rather than lost.
    expect(receipts[0].canonical_artifact_id).toBeNull();
    const canonicalArtifactId = `artifact-mat010-${SUFFIX}`;
    await linkCanonicalArtifact(ORG_A, id, canonicalArtifactId);

    // (2) VERSION — edit a cell.
    const v = await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 21 })
      .expect(200);
    expect(v.body.version).toBe(2);

    // (3) CHECKPOINT
    await request(app)
      .post(`/api/workbook/${id}/checkpoint`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ expectedVersion: 2 })
      .expect(200);

    // (4) EXPORT (csv)
    await request(app)
      .get(`/api/workbook/${id}/export/csv?sheetIndex=0`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);

    // (5) SHARE
    const share = await request(app)
      .post(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_A, USER_A))
      .send({})
      .expect(200);
    const token = share.body.shareToken as string;
    expect(typeof token).toBe('string');

    // (6) PUBLIC OPEN — unauthenticated, no auth headers at all.
    await request(app).get(`/api/workbook/shared/${token}`).expect(200);

    // (7) REVOKE
    await request(app)
      .delete(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);

    // (8) PUBLIC READ NOW 404
    await request(app).get(`/api/workbook/shared/${token}`).expect(404);

    // (9) OWNER REOPENS — the canonical read API. Same artifact id, and the
    // full lineage, from ONE place.
    const trace = await request(app)
      .get(`/api/artifact-lineage/workbook/${id}`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);

    const receipt = trace.body.receipt;
    expect(receipt.sourceRecordId).toBe(id); // same artifact id throughout
    expect(receipt.artifactKind).toBe('workbook');
    // Canonical id was absent at creation and lazily backfilled on read.
    expect(receipt.canonicalArtifactId).toBe(canonicalArtifactId);

    const types = receipt.events.map((e: any) => e.eventType);
    expect(types).toEqual([
      'created',
      'version',
      'checkpoint',
      'export',
      'share_minted',
      'public_open',
      'share_revoked',
    ]);

    // Sequence numbers are dense and strictly increasing.
    expect(receipt.events.map((e: any) => e.sequenceNo)).toEqual([1, 2, 3, 4, 5, 6, 7]);

    // The public_open event has NO actor (unauthenticated), every other one does.
    const publicOpen = receipt.events.find((e: any) => e.eventType === 'public_open');
    expect(publicOpen.actorUserId).toBeNull();
    expect(receipt.events.find((e: any) => e.eventType === 'created').actorUserId).toBe(USER_A);

    // The raw share token must NEVER appear in the lineage — only a hash.
    const shareEvent = receipt.events.find((e: any) => e.eventType === 'share_minted');
    expect(shareEvent.detail.shareTokenHash).toBeTruthy();
    expect(JSON.stringify(receipt.events)).not.toContain(token);

    // Real DB state confirms the same, and that the backfill was PERSISTED
    // (not merely computed for the response).
    receipts = await dbReceipts(ORG_A, id);
    expect(receipts).toHaveLength(1);
    expect(receipts[0].canonical_artifact_id).toBe(canonicalArtifactId);
    expect(Number(receipts[0].event_count)).toBe(7);
    expect(await dbEvents(receiptId)).toHaveLength(7);
  }, 30000);

  // =====================================================================
  // NEGATIVE CONTROL 1 — retry / idempotency
  // =====================================================================
  it('NEGATIVE CONTROL — a retried event with the same idempotencyKey is recorded ONCE (real row count)', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Retry');
    const receiptId = (await dbReceipts(ORG_A, id))[0].receipt_id;
    const before = (await dbEvents(receiptId)).length;

    const key = `idem-${uuidv4()}`;
    const first = await request(app)
      .post(`/api/artifact-lineage/workbook/${id}/events`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ eventType: 'export', idempotencyKey: key, detail: { format: 'pdf' } })
      .expect(201);
    expect(first.body.deduped).toBe(false);

    // Same call again — the network-retry case.
    const retry = await request(app)
      .post(`/api/artifact-lineage/workbook/${id}/events`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ eventType: 'export', idempotencyKey: key, detail: { format: 'pdf' } })
      .expect(200);
    expect(retry.body.deduped).toBe(true);
    expect(retry.body.eventId).toBe(first.body.eventId);

    // PROVES: exactly one row landed. Without the (receipt_id, idempotency_key)
    // unique index + pre-insert lookup, this would be `before + 2`.
    const after = await dbEvents(receiptId);
    expect(after.length).toBe(before + 1);
    expect(after.filter((e) => e.idempotency_key === key)).toHaveLength(1);
  });

  // =====================================================================
  // NEGATIVE CONTROL 2 — concurrency / no duplicate receipts
  // =====================================================================
  it('NEGATIVE CONTROL — 16 simultaneous first-events for the same artifact create EXACTLY ONE receipt', async () => {
    // A workbook whose receipt does not exist yet: insert the owner row
    // directly, bypassing the creation hook.
    const id = `wb-race-${uuidv4()}`;
    createdWorkbookIds.push(id);
    await pool.query(
      `INSERT INTO generated_workbooks (id, organization_id, title, schema_json, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      [id, ORG_A, 'MAT-010 Race', JSON.stringify({ title: 'x', sheets: [] }), USER_A]
    );
    expect(await dbReceipts(ORG_A, id)).toHaveLength(0);

    const results = await Promise.all(
      Array.from({ length: 16 }, () =>
        lineageService.recordLineageEvent({
          organizationId: ORG_A,
          artifactKind: 'workbook',
          sourceRecordId: id,
          eventType: 'version',
          actorUserId: USER_A,
        })
      )
    );

    // PROVES: the ON CONFLICT DO NOTHING upsert is real. Without it, the
    // check-then-insert TOCTOU would let several callers each insert their own
    // receipt row (exactly the defect that produced 180 orphaned artifacts in
    // artifactRegistryService — see its root-cause comment).
    const receipts = await dbReceipts(ORG_A, id);
    expect(receipts).toHaveLength(1);

    // Exactly one caller reports having created it.
    expect(results.filter((r) => r.receiptCreated)).toHaveLength(1);
    // All 16 agree on the same receipt.
    expect(new Set(results.map((r) => r.receiptId)).size).toBe(1);

    // All 16 events landed, with dense, collision-free sequence numbers —
    // proving the SELECT ... FOR UPDATE lock serialized the allocation.
    const events = await dbEvents(receipts[0].receipt_id);
    expect(events).toHaveLength(16);
    expect(events.map((e) => Number(e.sequence_no))).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1)
    );
    expect(Number(receipts[0].event_count)).toBe(16);
  });

  // =====================================================================
  // NEGATIVE CONTROL 3 — fault injection / multi-table rollback
  // =====================================================================
  it('NEGATIVE CONTROL — a fault after the event INSERT rolls the whole transaction back (event row and counter both unchanged)', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Fault');
    const receiptRow = (await dbReceipts(ORG_A, id))[0];
    const receiptId = receiptRow.receipt_id;
    const eventsBefore = await dbEvents(receiptId);
    const countBefore = Number(receiptRow.event_count);

    await expect(
      lineageService.recordLineageEvent({
        organizationId: ORG_A,
        artifactKind: 'workbook',
        sourceRecordId: id,
        eventType: 'export',
        actorUserId: USER_A,
        __testFaultAfterEventInsert: true,
      })
    ).rejects.toThrow(/injected fault/i);

    // PROVES the "applied, then errored" case — the blind spot this repo's
    // memory flags. The event INSERT genuinely SUCCEEDED inside the
    // transaction before the fault; only a real ROLLBACK removes it. A
    // status-code-only assertion would be blind to this.
    const eventsAfter = await dbEvents(receiptId);
    expect(eventsAfter).toHaveLength(eventsBefore.length);

    // ...and the second table of the multi-table write is unchanged too.
    const receiptAfter = (await dbReceipts(ORG_A, id))[0];
    expect(Number(receiptAfter.event_count)).toBe(countBefore);
  });

  // =====================================================================
  // NEGATIVE CONTROL 4 — cross-tenant read denial
  // =====================================================================
  it('NEGATIVE CONTROL — cross-tenant read is 404 and byte-identical to an unknown-id 404 (no existence oracle)', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Tenant');
    // Sanity: the owner CAN read it, so a 404 for org B is really isolation.
    await request(app)
      .get(`/api/artifact-lineage/workbook/${id}`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);

    const crossTenant = await request(app)
      .get(`/api/artifact-lineage/workbook/${id}`)
      .set(authHeaders(ORG_B, USER_B))
      .expect(404);

    const unknownId = await request(app)
      .get(`/api/artifact-lineage/workbook/does-not-exist-${uuidv4()}`)
      .set(authHeaders(ORG_B, USER_B))
      .expect(404);

    const invalidKind = await request(app)
      .get(`/api/artifact-lineage/not-a-kind/${id}`)
      .set(authHeaders(ORG_B, USER_B))
      .expect(404);

    // PROVES: existence of another org's artifact cannot be inferred from the
    // status code OR the error body shape.
    expect(crossTenant.body).toEqual(unknownId.body);
    expect(crossTenant.body).toEqual(invalidKind.body);

    // And the reverse lookup leaks nothing either.
    const canonical = `artifact-xt-${uuidv4()}`;
    await linkCanonicalArtifact(ORG_A, id, canonical);
    await request(app)
      .get(`/api/artifact-lineage/workbook/${id}`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200); // triggers the backfill
    await request(app)
      .get(`/api/artifact-lineage/by-artifact/${canonical}`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    await request(app)
      .get(`/api/artifact-lineage/by-artifact/${canonical}`)
      .set(authHeaders(ORG_B, USER_B))
      .expect(404);
  });

  // =====================================================================
  // NEGATIVE CONTROL 5 — cross-tenant write denial
  // =====================================================================
  it('NEGATIVE CONTROL — org B cannot write lineage against org A\'s artifact, and org A\'s receipt is untouched', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 XT Write');
    const receiptBefore = (await dbReceipts(ORG_A, id))[0];
    const countBefore = Number(receiptBefore.event_count);

    await request(app)
      .post(`/api/artifact-lineage/workbook/${id}/events`)
      .set(authHeaders(ORG_B, USER_B))
      .send({ eventType: 'export', detail: { format: 'pdf' } })
      .expect(404);

    // PROVES two things at once, on REAL DB state:
    //  (a) org A's receipt was not mutated;
    //  (b) no junk receipt was minted in org B's tenant either — without the
    //      ownership gate the write would have succeeded and created one.
    const receiptAfter = (await dbReceipts(ORG_A, id))[0];
    expect(Number(receiptAfter.event_count)).toBe(countBefore);
    expect(await dbReceipts(ORG_B, id)).toHaveLength(0);
  });

  // =====================================================================
  // NEGATIVE CONTROL 6 — unauthenticated + unknown token handling
  // =====================================================================
  it('NEGATIVE CONTROL — unauthenticated reads are 401, and an unknown/revoked share token records NO lineage', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Unknown Token');

    await request(app)
      .get(`/api/artifact-lineage/workbook/${id}`)
      .set({ ...authHeaders(ORG_A, USER_A), 'x-test-unauth': '1' })
      .expect(401);

    const receiptId = (await dbReceipts(ORG_A, id))[0].receipt_id;
    const before = (await dbEvents(receiptId)).length;

    // An unknown token 404s and must not manufacture a public_open anywhere.
    await request(app).get(`/api/workbook/shared/unknown-${uuidv4()}`).expect(404);

    // A revoked token likewise.
    const share = await request(app)
      .post(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_A, USER_A))
      .send({})
      .expect(200);
    await request(app)
      .delete(`/api/workbook/${id}/share`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    await request(app).get(`/api/workbook/shared/${share.body.shareToken}`).expect(404);

    // PROVES the hook sits AFTER the row match: only share_minted +
    // share_revoked were added, never a public_open for a dead token.
    const after = await dbEvents(receiptId);
    expect(after.length).toBe(before + 2);
    expect(after.map((e) => e.event_type)).not.toContain('public_open');
  });

  // =====================================================================
  // NEGATIVE CONTROL 7 — invalid input is rejected before any write
  // =====================================================================
  it('NEGATIVE CONTROL — invalid eventType and client-forged public_open are rejected with no DB write', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Invalid');
    const receiptId = (await dbReceipts(ORG_A, id))[0].receipt_id;
    const before = (await dbEvents(receiptId)).length;

    await request(app)
      .post(`/api/artifact-lineage/workbook/${id}/events`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ eventType: 'definitely_not_valid' })
      .expect(400);

    // A client must not be able to forge public-open history.
    await request(app)
      .post(`/api/artifact-lineage/workbook/${id}/events`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ eventType: 'public_open' })
      .expect(400);

    expect((await dbEvents(receiptId)).length).toBe(before);
  });

  // =====================================================================
  // NEGATIVE CONTROL 8 — session-derived tenancy beats client-supplied
  // =====================================================================
  it('NEGATIVE CONTROL — a client-supplied organizationId/actorUserId in the body is ignored', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Forged Org');

    await request(app)
      .post(`/api/artifact-lineage/workbook/${id}/events`)
      .set(authHeaders(ORG_A, USER_A))
      .send({
        eventType: 'export',
        organizationId: ORG_B, // forged
        actorUserId: USER_B, // forged
        detail: { format: 'pdf' },
      })
      .expect(201);

    // PROVES the write was filed under the SESSION's org/user, not the body's.
    expect(await dbReceipts(ORG_B, id)).toHaveLength(0);
    const receipt = (await dbReceipts(ORG_A, id))[0];
    const events = await dbEvents(receipt.receipt_id);
    const exportEvent = events.find((e) => e.event_type === 'export');
    expect(exportEvent.organization_id).toBe(ORG_A);
    expect(exportEvent.actor_user_id).toBe(USER_A);
  });

  // =====================================================================
  // Multi-type coverage: all three artifact kinds share ONE receipt store
  // =====================================================================
  it('all three artifact kinds (document / workbook / presentation) produce receipts in the same canonical table with correct origin runtimes', async () => {
    const deckId = `deck-mat010-${uuidv4()}`;
    const docId = `artifact-mat010-doc-${uuidv4()}`;

    await lineageService.recordLineageEvent({
      organizationId: ORG_A,
      artifactKind: 'presentation',
      sourceRecordId: deckId,
      eventType: 'created',
      actorUserId: USER_A,
      titleSnapshot: 'MAT-010 Deck',
    });
    await lineageService.recordLineageEvent({
      organizationId: ORG_A,
      artifactKind: 'document',
      sourceRecordId: docId,
      eventType: 'created',
      actorUserId: USER_A,
      titleSnapshot: 'MAT-010 Doc',
    });

    const deckReceipt = (await dbReceipts(ORG_A, deckId))[0];
    const docReceipt = (await dbReceipts(ORG_A, docId))[0];

    // The whole point of MAT-010: one table, one shape, three artifact types.
    expect(deckReceipt.artifact_kind).toBe('presentation');
    expect(deckReceipt.origin_runtime).toBe('presentation');
    expect(docReceipt.artifact_kind).toBe('document');
    // Documents register under 'native_artifact' — matching the real value
    // document-studio.routes.ts already writes, not a tidied-up guess.
    expect(docReceipt.origin_runtime).toBe('native_artifact');

    // And the org-scoped listing surfaces all kinds from the one place.
    const list = await request(app)
      .get('/api/artifact-lineage/receipts')
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    const kinds = new Set(list.body.receipts.map((r: any) => r.artifactKind));
    expect(kinds.has('workbook')).toBe(true);
    expect(kinds.has('presentation')).toBe(true);
    expect(kinds.has('document')).toBe(true);

    // Kind filter is honoured and stays tenant-scoped.
    const onlyDecks = await request(app)
      .get('/api/artifact-lineage/receipts?kind=presentation')
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(onlyDecks.body.receipts.every((r: any) => r.artifactKind === 'presentation')).toBe(true);

    const orgBList = await request(app)
      .get('/api/artifact-lineage/receipts')
      .set(authHeaders(ORG_B, USER_B))
      .expect(200);
    expect(orgBList.body.receipts).toHaveLength(0);
  });

  // =====================================================================
  // Durable read-back (no client cache in the path)
  // =====================================================================
  it('receipt read reflects committed server state on a fresh connection (durable after hard reload)', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Durable');
    await request(app)
      .post(`/api/artifact-lineage/workbook/${id}/events`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ eventType: 'export', detail: { format: 'xlsx' } })
      .expect(201);

    // A brand-new pool = a brand-new connection, i.e. nothing this process
    // cached can satisfy the read. Equivalent to a hard browser reload.
    const freshPool = new Pool({ connectionString: process.env.DATABASE_URL });
    try {
      const r = await freshPool.query(
        `SELECT e.event_type
           FROM artifact_lineage_events e
           JOIN artifact_lineage_receipts rc ON rc.receipt_id = e.receipt_id
          WHERE rc.organization_id = $1 AND rc.source_record_id = $2
          ORDER BY e.sequence_no ASC`,
        [ORG_A, id]
      );
      expect(r.rows.map((x) => x.event_type)).toEqual(['created', 'export']);
    } finally {
      await freshPool.end();
    }
  });

  // =====================================================================
  // NEGATIVE CONTROL 9 — workbookCache cross-tenant leak (Codex blocker 3)
  // =====================================================================
  // REPLACES a previous test that accepted EITHER 200 or 404 and therefore
  // documented the bug instead of blocking it. This version accepts ONLY 404.
  //
  // The leak: `GET /:id/download` and `GET /:id/schema` consulted
  // `workbookCache` — keyed by workbook id ALONE, no organization — BEFORE any
  // ownership check. `requireOrgAccess()` only proves the CALLER has a
  // well-formed org; it does not scope the requested resource.
  //
  // The workbook is created via the real route immediately before the probe,
  // so the entry is GUARANTEED cache-resident (bounded at 50 entries, and this
  // is the freshest). A 200 here could therefore only come from the cache —
  // which is exactly what makes this a real control and not a vacuous one.
  it('NEGATIVE CONTROL — cross-tenant /schema and /download are 404 ONLY (never 200) even with the entry cache-resident', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Cache Tenant Probe');

    // Sanity FIRST: the owner really can read both, so the 404s below are
    // genuine tenant isolation and not a broken fixture.
    const ownerSchema = await request(app)
      .get(`/api/workbook/${id}/schema`)
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(ownerSchema.body.title).toBe('MAT-010 Cache Tenant Probe');

    // THE CONTROL. `.expect(404)` — no 200-or-404 tolerance.
    const xtSchema = await request(app)
      .get(`/api/workbook/${id}/schema`)
      .set(authHeaders(ORG_B, USER_B))
      .expect(404);
    const xtDownload = await request(app)
      .get(`/api/workbook/${id}/download`)
      .set(authHeaders(ORG_B, USER_B))
      .expect(404);

    // Nothing of org A's leaked into either body.
    expect(JSON.stringify(xtSchema.body)).not.toContain('MAT-010 Cache Tenant Probe');
    expect(JSON.stringify(xtDownload.body)).not.toContain('MAT-010 Cache Tenant Probe');

    // No existence oracle: a cross-tenant id and a genuinely unknown id are
    // indistinguishable in status AND body shape.
    const unknownId = `wb-unknown-${uuidv4()}`;
    const unknownSchema = await request(app)
      .get(`/api/workbook/${unknownId}/schema`)
      .set(authHeaders(ORG_B, USER_B))
      .expect(404);
    expect(Object.keys(xtSchema.body).sort()).toEqual(Object.keys(unknownSchema.body).sort());
    expect(xtSchema.body.error).toBe(unknownSchema.body.error);

    // PROVES the second half of the requirement: the denied cross-tenant
    // request recorded NO lineage under the WRONG organization.
    expect(await dbReceipts(ORG_B, id)).toHaveLength(0);
  });

  // =====================================================================
  // NEGATIVE CONTROL 10 — the legitimate owner's cache hit still works
  // =====================================================================
  // Guards against "fixing" the leak by simply disabling the cache, which
  // would be a performance regression rather than a security fix.
  it('same-org cache hit still returns 200 with the right content, and the cache-served export IS recorded in the lineage', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Cache Owner Hit');
    const receiptId = (await dbReceipts(ORG_A, id))[0].receipt_id;
    const before = await dbEvents(receiptId);

    // Cache-resident (just created) — this download is served from the
    // in-memory buffer, not rebuilt from schema_json.
    const dl = await request(app)
      .get(`/api/workbook/${id}/download`)
      .set(authHeaders(ORG_A, USER_A))
      .buffer(true)
      .parse((res, cb) => {
        const chunks: Buffer[] = [];
        res.on('data', (c: Buffer) => chunks.push(Buffer.from(c)));
        res.on('end', () => cb(null, Buffer.concat(chunks)));
      })
      .expect(200);

    // A real .xlsx came back — 'PK' zip magic — not an error body. Proves the
    // owner's fast path was not "fixed" by simply disabling the cache.
    const body = dl.body as Buffer;
    expect(body.length).toBeGreaterThan(0);
    expect(body.subarray(0, 2).toString('latin1')).toBe('PK');
    expect(String(dl.headers['content-disposition'])).toContain('.xlsx');

    // PROVES the lifted constraint: MAT-010 originally skipped the lineage
    // hook on this fast path because the untenanted cache could have filed the
    // export under the wrong org. Now that the entry's org is proven, the
    // cache-served export is recorded — with `servedFrom: 'cache'`.
    const after = await dbEvents(receiptId);
    expect(after.length).toBe(before.length + 1);
    const exportEvent = after[after.length - 1];
    expect(exportEvent.event_type).toBe('export');
    expect(exportEvent.organization_id).toBe(ORG_A);
    expect(JSON.parse(exportEvent.detail_json).servedFrom).toBe('cache');
  });

  // =====================================================================
  // NEGATIVE CONTROL 11 — durable failure -> recovery (Codex blocker 2)
  // =====================================================================
  // The whole point: a lineage write that FAILS must not vanish. Asserts on
  // real DB state at every step, never merely that no exception was thrown.
  it('DURABILITY — a failed lineage write leaves a durable PENDING marker, reconciles to EXACTLY ONE event, and a second reconciliation run does not duplicate it', async () => {
    // Created with lineage healthy, so the receipt exists and the ONLY event
    // under test is the share mint below.
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Durable Recovery');
    const receiptId = (await dbReceipts(ORG_A, id))[0].receipt_id;
    const eventsBefore = await dbEvents(receiptId);
    expect(eventsBefore.map((e) => e.event_type)).toEqual(['created']);

    // (2) Force the DIRECT lineage write to fail. Test-only seam: the setter
    // itself throws outside NODE_ENV==='test', so it is unreachable in prod.
    lineageService.__setLineageDirectWriteFaultForTests(true);

    let shareToken: string;
    try {
      // (1) The business operation must still SUCCEED and return normally.
      const share = await request(app)
        .post(`/api/workbook/${id}/share`)
        .set(authHeaders(ORG_A, USER_A))
        .send({})
        .expect(200);
      shareToken = share.body.shareToken;
      expect(typeof shareToken).toBe('string');
      expect(shareToken.length).toBeGreaterThan(0);
    } finally {
      // (4-prep) Lineage healthy again before reconciling.
      lineageService.__setLineageDirectWriteFaultForTests(false);
    }

    // The direct write really did fail — no share_minted event landed.
    const eventsAfterFault = await dbEvents(receiptId);
    expect(eventsAfterFault.map((e) => e.event_type)).toEqual(['created']);

    // (3) ...but a DURABLE pending marker exists, in Postgres, with the
    // correct stable idempotency key. This is the property the old fail-open
    // implementation could not satisfy: the event was simply gone.
    const pendingRows = await dbPending(ORG_A, id);
    expect(pendingRows).toHaveLength(1);
    const pending = pendingRows[0];
    expect(pending.status).toBe('pending');
    expect(pending.event_type).toBe('share_minted');
    expect(pending.artifact_kind).toBe('workbook');

    expect(pending.idempotency_key).toMatch(/^mat010-pending:[0-9a-f]{32}$/);

    // The key is DETERMINISTIC and RECONSTRUCTABLE, not random: recomputing it
    // from the row's own stored fields reproduces it byte for byte.
    //
    // `occurred_at` is read here via `to_char` — an unambiguous TEXT rendering
    // straight from Postgres — deliberately NOT via node-pg's Date parsing,
    // which interprets a `TIMESTAMP WITHOUT TIME ZONE` in the HOST's local
    // zone and would shift it. This keeps the check independent of the
    // service's own timestamp handling instead of assuming it correct.
    const tsRow = await pool.query(
      `SELECT to_char(occurred_at, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS iso
         FROM artifact_lineage_pending_events WHERE pending_id = $1`,
      [pending.pending_id]
    );
    const recomputed = lineageService.deriveStableIdempotencyKey({
      artifactKind: 'workbook',
      sourceRecordId: id,
      eventType: 'share_minted',
      detail: JSON.parse(pending.detail_json),
      occurredAt: tsRow.rows[0].iso,
    });
    expect(pending.idempotency_key).toBe(recomputed);

    // Deterministic, and occurrence-distinguishing: same inputs -> same key,
    // a different occurrence -> a different key (so two genuinely distinct
    // failures of the same logical event cannot collapse into one).
    expect(
      lineageService.deriveStableIdempotencyKey({
        artifactKind: 'workbook',
        sourceRecordId: id,
        eventType: 'share_minted',
        detail: JSON.parse(pending.detail_json),
        occurredAt: tsRow.rows[0].iso,
      })
    ).toBe(recomputed);
    expect(
      lineageService.deriveStableIdempotencyKey({
        artifactKind: 'workbook',
        sourceRecordId: id,
        eventType: 'share_minted',
        detail: JSON.parse(pending.detail_json),
        occurredAt: '2020-01-01T00:00:00.000Z',
      })
    ).not.toBe(recomputed);

    // (4) RECONCILE.
    const firstRun = await lineageService.reconcilePendingLineageEvents({
      organizationId: ORG_A,
    });
    expect(firstRun.recovered).toBeGreaterThanOrEqual(1);
    expect(firstRun.stillFailing).toBe(0);

    // (5) EXACTLY ONE event now exists — not zero, not two.
    const eventsAfterReconcile = await dbEvents(receiptId);
    const minted = eventsAfterReconcile.filter((e) => e.event_type === 'share_minted');
    expect(minted).toHaveLength(1);
    // The recovered event kept the time the business op really happened,
    // rather than being back-dated to the recovery window.
    expect(new Date(minted[0].occurred_at).getTime()).toBe(
      new Date(pending.occurred_at).getTime()
    );

    // (6) The pending marker is CONSUMED — and kept, not deleted, as an audit
    // trail of "this needed reconciliation".
    const afterFirst = await dbPending(ORG_A, id);
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0].status).toBe('consumed');
    expect(afterFirst[0].consumed_at).not.toBeNull();

    // (7) RECONCILE AGAIN — the retry / re-trigger case.
    const secondRun = await lineageService.reconcilePendingLineageEvents({
      organizationId: ORG_A,
    });
    // (8) Correctly no-ops on the already-closed marker...
    expect(secondRun.recovered).toBe(0);
    expect(secondRun.stillFailing).toBe(0);
    // ...and STILL exactly one event. No duplicate.
    const eventsFinal = await dbEvents(receiptId);
    expect(eventsFinal.filter((e) => e.event_type === 'share_minted')).toHaveLength(1);
    expect(eventsFinal.length).toBe(eventsAfterReconcile.length);

    // Receipt counter agrees with the real event rows (no double-increment).
    const receiptFinal = (await dbReceipts(ORG_A, id))[0];
    expect(Number(receiptFinal.event_count)).toBe(eventsFinal.length);
  });

  // =====================================================================
  // DOUBLE FAILURE — direct write AND the durable pending/outbox write BOTH
  // fail for the SAME operation. This is the contract's hard case: an
  // operation that CREATES an artifact must never leave a state from which
  // lineage can never be reconstructed.
  // =====================================================================
  it('DOUBLE FAILURE (non-create, share_minted) — direct write AND pending write both fail: the route declines unconditional success (Codex review, second round: Option B fail-closed), business mutation still commits, zero durable lineage trace either', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Double Failure Non-Create');
    const receiptId = (await dbReceipts(ORG_A, id))[0].receipt_id;
    expect((await dbEvents(receiptId)).map((e) => e.event_type)).toEqual(['created']);

    lineageService.__setLineageDirectWriteFaultForTests(true);
    lineageService.__setLineagePendingWriteFaultForTests(true);
    try {
      // Codex review (second round): a genuine double failure on a
      // non-create event must NOT report unconditional success — the route
      // now declines with a distinct, honest 500 instead of the normal 200.
      // This is a DELIBERATE behavior change from the first round (which
      // still allowed 200 here); see recordLineageEventTracked's doc
      // comment for why this specific route (single-column token overwrite,
      // not an append) is safe to decline on.
      const share = await request(app)
        .post(`/api/workbook/${id}/share`)
        .set(authHeaders(ORG_A, USER_A))
        .send({})
        .expect(500);
      expect(share.body.code).toBe('LINEAGE_RECOVERY_REQUIRED');
      expect(share.body.shareToken).toBeUndefined();
    } finally {
      lineageService.__setLineageDirectWriteFaultForTests(false);
      lineageService.__setLineagePendingWriteFaultForTests(false);
    }

    // The BUSINESS mutation itself is NOT rolled back — it already committed
    // (pool-autocommit, before the lineage hook runs) and MAT-05/06 must
    // never regress because lineage is unavailable. Only the HTTP response
    // is honest about the missing audit trail.
    const row = await pool.query(
      `SELECT share_token FROM generated_workbooks WHERE id = $1 AND organization_id = $2`,
      [id, ORG_A]
    );
    expect(row.rows[0].share_token).toBeTruthy();

    // And, stated plainly (MAT-010 report G4, unchanged): for a NON-create
    // event, a genuine double failure has no durable trace to recover from —
    // no event, no pending marker. The receipt already existed (from
    // `created`), so the ARTIFACT itself is not lost, only this one
    // downstream event's audit trail — which is exactly why the response is
    // no longer allowed to claim full success.
    expect((await dbEvents(receiptId)).map((e) => e.event_type)).toEqual(['created']);
    expect(await dbPending(ORG_A, id)).toHaveLength(0);
  });

  // =====================================================================
  // Codex review, second round — required real-route coverage for the
  // "export albo version" event type: single-failure recovery (durable
  // pending -> reconcile -> exactly one event -> restart-safe -> idempotent
  // retry) AND the double-failure fail-closed guard, both on `version`.
  // =====================================================================
  it('SINGLE FAILURE (version) — direct write fails, durable pending marker survives, reconciliation produces exactly one `version` event with the correct org/actor/idempotency key, a second reconcile is a no-op, and a client retry of the SAME cell PATCH cannot duplicate the mutation (CAS)', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Version Single Failure');
    const receiptId = (await dbReceipts(ORG_A, id))[0].receipt_id;

    lineageService.__setLineageDirectWriteFaultForTests(true);
    let cellRes: any;
    try {
      cellRes = await request(app)
        .patch(`/api/workbook/${id}/cell`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 21 })
        .expect(200);
    } finally {
      lineageService.__setLineageDirectWriteFaultForTests(false);
    }
    expect(cellRes.body.version).toBe(2);

    // Direct write really failed — only `created` exists so far.
    expect((await dbEvents(receiptId)).map((e) => e.event_type)).toEqual(['created']);

    // Durable pending marker exists, correctly scoped.
    const pendingRows = await dbPending(ORG_A, id);
    expect(pendingRows).toHaveLength(1);
    expect(pendingRows[0].event_type).toBe('version');
    expect(pendingRows[0].organization_id).toBe(ORG_A);

    // "Restart" is simulated the same way every other DURABILITY test in
    // this file simulates it: nothing survives in process memory (the
    // pending row is the only durable state), so calling the reconciliation
    // entry point fresh IS the restart-recovery path.
    const firstReconcile = await lineageService.reconcilePendingLineageEvents({
      organizationId: ORG_A,
    });
    expect(firstReconcile.recovered).toBeGreaterThanOrEqual(1);
    expect(firstReconcile.stillFailing).toBe(0);

    const eventsAfter = await dbEvents(receiptId);
    const versionEvents = eventsAfter.filter((e) => e.event_type === 'version');
    expect(versionEvents).toHaveLength(1);
    expect(versionEvents[0].actor_user_id).toBe(USER_A);
    expect(versionEvents[0].idempotency_key).toBe(pendingRows[0].idempotency_key);

    // Second reconcile: no-op, still exactly one.
    const secondReconcile = await lineageService.reconcilePendingLineageEvents({
      organizationId: ORG_A,
    });
    expect(secondReconcile.recovered).toBe(0);
    expect(
      (await dbEvents(receiptId)).filter((e) => e.event_type === 'version')
    ).toHaveLength(1);

    // Client retry of the SAME PATCH (no expectedVersion supplied, matching
    // the original request) is a NEW logical edit under this route's own
    // semantics — CAS only rejects a STALE `expectedVersion`, which this
    // request never sent. This is a business-layer property this package
    // does not change; asserting it explicitly so the "retry cannot
    // duplicate" claim is honest about what actually gets tested here: with
    // `expectedVersion` supplied and stale, the retry is rejected 409 by the
    // frozen CAS guard (proven by the existing MAT-006 negative control),
    // which is the actual duplication guard this fix relies on.
    const retryWithStaleExpectedVersion = await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 99, expectedVersion: 1 })
      .expect(409);
    expect(retryWithStaleExpectedVersion.body.code).toBe('VERSION_CONFLICT');
  });

  it('DOUBLE FAILURE (version) — direct write AND pending write both fail: the route declines unconditional success, the cell mutation still commits, and a same-expectedVersion retry is rejected 409 rather than double-applying', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Version Double Failure');

    lineageService.__setLineageDirectWriteFaultForTests(true);
    lineageService.__setLineagePendingWriteFaultForTests(true);
    let firstAttempt: any;
    try {
      firstAttempt = await request(app)
        .patch(`/api/workbook/${id}/cell`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 21, expectedVersion: 1 })
        .expect(500);
    } finally {
      lineageService.__setLineageDirectWriteFaultForTests(false);
      lineageService.__setLineagePendingWriteFaultForTests(false);
    }
    expect(firstAttempt.body.code).toBe('LINEAGE_RECOVERY_REQUIRED');

    // The business mutation committed anyway (pool-autocommit, before the
    // lineage hook runs) — bumped to version 2, value written.
    const afterDoubleFailure = await pool.query(
      `SELECT version, schema_json FROM generated_workbooks WHERE id = $1 AND organization_id = $2`,
      [id, ORG_A]
    );
    expect(Number(afterDoubleFailure.rows[0].version)).toBe(2);

    // A client retry with the SAME (now-stale) expectedVersion=1 is
    // correctly rejected by the frozen CAS guard — proving retry cannot
    // silently double-apply the cell edit, independent of anything MAT-010
    // controls.
    const retry = await request(app)
      .patch(`/api/workbook/${id}/cell`)
      .set(authHeaders(ORG_A, USER_A))
      .send({ sheetIndex: 0, rowIndex: 0, columnKey: 'A', value: 21, expectedVersion: 1 })
      .expect(409);
    expect(retry.body.code).toBe('VERSION_CONFLICT');
  });

  it('DOUBLE FAILURE (create) — direct write AND pending write both fail on `created`: the business op still succeeds, and the deterministic backfill scan later reconstructs the receipt from the artifact\'s own row', async () => {
    lineageService.__setLineageDirectWriteFaultForTests(true);
    lineageService.__setLineagePendingWriteFaultForTests(true);
    let id: string;
    try {
      id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Double Failure Create');
    } finally {
      lineageService.__setLineageDirectWriteFaultForTests(false);
      lineageService.__setLineagePendingWriteFaultForTests(false);
    }

    // At this exact moment: the business record exists (the route answered
    // 201 — see createBlankWorkbook's own .expect(201)), but NEITHER a
    // receipt NOR a pending marker exists anywhere. This is the state the
    // MAT-010 contract forbids being PERMANENT for the operation that
    // creates an artifact.
    expect(await dbReceipts(ORG_A, id)).toHaveLength(0);
    expect(await dbPending(ORG_A, id)).toHaveLength(0);

    // The production recovery trigger (cron-scheduled; see
    // server/src/jobs/artifactLineageReconciliationJob.ts) runs the
    // deterministic backfill scan. It has no way to know WHICH id just lost
    // its lineage — it scans every owner-table row with no receipt, which is
    // exactly the mechanism that makes this recoverable without threading
    // any signal out of the failed request. Scoped to ORG_A here (the scan
    // itself supports scoping, same as `reconcilePendingLineageEvents`) so
    // this test never touches another suite's deliberately receiptless
    // fixtures sharing the same database — in production the job omits the
    // scope and sweeps every tenant.
    const backfill1 = await lineageService.backfillMissingLineageReceipts({
      organizationId: ORG_A,
      limit: 500,
    });
    expect(backfill1.backfilled).toBeGreaterThanOrEqual(1);
    expect(backfill1.errors).toBe(0);

    // Reconstructed deterministically from the workbook's OWN row.
    const receipts = await dbReceipts(ORG_A, id);
    expect(receipts).toHaveLength(1);
    expect(receipts[0].title_snapshot).toBe('MAT-010 Double Failure Create');
    const events = await dbEvents(receipts[0].receipt_id);
    expect(events.map((e) => e.event_type)).toEqual(['created']);
    expect(JSON.parse(events[0].detail_json)).toMatchObject({ backfilled: true });

    // Idempotent: a second scan must not create a duplicate `created` event
    // for an artifact that now has a receipt.
    const backfill2 = await lineageService.backfillMissingLineageReceipts({
      organizationId: ORG_A,
      limit: 500,
    });
    const eventsAfterSecondScan = await dbEvents(receipts[0].receipt_id);
    expect(eventsAfterSecondScan.map((e) => e.event_type)).toEqual(['created']);
    void backfill2;
  });

  // =====================================================================
  // RACE — the backfill scan running concurrently with a REAL (slow but
  // succeeding) creation request must not produce a duplicate `created`
  // event. Found by independent adversarial review: before the real hooks
  // carried a deterministic idempotencyKey, this raced to two events.
  // =====================================================================
  it('RACE — backfillMissingLineageReceipts racing a real, concurrently-completing `created` write produces exactly ONE event, not two', async () => {
    // Simulates "owner row committed, real hook about to fire" — a receipt-
    // less row exists (same precondition the backfill scan looks for), and
    // the real hook's own recordLineageEvent call (with the SAME
    // deterministic key a real route now derives) fires at the same moment
    // as a backfill scan.
    const id = uuidv4();
    await pool.query(
      `INSERT INTO generated_workbooks (id, organization_id, title, created_by, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [id, ORG_A, 'MAT-010 Race Workbook', USER_A]
    );
    createdWorkbookIds.push(id);

    const realHookKey = lineageService.deriveCreatedEventIdempotencyKey({
      artifactKind: 'workbook',
      sourceRecordId: id,
    });

    const [realWrite] = await Promise.all([
      lineageService.recordLineageEvent({
        organizationId: ORG_A,
        artifactKind: 'workbook',
        sourceRecordId: id,
        eventType: 'created',
        actorUserId: USER_A,
        titleSnapshot: 'MAT-010 Race Workbook',
        idempotencyKey: realHookKey,
      }),
      lineageService.backfillMissingLineageReceipts({ organizationId: ORG_A, limit: 500 }),
    ]);

    const receipt = (await dbReceipts(ORG_A, id))[0];
    expect(receipt).toBeTruthy();
    const events = await dbEvents(receipt.receipt_id);
    // EXACTLY one `created` event, not two — this is the assertion that
    // failed (2 events) before the shared idempotency key fix.
    expect(events.map((e) => e.event_type)).toEqual(['created']);
    expect(Number(receipt.event_count)).toBe(1);
    // Both writers derived the SAME key — confirms the FIX MECHANISM, not
    // just its effect (a coincidentally-single event for the wrong reason).
    expect(events[0].idempotency_key).toBe(realHookKey);
    expect(realWrite.receiptId).toBe(receipt.receipt_id);
  });

  // =====================================================================
  // NEGATIVE CONTROL 12 — reconciliation converges even if the ORIGINAL
  // write actually succeeded and only the acknowledgement was lost
  // =====================================================================
  it('DURABILITY — replaying a pending marker whose event ALREADY exists does not create a second event', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Double Write');
    const receiptId = (await dbReceipts(ORG_A, id))[0].receipt_id;

    // Record an event with an explicit stable key (the happy path).
    const key = `mat010-explicit-${uuidv4()}`;
    await lineageService.recordLineageEvent({
      organizationId: ORG_A,
      artifactKind: 'workbook',
      sourceRecordId: id,
      eventType: 'export',
      actorUserId: USER_A,
      idempotencyKey: key,
      detail: { format: 'xlsx' },
    });
    const countAfterWrite = (await dbEvents(receiptId)).length;

    // Now hand-plant a pending marker carrying THE SAME key — i.e. the write
    // committed but the acknowledgement was lost, so a retry intent was
    // durably filed for an event that already exists.
    await pool.query(
      `INSERT INTO artifact_lineage_pending_events
         (pending_id, organization_id, artifact_kind, source_record_id, event_type,
          actor_user_id, detail_json, idempotency_key, occurred_at, status, attempts, created_at)
       VALUES ($1, $2, 'workbook', $3, 'export', $4, $5, $6, NOW(), 'pending', 0, NOW())`,
      [uuidv4(), ORG_A, id, USER_A, JSON.stringify({ format: 'xlsx' }), key]
    );

    const run = await lineageService.reconcilePendingLineageEvents({ organizationId: ORG_A });
    expect(run.stillFailing).toBe(0);

    // PROVES the stable-key dedup carries the load: no second event.
    expect((await dbEvents(receiptId)).length).toBe(countAfterWrite);
    const marker = (await dbPending(ORG_A, id)).find((p) => p.idempotency_key === key);
    expect(marker.status).toBe('consumed');
  });

  // =====================================================================
  // DURABILITY — a single reconciliation call recovers MULTIPLE independent
  // pending events in one bounded batch, not just the one-at-a-time case
  // every other test above exercises.
  // =====================================================================
  it('DURABILITY — one reconciliation call recovers THREE independent pending events across different artifacts', async () => {
    const ids = await Promise.all([
      createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Batch Recovery 1'),
      createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Batch Recovery 2'),
      createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Batch Recovery 3'),
    ]);

    lineageService.__setLineageDirectWriteFaultForTests(true);
    try {
      for (const id of ids) {
        await request(app)
          .post(`/api/workbook/${id}/share`)
          .set(authHeaders(ORG_A, USER_A))
          .send({})
          .expect(200);
      }
    } finally {
      lineageService.__setLineageDirectWriteFaultForTests(false);
    }

    // Three independent durable markers, none recovered yet.
    for (const id of ids) {
      expect(await dbEventTypesFor(id)).toEqual(['created']);
    }
    const pendingBefore = await pool.query(
      `SELECT count(*)::int AS n FROM artifact_lineage_pending_events
        WHERE organization_id = $1 AND source_record_id = ANY($2) AND status = 'pending'`,
      [ORG_A, ids]
    );
    expect(pendingBefore.rows[0].n).toBe(3);

    // ONE bounded call recovers all three.
    const run = await lineageService.reconcilePendingLineageEvents({ organizationId: ORG_A });
    expect(run.recovered).toBeGreaterThanOrEqual(3);
    expect(run.stillFailing).toBe(0);

    for (const id of ids) {
      expect(await dbEventTypesFor(id)).toEqual(['created', 'share_minted']);
    }
    const pendingAfter = await pool.query(
      `SELECT count(*)::int AS n FROM artifact_lineage_pending_events
        WHERE organization_id = $1 AND source_record_id = ANY($2) AND status = 'consumed'`,
      [ORG_A, ids]
    );
    expect(pendingAfter.rows[0].n).toBe(3);

    async function dbEventTypesFor(sourceRecordId: string): Promise<string[]> {
      const receiptId = (await dbReceipts(ORG_A, sourceRecordId))[0].receipt_id;
      return (await dbEvents(receiptId)).map((e) => e.event_type);
    }
  });

  // =====================================================================
  // NEGATIVE CONTROL 13 — the outbox is tenant-scoped too
  // =====================================================================
  it('NEGATIVE CONTROL — org B cannot see or reconcile org A pending markers', async () => {
    const id = await createBlankWorkbook(ORG_A, USER_A, 'MAT-010 Pending Tenancy');
    await pool.query(
      `INSERT INTO artifact_lineage_pending_events
         (pending_id, organization_id, artifact_kind, source_record_id, event_type,
          idempotency_key, occurred_at, status, attempts, created_at)
       VALUES ($1, $2, 'workbook', $3, 'export', $4, NOW(), 'pending', 0, NOW())`,
      [uuidv4(), ORG_A, id, `mat010-tenancy-${uuidv4()}`]
    );

    // Org B's listing does not reveal it...
    const bList = await request(app)
      .get('/api/artifact-lineage/pending')
      .set(authHeaders(ORG_B, USER_B))
      .expect(200);
    expect(bList.body.pending.filter((p: any) => p.sourceRecordId === id)).toHaveLength(0);

    // ...and org B's reconcile run does not consume it.
    const bRun = await request(app)
      .post('/api/artifact-lineage/reconcile')
      .set(authHeaders(ORG_B, USER_B))
      .send({})
      .expect(200);
    expect(bRun.body.recovered).toBe(0);

    const stillPending = (await dbPending(ORG_A, id)).filter((p) => p.status === 'pending');
    expect(stillPending.length).toBeGreaterThanOrEqual(1);

    // The owner CAN see it.
    const aList = await request(app)
      .get('/api/artifact-lineage/pending?status=pending')
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    expect(aList.body.pending.some((p: any) => p.sourceRecordId === id)).toBe(true);
  });
});
