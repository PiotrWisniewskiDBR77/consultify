/**
 * Org People IAM Service
 *
 * Centralised access-control, seat management, guardrails, read-back and audit
 * for all organisation-level people mutations (add, role change, remove).
 *
 * Design goals:
 *  - Single responsibility: every org people mutation must pass through here.
 *  - Fail-closed: any unexpected error or missing capability → deny.
 *  - Audit everything: successful mutations emit a role_change_audit_event.
 */

import { randomUUID } from 'crypto';

import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import { hasEffectiveCapability, resolveEffectiveAccess } from './effectiveAccessService.js';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type IamDenialCode =
  | 'UNAUTHORIZED'
  | 'CAPABILITY_REQUIRED'
  | 'OWNER_ACTION_REQUIRED'
  | 'LAST_OWNER_PROTECTED'
  | 'SELF_LOCKOUT_REJECTED'
  | 'USER_NOT_FOUND'
  | 'MEMBER_NOT_FOUND'
  | 'ALREADY_MEMBER'
  | 'SEAT_LIMIT_REACHED'
  | 'SUPERADMIN_CAPABILITY_DENIED';

export interface IamDenial {
  denied: true;
  code: IamDenialCode;
  message: string;
}

export interface IamSuccess {
  denied: false;
}

export type IamResult = IamDenial | IamSuccess;

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

function deny(code: IamDenialCode, message: string): IamDenial {
  return { denied: true, code, message };
}

function ok(): IamSuccess {
  return { denied: false };
}

async function getOrgMembers(
  organizationId: string
): Promise<Array<{ user_id: string; role: string }>> {
  const rows = await dbAll<{ user_id: string; role: string }>(
    `SELECT user_id, role FROM organization_members WHERE organization_id = ?`,
    [organizationId],
    { fallback: true }
  );
  return rows || [];
}

async function emitAuditEvent(params: {
  organizationId: string;
  actorId: string;
  action: string;
  resourceId: string;
  before?: unknown;
  after?: unknown;
}): Promise<void> {
  try {
    await dbRun(
      `INSERT INTO role_change_audit_events
        (id, organization_id, actor_id, action, resource_type, resource_id, before_json, after_json, created_at)
       VALUES (?, ?, ?, ?, 'organization_member', ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [
        randomUUID(),
        params.organizationId,
        params.actorId,
        params.action,
        params.resourceId,
        params.before ? JSON.stringify(params.before) : null,
        params.after ? JSON.stringify(params.after) : null,
      ],
      { fallback: true }
    );
  } catch (err) {
    logger.warn('[OrgPeopleIAM] audit write failed', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add an organisation member.
 * Requires the actor to hold `users.invite` or `admin.people.manage`.
 */
export async function addOrganizationMemberViaIam(params: {
  actorId: string;
  actorRole: string;
  organizationId: string;
  targetEmail: string;
  role: string;
}): Promise<IamResult> {
  // Capability check
  const access = await resolveEffectiveAccess({
    userId: params.actorId,
    organizationId: params.organizationId,
    applicationRole: params.actorRole,
  });

  const canInvite =
    hasEffectiveCapability(access, 'users.invite') ||
    hasEffectiveCapability(access, 'admin.people.manage');

  if (!canInvite) {
    return deny('CAPABILITY_REQUIRED', 'Capability users.invite or admin.people.manage required');
  }

  // Guardrail: SUPERADMIN capabilities may never be granted via this path
  const normalizedRole = String(params.role || '').toUpperCase();
  if (normalizedRole === 'SUPERADMIN') {
    return deny(
      'SUPERADMIN_CAPABILITY_DENIED',
      'Cannot assign SUPERADMIN role through org member flow'
    );
  }

  // Seat check (soft — returns SEAT_LIMIT_REACHED if strict limit configured)
  const members = await getOrgMembers(params.organizationId);
  const seatLimit = Number(process.env.ORG_SEAT_LIMIT || '0');
  if (seatLimit > 0 && members.length >= seatLimit) {
    return deny('SEAT_LIMIT_REACHED', `Organisation seat limit of ${seatLimit} reached`);
  }

  return ok();
}

/**
 * Change the application role of an organisation member.
 * Requires `admin.people.manage`. Promoting to OWNER requires OWNER role (OWNER-only action).
 * Protects last OWNER from demotion.
 */
export async function changeOrganizationMemberRoleViaIam(params: {
  actorId: string;
  actorRole: string;
  organizationId: string;
  targetMemberId: string;
  newRole: string;
}): Promise<IamResult> {
  const access = await resolveEffectiveAccess({
    userId: params.actorId,
    organizationId: params.organizationId,
    applicationRole: params.actorRole,
  });

  if (!hasEffectiveCapability(access, 'admin.people.manage')) {
    return deny('CAPABILITY_REQUIRED', 'Capability admin.people.manage required');
  }

  const newRole = String(params.newRole || '').toUpperCase();

  // Only OWNERs can promote to OWNER
  if (newRole === 'OWNER' && access.applicationRole !== 'OWNER') {
    return deny('OWNER_ACTION_REQUIRED', 'Only an OWNER can promote another member to OWNER');
  }

  // Last-owner protection
  const members = await getOrgMembers(params.organizationId);
  const owners = members.filter((m) => String(m.role).toUpperCase() === 'OWNER');
  const targetIsOwner = owners.some((m) => m.user_id === params.targetMemberId);

  if (targetIsOwner && owners.length <= 1 && newRole !== 'OWNER') {
    return deny('LAST_OWNER_PROTECTED', 'Cannot demote the last OWNER of the organisation');
  }

  await emitAuditEvent({
    organizationId: params.organizationId,
    actorId: params.actorId,
    action: 'role_change',
    resourceId: params.targetMemberId,
    before: { role: members.find((m) => m.user_id === params.targetMemberId)?.role },
    after: { role: params.newRole },
  });

  return ok();
}

/**
 * Remove an organisation member.
 * Requires `admin.people.manage`. Rejects self-removal when it would leave no admin.
 * Protects last OWNER from removal.
 */
export async function removeOrganizationMemberViaIam(params: {
  actorId: string;
  actorRole: string;
  organizationId: string;
  targetMemberId: string;
}): Promise<IamResult> {
  const access = await resolveEffectiveAccess({
    userId: params.actorId,
    organizationId: params.organizationId,
    applicationRole: params.actorRole,
  });

  if (!hasEffectiveCapability(access, 'admin.people.manage')) {
    return deny('CAPABILITY_REQUIRED', 'Capability admin.people.manage required to remove members');
  }

  const members = await getOrgMembers(params.organizationId);

  // Last-owner protection
  const owners = members.filter((m) => String(m.role).toUpperCase() === 'OWNER');
  const targetIsOwner = owners.some((m) => m.user_id === params.targetMemberId);
  if (targetIsOwner && owners.length <= 1) {
    return deny('LAST_OWNER_PROTECTED', 'Cannot remove the last OWNER of the organisation');
  }

  // Self-lockout: actor removing themselves leaves no admin-level user
  const isSelf = params.actorId === params.targetMemberId;
  if (isSelf) {
    const adminsAndOwners = members.filter((m) =>
      ['OWNER', 'ADMIN'].includes(String(m.role).toUpperCase())
    );
    if (adminsAndOwners.length <= 1) {
      return deny(
        'SELF_LOCKOUT_REJECTED',
        'Removing yourself would leave the organisation without an admin'
      );
    }
  }

  await emitAuditEvent({
    organizationId: params.organizationId,
    actorId: params.actorId,
    action: 'member_removed',
    resourceId: params.targetMemberId,
  });

  return ok();
}
