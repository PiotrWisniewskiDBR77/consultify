// Reports Routes - Executive reporting
// Step 6: Stabilization, Reporting & Economics

const express = require('express');
const router = express.Router();
const ReportingService = require('../services/reportingService');
const NarrativeService = require('../services/narrativeService');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/reports/executive-overview
router.get('/executive-overview', verifyToken, async (req, res) => {
    try {
        const report = await ReportingService.generateExecutiveOverview(req.organizationId, req.userId);
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/project-health/:projectId
router.get('/project-health/:projectId', verifyToken, async (req, res) => {
    try {
        const report = await ReportingService.generateProjectHealthReport(req.params.projectId, req.userId);
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/governance/:projectId
router.get('/governance/:projectId', verifyToken, async (req, res) => {
    try {
        const report = await ReportingService.generateGovernanceReport(req.params.projectId, req.userId);
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== NARRATIVES ====================

// GET /api/reports/narrative/weekly/:projectId
router.get('/narrative/weekly/:projectId', verifyToken, async (req, res) => {
    try {
        const narrative = await NarrativeService.generateWeeklySummary(req.params.projectId);
        res.json(narrative);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/narrative/memo/:projectId
router.get('/narrative/memo/:projectId', verifyToken, async (req, res) => {
    const { topic } = req.query;
    try {
        const narrative = await NarrativeService.generateExecutiveMemo(req.params.projectId, topic);
        res.json(narrative);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/narrative/progress/:projectId
router.get('/narrative/progress/:projectId', verifyToken, async (req, res) => {
    try {
        const narrative = await NarrativeService.generateProgressNarrative(req.params.projectId);
        res.json(narrative);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== ORGANIZATION & INITIATIVE REPORTS ====================

const ShareLinkService = require('../services/shareLinkService');
const PermissionService = require('../services/permissionService');

// GET /api/reports/org-overview
router.get('/org-overview', verifyToken, async (req, res) => {
    try {
        const report = await ReportingService.generateOrganizationOverviewReport(req.organizationId);
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/initiative/:initiativeId
router.get('/initiative/:initiativeId', verifyToken, async (req, res) => {
    try {
        const report = await ReportingService.generateInitiativeExecutionReport(
            req.params.initiativeId,
            req.organizationId
        );
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== SHARE LINKS (HARDENED) ====================

// Simple in-memory rate limiter for public endpoint
const publicHits = new Map(); // ip -> {count, ts}
function publicRateLimit(req, res, next) {
    const ip = req.ip || req.connection?.remoteAddress || 'unknown';
    const now = Date.now();
    const windowMs = 60_000; // 1 minute
    const limit = 60; // 60 requests per minute

    const entry = publicHits.get(ip) || { count: 0, ts: now };
    if (now - entry.ts > windowMs) {
        entry.count = 0;
        entry.ts = now;
    }
    entry.count += 1;
    publicHits.set(ip, entry);

    if (entry.count > limit) {
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
}

// POST /api/reports/share - Create a share link
router.post('/share', verifyToken, async (req, res) => {
    try {
        const { entityType, entityId, expiresInHours } = req.body;

        // Check permission to create share links (OWNER/ADMIN only)
        const canShare = await PermissionService.hasCapability(req.userId, 'manage_org_settings', req.organizationId);
        if (!canShare) {
            return res.status(403).json({ error: 'Permission denied to create share links' });
        }

        // Check billing status for export/share gating
        const org = await require('../database').get(
            `SELECT billing_status, organization_type FROM organizations WHERE id = ?`,
            [req.organizationId]
        );

        if (org?.organization_type === 'DEMO') {
            return res.status(403).json({ error: 'Share links are not available in Demo mode' });
        }

        // Validate entityType
        if (!['ORG_REPORT', 'INITIATIVE_REPORT'].includes(entityType)) {
            return res.status(400).json({ error: 'Invalid entityType. Use ORG_REPORT or INITIATIVE_REPORT' });
        }

        if (entityType === 'INITIATIVE_REPORT' && !entityId) {
            return res.status(400).json({ error: 'entityId required for initiative reports' });
        }

        // Generate snapshot data
        let snapshotData;
        if (entityType === 'ORG_REPORT') {
            snapshotData = await ReportingService.generateOrganizationOverviewReport(req.organizationId);
        } else {
            snapshotData = await ReportingService.generateInitiativeExecutionReport(entityId, req.organizationId);
        }

        // Create share link (will check trial limits internally)
        const shareLink = await ShareLinkService.createShareLink({
            organizationId: req.organizationId,
            userId: req.userId,
            entityType,
            entityId,
            snapshotData,
            expiresInHours: expiresInHours || 168 // 7 days default
        });

        res.json(shareLink);
    } catch (err) {
        // Handle trial limit errors
        if (err.message.includes('Trial limit')) {
            return res.status(402).json({ error: err.message, code: 'TRIAL_LIMIT_REACHED' });
        }
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/share-links - List share links for org (org-scoped)
router.get('/share-links', verifyToken, async (req, res) => {
    try {
        // org-scoping enforced by service method
        const links = await ShareLinkService.listShareLinks(req.organizationId);
        res.json(links);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/reports/share-links/:id - Revoke a share link (soft delete)
router.delete('/share-links/:id', verifyToken, async (req, res) => {
    try {
        // Check permission
        const canRevoke = await PermissionService.hasCapability(req.userId, 'manage_org_settings', req.organizationId);
        if (!canRevoke) {
            return res.status(403).json({ error: 'Permission denied to revoke share links' });
        }

        // Use revokeShareLink for soft-delete (status = REVOKED)
        const revoked = await ShareLinkService.revokeShareLink(req.params.id, req.organizationId);
        if (revoked) {
            res.json({ success: true });
        } else {
            res.status(404).json({ error: 'Share link not found or not owned by your organization' });
        }
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/reports/share-links/revoke-all - Revoke all share links for org
router.post('/share-links/revoke-all', verifyToken, async (req, res) => {
    try {
        // Check permission (OWNER only ideally, but ADMIN is fine for MVP)
        const canRevoke = await PermissionService.hasCapability(req.userId, 'manage_org_settings', req.organizationId);
        if (!canRevoke) {
            return res.status(403).json({ error: 'Permission denied' });
        }

        const count = await ShareLinkService.revokeAllForOrg(req.organizationId);
        res.json({ success: true, revokedCount: count });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== PUBLIC SHARE ACCESS (RATE LIMITED) ====================

// GET /api/reports/public/:token - Public access to shared report (no auth required)
router.get('/public/:token', publicRateLimit, async (req, res) => {
    try {
        const result = await ShareLinkService.getShareLinkByToken(req.params.token);

        // Handle specific error states
        if (!result) {
            return res.status(404).json({ error: 'Share link not found' });
        }

        if (result.error === 'REVOKED') {
            return res.status(410).json({ error: 'This share link has been revoked' });
        }

        if (result.error === 'EXPIRED') {
            return res.status(410).json({ error: 'This share link has expired' });
        }

        res.json({
            entityType: result.entityType,
            snapshot: result.snapshot,
            expiresAt: result.expiresAt,
            createdAt: result.createdAt
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== EXPORT TRACKING ====================

// POST /api/reports/track-export - Track PDF export for trial limits
router.post('/track-export', verifyToken, async (req, res) => {
    try {
        // Check if export is allowed
        const limitCheck = await ShareLinkService.checkExportLimit(req.organizationId);
        if (!limitCheck.allowed) {
            return res.status(402).json({
                error: `Trial export limit reached: ${limitCheck.used}/${limitCheck.limit}`,
                code: 'TRIAL_LIMIT_REACHED'
            });
        }

        // Increment counter
        await ShareLinkService.incrementExportCounter(req.organizationId);

        res.json({
            success: true,
            used: limitCheck.used + 1,
            limit: limitCheck.limit
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/export-status - Check export limit status
router.get('/export-status', verifyToken, async (req, res) => {
    try {
        const limitCheck = await ShareLinkService.checkExportLimit(req.organizationId);
        res.json({
            canExport: limitCheck.allowed,
            used: limitCheck.used,
            limit: limitCheck.limit === Infinity ? null : limitCheck.limit
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;


