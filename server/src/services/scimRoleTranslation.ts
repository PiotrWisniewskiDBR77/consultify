/**
 * SCIM Role Translation (HP-25 B1 — Governance-sync)
 *
 * Pure, DB-free translation layer between the flat `internal_role` string
 * stored on `scim_group_mappings` (see server/src/routes/integrations/scim.routes.ts
 * and server/src/routes/adminP32.routes.ts) and the canonical project-role
 * model in projectRoleCanon.ts.
 *
 * Scope note (HP-25 B1, per Harvard/wdrozenie-100/_KONCEPT_HP25_GOVERNANCE_SYNC.md):
 * this module does NOT read or write scim_group_mappings, does NOT grant any
 * project membership, and does NOT change the write surface of the SCIM
 * routes. It exists so that B2 (per-project group mapping) and B3
 * (RACI-as-roles import) have a single, tested place to resolve "what
 * canonical role/permissions does this raw string represent" instead of
 * re-deriving it ad hoc.
 *
 * Fail-closed contract (RBAC doctrine, fala 8): any input that is not on the
 * explicit allow-list below resolves to `null` / a rejection result. There is
 * NO silent default grant. Callers that receive a rejection MUST deny the
 * action (or fall back to a role the caller already explicitly holds), never
 * substitute an elevated or "reasonable-sounding" role.
 */
import {
  canonicalToProjectMemberRole,
  CanonicalProjectRole,
  type CanonicalProjectRoleType,
  mapToCanonicalProjectRole,
} from './projectRoleCanon.js';
import { DEFAULT_PERMISSIONS, PROJECT_ROLES } from './projectMemberService.js';

/**
 * Known `internal_role` values used today by the SCIM group-mapping UI
 * (src/views/superadmin/SCIMProvisioningView.tsx — dropdown options
 * 'viewer' | 'member' | 'project_manager' | 'admin') plus the raw
 * `scim_group_mappings.internal_role` DB default ('member').
 *
 * These are application-level roles, not project roles — mapping them to a
 * canonical PROJECT role is an explicit, reviewable policy decision (not a
 * mechanical rename), documented here so it can be revisited by Piotr before
 * B2 wires it into an actual grant path.
 */
const SCIM_APPLICATION_ROLE_TO_CANONICAL: Record<string, CanonicalProjectRoleType> = {
  ADMIN: CanonicalProjectRole.PROJECT_LEADER,
  ADMINISTRATOR: CanonicalProjectRole.PROJECT_LEADER,
  PROJECT_MANAGER: CanonicalProjectRole.PROJECT_LEADER,
  MEMBER: CanonicalProjectRole.TASK_ASSIGNEE,
  VIEWER: CanonicalProjectRole.OBSERVER,
};

function normalizeInternalRole(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

/**
 * Translate a raw `internal_role` string into a CanonicalProjectRoleType.
 *
 * Resolution order:
 * 1. Known SCIM application-role vocabulary (admin/member/viewer/project_manager).
 * 2. Fallback to the general legacy/canon alias table (mapToCanonicalProjectRole)
 *    — covers callers who already store a canonical or PMO-style role string
 *    directly in internal_role (forward-compatible with B2's per-project
 *    role dropdown).
 * 3. Anything else (unknown string, empty, null, undefined, garbage/injection
 *    attempts) -> null. This is the fail-closed default: NO implicit grant.
 */
export function mapScimInternalRoleToCanonicalProjectRole(
  internalRole: unknown
): CanonicalProjectRoleType | null {
  const normalized = normalizeInternalRole(internalRole);
  if (!normalized) return null;

  if (SCIM_APPLICATION_ROLE_TO_CANONICAL[normalized]) {
    return SCIM_APPLICATION_ROLE_TO_CANONICAL[normalized];
  }

  return mapToCanonicalProjectRole(normalized);
}

export type ScimRoleResolution =
  | {
      rejected: false;
      internalRole: string;
      canonicalRole: CanonicalProjectRoleType;
      projectMemberRoleKey: string;
      permissions: Record<string, unknown>;
    }
  | {
      rejected: true;
      internalRole: string;
      reason: string;
    };

/**
 * Full pipeline: raw internal_role -> canonical role -> projectMemberService
 * role key -> default permission set. Returns a discriminated result object
 * (never throws) so callers are forced to branch on `rejected` explicitly
 * rather than accidentally using a `null`/`undefined` permissions object as
 * "no restrictions".
 *
 * This function does not touch the database and does not persist or grant
 * anything — it is a pure resolver for B2/B3 to call once they wire an
 * actual grant path.
 */
export function resolveScimRoleGrant(internalRole: unknown): ScimRoleResolution {
  const normalized = normalizeInternalRole(internalRole);

  if (!normalized) {
    return { rejected: true, internalRole: normalized, reason: 'empty_internal_role' };
  }

  const canonicalRole = mapScimInternalRoleToCanonicalProjectRole(normalized);
  if (!canonicalRole) {
    return { rejected: true, internalRole: normalized, reason: 'unmapped_internal_role' };
  }

  const projectMemberRoleKey = canonicalToProjectMemberRole(canonicalRole);
  if (!projectMemberRoleKey || !(projectMemberRoleKey in PROJECT_ROLES)) {
    // Should be unreachable given CANONICAL_TO_PROJECT_MEMBER_ROLE is total
    // over CanonicalProjectRoleType — kept as an explicit guard so a future
    // 13th canon role without a reverse-map entry fails closed instead of
    // silently granting `undefined` permissions.
    return { rejected: true, internalRole: normalized, reason: 'no_project_member_role_mapping' };
  }

  const permissions = DEFAULT_PERMISSIONS[projectMemberRoleKey];
  if (!permissions) {
    return { rejected: true, internalRole: normalized, reason: 'no_default_permissions' };
  }

  return {
    rejected: false,
    internalRole: normalized,
    canonicalRole,
    projectMemberRoleKey,
    permissions,
  };
}
