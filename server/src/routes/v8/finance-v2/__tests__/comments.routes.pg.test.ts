/**
 * Finance v3 canonical adapter — Pakiet ROUTES_EXPOSURE, Comments +
 * Review checklist (`/comments/*`, `/review-checklist/*`), real PostgreSQL +
 * real HTTP.
 *
 * Covers:
 *   1. Mount proof.
 *   2. Full comment lifecycle (create/get/list/resolve/reopen/assign) +
 *      blocking-comment preflight, against the real migrated tables.
 *   3. Review checklist lifecycle (add/check/uncheck/required/all-checked).
 *   4. Cross-tenant matrix, both directions, with independent SQL
 *      confirmation.
 */
import { randomUUID } from 'node:crypto';

import express from 'express';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';

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
  'Finance v2 ROUTES_EXPOSURE — Comments + Review checklist (real HTTP + real PostgreSQL)',
  () => {
    let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
    let av: typeof import('../../../../services/finance/canonical/artifactVersionService.js');
    let financeV2Router: express.Router;

    const orgA = `org-comments-a-${randomUUID()}`;
    const orgB = `org-comments-b-${randomUUID()}`;
    const userA = `user-comments-a-${randomUUID()}`;
    const userB = `user-comments-b-${randomUUID()}`;

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

    let artifactId = '';
    let bvId = '';

    beforeAll(async () => {
      ({ withPinnedPostgresTransaction } =
        await import('../../../../database/PostgresDatabase.js'));
      av = await import('../../../../services/finance/canonical/artifactVersionService.js');
      financeV2Router = (await import('../index.js')).default;

      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?), (?, ?)`, [
          orgA,
          'Comments Tenant A',
          orgB,
          'Comments Tenant B',
        ])
      );

      appA = appAsOrg(orgA, userA);
      appB = appAsOrg(orgB, userB);

      const artifact = await av.createArtifact({
        organizationId: orgA,
        artifactType: 'STATEMENT_PACK',
        createdBy: userA,
      });
      artifactId = artifact.artifact.artifact_id;
      bvId = artifact.businessVersion.business_version_id;
    }, 120000);

    // -----------------------------------------------------------------
    // Mount proof
    // -----------------------------------------------------------------

    it('MOUNT PROOF: valid context + REAL router, random commentId -> 404 WITH {code:"NOT_FOUND"}', async () => {
      const res = await request(appA).get(`/api/v8/finance-v2/comments/${randomUUID()}`);
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('code', 'NOT_FOUND');
    });

    it('MOUNT PROOF: valid context, path no router in this tree handles -> 404 WITHOUT a code field', async () => {
      const res = await request(appA).get(
        '/api/v8/finance-v2/this-path-truly-does-not-exist-anywhere'
      );
      expect(res.status).toBe(404);
      expect(res.body).not.toHaveProperty('code');
    });

    // -----------------------------------------------------------------
    // Comment lifecycle
    // -----------------------------------------------------------------

    let commentId = '';
    let blockingCommentId = '';

    const userA2 = `user-comments-a2-${randomUUID()}`;

    it('POST /comments — create artifact-level comment', async () => {
      const res = await request(appA)
        .post('/api/v8/finance-v2/comments')
        .send({
          artifactId,
          businessVersionId: bvId,
          body: 'Please double-check this line.',
          mentions: [userA2],
        });
      expect(res.status).toBe(201);
      expect(res.body.data.body).toBe('Please double-check this line.');
      expect(res.body.data.mentions).toEqual([userA2]);
      expect(res.body.data.isBlocking).toBe(false);
      // DTO shape: camelCase only, no raw snake_case columns, no internal organization_id leak.
      expect(res.body.data).not.toHaveProperty('is_blocking');
      expect(res.body.data).not.toHaveProperty('organization_id');
      expect(res.body.data).not.toHaveProperty('artifact_id');
      expect(res.body.data).not.toHaveProperty('business_version_id');
      expect(res.body.data.artifactId).toBe(artifactId);
      expect(res.body.data.businessVersionId).toBe(bvId);
      commentId = res.body.data.id;
    });

    it('POST /comments — empty body -> 400 BODY_REQUIRED', async () => {
      const res = await request(appA)
        .post('/api/v8/finance-v2/comments')
        .send({ artifactId, businessVersionId: bvId, body: '   ' });
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('code', 'BODY_REQUIRED');
    });

    it('GET /comments/:id — round-trips the created comment', async () => {
      const res = await request(appA).get(`/api/v8/finance-v2/comments/${commentId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(commentId);
    });

    it('GET /comments?artifactId= — lists it', async () => {
      const res = await request(appA).get(`/api/v8/finance-v2/comments?artifactId=${artifactId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((c: any) => c.id)).toContain(commentId);
    });

    it('GET /comments — neither artifactId nor businessVersionId -> 400 INVALID_QUERY', async () => {
      const res = await request(appA).get('/api/v8/finance-v2/comments');
      expect(res.status).toBe(400);
      expect(res.body).toHaveProperty('code', 'INVALID_QUERY');
    });

    it('GET /comments/mentions/me — the mentioned same-org user (userA2) sees it, the comment author (userA) does not, org B (cross-tenant) does not either', async () => {
      const appA2 = appAsOrg(orgA, userA2);
      const resA2 = await request(appA2).get('/api/v8/finance-v2/comments/mentions/me');
      expect(resA2.status).toBe(200);
      expect(resA2.body.data.map((c: any) => c.id)).toContain(commentId);

      const resA = await request(appA).get('/api/v8/finance-v2/comments/mentions/me');
      expect(resA.status).toBe(200);
      expect(resA.body.data.map((c: any) => c.id)).not.toContain(commentId);

      // userA2 does not exist in org B's tenant at all — this proves listMentioning is scoped by
      // organization_id FIRST (not just by userId), so a same-string userId in a different org
      // cannot fish for mentions belonging to org A.
      const appB_as_userA2 = appAsOrg(orgB, userA2);
      const resB = await request(appB_as_userA2).get('/api/v8/finance-v2/comments/mentions/me');
      expect(resB.status).toBe(200);
      expect(resB.body.data.map((c: any) => c.id)).not.toContain(commentId);
    });

    it('POST /comments/:id/assign then GET .../assignment — round-trips', async () => {
      const assignRes = await request(appA)
        .post(`/api/v8/finance-v2/comments/${commentId}/assign`)
        .send({ assigneeId: userB });
      expect(assignRes.status).toBe(201);
      expect(assignRes.body.data.assigneeId).toBe(userB);
      expect(assignRes.body.data).not.toHaveProperty('assignee_id');
      expect(assignRes.body.data).not.toHaveProperty('organization_id');
      expect(assignRes.body.data.commentId).toBe(commentId);

      const getRes = await request(appA).get(`/api/v8/finance-v2/comments/${commentId}/assignment`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.assigneeId).toBe(userB);
    });

    it('POST /comments/:id/resolve then reopen — round-trips resolved_at null<->set', async () => {
      const resolveRes = await request(appA).post(
        `/api/v8/finance-v2/comments/${commentId}/resolve`
      );
      expect(resolveRes.status).toBe(200);
      expect(resolveRes.body.data.resolvedAt).not.toBeNull();
      expect(resolveRes.body.data).not.toHaveProperty('resolved_at');

      const doubleResolve = await request(appA).post(
        `/api/v8/finance-v2/comments/${commentId}/resolve`
      );
      expect(doubleResolve.status).toBe(409);
      expect(doubleResolve.body).toHaveProperty('code', 'ALREADY_RESOLVED');

      const reopenRes = await request(appA).post(`/api/v8/finance-v2/comments/${commentId}/reopen`);
      expect(reopenRes.status).toBe(200);
      expect(reopenRes.body.data.resolvedAt).toBeNull();

      const doubleReopen = await request(appA).post(
        `/api/v8/finance-v2/comments/${commentId}/reopen`
      );
      expect(doubleReopen.status).toBe(409);
      expect(doubleReopen.body).toHaveProperty('code', 'NOT_RESOLVED');
    });

    it('blocking comment: GET .../has-unresolved-blocking-comments flips true -> false across resolve', async () => {
      const createRes = await request(appA).post('/api/v8/finance-v2/comments').send({
        artifactId,
        businessVersionId: bvId,
        body: 'BLOCKING — fix before approval',
        isBlocking: true,
      });
      expect(createRes.status).toBe(201);
      blockingCommentId = createRes.body.data.id;

      const beforeRes = await request(appA).get(
        `/api/v8/finance-v2/versions/${bvId}/has-unresolved-blocking-comments`
      );
      expect(beforeRes.status).toBe(200);
      expect(beforeRes.body.data.hasUnresolvedBlockingComments).toBe(true);

      const resolveRes = await request(appA).post(
        `/api/v8/finance-v2/comments/${blockingCommentId}/resolve`
      );
      expect(resolveRes.status).toBe(200);

      const afterRes = await request(appA).get(
        `/api/v8/finance-v2/versions/${bvId}/has-unresolved-blocking-comments`
      );
      expect(afterRes.status).toBe(200);
      expect(afterRes.body.data.hasUnresolvedBlockingComments).toBe(false);
    });

    // -----------------------------------------------------------------
    // Review checklist lifecycle
    // -----------------------------------------------------------------

    let checklistItemId = '';

    it('POST /review-checklist — add item', async () => {
      const res = await request(appA)
        .post('/api/v8/finance-v2/review-checklist')
        .send({ businessVersionId: bvId, item: 'Confirm cash reconciliation', required: true });
      expect(res.status).toBe(201);
      checklistItemId = res.body.data.id;
    });

    it('GET /review-checklist/:businessVersionId/all-required-checked — false before check, true after', async () => {
      const before = await request(appA).get(
        `/api/v8/finance-v2/review-checklist/${bvId}/all-required-checked`
      );
      expect(before.status).toBe(200);
      expect(before.body.data.allRequiredChecked).toBe(false);

      const checkRes = await request(appA).post(
        `/api/v8/finance-v2/review-checklist/${checklistItemId}/check`
      );
      expect(checkRes.status).toBe(200);
      expect(checkRes.body.data.checkedAt).not.toBeNull();
      expect(checkRes.body.data).not.toHaveProperty('checked_at');
      expect(checkRes.body.data).not.toHaveProperty('organization_id');

      const after = await request(appA).get(
        `/api/v8/finance-v2/review-checklist/${bvId}/all-required-checked`
      );
      expect(after.status).toBe(200);
      expect(after.body.data.allRequiredChecked).toBe(true);

      const doubleCheck = await request(appA).post(
        `/api/v8/finance-v2/review-checklist/${checklistItemId}/check`
      );
      expect(doubleCheck.status).toBe(409);
      expect(doubleCheck.body).toHaveProperty('code', 'ALREADY_CHECKED');
    });

    it('POST /review-checklist/:id/required=false then uncheck — item no longer blocks all-required-checked even unchecked', async () => {
      const uncheckRes = await request(appA).post(
        `/api/v8/finance-v2/review-checklist/${checklistItemId}/uncheck`
      );
      expect(uncheckRes.status).toBe(200);
      expect(uncheckRes.body.data.checkedAt).toBeNull();

      const requiredRes = await request(appA)
        .post(`/api/v8/finance-v2/review-checklist/${checklistItemId}/required`)
        .send({ required: false });
      expect(requiredRes.status).toBe(200);
      expect(requiredRes.body.data.required).toBe(false);

      const allChecked = await request(appA).get(
        `/api/v8/finance-v2/review-checklist/${bvId}/all-required-checked`
      );
      expect(allChecked.status).toBe(200);
      expect(allChecked.body.data.allRequiredChecked).toBe(true); // only non-required items outstanding
    });

    it('GET /review-checklist/:businessVersionId — lists the item', async () => {
      const res = await request(appA).get(`/api/v8/finance-v2/review-checklist/${bvId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.map((i: any) => i.id)).toContain(checklistItemId);
    });

    // -----------------------------------------------------------------
    // Cross-tenant matrix
    // -----------------------------------------------------------------

    it("CROSS-TENANT: org B creating a comment on org A's businessVersionId -> 404 NOT_FOUND (pre-check), not a raw FK-violation 500; SQL confirms zero org-B comments", async () => {
      const res = await request(appB)
        .post('/api/v8/finance-v2/comments')
        .send({ artifactId, businessVersionId: bvId, body: 'org B trying to attach here' });
      expect(res.status).toBe(404);
      expect(res.body).toHaveProperty('code', 'NOT_FOUND');

      const orgBComments = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ id: string }>(`SELECT id FROM finance_comments WHERE organization_id = ?`, [
          orgB,
        ])
      );
      expect(orgBComments.length).toBe(0);
    });

    it("CROSS-TENANT: org B reading org A's comment by id -> 404; org A can still read it", async () => {
      const crossRead = await request(appB).get(`/api/v8/finance-v2/comments/${commentId}`);
      expect(crossRead.status).toBe(404);
      expect(crossRead.body).toHaveProperty('code', 'NOT_FOUND');

      const legitRead = await request(appA).get(`/api/v8/finance-v2/comments/${commentId}`);
      expect(legitRead.status).toBe(200);

      const orgARows = await withPinnedPostgresTransaction((tx) =>
        tx.queryAll<{ id: string }>(
          `SELECT id FROM finance_comments WHERE organization_id = ? AND business_version_id = ?`,
          [orgA, bvId]
        )
      );
      expect(orgARows.length).toBeGreaterThanOrEqual(2); // the plain comment + the blocking comment created above
    });

    it("CROSS-TENANT: org B listing org A's checklist -> empty (org-scoped query, no cross-tenant leak)", async () => {
      const res = await request(appB).get(`/api/v8/finance-v2/review-checklist/${bvId}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);

      const legit = await request(appA).get(`/api/v8/finance-v2/review-checklist/${bvId}`);
      expect(legit.status).toBe(200);
      expect(legit.body.data.length).toBeGreaterThan(0);
    });

    // -----------------------------------------------------------------
    // Gate J1 LUKA 1 — POST /comments/search-by-cell and
    // GET /review-checklist/:id/changed-cells. Zero test calls anywhere before
    // this (J1_ENDPOINT_INVENTORY_report.md section 5.1).
    // -----------------------------------------------------------------

    describe('search-by-cell + changed-cells', () => {
      let financeStmtLinesCellRef: typeof import('../../../../types/finance/CellRef.js').financeStmtLinesCellRef;
      let cellEntityId = '';
      let cellCanonicalLineId = '';
      let cellPeriodId = '';
      let cellRefComment: any;
      let anchoredCommentId = '';

      beforeAll(async () => {
        ({ financeStmtLinesCellRef } = await import('../../../../types/finance/CellRef.js'));

        const entityRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ id: string }>(
            `INSERT INTO finance_stmt_entities (
             organization_id, business_version_id, entity_code, legal_name, role,
             consolidation_method, ownership_pct, functional_currency, created_by
           ) VALUES (?, ?, ?, 'Search-by-cell Fixture Co', 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?)
           RETURNING id`,
            [orgA, bvId, `CELL-${randomUUID().slice(0, 8)}`, userA]
          )
        );
        cellEntityId = entityRow!.id;

        const lineRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ id: string }>(
            `SELECT id FROM financial_statement_lines WHERE statement_type = 'BS' AND is_system = true ORDER BY sort_order ASC LIMIT 1`
          )
        );
        cellCanonicalLineId = lineRow!.id;

        const calRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ fiscal_calendar_id: string }>(
            `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
           VALUES (?, 'STANDARD', 12, '2020-01-01', ?) RETURNING fiscal_calendar_id`,
            [orgA, userA]
          )
        );
        const perRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ period_id: string }>(
            `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, created_by)
           VALUES (?, ?, 'FY', 2024, '2024-01-01', '2024-12-31', 'FY2024', ?) RETURNING period_id`,
            [orgA, calRow!.fiscal_calendar_id, userA]
          )
        );
        cellPeriodId = perRow!.period_id;

        cellRefComment = financeStmtLinesCellRef({
          organizationId: orgA,
          businessVersionId: bvId,
          entityId: cellEntityId,
          canonicalLineId: cellCanonicalLineId,
          consolidationScope: 'STANDALONE',
          periodId: cellPeriodId,
          accumulationBasis: 'FULL_YEAR',
        });

        const created = await request(appA).post('/api/v8/finance-v2/comments').send({
          artifactId,
          businessVersionId: bvId,
          body: 'Anchored on a real cell — search-by-cell fixture',
          anchor: cellRefComment,
        });
        if (created.status !== 201)
          throw new Error(
            `fixture setup: anchored comment create failed: ${created.status} ${JSON.stringify(created.body)}`
          );
        anchoredCommentId = created.body.data.id;
      });

      it('POST /comments/search-by-cell — the anchored comment round-trips; a DIFFERENT cellRef (different periodId) returns empty; SQL confirms the anchor JSON', async () => {
        const hit = await request(appA)
          .post('/api/v8/finance-v2/comments/search-by-cell')
          .send({ businessVersionId: bvId, cellRef: cellRefComment });
        expect(hit.status).toBe(200);
        expect(hit.body.data.map((c: any) => c.id)).toContain(anchoredCommentId);
        expect(hit.body.data.find((c: any) => c.id === anchoredCommentId).body).toBe(
          'Anchored on a real cell — search-by-cell fixture'
        );

        const otherCellRef = {
          ...cellRefComment,
          rowKey: { ...cellRefComment.rowKey },
          columnKey: { ...cellRefComment.columnKey, periodId: randomUUID() },
        };
        const miss = await request(appA)
          .post('/api/v8/finance-v2/comments/search-by-cell')
          .send({ businessVersionId: bvId, cellRef: otherCellRef });
        expect(miss.status).toBe(200);
        expect(miss.body.data.map((c: any) => c.id)).not.toContain(anchoredCommentId);

        const sqlRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ anchor: string }>(
            `SELECT anchor::text AS anchor FROM finance_comments WHERE id = ?`,
            [anchoredCommentId]
          )
        );
        expect(sqlRow?.anchor).toContain(cellEntityId);
      });

      it('POST /comments/search-by-cell — an invalid cellRef -> 400 INVALID_CELL_REF', async () => {
        const res = await request(appA)
          .post('/api/v8/finance-v2/comments/search-by-cell')
          .send({ businessVersionId: bvId, cellRef: { not: 'a cell ref' } });
        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('code', 'INVALID_CELL_REF');
      });

      it('CROSS-TENANT POST /comments/search-by-cell: org B, same real businessVersionId/cellRef as org A -> empty (org-scoped query, no leak)', async () => {
        const res = await request(appB)
          .post('/api/v8/finance-v2/comments/search-by-cell')
          .send({ businessVersionId: bvId, cellRef: cellRefComment });
        expect(res.status).toBe(200);
        expect(res.body.data).toEqual([]);

        const legit = await request(appA)
          .post('/api/v8/finance-v2/comments/search-by-cell')
          .send({ businessVersionId: bvId, cellRef: cellRefComment });
        expect(legit.status).toBe(200);
        expect(legit.body.data.length).toBeGreaterThan(0);
      });

      // -----------------------------------------------------------------
      // changed-cells — a real bv1 -> bv2 finance_stmt_lines diff, addressed
      // via the EXPLICIT previousApprovedBusinessVersionId query param (so this
      // test does not need to drive the full submit/approve state machine —
      // getChangedCellsForStatementPack only reads the two rows' cells, never
      // their approval status, when the caller supplies the id explicitly).
      // -----------------------------------------------------------------

      let ccArtifactId = '';
      let ccBv1 = '';
      let ccBv2 = '';
      let ccEntityCode = '';
      let ccLineUnchanged = '';
      let ccLineChanged = '';
      let ccLineAdded = '';

      beforeAll(async () => {
        const stmt = await av.createArtifact({
          organizationId: orgA,
          artifactType: 'STATEMENT_PACK',
          createdBy: userA,
        });
        ccArtifactId = stmt.artifact.artifact_id;
        ccBv1 = stmt.businessVersion.business_version_id;
        const engineManifestId = stmt.businessVersion.engine_manifest_id;

        const bv2Row = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ business_version_id: string }>(
            `INSERT INTO finance_business_versions (
             artifact_id, organization_id, version_no, engine_manifest_id, parent_version_id,
             version_kind, restatement_reason, restatement_class, created_by
           ) VALUES (?, ?, 2, ?, ?, 'RESTATED', 'J1 changed-cells fixture', 'ERROR_CORRECTION', ?)
           RETURNING business_version_id`,
            [ccArtifactId, orgA, engineManifestId, ccBv1, userA]
          )
        );
        ccBv2 = bv2Row!.business_version_id;

        ccEntityCode = `CC-${randomUUID().slice(0, 8)}`;
        const entity1 = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ id: string }>(
            `INSERT INTO finance_stmt_entities (organization_id, business_version_id, entity_code, legal_name, role, consolidation_method, ownership_pct, functional_currency, created_by)
           VALUES (?, ?, ?, 'CC Fixture Co v1', 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?) RETURNING id`,
            [orgA, ccBv1, ccEntityCode, userA]
          )
        );
        const entity2 = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ id: string }>(
            `INSERT INTO finance_stmt_entities (organization_id, business_version_id, entity_code, legal_name, role, consolidation_method, ownership_pct, functional_currency, created_by)
           VALUES (?, ?, ?, 'CC Fixture Co v2', 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?) RETURNING id`,
            [orgA, ccBv2, ccEntityCode, userA]
          )
        );

        const lineRows = await withPinnedPostgresTransaction((tx) =>
          tx.queryAll<{ id: string }>(
            `SELECT id FROM financial_statement_lines WHERE statement_type = 'BS' AND is_system = true ORDER BY sort_order ASC LIMIT 2`
          )
        );
        ccLineUnchanged = lineRows[0].id;
        ccLineChanged = lineRows[1].id;
        const plLineRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ id: string }>(
            `SELECT id FROM financial_statement_lines WHERE statement_type = 'P&L' AND is_system = true ORDER BY sort_order ASC LIMIT 1`
          )
        );
        ccLineAdded = plLineRow!.id;

        const perRow = await withPinnedPostgresTransaction((tx) =>
          tx.queryOne<{ period_id: string }>(
            `SELECT period_id FROM finance_stmt_periods WHERE organization_id = ? LIMIT 1`,
            [orgA]
          )
        );
        const ccPeriodId =
          perRow?.period_id ??
          (await withPinnedPostgresTransaction((tx) =>
            tx.queryOne<{ period_id: string }>(
              `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, created_by)
               VALUES (?, (SELECT fiscal_calendar_id FROM finance_stmt_calendars WHERE organization_id = ? LIMIT 1), 'FY', 2024, '2024-01-01', '2024-12-31', 'FY2024 CC', ?) RETURNING period_id`,
              [orgA, orgA, userA]
            )
          ))!.period_id;

        async function insertLine(bvId2: string, entityId2: string, lineId: string, value: string) {
          await withPinnedPostgresTransaction((tx) =>
            tx.queryRun(
              `INSERT INTO finance_stmt_lines (
               id, organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
               accumulation_basis, consolidation_scope, value_status, value_decimal, native_currency,
               presentation_currency, unit, multiplier, is_adjustment, sign_convention, accounting_policy, created_by
             ) VALUES (?, ?, ?, 'BS', ?, ?, ?, 'FULL_YEAR', 'STANDALONE', 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', '1', false, 'NATURAL', 'IFRS', ?)`,
              [randomUUID(), orgA, bvId2, lineId, entityId2, ccPeriodId, value, userA]
            )
          );
        }
        // v1: unchanged line (100) + changed line (50). v2: unchanged line (100, same) + changed
        // line (75, different) + a brand-new added line (30, absent from v1).
        await insertLine(ccBv1, entity1!.id, ccLineUnchanged, '100');
        await insertLine(ccBv1, entity1!.id, ccLineChanged, '50');
        await insertLine(ccBv2, entity2!.id, ccLineUnchanged, '100');
        await insertLine(ccBv2, entity2!.id, ccLineChanged, '75');
        await insertLine(ccBv2, entity2!.id, ccLineAdded, '30');
      });

      it('GET /review-checklist/:id/changed-cells?previousApprovedBusinessVersionId= — returns exactly the changed+added lines, never the unchanged one; SQL confirms the values', async () => {
        const res = await request(appA).get(
          `/api/v8/finance-v2/review-checklist/${ccBv2}/changed-cells?previousApprovedBusinessVersionId=${ccBv1}`
        );
        expect(res.status).toBe(200);
        expect(res.body.data.hasPreviousApproved).toBe(true);
        expect(res.body.data.previousBusinessVersionId).toBe(ccBv1);
        const changed = res.body.data.changedCells;
        const byLine = new Map(changed.map((c: any) => [c.cellRef.rowKey.canonicalLineId, c]));

        expect(byLine.has(ccLineUnchanged)).toBe(false); // never surfaced — identical on both sides

        const changedEntry = byLine.get(ccLineChanged) as any;
        expect(changedEntry).toBeTruthy();
        expect(changedEntry.previous.valueDecimal).toBe('50');
        expect(changedEntry.current.valueDecimal).toBe('75');

        const addedEntry = byLine.get(ccLineAdded) as any;
        expect(addedEntry).toBeTruthy();
        expect(addedEntry.previous).toBeNull();
        expect(addedEntry.current.valueDecimal).toBe('30');

        const sqlRows = await withPinnedPostgresTransaction((tx) =>
          tx.queryAll<{ canonical_line_id: string; value_decimal: string }>(
            `SELECT canonical_line_id, value_decimal FROM finance_stmt_lines WHERE business_version_id = ? ORDER BY canonical_line_id`,
            [ccBv2]
          )
        );
        expect(sqlRows.find((r) => r.canonical_line_id === ccLineChanged)?.value_decimal).toBe(
          '75'
        );
      });

      it('GET /review-checklist/:id/changed-cells with NO baseline available (bv1 itself, no parent) -> hasPreviousApproved=false, changedCells=null', async () => {
        const res = await request(appA).get(
          `/api/v8/finance-v2/review-checklist/${ccBv1}/changed-cells`
        );
        expect(res.status).toBe(200);
        expect(res.body.data.hasPreviousApproved).toBe(false);
        expect(res.body.data.changedCells).toBeNull();
      });

      it("CROSS-TENANT GET /review-checklist/:id/changed-cells: org B, real org A ids -> 404 NOT_FOUND (org-scoped getBusinessVersion), org A's real diff still readable", async () => {
        const res = await request(appB).get(
          `/api/v8/finance-v2/review-checklist/${ccBv2}/changed-cells?previousApprovedBusinessVersionId=${ccBv1}`
        );
        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('code', 'NOT_FOUND');

        const legit = await request(appA).get(
          `/api/v8/finance-v2/review-checklist/${ccBv2}/changed-cells?previousApprovedBusinessVersionId=${ccBv1}`
        );
        expect(legit.status).toBe(200);
        expect(legit.body.data.changedCells.length).toBeGreaterThan(0);
      });
    });
  }
);
