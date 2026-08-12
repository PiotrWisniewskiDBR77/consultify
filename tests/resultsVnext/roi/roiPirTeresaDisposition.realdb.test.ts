/**
 * ROI-E006 — `recordRoiPirTeresaDraftDisposition` (AC-06), against a REAL
 * Postgres.
 *
 * Design: docs/product/results-vnext/ROI_E006_DESIGN.md §4.5.
 *
 * Proves the exact AC-06 scenario: `'rejected'` disposition leaves
 * `lessons_learned` COMPLETELY untouched; `'accepted'`/`'edited_then
 * _accepted'` DO copy `finalLessonsText` into it. Also proves: guard
 * (`status === 'draft'` only), `finalLessonsText` required unless
 * `'rejected'`, and the raw-UPDATE-blocked-once-finalized half via the
 * migration's own freeze trigger.
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
  type PirStartedBuildResult,
  type RoiPirTestModules,
} from './roiPirRealdbFixtures.js';

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_ID = `roi-e006-teresa-org-${tag}`;
const USER_OWNER = `roi-e006-teresa-owner-${tag}`;
const USER_APPROVER = `roi-e006-teresa-approver-${tag}`;
const USER_CLOSER = `roi-e006-teresa-closer-${tag}`;
const INITIATIVE_ID = `roi-e006-teresa-init-${tag}`;

let client: Client;
let reachable = false;
let modules: RoiPirTestModules;
let seq = 0;

async function freshPir(): Promise<PirStartedBuildResult> {
  seq += 1;
  const initiativeId = `${INITIATIVE_ID}-${seq}`;
  await insertInitiative(client, initiativeId, ORG_ID, `Teresa fixture ${seq}`);
  return buildCaseThroughPirStarted(client, modules, {
    organizationId: ORG_ID,
    initiativeId,
    ownerUserId: USER_OWNER,
    approverId: USER_APPROVER,
  });
}

describe('ROI-E006 recordRoiPirTeresaDraftDisposition (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — ROI-E006 Teresa-disposition realdb tests did NOT run. This run is not evidence.');
      return;
    }
    client = new Client(buildClientConfig() as ClientConfig);
    await client.connect();
    await client.query('SELECT 1 FROM rvn_roi_post_investment_reviews LIMIT 0');
    reachable = true;

    modules = await loadRoiPirTestModules();

    await insertOrganization(client, ORG_ID, 'ROI-E006 Teresa-Disposition RealDB Org');
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

  itDB("AC-06: 'rejected' disposition leaves lessons_learned COMPLETELY untouched", async () => {
    const started = await freshPir();

    // Pre-seed lessons_learned via the draft-update command, so this test
    // can prove 'rejected' leaves an EXISTING value alone, not merely that
    // it stays null.
    const draftOutcome = await modules.updateRoiPostInvestmentReviewDraft({
      pirId: started.pirId,
      caseId: started.caseId,
      organizationId: ORG_ID,
      expectedVersion: started.pirRowVersion,
      lessonsLearned: 'Original human-authored lesson — must survive a rejected Teresa draft untouched.',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `draft-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    const dispositionOutcome = await modules.recordRoiPirTeresaDraftDisposition({
      pirId: started.pirId,
      caseId: started.caseId,
      organizationId: ORG_ID,
      expectedVersion: draftOutcome.resultingVersion,
      disposition: 'rejected',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `disposition-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    expect(dispositionOutcome.outcome).toBe('applied');
    expect(dispositionOutcome.result.teresaDraftDisposition).toBe('rejected');
    expect(dispositionOutcome.result.lessonsLearned).toBe(
      'Original human-authored lesson — must survive a rejected Teresa draft untouched.'
    );

    const dbRow = await client.query<{ lessons_learned: string }>(
      `SELECT lessons_learned FROM rvn_roi_post_investment_reviews WHERE pir_id = $1`,
      [started.pirId]
    );
    expect(dbRow.rows[0]!.lessons_learned).toBe(
      'Original human-authored lesson — must survive a rejected Teresa draft untouched.'
    );
  });

  itDB("AC-06: 'accepted' copies finalLessonsText into the authoritative lessons_learned column", async () => {
    const started = await freshPir();

    const outcome = await modules.recordRoiPirTeresaDraftDisposition({
      pirId: started.pirId,
      caseId: started.caseId,
      organizationId: ORG_ID,
      expectedVersion: started.pirRowVersion,
      disposition: 'accepted',
      finalLessonsText: 'Teresa draft accepted verbatim: automate the manual reconciliation step.',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `disposition-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.teresaDraftDisposition).toBe('accepted');
    expect(outcome.result.lessonsLearned).toBe('Teresa draft accepted verbatim: automate the manual reconciliation step.');
  });

  itDB("AC-06: 'edited_then_accepted' copies the human-edited finalLessonsText, not any prior value", async () => {
    const started = await freshPir();

    const outcome = await modules.recordRoiPirTeresaDraftDisposition({
      pirId: started.pirId,
      caseId: started.caseId,
      organizationId: ORG_ID,
      expectedVersion: started.pirRowVersion,
      disposition: 'edited_then_accepted',
      finalLessonsText: 'Teresa draft edited by the consultant before acceptance: stagger the rollout by region.',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `disposition-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.teresaDraftDisposition).toBe('edited_then_accepted');
    expect(outcome.result.lessonsLearned).toBe(
      'Teresa draft edited by the consultant before acceptance: stagger the rollout by region.'
    );
  });

  itDB('rejects a non-"rejected" disposition with no finalLessonsText (FINAL_LESSONS_TEXT_REQUIRED)', async () => {
    const started = await freshPir();

    await expect(
      modules.recordRoiPirTeresaDraftDisposition({
        pirId: started.pirId,
        caseId: started.caseId,
        organizationId: ORG_ID,
        expectedVersion: started.pirRowVersion,
        disposition: 'accepted',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `disposition-missing-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toMatchObject({ code: 'FINAL_LESSONS_TEXT_REQUIRED' });
  });

  itDB('guard: rejects recording a disposition once the PIR is no longer "draft"', async () => {
    const started = await freshPir();
    await modules.updateRoiPostInvestmentReviewDraft({
      pirId: started.pirId,
      caseId: started.caseId,
      organizationId: ORG_ID,
      expectedVersion: started.pirRowVersion,
      outcome: 'benefits_fully_realized',
      lessonsLearned: 'Ship smaller batches.',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'consultant',
      idempotencyKey: `draft-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    const closeOutcome = await modules.closeRoiCase({
      caseId: started.caseId,
      organizationId: ORG_ID,
      expectedVersion: started.rowVersion,
      actorUserId: USER_CLOSER,
      actorEffectiveRole: 'admin',
      idempotencyKey: `close-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(closeOutcome.result.pir.status).toBe('finalized');

    await expect(
      modules.recordRoiPirTeresaDraftDisposition({
        pirId: started.pirId,
        caseId: started.caseId,
        organizationId: ORG_ID,
        expectedVersion: closeOutcome.result.pir.rowVersion,
        disposition: 'accepted',
        finalLessonsText: 'Too late — the PIR is finalized.',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'consultant',
        idempotencyKey: `disposition-finalized-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toMatchObject({ code: 'NOT_EDITABLE' });

    // The DB's own freeze trigger backs this even against a raw UPDATE
    // attempting to touch teresa_draft_disposition on a finalized row.
    await expect(
      client.query(`UPDATE rvn_roi_post_investment_reviews SET teresa_draft_disposition = 'accepted' WHERE pir_id = $1`, [
        started.pirId,
      ])
    ).rejects.toThrow(/finalized/i);
  });
});
