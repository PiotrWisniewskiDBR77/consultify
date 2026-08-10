/**
 * OKR-E007 — Manager/self review command layer (OKR-F-022, D5/D6), against
 * a REAL Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E007_DESIGN.md §4.3, D5/D6.
 *
 * Proves: (1) `submitOkrSetForManagerReview` creates a `submitted` review
 * row, `submitOkrSetSelfReview`'s inverse eligibility check (only the
 * Set's own Owner may submit its self-review — a plain guard, NOT a
 * maker-checker denial, D6); (2) `approveOkrSetManagerReview`'s
 * self-approval denial fires on BOTH the `submitted_by` branch AND the
 * (distinct) `owner_user_id` branch (D6's terminology-hazard ruling: this
 * is `OkrManagerReviewSelfApprovalDeniedError`, never `SelfReviewDenied*`);
 * (3) approve/request-changes both succeed for a genuinely-independent
 * reviewer.
 *
 * SKIP POLICY: same convention as every other `*.realdb.test.ts` in this
 * program — silent no-op without a configured database, `beforeAll` throws
 * if configured-but-unreachable.
 */
import { randomUUID } from 'node:crypto';

import { Client, type ClientConfig } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  DB_CONFIGURED,
  buildClientConfig,
  buildActiveOkrSetFixture,
  cleanupOkrE007Fixture,
} from './okrE007TestFixtures.js';

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_PREFIX = `okr-e007-review-org-${tag}`;
const USER_ADMIN = `okr-e007-review-admin-${tag}`;
const USER_OWNER = `okr-e007-review-owner-${tag}`;
const USER_REVIEWER = `okr-e007-review-reviewer-${tag}`;

let client: Client;
let reachable = false;

type ReviewCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrReviewCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let submitOkrSetSelfReview: ReviewCommandsModule['submitOkrSetSelfReview'];
let submitOkrSetForManagerReview: ReviewCommandsModule['submitOkrSetForManagerReview'];
let approveOkrSetManagerReview: ReviewCommandsModule['approveOkrSetManagerReview'];
let requestChangesOnOkrSetManagerReview: ReviewCommandsModule['requestChangesOnOkrSetManagerReview'];
let recordOkrSetReviewComment: ReviewCommandsModule['recordOkrSetReviewComment'];
let listOkrSetReviews: ReviewCommandsModule['listOkrSetReviews'];
let OkrManagerReviewSelfApprovalDeniedError: ReviewCommandsModule['OkrManagerReviewSelfApprovalDeniedError'];
let OkrReviewValidationError: ReviewCommandsModule['OkrReviewValidationError'];
let closePgPool: (() => Promise<void>) | undefined;

const organizationIdsUsed: string[] = [];

describe('OKR-E007 manager/self review — D6 self-approval denial (both branches) + approve/request-changes (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E007 manager-review realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_reviews LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR-E007 review schema); refusing to report a green run. ' +
          String(error)
      );
    }
    reachable = true;

    const reviewCommands: ReviewCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrReviewCommands.js'
    );
    submitOkrSetSelfReview = reviewCommands.submitOkrSetSelfReview;
    submitOkrSetForManagerReview = reviewCommands.submitOkrSetForManagerReview;
    approveOkrSetManagerReview = reviewCommands.approveOkrSetManagerReview;
    requestChangesOnOkrSetManagerReview = reviewCommands.requestChangesOnOkrSetManagerReview;
    recordOkrSetReviewComment = reviewCommands.recordOkrSetReviewComment;
    listOkrSetReviews = reviewCommands.listOkrSetReviews;
    OkrManagerReviewSelfApprovalDeniedError = reviewCommands.OkrManagerReviewSelfApprovalDeniedError;
    OkrReviewValidationError = reviewCommands.OkrReviewValidationError;

    const pgModule: PgModule = await import('../../../server/src/database/PostgresDatabase.js');
    closePgPool = (pgModule as unknown as { closePool?: () => Promise<void> }).closePool;
  }, 30_000);

  afterAll(async () => {
    if (!reachable) return;
    for (const organizationId of organizationIdsUsed) {
      await cleanupOkrE007Fixture(client, organizationId);
    }
    await client.end();
    if (closePgPool) await closePgPool();
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

  async function freshFixture() {
    const organizationId = `${ORG_PREFIX}-${randomUUID()}`;
    organizationIdsUsed.push(organizationId);
    return buildActiveOkrSetFixture({
      organizationId,
      adminUserId: USER_ADMIN,
      ownerUserId: USER_OWNER,
      reviewerUserId: USER_REVIEWER,
      programPolicyOverrides: { objectiveRollupModel: 'equal_average' },
    });
  }

  itDB('submitOkrSetForManagerReview: creates a submitted review row (create path, expectedVersion=0)', async () => {
    const fixture = await freshFixture();
    const outcome = await submitOkrSetForManagerReview({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 0,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-manager-${randomUUID()}`,
    });
    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.status).toBe('submitted');
    expect(outcome.result.reviewType).toBe('manager');
    expect(outcome.result.reviewerUserId).toBe(USER_REVIEWER);
    expect(outcome.result.submittedBy).toBe(USER_OWNER);

    const obligation = await client.query<{ obligation_type: string; assignee_user_id: string }>(
      `SELECT obligation_type, assignee_user_id FROM rvn_platform_obligations
        WHERE organization_id = $1 AND reference_id = $2 AND obligation_type = 'manager_review_okr_set'`,
      [fixture.organizationId, fixture.setId]
    );
    expect(obligation.rows).toHaveLength(1);
    expect(obligation.rows[0]!.assignee_user_id).toBe(USER_REVIEWER);
  });

  itDB('submitOkrSetSelfReview: inverse eligibility check — only the Set Owner may submit (plain guard, not a denial)', async () => {
    const fixture = await freshFixture();
    await expect(
      submitOkrSetSelfReview({
        setId: fixture.setId,
        organizationId: fixture.organizationId,
        expectedVersion: 0,
        actorUserId: USER_REVIEWER, // NOT the owner
        actorEffectiveRole: 'member',
        idempotencyKey: `submit-self-nonowner-${randomUUID()}`,
      })
    ).rejects.toThrow(OkrReviewValidationError);

    const outcome = await submitOkrSetSelfReview({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 0,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-self-owner-${randomUUID()}`,
    });
    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.reviewType).toBe('self');
    expect(outcome.result.status).toBe('submitted');
    expect(outcome.result.submittedBy).toBe(USER_OWNER);
  });

  itDB('approveOkrSetManagerReview: self-approval denial on the submitted_by branch', async () => {
    const fixture = await freshFixture();
    // USER_ADMIN submits on behalf of the Set (owner-initiated is the
    // realistic path, but the command itself has no actor-is-owner guard —
    // this test deliberately uses a distinct submitter to isolate the
    // submitted_by branch from the owner_user_id branch below).
    await submitOkrSetForManagerReview({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 0,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `submit-manager-${randomUUID()}`,
    });

    let caught: unknown;
    try {
      await approveOkrSetManagerReview({
        setId: fixture.setId,
        organizationId: fixture.organizationId,
        expectedVersion: 1,
        actorUserId: USER_ADMIN, // matches submitted_by
        actorEffectiveRole: 'admin',
        idempotencyKey: `approve-self-${randomUUID()}`,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OkrManagerReviewSelfApprovalDeniedError);
    expect((caught as InstanceType<typeof OkrManagerReviewSelfApprovalDeniedError>).details).toMatchObject({
      reasonField: 'submitted_by',
    });
  });

  itDB('approveOkrSetManagerReview: self-approval denial on the owner_user_id branch (distinct from submitted_by)', async () => {
    const fixture = await freshFixture();
    // USER_ADMIN submits (submitted_by=USER_ADMIN); the Set's OWNER then
    // attempts to approve — denied via the owner_user_id branch even
    // though USER_OWNER never submitted this review.
    await submitOkrSetForManagerReview({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 0,
      actorUserId: USER_ADMIN,
      actorEffectiveRole: 'admin',
      idempotencyKey: `submit-manager-${randomUUID()}`,
    });

    let caught: unknown;
    try {
      await approveOkrSetManagerReview({
        setId: fixture.setId,
        organizationId: fixture.organizationId,
        expectedVersion: 1,
        actorUserId: USER_OWNER, // matches set.owner_user_id, NOT submitted_by
        actorEffectiveRole: 'member',
        idempotencyKey: `approve-owner-${randomUUID()}`,
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(OkrManagerReviewSelfApprovalDeniedError);
    expect((caught as InstanceType<typeof OkrManagerReviewSelfApprovalDeniedError>).details).toMatchObject({
      reasonField: 'owner_user_id',
    });
  });

  itDB('approveOkrSetManagerReview: succeeds for a genuinely independent reviewer', async () => {
    const fixture = await freshFixture();
    await submitOkrSetForManagerReview({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 0,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-manager-${randomUUID()}`,
    });
    const outcome = await approveOkrSetManagerReview({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 1,
      outcome: 'looks good',
      actorUserId: USER_REVIEWER,
      actorEffectiveRole: 'member',
      idempotencyKey: `approve-${randomUUID()}`,
    });
    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.status).toBe('approved');
    expect(outcome.result.outcome).toBe('looks good');
    expect(outcome.result.decidedBy).toBe(USER_REVIEWER);
  });

  itDB('requestChangesOnOkrSetManagerReview: no self-check — the Set Owner may decline their own submission', async () => {
    const fixture = await freshFixture();
    await submitOkrSetForManagerReview({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 0,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-manager-${randomUUID()}`,
    });
    const outcome = await requestChangesOnOkrSetManagerReview({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 1,
      changeRequestNotes: 'needs more detail',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `request-changes-${randomUUID()}`,
    });
    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.status).toBe('changes_requested');
  });

  itDB('resubmit after changes_requested: reuses the SAME (set_id, review_type) row, never a second one', async () => {
    const fixture = await freshFixture();
    const first = await submitOkrSetForManagerReview({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 0,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-1-${randomUUID()}`,
    });
    const declined = await requestChangesOnOkrSetManagerReview({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: first.resultingVersion,
      changeRequestNotes: 'try again',
      actorUserId: USER_REVIEWER,
      actorEffectiveRole: 'member',
      idempotencyKey: `request-changes-${randomUUID()}`,
    });
    const resubmitted = await submitOkrSetForManagerReview({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: declined.resultingVersion,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-2-${randomUUID()}`,
    });
    expect(resubmitted.result.status).toBe('submitted');

    const countResult = await client.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM okr_vnext_reviews WHERE set_id = $1 AND review_type = 'manager'`,
      [fixture.setId]
    );
    expect(Number(countResult.rows[0]!.count)).toBe(1);
  });

  itDB('recordOkrSetReviewComment: appends a comment without changing status; listOkrSetReviews reflects it', async () => {
    const fixture = await freshFixture();
    const submitted = await submitOkrSetForManagerReview({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 0,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-manager-${randomUUID()}`,
    });
    const commented = await recordOkrSetReviewComment({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      reviewType: 'manager',
      expectedVersion: submitted.resultingVersion,
      level: 'set',
      targetId: fixture.setId,
      text: 'left a note',
      actorUserId: USER_REVIEWER,
      actorEffectiveRole: 'member',
      idempotencyKey: `comment-${randomUUID()}`,
    });
    expect(commented.result.status).toBe('submitted');
    expect(commented.result.comments).toHaveLength(1);
    expect(commented.result.comments[0]!.text).toBe('left a note');

    const reviews = await listOkrSetReviews({ userId: USER_OWNER, organizationId: fixture.organizationId, setId: fixture.setId });
    expect(reviews.find((r) => r.reviewType === 'manager')?.comments).toHaveLength(1);
  });
});
