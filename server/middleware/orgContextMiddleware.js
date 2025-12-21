/**
 * Organization Context Middleware (HARDENED)
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

const db = require('../database');

/**
 * Resolve organization access for a user.
 * Checks both organization_members table and consultant_org_links.
 * ALWAYS hits DB — no cache (fail-fast on revocation).
 */
async function resolveUserOrgAccess(userId, orgId) {
    if (!userId || !orgId) {
        return { allowed: false };
    }

    return new Promise((resolve, reject) => {
        // Check direct membership first
        db.get(
            `SELECT id, role, status, permission_scope FROM organization_members 
             WHERE user_id = ? AND organization_id = ? AND status = 'ACTIVE'`,
            [userId, orgId],
            (err, membership) => {
                if (err) return reject(err);
                if (membership) {
                    return resolve({
                        allowed: true,
                        isMember: true,
                        isConsultant: false,
                        role: membership.role,
                        permissionScope: JSON.parse(membership.permission_scope || '{}'),
                        membershipId: membership.id
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
                            return resolve({
                                allowed: true,
                                isMember: false,
                                isConsultant: true,
                                role: 'CONSULTANT',
                                permissionScope: JSON.parse(consultantLink.permission_scope || '{}'),
                                linkId: consultantLink.id
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
async function getUserOrganizations(userId) {
    return new Promise((resolve, reject) => {
        const orgs = [];

        db.all(
            `SELECT o.id, o.name, om.role, 'MEMBER' as access_type
             FROM organizations o
             JOIN organization_members om ON o.id = om.organization_id
             WHERE om.user_id = ? AND om.status = 'ACTIVE' AND o.is_active = 1`,
            [userId],
            (err, memberOrgs) => {
                if (err) return reject(err);
                orgs.push(...(memberOrgs || []));

                db.all(
                    `SELECT o.id, o.name, 'CONSULTANT' as role, 'CONSULTANT' as access_type
                     FROM organizations o
                     JOIN consultant_org_links col ON o.id = col.organization_id
                     WHERE col.consultant_id = ? AND col.status = 'ACTIVE' AND o.is_active = 1`,
                    [userId],
                    (err2, consultantOrgs) => {
                        if (err2) return reject(err2);
                        orgs.push(...(consultantOrgs || []));

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
function orgContextMiddleware(options = {}) {
    const {
        allowHeader = false,
        strictWrite = true,
        headerName = 'x-org-id',
        paramName = 'orgId',
        required = true
    } = options;

    return async (req, res, next) => {
        try {
            // Must have authenticated user
            if (!req.user) {
                if (required) {
                    return res.status(401).json({ error: 'Authentication required' });
                }
                req.org = null;
                return next();
            }

            const method = (req.method || 'GET').toUpperCase();
            const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

            // Resolve orgId with priority: URL param > header (if allowed) > user default
            let orgId = null;
            let orgSource = null;

            // 1. URL param (highest priority, always trusted)
            if (req.params?.[paramName]) {
                orgId = req.params[paramName];
                orgSource = 'url_param';
            }
            // 2. Header (only if explicitly allowed)
            else if (allowHeader && req.headers?.[headerName]) {
                orgId = req.headers[headerName];
                orgSource = 'header';
            }
            // 3. User's last selected org (only for reads when strictWrite is enabled)
            else if (!isWrite || !strictWrite) {
                if (req.user.organization_id) {
                    orgId = req.user.organization_id;
                    orgSource = 'user_default';
                } else if (req.user.last_selected_org) {
                    orgId = req.user.last_selected_org;
                    orgSource = 'user_default';
                }
            }

            // For write operations with strictWrite, require explicit org context
            if (isWrite && strictWrite && !orgId) {
                return res.status(400).json({
                    error: 'Organization context required',
                    message: 'Write operations require explicit organization ID in URL parameter or allowed header.'
                });
            }

            // If no org found and required
            if (!orgId) {
                if (required) {
                    return res.status(400).json({
                        error: 'Organization context required',
                        message: 'Please specify organization via URL parameter.'
                    });
                }
                req.org = null;
                return next();
            }

            // CRITICAL: Validate access from DB (always fresh, no cache)
            const access = await resolveUserOrgAccess(req.user.id, orgId);

            if (!access.allowed) {
                return res.status(403).json({
                    error: 'Access denied',
                    message: 'You do not have access to this organization.'
                });
            }

            // Attach org context
            req.org = {
                id: orgId,
                source: orgSource,
                isMember: access.isMember,
                isConsultant: access.isConsultant,
                role: access.role,
                permissionScope: access.permissionScope,
                membershipId: access.membershipId || access.linkId
            };

            // Legacy compatibility: also set orgContext
            req.orgContext = req.org;

            next();
        } catch (error) {
            console.error('[OrgContextMiddleware] Error:', error);
            return res.status(500).json({ error: 'Internal error resolving organization context' });
        }
    };
}

// Export utilities for use in routes
orgContextMiddleware.getUserOrganizations = getUserOrganizations;
orgContextMiddleware.resolveUserOrgAccess = resolveUserOrgAccess;

module.exports = orgContextMiddleware;
