/* eslint-disable no-control-regex -- These middleware sanitizers intentionally reject ASCII control characters. */
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
const MAX_ORG_CONTEXT_ID_CHARS = 128;
const MAX_ORG_CONTEXT_USER_ID_CHARS = 128;
const MAX_PERMISSION_SCOPE_JSON_CHARS = 65_536;
const MAX_ORG_CONTEXT_OPTION_NAME_CHARS = 64;
const MAX_ORG_CONTEXT_ROLE_CHARS = 64;
const MAX_PERMISSION_SCOPE_FREEZE_DEPTH = 8;
const MAX_PERMISSION_SCOPE_FREEZE_KEYS = 2000;
const PERMISSION_SCOPE_DISALLOWED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const SAFE_ORG_CONTEXT_OPTION_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

// No dependencies needed

// ==========================================
// UTILITY FUNCTIONS
// ==========================================

const normalizeOptionalString = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized || null;
};

const safeRead = <T>(reader: () => T, fallback: T): T => {
  try {
    return reader();
  } catch {
    return fallback;
  }
};

const readRequestMethod = (req: Request): string => {
  const method = safeRead(() => req.method, 'GET');
  return typeof method === 'string' ? method.toUpperCase() : 'GET';
};

const readRequestUser = (req: OrgRequest): AuthRequest['user'] | undefined =>
  safeRead(() => req.user, undefined as AuthRequest['user']);

const readUserId = (req: OrgRequest, requestUser?: AuthRequest['user']): string | null => {
  const user = requestUser ?? readRequestUser(req);
  return normalizeOptionalString(
    safeRead(() => user?.id, undefined as unknown as string | undefined)
  );
};

const readUserDefaultOrgId = (
  req: OrgRequest,
  requestUser?: AuthRequest['user']
): string | null => {
  const user = requestUser ?? readRequestUser(req);
  const organizationId = normalizeOptionalString(
    safeRead(() => user?.organizationId, undefined as unknown as string | undefined)
  );
  if (organizationId && isSafeOrgContextId(organizationId)) return organizationId;
  const legacyOrganizationId = normalizeOptionalString(
    safeRead(
      () => (user as { organization_id?: string } | undefined)?.organization_id,
      undefined as unknown as string | undefined
    )
  );
  if (legacyOrganizationId && isSafeOrgContextId(legacyOrganizationId)) return legacyOrganizationId;
  const lastSelectedOrg = normalizeOptionalString(
    safeRead(
      () => (user as { last_selected_org?: string } | undefined)?.last_selected_org,
      undefined as unknown as string | undefined
    )
  );
  return lastSelectedOrg && isSafeOrgContextId(lastSelectedOrg) ? lastSelectedOrg : null;
};

const readOrgIdFromParam = (req: Request, paramName: string): string | null => {
  const params = safeRead(
    () => req.params as Record<string, unknown>,
    {} as Record<string, unknown>
  );
  if (!Object.prototype.hasOwnProperty.call(params, paramName)) return null;
  return normalizeOptionalString(safeRead(() => params[paramName], undefined));
};

const readOrgIdFromHeader = (req: Request, headerName: string): string | null => {
  const headers = safeRead(
    () => req.headers as Record<string, unknown>,
    {} as Record<string, unknown>
  );
  const normalizedHeaderName = normalizeOptionalString(headerName)?.toLowerCase();
  if (!normalizedHeaderName) return null;
  const headerValue = safeRead(() => headers[normalizedHeaderName], undefined);
  if (Array.isArray(headerValue)) {
    return normalizeOptionalString(safeRead(() => headerValue[0], undefined));
  }
  return normalizeOptionalString(headerValue);
};
const readDistinctOrgIdsFromHeader = (req: Request, headerName: string): string[] => {
  const headers = safeRead(
    () => req.headers as Record<string, unknown>,
    {} as Record<string, unknown>
  );
  const normalizedHeaderName = normalizeOptionalString(headerName)?.toLowerCase();
  if (!normalizedHeaderName) return [];
  const headerValue = safeRead(() => headers[normalizedHeaderName], undefined);
  if (!Array.isArray(headerValue)) return [];

  const distinctValues = new Set<string>();
  for (const value of headerValue) {
    const normalized = normalizeOptionalString(value);
    if (normalized) distinctValues.add(normalized);
  }
  return Array.from(distinctValues);
};
const isSafeOrgContextId = (orgId: string): boolean => {
  if (!orgId || orgId.length > MAX_ORG_CONTEXT_ID_CHARS) return false;
  if (/[\u0000-\u001F\u007F]/.test(orgId)) return false;
  if (/\s/u.test(orgId)) return false;
  if (/[,;|]/.test(orgId)) return false;
  if (orgId.includes('..') || orgId.includes('/') || orgId.includes('\\')) return false;
  return true;
};
const isSafeOrgContextUserId = (userId: string): boolean => {
  if (!userId || userId.length > MAX_ORG_CONTEXT_USER_ID_CHARS) return false;
  if (/[\u0000-\u001F\u007F]/.test(userId)) return false;
  if (/\s/u.test(userId)) return false;
  if (/[,;|]/.test(userId)) return false;
  if (userId.includes('..') || userId.includes('/') || userId.includes('\\')) return false;
  return true;
};
const deepFreezePermissionScope = (value: unknown): Record<string, unknown> => {
  let visitedKeys = 0;
  const walk = (node: unknown, depth: number): unknown => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) return node;
    if (depth > MAX_PERMISSION_SCOPE_FREEZE_DEPTH) return Object.freeze({});
    const source = node as Record<string, unknown>;
    const target: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      visitedKeys += 1;
      if (visitedKeys > MAX_PERMISSION_SCOPE_FREEZE_KEYS) break;
      if (PERMISSION_SCOPE_DISALLOWED_KEYS.has(key)) continue;
      target[key] = walk(source[key], depth + 1);
    }
    return Object.freeze(target);
  };
  const frozen = walk(value, 0);
  return frozen && typeof frozen === 'object' && !Array.isArray(frozen)
    ? (frozen as Record<string, unknown>)
    : Object.freeze({});
};
const sanitizeOrgContextRole = (role: unknown, isConsultant: boolean): string => {
  if (isConsultant) return 'CONSULTANT';
  if (typeof role !== 'string') return 'MEMBER';
  const trimmed = role.trim();
  if (!trimmed || trimmed.length > MAX_ORG_CONTEXT_ROLE_CHARS) return 'MEMBER';
  if (/[\u0000-\u001F\u007F]/.test(trimmed)) return 'MEMBER';
  return trimmed;
};

const parsePermissionScope = (
  value: unknown
): { valid: true; scope: Record<string, unknown> } | { valid: false } => {
  const normalized = normalizeOptionalString(value);
  if (!normalized) {
    return { valid: true, scope: {} };
  }
  if (normalized.length > MAX_PERMISSION_SCOPE_JSON_CHARS) {
    return { valid: false };
  }
  try {
    const parsed = JSON.parse(normalized);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { valid: false };
    }
    for (const key of Object.keys(parsed as Record<string, unknown>)) {
      if (PERMISSION_SCOPE_DISALLOWED_KEYS.has(key)) {
        return { valid: false };
      }
    }
    return { valid: true, scope: parsed as Record<string, unknown> };
  } catch {
    return { valid: false };
  }
};
const assertOrgContextOptionName = (label: string, value: string): void => {
  if (
    !value ||
    value.length > MAX_ORG_CONTEXT_OPTION_NAME_CHARS ||
    !SAFE_ORG_CONTEXT_OPTION_NAME.test(value)
  ) {
    throw new Error(`[OrgContextMiddleware] Invalid ${label}: ${JSON.stringify(value)}`);
  }
};

/**
 * Resolve organization access for a user.
 * Checks both organization_members table and consultant_org_links.
 * ALWAYS hits DB — no cache (fail-fast on revocation).
 */
async function resolveUserOrgAccess(userId: string, orgId: string): Promise<OrgAccessResult> {
  if (!userId || !orgId) {
    return { allowed: false };
  }
  if (!isSafeOrgContextUserId(userId) || !isSafeOrgContextId(orgId)) {
    return { allowed: false };
  }

  // Check direct membership first.
  // NOTE: membership status casing varies in real data ('active' vs 'ACTIVE').
  // The auth layer (auth.middleware.ts / auth.routes.ts) matches status
  // case-insensitively — this predicate must stay consistent or valid members
  // get a false 403 "You do not have access to this organization" (bug H2.13).
  const membership = await dbGet<MembershipRow>(
    `SELECT om.id, om.role, om.status, om.permission_scope
         FROM organization_members om
         JOIN organizations o ON o.id = om.organization_id
         WHERE om.user_id = ? AND om.organization_id = ? AND UPPER(om.status) = 'ACTIVE' AND o.is_active = 1`,
    [userId, orgId]
  );

  if (membership) {
    const parsedPermissionScope = parsePermissionScope(membership.permission_scope);
    if (!parsedPermissionScope.valid) {
      return { allowed: false };
    }
    return {
      allowed: true,
      isMember: true,
      isConsultant: false,
      role: membership.role,
      permissionScope: parsedPermissionScope.scope,
      membershipId: membership.id,
    };
  }

  // No consultant-link fallback: the consultant_org_links table exists on no
  // database (Consultant Mode never shipped — DEC-116, CONSULTANTS_DUAL_PRODUCER
  // _AUDIT_2026-08-26). The old query here always failed, was swallowed by
  // DbPromise fallback=true and only produced error-log noise; net result was
  // this same deny.

  // No access found
  return { allowed: false };
}

/**
 * Get list of all organizations a user has access to.
 */
async function getUserOrganizations(
  userId: string
): Promise<Array<{ id: string; name: string; role: string; access_type: string }>> {
  if (!isSafeOrgContextUserId(userId)) return [];
  const orgs: Array<{ id: string; name: string; role: string; access_type: string }> = [];

  // Get member organizations
  const memberOrgs = await dbAll<{ id: string; name: string; role: string; access_type: string }>(
    `SELECT o.id, o.name, om.role, 'MEMBER' as access_type
         FROM organizations o
         JOIN organization_members om ON o.id = om.organization_id
         WHERE om.user_id = ? AND UPPER(om.status) = 'ACTIVE' AND o.is_active = 1`,
    [userId]
  );
  orgs.push(...memberOrgs);

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
  assertOrgContextOptionName('paramName', paramName);
  if (allowHeader) {
    assertOrgContextOptionName('headerName', headerName);
  }

  return async (req: OrgRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.org = null;
      req.orgContext = null;
      const requestUser = readRequestUser(req);

      // Must have authenticated user
      if (!requestUser) {
        if (required) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }
        req.org = null;
        next();
        return;
      }

      const method = readRequestMethod(req);
      const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

      // Resolve orgId with priority: URL param > header (if allowed) > user default
      let orgId: string | null = null;
      let orgSource: string | null = null;

      // 1. URL param (highest priority, always trusted)
      const paramOrgId = readOrgIdFromParam(req, paramName);
      const headerOrgId = allowHeader ? readOrgIdFromHeader(req, headerName) : null;
      const headerOrgCandidates = allowHeader ? readDistinctOrgIdsFromHeader(req, headerName) : [];
      if (headerOrgCandidates.length > 1) {
        res.status(400).json({
          error: 'Invalid organization id',
          message: 'Organization header contains conflicting values.',
        });
        return;
      }
      if (paramOrgId && !isSafeOrgContextId(paramOrgId)) {
        res.status(400).json({
          error: 'Invalid organization id',
          message: 'Organization identifier is malformed or too long.',
        });
        return;
      }
      if (headerOrgId && !isSafeOrgContextId(headerOrgId)) {
        res.status(400).json({
          error: 'Invalid organization id',
          message: 'Organization identifier is malformed or too long.',
        });
        return;
      }
      if (paramOrgId && headerOrgId && paramOrgId !== headerOrgId) {
        res.status(400).json({
          error: 'Organization context conflict',
          message: 'URL organization does not match the organization header.',
        });
        return;
      }
      if (paramOrgId) {
        orgId = paramOrgId;
        orgSource = 'url_param';
      }
      // 2. Header (only if explicitly allowed)
      else if (allowHeader) {
        if (headerOrgId) {
          orgId = headerOrgId;
          orgSource = 'header';
        }
      }
      // 3. User's last selected org (only for reads when strictWrite is enabled)
      else if (!isWrite || !strictWrite) {
        const userDefaultOrgId = readUserDefaultOrgId(req, requestUser);
        if (userDefaultOrgId) {
          orgId = userDefaultOrgId;
          orgSource = 'user_default';
        }
      }

      // If header path did not resolve anything and fallback is allowed, still try user default.
      if (!orgId && (!isWrite || !strictWrite)) {
        const userDefaultOrgId = readUserDefaultOrgId(req, requestUser);
        if (userDefaultOrgId) {
          orgId = userDefaultOrgId;
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
      if (!isSafeOrgContextId(orgId)) {
        res.status(400).json({
          error: 'Invalid organization id',
          message: 'Organization identifier is malformed or too long.',
        });
        return;
      }

      const userId = readUserId(req, requestUser);
      if (!userId) {
        if (required) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }
        req.org = null;
        next();
        return;
      }
      if (!isSafeOrgContextUserId(userId)) {
        if (required) {
          res.status(401).json({ error: 'Authentication required' });
          return;
        }
        req.org = null;
        next();
        return;
      }

      // CRITICAL: Validate access from DB (always fresh, no cache)
      const access = await resolveUserOrgAccess(userId, orgId);

      if (!access.allowed) {
        res.status(403).json({
          error: 'Access denied',
          message: 'You do not have access to this organization.',
        });
        return;
      }

      // Attach org context
      const resolvedOrgContext: OrgContext = {
        id: orgId,
        source: orgSource || 'unknown',
        isMember: access.isMember || false,
        isConsultant: access.isConsultant || false,
        role: sanitizeOrgContextRole(access.role, access.isConsultant === true),
        permissionScope: deepFreezePermissionScope(access.permissionScope || {}),
        membershipId: access.membershipId || access.linkId,
      };
      req.org = Object.freeze(resolvedOrgContext);

      // Legacy compatibility: also set orgContext
      req.orgContext = req.org;

      next();
    } catch (error: unknown) {
      logger.error('[OrgContextMiddleware] Error:', error);
      if (!safeRead(() => res.headersSent, false)) {
        res.status(500).json({ error: 'Internal error resolving organization context' });
      }
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
