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
 * Check whether a chat role can perform a given action.
 *
 * @param action   – the action to perform
 * @param role     – resolved ChatRole for the user
 * @param ctx      – additional context (isCreator)
 */
export function canChat(
  action: ChatAction,
  role: ChatRole,
  ctx: ChatPermissionContext = {}
): boolean {
  if (role === 'none') return false;

  // Owner can do everything
  if (role === 'owner') return true;

  // Contributor
  if (role === 'contributor') {
    switch (action) {
      case 'read':
      case 'create_project':
      case 'create_thread':
      case 'add_message':
        return true;
      case 'edit_project':
      case 'delete_project':
      case 'manage_thread':
        return !!ctx.isCreator; // only own content
      case 'create_share_link':
        return false;
      default:
        return false;
    }
  }

  // Viewer
  if (role === 'viewer') {
    return action === 'read';
  }

  return false;
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
): Promise<{ allowed: boolean; role: ChatRole }> {
  const role = await resolveUserChatRole(userId, organizationId);
  const allowed = canChat(action, role, ctx);
  return { allowed, role };
}

export default {
  mapOrgRoleToChatRole,
  canChat,
  resolveUserChatRole,
  checkChatPermission,
};
