import * as queryHelpers from '../../utils/queryHelpers.js';
import { type CanonicalProjectRoleType, mapToCanonicalProjectRole } from '../projectRoleCanon.js';

export interface SteeringBoardContext {
  enabled: boolean;
  memberType: 'CHAIR' | 'BOARD_MEMBER' | 'OBSERVER' | null;
}

export interface ProjectMembershipContext {
  projectId: string;
  rawProjectRole: string | null;
  canonicalProjectRole: CanonicalProjectRoleType | null;
  isInvoked: boolean;
  consultantProfile: string;
  engagementType: string;
}

export interface InitiativeAccessContext {
  initiativeId: string;
  organizationId: string;
  projectId: string | null;
  systemRole: string;
  membership: ProjectMembershipContext | null;
  steeringBoard: SteeringBoardContext;
  /** Effective roles used by initiative gate workflow + capabilities */
  effectiveRoles: string[];
  /** Role→user assignments that can satisfy gate permissions */
  roleAssignments: Array<{ gateRole: string; userId: string }>;
}

const unique = <T>(arr: T[]): T[] => Array.from(new Set(arr));

function normalizeUpper(value: unknown): string {
  return String(value || '')
    .trim()
    .toUpperCase();
}

function normalizeSystemRoleHint(value: unknown): string {
  const normalized = normalizeUpper(value);
  switch (normalized) {
    case 'OWNER':
    case 'SUPER_ADMIN':
    case 'SUPERADMIN':
      return 'SUPERADMIN';
    case 'ADMINISTRATOR':
    case 'ADMIN':
      return 'ADMIN';
    default:
      return normalized;
  }
}

function mapCanonicalProjectRoleToInitiativeRoles(
  canonicalRole: CanonicalProjectRoleType
): string[] {
  switch (canonicalRole) {
    case 'PROJECT_SPONSOR':
      return ['PROJECT_SPONSOR'];
    case 'PROJECT_LEADER':
      // keep legacy role identifiers for gates (SEND_BACK / APPROVE_TO_INITIATIVE)
      return ['PROJECT_MANAGER', 'PROJECT_LEAD'];
    case 'INITIATIVE_OWNER':
      return ['INITIATIVE_OWNER'];
    case 'TASK_ASSIGNEE':
      return ['TEAM_MEMBER'];
    case 'PMO':
      return ['PMO'];
    case 'BUSINESS_OWNER':
      return ['BUSINESS_OWNER'];
    case 'STEERING_COMMITTEE':
      return ['STEERING_COMMITTEE'];
    default:
      return [];
  }
}

async function readSteeringBoardContext(
  projectId: string,
  userId: string
): Promise<SteeringBoardContext> {
  try {
    const board = await queryHelpers.queryOne(
      `SELECT enabled FROM project_steering_board WHERE project_id = ?`,
      [projectId]
    );
    const enabled = !!(board as any)?.enabled;
    if (!enabled) return { enabled: false, memberType: null };

    const member = await queryHelpers.queryOne(
      `SELECT member_type as "memberType" FROM project_steering_board_members WHERE project_id = ? AND user_id = ?`,
      [projectId, userId]
    );
    const memberType = normalizeUpper(
      (member as any)?.memberType
    ) as SteeringBoardContext['memberType'];
    return { enabled: true, memberType: memberType || null };
  } catch {
    return { enabled: false, memberType: null };
  }
}

async function readProjectMembership(
  projectId: string,
  userId: string
): Promise<ProjectMembershipContext | null> {
  try {
    const row = await queryHelpers.queryOne(
      `SELECT project_role as "projectRole",
              is_invoked as "isInvoked",
              consultant_profile as "consultantProfile",
              engagement_type as "engagementType"
       FROM project_members
       WHERE project_id = ? AND user_id = ?`,
      [projectId, userId]
    );
    if (!row) return null;
    const rawProjectRole = String((row as any)?.projectRole || '').trim() || null;
    const canonicalProjectRole = mapToCanonicalProjectRole(rawProjectRole);
    return {
      projectId,
      rawProjectRole,
      canonicalProjectRole,
      isInvoked: !!(row as any)?.isInvoked,
      consultantProfile: String((row as any)?.consultantProfile || 'NONE'),
      engagementType: String((row as any)?.engagementType || 'INTERNAL'),
    };
  } catch {
    return null;
  }
}

async function readInitiativeGateRoleAssignments(
  orgId: string,
  initiativeId: string
): Promise<Array<{ gateRole: string; userId: string }>> {
  const roles: Array<{ gateRole: string; userId: string }> = [];
  // Explicit gate role assignments
  try {
    const rows = await queryHelpers.queryAll(
      `SELECT gate_role as "gateRole", user_id as "userId"
       FROM initiative_gate_roles WHERE initiative_id = ?`,
      [initiativeId]
    );
    rows.forEach((r: any) => {
      if (r?.gateRole && r?.userId)
        roles.push({ gateRole: String(r.gateRole), userId: String(r.userId) });
    });
  } catch {
    // table may not exist
  }

  // Derived roles from initiative fields
  const initiative = await queryHelpers.queryOne(
    `SELECT owner_business_id, owner_execution_id, sponsor_id
     FROM initiatives WHERE id = ? AND organization_id = ?`,
    [initiativeId, orgId]
  );
  const ini = initiative as any;
  if (ini?.owner_business_id) {
    roles.push({ gateRole: 'INITIATIVE_OWNER', userId: String(ini.owner_business_id) });
    roles.push({ gateRole: 'BUSINESS_OWNER', userId: String(ini.owner_business_id) });
  }
  if (ini?.owner_execution_id) {
    roles.push({ gateRole: 'INITIATIVE_OWNER', userId: String(ini.owner_execution_id) });
  }
  if (ini?.sponsor_id) {
    roles.push({ gateRole: 'PROJECT_SPONSOR', userId: String(ini.sponsor_id) });
  }

  return roles;
}

async function readSystemRole(userId: string): Promise<string> {
  const user = await queryHelpers.queryOne(`SELECT role FROM users WHERE id = ?`, [userId]);
  return normalizeUpper((user as any)?.role);
}

/**
 * Resolve initiative access context for the current user.
 * This is the canonical resolver to be reused by controllers/services.
 */
export async function resolveInitiativeAccessContext(
  orgId: string,
  initiativeId: string,
  userId: string,
  currentUserRoleHint?: string | null
): Promise<InitiativeAccessContext> {
  const initiative = await queryHelpers.queryOne(
    `SELECT id, project_id as "projectId"
     FROM initiatives WHERE id = ? AND organization_id = ?`,
    [initiativeId, orgId]
  );
  const projectId = (initiative as any)?.projectId ? String((initiative as any).projectId) : null;

  const [dbSystemRole, roleAssignments] = await Promise.all([
    readSystemRole(userId),
    readInitiativeGateRoleAssignments(orgId, initiativeId),
  ]);
  const hintedSystemRole = normalizeSystemRoleHint(currentUserRoleHint);
  const systemRole =
    hintedSystemRole === 'ADMIN' || hintedSystemRole === 'SUPERADMIN'
      ? hintedSystemRole
      : dbSystemRole;

  const [membership, steeringBoard] = await Promise.all([
    projectId ? readProjectMembership(projectId, userId) : Promise.resolve(null),
    projectId
      ? readSteeringBoardContext(projectId, userId)
      : Promise.resolve({ enabled: false, memberType: null }),
  ]);

  const effectiveRoles: string[] = [];

  // System admin override (technical)
  if (systemRole === 'ADMIN' || systemRole === 'SUPERADMIN') effectiveRoles.push('ADMIN');

  // Initiative-specific gate roles for this user
  roleAssignments
    .filter((r) => r.userId === userId)
    .forEach((r) => effectiveRoles.push(normalizeUpper(r.gateRole)));

  // Project membership → initiative role identifiers
  if (membership?.canonicalProjectRole) {
    effectiveRoles.push(
      ...mapCanonicalProjectRoleToInitiativeRoles(membership.canonicalProjectRole)
    );
  }

  // Consultant overlay → workflow identity (does not grant authority beyond gate rules)
  if (membership && normalizeUpper(membership.consultantProfile) !== 'NONE') {
    effectiveRoles.push('CONSULTANT');
  }

  // Steering Board membership: board_member/chair can act as STEERING_COMMITTEE (if enabled)
  if (
    steeringBoard.enabled &&
    (steeringBoard.memberType === 'CHAIR' || steeringBoard.memberType === 'BOARD_MEMBER')
  ) {
    effectiveRoles.push('STEERING_COMMITTEE');
  }

  return {
    initiativeId,
    organizationId: orgId,
    projectId,
    systemRole,
    membership,
    steeringBoard,
    effectiveRoles: unique(effectiveRoles),
    roleAssignments,
  };
}
