/**
 * OKR-E007 — Reflection/Review visibility-join regression, against a REAL
 * Postgres.
 *
 * Design: docs/product/results-vnext/OKR_E007_DESIGN.md §5.
 *
 * `okr_vnext_reflections`/`okr_vnext_reviews` inherit visibility EXCLUSIVELY
 * via `set_id`, joined against `rvn_platform_resource_visibility` with
 * `resource_type='okr_set'`. `rvn_platform_resource_visibility.resource_id`
 * is TEXT; both tables' `set_id` is UUID — every such join needs the
 * `::text` cast. This exact cast has already been missed 7 times in one
 * KPI epic (this program's single most-repeated real bug) — same rationale
 * `roiPirVisibilityJoin.realdb.test.ts`/`okrSetVisibilityJoin.realdb.test.ts`/
 * `okrObjectiveVisibilityJoin.realdb.test.ts`/`okrCheckInVisibilityJoin.realdb.test.ts`
 * already state for their own aggregates.
 *
 * Two parts:
 * 1. `listOkrSetReviews` (this epic's own, real, ABAC-scoped repository
 *    function) — proven end-to-end: an outsider with zero ACL grant on a
 *    `PRIVATE`-mode Set sees zero review rows despite the row genuinely
 *    existing.
 * 2. `okr_vnext_reflections` — this epic's own file list (§7) requires
 *    THIS test file to exist, but §6's API surface names NO `GET` route
 *    (and therefore no repository read function) for reflection content —
 *    an honest gap this file's own header flags explicitly (restated in
 *    the closure entry) rather than inventing an unrouted capability to
 *    "make the test pass" (IO-3). What CAN be proven without that function:
 *    the exact join shape a future reader WOULD need
 *    (`vr.resource_id = r.set_id::text`) behaves identically to the proven
 *    `okr_vnext_reviews` join above — same table family, same
 *    `set_id`-inherited visibility contract (§5), same TEXT/UUID cast
 *    requirement — verified directly against real rows via raw SQL,
 *    mirroring `okrObjectiveVisibilityJoin.realdb.test.ts`'s own "direct
 *    proof" test shape.
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
const ORG_PREFIX = `okr-e007-visjoin-org-${tag}`;
const USER_ADMIN = `okr-e007-visjoin-admin-${tag}`;
const USER_OWNER = `okr-e007-visjoin-owner-${tag}`;
const USER_REVIEWER = `okr-e007-visjoin-reviewer-${tag}`;
const USER_OUTSIDER = `okr-e007-visjoin-outsider-${tag}`;

let client: Client;
let reachable = false;

type SetCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
type ReviewCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrReviewCommands.js');
type ReflectionCommandsModule = typeof import('../../../server/src/services/resultsVnext/okr/okrReflectionCommands.js');
type PgModule = typeof import('../../../server/src/database/PostgresDatabase.js');

let narrowOkrSetVisibility: SetCommandsModule['narrowOkrSetVisibility'];
let submitOkrSetForManagerReview: ReviewCommandsModule['submitOkrSetForManagerReview'];
let listOkrSetReviews: ReviewCommandsModule['listOkrSetReviews'];
let recordObjectiveReflection: ReflectionCommandsModule['recordObjectiveReflection'];
let closePgPool: (() => Promise<void>) | undefined;

const organizationIdsUsed: string[] = [];

describe('OKR-E007 Reflection/Review visibility-join — ::text cast forces real join execution (real Postgres)', () => {
  beforeAll(async () => {
    if (!DB_CONFIGURED) {
      // eslint-disable-next-line no-console
      console.error('[skip] No Postgres configured — OKR-E007 visibility-join realdb tests did NOT run. This run is not evidence.');
      return;
    }

    client = new Client(buildClientConfig() as ClientConfig);
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.query('SELECT 1 FROM okr_vnext_reflections LIMIT 0');
      await client.query('SELECT 1 FROM okr_vnext_reviews LIMIT 0');
    } catch (error) {
      throw new Error(
        'A database is configured but is not reachable (or missing the OKR-E007 schema); refusing to report a green run. ' + String(error)
      );
    }
    reachable = true;

    const setCommands: SetCommandsModule = await import('../../../server/src/services/resultsVnext/okr/okrSetCommands.js');
    narrowOkrSetVisibility = setCommands.narrowOkrSetVisibility;

    const reviewCommands: ReviewCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrReviewCommands.js'
    );
    submitOkrSetForManagerReview = reviewCommands.submitOkrSetForManagerReview;
    listOkrSetReviews = reviewCommands.listOkrSetReviews;

    const reflectionCommands: ReflectionCommandsModule = await import(
      '../../../server/src/services/resultsVnext/okr/okrReflectionCommands.js'
    );
    recordObjectiveReflection = reflectionCommands.recordObjectiveReflection;

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

  itDB(
    'okr_vnext_reviews (listOkrSetReviews): PRIVATE-mode Set — outsider sees zero rows despite the row genuinely existing',
    async () => {
      const fixture = await freshFixture();
      await submitOkrSetForManagerReview({
        setId: fixture.setId,
        organizationId: fixture.organizationId,
        expectedVersion: 0,
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `submit-manager-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      const { rowVersion } = await readSetVersionAndStatus(client, fixture.setId);
      await narrowOkrSetVisibility({
        setId: fixture.setId,
        organizationId: fixture.organizationId,
        expectedVersion: rowVersion,
        visibilityMode: 'PRIVATE',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `narrow-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      // The row genuinely exists — proven by a direct, un-visibility-scoped
      // SELECT.
      const rawCount = await client.query<{ count: string }>(
        `SELECT COUNT(*) AS count FROM okr_vnext_reviews WHERE set_id = $1`,
        [fixture.setId]
      );
      expect(Number(rawCount.rows[0]!.count)).toBe(1);

      const outsiderReviews = await listOkrSetReviews({
        userId: USER_OUTSIDER,
        organizationId: fixture.organizationId,
        setId: fixture.setId,
      });
      expect(outsiderReviews).toEqual([]);

      const ownerReviews = await listOkrSetReviews({
        userId: USER_OWNER,
        organizationId: fixture.organizationId,
        setId: fixture.setId,
      });
      expect(ownerReviews).toHaveLength(1);
    }
  );

  itDB(
    'okr_vnext_reflections: direct proof — the ::text-cast join is required (bare UUID=TEXT comparison fails to plan) and, once cast, correctly enforces PRIVATE-mode denial. ' +
      'NO repository read function exists yet for reflection content (§6 names no GET route) — flagged as a gap in the closure entry, not silently worked around by inventing an unrouted capability (IO-3).',
    async () => {
      const fixture = await freshFixture();
      await recordObjectiveReflection({
        objectiveId: fixture.objectiveIds[0]!,
        setId: fixture.setId,
        organizationId: fixture.organizationId,
        expectedVersion: 0,
        whatWorked: 'visibility-join fixture',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `reflect-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      const { rowVersion } = await readSetVersionAndStatus(client, fixture.setId);
      await narrowOkrSetVisibility({
        setId: fixture.setId,
        organizationId: fixture.organizationId,
        expectedVersion: rowVersion,
        visibilityMode: 'PRIVATE',
        actorUserId: USER_OWNER,
        actorEffectiveRole: 'member',
        idempotencyKey: `narrow-${randomUUID()}`,
        access: { capabilities: ['*'], platformRole: null },
});

      // Bare join WITHOUT the cast: Postgres rejects the type mismatch
      // outright (42883 operator does not exist: text = uuid) — proving
      // the cast is not cosmetic, it is load-bearing.
      await expect(
        client.query(
          `SELECT r.reflection_id
             FROM okr_vnext_reflections r
             JOIN rvn_platform_resource_visibility rv
               ON rv.resource_type = 'okr_set' AND rv.resource_id = r.set_id
            WHERE r.objective_id = $1`,
          [fixture.objectiveIds[0]]
        )
      ).rejects.toThrow(/operator does not exist|cannot be matched/i);

      // Cast present: the visibility row is found (PRIVATE, owner_user_id
      // set to USER_OWNER) and the join executes cleanly.
      const castedOwner = await client.query(
        `SELECT r.reflection_id
           FROM okr_vnext_reflections r
           JOIN rvn_platform_resource_visibility rv
             ON rv.resource_type = 'okr_set' AND rv.resource_id = r.set_id::text
          WHERE r.objective_id = $1 AND rv.visibility_mode = 'PRIVATE' AND rv.owner_user_id = $2`,
        [fixture.objectiveIds[0], USER_OWNER]
      );
      expect(castedOwner.rowCount).toBe(1);

      // Same cast, filtered as an ACL-less outsider would be (no ACL grant
      // row for USER_OUTSIDER on this Set) — zero rows, proving the join
      // shape a future reflection-read function would use correctly
      // excludes an outsider under PRIVATE, not merely "some join executed".
      // Authorization predicate for PRIVATE mode: visible only if the
      // caller IS the owner OR HAS an ACL grant — for a genuine outsider
      // (neither), this correctly resolves to zero rows.
      const castedOutsider = await client.query(
        `SELECT r.reflection_id
           FROM okr_vnext_reflections r
           JOIN rvn_platform_resource_visibility rv
             ON rv.resource_type = 'okr_set' AND rv.resource_id = r.set_id::text
           LEFT JOIN rvn_platform_resource_acl acl
             ON acl.resource_type = 'okr_set' AND acl.resource_id = r.set_id::text AND acl.grantee_id = $2
          WHERE r.objective_id = $1
            AND rv.visibility_mode = 'PRIVATE'
            AND (rv.owner_user_id = $2 OR acl.grantee_id IS NOT NULL)`,
        [fixture.objectiveIds[0], USER_OUTSIDER]
      );
      expect(castedOutsider.rowCount).toBe(0);
    }
  );
});
