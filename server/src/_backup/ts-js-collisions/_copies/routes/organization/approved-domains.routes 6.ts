/**
 * Approved Domains Routes
 * Email domain management for auto-join and verification
 */
import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { authRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

// Apply rate limiting and auth
router.use(authRateLimiter);
router.use(verifyToken);

// Ensure table exists
const ensureTable = async () => {
    await dbRun(`
        CREATE TABLE IF NOT EXISTS approved_domains (
            id TEXT PRIMARY KEY,
            organization_id TEXT NOT NULL,
            domain TEXT NOT NULL,
            auto_join INTEGER DEFAULT 0,
            verified INTEGER DEFAULT 0,
            verification_method TEXT DEFAULT 'dns',
            verification_token TEXT,
            added_by TEXT,
            added_at TEXT DEFAULT (datetime('now')),
            verified_at TEXT,
            FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
            UNIQUE(organization_id, domain)
        )
    `);
    await dbRun(`CREATE INDEX IF NOT EXISTS idx_approved_domains_org ON approved_domains(organization_id)`);
};

/**
 * GET /api/organizations/:orgId/approved-domains
 * Get all approved domains for organization
 */
router.get(
    '/:orgId/approved-domains',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { orgId } = req.params;
        const userOrgId = req.user?.organizationId;

        if (userOrgId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        try {
            await ensureTable();

            const domains = await dbAll<{
                id: string;
                domain: string;
                auto_join: number;
                verified: number;
                verification_method: string;
                added_by: string;
                added_at: string;
            }>(
                `SELECT ad.id, ad.domain, ad.auto_join, ad.verified, ad.verification_method, 
                        ad.added_by, ad.added_at,
                        (SELECT COUNT(*) FROM users WHERE email LIKE '%@' || ad.domain AND organization_id = ?) as users_count
                 FROM approved_domains ad
                 WHERE ad.organization_id = ?
                 ORDER BY ad.domain`,
                [orgId, orgId]
            );

            return res.json(domains.map(d => ({
                id: d.id,
                domain: d.domain,
                autoJoin: !!d.auto_join,
                verified: !!d.verified,
                verificationMethod: d.verification_method,
                addedBy: d.added_by,
                addedAt: d.added_at,
                usersCount: (d as any).users_count || 0,
            })));
        } catch (error: any) {
            logger.error('[approved-domains] Error fetching domains:', error);
            return res.status(500).json({ error: 'Failed to fetch approved domains' });
        }
    })
);

/**
 * POST /api/organizations/:orgId/approved-domains
 * Add a new approved domain
 */
router.post(
    '/:orgId/approved-domains',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { orgId } = req.params;
        const { domain, autoJoin } = req.body;
        const userId = req.user?.id;
        const userOrgId = req.user?.organizationId;
        const userRole = req.user?.role;

        if (userOrgId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!['ADMIN', 'SUPERADMIN', 'SUPER_ADMIN', 'OWNER'].includes(userRole || '')) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        if (!domain) {
            return res.status(400).json({ error: 'Domain is required' });
        }

        // Validate domain format
        const domainRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]*\.[a-zA-Z]{2,}$/;
        if (!domainRegex.test(domain)) {
            return res.status(400).json({ error: 'Invalid domain format' });
        }

        try {
            await ensureTable();

            // Check for duplicates
            const existing = await dbGet(
                `SELECT id FROM approved_domains WHERE organization_id = ? AND domain = ?`,
                [orgId, domain.toLowerCase()]
            );

            if (existing) {
                return res.status(409).json({ error: 'Domain already exists' });
            }

            const id = uuidv4();
            const verificationToken = uuidv4().replace(/-/g, '');

            await dbRun(
                `INSERT INTO approved_domains (id, organization_id, domain, auto_join, added_by, verification_token)
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, orgId, domain.toLowerCase(), autoJoin ? 1 : 0, userId, verificationToken]
            );

            logger.info(`[approved-domains] Domain ${domain} added to org ${orgId}`);

            return res.json({
                success: true,
                domain: {
                    id,
                    domain: domain.toLowerCase(),
                    autoJoin: !!autoJoin,
                    verified: false,
                    verificationToken,
                },
            });
        } catch (error: any) {
            logger.error('[approved-domains] Error adding domain:', error);
            return res.status(500).json({ error: 'Failed to add domain' });
        }
    })
);

/**
 * PUT /api/organizations/:orgId/approved-domains/:domainId
 * Update domain settings
 */
router.put(
    '/:orgId/approved-domains/:domainId',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { orgId, domainId } = req.params;
        const { autoJoin } = req.body;
        const userOrgId = req.user?.organizationId;
        const userRole = req.user?.role;

        if (userOrgId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!['ADMIN', 'SUPERADMIN', 'SUPER_ADMIN', 'OWNER'].includes(userRole || '')) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        try {
            await dbRun(
                `UPDATE approved_domains SET auto_join = ? WHERE id = ? AND organization_id = ?`,
                [autoJoin ? 1 : 0, domainId, orgId]
            );

            return res.json({ success: true });
        } catch (error: any) {
            logger.error('[approved-domains] Error updating domain:', error);
            return res.status(500).json({ error: 'Failed to update domain' });
        }
    })
);

/**
 * DELETE /api/organizations/:orgId/approved-domains/:domainId
 * Remove approved domain
 */
router.delete(
    '/:orgId/approved-domains/:domainId',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { orgId, domainId } = req.params;
        const userOrgId = req.user?.organizationId;
        const userRole = req.user?.role;

        if (userOrgId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!['ADMIN', 'SUPERADMIN', 'SUPER_ADMIN', 'OWNER'].includes(userRole || '')) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        try {
            await dbRun(
                `DELETE FROM approved_domains WHERE id = ? AND organization_id = ?`,
                [domainId, orgId]
            );

            logger.info(`[approved-domains] Domain ${domainId} removed from org ${orgId}`);

            return res.json({ success: true });
        } catch (error: any) {
            logger.error('[approved-domains] Error deleting domain:', error);
            return res.status(500).json({ error: 'Failed to delete domain' });
        }
    })
);

/**
 * POST /api/organizations/:orgId/approved-domains/:domainId/verify
 * Verify domain ownership
 */
router.post(
    '/:orgId/approved-domains/:domainId/verify',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { orgId, domainId } = req.params;
        const userOrgId = req.user?.organizationId;

        if (userOrgId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        try {
            // In production, this would:
            // 1. Check DNS TXT record for verification token
            // 2. Or verify via email to admin@domain
            
            // For now, auto-verify for demo
            await dbRun(
                `UPDATE approved_domains SET verified = 1, verified_at = datetime('now') 
                 WHERE id = ? AND organization_id = ?`,
                [domainId, orgId]
            );

            logger.info(`[approved-domains] Domain ${domainId} verified for org ${orgId}`);

            return res.json({
                verified: true,
                message: 'Domain verified successfully',
            });
        } catch (error: any) {
            logger.error('[approved-domains] Error verifying domain:', error);
            return res.status(500).json({ error: 'Failed to verify domain' });
        }
    })
);

export default router;
