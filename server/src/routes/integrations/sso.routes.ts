/**
 * SSO Routes (Mock implementation)
 * Provides minimal endpoints so UI does not 501 while full SSO is integrated.
 */

import { v4 as uuidv4 } from 'uuid';
import { Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

const GOOGLE_REDIRECT_ENV = process.env.GOOGLE_OIDC_REDIRECT_URI || 'http://localhost:3000/api/sso/google/callback';

const parseDomains = (domains: string | string[] | undefined | null) => {
    if (!domains) return [];
    if (Array.isArray(domains)) return domains;
    try {
        const parsed = JSON.parse(domains);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return domains
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean);
    }
};

// List configs (all)
router.get(
    '/configs',
    verifyToken,
    asyncHandler(async (_req: AuthRequest, res) => {
        const { all: dbAll } = await import('../../utils/DbPromise.js');
        const rows = await dbAll(
            `SELECT sc.*, o.name as organization_name 
             FROM sso_configs sc 
             LEFT JOIN organizations o ON o.id = sc.organization_id
             ORDER BY sc.created_at DESC`,
            [],
        );
        const mapped = rows.map((r: any) => ({
            id: r.id,
            organizationId: r.organization_id,
            organizationName: r.organization_name || r.organization_id,
            provider: r.provider,
            status: r.status,
            clientId: r.client_id,
            redirectUri: r.redirect_uri,
            acsUrl: r.acs_url,
            entityId: r.entity_id,
            domains: parseDomains(r.domains),
            createdAt: r.created_at,
            updatedAt: r.updated_at,
        }));
        return res.json({ configs: mapped });
    }),
);

// Create Google config
router.post(
    '/superadmin/google/config',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res) => {
        const { run: dbRun } = await import('../../utils/DbPromise.js');
        const { organizationId, clientId, clientSecret, allowedDomains = [] } = req.body;
        if (!organizationId || !clientId) {
            return res.status(400).json({ error: 'organizationId and clientId are required' });
        }

        const id = uuidv4();
        const domainsJson = JSON.stringify(allowedDomains);

        // Upsert by organization/provider
        await dbRun(
            `
            INSERT INTO sso_configs (id, organization_id, provider, status, client_id, client_secret, redirect_uri, domains, created_at, updated_at)
            VALUES (?, ?, 'google', 'active', ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT(id) DO NOTHING;
        `,
            [id, organizationId, clientId, clientSecret || '', GOOGLE_REDIRECT_ENV, domainsJson],
        );

        // If already exists, update
        await dbRun(
            `
            UPDATE sso_configs
            SET client_id = ?, client_secret = ?, redirect_uri = ?, domains = ?, updated_at = CURRENT_TIMESTAMP
            WHERE organization_id = ? AND provider = 'google'
        `,
            [clientId, clientSecret || '', GOOGLE_REDIRECT_ENV, domainsJson, organizationId],
        );

        return res.json({ success: true, id });
    }),
);

// Toggle active/inactive
router.put(
    '/superadmin/config/:id/toggle',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res) => {
        const { run: dbRun } = await import('../../utils/DbPromise.js');
        const { id } = req.params;
        const { isActive } = req.body;
        const newStatus = isActive ? 'active' : 'inactive';
        await dbRun(`UPDATE sso_configs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [newStatus, id]);
        return res.json({ success: true });
    }),
);

// Delete config
router.delete(
    '/superadmin/config/:id',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res) => {
        const { run: dbRun } = await import('../../utils/DbPromise.js');
        const { id } = req.params;
        await dbRun(`DELETE FROM sso_configs WHERE id = ?`, [id]);
        return res.json({ success: true });
    }),
);

// Google metadata helper
router.get(
    '/providers/google/metadata',
    verifyToken,
    asyncHandler(async (_req: AuthRequest, res) => {
        return res.json({
            redirectUri: GOOGLE_REDIRECT_ENV,
            scopes: ['openid', 'email', 'profile'],
        });
    }),
);

// SAML metadata helper (per org)
router.get(
    '/providers/saml/metadata/:orgId',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res) => {
        const { orgId } = req.params;
        return res.json({
            entityId: `${process.env.APP_BASE_URL || 'http://localhost:3000'}/sso/metadata/${orgId}`,
            acsUrl: `${process.env.API_BASE_URL || 'http://localhost:3000/api'}/sso/callback/${orgId}`,
        });
    }),
);

// Domain mapping placeholder
router.get(
    '/domain-mapping',
    verifyToken,
    asyncHandler(async (_req: AuthRequest, res) => {
        return res.json({ domains: [] });
    }),
);

export default router;
