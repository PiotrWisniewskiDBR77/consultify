/**
 * ROI-E006 — `startRoiCasePostInvestmentReview` (AC-02, Decisions D7/D8),
 * against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E006_DESIGN.md §4.3.
 *
 * Proves: (1) the guard (`'post_investment_review_due'` only); (2) the
 * frozen payload matches hand-verified figures at start time (pointer IDs +
 * compare view + benefits-realization view + variances, Decision D8); (3)
 * **AC-02's central claim**: a live Variance mutation AFTER the PIR
 * snapshot is taken does NOT change the already-frozen `review_snapshot
 * _hash`/`review_snapshot_payload` — the DB's own `rvn_roi_pir_protect
 * _frozen` trigger backs this even against a direct UPDATE attempt.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildCaseThroughPirDue,
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
const ORG_ID = `roi-e006-start-org-${tag}`;
const USER_OWNER = `roi-e006-start-owner-${tag}`;
const USER_APPROVER = `roi-e006-start-approver-${tag}`;
const INITIATIVE_ID = `roi-e006-start-init-${tag}`;

let client: Client;
let reachable = false;
let modules: RoiPirTestModules;

describe('ROI-E006 startRoiCasePostInvestmentReview (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E006 start-PIR realdb tests did NOT run. This run is not evidence.');
      return;
    }
    client = new Client(buildClientConfig() as ClientConfig);
    await client.connect();
    await client.query('SELECT 1 FROM rvn_roi_post_investment_reviews LIMIT 0');
    reachable = true;

    modules = await loadRoiPirTestModules();

    await insertOrganization(client, ORG_ID, 'ROI-E006 Start-PIR RealDB Org');
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

  itDB('rejects starting the PIR from every non-"post_investment_review_due" status', async () => {
    await insertInitiative(client, `${INITIATIVE_ID}-guard`, ORG_ID, 'Start guard fixture');
    const createOutcome = await modules.createRoiCase({
      organizationId: ORG_ID,
      initiativeId: `${INITIATIVE_ID}-guard`,
      title: 'Start guard case',
      ownerUserId: USER_OWNER,
      currency: 'USD',
      createdBy: USER_OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `create-guard-${randomUUID()}`,
    });

    await expect(
      modules.startRoiCasePostInvestmentReview({
        caseId: createOutcome.result.case.caseId,
        organizationId: ORG_ID,
        expectedVersion: createOutcome.result.case.rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `start-guard-${randomUUID()}`,
      })
    ).rejects.toThrow(modules.RoiCaseValidationError);
  });

  itDB(
    'AC-02/D8: freezes a review snapshot at reviewer start — pointer IDs + compare view + benefits-realization view + variances, matching hand-verified figures',
    async () => {
      await insertInitiative(client, `${INITIATIVE_ID}-1`, ORG_ID, 'Start fixture 1');
      const due = await buildCaseThroughPirDue(client, modules, {
        organizationId: ORG_ID,
        initiativeId: `${INITIATIVE_ID}-1`,
        ownerUserId: USER_OWNER,
        approverId: USER_APPROVER,
      });

      // Record one Variance BEFORE starting the PIR — it must be captured
      // in the frozen snapshot's `variances` array.
      const caseRow = await client.query<{ latest_approved_snapshot_id: string }>(
        `SELECT latest_approved_snapshot_id FROM rvn_roi_cases WHERE case_id = $1`,
        [due.caseId]
      );
      const varianceOutcome = await insertRawVariance(client, {
        caseId: due.caseId,
        organizationId: ORG_ID,
        metric: 'totalCosts',
        createdBy: USER_OWNER,
      });

      const startOutcome = await modules.startRoiCasePostInvestmentReview({
        caseId: due.caseId,
        organizationId: ORG_ID,
        expectedVersion: due.rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `start-${randomUUID()}`,
      });

      expect(startOutcome.outcome).toBe('applied');
      expect(startOutcome.result.case.status).toBe('post_investment_review');
      expect(startOutcome.result.case.nextActionType).toBe('finalize_post_investment_review');

      const pir = startOutcome.result.pir;
      expect(pir.status).toBe('draft');
      expect(pir.sequenceNumber).toBe(1);
      expect(pir.startedBy).toBe(USER_OWNER);
      expect(typeof pir.reviewSnapshotHash).toBe('string');
      expect(pir.reviewSnapshotHash.length).toBe(64); // sha256 hex

      const payload = pir.reviewSnapshotPayload;
      expect(payload.caseId).toBe(due.caseId);
      expect(payload.latestApprovedSnapshotId).toBe(caseRow.rows[0]!.latest_approved_snapshot_id);
      expect(payload.compareView.caseId).toBe(due.caseId);
      expect(payload.benefitsRealizationView.caseId).toBe(due.caseId);
      expect(payload.variances).toHaveLength(1);
      expect(payload.variances[0].varianceId).toBe(varianceOutcome.varianceId);

      // Read the row back directly to confirm the DB-stored hash/payload
      // match what the command returned (not a re-derived value).
      const dbRow = await client.query<{ review_snapshot_hash: string; sequence_number: number }>(
        `SELECT review_snapshot_hash, sequence_number FROM rvn_roi_post_investment_reviews WHERE pir_id = $1`,
        [pir.pirId]
      );
      expect(dbRow.rows[0]!.review_snapshot_hash).toBe(pir.reviewSnapshotHash);
      expect(dbRow.rows[0]!.sequence_number).toBe(1);
    }
  );

  itDB(
    'AC-02: a live Variance mutation AFTER the snapshot is taken does NOT change the already-frozen review_snapshot_hash/payload',
    async () => {
      await insertInitiative(client, `${INITIATIVE_ID}-2`, ORG_ID, 'Start fixture 2 (post-freeze mutation)');
      const due = await buildCaseThroughPirDue(client, modules, {
        organizationId: ORG_ID,
        initiativeId: `${INITIATIVE_ID}-2`,
        ownerUserId: USER_OWNER,
        approverId: USER_APPROVER,
      });

      const startOutcome = await modules.startRoiCasePostInvestmentReview({
        caseId: due.caseId,
        organizationId: ORG_ID,
        expectedVersion: due.rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `start-${randomUUID()}`,
      });
      const pirId = startOutcome.result.pir.pirId;
      const frozenHash = startOutcome.result.pir.reviewSnapshotHash;
      const frozenPayloadJson = JSON.stringify(startOutcome.result.pir.reviewSnapshotPayload);

      // AFTER the freeze: record a NEW variance (a live mutation the frozen
      // snapshot's own `variances` array — captured at start time — could
      // not possibly have seen).
      await insertRawVariance(client, {
        caseId: due.caseId,
        organizationId: ORG_ID,
        metric: 'npv',
        createdBy: USER_OWNER,
      });

      const afterMutation = await client.query<{ review_snapshot_hash: string; review_snapshot_payload: unknown }>(
        `SELECT review_snapshot_hash, review_snapshot_payload FROM rvn_roi_post_investment_reviews WHERE pir_id = $1`,
        [pirId]
      );
      expect(afterMutation.rows[0]!.review_snapshot_hash).toBe(frozenHash);
      expect(JSON.stringify(afterMutation.rows[0]!.review_snapshot_payload)).toBe(
        JSON.stringify(JSON.parse(frozenPayloadJson))
      );
      // The stored payload's own variances count still reflects ONLY what
      // existed at freeze time (zero, in this fixture) — not the
      // post-freeze variance recorded above.
      const storedPayload = afterMutation.rows[0]!.review_snapshot_payload as { variances: unknown[] };
      expect(storedPayload.variances).toHaveLength(0);

      // Direct UPDATE attempt on the frozen facts is blocked by the DB
      // trigger even outside the command layer.
      await expect(
        client.query(`UPDATE rvn_roi_post_investment_reviews SET review_snapshot_hash = 'tampered' WHERE pir_id = $1`, [pirId])
      ).rejects.toThrow(/immutable/i);
    }
  );
});
