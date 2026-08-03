/** @vitest-environment node */

/**
 * MAT-010 — Presentation durability coverage for the `...Tracked` +
 * `respondIfLineageLost` conversion in `presentations.routes.ts` (Codex
 * review, second round: closing the remaining fail-open gap on non-create,
 * non-public_open events).
 *
 * Boots the real production `presentations.routes.ts` and
 * `artifactLineage.routes.ts` routers against whatever `DATABASE_URL` points
 * at, and drives the real `POST /decks/:id/share` route (`share_minted`) —
 * structurally the closest presentation event to the workbook share-mint
 * tests this file mirrors (`artifactLineage.mat010.postgres.integration.test.ts`'s
 * "SINGLE FAILURE (version)" / "DOUBLE FAILURE (version)" tests).
 *
 * EVERY assertion that matters is made against REAL DB STATE read back
 * through a separate `pg.Pool`, never against HTTP status codes alone.
 *
 * REQUIRES `NODE_ENV=test RUN_DB_TESTS=1` with `DATABASE_URL` pointed at a
 * real, migrated Postgres. `NODE_ENV=test` WITHOUT `RUN_DB_TESTS=1` silently
 * swaps in a mock DB and this entire suite would pass against nothing. Run:
 *
 *   DATABASE_URL=postgresql://consultinity:consultinity@localhost:28970/consultinity \
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 \
 *   npx vitest run --retry=0 \
 *     tests/integration/routes/artifactLineage.mat010-presentation-durability.postgres.integration.test.ts
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
const ORG_A = `org-mat010pd-a-${SUFFIX}`;
const ORG_B = `org-mat010pd-b-${SUFFIX}`;
const USER_A = `user-mat010pd-a-${SUFFIX}`;
const USER_B = `user-mat010pd-b-${SUFFIX}`;

// vi.mock calls are hoisted to the top of the module by vitest. Same
// scaffolding as `artifactLineage.mat010-routes.postgres.integration.test.ts`
// — auth is faked so the tenant can be switched per request; everything else
// that matters (the routes, the hooks, the DB) is real.
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

// `send` MUST return a promise: the share route calls
// `sendNotification({...}).catch(...)`, so a bare `vi.fn()` returning
// undefined throws a TypeError and turns the mint into a 500.
vi.mock('../../../server/src/services/notificationService.js', () => ({
  send: vi.fn().mockResolvedValue(null),
  default: { send: vi.fn().mockResolvedValue(null) },
}));

vi.mock('../../../server/src/services/OrgPoliciesService.js', () => ({
  requireNoLegalHold: vi.fn().mockResolvedValue(undefined),
  OrgPoliciesError: class OrgPoliciesError extends Error {},
}));

// No model calls in this suite — decks are created with structured slides.
vi.mock('../../../server/src/services/presentationGeneratorService.js', () => ({
  generateDeck: vi.fn(),
  generateOutline: vi.fn(),
}));

// The artifact-run registry is a different subsystem. MAT-010 resolves the
// canonical artifact id by reading `v8_artifact_origin_links` DIRECTLY.
vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: vi.fn().mockResolvedValue(null),
  getArtifactByOrigin: vi.fn().mockResolvedValue(null),
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

describe('MAT-010 — Presentation durability (share_minted, real Postgres)', () => {
  let app: express.Express;
  let pool: Pool;
  let lineageService: typeof import('../../../server/src/services/lineage/artifactLineageService.js');
  const createdDeckIds: string[] = [];
  const orgs = [ORG_A, ORG_B];

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || process.env.RUN_DB_TESTS !== '1') {
      throw new Error(
        'This suite requires NODE_ENV=test RUN_DB_TESTS=1 with DATABASE_URL pointed at a real, migrated Postgres.'
      );
    }
    const { default: presentationRoutes } = await import(
      '../../../server/src/routes/presentations.routes.js'
    );
    const { default: lineageRoutes } = await import(
      '../../../server/src/routes/artifactLineage.routes.js'
    );
    lineageService = await import(
      '../../../server/src/services/lineage/artifactLineageService.js'
    );

    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/presentations', presentationRoutes);
    app.use('/api/artifact-lineage', lineageRoutes);

    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // `presentation_decks.organization_id` carries a real FK to
    // `organizations` — the tenants must exist or every deck INSERT is
    // rejected.
    for (const orgId of orgs) {
      await pool.query(`INSERT INTO organizations (id) VALUES ($1) ON CONFLICT DO NOTHING`, [
        orgId,
      ]);
    }
  });

  afterAll(async () => {
    // Hygiene (CLAUDE.md): probes clean up after themselves, zero test records.
    if (createdDeckIds.length) {
      await pool.query(`DELETE FROM presentation_deck_versions WHERE deck_id = ANY($1)`, [
        createdDeckIds,
      ]);
      await pool.query(`DELETE FROM presentation_decks WHERE id = ANY($1)`, [createdDeckIds]);
    }
    await pool.query(`DELETE FROM v8_artifact_origin_links WHERE organization_id = ANY($1)`, [
      orgs,
    ]);
    await pool.query(`DELETE FROM artifact_lineage_pending_events WHERE organization_id = ANY($1)`, [
      orgs,
    ]);
    await pool.query(`DELETE FROM artifact_lineage_events WHERE organization_id = ANY($1)`, [orgs]);
    await pool.query(`DELETE FROM artifact_lineage_receipts WHERE organization_id = ANY($1)`, [
      orgs,
    ]);
    await pool.query(`DELETE FROM organizations WHERE id = ANY($1)`, [orgs]);
    await pool.end();
  });

  // ── DB read-back helpers (real state, never HTTP echoes) ────────────────
  async function dbReceipt(orgId: string, sourceRecordId: string) {
    const r = await pool.query(
      `SELECT * FROM artifact_lineage_receipts
        WHERE organization_id = $1 AND source_record_id = $2`,
      [orgId, sourceRecordId]
    );
    return r.rows[0];
  }

  async function dbEvents(orgId: string, sourceRecordId: string) {
    const r = await pool.query(
      `SELECT e.*
         FROM artifact_lineage_events e
         JOIN artifact_lineage_receipts rc ON rc.receipt_id = e.receipt_id
        WHERE rc.organization_id = $1 AND rc.source_record_id = $2
        ORDER BY e.sequence_no ASC`,
      [orgId, sourceRecordId]
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

  async function createDeck(orgId: string, userId: string, title: string): Promise<string> {
    const res = await request(app)
      .post('/api/presentations/decks')
      .set(authHeaders(orgId, userId))
      .send({
        title,
        theme: 'modern',
        slides: [
          { title: 'Slide one', bullets: ['a', 'b'] },
          { title: 'Slide two', bullets: ['c'] },
        ],
      })
      .expect(201);
    const deckId = res.body?.data?.id ?? res.body?.id ?? res.body?.deckId;
    expect(typeof deckId).toBe('string');
    createdDeckIds.push(deckId);
    return deckId;
  }

  // =====================================================================
  // SINGLE FAILURE — direct lineage write fails, durable pending marker
  // survives, reconciliation produces exactly one `share_minted` event.
  // =====================================================================
  it('SINGLE FAILURE (share_minted) — direct write fails, durable pending marker survives, reconciliation produces exactly one `share_minted` event with the correct actor and idempotency key, and a second reconcile is a no-op', async () => {
    const deckId = await createDeck(ORG_A, USER_A, 'MAT-010PD Share Single Failure');

    // Sanity: only `created` exists so far.
    expect((await dbEvents(ORG_A, deckId)).map((e) => e.event_type)).toEqual(['created']);

    lineageService.__setLineageDirectWriteFaultForTests(true);
    let shareToken: string;
    try {
      // The business operation must still SUCCEED and return a real token —
      // `durable: true` (pending fallback captured the intent) means the
      // route proceeds with its NORMAL response.
      const share = await request(app)
        .post(`/api/presentations/decks/${deckId}/share`)
        .set(authHeaders(ORG_A, USER_A))
        .send({})
        .expect(200);
      shareToken = share.body?.data?.shareToken ?? share.body?.shareToken;
      expect(typeof shareToken).toBe('string');
      expect(shareToken.length).toBeGreaterThan(0);
    } finally {
      lineageService.__setLineageDirectWriteFaultForTests(false);
    }

    // The direct write really did fail — no share_minted event landed yet.
    expect((await dbEvents(ORG_A, deckId)).map((e) => e.event_type)).toEqual(['created']);

    // A durable pending marker exists, correctly scoped.
    const pendingRows = await dbPending(ORG_A, deckId);
    expect(pendingRows).toHaveLength(1);
    const pending = pendingRows[0];
    expect(pending.status).toBe('pending');
    expect(pending.event_type).toBe('share_minted');
    expect(pending.organization_id).toBe(ORG_A);
    expect(pending.artifact_kind).toBe('presentation');

    // Reconcile — the "restart recovery" path. Nothing survives in process
    // memory; the pending row is the only durable state.
    const firstReconcile = await lineageService.reconcilePendingLineageEvents({
      organizationId: ORG_A,
    });
    expect(firstReconcile.recovered).toBeGreaterThanOrEqual(1);
    expect(firstReconcile.stillFailing).toBe(0);

    // EXACTLY ONE `share_minted` event now exists, with the correct actor and
    // the SAME idempotency key as the pending marker.
    const eventsAfterReconcile = await dbEvents(ORG_A, deckId);
    const minted = eventsAfterReconcile.filter((e) => e.event_type === 'share_minted');
    expect(minted).toHaveLength(1);
    expect(minted[0].actor_user_id).toBe(USER_A);
    expect(minted[0].idempotency_key).toBe(pending.idempotency_key);
    // The raw share token must never appear anywhere in the lineage.
    expect(JSON.stringify(minted)).not.toContain(shareToken!);

    // The pending marker is CONSUMED — kept, not deleted, as an audit trail.
    const pendingAfterReconcile = await dbPending(ORG_A, deckId);
    expect(pendingAfterReconcile).toHaveLength(1);
    expect(pendingAfterReconcile[0].status).toBe('consumed');
    expect(pendingAfterReconcile[0].consumed_at).not.toBeNull();

    // A second reconcile is a no-op — still exactly one event, no duplicate.
    const secondReconcile = await lineageService.reconcilePendingLineageEvents({
      organizationId: ORG_A,
    });
    expect(secondReconcile.recovered).toBe(0);
    expect(secondReconcile.stillFailing).toBe(0);
    const eventsFinal = await dbEvents(ORG_A, deckId);
    expect(eventsFinal.filter((e) => e.event_type === 'share_minted')).toHaveLength(1);
    expect(eventsFinal.length).toBe(eventsAfterReconcile.length);

    // Receipt counter agrees with the real event rows (no double-increment).
    const receiptFinal = await dbReceipt(ORG_A, deckId);
    expect(Number(receiptFinal.event_count)).toBe(eventsFinal.length);
  });

  // =====================================================================
  // DOUBLE FAILURE — direct write AND the durable pending/outbox write BOTH
  // fail. The route must decline unconditional success (Codex review,
  // second round: Option B fail-closed) while the business mutation, which
  // already committed via pool-autocommit before the lineage hook runs,
  // is NOT rolled back.
  // =====================================================================
  it('DOUBLE FAILURE (share_minted) — direct write AND pending write both fail: the route returns 500 LINEAGE_RECOVERY_REQUIRED instead of its normal 200, and the deck row still committed the new share_token', async () => {
    const deckId = await createDeck(ORG_A, USER_A, 'MAT-010PD Share Double Failure');

    lineageService.__setLineageDirectWriteFaultForTests(true);
    lineageService.__setLineagePendingWriteFaultForTests(true);
    let share: any;
    try {
      share = await request(app)
        .post(`/api/presentations/decks/${deckId}/share`)
        .set(authHeaders(ORG_A, USER_A))
        .send({})
        .expect(500);
    } finally {
      lineageService.__setLineageDirectWriteFaultForTests(false);
      lineageService.__setLineagePendingWriteFaultForTests(false);
    }

    // NOT the normal 200 body — the response is honest about the missing
    // audit trail instead of claiming unconditional success.
    expect(share.body.success).toBe(false);
    expect(share.body.code).toBe('LINEAGE_RECOVERY_REQUIRED');
    expect(share.body.data).toBeUndefined();

    // The BUSINESS mutation itself is NOT rolled back — `UPDATE
    // presentation_decks SET share_token = ...` already committed
    // (pool-autocommit, before the lineage hook runs) and MAT-07/08/09 must
    // never regress because lineage is unavailable. Read straight from
    // Postgres, never through the HTTP response.
    const row = await pool.query(
      `SELECT share_token, share_expires_at FROM presentation_decks WHERE id = $1 AND organization_id = $2`,
      [deckId, ORG_A]
    );
    expect(row.rows[0].share_token).toBeTruthy();
    expect(row.rows[0].share_expires_at).toBeTruthy();

    // Genuine double failure on a non-create event: no durable trace exists
    // anywhere for THIS event — no event row, no pending marker. The
    // receipt itself is not lost (it already existed from `created`), only
    // this one downstream event's audit trail — which is exactly why the
    // response is no longer allowed to claim full success.
    expect((await dbEvents(ORG_A, deckId)).map((e) => e.event_type)).toEqual(['created']);
    expect(await dbPending(ORG_A, deckId)).toHaveLength(0);
  });

  // =====================================================================
  // Cross-tenant sanity — org B cannot see org A's deck lineage, and driving
  // org A's deck id under org B's headers changes nothing (404 before the
  // route's own ownership check ever reaches the lineage hook).
  // =====================================================================
  it('cross-tenant — org B cannot mint a share for org A\'s deck, and no lineage is recorded for org B', async () => {
    const deckId = await createDeck(ORG_A, USER_A, 'MAT-010PD Share Cross Tenant');

    await request(app)
      .post(`/api/presentations/decks/${deckId}/share`)
      .set(authHeaders(ORG_B, USER_B))
      .send({})
      .expect(404);

    expect((await dbEvents(ORG_A, deckId)).map((e) => e.event_type)).toEqual(['created']);
    expect(await dbReceipt(ORG_B, deckId)).toBeUndefined();
  });
});
