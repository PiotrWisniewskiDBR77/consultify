/** @vitest-environment node */

/**
 * MAT-010 — REAL-ROUTE lineage coverage for Presentation and Document.
 *
 * ── WHY THIS FILE EXISTS (Codex review blocker 1) ─────────────────────────
 * The original MAT-010 suite proved multi-type coverage by calling
 * `recordLineageEvent()` DIRECTLY from the test for Document and Presentation.
 * That proves the lineage SERVICE works; it proves nothing about whether the
 * hooks wired into those frozen routes actually fire in production. Only
 * Workbook had genuine route-level coverage.
 *
 * Every lineage assertion in THIS file is produced by hitting a real HTTP
 * endpoint on the real Express router and letting the production hook fire.
 * The service is never called directly to manufacture an event. Assertions
 * read real DB state through a separate `pg.Pool`, never HTTP status alone.
 *
 * ── FIXTURES VS. REAL ROUTES, STATED PLAINLY ──────────────────────────────
 * Presentation: EVERY event under test, INCLUDING `created`, comes from a real
 * route — `POST /decks` accepts a title plus structured slides and needs no
 * model call.
 *
 * Document: `created` is the one exception. The only document-creation route
 * is `POST /api/document-studio/generate`, which requires a live LLM
 * generation, so the artifact row is SEEDED as a fixture and the `created`
 * hook is therefore NOT exercised here (it is covered by the existing
 * `registerGeneratedDocumentOrigin` hook and reported as such). Every OTHER
 * Document event — version, checkpoint, restore, export, share_minted,
 * share_revoked, public_open — is driven through its real HTTP route.
 *
 * REQUIRES `NODE_ENV=test RUN_DB_TESTS=1` with `DATABASE_URL` pointed at a
 * real, migrated Postgres. `NODE_ENV=test` WITHOUT `RUN_DB_TESTS=1` silently
 * swaps in a mock DB and this entire suite would pass against nothing.
 *
 *   DATABASE_URL=postgresql://consultinity:consultinity@localhost:28911/consultinity \
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 \
 *   npx vitest run --retry=0 \
 *     tests/integration/routes/artifactLineage.mat010-routes.postgres.integration.test.ts
 *
 * `--retry=0` is deliberate (institutional memory: `retry: 1` hides fixture
 * collisions and makes race tests lie).
 */
import express from 'express';
import { Pool } from 'pg';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { initializeDocumentLifecycle } from '../../../server/src/services/documentStudio/documentLifecycleService.js';

const SUFFIX = uuidv4().slice(0, 8);
const ORG_A = `org-mat010r-a-${SUFFIX}`;
const ORG_B = `org-mat010r-b-${SUFFIX}`;
// A THIRD org, used ONLY by the request-bound-idempotency tenant-isolation
// test below — ORG_B is load-bearing elsewhere in this file as the "has
// exactly zero receipts" negative control (the closing
// "org-scoped listing" test asserts `orgBList.body.receipts` has length 0),
// so giving it a real checkpoint there would break that unrelated assertion.
const ORG_C = `org-mat010r-c-${SUFFIX}`;
const USER_A = `user-mat010r-a-${SUFFIX}`;
const USER_B = `user-mat010r-b-${SUFFIX}`;
const USER_C = `user-mat010r-c-${SUFFIX}`;

// vi.mock calls are hoisted to the top of the module by vitest.
// Auth is faked so the tenant can be switched per request; EVERYTHING ELSE
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

// No model calls in this suite.
vi.mock('../../../server/src/services/presentationGeneratorService.js', () => ({
  generateDeck: vi.fn(),
  generateOutline: vi.fn(),
}));

// The artifact-run registry is a different subsystem. MAT-010 resolves the
// canonical artifact id by reading `v8_artifact_origin_links` DIRECTLY.
vi.mock('../../../server/src/services/v8/artifactRegistryService.js', () => ({
  registerArtifactOrigin: vi.fn().mockResolvedValue(null),
  // Codex review, third round (Blocker A) — the PDF/PNG export routes gate
  // on `getArtifactByOrigin` returning a truthy artifact (404 otherwise)
  // BEFORE they ever reach the lineage pre-flight. `publishState: null`
  // means "never entered the review workflow" (`evaluateExportApproval`),
  // so `applyExportApprovalGate` never blocks — this stub exists purely to
  // clear that existence check, not to exercise the approval gate itself.
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

// Codex review, third round (Blocker A) — the PDF/PNG export tests below
// need a passing quality gate to reach `doc.pipe(res)`/`archive.pipe(res)`
// at all. Mocking the underlying check (not `enforceQualityGateForExport`
// itself, which is the real contract under test elsewhere) keeps this
// suite's focus on the lineage pre-flight mechanism, matching this file's
// existing convention of stubbing cross-cutting concerns unrelated to
// lineage (notificationService, OrgPoliciesService, etc. above).
vi.mock('../../../server/src/services/presentationQualityGatesService.js', () => ({
  checkDeckQualityGates: vi.fn().mockResolvedValue({
    canExport: true,
    result: 'pass',
    scorecard: {},
    gates: [],
  }),
}));

function authHeaders(orgId: string, userId: string) {
  return { 'x-test-org-id': orgId, 'x-test-user-id': userId };
}

describe('MAT-010 — real-route lineage coverage (Presentation + Document, real Postgres)', () => {
  let app: express.Express;
  let pool: Pool;
  let lineageService: typeof import('../../../server/src/services/lineage/artifactLineageService.js');
  let operationClaimService: typeof import('../../../server/src/services/lineage/operationClaimService.js');
  const createdDeckIds: string[] = [];
  const createdDocIds: string[] = [];
  const orgs = [ORG_A, ORG_B, ORG_C];

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || process.env.RUN_DB_TESTS !== '1') {
      throw new Error(
        'This suite requires NODE_ENV=test RUN_DB_TESTS=1 with DATABASE_URL pointed at a real, migrated Postgres.'
      );
    }
    lineageService = await import(
      '../../../server/src/services/lineage/artifactLineageService.js'
    );
    operationClaimService = await import(
      '../../../server/src/services/lineage/operationClaimService.js'
    );
    const { default: presentationRoutes } = await import(
      '../../../server/src/routes/presentations.routes.js'
    );
    const { default: documentStudioRoutes, documentShareLinkPublicRoutes } = await import(
      '../../../server/src/routes/document-studio.routes.js'
    );
    const { default: lineageRoutes } = await import(
      '../../../server/src/routes/artifactLineage.routes.js'
    );

    app = express();
    app.use(express.json({ limit: '10mb' }));
    app.use('/api/presentations', presentationRoutes);
    // Mounted in the SAME order as Gateway.ts:887-889 — the public share-link
    // router first, then the authenticated router.
    app.use('/api/document-studio', documentShareLinkPublicRoutes);
    app.use('/api/document-studio', documentStudioRoutes);
    app.use('/api/artifact-lineage', lineageRoutes);

    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    // `presentation_decks.organization_id` carries a REAL foreign key to
    // `organizations` (unlike `generated_workbooks`, which has none), so the
    // tenants must actually exist or every deck INSERT is rejected.
    //
    // That rejection USED TO BE invisible from the HTTP surface — `POST
    // /decks` used `dbRun`, whose `fallback: true` swallows the error and
    // returns `{success:false}` that the route never inspected, so the route
    // answered 201 for a deck that was never written (the institutional
    // "DbPromise.run silently swallows constraint violations" trap,
    // artifactRegistryService.ts:1275, showing up again). MAT-010 fixed this
    // (G8) by checking `.success` on the insert result — see
    // 'REAL ROUTE — a rejected presentation_decks INSERT is a 500, never a
    // false 201' below for the regression. This suite still asserts on real
    // DB rows rather than on status codes alone.
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
    if (createdDocIds.length) {
      // Codex final review — discovered while verifying zero-leftover-records
      // on a fresh container: this cleanup pre-dates `document_version_snapshots`/
      // `document_share_links` (added when checkpoint/restore/share_minted
      // route coverage was introduced) and never grew to include them. Fixed
      // here, not silently left — a real hygiene gap, not new this round.
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
    await pool.query(`DELETE FROM v8_artifact_origin_links WHERE organization_id = ANY($1)`, [
      orgs,
    ]);
    // round-5 redesign — operation claims now live in their own dedicated
    // table (`operationClaimService.ts`), separate from the lineage outbox
    // below; the DOUBLE FAILURE / CONCURRENCY tests in this file create real
    // claim rows via real HTTP requests, so this file needs its own cleanup
    // line for them too.
    await pool.query(`DELETE FROM artifact_lineage_operation_claims WHERE organization_id = ANY($1)`, [
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

  async function dbEventTypes(orgId: string, sourceRecordId: string): Promise<string[]> {
    const r = await pool.query(
      `SELECT e.event_type
         FROM artifact_lineage_events e
         JOIN artifact_lineage_receipts rc ON rc.receipt_id = e.receipt_id
        WHERE rc.organization_id = $1 AND rc.source_record_id = $2
        ORDER BY e.sequence_no ASC`,
      [orgId, sourceRecordId]
    );
    return r.rows.map((x) => x.event_type);
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

  // =====================================================================
  // PRESENTATION — every event from a REAL route, including `created`
  // =====================================================================
  describe('Presentation (presentation_decks) — real routes', () => {
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

    it('REAL ROUTE — POST /decks fires the `created` hook and writes a receipt with origin_runtime=presentation', async () => {
      const deckId = await createDeck(ORG_A, USER_A, 'MAT-010R Deck Created');

      // The hook fired inside the production route — nothing in this test
      // called the lineage service.
      const receipt = await dbReceipt(ORG_A, deckId);
      expect(receipt).toBeTruthy();
      expect(receipt.artifact_kind).toBe('presentation');
      expect(receipt.origin_runtime).toBe('presentation');
      expect(receipt.created_by).toBe(USER_A);
      expect(await dbEventTypes(ORG_A, deckId)).toEqual(['created']);
    });

    it('REAL ROUTE — a rejected presentation_decks INSERT is a 500, never a false 201 (MAT-010 G8)', async () => {
      // No `organizations` row for this id — the FK on
      // presentation_decks.organization_id makes the INSERT fail. Before the
      // G8 fix, `dbRun`'s swallowed error let the route fall through cards,
      // audit, registry sync and PPTX render and answer 201 for a deck that
      // was never written.
      const ghostOrgId = `org-mat010r-ghost-${SUFFIX}`;
      const res = await request(app)
        .post('/api/presentations/decks')
        .set(authHeaders(ghostOrgId, USER_A))
        .send({ title: 'Ghost org deck', theme: 'modern', slides: [] });

      expect(res.status).toBe(500);
      expect(res.body?.success).toBe(false);

      const row = await pool.query(`SELECT 1 FROM presentation_decks WHERE organization_id = $1`, [
        ghostOrgId,
      ]);
      expect(row.rowCount).toBe(0);

      const receipts = await pool.query(
        `SELECT 1 FROM artifact_lineage_receipts WHERE organization_id = $1`,
        [ghostOrgId]
      );
      expect(receipts.rowCount).toBe(0);
    });

    it('REAL ROUTE — autosave records `version`, and a stale (409) autosave records NOTHING', async () => {
      const deckId = await createDeck(ORG_A, USER_A, 'MAT-010R Deck Version');

      const ok = await request(app)
        .put(`/api/presentations/decks/${deckId}/autosave`)
        .set({ ...authHeaders(ORG_A, USER_A), 'x-deck-version': '1' })
        .send({ deck: { title: 'MAT-010R Deck Version', cards: [] } })
        .expect(200);
      expect(ok.body.version).toBe(2);
      expect(await dbEventTypes(ORG_A, deckId)).toEqual(['created', 'version']);

      // NEGATIVE CONTROL — a stale writer loses the compare-and-swap and gets
      // 409. The hook sits PAST that guard, so the lineage must not grow.
      await request(app)
        .put(`/api/presentations/decks/${deckId}/autosave`)
        .set({ ...authHeaders(ORG_A, USER_A), 'x-deck-version': '1' })
        .send({ deck: { title: 'stale writer', cards: [] } })
        .expect(409);

      expect(await dbEventTypes(ORG_A, deckId)).toEqual(['created', 'version']);
    });

    it('REAL ROUTE — restore records `restore` and carries the version it restored from', async () => {
      const deckId = await createDeck(ORG_A, USER_A, 'MAT-010R Deck Restore');

      // Produce a version row through the real autosave route.
      await request(app)
        .put(`/api/presentations/decks/${deckId}/autosave`)
        .set({ ...authHeaders(ORG_A, USER_A), 'x-deck-version': '1' })
        .send({ deck: { title: 'v2', cards: [] } })
        .expect(200);

      const versions = await request(app)
        .get(`/api/presentations/decks/${deckId}/versions`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);
      expect(versions.body.data.length).toBeGreaterThan(0);
      const versionId = versions.body.data[0].id;

      // NEGATIVE CONTROL FIRST — a restore with the wrong expectedVersion is
      // a 409 and must leave no trace.
      await request(app)
        .post(`/api/presentations/decks/${deckId}/versions/${versionId}/restore`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ expectedVersion: 999 })
        .expect(409);
      expect(await dbEventTypes(ORG_A, deckId)).toEqual(['created', 'version']);

      // Now the real thing.
      await request(app)
        .post(`/api/presentations/decks/${deckId}/versions/${versionId}/restore`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ expectedVersion: 2 })
        .expect(200);

      expect(await dbEventTypes(ORG_A, deckId)).toEqual(['created', 'version', 'restore']);
      const restoreEvent = (await dbEvents(ORG_A, deckId)).find(
        (e) => e.event_type === 'restore'
      );
      expect(JSON.parse(restoreEvent.detail_json).versionId).toBe(versionId);
      expect(restoreEvent.actor_user_id).toBe(USER_A);
    });

    it('REAL ROUTE — share mint -> public open -> revoke -> dead token, with no token material in the lineage', async () => {
      const deckId = await createDeck(ORG_A, USER_A, 'MAT-010R Deck Share');

      const share = await request(app)
        .post(`/api/presentations/decks/${deckId}/share`)
        .set(authHeaders(ORG_A, USER_A))
        .send({})
        .expect(200);
      const token = share.body?.data?.shareToken ?? share.body?.shareToken;
      expect(typeof token).toBe('string');

      // UNAUTHENTICATED public read — no auth headers at all.
      await request(app).get(`/api/presentations/shared/${token}`).expect(200);

      await request(app)
        .delete(`/api/presentations/decks/${deckId}/share`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);

      // Revoked token is dead, and must NOT manufacture a second public_open.
      await request(app).get(`/api/presentations/shared/${token}`).expect(404);
      // An unknown token likewise.
      await request(app).get(`/api/presentations/shared/unknown-${uuidv4()}`).expect(404);

      expect(await dbEventTypes(ORG_A, deckId)).toEqual([
        'created',
        'share_minted',
        'public_open',
        'share_revoked',
      ]);

      const events = await dbEvents(ORG_A, deckId);
      // The public reader is anonymous: no actor.
      const publicOpen = events.find((e) => e.event_type === 'public_open');
      expect(publicOpen.actor_user_id).toBeNull();
      // ...but it is filed under the OWNING org, taken from the matched row.
      expect(publicOpen.organization_id).toBe(ORG_A);

      // The raw share token must never appear anywhere in the lineage.
      expect(JSON.stringify(events)).not.toContain(token);
    });

    it('REAL ROUTE — the canonical trace API returns the deck lineage, and org B gets a 404', async () => {
      const deckId = await createDeck(ORG_A, USER_A, 'MAT-010R Deck Trace');

      const trace = await request(app)
        .get(`/api/artifact-lineage/presentation/${deckId}`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);
      expect(trace.body.receipt.artifactKind).toBe('presentation');
      expect(trace.body.receipt.sourceRecordId).toBe(deckId);

      await request(app)
        .get(`/api/artifact-lineage/presentation/${deckId}`)
        .set(authHeaders(ORG_B, USER_B))
        .expect(404);

      // NEGATIVE CONTROL — org B driving the real deck routes against org A's
      // deck changes nothing in org A's lineage and mints nothing in org B's.
      const before = await dbEventTypes(ORG_A, deckId);
      await request(app)
        .put(`/api/presentations/decks/${deckId}/autosave`)
        .set({ ...authHeaders(ORG_B, USER_B), 'x-deck-version': '1' })
        .send({ deck: { title: 'cross tenant', cards: [] } });
      await request(app)
        .post(`/api/presentations/decks/${deckId}/share`)
        .set(authHeaders(ORG_B, USER_B))
        .send({});

      expect(await dbEventTypes(ORG_A, deckId)).toEqual(before);
      expect(await dbReceipt(ORG_B, deckId)).toBeUndefined();
    });

    // =====================================================================
    // Codex review, third round (Blocker A) — DOUBLE FAILURE on the
    // streaming preflight. For `export/pdf` and `export/png` there is no
    // separate "direct write, then durable fallback" sequence the way other
    // events have: `preflightStreamingExportIntent` writes straight to the
    // durable pending outbox BEFORE `doc.pipe(res)`/`archive.pipe(res)` ever
    // runs, precisely so a failure here can still become a real HTTP error
    // instead of a silently-lost receipt for an export the client believes
    // succeeded. Forcing that one write to fail (the same
    // `__setLineagePendingWriteFaultForTests` seam the durability suite uses
    // for its "pending write also fails" half of a double failure) is
    // therefore THE genuine double-failure case for this code path — once
    // it fails, nothing durable exists anywhere for this export, matching
    // "brak trwałego intentu -> nie rozpoczynaj streamingu".
    // =====================================================================
    it('DOUBLE FAILURE (export/pdf) — the durable pre-flight write fails: the route returns 500 LINEAGE_RECOVERY_REQUIRED BEFORE `doc.pipe(res)`, zero PDF bytes are ever sent, and no lineage trace of any kind exists for this export', async () => {
      const deckId = await createDeck(ORG_A, USER_A, 'MAT-010R Deck PDF Preflight Double Failure');

      lineageService.__setLineagePendingWriteFaultForTests(true);
      let res: any;
      try {
        res = await request(app)
          .get(`/api/presentations/decks/${deckId}/export/pdf`)
          .set(authHeaders(ORG_A, USER_A))
          .expect(500);
      } finally {
        lineageService.__setLineagePendingWriteFaultForTests(false);
      }

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('LINEAGE_RECOVERY_REQUIRED');

      // Zero bytes of the actual PDF were ever sent — the response is the
      // plain JSON error, never `application/pdf`, never the PDF magic bytes.
      expect(res.headers['content-type']).not.toMatch(/application\/pdf/);
      expect(String(res.text ?? '')).not.toMatch(/^%PDF/);

      // Genuinely nothing survived: no export event, no pending marker at
      // all — the pre-flight write IS the durable outbox write, so when it
      // fails there is no further fallback left to catch it.
      expect(await dbEventTypes(ORG_A, deckId)).toEqual(['created']);
      const pendingRows = await pool.query(
        `SELECT * FROM artifact_lineage_pending_events
          WHERE organization_id = $1 AND source_record_id = $2 AND event_type = 'export'`,
        [ORG_A, deckId]
      );
      expect(pendingRows.rows).toHaveLength(0);
    });

    it('DOUBLE FAILURE (export/png) — the same streaming-preflight guard: 500 LINEAGE_RECOVERY_REQUIRED before `archive.pipe(res)`, zero zip bytes sent, no lineage trace', async () => {
      const deckId = await createDeck(ORG_A, USER_A, 'MAT-010R Deck PNG Preflight Double Failure');

      lineageService.__setLineagePendingWriteFaultForTests(true);
      let res: any;
      try {
        res = await request(app)
          .post(`/api/presentations/decks/${deckId}/export/png`)
          .set(authHeaders(ORG_A, USER_A))
          .expect(500);
      } finally {
        lineageService.__setLineagePendingWriteFaultForTests(false);
      }

      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('LINEAGE_RECOVERY_REQUIRED');
      expect(res.headers['content-type']).not.toMatch(/application\/zip/);

      expect(await dbEventTypes(ORG_A, deckId)).toEqual(['created']);
      const pendingRows = await pool.query(
        `SELECT * FROM artifact_lineage_pending_events
          WHERE organization_id = $1 AND source_record_id = $2 AND event_type = 'export'`,
        [ORG_A, deckId]
      );
      expect(pendingRows.rows).toHaveLength(0);
    });
  });

  // =====================================================================
  // DOCUMENT — every event except `created` from a REAL route
  // =====================================================================
  describe('Document (wave5_artifacts) — real routes', () => {
    /**
     * Seeds the artifact row directly. The ONLY document-creation route is
     * `POST /generate`, which needs a live LLM — so `created` is deliberately
     * out of scope here (stated in the report, not glossed over). Everything
     * below this line goes through real HTTP.
     */
    async function seedDocument(orgId: string, userId: string, title: string) {
      const artifactId = `doc-mat010r-${uuidv4()}`;
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
            blocks: [
              { blockId: 'b-1', type: 'paragraph', content: 'Treść wejściowa.', isAssumption: false },
            ],
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
        [
          artifactId,
          orgId,
          title,
          '# ' + title,
          userId,
          nowIso,
          JSON.stringify(schema),
        ]
      );
      // Lifecycle state is normally seeded by the generation path
      // (`initializeDocumentLifecycle`). Rollback hard-requires it ("no
      // lifecycle state for artifact"), so the fixture provides it the same
      // way the DAO persists it.
      await pool.query(
        `INSERT INTO document_lifecycle_states
           (artifact_id, organization_id, status, status_changed_at,
            status_changed_by, status_reason, history_json, updated_at)
         VALUES ($1, $2, 'draft', $3, $4, 'fixture', '[]'::jsonb, $3)
         ON CONFLICT (artifact_id, organization_id) DO NOTHING`,
        [artifactId, orgId, nowIso, userId]
      );
      // `ensureDocumentLifecycleHydrated(organizationId)` (called by the
      // checkpoint/rollback routes) only ever loads from Postgres ONCE per
      // organizationId for the lifetime of the process (`hydratedOrgs` in
      // documentLifecycleService.ts) — by the time this file's SECOND (or
      // later) document under the same org is seeded, that flag is already
      // set, so the raw INSERT above is invisible to the in-process
      // `lifecycleStore` Map and `__forceTransitionDocumentStatusForRollback`
      // throws "no lifecycle state for artifact". Production never hits this
      // gap (every real document goes through `initializeDocumentLifecycle`
      // at generation time, which seeds the in-memory store directly) — only
      // this fixture's DB-only seed does. Calling the same function here
      // closes that gap without touching route code.
      await initializeDocumentLifecycle({ organizationId: orgId, artifactId, actorId: userId });

      createdDocIds.push(artifactId);
      return { artifactId, updatedAt: nowIso };
    }

    /** Reads the doc through its REAL route to get the current CAS token. */
    async function currentUpdatedAt(
      artifactId: string,
      orgId: string,
      userId: string
    ): Promise<string> {
      const res = await request(app)
        .get(`/api/document-studio/${artifactId}`)
        .set(authHeaders(orgId, userId))
        .expect(200);
      const updatedAt =
        res.body?.schema?.updatedAt ?? res.body?.document?.updatedAt ?? res.body?.updatedAt;
      expect(typeof updatedAt).toBe('string');
      return updatedAt;
    }

    it('REAL ROUTE — PUT /:artifactId/content records `version`, and a 409 conflict records NOTHING', async () => {
      const { artifactId } = await seedDocument(ORG_A, USER_A, 'MAT-010R Doc Version');
      const expectedVersion = await currentUpdatedAt(artifactId, ORG_A, USER_A);

      await request(app)
        .put(`/api/document-studio/${artifactId}/content`)
        .set(authHeaders(ORG_A, USER_A))
        .send({
          expectedVersion,
          sections: [
            {
              sectionId: 'sec-1',
              heading: 'Wprowadzenie',
              blocks: [
                { blockId: 'b-1', type: 'paragraph', content: 'Zmieniona treść.', isAssumption: false },
              ],
            },
          ],
        })
        .expect(200);

      // The receipt was created by the HOOK, from inside the real route.
      const receipt = await dbReceipt(ORG_A, artifactId);
      expect(receipt).toBeTruthy();
      expect(receipt.artifact_kind).toBe('document');
      expect(receipt.origin_runtime).toBe('native_artifact');
      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['version']);

      // NEGATIVE CONTROL — replaying the now-stale expectedVersion is a 409,
      // and the hook sits past that guard, so nothing is appended.
      await request(app)
        .put(`/api/document-studio/${artifactId}/content`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ expectedVersion, sections: [] })
        .expect(409);

      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['version']);
    });

    it('REAL ROUTE — POST /:artifactId/snapshots records `checkpoint` and rollback records `restore`', async () => {
      const { artifactId } = await seedDocument(ORG_A, USER_A, 'MAT-010R Doc Checkpoint');

      const snap = await request(app)
        .post(`/api/document-studio/${artifactId}/snapshots`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ label: 'przed korektą', reason: 'manual' })
        .expect(201);
      const versionId = snap.body?.snapshot?.versionId;
      expect(typeof versionId).toBe('string');

      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint']);
      const cp = (await dbEvents(ORG_A, artifactId))[0];
      expect(JSON.parse(cp.detail_json).label).toBe('przed korektą');

      await request(app)
        .post(`/api/document-studio/${artifactId}/snapshots/${versionId}/rollback`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ reason: 'wracamy' })
        .expect(200);

      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint', 'restore']);
      const restore = (await dbEvents(ORG_A, artifactId)).find((e) => e.event_type === 'restore');
      expect(JSON.parse(restore.detail_json).restoredFromVersionId).toBe(versionId);

      // NEGATIVE CONTROL — rolling back to an unknown version id fails and
      // appends nothing.
      await request(app)
        .post(`/api/document-studio/${artifactId}/snapshots/unknown-${uuidv4()}/rollback`)
        .set(authHeaders(ORG_A, USER_A))
        .send({});
      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint', 'restore']);
    });

    // =====================================================================
    // Codex review, third round (Blocker B) — request-bound idempotency.
    // `createDocumentSnapshot`/`rollbackDocumentToVersion` have no CAS guard
    // (unlike the version route's `expectedVersion` above), so retrying the
    // SAME logical request must be caught by the `Idempotency-Key` header,
    // not by the underlying mutation rejecting a stale precondition.
    // =====================================================================
    it('REQUEST-BOUND IDEMPOTENCY (checkpoint) — retrying the same request with the same Idempotency-Key returns the SAME snapshot, appends no second `checkpoint` event, and creates no second snapshot version', async () => {
      const { artifactId } = await seedDocument(ORG_A, USER_A, 'MAT-010R Doc Checkpoint Idempotent');
      const idemKey = `idem-checkpoint-${uuidv4()}`;

      const first = await request(app)
        .post(`/api/document-studio/${artifactId}/snapshots`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
        .send({ label: 'przed korektą', reason: 'manual' })
        .expect(201);
      const versionId = first.body?.snapshot?.versionId;
      expect(typeof versionId).toBe('string');
      expect(first.body.idempotentReplay).toBeFalsy();
      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint']);

      // Retry — same header, same body. Must NOT create a second snapshot
      // version nor append a second `checkpoint` event.
      const retry = await request(app)
        .post(`/api/document-studio/${artifactId}/snapshots`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
        .send({ label: 'przed korektą', reason: 'manual' })
        .expect(201);

      expect(retry.body.idempotentReplay).toBe(true);
      expect(retry.body?.snapshot?.versionId).toBe(versionId);
      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint']);

      const snapshots = await request(app)
        .get(`/api/document-studio/${artifactId}/snapshots`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);
      // The lineage event itself would dedupe on `idempotency_key` even if
      // `createDocumentSnapshot` ran a second time (a real bug this test
      // must still catch) — so the decisive assertion is the TOTAL snapshot
      // count for this artifact, not just that the original versionId is
      // present.
      expect(snapshots.body.snapshots).toHaveLength(1);
      expect(
        (snapshots.body.snapshots as Array<{ versionId: string }>).filter(
          (s) => s.versionId === versionId
        )
      ).toHaveLength(1);

      // A DIFFERENT Idempotency-Key on an otherwise-identical request is a
      // genuinely new checkpoint, not a false-positive dedup.
      const second = await request(app)
        .post(`/api/document-studio/${artifactId}/snapshots`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': `idem-checkpoint-${uuidv4()}` })
        .send({ label: 'przed korektą', reason: 'manual' })
        .expect(201);
      expect(second.body.idempotentReplay).toBeFalsy();
      expect(second.body?.snapshot?.versionId).not.toBe(versionId);
      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint', 'checkpoint']);
    });

    // =====================================================================
    // Final gate ("testy retry i concurrency") — GENUINE concurrency within
    // ONE process, not sequential retries. Both requests are fired before
    // either is awaited, so they race for real. See
    // `artifactLineage.mat010-multi-instance.postgres.integration.test.ts`
    // for the stronger, Codex-required proof across two INDEPENDENT app
    // instances (this file's `app` is shared by both concurrent calls here,
    // so it does not by itself prove cross-instance safety — the durable
    // claim in `acquireOrReclaimOperationClaim` is what makes it safe either way).
    // =====================================================================
    it('CONCURRENCY (checkpoint) — two genuinely concurrent requests with the SAME Idempotency-Key produce EXACTLY ONE snapshot and ONE `checkpoint` event', async () => {
      const { artifactId } = await seedDocument(ORG_A, USER_A, 'MAT-010R Doc Checkpoint Concurrency');
      const idemKey = `idem-checkpoint-concurrent-${uuidv4()}`;

      const send = () =>
        request(app)
          .post(`/api/document-studio/${artifactId}/snapshots`)
          .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
          .send({ label: 'równolegle', reason: 'manual' });

      // Both promises created before either is awaited — genuine race.
      const call1 = send();
      const call2 = send();
      const [res1, res2] = await Promise.all([call1, call2]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      const versionIds = [res1.body?.snapshot?.versionId, res2.body?.snapshot?.versionId];
      expect(versionIds[0]).toBeTruthy();
      // Both callers must agree on the SAME versionId — not two independent
      // snapshots that merely happen to both succeed.
      expect(versionIds[0]).toBe(versionIds[1]);
      // Exactly one of the two is the "real" creator; the other replayed.
      const replayFlags = [res1.body.idempotentReplay, res2.body.idempotentReplay];
      expect(replayFlags.filter((f) => f === true)).toHaveLength(1);
      expect(replayFlags.filter((f) => !f)).toHaveLength(1);

      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint']);

      const snapshots = await request(app)
        .get(`/api/document-studio/${artifactId}/snapshots`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);
      expect(snapshots.body.snapshots).toHaveLength(1);
    });

    // =====================================================================
    // round-5 redesign — the durable CLAIM write itself fails (the dedicated
    // `artifact_lineage_operation_claims` table, not the lineage outbox):
    // the mutation must never run, the response must be fail-closed, and a
    // later retry (once the fault is cleared) must perform EXACTLY ONE
    // mutation — never zero, never two.
    // =====================================================================
    it('DOUBLE FAILURE (checkpoint) — the durable claim write fails: the route returns 500 CLAIM_ACQUIRE_FAILED BEFORE `createDocumentSnapshot` runs, zero snapshot rows exist, and a retry after the fault clears performs exactly ONE mutation', async () => {
      const { artifactId } = await seedDocument(ORG_A, USER_A, 'MAT-010R Doc Checkpoint Double Failure');
      const idemKey = `idem-checkpoint-doublefail-${uuidv4()}`;

      operationClaimService.__setOperationClaimAcquireFaultForTests(true);
      let failedRes: any;
      try {
        failedRes = await request(app)
          .post(`/api/document-studio/${artifactId}/snapshots`)
          .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
          .send({ label: 'double failure', reason: 'manual' });
      } finally {
        operationClaimService.__setOperationClaimAcquireFaultForTests(false);
      }

      expect(failedRes.status).toBe(500);
      expect(failedRes.body.success).toBe(false);
      expect(failedRes.body.code).toBe('CLAIM_ACQUIRE_FAILED');

      // Zero business mutation: no lineage event, no snapshot row anywhere.
      expect(await dbEventTypes(ORG_A, artifactId)).toEqual([]);
      const zeroSnapshots = await request(app)
        .get(`/api/document-studio/${artifactId}/snapshots`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);
      expect(zeroSnapshots.body.snapshots).toHaveLength(0);

      // Retry, same key, fault cleared — exactly ONE mutation now.
      const retry = await request(app)
        .post(`/api/document-studio/${artifactId}/snapshots`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
        .send({ label: 'double failure', reason: 'manual' })
        .expect(201);
      expect(retry.body.idempotentReplay).toBeFalsy();
      expect(typeof retry.body.snapshot.versionId).toBe('string');

      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint']);
      const oneSnapshot = await request(app)
        .get(`/api/document-studio/${artifactId}/snapshots`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);
      expect(oneSnapshot.body.snapshots).toHaveLength(1);
    });

    it('REQUEST-BOUND IDEMPOTENCY (restore) — retrying the same rollback request with the same Idempotency-Key returns the SAME result, appends no second `restore` event, and creates no second `rollback_revert` snapshot', async () => {
      const { artifactId } = await seedDocument(ORG_A, USER_A, 'MAT-010R Doc Restore Idempotent');

      const snap = await request(app)
        .post(`/api/document-studio/${artifactId}/snapshots`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ label: 'przed korektą', reason: 'manual' })
        .expect(201);
      const versionId = snap.body?.snapshot?.versionId;
      expect(typeof versionId).toBe('string');

      const idemKey = `idem-restore-${uuidv4()}`;
      const firstRollback = await request(app)
        .post(`/api/document-studio/${artifactId}/snapshots/${versionId}/rollback`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
        .send({ reason: 'wracamy' })
        .expect(200);
      expect(firstRollback.body.idempotentReplay).toBeFalsy();
      const revertVersionId = firstRollback.body?.revertSnapshot?.versionId;
      expect(typeof revertVersionId).toBe('string');
      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint', 'restore']);

      // Retry — same header, same body. Must NOT create a second
      // `rollback_revert` snapshot nor append a second `restore` event.
      const retryRollback = await request(app)
        .post(`/api/document-studio/${artifactId}/snapshots/${versionId}/rollback`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
        .send({ reason: 'wracamy' })
        .expect(200);

      expect(retryRollback.body.idempotentReplay).toBe(true);
      expect(retryRollback.body?.revertSnapshot?.versionId).toBe(revertVersionId);
      expect(retryRollback.body?.restoredFrom?.versionId).toBe(versionId);
      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint', 'restore']);

      const snapshots = await request(app)
        .get(`/api/document-studio/${artifactId}/snapshots`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);
      // Total count (not just presence of the original revert versionId) is
      // the decisive check — the lineage event itself dedupes on
      // `idempotency_key` even if `rollbackDocumentToVersion` ran a second
      // time and minted a NEW `rollback_revert` snapshot with a different id.
      // Exactly two snapshots must exist: the original checkpoint, and the
      // ONE revert snapshot from the first (non-replayed) rollback.
      expect(snapshots.body.snapshots).toHaveLength(2);
      expect(
        (snapshots.body.snapshots as Array<{ versionId: string }>).filter(
          (s) => s.versionId === revertVersionId
        )
      ).toHaveLength(1);
    });

    it('CONCURRENCY (restore) — two genuinely concurrent rollback requests with the SAME Idempotency-Key produce EXACTLY ONE `restore` event and ONE `rollback_revert` snapshot', async () => {
      const { artifactId } = await seedDocument(ORG_A, USER_A, 'MAT-010R Doc Restore Concurrency');
      const snap = await request(app)
        .post(`/api/document-studio/${artifactId}/snapshots`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ label: 'przed korektą', reason: 'manual' })
        .expect(201);
      const versionId = snap.body?.snapshot?.versionId;
      const idemKey = `idem-restore-concurrent-${uuidv4()}`;

      const send = () =>
        request(app)
          .post(`/api/document-studio/${artifactId}/snapshots/${versionId}/rollback`)
          .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
          .send({ reason: 'równolegle' });

      const call1 = send();
      const call2 = send();
      const [res1, res2] = await Promise.all([call1, call2]);

      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      const revertIds = [res1.body?.revertSnapshot?.versionId, res2.body?.revertSnapshot?.versionId];
      expect(revertIds[0]).toBeTruthy();
      expect(revertIds[0]).toBe(revertIds[1]);
      const replayFlags = [res1.body.idempotentReplay, res2.body.idempotentReplay];
      expect(replayFlags.filter((f) => f === true)).toHaveLength(1);
      expect(replayFlags.filter((f) => !f)).toHaveLength(1);

      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint', 'restore']);
      const snapshots = await request(app)
        .get(`/api/document-studio/${artifactId}/snapshots`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);
      // Exactly two: the original checkpoint, and ONE revert snapshot.
      expect(snapshots.body.snapshots).toHaveLength(2);
    });

    it('DOUBLE FAILURE (restore) — the durable claim write fails: the route returns 500 CLAIM_ACQUIRE_FAILED BEFORE `rollbackDocumentToVersion` runs, zero rollback_revert rows exist, and a retry after the fault clears performs exactly ONE rollback', async () => {
      const { artifactId } = await seedDocument(ORG_A, USER_A, 'MAT-010R Doc Restore Double Failure');
      const snap = await request(app)
        .post(`/api/document-studio/${artifactId}/snapshots`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ label: 'target', reason: 'manual' })
        .expect(201);
      const versionId = snap.body?.snapshot?.versionId;
      const idemKey = `idem-restore-doublefail-${uuidv4()}`;

      operationClaimService.__setOperationClaimAcquireFaultForTests(true);
      let failedRes: any;
      try {
        failedRes = await request(app)
          .post(`/api/document-studio/${artifactId}/snapshots/${versionId}/rollback`)
          .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
          .send({ reason: 'double failure' });
      } finally {
        operationClaimService.__setOperationClaimAcquireFaultForTests(false);
      }

      expect(failedRes.status).toBe(500);
      expect(failedRes.body.success).toBe(false);
      expect(failedRes.body.code).toBe('CLAIM_ACQUIRE_FAILED');

      // Zero business mutation beyond the initial checkpoint: no `restore`
      // event, no second snapshot row.
      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint']);
      const zeroRevert = await request(app)
        .get(`/api/document-studio/${artifactId}/snapshots`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);
      expect(zeroRevert.body.snapshots).toHaveLength(1);

      // Retry, same key, fault cleared — exactly ONE rollback now.
      const retry = await request(app)
        .post(`/api/document-studio/${artifactId}/snapshots/${versionId}/rollback`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
        .send({ reason: 'double failure' })
        .expect(200);
      expect(retry.body.idempotentReplay).toBeFalsy();

      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['checkpoint', 'restore']);
      const oneRevert = await request(app)
        .get(`/api/document-studio/${artifactId}/snapshots`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);
      expect(oneRevert.body.snapshots).toHaveLength(2);
    });

    it('REAL ROUTE — GET /:artifactId/export/:format records `export`, including markdown (previously recorded nowhere)', async () => {
      const { artifactId } = await seedDocument(ORG_A, USER_A, 'MAT-010R Doc Export');

      await request(app)
        .get(`/api/document-studio/${artifactId}/export/markdown`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);

      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['export']);
      const ev = (await dbEvents(ORG_A, artifactId))[0];
      // Markdown exports have no `presentation_export_records` counterpart and
      // no `recordCompletedExport` call (that path is docx/pdf only) — before
      // MAT-010 this export left NO trace anywhere.
      expect(JSON.parse(ev.detail_json).format).toBe('markdown');
      expect(ev.actor_user_id).toBe(USER_A);

      // NEGATIVE CONTROL — an unsupported format is rejected before any write.
      await request(app)
        .get(`/api/document-studio/${artifactId}/export/exe`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(400);
      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['export']);
    });

    it('REAL ROUTE — share-link mint -> UNAUTHENTICATED public read -> revoke, all recorded, no token material stored', async () => {
      const { artifactId } = await seedDocument(ORG_A, USER_A, 'MAT-010R Doc Share');

      const minted = await request(app)
        .post(`/api/document-studio/${artifactId}/share-links`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ accessScope: 'read', label: 'klient' })
        .expect(201);
      const link = minted.body.shareLink;
      expect(typeof link.token).toBe('string');
      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['share_minted']);

      // THE unauthenticated public reader — this router is mounted OUTSIDE
      // verifyToken, so no auth headers are sent at all.
      await request(app)
        .post('/api/document-studio/share-links/document')
        .send({ token: link.token })
        .expect(200);

      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['share_minted', 'public_open']);
      const openEvent = (await dbEvents(ORG_A, artifactId)).find(
        (e) => e.event_type === 'public_open'
      );
      expect(openEvent.actor_user_id).toBeNull();
      expect(openEvent.organization_id).toBe(ORG_A);

      // Revoke through the real route.
      await request(app)
        .post(`/api/document-studio/share-links/${link.shareLinkId}/revoke`)
        .set(authHeaders(ORG_A, USER_A))
        .send({ reason: 'koniec przeglądu' })
        .expect(200);

      expect(await dbEventTypes(ORG_A, artifactId)).toEqual([
        'share_minted',
        'public_open',
        'share_revoked',
      ]);

      // NEGATIVE CONTROL — the revoked token is dead and records no second open.
      await request(app)
        .post('/api/document-studio/share-links/document')
        .send({ token: link.token })
        .expect(404);
      // ...and an unknown token likewise.
      await request(app)
        .post('/api/document-studio/share-links/document')
        .send({ token: `unknown-${uuidv4()}` })
        .expect(404);

      expect(await dbEventTypes(ORG_A, artifactId)).toEqual([
        'share_minted',
        'public_open',
        'share_revoked',
      ]);

      // No token material anywhere in the lineage — only the non-secret
      // shareLinkId, which is what correlates mint and revoke.
      const events = await dbEvents(ORG_A, artifactId);
      const serialized = JSON.stringify(events);
      expect(serialized).not.toContain(link.token);
      if (link.tokenHash) expect(serialized).not.toContain(link.tokenHash);
      expect(JSON.parse(events[0].detail_json).shareLinkId).toBe(link.shareLinkId);
    });

    it('REQUEST-BOUND IDEMPOTENCY (share_minted) — retrying the same mint request with the same Idempotency-Key returns the SAME share link/credential, appends no second `share_minted` event, and mints no second live token', async () => {
      const { artifactId } = await seedDocument(ORG_A, USER_A, 'MAT-010R Doc Share Idempotent');
      const idemKey = `idem-share-${uuidv4()}`;

      const first = await request(app)
        .post(`/api/document-studio/${artifactId}/share-links`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
        .send({ accessScope: 'read', label: 'klient' })
        .expect(201);
      expect(first.body.idempotentReplay).toBeFalsy();
      const shareLinkId = first.body.shareLink.shareLinkId;
      const token = first.body.shareLink.token;
      expect(typeof shareLinkId).toBe('string');
      expect(typeof token).toBe('string');
      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['share_minted']);

      // Retry — same header, same body. Must NOT mint a second live token.
      const retry = await request(app)
        .post(`/api/document-studio/${artifactId}/share-links`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
        .send({ accessScope: 'read', label: 'klient' })
        .expect(201);

      expect(retry.body.idempotentReplay).toBe(true);
      expect(retry.body.shareLink.shareLinkId).toBe(shareLinkId);
      expect(retry.body.shareLink.token).toBe(token);
      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['share_minted']);

      // Decisive check: exactly ONE active link exists for this artifact —
      // the lineage event alone dedupes on `idempotency_key` even if
      // `createShareLink` minted a genuinely second, independent token.
      const listRes = await request(app)
        .get(`/api/document-studio/${artifactId}/share-links`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);
      expect(listRes.body.shareLinks).toHaveLength(1);

      // The original token still works exactly once here (sanity — proves
      // it is a genuine, live, usable credential, not a stub).
      await request(app)
        .post('/api/document-studio/share-links/document')
        .send({ token })
        .expect(200);

      // A DIFFERENT Idempotency-Key mints a genuinely new, second link.
      const second = await request(app)
        .post(`/api/document-studio/${artifactId}/share-links`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': `idem-share-${uuidv4()}` })
        .send({ accessScope: 'read', label: 'klient' })
        .expect(201);
      expect(second.body.idempotentReplay).toBeFalsy();
      expect(second.body.shareLink.shareLinkId).not.toBe(shareLinkId);
      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['share_minted', 'public_open', 'share_minted']);
    });

    it('CONCURRENCY (share_minted) — two genuinely concurrent mint requests with the SAME Idempotency-Key produce EXACTLY ONE `share_minted` event and ONE live token', async () => {
      const { artifactId } = await seedDocument(ORG_A, USER_A, 'MAT-010R Doc Share Concurrency');
      const idemKey = `idem-share-concurrent-${uuidv4()}`;

      const send = () =>
        request(app)
          .post(`/api/document-studio/${artifactId}/share-links`)
          .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
          .send({ accessScope: 'read', label: 'równolegle' });

      const call1 = send();
      const call2 = send();
      const [res1, res2] = await Promise.all([call1, call2]);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      const shareLinkIds = [res1.body.shareLink.shareLinkId, res2.body.shareLink.shareLinkId];
      expect(shareLinkIds[0]).toBeTruthy();
      expect(shareLinkIds[0]).toBe(shareLinkIds[1]);
      expect(res1.body.shareLink.token).toBe(res2.body.shareLink.token);
      const replayFlags = [res1.body.idempotentReplay, res2.body.idempotentReplay];
      expect(replayFlags.filter((f) => f === true)).toHaveLength(1);
      expect(replayFlags.filter((f) => !f)).toHaveLength(1);

      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['share_minted']);
      const listRes = await request(app)
        .get(`/api/document-studio/${artifactId}/share-links`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);
      expect(listRes.body.shareLinks).toHaveLength(1);
    });

    it('DOUBLE FAILURE (share_minted) — the durable claim write fails: the route returns 500 CLAIM_ACQUIRE_FAILED BEFORE `createShareLink` runs, zero live links exist, and a retry after the fault clears mints exactly ONE credential', async () => {
      const { artifactId } = await seedDocument(ORG_A, USER_A, 'MAT-010R Doc Share Double Failure');
      const idemKey = `idem-share-doublefail-${uuidv4()}`;

      operationClaimService.__setOperationClaimAcquireFaultForTests(true);
      let failedRes: any;
      try {
        failedRes = await request(app)
          .post(`/api/document-studio/${artifactId}/share-links`)
          .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
          .send({ accessScope: 'read', label: 'double failure' });
      } finally {
        operationClaimService.__setOperationClaimAcquireFaultForTests(false);
      }

      expect(failedRes.status).toBe(500);
      expect(failedRes.body.success).toBe(false);
      expect(failedRes.body.code).toBe('CLAIM_ACQUIRE_FAILED');

      expect(await dbEventTypes(ORG_A, artifactId)).toEqual([]);
      const zeroLinks = await request(app)
        .get(`/api/document-studio/${artifactId}/share-links`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);
      expect(zeroLinks.body.shareLinks).toHaveLength(0);

      // Retry, same key, fault cleared — exactly ONE credential now.
      const retry = await request(app)
        .post(`/api/document-studio/${artifactId}/share-links`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': idemKey })
        .send({ accessScope: 'read', label: 'double failure' })
        .expect(201);
      expect(retry.body.idempotentReplay).toBeFalsy();
      expect(typeof retry.body.shareLink.token).toBe('string');

      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(['share_minted']);
      const oneLink = await request(app)
        .get(`/api/document-studio/${artifactId}/share-links`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);
      expect(oneLink.body.shareLinks).toHaveLength(1);
    });

    it('REAL ROUTE — the canonical trace API returns the document lineage, and org B gets a 404', async () => {
      const { artifactId } = await seedDocument(ORG_A, USER_A, 'MAT-010R Doc Trace');
      await request(app)
        .get(`/api/document-studio/${artifactId}/export/markdown`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);

      const trace = await request(app)
        .get(`/api/artifact-lineage/document/${artifactId}`)
        .set(authHeaders(ORG_A, USER_A))
        .expect(200);
      expect(trace.body.receipt.artifactKind).toBe('document');
      expect(trace.body.receipt.events.map((e: any) => e.eventType)).toEqual(['export']);

      await request(app)
        .get(`/api/artifact-lineage/document/${artifactId}`)
        .set(authHeaders(ORG_B, USER_B))
        .expect(404);

      // NEGATIVE CONTROL — org B driving the real document routes against org
      // A's artifact records nothing, in either tenant.
      const before = await dbEventTypes(ORG_A, artifactId);
      await request(app)
        .get(`/api/document-studio/${artifactId}/export/markdown`)
        .set(authHeaders(ORG_B, USER_B));
      await request(app)
        .post(`/api/document-studio/${artifactId}/snapshots`)
        .set(authHeaders(ORG_B, USER_B))
        .send({ label: 'cross tenant' });

      expect(await dbEventTypes(ORG_A, artifactId)).toEqual(before);
      expect(await dbReceipt(ORG_B, artifactId)).toBeUndefined();
    });

    it('TENANT ISOLATION (request-bound idempotency) — two different organizations independently reusing the LITERAL SAME Idempotency-Key header on their OWN documents never cross-contaminate: each gets its own snapshot, and org C never sees org A\'s replay', async () => {
      // Uses ORG_C, not ORG_B: ORG_B is load-bearing elsewhere in this file
      // as the "has exactly zero receipts" negative control (see the closing
      // "org-scoped listing" test), so giving it a real checkpoint here would
      // break that unrelated assertion.
      const { artifactId: docA } = await seedDocument(ORG_A, USER_A, 'MAT-010R Doc Idem Tenant A');
      const { artifactId: docC } = await seedDocument(ORG_C, USER_C, 'MAT-010R Doc Idem Tenant C');
      // Deliberately the SAME raw header value across both tenants — the
      // derived DB key must still diverge because it is salted with
      // sourceRecordId (and the lookup itself is organization_id-scoped).
      const sharedRawKey = `idem-shared-across-tenants-${uuidv4()}`;

      const a1 = await request(app)
        .post(`/api/document-studio/${docA}/snapshots`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': sharedRawKey })
        .send({ label: 'A', reason: 'manual' })
        .expect(201);
      const c1 = await request(app)
        .post(`/api/document-studio/${docC}/snapshots`)
        .set({ ...authHeaders(ORG_C, USER_C), 'Idempotency-Key': sharedRawKey })
        .send({ label: 'C', reason: 'manual' })
        .expect(201);

      expect(a1.body.idempotentReplay).toBeFalsy();
      expect(c1.body.idempotentReplay).toBeFalsy();
      expect(a1.body.snapshot.versionId).not.toBe(c1.body.snapshot.versionId);

      // Retrying org A's request with the SAME header replays org A's OWN
      // snapshot — never org C's, despite the identical raw key.
      const a2 = await request(app)
        .post(`/api/document-studio/${docA}/snapshots`)
        .set({ ...authHeaders(ORG_A, USER_A), 'Idempotency-Key': sharedRawKey })
        .send({ label: 'A', reason: 'manual' })
        .expect(201);
      expect(a2.body.idempotentReplay).toBe(true);
      expect(a2.body.snapshot.versionId).toBe(a1.body.snapshot.versionId);

      expect(await dbEventTypes(ORG_A, docA)).toEqual(['checkpoint']);
      expect(await dbEventTypes(ORG_C, docC)).toEqual(['checkpoint']);
    });
  });

  // =====================================================================
  // All three types land in ONE canonical store — proven from REAL routes
  // =====================================================================
  it('the org-scoped listing surfaces presentation AND document receipts created purely by real-route traffic', async () => {
    const list = await request(app)
      .get('/api/artifact-lineage/receipts')
      .set(authHeaders(ORG_A, USER_A))
      .expect(200);
    const kinds = new Set(list.body.receipts.map((r: any) => r.artifactKind));
    expect(kinds.has('presentation')).toBe(true);
    expect(kinds.has('document')).toBe(true);

    // Tenant scoping of the listing itself.
    const orgBList = await request(app)
      .get('/api/artifact-lineage/receipts')
      .set(authHeaders(ORG_B, USER_B))
      .expect(200);
    expect(orgBList.body.receipts).toHaveLength(0);
  });
});
