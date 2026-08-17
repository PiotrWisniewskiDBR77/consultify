/**
 * Case Workspace routes — thin re-export/wrapper over
 * caseWorkspaceAuthContext.ts (read-only reference; see this directory's
 * FORBIDDEN list — that file itself is never edited here).
 *
 * caseWorkspaceAuthContext.ts's own header comment literally calls itself
 * "the future route layer" every one of the 11 domain services' own
 * open_questions points at and says does not exist yet. This route layer IS
 * that future route layer arriving — every mutating/by-id case-workspace
 * route in this directory calls `requireCaseAccessForActor` (or
 * `requireOrgRoleForActor`/`requireOrgMemberForActor` for the platform-global
 * services that have no per-case scope: capabilityRegistryService,
 * migrationReadinessService's flag-definition surface) BEFORE calling into
 * the pre-retrofit service function, so tenant/membership enforcement is
 * real today, not merely a documented gap. Once Stream A's retrofit lands
 * (each service function itself taking an explicit actorUserId and doing
 * this check internally), these route-layer calls become redundant
 * defense-in-depth rather than the only check — see each route file's
 * top-of-file "re-wire after A merges" comment.
 */

import {
  CaseWorkspaceAuthError,
  requireCaseAccess,
  requireOrgMember,
  requireOrgRole,
  type OrgMembership,
  type OrgRole,
} from '../../../services/caseWorkspace/caseWorkspaceAuthContext.js';
import type { CaseWorkspaceActor } from './handler.js';
import { executeGovernedExecutionAction } from '../../../services/executionActionRegistryService.js';

export { CaseWorkspaceAuthError };
export type { OrgMembership, OrgRole };

/** Fail-closed: actor must be an ACTIVE member of the caseId's own organization. */
export function requireCaseAccessForActor(actor: CaseWorkspaceActor, caseId: string): Promise<OrgMembership> {
  return requireCaseAccess(actor.actorUserId, caseId);
}

/** Fail-closed: actor must be an ACTIVE member of their own authenticated organization. */
export function requireOrgMemberForActor(actor: CaseWorkspaceActor): Promise<OrgMembership> {
  return requireOrgMember(actor.actorUserId, actor.organizationId);
}

/** Fail-closed: actor must hold at least `minimumRole` in their own authenticated organization. */
export function requireOrgRoleForActor(actor: CaseWorkspaceActor, minimumRole: OrgRole): Promise<OrgMembership> {
  return requireOrgRole(actor.actorUserId, actor.organizationId, minimumRole);
}

export async function executeGovernedCaseAction<T>(input: {
  actor: CaseWorkspaceActor;
  actionId: string;
  targetId: string;
  operation: () => Promise<T>;
}): Promise<T> {
  const membership = await requireOrgRole(input.actor.actorUserId, input.actor.organizationId, 'MEMBER');
  return executeGovernedExecutionAction({
    organizationId: input.actor.organizationId,
    actionId: input.actionId,
    targetId: input.targetId,
    actorId: input.actor.actorUserId,
    membershipRole: membership.role === 'CONSULTANT' ? 'MEMBER' : membership.role,
    requestId: input.actor.correlationId,
    operation: input.operation,
  });
}
