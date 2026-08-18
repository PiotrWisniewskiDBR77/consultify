/**
 * CLOSEOUT-CO5 — the one shared `organizations` fixture precondition for
 * every ROI realdb suite.
 *
 * WHY THIS EXISTS. On a fully-migrated Postgres, `initiatives
 * .organization_id` carries a real FK (`initiatives_organization_id_fkey`)
 * to `organizations(id)`. Most ROI realdb suites open their `beforeAll`
 * with a defensive `CREATE TABLE IF NOT EXISTS initiatives (...)` — a
 * three-column stub for the resultsVnext-slice-only schema. Against the
 * real schema that statement is a silent no-op: the table already exists,
 * WITH the FK. Any suite that then inserts an initiative without first
 * creating its organization row fails with a 23503, and the stub in its
 * own `beforeAll` makes the failure look like a schema problem rather than
 * the missing precondition it is.
 *
 * Eighteen suites had exactly that gap. Rather than paste the same INSERT
 * eighteen times (the shape the already-green suites each grew
 * independently), they all call this one helper. `ON CONFLICT DO NOTHING`
 * keeps it safe to call from a `beforeAll` that may re-run, and safe for
 * suites whose org id is not per-run unique.
 *
 * NOT a `.test.ts` file — vitest never collects it.
 */
import type { Client } from 'pg';

import {
  publishRoiGovernedVisibilityPolicy,
  ROI_GOVERNED_VISIBILITY_POLICY,
} from '../../../server/src/services/resultsVnext/platform/visibilityResolver.js';
import type { PublishRoiGovernedVisibilityPolicyOutcome } from '../../../server/src/services/resultsVnext/platform/visibilityResolver.js';

export async function ensureRoiFixtureOrganization(
  client: Client,
  organizationId: string,
  name: string
): Promise<void> {
  await client.query(
    `INSERT INTO organizations (id, name, plan, status) VALUES ($1, $2, 'enterprise', 'active')
     ON CONFLICT (id) DO NOTHING`,
    [organizationId, name]
  );
}

/**
 * F2 blast-radius remediation — composable helper #1 of 2.
 *
 * Upserts a `users` row and a same-tenant `organization_members` row for
 * one actor. Deliberately `ON CONFLICT ... DO UPDATE`, NOT `DO NOTHING`:
 * a suite's own earlier `beforeAll`/`it` may already have inserted this
 * exact (organizationId, userId) pair with a DIFFERENT role or status
 * (e.g. REVOKED, from a prior deny-path assertion in the same file) —
 * `DO NOTHING` would silently leave that stale row in place, and the
 * caller's next `ensureRoiGovernedVisibility`/`createRoiCase` call would
 * then fail with `NOT_ACTIVE_MEMBER` pointing nowhere near the real cause.
 * `DO UPDATE` makes this call idempotent AND self-correcting.
 *
 * Deliberately separate from `ensureRoiGovernedVisibility` below rather
 * than one fused "make ROI case creation pass" call: a consumer that wants
 * to construct a DENY scenario (revoked member, ordinary member with no
 * grant, foreign-tenant caller) still needs to grant membership without
 * ever publishing the governed policy as that actor, or needs to publish
 * the policy as one actor while granting a DIFFERENT actor a lesser role.
 * A fused helper would make that structurally awkward.
 */
export async function ensureRoiFixtureMembership(
  client: Client,
  params: {
    organizationId: string;
    userId: string;
    role: 'OWNER' | 'ADMIN' | 'MEMBER';
    status?: 'ACTIVE' | 'REVOKED';
    email?: string;
  }
): Promise<void> {
  const { organizationId, userId, role, status = 'ACTIVE', email = `${userId}@roi-fixture.local` } = params;
  await client.query(
    `INSERT INTO users (id, email, organization_id) VALUES ($1, $2, $3)
     ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, organization_id = EXCLUDED.organization_id`,
    [userId, email, organizationId]
  );
  await client.query(
    `INSERT INTO organization_members (id, organization_id, user_id, role, status)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (organization_id, user_id) DO UPDATE SET role = EXCLUDED.role, status = EXCLUDED.status`,
    // The row id must be scoped by (organizationId, userId), not userId
    // alone: the same user can legitimately hold membership in more than
    // one organization. A userId-only id would collide on
    // organization_members_pkey the second time that user is granted
    // membership in a DIFFERENT org, while the ON CONFLICT (organization_id,
    // user_id) arbiter would not match that constraint — Postgres would
    // raise a raw duplicate-key error instead of upserting. Found via a
    // realdb run: roiRealdbOrgFixtureHelper.realdb.test.ts's upsert-safety
    // case originally exercised this via a second organization; that path
    // was later replaced with a same-org collision proof (avoids
    // permanently undeletable residue from a second published governance
    // row), but the id must stay org-scoped regardless — any future caller
    // reusing a userId across organizations would hit the same bug.
    [`${organizationId}-${userId}-membership`, organizationId, userId, role, status]
  );
}

/**
 * F2 blast-radius remediation — composable helper #2 of 2.
 *
 * Establishes governed ROI visibility for one organization by calling the
 * CANONICAL production function, `publishRoiGovernedVisibilityPolicy`
 * (visibilityResolver.ts) — never a raw `INSERT INTO
 * rvn_roi_visibility_governance`, and never a hand-written legacy
 * `rvn_platform_visibility_policies` row. This matters structurally, not
 * just stylistically: `publishRoiGovernedVisibilityPolicy` is the ONLY
 * function in this codebase that writes BOTH the governance row and the
 * legacy `domain='roi', mode='ROI_GOVERNED'` policy row, in the SAME
 * transaction (visibilityResolver.ts:783-786, 796). The invariant
 * `governed.allow === true` implies "a legacy policy row exists, with
 * mode 'ROI_GOVERNED'" holds ONLY because this function is the single
 * writer of both. A helper that raw-inserted just the governance row
 * would pass `resolveRoiGovernedVisibility` and then die one line later
 * in `createRoiCase` on `RoiCaseNoActiveVisibilityPolicyError` — a
 * missing-row failure that looks unrelated to the real cause. A helper
 * that hand-wrote the legacy row with any mode OTHER than 'ROI_GOVERNED'
 * (e.g. 'OPEN_ORG', to satisfy the existence check alone) would let
 * `createRoiCase` succeed but stamp the new case's
 * `rvn_platform_resource_visibility` row with the wrong mode — silently
 * reintroducing the OPEN_ORG gap AMD-FLOW-ROI-VISIBILITY-002 exists to
 * close, for every case the suite later reads. Green tests, broken
 * semantics. Calling the canonical function avoids both failure modes by
 * construction.
 *
 * The actor must already hold a same-tenant ACTIVE OWNER or ADMIN
 * membership (see `ensureRoiFixtureMembership` above) —
 * `publishRoiGovernedVisibilityPolicy` checks this itself and throws
 * `RoiVisibilityGovernanceActorNotAuthorizedError` otherwise; this helper
 * does not pre-check or relax that requirement.
 *
 * Deliberately NO try/catch here. `publishRoiGovernedVisibilityPolicy`
 * already returns `{ outcome: 'replayed' }` rather than throwing on an
 * EXACT idempotent repeat (same organizationId, actorUserId, policyKey,
 * policyDigest AND idempotencyKey) — a blanket catch would buy nothing on
 * that path and would additionally swallow a genuine
 * `RoiGovernedVisibilityPolicyCollisionError` (a different actor, or a
 * reused idempotencyKey with a different fingerprint) or
 * `RoiVisibilityGovernanceActorNotAuthorizedError`, both of which a
 * calling suite's `beforeAll` needs to see, not have silently absorbed.
 * Both 'applied' and 'replayed' are success — callers should treat both
 * as "the governed policy is now published for this organization", never
 * branch on which one occurred unless the test is specifically about
 * idempotency/replay itself.
 */
export async function ensureRoiGovernedVisibility(params: {
  organizationId: string;
  actorUserId: string;
  idempotencyKey: string;
}): Promise<PublishRoiGovernedVisibilityPolicyOutcome> {
  const { organizationId, actorUserId, idempotencyKey } = params;
  return publishRoiGovernedVisibilityPolicy({
    organizationId,
    actorUserId,
    policyKey: ROI_GOVERNED_VISIBILITY_POLICY.key,
    policyDigest: ROI_GOVERNED_VISIBILITY_POLICY.digest,
    idempotencyKey,
  });
}

// Re-exported so callers never need a second import just to pass the
// pinned key/digest to `ensureRoiGovernedVisibility` themselves.
export { ROI_GOVERNED_VISIBILITY_POLICY } from '../../../server/src/services/resultsVnext/platform/visibilityResolver.js';
