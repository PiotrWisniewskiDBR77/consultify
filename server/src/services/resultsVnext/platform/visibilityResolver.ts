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
