/**
 * RN-G1 Platform Foundation — ABAC/visibility resolver.
 *
 * Design: docs/product/results-vnext/RN_G1_PLATFORM_DESIGN.md §B.3/§B.4.
 * Schema: server/migrations/20260809_rvn_platform_visibility_core.sql,
 * server/migrations/20260809_rvn_platform_management_chain.sql.
 *
 * Status: NOT_IMPLEMENTED as a wired dependency — no controller/repository
 * calls this yet (see README.md). This file implements the §B.3 algorithm
 * literally so the shape is locked in; §B.4 (the `rvnVisibilityScopedQuery`
 * CTE wrapper domain repositories are supposed to INNER JOIN against) is
 * NOT built here — that is a separate, larger piece of work.
 *
 * DB access pattern copied from `decisionCollaborationService.ts`
 * (`acquirePgClient()` → pinned `PoolClient` → explicit
 * BEGIN/…/COMMIT-or-ROLLBACK/finally-release). This resolver only reads, so
 * no BEGIN/COMMIT is needed — a single `client.query()` per call would also
 * work, but the pinned-client shape is kept for consistency with the rest of
 * this module family and because a future maker-checker/audit step (§B.3.2)
 * may need to write a break-glass audit event on the same connection.
 */
import type { PoolClient } from 'pg';

import { acquirePgClient } from '../../../database/PostgresDatabase.js';
import { hasEffectiveCapability, resolveEffectiveAccess } from '../../effectiveAccessService.js';

import type { RvnResourceType } from './resourceTypes.js';

export type RvnVisibilityAction = 'view' | 'contribute' | 'approve';

export type RvnVisibilityDenyReason =
  | 'CROSS_TENANT'
  | 'NO_VISIBILITY_RECORD'
  | 'PRIVATE_NOT_OWNER'
  | 'OUT_OF_SCOPE'
  | 'NOT_IN_CHAIN'
  | 'NOT_ON_ACL'
  | 'RESTRICTED_REQUIRES_BREAK_GLASS';

export type RvnVisibilityAllowReason =
  | 'RBAC_OVERRIDE'
  | 'OPEN_ORG'
  | 'OWNER'
  | 'IN_SCOPE'
  | 'IN_MANAGEMENT_CHAIN'
  | 'ON_ACL';

export interface ResolveVisibilityInput {
  userId: string;
  organizationId: string;
  resourceType: RvnResourceType;
  resourceId: string;
  action: RvnVisibilityAction;
}

export interface ResolveVisibilityResult {
  allow: boolean;
  reason: RvnVisibilityAllowReason | RvnVisibilityDenyReason;
}

interface ResourceVisibilityRow {
  resource_type: string;
  resource_id: string;
  organization_id: string;
  visibility_mode: string;
  policy_id: string;
  scope_type: string | null;
  scope_id: string | null;
  owner_user_id: string | null;
  sensitivity: string | null;
}

const ACCESS_LEVEL_RANK: Record<string, number> = {
  view: 1,
  contribute: 2,
  approve: 3,
};

/**
 * Resolves whether `userId` may see (per `action`) a given resource.
 *
 * This answers ONLY visibility ("can you see it exists") — §B.3.4 is
 * explicit that capability to mutate/approve is a SEPARATE check
 * (effectiveAccessService + maker-checker submitted_by != approved_by) and
 * must never be folded into this result.
 */
export async function resolveVisibility(
  input: ResolveVisibilityInput
): Promise<ResolveVisibilityResult> {
  const { userId, organizationId, resourceType, resourceId, action } = input;

  const client: PoolClient = await acquirePgClient();
  try {
    // Step 1: load the resource's visibility record. The tenant gate (step 0
    // in the design) is folded into this SELECT's WHERE clause — it is the
    // first predicate, always — rather than a separate query, so a
    // cross-tenant resource_id can never even be inspected.
    const visResult = await client.query<ResourceVisibilityRow>(
      `SELECT resource_type, resource_id, organization_id, visibility_mode,
              policy_id, scope_type, scope_id, owner_user_id, sensitivity
         FROM rvn_platform_resource_visibility
        WHERE resource_type = $1 AND resource_id = $2 AND organization_id = $3`,
      [resourceType, resourceId, organizationId]
    );
    const record = visResult.rows[0];

    if (!record) {
      // Covers both "resource genuinely does not exist" and "resource
      // belongs to another org" (the org predicate above already filtered
      // those out) — fail-closed either way, never fail-open.
      return { allow: false, reason: 'NO_VISIBILITY_RECORD' };
    }

    // Step 2: RBAC/PBAC short-circuit — reuse effectiveAccessService, do not
    // reinvent role/capability resolution here.
    const access = await resolveEffectiveAccess({ userId, organizationId });
    const requiredCapability = `${resourceType}.${action}`;
    const hasRbacOverride =
      hasEffectiveCapability(access, '*') || hasEffectiveCapability(access, requiredCapability);

    if (hasRbacOverride) {
      if (record.sensitivity === 'restricted' && record.visibility_mode === 'RESTRICTED_ACL') {
        // Design §B.3 step 2: RBAC override on a restricted/RESTRICTED_ACL
        // resource requires a break-glass audit event, not a plain allow.
        // Emitting that event (and the audit trail it belongs to) is not
        // built yet — fail closed here rather than silently granting an
        // override this module cannot yet account for.
        return { allow: false, reason: 'RESTRICTED_REQUIRES_BREAK_GLASS' };
      }
      return { allow: true, reason: 'RBAC_OVERRIDE' };
    }

    // Step 3: branch on visibility_mode.
    switch (record.visibility_mode) {
      case 'OPEN_ORG':
        return { allow: true, reason: 'OPEN_ORG' };

      case 'PRIVATE':
        return record.owner_user_id === userId
          ? { allow: true, reason: 'OWNER' }
          : { allow: false, reason: 'PRIVATE_NOT_OWNER' };

      case 'SCOPE':
        return resolveScopeVisibility(client, { userId, record });

      case 'MANAGEMENT_CHAIN': {
        if (record.owner_user_id === userId) {
          return { allow: true, reason: 'OWNER' };
        }
        const chainResult = await client.query(
          `SELECT 1
             FROM rvn_platform_management_chain_closure
            WHERE organization_id = $1 AND ancestor_user_id = $2 AND descendant_user_id = $3
            LIMIT 1`,
          [organizationId, userId, record.owner_user_id]
        );
        return chainResult.rowCount
          ? { allow: true, reason: 'IN_MANAGEMENT_CHAIN' }
          : { allow: false, reason: 'NOT_IN_CHAIN' };
      }

      case 'RESTRICTED_ACL': {
        const requiredRank = ACCESS_LEVEL_RANK[action] ?? ACCESS_LEVEL_RANK.view;
        const aclResult = await client.query(
          `SELECT access_level
             FROM rvn_platform_resource_acl
            WHERE resource_type = $1 AND resource_id = $2
              AND (
                (grantee_type = 'user' AND grantee_id = $3)
                -- team/role grantee matching needs the caller's team/role
                -- memberships resolved the same way effectiveAccessService
                -- resolves them; NOT_IMPLEMENTED here, user-grant only.
              )`,
          [resourceType, resourceId, userId]
        );
        const granted = aclResult.rows.some(
          (row) => (ACCESS_LEVEL_RANK[row.access_level] ?? 0) >= requiredRank
        );
        return granted ? { allow: true, reason: 'ON_ACL' } : { allow: false, reason: 'NOT_ON_ACL' };
      }

      default:
        // Unknown visibility_mode value should not be reachable given the DB
        // CHECK constraint, but fail closed rather than throw.
        return { allow: false, reason: 'NO_VISIBILITY_RECORD' };
    }
  } finally {
    client.release();
  }
}

// ==========================================
// getActiveVisibilityPolicy (KPI-E001/E002 design §11 / decyzja #11)
// ==========================================

export interface ActiveVisibilityPolicy {
  policyId: string;
  /**
   * String form of `rvn_platform_visibility_policies.policy_version` (an
   * `INT` column) — converted here, not left numeric, because the primary
   * consumer of this value is `PlatformEventEnvelope.policyVersion`
   * (eventEnvelope.ts), which is `TEXT NOT NULL` on `rvn_platform_events`
   * (§A.1). Returning the string form lets a caller drop this straight into
   * `buildEvent()`'s `policyVersion` field without a separate cast.
   */
  policyVersion: string;
}

/**
 * Looks up the single active visibility policy for an
 * `(organizationId, domain)` pair (docs/product/results-vnext/
 * KPI_E001_E002_DESIGN.md §11, decyzja #11: "no active visibility policy for
 * domain lookup helper exists in platform — build now as part of this
 * package"). Reads `rvn_platform_visibility_policies` — the same table
 * `resolveVisibility()`'s `record.policy_id` above already points into, but
 * that table has never had a direct "give me the currently-active row for
 * this domain" query until now (every existing caller reaches a
 * `policy_id` indirectly, via a `rvn_platform_resource_visibility` row that
 * already carries one).
 *
 * "Active" means: `is_active = true` AND `effective_to IS NULL OR
 * effective_to > now()` — the same open-or-not-yet-expired condition the
 * table's own `EXCLUDE USING gist` constraint
 * (20260809_rvn_platform_visibility_core.sql) is built to keep to at most
 * one overlapping row per `(organization_id, domain)` at a time. `ORDER BY
 * policy_version DESC LIMIT 1` is defense in depth for the case where more
 * than one technically-active row exists (e.g. a data-repair window) — it
 * is not meant to paper over the constraint being violated.
 *
 * Returns `null` if no active policy exists for the domain — per decyzja
 * #11, the CALLER (e.g. `createKpiDraft`) must fail closed on `null`
 * (typed error), never assume a default visibility policy. This function
 * itself does not throw for "no policy" — that is a legitimate, expected
 * outcome (a domain that has not had its visibility policy provisioned
 * yet), not an error condition at the platform layer.
 */
export async function getActiveVisibilityPolicy(
  client: PoolClient,
  input: { organizationId: string; domain: string }
): Promise<ActiveVisibilityPolicy | null> {
  const { organizationId, domain } = input;

  const result = await client.query<{ policy_id: string; policy_version: number }>(
    `SELECT policy_id, policy_version
       FROM rvn_platform_visibility_policies
      WHERE organization_id = $1
        AND domain = $2
        AND is_active = true
        AND (effective_to IS NULL OR effective_to > now())
      ORDER BY policy_version DESC
      LIMIT 1`,
    [organizationId, domain]
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return { policyId: row.policy_id, policyVersion: String(row.policy_version) };
}

// ==========================================
// publishVisibilityPolicy (OKR-E001 design §5, Decision P5)
// ==========================================

/**
 * Write counterpart to `getActiveVisibilityPolicy` above — closes any
 * currently active row for `(organizationId, domain)` and opens a new one,
 * inside the CALLER's own transaction/pinned client (never opens its own).
 * First real product-facing writer of `rvn_platform_visibility_policies` —
 * KPI/ROI only ever had this table seeded by an out-of-band rollout script;
 * OKR-E001's `publishProgram` is the first command that authors a row here
 * itself (design §5, Decision P5).
 *
 * MUST run UPDATE-then-INSERT in that order on the SAME client, inside the
 * caller's own `applyMutation` — the table's `EXCLUDE USING gist
 * (organization_id WITH =, domain WITH =, tstzrange(effective_from,
 * effective_to) WITH &&)` constraint (20260809_rvn_platform_visibility_core.sql)
 * rejects an INSERT of a new open-ended row while the prior row's range
 * still overlaps; closing the prior row first (setting `effective_to =
 * now()`) narrows its range so the new row's range no longer overlaps.
 * Same "helper called from inside another command's own transaction" shape
 * as `openOrEscalateDeviationCase` being invoked from inside
 * `recordMeasurement` (kpiDeviationCommands.ts).
 */
export async function publishVisibilityPolicy(
  client: PoolClient,
  input: { organizationId: string; domain: string; mode: string; publishedBy: string }
): Promise<ActiveVisibilityPolicy> {
  const { organizationId, domain, mode, publishedBy } = input;

  await client.query(
    `UPDATE rvn_platform_visibility_policies
        SET effective_to = now()
      WHERE organization_id = $1 AND domain = $2
        AND is_active = true
        AND (effective_to IS NULL OR effective_to > now())`,
    [organizationId, domain]
  );

  const nextVersionResult = await client.query<{ next: number }>(
    `SELECT COALESCE(MAX(policy_version), 0) + 1 AS next
       FROM rvn_platform_visibility_policies
      WHERE organization_id = $1 AND domain = $2`,
    [organizationId, domain]
  );
  const nextVersion = nextVersionResult.rows[0].next;

  const insertResult = await client.query<{ policy_id: string; policy_version: number }>(
    `INSERT INTO rvn_platform_visibility_policies
       (organization_id, domain, policy_version, visibility_mode, allow_narrowing_only,
        default_scope_type, is_active, effective_from, created_by)
     VALUES ($1, $2, $3, $4, true, NULL, true, now(), $5)
     RETURNING policy_id, policy_version`,
    [organizationId, domain, nextVersion, mode, publishedBy]
  );
  const row = insertResult.rows[0];
  return { policyId: row.policy_id, policyVersion: String(row.policy_version) };
}

/**
 * -- DEVIATION FROM DESIGN: §B.3 names the existing membership tables for
 * SCOPE mode as "team_members/initiative_contributors". `team_members`
 * exists (server/migrations/000_z_core_baseline.sql / 000_initdb_core_tables.sql,
 * PK (team_id, user_id)); `initiative_contributors` does NOT exist anywhere
 * in server/migrations/ or server/migrations-v2/ (verified via
 * `grep -rln "_contributors\b" server/migrations/*.sql server/migrations-v2/*.sql`
 * — zero matches). Rather than invent a new table (out of scope for this
 * bounded package and not requested), this only wires up `scope_type='team'`
 * against `team_members`. Any other `scope_type` (e.g. an eventual
 * 'initiative' scope) fails closed with OUT_OF_SCOPE until the correct
 * membership source is confirmed — see EXECUTION_LEDGER.md.
 */
async function resolveScopeVisibility(
  client: PoolClient,
  input: { userId: string; record: ResourceVisibilityRow }
): Promise<ResolveVisibilityResult> {
  const { userId, record } = input;

  if (!record.scope_type || !record.scope_id) {
    return { allow: false, reason: 'OUT_OF_SCOPE' };
  }

  if (record.scope_type === 'team') {
    const membership = await client.query(
      `SELECT 1 FROM team_members WHERE team_id = $1 AND user_id = $2 LIMIT 1`,
      [record.scope_id, userId]
    );
    return membership.rowCount
      ? { allow: true, reason: 'IN_SCOPE' }
      : { allow: false, reason: 'OUT_OF_SCOPE' };
  }

  return { allow: false, reason: 'OUT_OF_SCOPE' };
}

// ==========================================
// AMD-FLOW-ROI-VISIBILITY-002 — governed ROI visibility policy
// ==========================================
//
// Owner decision (docs/cleanup/agents/OWNER_DECISIONS_AND_MEASURABLE_GATES_20260816.md
// row 42): ROI visibility is restricted to same-tenant OWNER, ADMIN and
// users holding the canonical Finance authority/grant; OPEN_ORG is not an
// approved production policy.
//
// Deliberately NOT built as a sixth `visibility_mode` value on
// `rvn_platform_visibility_policies` / a branch inside `resolveVisibility()`
// above or `visibilityScopedQuery.ts`'s CTE — see
// server/migrations/20261020_roi_governed_visibility_policy.sql's header
// comment for the full impossibility proof (closed 5-literal CHECK enum on
// a table shared by KPI/OKR/ROI, not append-only today, and OKR's live
// `publishProgram` (okrProgramCommands.ts:574) actively UPDATEs it — none
// of that can be touched or repurposed for this packet). Everything below
// is a sibling system: its own table, its own predicate, its own command.
//
// "The canonical Finance authority/grant" is read literally as the ONE
// thing in this codebase that already answers to that description —
// `rvn_finance_reconciliation_grant_events` / capability
// 'results.roi.finance_reconciliation.resolve' (ROI-E007,
// roiFinanceReconciliationCommands.ts, migration 20260928) — reused here
// UNMODIFIED (no ALTER, no new capability literal, no second ledger).

/** Pinned literal, mirrored by the CHECK constraints on
 * `rvn_roi_visibility_governance.policy_key`/`policy_digest`
 * (20261020_roi_governed_visibility_policy.sql). A caller of
 * `publishRoiGovernedVisibilityPolicy` must pass these exact values —
 * anything else (wrong, partial, or a broadened/"superset" policy) is
 * rejected BEFORE any client is acquired or any mutation attempted. */
export const ROI_GOVERNED_VISIBILITY_POLICY = {
  key: 'AMD-FLOW-ROI-VISIBILITY-002/v1',
  digest: 'sha256:2c49cd371727bd19b7164b950e523c2caa9068874c88a451700d05f0ced67c65',
} as const;

/** The existing, unmodified ROI-E007 Finance-reconciliation capability,
 * reused as "the canonical Finance authority/grant" per the owner decision's
 * own wording (definite article — not a new capability). */
export const ROI_FINANCE_AUTHORITY_CAPABILITY = 'results.roi.finance_reconciliation.resolve';

export class RoiGovernedVisibilityPolicyMismatchError extends Error {
  code = 'ROI_GOVERNED_VISIBILITY_POLICY_MISMATCH';
  constructor() {
    super(
      'The ROI governed visibility policy key/digest does not match the canonical pinned policy — refusing before any mutation.'
    );
    this.name = 'RoiGovernedVisibilityPolicyMismatchError';
  }
}

export class RoiVisibilityGovernanceActorNotAuthorizedError extends Error {
  code = 'ROI_VISIBILITY_GOVERNANCE_ACTOR_NOT_AUTHORIZED';
  constructor() {
    super('Publishing the ROI governed visibility policy requires a same-tenant ACTIVE OWNER or ADMIN.');
    this.name = 'RoiVisibilityGovernanceActorNotAuthorizedError';
  }
}

export class RoiGovernedVisibilityPolicyCollisionError extends Error {
  code = 'ROI_GOVERNED_VISIBILITY_POLICY_COLLISION';
  constructor(organizationId: string) {
    super(
      `ROI governed visibility policy for organization ${organizationId} was already published by a different actor.`
    );
    this.name = 'RoiGovernedVisibilityPolicyCollisionError';
  }
}

/**
 * AUTHORITATIVE, ROI-visibility-local same-tenant ACTIVE membership role
 * lookup. Deliberately duplicated (not imported) from
 * `effectiveAccessService.ts`'s private `readApplicationRole` — this file
 * must never import from or touch `effectiveAccessService.ts` (owner
 * decision 15A stays exactly as pinned there; this is a narrower, SEPARATE
 * gate that does not consult it). Same fail-closed shape: a missing row, a
 * non-ACTIVE row, or a lookup error all return `null` — never a claimed
 * role from anywhere else (no token/application-role fallback exists here
 * to begin with).
 */
async function readSameTenantActiveMembershipRole(
  client: PoolClient,
  organizationId: string,
  userId: string
): Promise<'OWNER' | 'ADMIN' | 'MEMBER' | null> {
  try {
    const result = await client.query<{ role: string | null; status: string | null }>(
      `SELECT UPPER(role) AS role, UPPER(status) AS status
         FROM organization_members
        WHERE organization_id = $1 AND user_id = $2
        LIMIT 1`,
      [organizationId, userId]
    );
    const row = result.rows[0];
    if (!row || row.status !== 'ACTIVE') return null;
    if (row.role === 'OWNER' || row.role === 'ADMIN' || row.role === 'MEMBER') return row.role;
    return null;
  } catch {
    // Membership-lookup failure fails closed — an unreadable membership
    // table must never become an open door, and (for the publish command)
    // must never be treated as authorization to write.
    return null;
  }
}

/**
 * Live lookup against the EXISTING, UNMODIFIED
 * `rvn_finance_reconciliation_grant_events` ledger (ROI-E007) — no caching,
 * so a revocation denies on the very next call. Structurally identical to
 * `roiFinanceReconciliationCommands.ts`'s private
 * `hasActiveExplicitFinanceOwnerGrant` (same table, same capability
 * literal), reimplemented here rather than imported because that file is
 * out of this packet's bounded path list — not because the logic differs.
 */
export async function hasActiveRoiFinanceAuthorityGrant(
  client: PoolClient,
  organizationId: string,
  userId: string
): Promise<boolean> {
  const result = await client.query<{ action: string }>(
    `SELECT action FROM rvn_finance_reconciliation_grant_events
      WHERE organization_id = $1 AND user_id = $2 AND capability = $3
      ORDER BY grant_version DESC LIMIT 1`,
    [organizationId, userId, ROI_FINANCE_AUTHORITY_CAPABILITY]
  );
  return result.rows[0]?.action === 'granted';
}

export type RoiGovernedVisibilityDenyReason = 'NO_GOVERNED_POLICY' | 'NOT_ACTIVE_MEMBER' | 'ORDINARY_MEMBER_DENIED';
export type RoiGovernedVisibilityAllowReason = 'OWNER' | 'ADMIN' | 'FINANCE_AUTHORITY_GRANT';

export interface ResolveRoiGovernedVisibilityResult {
  allow: boolean;
  reason: RoiGovernedVisibilityAllowReason | RoiGovernedVisibilityDenyReason;
}

/**
 * Sibling of `resolveVisibility()` above — NOT a branch of it, NOT wired
 * through the generic OPEN_ORG/PRIVATE/SCOPE/MANAGEMENT_CHAIN/RESTRICTED_ACL
 * modal system. Deliberately does NOT call `resolveEffectiveAccess` /
 * `hasEffectiveCapability(access, '*')` and does NOT import anything from
 * `effectiveAccessService.ts`.
 *
 * Two truths that are BOTH correct at once, on purpose: owner decision 15A
 * (a SUPERADMIN token resolves to org OWNER with '*' in ANY organization,
 * WITHOUT a membership row) stays exactly as pinned everywhere else in the
 * app — untouched by this file. But THIS gate is narrower and does not
 * consult that wildcard: a SUPERADMIN token with no row in
 * `organization_members` for this organization is DENIED here, at the ROI
 * visibility gate specifically, while remaining globally OWNER/'*'
 * everywhere `hasEffectiveCapability`/`resolveEffectiveAccess` ARE
 * consulted. Neither statement is a regression of the other.
 *
 * Fails closed with `NO_GOVERNED_POLICY` when the organization has never
 * published the governed policy — this never falls back to OPEN_ORG or any
 * other default (per the owner decision: OPEN_ORG is not an approved
 * production policy, and no default may be fabricated).
 */
export async function resolveRoiGovernedVisibility(input: {
  userId: string;
  organizationId: string;
}): Promise<ResolveRoiGovernedVisibilityResult> {
  const { userId, organizationId } = input;

  const client: PoolClient = await acquirePgClient();
  try {
    const policyResult = await client.query<{ organization_id: string }>(
      `SELECT organization_id FROM rvn_roi_visibility_governance WHERE organization_id = $1`,
      [organizationId]
    );
    if (!policyResult.rows[0]) {
      return { allow: false, reason: 'NO_GOVERNED_POLICY' };
    }

    const role = await readSameTenantActiveMembershipRole(client, organizationId, userId);
    if (!role) {
      // Covers: no membership row at all (including a foreign-tenant
      // caller — this organization_id simply has no row for that userId),
      // a non-ACTIVE (revoked) row, a SUPERADMIN token with no row here,
      // and a membership-lookup failure — all collapse to the same
      // fail-closed outcome by construction of
      // `readSameTenantActiveMembershipRole`.
      return { allow: false, reason: 'NOT_ACTIVE_MEMBER' };
    }
    if (role === 'OWNER') return { allow: true, reason: 'OWNER' };
    if (role === 'ADMIN') return { allow: true, reason: 'ADMIN' };

    const hasFinanceGrant = await hasActiveRoiFinanceAuthorityGrant(client, organizationId, userId);
    return hasFinanceGrant
      ? { allow: true, reason: 'FINANCE_AUTHORITY_GRANT' }
      : { allow: false, reason: 'ORDINARY_MEMBER_DENIED' };
  } finally {
    client.release();
  }
}

export interface PublishRoiGovernedVisibilityPolicyInput {
  organizationId: string;
  actorUserId: string;
  /** Must equal `ROI_GOVERNED_VISIBILITY_POLICY.key` — see that constant's
   * doc comment. Required (not defaulted) so a caller passing the wrong,
   * a partial, or a broadened/"superset" policy identifier is rejected
   * before any mutation, rather than the function silently substituting
   * the canonical value on the caller's behalf. */
  policyKey: string;
  /** Must equal `ROI_GOVERNED_VISIBILITY_POLICY.digest`. */
  policyDigest: string;
  idempotencyKey: string;
}

export interface RoiGovernedVisibilityPolicyPublication {
  organizationId: string;
  publishedBy: string;
  publishedAt: string;
  policyKey: string;
}

export interface PublishRoiGovernedVisibilityPolicyOutcome {
  /** 'applied' = this call performed the INSERT. 'replayed' = the SAME
   * actor had already published for this organization; zero additional
   * writes, the existing durable row is returned unchanged. */
  outcome: 'applied' | 'replayed';
  publication: RoiGovernedVisibilityPolicyPublication;
}

/**
 * Governance command — the real production replacement for
 * `tests/integration/crossflow/flowFixture.ts`'s
 * `provisionSyntheticRoiVisibilityPolicy` (SYNTHETIC_TEST_ONLY OPEN_ORG).
 *
 * Org and actor MUST be derived by the caller from the verified JWT only
 * (see `roi.routes.ts`'s route handler — `organizationId`/`actorUserId`
 * come from `req.user`, never from the request body). ACTIVE same-tenant
 * OWNER or ADMIN is required, checked directly against
 * `organization_members` — deliberately NOT via
 * `hasEffectiveCapability(access, '*')` (see `resolveRoiGovernedVisibility`'s
 * doc comment for why 15A's wildcard is not consulted here).
 *
 * Concurrency/idempotency/collision shape (8-way concurrency -> exactly one
 * winner; collision -> 409 at the route layer): `rvn_roi_visibility_governance`
 * has exactly one row per organization (PRIMARY KEY organization_id) and
 * nothing to version between (one canonical policy, nothing to widen or
 * narrow) — so this intentionally does NOT go through the generic
 * `executeAtomicCreate`/`rvn_platform_events` machinery (which would also
 * require a new `RvnResourceType` literal in `resourceTypes.ts`, a file
 * outside this packet's bounded path list). Instead: a `pg_advisory_xact_lock`
 * on `organizationId` serializes every racing caller through the SAME
 * check-then-insert section, and the row's own `published_by` IS the
 * idempotent-receipt identity: the SAME actor calling again after the row
 * exists gets `outcome: 'replayed'` (zero additional writes, the original
 * row returned unchanged); a DIFFERENT actor calling after the row exists
 * gets `RoiGovernedVisibilityPolicyCollisionError` (mapped to 409 by the
 * route, same pattern every other typed guard error in `roi.routes.ts`
 * already uses) — thrown before any write in that branch, so a collision
 * never mutates anything.
 */
export async function publishRoiGovernedVisibilityPolicy(
  input: PublishRoiGovernedVisibilityPolicyInput
): Promise<PublishRoiGovernedVisibilityPolicyOutcome> {
  const { organizationId, actorUserId, policyKey, policyDigest, idempotencyKey } = input;

  // FAIL BEFORE MUTATION: a wrong, partial, or broadened/"superset" policy
  // is rejected here — before a client is even acquired, let alone a
  // transaction opened.
  if (policyKey !== ROI_GOVERNED_VISIBILITY_POLICY.key || policyDigest !== ROI_GOVERNED_VISIBILITY_POLICY.digest) {
    throw new RoiGovernedVisibilityPolicyMismatchError();
  }
  if (!idempotencyKey || !idempotencyKey.trim()) {
    throw new Error('[publishRoiGovernedVisibilityPolicy] idempotencyKey is required');
  }

  const client: PoolClient = await acquirePgClient();
  try {
    await client.query('BEGIN');

    const role = await readSameTenantActiveMembershipRole(client, organizationId, actorUserId);
    if (role !== 'OWNER' && role !== 'ADMIN') {
      throw new RoiVisibilityGovernanceActorNotAuthorizedError();
    }

    // Advisory-lock ordering: every racing caller for this organizationId
    // serializes here before either reading or writing the row below —
    // this is what makes "8-way concurrency yields exactly one winner"
    // true rather than a race on the bare SELECT-then-INSERT.
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [organizationId]);

    const existing = await client.query<{
      published_by: string;
      published_at: string;
      policy_key: string;
    }>(
      `SELECT published_by, published_at, policy_key
         FROM rvn_roi_visibility_governance
        WHERE organization_id = $1`,
      [organizationId]
    );
    if (existing.rowCount) {
      const row = existing.rows[0]!;
      if (row.published_by !== actorUserId) {
        throw new RoiGovernedVisibilityPolicyCollisionError(organizationId);
      }
      await client.query('COMMIT');
      return {
        outcome: 'replayed',
        publication: {
          organizationId,
          publishedBy: row.published_by,
          publishedAt: row.published_at,
          policyKey: row.policy_key,
        },
      };
    }

    const insertResult = await client.query<{
      organization_id: string;
      published_by: string;
      published_at: string;
      policy_key: string;
    }>(
      `INSERT INTO rvn_roi_visibility_governance (organization_id, published_by)
       VALUES ($1, $2)
       RETURNING organization_id, published_by, published_at, policy_key`,
      [organizationId, actorUserId]
    );
    const inserted = insertResult.rows[0];
    if (!inserted) {
      throw new Error('[publishRoiGovernedVisibilityPolicy] insert returned no row');
    }
    await client.query('COMMIT');
    return {
      outcome: 'applied',
      publication: {
        organizationId: inserted.organization_id,
        publishedBy: inserted.published_by,
        publishedAt: inserted.published_at,
        policyKey: inserted.policy_key,
      },
    };
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}
