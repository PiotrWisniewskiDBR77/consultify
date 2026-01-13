/**
 * Organization Context Middleware (HARDENED)
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Resolves and validates the target organization for each request.
 *
 * Security Features:
 * - strictWrite: Write operations require explicit orgId (no fallback)
 * - allowHeader: Header-based org only for trusted scenarios (default: false)
 * - Always validates membership/consultant link from DB (no cache)
 *
 * Priority:
 * 1. URL param (:orgId)
 * 2. Header (x-org-id) — only if allowHeader=true
 * 3. User's last selected org — only for reads when strictWrite=true
 */

import { NextFunction, Request, Response } from 'express';

import { all as dbAll, get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';
import type { AuthRequest } from './auth.middleware.js';

// ==========================================
// TYPES
// ==========================================

// Database interface no longer needed - using DbPromise directly

interface MembershipRow {
  id: string;
  role: string;
  status: string;
  permission_scope?: string;
}

interface ConsultantLinkRow {
  id: string;
  permission_scope?: string;
  status: string;
}

interface OrgAccessResult {
  allowed: boolean;
  isMember?: boolean;
  isConsultant?: boolean;
  role?: string;
  permissionScope?: Record<string, unknown>;
  membershipId?: string;
  linkId?: string;
}

interface OrgContext {
  id: string;
  source: string;
  isMember: boolean;
  isConsultant: boolean;
  role: string;
  permissionScope?: Record<string, unknown>;
  membershipId?: string;
}

interface OrgRequest extends AuthRequest {
  org?: OrgContext | null;
  orgContext?: OrgContext | null;
}

interface OrgContextOptions {
  allowHeader?: boolean;
  strictWrite?: boolean;
  headerName?: string;
  paramName?: string;
  required?: boolean;
}

interface Dependencies {
  // No longer needed - using DbPromise directly
}

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

// No dependencies needed

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

/**
 * Resolve organization access for a user.
 * Checks both organization_members table and consultant_org_links.
 * ALWAYS hits DB — no cache (fail-fast on revocation).
 */
async function resolveUserOrgAccess(userId: string, orgId: string): Promise<OrgAccessResult> {
  if (!userId || !orgId) {
    return { allowed: false };
  }

  // Check direct membership first
  const membership = await dbGet<MembershipRow>(
    `SELECT id, role, status, permission_scope FROM organization_members 
         WHERE user_id = ? AND organization_id = ? AND status = 'ACTIVE'`,
    [userId, orgId]
  );

  if (membership) {
    return {
      allowed: true,
      isMember: true,
      isConsultant: false,
      role: membership.role,
      permissionScope: membership.permission_scope ? JSON.parse(membership.permission_scope) : {},
      membershipId: membership.id,
    };
  }

  // Check consultant link (fresh from DB — revocation is immediate)
  const consultantLink = await dbGet<ConsultantLinkRow>(
    `SELECT id, permission_scope, status FROM consultant_org_links 
         WHERE consultant_id = ? AND organization_id = ? AND status = 'ACTIVE'`,
    [userId, orgId]
  );

  if (consultantLink) {
    return {
      allowed: true,
      isMember: false,
      isConsultant: true,
      role: 'CONSULTANT',
      permissionScope: consultantLink.permission_scope
        ? JSON.parse(consultantLink.permission_scope)
        : {},
      linkId: consultantLink.id,
    };
  }

  // No access found
  return { allowed: false };
}

/**
 * Get list of all organizations a user has access to.
 */
async function getUserOrganizations(
  userId: string
): Promise<Array<{ id: string; name: string; role: string; access_type: string }>> {
  const orgs: Array<{ id: string; name: string; role: string; access_type: string }> = [];

  // Get member organizations
  const memberOrgs = await dbAll<{ id: string; name: string; role: string; access_type: string }>(
    `SELECT o.id, o.name, om.role, 'MEMBER' as access_type
         FROM organizations o
         JOIN organization_members om ON o.id = om.organization_id
         WHERE om.user_id = ? AND om.status = 'ACTIVE' AND o.is_active = 1`,
    [userId]
  );
  orgs.push(...memberOrgs);

  // Get consultant organizations
  const consultantOrgs = await dbAll<{
    id: string;
    name: string;
    role: string;
    access_type: string;
  }>(
    `SELECT o.id, o.name, 'CONSULTANT' as role, 'CONSULTANT' as access_type
         FROM organizations o
         JOIN consultant_org_links col ON o.id = col.organization_id
         WHERE col.consultant_id = ? AND col.status = 'ACTIVE' AND o.is_active = 1`,
    [userId]
  );
  orgs.push(...consultantOrgs);

  // Remove duplicates
  const uniqueOrgs = Array.from(new Map(orgs.map((o) => [o.id, o])).values());

  return uniqueOrgs;
}

// ==========================================
// MIDDLEWARE
// ==========================================

/**
 * Main middleware factory.
 *
 * Options:
 * - allowHeader: Accept org from x-org-id header (default: false — secure)
 * - strictWrite: Require explicit orgId for POST/PUT/PATCH/DELETE (default: true)
 * - headerName: Custom header name (default: 'x-org-id')
 * - paramName: URL param name (default: 'orgId')
 * - required: If true, returns 400 if no valid org context (default: true)
 */
function orgContextMiddleware(options: OrgContextOptions = {}) {
  const {
    allowHeader = false,
    strictWrite = true,
    headerName = 'x-org-id',
    paramName = 'orgId',
    required = true,
  } = options;

  return async (req: OrgRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Must have authenticated user
      if (!req.user) {
        if (required) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }
        req.org = null;
        next();
        return;
      }

      const method = (req.method || 'GET').toUpperCase();
      const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

      // Resolve orgId with priority: URL param > header (if allowed) > user default
      let orgId: string | null = null;
      let orgSource: string | null = null;

      // 1. URL param (highest priority, always trusted)
      if (req.params?.[paramName]) {
        orgId = req.params[paramName] as string;
        orgSource = 'url_param';
      }
      // 2. Header (only if explicitly allowed)
      else if (allowHeader && req.headers?.[headerName]) {
        const headerValue = req.headers[headerName];
        orgId = Array.isArray(headerValue) ? headerValue[0] : headerValue;
        orgSource = 'header';
      }
      // 3. User's last selected org (only for reads when strictWrite is enabled)
      else if (!isWrite || !strictWrite) {
        if (req.user?.organizationId) {
          orgId = req.user.organizationId;
          orgSource = 'user_default';
        } else if ((req.user as { last_selected_org?: string }).last_selected_org) {
          orgId = (req.user as { last_selected_org?: string }).last_selected_org || null;
          orgSource = 'user_default';
        }
      }

      // For write operations with strictWrite, require explicit org context
      if (isWrite && strictWrite && !orgId) {
        res.status(400).json({
          error: 'Organization context required',
          message:
            'Write operations require explicit organization ID in URL parameter or allowed header.',
        });
        return;
      }

      // If no org found and required
      if (!orgId) {
        if (required) {
          res.status(400).json({
            error: 'Organization context required',
            message: 'Please specify organization via URL parameter.',
          });
          return;
        }
        req.org = null;
        next();
        return;
      }

      // CRITICAL: Validate access from DB (always fresh, no cache)
      const access = await resolveUserOrgAccess(req.user.id, orgId);

      if (!access.allowed) {
        res.status(403).json({
          error: 'Access denied',
          message: 'You do not have access to this organization.',
        });
        return;
      }

      // Attach org context
      req.org = {
        id: orgId,
        source: orgSource || 'unknown',
        isMember: access.isMember || false,
        isConsultant: access.isConsultant || false,
        role: access.role || 'MEMBER',
        permissionScope: access.permissionScope,
        membershipId: access.membershipId || access.linkId,
      };

      // Legacy compatibility: also set orgContext
      req.orgContext = req.org;

      next();
    } catch (error: unknown) {
      logger.error('[OrgContextMiddleware] Error:', error);
      res.status(500).json({ error: 'Internal error resolving organization context' });
    }
  };
}

// ==========================================
// EXPORTS
// ==========================================

// Export utilities for use in routes
(
  orgContextMiddleware as typeof orgContextMiddleware & {
    getUserOrganizations: typeof getUserOrganizations;
    resolveUserOrgAccess: typeof resolveUserOrgAccess;
    setDependencies: (newDeps: Partial<Dependencies>) => void;
  }
).getUserOrganizations = getUserOrganizations;
(
  orgContextMiddleware as typeof orgContextMiddleware & {
    getUserOrganizations: typeof getUserOrganizations;
    resolveUserOrgAccess: typeof resolveUserOrgAccess;
    setDependencies: (newDeps: Partial<Dependencies>) => void;
  }
).resolveUserOrgAccess = resolveUserOrgAccess;
// No dependencies needed

export default orgContextMiddleware;
export { getUserOrganizations, resolveUserOrgAccess };
