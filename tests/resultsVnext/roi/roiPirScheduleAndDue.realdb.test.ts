/**
 * ROI-E006 — `scheduleRoiCasePostInvestmentReview` (Decision D3/D4) and
 * `markRoiCasePostInvestmentReviewDue` (AC-01, Decision D5), against a REAL
 * Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E006_DESIGN.md §4.1/§4.2.
 *
 * Proves: (1) `scheduleRoiCasePostInvestmentReview`'s guard scope
 * (`'tracking'`/`'benefits_realization'` accepted, everything else
 * rejected) and that it writes `next_review_at`/`next_action_type`/
 * `next_action_due_at` without touching `status`; (2)
 * `markRoiCasePostInvestmentReviewDue`'s guard (`'benefits_realization'`
 * only); (3) **Decision D5's double-obligation effect** — the OLD
 * `confirm_benefits_realization` obligation is `completed`, a NEW
 * `conduct_post_investment_review` obligation is `open` with the correct
 * `dueAt` (mirroring whatever `next_review_at` was scheduled to) — this is
 * the FIRST real exercise of `completeObligation` anywhere in the program.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildCaseThroughBenefitsRealization,
  buildCaseThroughTracking,
  buildClientConfig,
  cleanupRoiPirFixtures,
  DB_CONFIGURED,
  insertInitiative,
  insertOrganization,
  insertVisibilityPolicy,
  loadRoiPirTestModules,
  type RoiPirTestModules,
} from './roiPirRealdbFixtures.js';

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `roi-e006-sched-org-${tag}`;
const USER_OWNER = `roi-e006-sched-owner-${tag}`;
const USER_APPROVER = `roi-e006-sched-approver-${tag}`;
const INITIATIVE_ID = `roi-e006-sched-init-${tag}`;

let client: Client;
let reachable = false;
let modules: RoiPirTestModules;

describe('ROI-E006 scheduleRoiCasePostInvestmentReview / markRoiCasePostInvestmentReviewDue (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E006 schedule/due realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    await client.connect();
    await client.query('SELECT 1 FROM rvn_roi_post_investment_reviews LIMIT 0');
    reachable = true;

    modules = await loadRoiPirTestModules();

    await insertOrganization(client, ORG_ID, 'ROI-E006 Schedule/Due RealDB Org');
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

  itDB('schedules from "tracking" — writes next_review_at/next_action_type/next_action_due_at, leaves status untouched', async () => {
    await insertInitiative(client, `${INITIATIVE_ID}-1`, ORG_ID, 'Schedule fixture 1');
    const tracking = await buildCaseThroughTracking(client, modules, {
      organizationId: ORG_ID,
      initiativeId: `${INITIATIVE_ID}-1`,
      ownerUserId: USER_OWNER,
      approverId: USER_APPROVER,
    });

    const nextReviewAt = '2026-12-01T00:00:00.000Z';
    const outcome = await modules.scheduleRoiCasePostInvestmentReview({
      caseId: tracking.caseId,
      organizationId: ORG_ID,
      expectedVersion: tracking.rowVersion,
      nextReviewAt,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `schedule-${randomUUID()}`,
    });

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.status).toBe('tracking');
    expect(new Date(outcome.result.nextReviewAt as string).toISOString()).toBe(nextReviewAt);
    expect(outcome.result.nextActionType).toBe('post_investment_review');
    expect(new Date(outcome.result.nextActionDueAt as string).toISOString()).toBe(nextReviewAt);
  });

  itDB('schedules from "benefits_realization" too (the other allowed fromStatus)', async () => {
    await insertInitiative(client, `${INITIATIVE_ID}-2`, ORG_ID, 'Schedule fixture 2');
    const br = await buildCaseThroughBenefitsRealization(client, modules, {
      organizationId: ORG_ID,
      initiativeId: `${INITIATIVE_ID}-2`,
      ownerUserId: USER_OWNER,
      approverId: USER_APPROVER,
    });

    const outcome = await modules.scheduleRoiCasePostInvestmentReview({
      caseId: br.caseId,
      organizationId: ORG_ID,
      expectedVersion: br.rowVersion,
      nextReviewAt: '2026-11-15T00:00:00.000Z',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `schedule-${randomUUID()}`,
    });

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.status).toBe('benefits_realization');
  });

  itDB('rejects scheduling from every other status (e.g. "approved")', async () => {
    await insertInitiative(client, `${INITIATIVE_ID}-3`, ORG_ID, 'Schedule guard fixture');
    const createOutcome = await modules.createRoiCase({
      organizationId: ORG_ID,
      initiativeId: `${INITIATIVE_ID}-3`,
      title: 'Schedule guard case',
      ownerUserId: USER_OWNER,
      currency: 'USD',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `create-guard-${randomUUID()}`,
    });
    const stamped = await client.query<{ row_version: number }>(
      `UPDATE rvn_roi_cases SET status = 'approved', row_version = row_version + 1 WHERE case_id = $1 RETURNING row_version`,
      [createOutcome.result.case.caseId]
    );

    await expect(
      modules.scheduleRoiCasePostInvestmentReview({
        caseId: createOutcome.result.case.caseId,
        organizationId: ORG_ID,
        expectedVersion: stamped.rows[0]!.row_version,
        nextReviewAt: '2026-11-15T00:00:00.000Z',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `schedule-guard-${randomUUID()}`,
      })
    ).rejects.toThrow(modules.RoiCaseValidationError);
  });

  itDB(
    'markRoiCasePostInvestmentReviewDue: "benefits_realization" -> "post_investment_review_due", completes confirm_benefits_realization (D5), opens conduct_post_investment_review due at next_review_at',
    async () => {
      await insertInitiative(client, `${INITIATIVE_ID}-4`, ORG_ID, 'Due fixture');
      const br = await buildCaseThroughBenefitsRealization(client, modules, {
        organizationId: ORG_ID,
        initiativeId: `${INITIATIVE_ID}-4`,
        ownerUserId: USER_OWNER,
        approverId: USER_APPROVER,
      });

      const nextReviewAt = '2026-10-01T00:00:00.000Z';
      const scheduled = await modules.scheduleRoiCasePostInvestmentReview({
        caseId: br.caseId,
        organizationId: ORG_ID,
        expectedVersion: br.rowVersion,
        nextReviewAt,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `schedule-${randomUUID()}`,
      });

      // Confirm both obligations are 'open' BEFORE mark-due (the interesting
      // baseline this test's own assertions depend on).
      const beforeObligations = await client.query<{ obligation_type: string; status: string }>(
        `SELECT obligation_type, status FROM rvn_platform_obligations
          WHERE organization_id = $1 AND reference_type = 'roi_case' AND reference_id = $2
            AND obligation_type IN ('confirm_benefits_realization', 'conduct_post_investment_review')`,
        [ORG_ID, br.caseId]
      );
      expect(beforeObligations.rows).toHaveLength(1);
      expect(beforeObligations.rows[0]).toMatchObject({ obligation_type: 'confirm_benefits_realization', status: 'open' });

      const dueOutcome = await modules.markRoiCasePostInvestmentReviewDue({
        caseId: br.caseId,
        organizationId: ORG_ID,
        expectedVersion: scheduled.resultingVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `due-${randomUUID()}`,
      });

      expect(dueOutcome.outcome).toBe('applied');
      expect(dueOutcome.result.status).toBe('post_investment_review_due');
      expect(dueOutcome.result.nextActionType).toBe('conduct_post_investment_review');

      const afterObligations = await client.query<{ obligation_type: string; status: string; due_at: string | null; assignee_user_id: string }>(
        `SELECT obligation_type, status, due_at, assignee_user_id FROM rvn_platform_obligations
          WHERE organization_id = $1 AND reference_type = 'roi_case' AND reference_id = $2
            AND obligation_type IN ('confirm_benefits_realization', 'conduct_post_investment_review')
          ORDER BY obligation_type`,
        [ORG_ID, br.caseId]
      );
      expect(afterObligations.rows).toHaveLength(2);
      const byType = new Map(afterObligations.rows.map((row) => [row.obligation_type, row]));
      expect(byType.get('confirm_benefits_realization')).toMatchObject({ status: 'completed' });
      const conductRow = byType.get('conduct_post_investment_review');
      expect(conductRow).toMatchObject({ status: 'open', assignee_user_id: USER_OWNER });
      expect(new Date(conductRow!.due_at as string).toISOString()).toBe(nextReviewAt);
    }
  );

  itDB('rejects markRoiCasePostInvestmentReviewDue from every non-"benefits_realization" status', async () => {
    await insertInitiative(client, `${INITIATIVE_ID}-5`, ORG_ID, 'Due guard fixture');
    const tracking = await buildCaseThroughTracking(client, modules, {
      organizationId: ORG_ID,
      initiativeId: `${INITIATIVE_ID}-5`,
      ownerUserId: USER_OWNER,
      approverId: USER_APPROVER,
    });

    await expect(
      modules.markRoiCasePostInvestmentReviewDue({
        caseId: tracking.caseId,
        organizationId: ORG_ID,
        expectedVersion: tracking.rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `due-guard-${randomUUID()}`,
      })
    ).rejects.toThrow(modules.RoiCaseValidationError);

    const row = await client.query<{ status: string }>(`SELECT status FROM rvn_roi_cases WHERE case_id = $1`, [tracking.caseId]);
    expect(row.rows[0]!.status).toBe('tracking');
  });
});
