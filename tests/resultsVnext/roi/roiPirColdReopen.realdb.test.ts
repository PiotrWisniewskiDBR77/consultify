/**
 * ROI-E006 — AC-04 cold-reopen proof, against a REAL Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E006_DESIGN.md §11 AC-04: "Cold
 * reopen returns an identical final snapshot."
 *
 * Finalizes a PIR (via `closeRoiCase`), then reads it back through a
 * GENUINELY SEPARATE client connection (a fresh `pg.Client`, not a re-query
 * on the same connection the write happened on) and confirms the payload
 * and hash are byte-identical to what was frozen at start time.
 *
 * METHODOLOGY NOTE (real-Postgres gotcha, worth documenting): Postgres
 * `jsonb` does NOT preserve the original key insertion order of the JSON
 * text it was given at INSERT time (Postgres's own docs: jsonb "does not
 * preserve white space, does not preserve the order of object keys"). This
 * means recomputing `computeStateHash` in JS from a value freshly read back
 * OUT of a `jsonb` column will generally NOT reproduce the hash that was
 * computed, in JS, on the ORIGINAL pre-insert object — not because anything
 * is broken, but because JSON.stringify's key order depends on the object's
 * construction, and jsonb's own output order is a different, internally
 * -normalized order. `startRoiCasePostInvestmentReview` computes
 * `review_snapshot_hash` exactly ONCE, in JS, before the INSERT, and stores
 * it as a plain TEXT column specifically so this is a non-issue for the
 * command layer (the hash is never recomputed from a jsonb round-trip in
 * production code). This test follows the same discipline: it compares TWO
 * READS of the same already-committed, trigger-protected row (freeze-time
 * vs. cold-reopen) — never a fresh recomputation of the hash from a
 * Postgres-returned payload compared against the original pre-insert value.
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
  insertVisibilityPolicy,
  loadRoiPirTestModules,
  type RoiPirTestModules,
} from './roiPirRealdbFixtures.js';

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `roi-e006-reopen-org-${tag}`;
const USER_OWNER = `roi-e006-reopen-owner-${tag}`;
const USER_APPROVER = `roi-e006-reopen-approver-${tag}`;
const USER_CLOSER = `roi-e006-reopen-closer-${tag}`;
const INITIATIVE_ID = `roi-e006-reopen-init-${tag}`;

let client: Client;
let reachable = false;
let modules: RoiPirTestModules;

describe('ROI-E006 AC-04 cold reopen (real Postgres, separate connection)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E006 cold-reopen realdb tests did NOT run. This run is not evidence.');
      return;
    }
    client = new Client(buildClientConfig() as ClientConfig);
    await client.connect();
    await client.query('SELECT 1 FROM rvn_roi_post_investment_reviews LIMIT 0');
    reachable = true;

    modules = await loadRoiPirTestModules();

    await insertOrganization(client, ORG_ID, 'ROI-E006 Cold-Reopen RealDB Org');
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

  itDB(
    'AC-04: finalize a PIR, then re-read it via a fresh client/process connection — review_snapshot_hash and review_snapshot_payload are byte-identical',
    async () => {
      await insertInitiative(client, INITIATIVE_ID, ORG_ID, 'Cold reopen fixture');
      const started = await buildCaseThroughPirStarted(client, modules, {
        organizationId: ORG_ID,
        initiativeId: INITIATIVE_ID,
        ownerUserId: USER_OWNER,
        approverId: USER_APPROVER,
      });

      const frozenAtStart = await modules.getRoiPostInvestmentReview({
        userId: USER_OWNER,
        organizationId: ORG_ID,
        caseId: started.caseId,
        pirId: started.pirId,
      });
      expect(frozenAtStart).not.toBeNull();
      const hashAtStart = frozenAtStart!.reviewSnapshotHash;
      const payloadJsonAtStart = JSON.stringify(frozenAtStart!.reviewSnapshotPayload);

      await modules.updateRoiPostInvestmentReviewDraft({
        pirId: started.pirId,
        caseId: started.caseId,
        organizationId: ORG_ID,
        expectedVersion: started.pirRowVersion,
        outcome: 'benefits_fully_realized',
        lessonsLearned: 'Cold-reopen fixture lesson.',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `draft-${randomUUID()}`,
      });

      const closeOutcome = await modules.closeRoiCase({
        caseId: started.caseId,
        organizationId: ORG_ID,
        expectedVersion: started.rowVersion,
        actorUserId: USER_CLOSER,
        actorEffectiveRole: 'admin',
        idempotencyKey: `close-${randomUUID()}`,
      });
      expect(closeOutcome.result.pir.status).toBe('finalized');
      // The finalize step does not touch the frozen facts — confirmed here,
      // not just asserted: same hash/payload as captured at reviewer start.
      expect(closeOutcome.result.pir.reviewSnapshotHash).toBe(hashAtStart);

      // GENUINELY SEPARATE client connection — not a re-query on `client`.
      const coldClient = new Client(buildClientConfig() as ClientConfig);
      await coldClient.connect();
      try {
        const coldRow = await coldClient.query<{ review_snapshot_hash: string; review_snapshot_payload: unknown; status: string }>(
          `SELECT review_snapshot_hash, review_snapshot_payload, status FROM rvn_roi_post_investment_reviews WHERE pir_id = $1`,
          [started.pirId]
        );
        expect(coldRow.rows).toHaveLength(1);
        expect(coldRow.rows[0]!.status).toBe('finalized');
        expect(coldRow.rows[0]!.review_snapshot_hash).toBe(hashAtStart);
        expect(JSON.stringify(coldRow.rows[0]!.review_snapshot_payload)).toBe(JSON.stringify(JSON.parse(payloadJsonAtStart)));
      } finally {
        await coldClient.end();
      }

      // Also via the real repository function (the actual production read
      // path), also proving byte-identical.
      const coldReadViaRepository = await modules.getRoiPostInvestmentReview({
        userId: USER_OWNER,
        organizationId: ORG_ID,
        caseId: started.caseId,
        pirId: started.pirId,
      });
      expect(coldReadViaRepository).not.toBeNull();
      expect(coldReadViaRepository!.reviewSnapshotHash).toBe(hashAtStart);
      expect(JSON.stringify(coldReadViaRepository!.reviewSnapshotPayload)).toBe(JSON.stringify(JSON.parse(payloadJsonAtStart)));
    }
  );
});
