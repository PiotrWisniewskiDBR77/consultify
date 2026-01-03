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

import { Request, Response, NextFunction } from 'express';
import type { AuthRequest } from './auth.middleware';

// ==========================================
// TYPES
// ==========================================

interface Database {
    get: (sql: string, params: unknown[], callback: (err: Error | null, row: unknown) => void) => void;
    all: (sql: string, params: unknown[], callback: (err: Error | null, rows: unknown[]) => void) => void;
}

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
    org?: OrgContext;
    orgContext?: OrgContext;
}

interface OrgContextOptions {
    allowHeader?: boolean;
    strictWrite?: boolean;
    headerName?: string;
    paramName?: string;
    required?: boolean;
}

interface Dependencies {
    db: Database;
}

// ==========================================
// DEPENDENCIES (injectable for testing)
// ==========================================

let deps: Dependencies;

const getDeps = (): Dependencies => {
    if (!deps) {
        const defaultDb = require('../../database');
        deps = { db: defaultDb };
    }
    return deps;
};

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

    const { db } = getDeps();

    return new Promise<OrgAccessResult>((resolve, reject) => {
        // Check direct membership first
        db.get(
            `SELECT id, role, status, permission_scope FROM organization_members 
             WHERE user_id = ? AND organization_id = ? AND status = 'ACTIVE'`,
            [userId, orgId],
            (err, membership) => {
                if (err) return reject(err);
                if (membership) {
                    const memRow = membership as MembershipRow;
                    return resolve({
                        allowed: true,
                        isMember: true,
                        isConsultant: false,
                        role: memRow.role,
                        permissionScope: memRow.permission_scope ? JSON.parse(memRow.permission_scope) : {},
                        membershipId: memRow.id
                    });
                }

                // Check consultant link (fresh from DB — revocation is immediate)
                db.get(
                    `SELECT id, permission_scope, status FROM consultant_org_links 
                     WHERE consultant_id = ? AND organization_id = ? AND status = 'ACTIVE'`,
                    [userId, orgId],
                    (err2, consultantLink) => {
                        if (err2) return reject(err2);
                        if (consultantLink) {
                            const linkRow = consultantLink as ConsultantLinkRow;
                            return resolve({
                                allowed: true,
                                isMember: false,
                                isConsultant: true,
                                role: 'CONSULTANT',
                                permissionScope: linkRow.permission_scope ? JSON.parse(linkRow.permission_scope) : {},
                                linkId: linkRow.id
                            });
                        }

                        // No access found
                        resolve({ allowed: false });
                    }
                );
            }
        );
    });
}

/**
 * Get list of all organizations a user has access to.
 */
async function getUserOrganizations(userId: string): Promise<Array<{ id: string; name: string; role: string; access_type: string }>> {
    const { db } = getDeps();
    
    return new Promise((resolve, reject) => {
        const orgs: Array<{ id: string; name: string; role: string; access_type: string }> = [];

        db.all(
            `SELECT o.id, o.name, om.role, 'MEMBER' as access_type
             FROM organizations o
             JOIN organization_members om ON o.id = om.organization_id
             WHERE om.user_id = ? AND om.status = 'ACTIVE' AND o.is_active = 1`,
            [userId],
            (err, memberOrgs) => {
                if (err) return reject(err);
                orgs.push(...((memberOrgs || []) as Array<{ id: string; name: string; role: string; access_type: string }>));

                db.all(
                    `SELECT o.id, o.name, 'CONSULTANT' as role, 'CONSULTANT' as access_type
                     FROM organizations o
                     JOIN consultant_org_links col ON o.id = col.organization_id
                     WHERE col.consultant_id = ? AND col.status = 'ACTIVE' AND o.is_active = 1`,
                    [userId],
                    (err2, consultantOrgs) => {
                        if (err2) return reject(err2);
                        orgs.push(...((consultantOrgs || []) as Array<{ id: string; name: string; role: string; access_type: string }>));

                        const uniqueOrgs = Array.from(
                            new Map(orgs.map(o => [o.id, o])).values()
                        );
                        resolve(uniqueOrgs);
                    }
                );
            }
        );
    });
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
        required = true
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
                if (req.user.organization_id) {
                    orgId = req.user.organization_id;
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
                    message: 'Write operations require explicit organization ID in URL parameter or allowed header.'
                });
                return;
            }

            // If no org found and required
            if (!orgId) {
                if (required) {
                    res.status(400).json({
                        error: 'Organization context required',
                        message: 'Please specify organization via URL parameter.'
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
                    message: 'You do not have access to this organization.'
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
                membershipId: access.membershipId || access.linkId
            };

            // Legacy compatibility: also set orgContext
            req.orgContext = req.org;

            next();
        } catch (error) {
            console.error('[OrgContextMiddleware] Error:', error);
            res.status(500).json({ error: 'Internal error resolving organization context' });
        }
    };
}

// ==========================================
// EXPORTS
// ==========================================

// Export utilities for use in routes
(orgContextMiddleware as typeof orgContextMiddleware & {
    getUserOrganizations: typeof getUserOrganizations;
    resolveUserOrgAccess: typeof resolveUserOrgAccess;
    setDependencies: (newDeps: Partial<Dependencies>) => void;
}).getUserOrganizations = getUserOrganizations;
(orgContextMiddleware as typeof orgContextMiddleware & {
    getUserOrganizations: typeof getUserOrganizations;
    resolveUserOrgAccess: typeof resolveUserOrgAccess;
    setDependencies: (newDeps: Partial<Dependencies>) => void;
}).resolveUserOrgAccess = resolveUserOrgAccess;
(orgContextMiddleware as typeof orgContextMiddleware & {
    getUserOrganizations: typeof getUserOrganizations;
    resolveUserOrgAccess: typeof resolveUserOrgAccess;
    setDependencies: (newDeps: Partial<Dependencies>) => void;
}).setDependencies = (newDeps: Partial<Dependencies>): void => {
    deps = { ...getDeps(), ...newDeps };
};

export default orgContextMiddleware;
export { getUserOrganizations, resolveUserOrgAccess };

