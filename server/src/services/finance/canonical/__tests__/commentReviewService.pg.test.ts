/**
 * AP-06 — comments / review threads / assignments / review checklist, real
 * PostgreSQL integration test.
 *
 * Exercises `commentService` and `reviewChecklistService` (migration
 * `20260809_finance_v3_d_ap06_comments_01_tables.sql`) against the ACTUAL
 * migrated schema, plus the additive change this work package made to
 * `artifactVersionService.approveVersion()` (step (a3b): an unresolved
 * `is_blocking=true` comment on a business_version_id rejects approval with
 * `APPROVAL_BLOCKED`, mirroring the existing SECURITY-exception check at
 * (a3) that `canonicalServices.pg.test.ts` already covers for exceptions).
 *
 * Same env-var contract as this repo's other `.pg.test.ts` suites
 * (`RUN_DB_TESTS=1`, `MOCK_DB=false`, `DATABASE_URL=postgresql://...`) —
 * `describe.skipIf`-gated so a run with no real database reachable reports
 * SKIPPED, never a false green.
 *
 * Isolation: every test uses a freshly generated organization id and its own
 * artifact/business-version chain (same convention as
 * `canonicalServices.pg.test.ts` / `statementServices.pg.test.ts` in this
 * directory).
 *
 * HOW TO RUN (against your own throwaway/ephemeral cluster — NEVER against
 * the shared local Postgres or any demo/staging/prod host):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config server/vitest.config.ts \
 *     server/src/services/finance/canonical/__tests__/commentReviewService.pg.test.ts \
 *     --no-file-parallelism
 */
import { randomUUID } from 'node:crypto';

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

describe.skipIf(!REAL_PG)('AP-06 comments/review — real PostgreSQL', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let artifactVersionService: typeof import('../artifactVersionService.js');
  let commentService: typeof import('../commentService.js');
  let reviewChecklistService: typeof import('../reviewChecklistService.js');
  let financeStmtLinesCellRef: typeof import('../../../../types/finance/CellRef.js').financeStmtLinesCellRef;

  const orgId = `org-finv3-ap06-${randomUUID()}`;
  const preparerId = `user-preparer-${randomUUID()}`;
  const approverId = `user-approver-${randomUUID()}`;
  const reviewerId = `user-reviewer-${randomUUID()}`;

  let calendarId = '';
  let periodIdA = '';
  let periodIdB = '';

  async function makeStatementPack() {
    return artifactVersionService.createArtifact({
      organizationId: orgId,
      artifactType: 'STATEMENT_PACK',
      createdBy: preparerId,
    });
  }

  async function makeEntity(businessVersionId: string, entityCode: string) {
    const row = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(
        `INSERT INTO finance_stmt_entities (
           organization_id, business_version_id, entity_code, legal_name, role,
           consolidation_method, ownership_pct, functional_currency, created_by
         ) VALUES (?, ?, ?, ?, 'GROUP_PARENT', 'NOT_CONSOLIDATED', NULL, 'PLN', ?)
         RETURNING id`,
        [orgId, businessVersionId, entityCode, `${entityCode} legal name`, preparerId]
      )
    );
    if (!row) throw new Error('finance_stmt_entities fixture insert returned no row');
    return row.id;
  }

  async function insertStmtLine(params: {
    businessVersionId: string;
    entityId: string;
    canonicalLineId: string;
    statementType: 'P&L' | 'BS' | 'CF';
    periodId: string;
    value: number;
  }) {
    const row = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ id: string }>(
        `INSERT INTO finance_stmt_lines (
           organization_id, business_version_id, statement_type, canonical_line_id, entity_id, period_id,
           value_status, value_decimal, native_currency, presentation_currency, unit, accounting_policy, created_by
         ) VALUES (?, ?, ?, ?, ?, ?, 'PRESENT_NONZERO', ?, 'PLN', 'PLN', 'UNITS', 'IFRS', ?)
         RETURNING id`,
        [orgId, params.businessVersionId, params.statementType, params.canonicalLineId, params.entityId, params.periodId, params.value, preparerId]
      )
    );
    if (!row) throw new Error('finance_stmt_lines fixture insert returned no row');
    return row.id;
  }

  /** Drives DRAFT -> READY_FOR_REVIEW -> IN_REVIEW -> freshness=CURRENT, bypassing the Statement Pack readiness gate (transition() itself has no domain-specific gate — same pattern canonicalServices.pg.test.ts uses for its SECURITY-exception blocking test). */
  async function driveToInReview(bvId: string, version: number): Promise<number> {
    const submitted = await artifactVersionService.transition({
      organizationId: orgId,
      businessVersionId: bvId,
      action: 'submit_for_review',
      actorId: preparerId,
      role: 'preparer',
      expectedVersion: version,
    });
    if (!submitted.ok) throw new Error(`submit_for_review failed: ${submitted.message}`);
    const started = await artifactVersionService.transition({
      organizationId: orgId,
      businessVersionId: bvId,
      action: 'start_review',
      actorId: reviewerId,
      role: 'reviewer',
      expectedVersion: submitted.businessVersion.version,
    });
    if (!started.ok) throw new Error(`start_review failed: ${started.message}`);
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [bvId])
    );
    return started.businessVersion.version;
  }

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    artifactVersionService = await import('../artifactVersionService.js');
    commentService = await import('../commentService.js');
    reviewChecklistService = await import('../reviewChecklistService.js');
    ({ financeStmtLinesCellRef } = await import('../../../../types/finance/CellRef.js'));

    await withPinnedPostgresTransaction((tx) => tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'FinV3 AP-06 Test Org']));

    const cal = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ fiscal_calendar_id: string }>(
        `INSERT INTO finance_stmt_calendars (organization_id, calendar_type, fiscal_year_end_month, effective_from, created_by)
         VALUES (?, 'STANDARD', 12, '2020-01-01', ?) RETURNING fiscal_calendar_id`,
        [orgId, preparerId]
      )
    );
    if (!cal) throw new Error('finance_stmt_calendars fixture insert returned no row');
    calendarId = cal.fiscal_calendar_id;

    const perA = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ period_id: string }>(
        `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, created_by)
         VALUES (?, ?, 'FY', 2024, '2024-01-01', '2024-12-31', 'FY2024', ?) RETURNING period_id`,
        [orgId, calendarId, preparerId]
      )
    );
    if (!perA) throw new Error('finance_stmt_periods fixture insert (A) returned no row');
    periodIdA = perA.period_id;

    const perB = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne<{ period_id: string }>(
        `INSERT INTO finance_stmt_periods (organization_id, fiscal_calendar_id, period_type, fiscal_year, period_start, period_end, label, created_by)
         VALUES (?, ?, 'FY', 2025, '2025-01-01', '2025-12-31', 'FY2025', ?) RETURNING period_id`,
        [orgId, calendarId, preparerId]
      )
    );
    if (!perB) throw new Error('finance_stmt_periods fixture insert (B) returned no row');
    periodIdB = perB.period_id;
  });

  afterAll(async () => {
    // Best-effort only, same convention as canonicalServices.pg.test.ts / statementServices.pg.test.ts:
    // finance_comments/finance_comment_assignments/finance_review_checklists carry no deny-delete
    // trigger, but their FK chain (business_version_id -> finance_business_versions ->
    // finance_artifacts) makes the parent rows transitively undeletable once
    // artifact_lifecycle_events rows exist anyway (append-only). Clean up what IS safely
    // deletable so this file leaves no dangling rows of its own tables behind.
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(`DELETE FROM finance_comment_assignments WHERE organization_id = ?`, [orgId]);
      await tx.queryRun(`DELETE FROM finance_comments WHERE organization_id = ?`, [orgId]);
      await tx.queryRun(`DELETE FROM finance_review_checklists WHERE organization_id = ?`, [orgId]);
    });
  });

  describe('blocking comment gates approveVersion() (AP-06 x WP-B02 step a3b)', () => {
    it('an unresolved is_blocking comment on a finance_stmt_lines cell rejects approve; resolving it lets approve through', async () => {
      const created = await makeStatementPack();
      const bvId = created.businessVersion.business_version_id;
      const entityId = await makeEntity(bvId, 'PARENT');
      const stmtLineId = await insertStmtLine({
        businessVersionId: bvId,
        entityId,
        canonicalLineId: 'fsl-bs-total-assets',
        statementType: 'BS',
        periodId: periodIdA,
        value: 1_000_000,
      });
      expect(stmtLineId).toBeTruthy();

      const cellRef = financeStmtLinesCellRef({
        organizationId: orgId,
        businessVersionId: bvId,
        entityId,
        canonicalLineId: 'fsl-bs-total-assets',
        consolidationScope: 'CONSOLIDATED',
        periodId: periodIdA,
        accumulationBasis: 'FULL_YEAR',
      });

      const commentResult = await commentService.createComment({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        businessVersionId: bvId,
        anchor: cellRef,
        authorId: reviewerId,
        body: 'Total assets figure looks stale vs the source PDF page 3 — please confirm before approval.',
        isBlocking: true,
      });
      expect(commentResult.ok).toBe(true);
      if (!commentResult.ok) throw new Error('unreachable');
      const commentId = commentResult.comment.id;

      let version = created.businessVersion.version;
      version = await driveToInReview(bvId, version);

      const blockedAttempt = await artifactVersionService.approveVersion({
        organizationId: orgId,
        businessVersionId: bvId,
        actorId: approverId,
        role: 'approver',
        expectedVersion: version,
      });
      expect(blockedAttempt.ok).toBe(false);
      if (blockedAttempt.ok) throw new Error('unreachable');
      expect(blockedAttempt.code).toBe('APPROVAL_BLOCKED');
      expect(blockedAttempt.message).toMatch(/blocking comment/i);

      // Confirm the same predicate is queryable independently of approveVersion() itself.
      expect(await commentService.hasUnresolvedBlockingComments(orgId, bvId)).toBe(true);

      const resolved = await commentService.resolveComment(orgId, commentId, approverId);
      expect(resolved.ok).toBe(true);
      if (!resolved.ok) throw new Error('unreachable');
      expect(resolved.comment.resolved_by).toBe(approverId);
      expect(resolved.comment.resolved_at).toBeTruthy();
      expect(await commentService.hasUnresolvedBlockingComments(orgId, bvId)).toBe(false);

      // A rejected approve attempt does not bump `version` (transition()/approveVersion() only
      // mutate the row on a SUCCESSFUL transition) — expectedVersion is unchanged.
      const approved = await artifactVersionService.approveVersion({
        organizationId: orgId,
        businessVersionId: bvId,
        actorId: approverId,
        role: 'approver',
        expectedVersion: version,
      });
      expect(approved.ok).toBe(true);
      if (!approved.ok) throw new Error(`approve unexpectedly failed: ${JSON.stringify(approved)}`);
      expect(approved.businessVersion.status).toBe('APPROVED');
      expect(approved.computeSnapshotId).toBeTruthy();

      // Confirm directly against the DB, not just the service's own return value.
      const bvRow = await withPinnedPostgresTransaction((tx) =>
        tx.queryOne<{ status: string }>(`SELECT status FROM finance_business_versions WHERE business_version_id = ?`, [bvId])
      );
      expect(bvRow?.status).toBe('APPROVED');
    });

    it('a non-blocking comment does NOT gate approveVersion()', async () => {
      const created = await makeStatementPack();
      const bvId = created.businessVersion.business_version_id;

      const commentResult = await commentService.createComment({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        businessVersionId: bvId,
        authorId: reviewerId,
        body: 'Minor formatting nit, not a blocker.',
        isBlocking: false,
      });
      expect(commentResult.ok).toBe(true);

      let version = created.businessVersion.version;
      version = await driveToInReview(bvId, version);

      const approved = await artifactVersionService.approveVersion({
        organizationId: orgId,
        businessVersionId: bvId,
        actorId: approverId,
        role: 'approver',
        expectedVersion: version,
      });
      expect(approved.ok).toBe(true);
    });
  });

  describe('mentions / assign — simple CRUD (AP-06)', () => {
    it('createComment persists mentions; listMentioning finds it; assign/reassign tracks the current assignee', async () => {
      const created = await makeStatementPack();
      const bvId = created.businessVersion.business_version_id;
      const mentionedUser = `user-mentioned-${randomUUID()}`;
      const otherUser = `user-other-${randomUUID()}`;

      const commentResult = await commentService.createComment({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        businessVersionId: bvId,
        authorId: preparerId,
        body: `Hey @${mentionedUser} can you double check the FX rate here?`,
        mentions: [mentionedUser, otherUser],
      });
      expect(commentResult.ok).toBe(true);
      if (!commentResult.ok) throw new Error('unreachable');
      expect(commentResult.comment.mentions.slice().sort()).toEqual([mentionedUser, otherUser].sort());
      expect(commentResult.comment.is_blocking).toBe(false);
      expect(commentResult.comment.anchor).toBeNull();

      const mentioned = await commentService.listMentioning(orgId, mentionedUser);
      expect(mentioned.some((c) => c.id === commentResult.comment.id)).toBe(true);
      const notMentioned = await commentService.listMentioning(orgId, `user-unrelated-${randomUUID()}`);
      expect(notMentioned.some((c) => c.id === commentResult.comment.id)).toBe(false);

      const firstAssignee = `user-assignee-1-${randomUUID()}`;
      const assigned = await commentService.assignComment({
        organizationId: orgId,
        commentId: commentResult.comment.id,
        assigneeId: firstAssignee,
        assignedBy: preparerId,
        dueDate: '2026-09-01',
      });
      expect(assigned.ok).toBe(true);
      if (!assigned.ok) throw new Error('unreachable');
      expect(assigned.assignment.assignee_id).toBe(firstAssignee);

      let current = await commentService.getCurrentAssignment(orgId, commentResult.comment.id);
      expect(current?.assignee_id).toBe(firstAssignee);

      const secondAssignee = `user-assignee-2-${randomUUID()}`;
      await commentService.assignComment({
        organizationId: orgId,
        commentId: commentResult.comment.id,
        assigneeId: secondAssignee,
        assignedBy: preparerId,
      });
      current = await commentService.getCurrentAssignment(orgId, commentResult.comment.id);
      expect(current?.assignee_id).toBe(secondAssignee);

      const assignNotFound = await commentService.assignComment({
        organizationId: orgId,
        commentId: `nonexistent-${randomUUID()}`,
        assigneeId: firstAssignee,
        assignedBy: preparerId,
      });
      expect(assignNotFound.ok).toBe(false);
      if (assignNotFound.ok) throw new Error('unreachable');
      expect(assignNotFound.code).toBe('NOT_FOUND');
    });

    it('resolve/reopen round-trips resolved_by/resolved_at and rejects double-resolve / reopen-when-open', async () => {
      const created = await makeStatementPack();
      const bvId = created.businessVersion.business_version_id;
      const commentResult = await commentService.createComment({
        organizationId: orgId,
        artifactId: created.artifact.artifact_id,
        businessVersionId: bvId,
        authorId: preparerId,
        body: 'Please review the elimination entries.',
      });
      if (!commentResult.ok) throw new Error('unreachable');
      const commentId = commentResult.comment.id;

      const notResolvedYet = await commentService.reopenComment(orgId, commentId);
      expect(notResolvedYet.ok).toBe(false);
      if (notResolvedYet.ok) throw new Error('unreachable');
      expect(notResolvedYet.code).toBe('NOT_RESOLVED');

      const resolved = await commentService.resolveComment(orgId, commentId, reviewerId);
      expect(resolved.ok).toBe(true);

      const doubleResolve = await commentService.resolveComment(orgId, commentId, reviewerId);
      expect(doubleResolve.ok).toBe(false);
      if (doubleResolve.ok) throw new Error('unreachable');
      expect(doubleResolve.code).toBe('ALREADY_RESOLVED');

      const reopened = await commentService.reopenComment(orgId, commentId);
      expect(reopened.ok).toBe(true);
      if (!reopened.ok) throw new Error('unreachable');
      expect(reopened.comment.resolved_by).toBeNull();
      expect(reopened.comment.resolved_at).toBeNull();
    });
  });

  describe('review checklist — add / check / require (AP-06)', () => {
    it('addChecklistItem / checkItem / setChecklistItemRequired / allRequiredItemsChecked', async () => {
      const created = await makeStatementPack();
      const bvId = created.businessVersion.business_version_id;

      const item1 = await reviewChecklistService.addChecklistItem({
        organizationId: orgId,
        businessVersionId: bvId,
        item: 'Confirm FX rates match treasury feed',
        required: true,
        createdBy: reviewerId,
      });
      expect(item1.ok).toBe(true);
      if (!item1.ok) throw new Error('unreachable');

      const item2 = await reviewChecklistService.addChecklistItem({
        organizationId: orgId,
        businessVersionId: bvId,
        item: 'Nice-to-have: spellcheck notes',
        required: false,
        createdBy: reviewerId,
      });
      expect(item2.ok).toBe(true);
      if (!item2.ok) throw new Error('unreachable');

      expect(await reviewChecklistService.allRequiredItemsChecked(orgId, bvId)).toBe(false);

      const checked = await reviewChecklistService.checkItem(orgId, item1.item.id, reviewerId);
      expect(checked.ok).toBe(true);
      if (!checked.ok) throw new Error('unreachable');
      expect(checked.item.checked_by).toBe(reviewerId);

      // The only outstanding required item is now checked; the optional item does not count.
      expect(await reviewChecklistService.allRequiredItemsChecked(orgId, bvId)).toBe(true);

      const madeRequired = await reviewChecklistService.setChecklistItemRequired(orgId, item2.item.id, true);
      expect(madeRequired.ok).toBe(true);
      expect(await reviewChecklistService.allRequiredItemsChecked(orgId, bvId)).toBe(false);

      const items = await reviewChecklistService.listChecklistItems(orgId, bvId);
      expect(items.map((i) => i.id).sort()).toEqual([item1.item.id, item2.item.id].sort());
    });
  });

  describe('changed-only reviewer entry (AP-06 x finance_stmt_lines)', () => {
    it('50 cells across two versions, 3 changed -> getChangedCellsForStatementPack returns exactly those 3', async () => {
      const LINE_CODES = [
        'fsl-bs-ap', 'fsl-bs-ar', 'fsl-cf-capex', 'fsl-bs-cash', 'fsl-cf-financing',
        'fsl-cf-investing', 'fsl-cf-operating', 'fsl-pl-cogs', 'fsl-bs-current-assets', 'fsl-bs-current-liabilities',
        'fsl-pl-depreciation', 'fsl-bs-dividends-declared', 'fsl-pl-ebit', 'fsl-pl-ebitda', 'fsl-bs-equity',
        'fsl-cf-fcf', 'fsl-bs-fixed', 'fsl-pl-gross', 'fsl-pl-interest', 'fsl-bs-inventory',
        'fsl-bs-long-term-debt', 'fsl-cf-net-change-cash', 'fsl-pl-net', 'fsl-pl-opex', 'fsl-bs-retained-earnings',
      ] as const; // 25 lines x 2 periods = 50 cells
      const STATEMENT_TYPE_BY_LINE: Record<string, 'P&L' | 'BS' | 'CF'> = {
        'fsl-bs-ap': 'BS', 'fsl-bs-ar': 'BS', 'fsl-cf-capex': 'CF', 'fsl-bs-cash': 'BS', 'fsl-cf-financing': 'CF',
        'fsl-cf-investing': 'CF', 'fsl-cf-operating': 'CF', 'fsl-pl-cogs': 'P&L', 'fsl-bs-current-assets': 'BS', 'fsl-bs-current-liabilities': 'BS',
        'fsl-pl-depreciation': 'P&L', 'fsl-bs-dividends-declared': 'BS', 'fsl-pl-ebit': 'P&L', 'fsl-pl-ebitda': 'P&L', 'fsl-bs-equity': 'BS',
        'fsl-cf-fcf': 'CF', 'fsl-bs-fixed': 'BS', 'fsl-pl-gross': 'P&L', 'fsl-pl-interest': 'P&L', 'fsl-bs-inventory': 'BS',
        'fsl-bs-long-term-debt': 'BS', 'fsl-cf-net-change-cash': 'CF', 'fsl-pl-net': 'P&L', 'fsl-pl-opex': 'P&L', 'fsl-bs-retained-earnings': 'BS',
      };
      expect(LINE_CODES.length).toBe(25);

      // --- v1: approved baseline, 50 cells all valued at 1000 ---
      const created = await makeStatementPack();
      const bv1Id = created.businessVersion.business_version_id;
      const entity1Id = await makeEntity(bv1Id, 'GRP');

      for (const lineId of LINE_CODES) {
        for (const periodId of [periodIdA, periodIdB]) {
          await insertStmtLine({
            businessVersionId: bv1Id,
            entityId: entity1Id,
            canonicalLineId: lineId,
            statementType: STATEMENT_TYPE_BY_LINE[lineId],
            periodId,
            value: 1000,
          });
        }
      }

      let version = created.businessVersion.version;
      version = await driveToInReview(bv1Id, version);
      const approvedV1 = await artifactVersionService.approveVersion({
        organizationId: orgId,
        businessVersionId: bv1Id,
        actorId: approverId,
        role: 'approver',
        expectedVersion: version,
      });
      expect(approvedV1.ok).toBe(true);
      if (!approvedV1.ok) throw new Error(`v1 approve unexpectedly failed: ${JSON.stringify(approvedV1)}`);

      // --- v2: reopen (spawns a fresh DRAFT business_version_id); its own entity row + its own
      // 50 finance_stmt_lines rows, since neither table is copied by reopenVersion() (see
      // reviewChecklistService.ts's comment on why the diff joins on entity_code, not entity_id).
      const reopened = await artifactVersionService.reopenVersion({
        organizationId: orgId,
        businessVersionId: bv1Id,
        actorId: approverId,
        role: 'approver',
        expectedVersion: approvedV1.businessVersion.version,
        reason: 'Reopen for a routine year-end true-up',
      });
      expect(reopened.ok).toBe(true);
      if (!reopened.ok) throw new Error(`reopen unexpectedly failed: ${JSON.stringify(reopened)}`);
      const bv2Id = reopened.businessVersion.business_version_id;
      const entity2Id = await makeEntity(bv2Id, 'GRP'); // same entity_code, new version-scoped row

      const CHANGED_LINE_IDS = new Set(['fsl-pl-net', 'fsl-bs-cash', 'fsl-pl-ebit']);
      const changedPeriodByLine: Record<string, string> = {
        'fsl-pl-net': periodIdA,
        'fsl-bs-cash': periodIdB,
        'fsl-pl-ebit': periodIdA,
      };

      for (const lineId of LINE_CODES) {
        for (const periodId of [periodIdA, periodIdB]) {
          const isTheChangedCell = CHANGED_LINE_IDS.has(lineId) && changedPeriodByLine[lineId] === periodId;
          await insertStmtLine({
            businessVersionId: bv2Id,
            entityId: entity2Id,
            canonicalLineId: lineId,
            statementType: STATEMENT_TYPE_BY_LINE[lineId],
            periodId,
            value: isTheChangedCell ? 1234 : 1000,
          });
        }
      }

      const diff = await reviewChecklistService.getChangedCellsForStatementPack(orgId, bv2Id);
      expect(diff.ok).toBe(true);
      if (!diff.ok) throw new Error('unreachable');
      expect(diff.hasPreviousApproved).toBe(true);
      if (!diff.hasPreviousApproved) throw new Error('unreachable');
      expect(diff.previousBusinessVersionId).toBe(bv1Id);
      expect(diff.changedCells).toHaveLength(3);

      const changedKeys = diff.changedCells
        .map((c) => `${c.cellRef.rowKey.canonicalLineId}@${c.cellRef.columnKey.periodId}`)
        .sort();
      const expectedKeys = [
        `fsl-pl-net@${periodIdA}`,
        `fsl-bs-cash@${periodIdB}`,
        `fsl-pl-ebit@${periodIdA}`,
      ].sort();
      expect(changedKeys).toEqual(expectedKeys);

      for (const entry of diff.changedCells) {
        expect(entry.previous?.valueDecimal).toBe('1000');
        expect(entry.current?.valueDecimal).toBe('1234');
        // The returned CellRef anchors into the CURRENT version being reviewed, not the baseline.
        expect(entry.cellRef.businessVersionId).toBe(bv2Id);
        expect(entry.cellRef.rowKey.entityId).toBe(entity2Id);
      }
    });

    it('no previous APPROVED version -> hasPreviousApproved:false, changedCells:null (caller shows the full grid)', async () => {
      const created = await makeStatementPack();
      const bvId = created.businessVersion.business_version_id;
      const diff = await reviewChecklistService.getChangedCellsForStatementPack(orgId, bvId);
      expect(diff.ok).toBe(true);
      if (!diff.ok) throw new Error('unreachable');
      expect(diff.hasPreviousApproved).toBe(false);
      expect(diff.changedCells).toBeNull();
    });
  });
});
