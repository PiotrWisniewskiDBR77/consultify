/**
 * AP-08 — Exception Inbox, real PostgreSQL integration test.
 *
 * Exercises `exceptionInboxService.listExceptionInbox()` against the ACTUAL
 * migrated schema (`finance_exceptions`/`finance_exceptions_current` from
 * WP-B05, `finance_business_versions.freshness` from WP-B01/B03,
 * `finance_comments`/`finance_comment_assignments` from AP-06), not a
 * hand-rolled schema.
 *
 * Scenario (task brief — "3 różne typy exception na powiązanych artefaktach
 * GoldCo"): two related "GoldCo" artifacts —
 *
 *   - a STATEMENT_PACK business version that is BOTH (a) an explicit
 *     `finance_exceptions` WARNING row and (b) STALE_SOURCE freshness, and
 *   - a BASELINE_MODEL business version carrying an unresolved blocking
 *     review comment.
 *
 * Phase 1 asserts the inbox returns exactly 3 deduplicated entries (one per
 * category: tie_out_fail, stale, blocker) with the right owner/deep link.
 * Phase 2 (dedupe) raises a SECOND `finance_exceptions` row on the SAME
 * business version, with a reason_code matching the ALREADY-STALE
 * `freshness_reason` — the inbox must still show exactly 3 entries (the new
 * exception folds into the existing "stale" entry by root cause, not become
 * a 4th row), per WP-B05_exception_ledger_ADR.md section 7 / task
 * requirement 1 ("grupowanie po root cause, nie po źródłowej tabeli").
 *
 * Same env-var contract as this repo's other `.pg.test.ts` suites
 * (`RUN_DB_TESTS=1`, `MOCK_DB=false`, `DATABASE_URL=postgresql://...`) —
 * `describe.skipIf`-gated so a run with no real database reachable reports
 * SKIPPED, never a false green.
 *
 * HOW TO RUN (against your own throwaway/ephemeral cluster — NEVER against
 * the shared local Postgres or any demo/staging/prod host):
 *
 *   DB_TYPE=postgres NODE_ENV=test RUN_DB_TESTS=1 MOCK_DB=false \
 *   DATABASE_URL=postgresql://postgres@127.0.0.1:<port>/<db> \
 *   npx vitest run --config server/vitest.config.ts \
 *     server/src/services/finance/canonical/__tests__/exceptionInboxService.pg.test.ts \
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

describe.skipIf(!REAL_PG)('AP-08 exception inbox — real PostgreSQL', () => {
  let withPinnedPostgresTransaction: typeof import('../../../../database/PostgresDatabase.js').withPinnedPostgresTransaction;
  let artifactVersionService: typeof import('../artifactVersionService.js');
  let exceptionLedgerService: typeof import('../exceptionLedgerService.js');
  let commentService: typeof import('../commentService.js');
  let exceptionInboxService: typeof import('../exceptionInboxService.js');

  const orgId = `org-finv3-ap08-goldco-${randomUUID()}`;
  const preparerId = `user-preparer-${randomUUID()}`;
  const reviewerId = `user-reviewer-${randomUUID()}`;
  const analystId = `user-analyst-${randomUUID()}`;

  const SHARED_ROOT_CAUSE = 'GOLDCO_UPSTREAM_SOURCE_REFRESH_2026Q2';

  let statementPackArtifactId = '';
  let statementPackBvId = '';
  let baselineModelArtifactId = '';
  let baselineModelBvId = '';
  let blockingCommentId = '';

  beforeAll(async () => {
    ({ withPinnedPostgresTransaction } = await import('../../../../database/PostgresDatabase.js'));
    artifactVersionService = await import('../artifactVersionService.js');
    exceptionLedgerService = await import('../exceptionLedgerService.js');
    commentService = await import('../commentService.js');
    exceptionInboxService = await import('../exceptionInboxService.js');

    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(`INSERT INTO organizations (id, name) VALUES (?, ?)`, [orgId, 'GoldCo AP-08 Test Org'])
    );

    // --- GoldCo artifact 1: STATEMENT_PACK — hosts the explicit exception + stale freshness ---
    const statementPack = await artifactVersionService.createArtifact({
      organizationId: orgId,
      artifactType: 'STATEMENT_PACK',
      naturalKey: 'goldco-statement-pack-2026q2',
      createdBy: preparerId,
    });
    statementPackArtifactId = statementPack.artifact.artifact_id;
    statementPackBvId = statementPack.businessVersion.business_version_id;

    // --- GoldCo artifact 2: BASELINE_MODEL — hosts the blocking review comment ---
    const baselineModel = await artifactVersionService.createArtifact({
      organizationId: orgId,
      artifactType: 'BASELINE_MODEL',
      naturalKey: 'goldco-baseline-model-2026q2',
      createdBy: preparerId,
    });
    baselineModelArtifactId = baselineModel.artifact.artifact_id;
    baselineModelBvId = baselineModel.businessVersion.business_version_id;
  });

  afterAll(async () => {
    // Best-effort only, same convention as canonicalServices.pg.test.ts (finance_exceptions,
    // finance_business_versions, finance_artifacts are transitively undeletable once an
    // append-only child row exists — that is the schema's guarantee working as intended, not a
    // test bug). finance_comments/finance_comment_assignments have no deny-delete trigger.
    await withPinnedPostgresTransaction(async (tx) => {
      await tx.queryRun(`DELETE FROM finance_comment_assignments WHERE organization_id = ?`, [orgId]);
      await tx.queryRun(`DELETE FROM finance_comments WHERE organization_id = ?`, [orgId]);
    });
  });

  it('type 1: an explicit finance_exceptions WARNING row -> tie_out_fail entry with owner + deep link', async () => {
    const raised = await exceptionLedgerService.raise({
      organizationId: orgId,
      artifactId: statementPackArtifactId,
      businessVersionId: statementPackBvId,
      severity: 'WARNING',
      sourceRef: { statement_line_code: 'TOTAL_ASSETS', period_id: '2026-Q2', entity_id: 'goldco_main' },
      reasonCode: 'ROUNDING_TOLERANCE_EXCEEDED',
      owner: analystId,
      raisedBy: preparerId,
    });
    expect(raised.ok).toBe(true);

    const inbox = await exceptionInboxService.listExceptionInbox({ organizationId: orgId, artifactId: statementPackArtifactId });
    const entry = inbox.find((e) => e.category === 'tie_out_fail');
    expect(entry).toBeTruthy();
    expect(entry?.severity).toBe('WARNING');
    expect(entry?.owner).toBe(analystId);
    expect(entry?.ownerIsDefault).toBe(false);
    expect(entry?.businessVersionId).toBe(statementPackBvId);
    expect(entry?.deepLink.artifactId).toBe(statementPackArtifactId);
    expect(entry?.deepLink.url).toContain(statementPackArtifactId);
    expect(entry?.deepLink.url).toContain(`focus=TOTAL_ASSETS`);
  });

  it('type 2: an unresolved blocking comment -> blocker entry with owner + deep link', async () => {
    const created = await commentService.createComment({
      organizationId: orgId,
      artifactId: baselineModelArtifactId,
      businessVersionId: baselineModelBvId,
      authorId: reviewerId,
      body: 'GoldCo baseline WACC input looks stale versus the latest market data pull — blocking until confirmed.',
      isBlocking: true,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) throw new Error('unreachable');
    blockingCommentId = created.comment.id;

    const inbox = await exceptionInboxService.listExceptionInbox({ organizationId: orgId, artifactId: baselineModelArtifactId });
    const entry = inbox.find((e) => e.category === 'blocker');
    expect(entry).toBeTruthy();
    expect(entry?.owner).toBe(reviewerId); // no assignment yet -> defaults to comment author
    expect(entry?.ownerIsDefault).toBe(true);
    expect(entry?.businessVersionId).toBe(baselineModelBvId);
    expect(entry?.deepLink.url).toContain(`comment=${blockingCommentId}`);
    expect(entry?.sources[0]).toEqual({ category: 'blocker', table: 'finance_comments', id: blockingCommentId });
  });

  it('type 3: stale freshness after a source change -> stale entry, owner defaults to the business version creator', async () => {
    await withPinnedPostgresTransaction((tx) =>
      tx.queryRun(
        `UPDATE finance_business_versions SET freshness = 'STALE_SOURCE', freshness_reason = ?, stale_since = now()
          WHERE business_version_id = ?`,
        [SHARED_ROOT_CAUSE, statementPackBvId]
      )
    );

    const inbox = await exceptionInboxService.listExceptionInbox({ organizationId: orgId, artifactId: statementPackArtifactId });
    const entry = inbox.find((e) => e.category === 'stale');
    expect(entry).toBeTruthy();
    expect(entry?.severity).toBe('WARNING');
    expect(entry?.owner).toBe(preparerId); // finance_business_versions has no owner column -> defaults to created_by
    expect(entry?.ownerIsDefault).toBe(true);
    expect(entry?.reason).toBe(SHARED_ROOT_CAUSE);
    expect(entry?.businessVersionId).toBe(statementPackBvId);
  });

  it('phase 1: exactly 3 deduplicated entries across the whole GoldCo scenario so far', async () => {
    const inbox = await exceptionInboxService.listExceptionInbox({ organizationId: orgId });
    const categories = inbox.map((e) => e.category).sort();
    expect(categories).toEqual(['blocker', 'stale', 'tie_out_fail']);
    expect(inbox).toHaveLength(3);
  });

  it('dedupe: a second finance_exceptions row for the SAME root cause as the existing stale entry does not add a 4th entry', async () => {
    const before = await exceptionInboxService.listExceptionInbox({ organizationId: orgId, artifactId: statementPackArtifactId });
    expect(before).toHaveLength(2); // tie_out_fail (ROUNDING_TOLERANCE_EXCEEDED) + stale (SHARED_ROOT_CAUSE), on this artifact

    const raisedAgain = await exceptionLedgerService.raise({
      organizationId: orgId,
      artifactId: statementPackArtifactId,
      businessVersionId: statementPackBvId,
      severity: 'MATERIAL', // deliberately higher severity than the stale entry's fixed WARNING, to also assert severity escalates on merge
      sourceRef: { statement_line_code: 'TOTAL_ASSETS', period_id: '2026-Q2', entity_id: 'goldco_main' },
      reasonCode: SHARED_ROOT_CAUSE, // SAME normalized cause as the stale entry's freshness_reason
      raisedBy: preparerId,
    });
    expect(raisedAgain.ok).toBe(true);

    const after = await exceptionInboxService.listExceptionInbox({ organizationId: orgId, artifactId: statementPackArtifactId });
    // Still 2 on this artifact (tie_out_fail#1 + the merged stale/tie_out_fail#2), not 3.
    expect(after).toHaveLength(2);

    const merged = after.find((e) => e.businessVersionId === statementPackBvId && e.reason === SHARED_ROOT_CAUSE);
    expect(merged).toBeTruthy();
    expect(merged?.mergedCategories.sort()).toEqual(['stale', 'tie_out_fail']);
    expect(merged?.category).toBe('tie_out_fail'); // explicit finance_exceptions row outranks a derived freshness flag (CATEGORY_PRIORITY)
    expect(merged?.severity).toBe('MATERIAL'); // max severity across the merged sources
    expect(merged?.sources).toHaveLength(2);

    // Whole-org view: still exactly 3 total (tie_out_fail#1 + merged + blocker).
    const wholeOrg = await exceptionInboxService.listExceptionInbox({ organizationId: orgId });
    expect(wholeOrg).toHaveLength(3);
  });
});
