/** @vitest-environment node */

/**
 * MAT-010 — Document Studio durability coverage for the `recordLineageEventSafe`
 * -> `recordLineageEventTracked` + `respondIfLineageLost` conversion in
 * `document-studio.routes.ts`.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 * `artifactLineage.mat010-routes.postgres.integration.test.ts` proves the
 * document lineage hooks fire from real routes on the GOLDEN path. It does
 * NOT prove what happens when the durable write fails once (recoverable) or
 * twice (the genuine double-failure Codex's second-round review required the
 * route to fail closed on, instead of the old `recordLineageEventSafe`
 * swallow-and-succeed behavior). This file closes that gap for Document, the
 * same way `artifactLineage.mat010.postgres.integration.test.ts` closed it
 * for Workbook's `version` hook.
 *
 * Picks the `version` event (`PUT /:artifactId/content`) because it is the
 * one Document call site with a real, verified CAS guard
 * (`updateDocumentManualContent` rejects a stale `expectedVersion` with
 * `DocumentManualSaveConflictError` BEFORE writing — documentStudioService.ts
 * around line 2452), so a client retry cannot double-apply the mutation, and
 * because `artifactLineage.mat010-routes.postgres.integration.test.ts`
 * already exercises this exact route's golden path, giving this file a
 * proven template to extend rather than a new one to invent.
 *
 * ── A NOTE ON WHAT "THE BUSINESS MUTATION COMMITTED" MEANS HERE ───────────
 * Unlike Workbook (`generated_workbooks.schema_json`, a single row/column
 * overwritten synchronously in the same request), Document's manual-content
 * save does NOT touch `wave5_artifacts` at all. `getDocumentArtifact` reads
 * the in-process `schemaOverlayStore` cache first and falls back to
 * `wave5_artifacts` only when no overlay exists (documentStudioService.ts
 * `getDocumentArtifact`, ~line 812-827). A manual save writes ONLY the
 * overlay — `persistSchemaOverlayWriteThrough` sets the in-memory cache
 * synchronously and fires `persistSchemaOverlay` (documentEditorStateRegistryDao.ts)
 * at the DB WITHOUT awaiting it. So the durable proof of "the business
 * mutation committed and was not rolled back" for THIS route is a row in
 * `document_studio_schema_overlay`, not `wave5_artifacts` — verified against
 * the actual code path rather than assumed by analogy to Workbook. Because
 * that DB write is fire-and-forget, the DOUBLE FAILURE test below polls for
 * it briefly instead of asserting immediately, to avoid a false negative from
 * a race rather than a real defect.
 *
 * REQUIRES `NODE_ENV=test RUN_DB_TESTS=1` with `DATABASE_URL` pointed at a
 * real, migrated Postgres. `NODE_ENV=test` WITHOUT `RUN_DB_TESTS=1` silently
 * swaps in a mock DB and this entire suite would pass against nothing. Run:
 *
 *   DATABASE_URL=postgresql://consultinity:consultinity@localhost:28971/consultinity \
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 \
 *   npx vitest run --retry=0 \
 *     tests/integration/routes/artifactLineage.mat010-document-durability.postgres.integration.test.ts
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
const ORG_A = `org-mat010dd-a-${SUFFIX}`;
const USER_A = `user-mat010dd-a-${SUFFIX}`;

// vi.mock calls are hoisted to the top of the module by vitest.
// Auth is faked so the tenant/user are controllable; EVERYTHING ELSE that
// matters (the routes, the hooks, the DB) is real.
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

vi.mock('../../../server/src/utils/Logger.js', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// The artifact-run registry is a different subsystem. MAT-010 resolves the
// canonical artifact id by reading `v8_artifact_origin_links` DIRECTLY; not
// exercised by the `version` route under test, but mocked so module load
// never depends on the real registry's own dependencies.
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

describe('MAT-010 — Document Studio lineage durability (recordLineageEventTracked + respondIfLineageLost, real Postgres)', () => {
  let app: express.Express;
  let pool: Pool;
  let lineageService: typeof import('../../../server/src/services/lineage/artifactLineageService.js');
  const createdDocIds: string[] = [];

  beforeAll(async () => {
    if (process.env.NODE_ENV !== 'test' || process.env.RUN_DB_TESTS !== '1') {
      throw new Error(
        'This suite requires NODE_ENV=test RUN_DB_TESTS=1 with DATABASE_URL pointed at a real, migrated Postgres.'
      );
    }
    const { default: documentStudioRoutes, documentShareLinkPublicRoutes } = await import(
      '../../../server/src/routes/document-studio.routes.js'
    );
    lineageService = await import(
      '../../../server/src/services/lineage/artifactLineageService.js'
    );

    app = express();
    app.use(express.json({ limit: '10mb' }));
    // Mounted in the SAME order as Gateway.ts:887-889 and the sibling
    // real-route suite — the public share-link router first, then the
    // authenticated router.
    app.use('/api/document-studio', documentShareLinkPublicRoutes);
    app.use('/api/document-studio', documentStudioRoutes);

    pool = new Pool({ connectionString: process.env.DATABASE_URL });

    await pool.query(`INSERT INTO organizations (id) VALUES ($1) ON CONFLICT DO NOTHING`, [
      ORG_A,
    ]);
  });

  afterAll(async () => {
    // Hygiene (CLAUDE.md): probes clean up after themselves, zero test records.
    if (createdDocIds.length) {
      // Codex final review — discovered while verifying zero-leftover-records
      // on a truly fresh container: `document_version_snapshots` was missing
      // from this cleanup (pre-existing gap, not introduced this round —
      // this file's version tests create snapshot rows via the real
      // checkpoint route but this list was never extended to match). Fixed.
      await pool.query(`DELETE FROM document_version_snapshots WHERE artifact_id = ANY($1)`, [
        createdDocIds,
      ]);
      await pool.query(`DELETE FROM document_studio_schema_overlay WHERE artifact_id = ANY($1)`, [
        createdDocIds,
      ]);
      await pool.query(`DELETE FROM document_lifecycle_states WHERE artifact_id = ANY($1)`, [
        createdDocIds,
      ]);
      await pool.query(`DELETE FROM wave5_artifacts WHERE artifact_id = ANY($1)`, [createdDocIds]);
    }
    await pool.query(`DELETE FROM artifact_lineage_pending_events WHERE organization_id = $1`, [
      ORG_A,
    ]);
    await pool.query(`DELETE FROM artifact_lineage_events WHERE organization_id = $1`, [ORG_A]);
    await pool.query(`DELETE FROM artifact_lineage_receipts WHERE organization_id = $1`, [ORG_A]);
    await pool.query(`DELETE FROM organizations WHERE id = $1`, [ORG_A]);
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

  /**
   * Seeds the artifact row directly, same fixture shape as the sibling
   * real-route suite (`artifactLineage.mat010-routes.postgres.integration.test.ts`
   * `seedDocument`) — the only document-creation route (`POST /generate`)
   * needs a live LLM, out of scope for this file.
   */
  async function seedDocument(orgId: string, userId: string, title: string) {
    const artifactId = `doc-mat010dd-${uuidv4()}`;
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
      [artifactId, orgId, title, '# ' + title, userId, nowIso, JSON.stringify(schema)]
    );
    // Lifecycle state is normally seeded by the generation path
    // (`initializeDocumentLifecycle`). Not hard-required by the content-save
    // route itself, but seeded for parity with the sibling suite's fixture.
    await pool.query(
      `INSERT INTO document_lifecycle_states
         (artifact_id, organization_id, status, status_changed_at,
          status_changed_by, status_reason, history_json, updated_at)
       VALUES ($1, $2, 'draft', $3, $4, 'fixture', '[]'::jsonb, $3)
       ON CONFLICT (artifact_id, organization_id) DO NOTHING`,
      [artifactId, orgId, nowIso, userId]
    );

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
    const updatedAt = res.body?.schema?.updatedAt;
    expect(typeof updatedAt).toBe('string');
    return updatedAt;
  }

  /**
   * Polls `document_studio_schema_overlay` for the just-written content.
   * Necessary because `persistSchemaOverlayWriteThrough`
   * (documentStudioService.ts) fires the durable overlay write WITHOUT
   * awaiting it — the in-memory cache (and thus the route's own response) is
   * updated synchronously, but the Postgres row can land a tick or two later.
   * A short poll avoids a false failure from that race; it is not masking a
   * real defect (the assertions below still fail hard if the row never
   * appears within the budget).
   *
   * `schema_json` is a `jsonb` column — `pg` auto-deserializes it into a JS
   * object, not a string, so the containment check runs against
   * `JSON.stringify(row.schema_json)`, not `String(row.schema_json)` (which
   * would just yield `"[object Object]"` and never match anything).
   */
  async function waitForOverlayContaining(
    artifactId: string,
    orgId: string,
    needle: string,
    { attempts = 30, intervalMs = 100 }: { attempts?: number; intervalMs?: number } = {}
  ): Promise<Record<string, unknown>> {
    for (let i = 0; i < attempts; i++) {
      const r = await pool.query(
        `SELECT * FROM document_studio_schema_overlay
          WHERE artifact_id = $1 AND organization_id = $2`,
        [artifactId, orgId]
      );
      const row = r.rows[0];
      if (row && JSON.stringify(row.schema_json).includes(needle)) {
        return row;
      }
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
    throw new Error(
      `document_studio_schema_overlay row for ${artifactId} never contained "${needle}" within budget`
    );
  }

  // =====================================================================
  // SINGLE FAILURE — direct lineage write fails, durable pending outbox
  // survives, reconciliation recovers exactly one event.
  // =====================================================================
  it('SINGLE FAILURE (version) — direct write fails, durable pending marker survives, reconciliation produces exactly one `version` event with the correct actor/idempotency key, and a second reconcile is a no-op', async () => {
    const { artifactId } = await seedDocument(ORG_A, USER_A, 'MAT-010DD Version Single Failure');
    const expectedVersion = await currentUpdatedAt(artifactId, ORG_A, USER_A);

    lineageService.__setLineageDirectWriteFaultForTests(true);
    let saveRes: any;
    try {
      saveRes = await request(app)
        .put(`/api/document-studio/${artifactId}/content`)
        .set(authHeaders(ORG_A, USER_A))
        .send({
          expectedVersion,
          sections: [
            {
              sectionId: 'sec-1',
              heading: 'Wprowadzenie',
              blocks: [
                {
                  blockId: 'b-1',
                  type: 'paragraph',
                  content: 'Single-failure treść.',
                  isAssumption: false,
                },
              ],
            },
          ],
        })
        .expect(200);
    } finally {
      lineageService.__setLineageDirectWriteFaultForTests(false);
    }
    expect(saveRes.body?.schema?.sections?.[0]?.blocks?.[0]?.content).toBe(
      'Single-failure treść.'
    );

    // Direct write really failed — no receipt/event exists yet.
    expect(await dbEventTypes(ORG_A, artifactId)).toEqual([]);

    // Durable pending marker exists, correctly scoped.
    const pendingRows = await dbPending(ORG_A, artifactId);
    expect(pendingRows).toHaveLength(1);
    expect(pendingRows[0].event_type).toBe('version');
    expect(pendingRows[0].organization_id).toBe(ORG_A);

    // "Restart" is simulated the same way every other durability test in this
    // package simulates it: nothing survives in process memory (the pending
    // row is the only durable state), so calling the reconciliation entry
    // point fresh IS the restart-recovery path.
    const firstReconcile = await lineageService.reconcilePendingLineageEvents({
      organizationId: ORG_A,
    });
    expect(firstReconcile.recovered).toBeGreaterThanOrEqual(1);
    expect(firstReconcile.stillFailing).toBe(0);

    const receipt = await dbReceipt(ORG_A, artifactId);
    expect(receipt).toBeTruthy();
    expect(receipt.artifact_kind).toBe('document');

    const eventsAfter = await dbEvents(ORG_A, artifactId);
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
      (await dbEvents(ORG_A, artifactId)).filter((e) => e.event_type === 'version')
    ).toHaveLength(1);
  });

  // =====================================================================
  // DOUBLE FAILURE — direct write AND the durable pending/outbox write BOTH
  // fail. The route must decline unconditional success (Codex review, second
  // round: Option B fail-closed) instead of the old recordLineageEventSafe
  // swallow.
  // =====================================================================
  it('DOUBLE FAILURE (version) — direct write AND pending write both fail: the route returns 500 LINEAGE_RECOVERY_REQUIRED (not the normal 200), and the underlying content mutation committed anyway', async () => {
    const { artifactId } = await seedDocument(ORG_A, USER_A, 'MAT-010DD Version Double Failure');
    const expectedVersion = await currentUpdatedAt(artifactId, ORG_A, USER_A);

    lineageService.__setLineageDirectWriteFaultForTests(true);
    lineageService.__setLineagePendingWriteFaultForTests(true);
    let saveRes: any;
    try {
      saveRes = await request(app)
        .put(`/api/document-studio/${artifactId}/content`)
        .set(authHeaders(ORG_A, USER_A))
        .send({
          expectedVersion,
          sections: [
            {
              sectionId: 'sec-1',
              heading: 'Wprowadzenie',
              blocks: [
                {
                  blockId: 'b-1',
                  type: 'paragraph',
                  content: 'Double-failure treść.',
                  isAssumption: false,
                },
              ],
            },
          ],
        })
        .expect(500);
    } finally {
      lineageService.__setLineageDirectWriteFaultForTests(false);
      lineageService.__setLineagePendingWriteFaultForTests(false);
    }
    expect(saveRes.body.success).toBe(false);
    expect(saveRes.body.code).toBe('LINEAGE_RECOVERY_REQUIRED');
    // The normal success body (`{ schema }`) must NOT be present alongside a
    // 500 — the route must not accidentally leak the old success shape.
    expect(saveRes.body.schema).toBeUndefined();

    // Zero durable lineage trace either — the genuine double-failure case.
    expect(await dbEventTypes(ORG_A, artifactId)).toEqual([]);
    expect(await dbPending(ORG_A, artifactId)).toHaveLength(0);

    // The BUSINESS mutation itself is NOT rolled back — `updateDocumentManualContent`
    // already committed the overlay write before the lineage hook ran, and
    // MAT-05..09 must never regress because lineage is unavailable. Only the
    // HTTP response is honest about the missing audit trail. See this file's
    // header comment for why the durable proof lives in
    // `document_studio_schema_overlay`, not `wave5_artifacts`, for this
    // specific route.
    const overlayRow = await waitForOverlayContaining(
      artifactId,
      ORG_A,
      'Double-failure treść.'
    );
    expect(overlayRow).toBeTruthy();

    // `wave5_artifacts` itself is untouched by this route (by design — the
    // manual-content save never writes it), so its original seeded content
    // stays exactly as seeded. Confirmed here so this file's own claim above
    // is not just asserted but proven against the real row.
    const wave5Row = await pool.query(
      `SELECT content FROM wave5_artifacts WHERE artifact_id = $1 AND organization_id = $2`,
      [artifactId, ORG_A]
    );
    expect(wave5Row.rows[0].content).toBe('# MAT-010DD Version Double Failure');
  });

  // =====================================================================
  // RED-GREEN proof that the DOUBLE FAILURE test above is non-vacuous.
  // Mandatory per the MAT-010 durability protocol: temporarily neuter
  // `respondIfLineageLost` (always return `false`, i.e. always report
  // success), prove the DOUBLE FAILURE test's core assertion FAILS against
  // the old (pre-fix) 200 behavior, then restore the exact original code and
  // prove green again. Executed here as an isolated in-process monkeypatch
  // of the imported module rather than a source edit, so this file does not
  // need to touch `document-studio.routes.ts` a second time to prove it.
  // =====================================================================
  it('RED-GREEN proof — DOUBLE FAILURE (version) fails against the old unconditional-success behavior, proving the test is non-vacuous', async () => {
    const { artifactId } = await seedDocument(
      ORG_A,
      USER_A,
      'MAT-010DD Version RedGreen Proof'
    );
    const expectedVersion = await currentUpdatedAt(artifactId, ORG_A, USER_A);

    // RED: force `recordLineageEventTracked` itself to report `durable: true`
    // even though both underlying writes failed — this is EXACTLY what
    // `respondIfLineageLost`'s `if (outcome.durable) return false;` guard
    // would do if that line were deleted/inverted, without needing a second,
    // separate edit to the route file to prove it.
    const trackedSpy = vi
      .spyOn(lineageService, 'recordLineageEventTracked')
      .mockResolvedValue({ durable: true, event: null });

    lineageService.__setLineageDirectWriteFaultForTests(true);
    lineageService.__setLineagePendingWriteFaultForTests(true);
    let redRes: any;
    try {
      redRes = await request(app)
        .put(`/api/document-studio/${artifactId}/content`)
        .set(authHeaders(ORG_A, USER_A))
        .send({
          expectedVersion,
          sections: [
            {
              sectionId: 'sec-1',
              heading: 'Wprowadzenie',
              blocks: [
                { blockId: 'b-1', type: 'paragraph', content: 'RED treść.', isAssumption: false },
              ],
            },
          ],
        });
    } finally {
      lineageService.__setLineageDirectWriteFaultForTests(false);
      lineageService.__setLineagePendingWriteFaultForTests(false);
      trackedSpy.mockRestore();
    }

    // Proves the DOUBLE FAILURE test above is non-vacuous: with the guard
    // neutered, the route WOULD have reported the old 200 unconditional
    // success (the exact regression Codex's second-round review closed).
    expect(redRes.status).toBe(200);
    expect(redRes.body?.schema).toBeTruthy();

    // GREEN: with the real (unmocked) `respondIfLineageLost` restored — the
    // spy above is already torn down via `mockRestore()` in the `finally` —
    // the SAME double-failure condition on a fresh save now correctly
    // returns 500 again, confirmed on the same artifact for a second edit.
    const secondExpectedVersion = await currentUpdatedAt(artifactId, ORG_A, USER_A);
    lineageService.__setLineageDirectWriteFaultForTests(true);
    lineageService.__setLineagePendingWriteFaultForTests(true);
    let greenRes: any;
    try {
      greenRes = await request(app)
        .put(`/api/document-studio/${artifactId}/content`)
        .set(authHeaders(ORG_A, USER_A))
        .send({
          expectedVersion: secondExpectedVersion,
          sections: [
            {
              sectionId: 'sec-1',
              heading: 'Wprowadzenie',
              blocks: [
                {
                  blockId: 'b-1',
                  type: 'paragraph',
                  content: 'GREEN treść.',
                  isAssumption: false,
                },
              ],
            },
          ],
        });
    } finally {
      lineageService.__setLineageDirectWriteFaultForTests(false);
      lineageService.__setLineagePendingWriteFaultForTests(false);
    }
    expect(greenRes.status).toBe(500);
    expect(greenRes.body.code).toBe('LINEAGE_RECOVERY_REQUIRED');
  });
});
