/**
 * ROI-E006 — `closeRoiCase` (AC-03, Decision D6), against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E006_DESIGN.md §4.6.
 *
 * Proves, in order: (1) open-variance block (no waiver); (2) waiver
 * override (`openVarianceWaiverReason` lets closure proceed with open
 * variances); (3) PIR-incomplete block (`outcome`/`lessonsLearned` both
 * required); (4) D6 self-close denial — the PIR's own `started_by` may not
 * close the case; (5) a DIFFERENT actor closing succeeds; (6)
 * `completeObligation` fires for `conduct_post_investment_review`; (7)
 * `next_action_type`/`next_action_due_at` are cleared while `next_review_at`
 * is preserved (Decision D4 — historical record).
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildCaseThroughPirStarted,
  buildClientConfig,
  cleanupRoiPirFixtures,
  DB_CONFIGURED,
  insertInitiative,
  insertOrganization,
  insertRawVariance,
  insertVisibilityPolicy,
  loadRoiPirTestModules,
  type RoiPirTestModules,
} from './roiPirRealdbFixtures.js';

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `roi-e006-close-org-${tag}`;
const USER_OWNER = `roi-e006-close-owner-${tag}`;
const USER_APPROVER = `roi-e006-close-approver-${tag}`;
const USER_CLOSER = `roi-e006-close-closer-${tag}`;
const INITIATIVE_ID = `roi-e006-close-init-${tag}`;

let client: Client;
let reachable = false;
let modules: RoiPirTestModules;

/** Marks the given PIR's `outcome`/`lessonsLearned` via the real command —
 * the shared PIR-completeness precondition several closure tests need
 * before they can reach their OWN, specific gate under test. */
async function completePirDraft(pirId: string, caseId: string, expectedVersion: number): Promise<void> {
  await modules.updateRoiPostInvestmentReviewDraft({
    pirId,
    caseId,
    organizationId: ORG_ID,
    expectedVersion,
    outcome: 'benefits_fully_realized',
    lessonsLearned: 'Ship smaller batches next time.',
    actorUserId: USER_OWNER,
    actorEffectiveRole: 'consultant',
    idempotencyKey: `draft-${randomUUID()}`,
  });
}

describe('ROI-E006 closeRoiCase (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E006 close realdb tests did NOT run. This run is not evidence.');
      return;
    }
    client = new Client(buildClientConfig() as ClientConfig);
    await client.connect();
    await client.query('SELECT 1 FROM rvn_roi_post_investment_reviews LIMIT 0');
    reachable = true;

    modules = await loadRoiPirTestModules();

    await insertOrganization(client, ORG_ID, 'ROI-E006 Close RealDB Org');
    await insertVisibilityPolicy(client, ORG_ID, 'roi', 'OPEN_ORG', USER_OWNER);
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    await cleanupRoiPirFixtures(client, ORG_ID);
    await client.end();
    if (modules.closePgPool) await modules.closePgPool();
  }, 30_000);

  const itDB = (name: string, fn: () => Promise<void>, timeoutMs = 30_000) =>
    it(
      name,
      async () => {
        if (!reachable) return;
        await fn();
      },
      timeoutMs
    );

  itDB('rejects closing from every non-"post_investment_review" status (e.g. "post_investment_review_due")', async () => {
    await insertInitiative(client, `${INITIATIVE_ID}-guard`, ORG_ID, 'Close guard fixture');
    const createOutcome = await modules.createRoiCase({
      organizationId: ORG_ID,
      initiativeId: `${INITIATIVE_ID}-guard`,
      title: 'Close guard case',
      ownerUserId: USER_OWNER,
      currency: 'USD',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `create-guard-${randomUUID()}`,
    });
    await expect(
      modules.closeRoiCase({
        caseId: createOutcome.result.case.caseId,
        organizationId: ORG_ID,
        expectedVersion: createOutcome.result.case.rowVersion,
        actorUserId: USER_CLOSER,
        actorEffectiveRole: 'admin',
        idempotencyKey: `close-guard-${randomUUID()}`,
      })
    ).rejects.toThrow(modules.RoiCaseValidationError);
  });

  itDB('AC-03: blocks closure when an open Variance exists and no waiver reason is supplied', async () => {
    await insertInitiative(client, `${INITIATIVE_ID}-1`, ORG_ID, 'Close fixture 1 (open variance block)');
    const started = await buildCaseThroughPirStarted(client, modules, {
      organizationId: ORG_ID,
      initiativeId: `${INITIATIVE_ID}-1`,
      ownerUserId: USER_OWNER,
      approverId: USER_APPROVER,
    });
    await insertRawVariance(client, { caseId: started.caseId, organizationId: ORG_ID, metric: 'npv', createdBy: USER_OWNER, status: 'open' });
    await completePirDraft(started.pirId, started.caseId, started.pirRowVersion);

    await expect(
      modules.closeRoiCase({
        caseId: started.caseId,
        organizationId: ORG_ID,
        expectedVersion: started.rowVersion,
        actorUserId: USER_CLOSER,
        actorEffectiveRole: 'admin',
        idempotencyKey: `close-openvar-${randomUUID()}`,
      })
    ).rejects.toMatchObject({ code: 'OPEN_VARIANCES_UNRESOLVED' });

    const caseRow = await client.query<{ status: string }>(`SELECT status FROM rvn_roi_cases WHERE case_id = $1`, [started.caseId]);
    expect(caseRow.rows[0]!.status).toBe('post_investment_review');
  });

  itDB('AC-03: an explicit openVarianceWaiverReason lets closure proceed despite the open Variance', async () => {
    await insertInitiative(client, `${INITIATIVE_ID}-2`, ORG_ID, 'Close fixture 2 (waiver override)');
    const started = await buildCaseThroughPirStarted(client, modules, {
      organizationId: ORG_ID,
      initiativeId: `${INITIATIVE_ID}-2`,
      ownerUserId: USER_OWNER,
      approverId: USER_APPROVER,
    });
    await insertRawVariance(client, { caseId: started.caseId, organizationId: ORG_ID, metric: 'npv', createdBy: USER_OWNER, status: 'open' });
    await completePirDraft(started.pirId, started.caseId, started.pirRowVersion);

    const outcome = await modules.closeRoiCase({
      caseId: started.caseId,
      organizationId: ORG_ID,
      expectedVersion: started.rowVersion,
      openVarianceWaiverReason: 'Client accepted residual variance in writing (ref: email 2026-08-10).',
      actorUserId: USER_CLOSER,
      actorEffectiveRole: 'admin',
      idempotencyKey: `close-waived-${randomUUID()}`,
    });

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.case.status).toBe('closed');
    expect(outcome.result.pir.status).toBe('finalized');
    expect(outcome.result.pir.openVarianceWaiverReason).toBe(
      'Client accepted residual variance in writing (ref: email 2026-08-10).'
    );
  });

  itDB('AC-03: blocks closure when the PIR is incomplete (outcome/lessonsLearned still null)', async () => {
    await insertInitiative(client, `${INITIATIVE_ID}-3`, ORG_ID, 'Close fixture 3 (PIR incomplete)');
    const started = await buildCaseThroughPirStarted(client, modules, {
      organizationId: ORG_ID,
      initiativeId: `${INITIATIVE_ID}-3`,
      ownerUserId: USER_OWNER,
      approverId: USER_APPROVER,
    });
    // No variances, no draft update — outcome/lessonsLearned are still null.

    await expect(
      modules.closeRoiCase({
        caseId: started.caseId,
        organizationId: ORG_ID,
        expectedVersion: started.rowVersion,
        actorUserId: USER_CLOSER,
        actorEffectiveRole: 'admin',
        idempotencyKey: `close-incomplete-${randomUUID()}`,
      })
    ).rejects.toMatchObject({ code: 'PIR_INCOMPLETE' });
  });

  itDB('D6: denies self-close — the actor who started the PIR may not also close the case', async () => {
    await insertInitiative(client, `${INITIATIVE_ID}-4`, ORG_ID, 'Close fixture 4 (self-close denial)');
    const started = await buildCaseThroughPirStarted(client, modules, {
      organizationId: ORG_ID,
      initiativeId: `${INITIATIVE_ID}-4`,
      ownerUserId: USER_OWNER,
      approverId: USER_APPROVER,
      // starterUserId defaults to ownerUserId — the SAME actor will attempt
      // to close below.
    });
    await completePirDraft(started.pirId, started.caseId, started.pirRowVersion);

    await expect(
      modules.closeRoiCase({
        caseId: started.caseId,
        organizationId: ORG_ID,
        expectedVersion: started.rowVersion,
        actorUserId: started.startedBy, // == USER_OWNER, the PIR's own starter
        actorEffectiveRole: 'consultant',
        idempotencyKey: `close-self-${randomUUID()}`,
      })
    ).rejects.toThrow(modules.RoiPirSelfCloseDeniedError);

    const caseRow = await client.query<{ status: string }>(`SELECT status FROM rvn_roi_cases WHERE case_id = $1`, [started.caseId]);
    expect(caseRow.rows[0]!.status).toBe('post_investment_review');
  });

  itDB(
    'D6 + full happy path: a DIFFERENT actor closes successfully — completeObligation fires, next_action_* cleared, next_review_at preserved',
    async () => {
      await insertInitiative(client, `${INITIATIVE_ID}-5`, ORG_ID, 'Close fixture 5 (happy path)');
      const nextReviewAt = '2026-09-01T00:00:00.000Z';

      const started = await buildCaseThroughPirStarted(client, modules, {
        organizationId: ORG_ID,
        initiativeId: `${INITIATIVE_ID}-5`,
        ownerUserId: USER_OWNER,
        approverId: USER_APPROVER,
      });

      // Stamp next_review_at directly (equivalent to having called
      // scheduleRoiCasePostInvestmentReview earlier in the chain — its own
      // guard only accepts 'tracking'/'benefits_realization', both already
      // consumed by buildCaseThroughPirStarted) so this test can assert
      // D4's "left as-is through closure" behavior in isolation.
      await client.query(`UPDATE rvn_roi_cases SET next_review_at = $1 WHERE case_id = $2`, [nextReviewAt, started.caseId]);

      await completePirDraft(started.pirId, started.caseId, started.pirRowVersion);

      const beforeObligation = await client.query<{ status: string }>(
        `SELECT status FROM rvn_platform_obligations
          WHERE organization_id = $1 AND reference_type = 'roi_case' AND reference_id = $2
            AND obligation_type = $3`,
        [ORG_ID, started.caseId, modules.CONDUCT_PIR_OBLIGATION_TYPE]
      );
      expect(beforeObligation.rows).toHaveLength(1);
      expect(beforeObligation.rows[0]!.status).toBe('open');

      const closeOutcome = await modules.closeRoiCase({
        caseId: started.caseId,
        organizationId: ORG_ID,
        expectedVersion: started.rowVersion,
        actorUserId: USER_CLOSER, // different from started.startedBy (USER_OWNER)
        actorEffectiveRole: 'admin',
        idempotencyKey: `close-happy-${randomUUID()}`,
      });

      expect(closeOutcome.outcome).toBe('applied');
      expect(closeOutcome.result.case.status).toBe('closed');
      expect(closeOutcome.result.case.nextActionType).toBeNull();
      expect(closeOutcome.result.case.nextActionDueAt).toBeNull();
      expect(new Date(closeOutcome.result.case.nextReviewAt as string).toISOString()).toBe(nextReviewAt);
      expect(closeOutcome.result.pir.status).toBe('finalized');
      expect(closeOutcome.result.pir.finalizedBy).toBe(USER_CLOSER);

      const afterObligation = await client.query<{ status: string; completed_via_command: string | null }>(
        `SELECT status, completed_via_command FROM rvn_platform_obligations
          WHERE organization_id = $1 AND reference_type = 'roi_case' AND reference_id = $2
            AND obligation_type = $3`,
        [ORG_ID, started.caseId, modules.CONDUCT_PIR_OBLIGATION_TYPE]
      );
      expect(afterObligation.rows[0]).toMatchObject({ status: 'completed', completed_via_command: 'closeRoiCase' });
    }
  );
});
