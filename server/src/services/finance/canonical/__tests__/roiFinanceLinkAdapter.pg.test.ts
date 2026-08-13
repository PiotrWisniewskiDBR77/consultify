/**
 * ROI-E007 Stream B rewrite — `roiFinanceLinkAdapter` proved against a REAL
 * PostgreSQL.
 *
 * Exercises the Finance-side adapter over the CANONICAL Results vNext
 * ROI/Finance seam (`rvn_roi_finance_links`,
 * `server/migrations/20260820_rvn_roi_finance_seam.sql`) together with the
 * REAL Finance v3 lifecycle (`finance_artifacts`/`finance_business_versions`,
 * `server/migrations/20260809_finance_v3_b01_core_artifacts.sql`) — a mocked
 * DB cannot prove Decision D4's central claim ("no FK, a link survives the
 * pinned Finance version being reopened/superseded, and a fresh read still
 * resolves to the ORIGINAL pin, not to whatever is current now").
 *
 * Same env-var contract as this repo's other `.pg.test.ts` suites
 * (`RUN_DB_TESTS=1`, `MOCK_DB=false`, `DATABASE_URL=postgresql://...`,
 * `DB_TYPE=postgres`) — `describe.skipIf`-gated so a run with no reachable,
 * fully-migrated Postgres reports SKIPPED, never a false green. Copied
 * verbatim in shape from
 * `server/src/services/finance/canonical/__tests__/canonicalServices.pg.test.ts`.
 *
 * HOW TO RUN (against your own throwaway/ephemeral cluster — NEVER against
 * the shared local Postgres or any demo/staging/prod host):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config server/vitest.config.ts \
 *     server/src/services/finance/canonical/__tests__/roiFinanceLinkAdapter.pg.test.ts \
 *     --no-file-parallelism
 *
 * TENANCY / cleanup: every run uses one freshly generated organization id
 * (`orgId`), initiative id and case id, so this file never disturbs another
 * file's/run's rows. `afterAll` deletes the `rvn_roi_finance_links` rows this
 * suite created (that table has no freeze/append-only trigger — links are
 * removable by design, per the migration's own header comment) but does
 * NOT attempt to delete `finance_artifacts`/`finance_business_versions`/
 * `artifact_lifecycle_events`/`rvn_roi_cases`/`rvn_platform_events` — those
 * are append-only or transitively undeletable once an append-only child
 * row exists, exactly like `canonicalServices.pg.test.ts`'s own `afterAll`
 * documents.
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

describe.skipIf(!REAL_PG)('roiFinanceLinkAdapter — real PostgreSQL', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let artifactVersionService: typeof import('../artifactVersionService.js');
  let roiFinanceLinkAdapter: typeof import('../roiFinanceLinkAdapter.js');
  let roiCaseCommands: typeof import('../../../resultsVnext/roi/roiCaseCommands.js');

  const orgId = `org-roi-fin-adapter-${randomUUID()}`;
  const initiativeId = `initiative-roi-fin-adapter-${randomUUID()}`;
  const preparerId = `user-preparer-${randomUUID()}`;
  const approverId = `user-approver-${randomUUID()}`;

  let caseId: string;
  const createdLinkIds: string[] = [];

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    artifactVersionService = await import('../artifactVersionService.js');
    roiFinanceLinkAdapter = await import('../roiFinanceLinkAdapter.js');
    roiCaseCommands = await import('../../../resultsVnext/roi/roiCaseCommands.js');

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'ROI Finance-link Adapter Test Org'])
    );
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO initiatives (id, organization_id, status, name) VALUES (?, ?, 'DRAFT', ?)`, [
        initiativeId,
        orgId,
        'ROI Finance-link Adapter Test Initiative',
      ])
    );
    // ROI-E001 §5 / RN-G1 §B.3: createRoiCase fails closed without an active
    // domain='roi' visibility policy for the org — provision one directly
    // (OPEN_ORG, no ACL/team/chain machinery needed for this suite's own
    // reads, which all use the SAME preparerId that owns/creates everything).
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `INSERT INTO rvn_platform_visibility_policies
           (organization_id, domain, policy_version, visibility_mode, default_scope_type, created_by)
         VALUES (?, 'roi', 1, 'OPEN_ORG', NULL, ?)`,
        [orgId, preparerId]
      )
    );

    const caseOutcome = await roiCaseCommands.createRoiCase({
      organizationId: orgId,
      initiativeId,
      title: 'ROI Finance-link Adapter Test Case',
      ownerUserId: preparerId,
      currency: 'USD',
      createdBy: preparerId,
      actorEffectiveRole: 'preparer',
      idempotencyKey: `idem-create-case-${randomUUID()}`,
    });
    caseId = caseOutcome.result.case.caseId;
  });

  afterAll(async () => {
    if (createdLinkIds.length > 0) {
      await withPinnedPostgresTransaction((tx) =>
        tx.queryRun(`DELETE FROM rvn_roi_finance_links WHERE link_id IN (${createdLinkIds.map(() => '?').join(',')})`, [
          ...createdLinkIds,
        ])
      );
    }
  });

  /** Drives a freshly-created (DRAFT) `finance_business_versions` row all
   * the way to APPROVED — same T2->T4->approve happy path
   * `canonicalServices.pg.test.ts` already proves, reused here as a fixture
   * builder rather than restated as its own separate assertion set. */
  async function driveToApproved(businessVersionId: string, startingVersion: number): Promise<number> {
    let version = startingVersion;

    const submitted = await artifactVersionService.transition({
      organizationId: orgId,
      businessVersionId,
      action: 'submit_for_review',
      actorId: preparerId,
      role: 'preparer',
      expectedVersion: version,
    });
    if (!submitted.ok) throw new Error(`fixture setup: submit_for_review failed: ${submitted.message}`);
    version = submitted.businessVersion.version;

    const started = await artifactVersionService.transition({
      organizationId: orgId,
      businessVersionId,
      action: 'start_review',
      actorId: approverId,
      role: 'approver',
      expectedVersion: version,
    });
    if (!started.ok) throw new Error(`fixture setup: start_review failed: ${started.message}`);
    version = started.businessVersion.version;

    // freshness defaults to NEVER_COMPUTED on create/reopen — approve
    // requires CURRENT (WP-B02 §5.1) — force it directly, same as
    // canonicalServices.pg.test.ts's own fixture setup.
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`UPDATE finance_business_versions SET freshness = 'CURRENT' WHERE business_version_id = ?`, [
        businessVersionId,
      ])
    );

    const approved = await artifactVersionService.approveVersion({
      organizationId: orgId,
      businessVersionId,
      actorId: approverId,
      role: 'approver',
      expectedVersion: version,
      idempotencyKey: `idem-approve-${businessVersionId}`,
    });
    if (!approved.ok) throw new Error(`fixture setup: approveVersion failed: ${approved.message}`);
    return approved.businessVersion.version;
  }

  it('linkFinanceArtifactToRoiCase resolves financeArtifactType/financeArtifactId from the business version and delegates to the canonical command', async () => {
    const created = await artifactVersionService.createArtifact({
      organizationId: orgId,
      artifactType: 'HISTORICAL_ANALYSIS', // LOW risk tier -> no SoD gate, simpler happy path
      createdBy: preparerId,
    });
    const v1Id = created.businessVersion.business_version_id;
    await driveToApproved(v1Id, created.businessVersion.version);

    const link = await roiFinanceLinkAdapter.linkFinanceArtifactToRoiCase({
      organizationId: orgId,
      caseId,
      financeBusinessVersionId: v1Id,
      source: 'finance_v3.historical_analysis',
      linkPurpose: 'roi_baseline_actuals',
      linkedBy: preparerId,
    });
    createdLinkIds.push(link.linkId);

    expect(link.caseId).toBe(caseId);
    expect(link.organizationId).toBe(orgId);
    expect(link.financeArtifactType).toBe('HISTORICAL_ANALYSIS');
    expect(link.financeArtifactId).toBe(created.artifact.artifact_id);
    expect(link.financeVersionId).toBe(v1Id);
    expect(link.linkPurpose).toBe('roi_baseline_actuals');
    expect(link.linkedBy).toBe(preparerId);
  });

  it('linkFinanceArtifactToRoiCase rejects a nonexistent financeBusinessVersionId BEFORE calling the canonical command (no row created)', async () => {
    const fakeVersionId = randomUUID();

    await expect(
      roiFinanceLinkAdapter.linkFinanceArtifactToRoiCase({
        organizationId: orgId,
        caseId,
        financeBusinessVersionId: fakeVersionId,
        source: 'finance_v3.historical_analysis',
        linkPurpose: 'roi_baseline_actuals',
        linkedBy: preparerId,
      })
    ).rejects.toMatchObject({
      name: 'FinanceBusinessVersionNotFoundError',
      code: 'FINANCE_BUSINESS_VERSION_NOT_FOUND',
    });

    // Clean-error, not a dirty SQL error from the other side: no
    // rvn_roi_finance_links row was created for the fake id.
    const leaked = await withPinnedPostgresTransaction((tx) =>
      tx.queryOne(`SELECT link_id FROM rvn_roi_finance_links WHERE finance_version_id = ?`, [fakeVersionId])
    );
    expect(leaked).toBeNull();
  });

  it('getFinanceContextForLink(linkId) returns LINK_NOT_FOUND for an unknown link id', async () => {
    const result = await roiFinanceLinkAdapter.getFinanceContextForLink(randomUUID());
    expect(result.status).toBe('LINK_NOT_FOUND');
  });

  it(
    'a link survives its pinned Finance version being reopened+re-approved: the link never moves ' +
      'to the new version, but getFinanceContextForLink still resolves it fresh (SUPERSEDED, not APPROVED)',
    async () => {
      const created = await artifactVersionService.createArtifact({
        organizationId: orgId,
        artifactType: 'HISTORICAL_ANALYSIS',
        createdBy: preparerId,
      });
      const v1Id = created.businessVersion.business_version_id;
      const v1ApprovedVersion = await driveToApproved(v1Id, created.businessVersion.version);

      const link = await roiFinanceLinkAdapter.linkFinanceArtifactToRoiCase({
        organizationId: orgId,
        caseId,
        financeBusinessVersionId: v1Id,
        source: 'finance_v3.historical_analysis',
        linkPurpose: 'roi_baseline_actuals',
        linkedBy: preparerId,
      });
      createdLinkIds.push(link.linkId);

      // Before reopen: resolves to v1, APPROVED.
      const ctxBefore = await roiFinanceLinkAdapter.getFinanceContextForLink(link.linkId);
      expect(ctxBefore.status).toBe('OK');
      if (ctxBefore.status !== 'OK') throw new Error('unreachable');
      expect(ctxBefore.businessVersion.business_version_id).toBe(v1Id);
      expect(ctxBefore.businessVersion.status).toBe('APPROVED');
      expect(ctxBefore.artifact?.artifact_id).toBe(created.artifact.artifact_id);

      // Reopen v1 (APPROVED) -> v2 (DRAFT, parent_version_id=v1) — WP-B02 §6.
      // v1's own row is NEVER UPDATEd by reopenVersion (only superseded
      // later, as a side effect of v2's OWN approval below, T9).
      const reopened = await artifactVersionService.reopenVersion({
        organizationId: orgId,
        businessVersionId: v1Id,
        actorId: approverId,
        role: 'approver',
        expectedVersion: v1ApprovedVersion,
        reason: 'ROI-E007 streamB adapter test: prove the finance link pin does not follow reopen',
      });
      if (!reopened.ok) throw new Error(`fixture setup: reopenVersion failed: ${reopened.message}`);
      const v2Id = reopened.businessVersion.business_version_id;
      expect(v2Id).not.toBe(v1Id);

      // Immediately after reopen (v1 still APPROVED, v2 still DRAFT): the
      // link's pin has NOT moved and its context is unchanged.
      const ctxAfterReopen = await roiFinanceLinkAdapter.getFinanceContextForLink(link.linkId);
      expect(ctxAfterReopen.status).toBe('OK');
      if (ctxAfterReopen.status !== 'OK') throw new Error('unreachable');
      expect(ctxAfterReopen.businessVersion.business_version_id).toBe(v1Id);
      expect(ctxAfterReopen.businessVersion.status).toBe('APPROVED');

      // Approve v2 -> v1 gets superseded (T9, BUG-GOLDCO-03 fix) BEFORE v2
      // itself flips to APPROVED.
      await driveToApproved(v2Id, reopened.businessVersion.version);

      // After v2's approval: v1 (the link's actual pin) is now SUPERSEDED —
      // a live, non-APPROVED fact. The link's `financeVersionId` is STILL
      // v1 (Decision D4: no coupling, nothing rewrites it to v2), and
      // getFinanceContextForLink still correctly resolves to v1 (never
      // silently follows to v2, the new "current" version) while reporting
      // v1's REAL, freshly-read current status.
      const ctxAfterSupersede = await roiFinanceLinkAdapter.getFinanceContextForLink(link.linkId);
      expect(ctxAfterSupersede.status).toBe('OK');
      if (ctxAfterSupersede.status !== 'OK') throw new Error('unreachable');
      expect(ctxAfterSupersede.link.financeVersionId).toBe(v1Id);
      expect(ctxAfterSupersede.businessVersion.business_version_id).toBe(v1Id);
      expect(ctxAfterSupersede.businessVersion.business_version_id).not.toBe(v2Id);
      expect(ctxAfterSupersede.businessVersion.status).toBe('SUPERSEDED');

      // listFinanceLinksForCase — thin wrapper sanity check.
      const links = await roiFinanceLinkAdapter.listFinanceLinksForCase(orgId, caseId, preparerId);
      expect(links.some((l) => l.linkId === link.linkId)).toBe(true);
    }
  );
});
