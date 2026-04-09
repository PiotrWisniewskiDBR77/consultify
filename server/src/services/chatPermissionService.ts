/**
 * Chat Permission Service
 *
 * Minimal permission policy for chat projects & conversations.
 *
 * 3 Roles (mapped from organization_members.role):
 *   Owner       – OWNER / ADMIN         → full control
 *   Contributor  – MEMBER                → read, write messages, create threads; destructive ops only on own content
 *   Viewer       – CONSULTANT / VIEWER   → read-only
 *
 * 7 Actions:
 *   create_project, edit_project, delete_project,
 *   create_thread, add_message,
 *   manage_thread (archive/delete/rename),
 *   create_share_link
 */

import { get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

// ==========================================
// TYPES
// ==========================================

export type ChatRole = 'owner' | 'contributor' | 'viewer' | 'none';

export type ChatAction =
  | 'read'
  | 'create_project'
  | 'edit_project'
  | 'delete_project'
  | 'create_thread'
  | 'add_message'
  | 'manage_thread' // archive, delete, rename
  | 'create_share_link';

export interface ChatPermissionContext {
  /** Is the user the creator of the target entity (thread / project)? */
  isCreator?: boolean;
}

// ==========================================
// ROLE MAPPING
// ==========================================

/**
 * Map an organization_members.role value to a ChatRole.
 *
 * Organization roles: OWNER, ADMIN, MEMBER, CONSULTANT
 * (see migration 016_organization_skeleton.sql)
 */
export function mapOrgRoleToChatRole(orgRole: string | undefined | null): ChatRole {
  if (!orgRole) return 'none';
  const r = orgRole.toUpperCase().trim();
  switch (r) {
    case 'OWNER':
    case 'ADMIN':
    case 'SUPERADMIN':
    case 'SUPER_ADMIN':
    case 'ADMINISTRATOR':
      return 'owner';
    case 'MEMBER':
    case 'TEAM_MEMBER':
    case 'PROJECT_MANAGER':
    case 'MANAGER':
      return 'contributor';
    case 'CONSULTANT':
    case 'VIEWER':
    case 'GUEST':
    case 'CLIENT':
      return 'viewer';
    default:
      return 'viewer';
  }
}

// ==========================================
// PERMISSION CHECK
// ==========================================

/**
 * Build a human-readable denial reason for a role/action combination.
 */
function buildDenialReason(action: ChatAction, role: ChatRole, ctx: ChatPermissionContext = {}): string {
  if (role === 'none') {
    return 'You are not a member of this organization.';
  }
  if (role === 'viewer') {
    const actionLabels: Record<ChatAction, string> = {
      read: '',
      create_project: 'create folders',
      edit_project: 'edit folders',
      delete_project: 'delete folders',
      create_thread: 'create conversations',
      add_message: 'send messages',
      manage_thread: 'manage conversations',
      create_share_link: 'create share links',
    };
    return `Viewers can only read conversations. Contact an admin to ${actionLabels[action] || 'perform this action'}.`;
  }
  if (role === 'contributor') {
    if ((action === 'edit_project' || action === 'delete_project') && !ctx.isCreator) {
      return 'Only the folder creator or an admin can modify team folders.';
    }
    if (action === 'manage_thread' && !ctx.isCreator) {
      return 'Only the conversation creator or an admin can manage this team conversation.';
    }
    if (action === 'create_share_link') {
      return 'Only admins can create share links. Contact your organization admin.';
    }
  }
  return 'You do not have permission to perform this action.';
}

/**
 * Check whether a chat role can perform a given action.
 *
 * @param action   – the action to perform
 * @param role     – resolved ChatRole for the user
 * @param ctx      – additional context (isCreator)
 * @returns allowed boolean + denial reason (empty string if allowed)
 */
export function canChat(
  action: ChatAction,
  role: ChatRole,
  ctx: ChatPermissionContext = {}
): { allowed: boolean; reason: string } {
  if (role === 'none') return { allowed: false, reason: buildDenialReason(action, role, ctx) };

  if (role === 'owner') return { allowed: true, reason: '' };

  if (role === 'contributor') {
    switch (action) {
      case 'read':
      case 'create_project':
      case 'create_thread':
      case 'add_message':
        return { allowed: true, reason: '' };
      case 'edit_project':
      case 'delete_project':
      case 'manage_thread':
        return ctx.isCreator
          ? { allowed: true, reason: '' }
          : { allowed: false, reason: buildDenialReason(action, role, ctx) };
      case 'create_share_link':
        return { allowed: false, reason: buildDenialReason(action, role, ctx) };
      default:
        return { allowed: false, reason: buildDenialReason(action, role, ctx) };
    }
  }

  if (role === 'viewer') {
    return action === 'read'
      ? { allowed: true, reason: '' }
      : { allowed: false, reason: buildDenialReason(action, role, ctx) };
  }

  return { allowed: false, reason: buildDenialReason(action, role, ctx) };
}

// ==========================================
// RESOLVE USER CHAT ROLE IN A TEAM PROJECT
// ==========================================

interface MemberRow {
  role: string;
}

/**
 * Resolve the ChatRole for a user within an organization.
 * Hits DB (organization_members) to get the org role, then maps it.
 *
 * Returns 'none' if the user is not a member.
 */
export async function resolveUserChatRole(
  userId: string,
  organizationId: string
): Promise<ChatRole> {
  if (!userId || !organizationId) return 'none';

  try {
    const membership = await dbGet<MemberRow>(
      `SELECT role FROM organization_members
       WHERE user_id = ? AND organization_id = ? AND status = 'ACTIVE'`,
      [userId, organizationId]
    );

    if (!membership) return 'none';
    return mapOrgRoleToChatRole(membership.role);
  } catch (err) {
    logger.error('[ChatPermission] resolveUserChatRole error:', err as Error);
    return 'none';
  }
}

// ==========================================
// CONVENIENCE: check + resolve in one call
// ==========================================

/**
 * Full permission check: resolve role from DB + check action.
 * Use for team-scope operations only. Personal scope does not need this.
 */
export async function checkChatPermission(
  userId: string,
  organizationId: string,
  action: ChatAction,
  ctx: ChatPermissionContext = {}
): Promise<{ allowed: boolean; role: ChatRole; reason: string }> {
  const role = await resolveUserChatRole(userId, organizationId);
  const { allowed, reason } = canChat(action, role, ctx);
  return { allowed, role, reason };
}

export default {
  mapOrgRoleToChatRole,
  canChat,
  resolveUserChatRole,
  checkChatPermission,
};
