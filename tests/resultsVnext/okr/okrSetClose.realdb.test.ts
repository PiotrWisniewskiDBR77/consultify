/**
 * OKR-E007 — `closeOkrSet` (OKR-F-021/022, D9-D11), against a REAL
 * Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E007_DESIGN.md §4.5, D9-D11.
 *
 * Proves the three close gates independently — `manager_review_required`,
 * `self_review_required`, `reflection_required_for_close`, each read from
 * the Cycle's PINNED policy snapshot (D11) — AND D10's deliberate
 * *absence* of a self-close check: with every gate OFF, the Set's own
 * Owner (also its `created_by`) can close it directly, because OKR's
 * `manager_review_required` policy (when ON) already provides the
 * equivalent protection transitively via `OkrManagerReviewSelfApprovalDeniedError`
 * — a genuine, reasoned divergence from ROI-E006's `RoiPirSelfCloseDeniedError`.
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
  readSetVersionAndStatus,
} from './okrE007TestFixtures.js';

const tag = `${Date.now().toString(36)}_${randomUUID().slice(0, 8)}`;
const ORG_PREFIX = `okr-e007-close-org-${tag}`;
const USER_ADMIN = `okr-e007-close-admin-${tag}`;
const USER_OWNER = `okr-e007-close-owner-${tag}`;
const USER_REVIEWER = `okr-e007-close-reviewer-${tag}`;

let client: Client;
let reachable = false;

type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ReviewCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrReviewCommands.js');
type ReflectionCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrReflectionCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let closeOkrSet: SetCommandsModule['closeOkrSet'];
let runOkrSetLifecycleTransition: SetCommandsModule['runOkrSetLifecycleTransition'];
let OKR_SET_OPEN_REVIEW_SPEC: SetCommandsModule['OKR_SET_OPEN_REVIEW_SPEC'];
let submitOkrSetForManagerReview: ReviewCommandsModule['submitOkrSetForManagerReview'];
let approveOkrSetManagerReview: ReviewCommandsModule['approveOkrSetManagerReview'];
let submitOkrSetSelfReview: ReviewCommandsModule['submitOkrSetSelfReview'];
let OkrSetManagerReviewRequiredError: ReviewCommandsModule['OkrSetManagerReviewRequiredError'];
let OkrSetSelfReviewRequiredError: ReviewCommandsModule['OkrSetSelfReviewRequiredError'];
let recordObjectiveReflection: ReflectionCommandsModule['recordObjectiveReflection'];
let finalScoreOkrSet: ReflectionCommandsModule['finalScoreOkrSet'];
let OkrSetReflectionRequiredError: ReflectionCommandsModule['OkrSetReflectionRequiredError'];
let closePgPool: (() => Promise<void>) | undefined;

const organizationIdsUsed: string[] = [];

describe('OKR-E007 closeOkrSet — three independent close gates + D10 no-self-close-check (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E007 closeOkrSet realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_reviews LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR-E007 schema); refusing to report a green run. ' + String(error)
      );
    }
    reachable = true;

    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    closeOkrSet = setCommands.closeOkrSet;
    runOkrSetLifecycleTransition = setCommands.runOkrSetLifecycleTransition;
    OKR_SET_OPEN_REVIEW_SPEC = setCommands.OKR_SET_OPEN_REVIEW_SPEC;

    const reviewCommands: ReviewCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrReviewCommands.js'
    );
    submitOkrSetForManagerReview = reviewCommands.submitOkrSetForManagerReview;
    approveOkrSetManagerReview = reviewCommands.approveOkrSetManagerReview;
    submitOkrSetSelfReview = reviewCommands.submitOkrSetSelfReview;
    OkrSetManagerReviewRequiredError = reviewCommands.OkrSetManagerReviewRequiredError;
    OkrSetSelfReviewRequiredError = reviewCommands.OkrSetSelfReviewRequiredError;

    const reflectionCommands: ReflectionCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrReflectionCommands.js'
    );
    recordObjectiveReflection = reflectionCommands.recordObjectiveReflection;
    finalScoreOkrSet = reflectionCommands.finalScoreOkrSet;
    OkrSetReflectionRequiredError = reflectionCommands.OkrSetReflectionRequiredError;

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

  async function freshReviewFixture(policyOverrides: Record<string, unknown>) {
    const organizationId = `${ORG_PREFIX}-${randomUUID()}`;
    organizationIdsUsed.push(organizationId);
    const fixture = await buildActiveOkrSetFixture({
      organizationId,
      adminUserId: USER_ADMIN,
      ownerUserId: USER_OWNER,
      reviewerUserId: USER_REVIEWER,
      programPolicyOverrides: { objectiveRollupModel: 'equal_average', ...policyOverrides },
      objectives: [
        {
          title: 'Close-gate fixture Objective',
          keyResults: [
            { currentValue: 5, targetValue: 10 },
            { currentValue: 5, targetValue: 10 },
          ],
        },
      ],
    });
    const { rowVersion } = await readSetVersionAndStatus(client, fixture.setId);
    await runOkrSetLifecycleTransition(OKR_SET_OPEN_REVIEW_SPEC, {
      setId: fixture.setId,
      organizationId,
      expectedVersion: rowVersion,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `open-review-${randomUUID()}`,
    });
    return fixture;
  }

  itDB('manager-review gate: rejects when required and not approved; succeeds once approved', async () => {
    const fixture = await freshReviewFixture({ managerReviewRequired: true, selfReviewRequired: false, reflectionRequiredForClose: false });

    const { rowVersion: v1 } = await readSetVersionAndStatus(client, fixture.setId);
    await expect(
      closeOkrSet({
        setId: fixture.setId,
        organizationId: fixture.organizationId,
        expectedVersion: v1,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `close-1-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toThrow(OkrSetManagerReviewRequiredError);

    await submitOkrSetForManagerReview({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 0,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-manager-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    await approveOkrSetManagerReview({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 1,
      actorUserId: USER_REVIEWER,
      actorEffectiveRole: 'member',
      idempotencyKey: `approve-manager-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    const { rowVersion: v2 } = await readSetVersionAndStatus(client, fixture.setId);
    const outcome = await closeOkrSet({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: v2,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `close-2-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.set.status).toBe('closed');
  });

  itDB('self-review gate: rejects when required and not submitted; succeeds once submitted', async () => {
    const fixture = await freshReviewFixture({ managerReviewRequired: false, selfReviewRequired: true, reflectionRequiredForClose: false });

    const { rowVersion: v1 } = await readSetVersionAndStatus(client, fixture.setId);
    await expect(
      closeOkrSet({
        setId: fixture.setId,
        organizationId: fixture.organizationId,
        expectedVersion: v1,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `close-1-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toThrow(OkrSetSelfReviewRequiredError);

    await submitOkrSetSelfReview({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 0,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `submit-self-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    const { rowVersion: v2 } = await readSetVersionAndStatus(client, fixture.setId);
    const outcome = await closeOkrSet({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: v2,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `close-2-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.set.status).toBe('closed');
  });

  itDB('reflection-completeness gate: rejects when required and incomplete; succeeds once complete', async () => {
    const fixture = await freshReviewFixture({ managerReviewRequired: false, selfReviewRequired: false, reflectionRequiredForClose: true });

    const { rowVersion: v1 } = await readSetVersionAndStatus(client, fixture.setId);
    await expect(
      closeOkrSet({
        setId: fixture.setId,
        organizationId: fixture.organizationId,
        expectedVersion: v1,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `close-1-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toThrow(OkrSetReflectionRequiredError);

    const { rowVersion: v2 } = await readSetVersionAndStatus(client, fixture.setId);
    await finalScoreOkrSet({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: v2,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `final-score-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    await recordObjectiveReflection({
      objectiveId: fixture.objectiveIds[0]!,
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: 1,
      whatWorked: 'a',
      whatDidNotWork: 'b',
      why: 'c',
      learning: 'd',
      nextCycleChange: 'e',
      disposition: 'complete',
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `reflect-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

    const { rowVersion: v3 } = await readSetVersionAndStatus(client, fixture.setId);
    const outcome = await closeOkrSet({
      setId: fixture.setId,
      organizationId: fixture.organizationId,
      expectedVersion: v3,
      actorUserId: USER_OWNER,
      actorEffectiveRole: 'member',
      idempotencyKey: `close-2-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});
    expect(outcome.outcome).toBe('applied');
    expect(outcome.result.set.status).toBe('closed');

    const reflectionRow = await client.query<{ status: string }>(
      `SELECT status FROM okr_vnext_reflections WHERE objective_id = $1`,
      [fixture.objectiveIds[0]]
    );
    expect(reflectionRow.rows[0]!.status).toBe('finalized');
  });

  itDB(
    'D10: with every gate OFF, the Set Owner (also its created_by) can close directly — NO self-close denial exists',
    async () => {
      const fixture = await freshReviewFixture({
        managerReviewRequired: false,
        selfReviewRequired: false,
        reflectionRequiredForClose: false,
      });
      const { rowVersion } = await readSetVersionAndStatus(client, fixture.setId);
      const outcome = await closeOkrSet({
        setId: fixture.setId,
        organizationId: fixture.organizationId,
        expectedVersion: rowVersion,
        actorUserId: USER_OWNER, // the Set's own owner AND created_by
        actorEffectiveRole: 'member',
        idempotencyKey: `close-self-${randomUUID()}`,
      });
      expect(outcome.outcome).toBe('applied');
      expect(outcome.result.set.status).toBe('closed');

      // Even with reflection_required_for_close=false, closing finalizes
      // whatever draft reflection rows exist for this Set (D4's "frozen
      // from whatever state it was in" — none exist here, so this asserts
      // the absence rather than a finalized row).
      const reflectionCount = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM okr_vnext_reflections WHERE set_id = $1`,
        [fixture.setId]
      );
      expect(Number(reflectionCount.rows[0]!.count)).toBe(0);
    }
  );

  itDB('closeOkrSet rejects a Set that is not "review" (e.g. still "active")', async () => {
    const organizationId = `${ORG_PREFIX}-notreview-${randomUUID()}`;
    organizationIdsUsed.push(organizationId);
    const fixture = await buildActiveOkrSetFixture({
      organizationId,
      adminUserId: USER_ADMIN,
      ownerUserId: USER_OWNER,
      reviewerUserId: USER_REVIEWER,
      programPolicyOverrides: { objectiveRollupModel: 'equal_average', managerReviewRequired: false },
    });
    const { rowVersion } = await readSetVersionAndStatus(client, fixture.setId);
    await expect(
      closeOkrSet({
        setId: fixture.setId,
        organizationId,
        expectedVersion: rowVersion,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `close-notreview-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
})
    ).rejects.toThrow();
  });
});
