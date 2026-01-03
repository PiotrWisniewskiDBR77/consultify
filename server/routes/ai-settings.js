/**
 * AI Settings Routes
 * 
 * API endpoints for 3-tier AI settings management:
 * - SuperAdmin: Platform-wide settings
 * - Admin: Organization settings
 * - User: Personal preferences
 */

import express from 'express';
const router = express.Router();
const AISettingsService = import('aiSettingsService.js');
const AIProactivityEngine = import('aiProactivityEngine.js');
import authenticateToken from '../middleware/authMiddleware.js';
const { requireRole, requireOrgRole } = require('../middleware/rbac');

// ==========================================
// SUPERADMIN ROUTES
// ==========================================

/**
 * GET /api/ai-settings/superadmin
 * Get global SuperAdmin AI settings
 * Requires: SuperAdmin role
 */
router.get('/superadmin', authenticateToken, requireRole('superadmin'), async (req, res) => {
    try {
        const settings = await AISettingsService.getSuperAdminSettings();
        res.json(settings);
    } catch (error) {
        console.error('[AI Settings] Error getting superadmin settings:', error);
        res.status(500).json({ error: 'Failed to get settings', message: error.message });
    }
});

/**
 * PUT /api/ai-settings/superadmin
 * Update global SuperAdmin AI settings
 * Requires: SuperAdmin role
 */
router.put('/superadmin', authenticateToken, requireRole('superadmin'), async (req, res) => {
    try {
        const settings = req.body;
        const actorId = req.user.id;
        const actorRole = req.user.role;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
        const userAgent = req.headers['user-agent'] || null;

        const updated = await AISettingsService.updateSuperAdminSettings(
            settings,
            actorId,
            actorRole,
            ipAddress,
            userAgent
        );

        res.json(updated);
    } catch (error) {
        console.error('[AI Settings] Error updating superadmin settings:', error);
        res.status(500).json({ error: 'Failed to update settings', message: error.message });
    }
});

// ==========================================
// ORGANIZATION ROUTES
// ==========================================

/**
 * GET /api/ai-settings/org/:orgId
 * Get organization AI settings
 * Requires: Admin role for the organization
 */
router.get('/org/:orgId', authenticateToken, async (req, res) => {
    try {
        const { orgId } = req.params;

        // Check if user has access to this org
        if (req.user.role !== 'superadmin' && req.user.organizationId !== orgId) {
            return res.status(403).json({ error: 'Access denied to this organization' });
        }

        const settings = await AISettingsService.getOrgSettings(orgId);
        res.json(settings);
    } catch (error) {
        console.error('[AI Settings] Error getting org settings:', error);
        res.status(500).json({ error: 'Failed to get settings', message: error.message });
    }
});

/**
 * PUT /api/ai-settings/org/:orgId
 * Update organization AI settings
 * Requires: Admin role for the organization
 */
router.put('/org/:orgId', authenticateToken, async (req, res) => {
    try {
        const { orgId } = req.params;

        // Check if user is admin for this org
        const isAdmin = req.user.role === 'superadmin' ||
            (req.user.organizationId === orgId && req.user.role === 'admin');

        if (!isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const settings = req.body;
        const actorId = req.user.id;
        const actorRole = req.user.role;
        const ipAddress = req.ip || req.headers['x-forwarded-for'] || null;
        const userAgent = req.headers['user-agent'] || null;

        const updated = await AISettingsService.updateOrgSettings(
            orgId,
            settings,
            actorId,
            actorRole,
            ipAddress,
            userAgent
        );

        res.json(updated);
    } catch (error) {
        console.error('[AI Settings] Error updating org settings:', error);
        res.status(500).json({ error: 'Failed to update settings', message: error.message });
    }
});

// ==========================================
// USER ROUTES
// ==========================================

/**
 * GET /api/ai-settings/user
 * Get current user's AI settings
 */
router.get('/user', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const settings = await AISettingsService.getUserSettings(userId);
        res.json(settings);
    } catch (error) {
        console.error('[AI Settings] Error getting user settings:', error);
        res.status(500).json({ error: 'Failed to get settings', message: error.message });
    }
});

/**
 * PUT /api/ai-settings/user
 * Update current user's AI settings
 */
router.put('/user', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const settings = req.body;

        // Validate proactivity mode against org settings
        if (settings.proactivityMode) {
            const orgSettings = await AISettingsService.getOrgSettings(req.user.organizationId);
            const proactivityOrder = { REACTIVE: 0, BALANCED: 1, PROACTIVE: 2 };
            const maxAllowed = proactivityOrder[orgSettings.defaultProactivityMode] || 2;
            const requested = proactivityOrder[settings.proactivityMode] || 1;

            if (requested > maxAllowed) {
                return res.status(400).json({
                    error: 'Invalid proactivity mode',
                    message: `Your organization limits proactivity to ${orgSettings.defaultProactivityMode} or lower`
                });
            }
        }

        const updated = await AISettingsService.updateUserSettings(userId, settings);
        res.json(updated);
    } catch (error) {
        console.error('[AI Settings] Error updating user settings:', error);
        res.status(500).json({ error: 'Failed to update settings', message: error.message });
    }
});

// ==========================================
// EFFECTIVE SETTINGS (MERGED)
// ==========================================

/**
 * GET /api/ai-settings/effective
 * Get effective (merged) settings for current user
 * This is used by the AI pipeline at runtime
 */
router.get('/effective', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organizationId;

        if (!organizationId) {
            return res.status(400).json({ error: 'User must belong to an organization' });
        }

        const effective = await AISettingsService.getEffectiveSettings(userId, organizationId);
        res.json(effective);
    } catch (error) {
        console.error('[AI Settings] Error getting effective settings:', error);
        res.status(500).json({ error: 'Failed to get settings', message: error.message });
    }
});

// ==========================================
// AVAILABLE MODELS
// ==========================================

/**
 * GET /api/ai-settings/available-models
 * Get models available to the current user
 * Filtered by org settings
 */
router.get('/available-models', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organizationId;

        const models = await AISettingsService.getAvailableModels(userId, organizationId);
        res.json(models);
    } catch (error) {
        console.error('[AI Settings] Error getting available models:', error);
        res.status(500).json({ error: 'Failed to get models', message: error.message });
    }
});

// ==========================================
// PROACTIVITY
// ==========================================

/**
 * GET /api/ai-settings/proactivity
 * Get current proactivity settings and behaviors
 */
router.get('/proactivity', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const organizationId = req.user.organizationId;

        const proactivity = await AIProactivityEngine.getEffectiveProactivity(userId, organizationId);
        res.json(proactivity);
    } catch (error) {
        console.error('[AI Settings] Error getting proactivity:', error);
        res.status(500).json({ error: 'Failed to get proactivity', message: error.message });
    }
});

/**
 * GET /api/ai-settings/proactivity/modes
 * Get all proactivity modes with descriptions (for UI)
 */
router.get('/proactivity/modes', authenticateToken, (req, res) => {
    try {
        const modes = AIProactivityEngine.getAllModes();
        res.json(modes);
    } catch (error) {
        console.error('[AI Settings] Error getting proactivity modes:', error);
        res.status(500).json({ error: 'Failed to get modes', message: error.message });
    }
});

// ==========================================
// AUDIT LOG
// ==========================================

/**
 * GET /api/ai-settings/audit
 * Get audit log for AI settings changes
 * Requires: Admin or SuperAdmin role
 */
router.get('/audit', authenticateToken, async (req, res) => {
    try {
        const { level, targetId, limit = 100, offset = 0 } = req.query;

        // Non-superadmins can only see their org's audit log
        let filters = { limit: parseInt(limit), offset: parseInt(offset) };

        if (req.user.role === 'superadmin') {
            if (level) filters.level = level;
            if (targetId) filters.targetId = targetId;
        } else if (req.user.role === 'admin') {
            // Admins see only their org
            filters.targetId = req.user.organizationId;
            if (level) filters.level = level;
        } else {
            return res.status(403).json({ error: 'Admin access required for audit log' });
        }

        const auditLog = await AISettingsService.getAuditLog(filters);
        res.json(auditLog);
    } catch (error) {
        console.error('[AI Settings] Error getting audit log:', error);
        res.status(500).json({ error: 'Failed to get audit log', message: error.message });
    }
});

/**
 * GET /api/ai-settings/audit/org/:orgId
 * Get audit log for a specific organization
 * Requires: Admin role for the organization or SuperAdmin
 */
router.get('/audit/org/:orgId', authenticateToken, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { limit = 100, offset = 0 } = req.query;

        // Check access
        if (req.user.role !== 'superadmin' && req.user.organizationId !== orgId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const auditLog = await AISettingsService.getAuditLog({
            targetId: orgId,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json(auditLog);
    } catch (error) {
        console.error('[AI Settings] Error getting org audit log:', error);
        res.status(500).json({ error: 'Failed to get audit log', message: error.message });
    }
});

// ==========================================
// USER COST TRACKING
// ==========================================

/**
 * GET /api/ai-settings/user/costs
 * Get personal cost history for current user
 */
router.get('/user/costs', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const { period = '30d' } = req.query;

        const costs = await AISettingsService.getUserCostHistory(userId, period);
        res.json(costs);
    } catch (error) {
        console.error('[AI Settings] Error getting user costs:', error);
        res.status(500).json({ error: 'Failed to get cost history', message: error.message });
    }
});

// ==========================================
// USER TIER MANAGEMENT
// ==========================================

/**
 * GET /api/ai-settings/org/:orgId/users/tiers
 * Get all user tier assignments for an organization
 * Requires: Admin role for the organization
 */
router.get('/org/:orgId/users/tiers', authenticateToken, async (req, res) => {
    try {
        const { orgId } = req.params;

        // Check if user is admin for this org
        const isAdmin = req.user.role === 'superadmin' ||
            (req.user.organizationId === orgId && req.user.role === 'admin');

        if (!isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const tiers = await AISettingsService.getOrgUserTiers(orgId);
        res.json(tiers);
    } catch (error) {
        console.error('[AI Settings] Error getting user tiers:', error);
        res.status(500).json({ error: 'Failed to get user tiers', message: error.message });
    }
});

/**
 * PUT /api/ai-settings/org/:orgId/users/:userId/tier
 * Assign tier to a specific user
 * Requires: Admin role for the organization
 */
router.put('/org/:orgId/users/:userId/tier', authenticateToken, async (req, res) => {
    try {
        const { orgId, userId } = req.params;
        const { tier } = req.body;

        // Validate tier
        const validTiers = ['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING'];
        if (!validTiers.includes(tier)) {
            return res.status(400).json({ 
                error: 'Invalid tier', 
                message: `Tier must be one of: ${validTiers.join(', ')}` 
            });
        }

        // Check if user is admin for this org
        const isAdmin = req.user.role === 'superadmin' ||
            (req.user.organizationId === orgId && req.user.role === 'admin');

        if (!isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const result = await AISettingsService.assignUserTier(orgId, userId, tier);
        res.json(result);
    } catch (error) {
        console.error('[AI Settings] Error assigning user tier:', error);
        res.status(500).json({ error: 'Failed to assign tier', message: error.message });
    }
});

// ==========================================
// COST ATTRIBUTION
// ==========================================

/**
 * GET /api/ai-settings/org/:orgId/costs
 * Get cost attribution for an organization
 * Requires: Admin role for the organization
 */
router.get('/org/:orgId/costs', authenticateToken, async (req, res) => {
    try {
        const { orgId } = req.params;
        const { period = '7d' } = req.query;

        // Check if user is admin for this org
        const isAdmin = req.user.role === 'superadmin' ||
            (req.user.organizationId === orgId && req.user.role === 'admin');

        if (!isAdmin) {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const costs = await AISettingsService.getOrgCostAttribution(orgId, period);
        res.json(costs);
    } catch (error) {
        console.error('[AI Settings] Error getting cost attribution:', error);
        res.status(500).json({ error: 'Failed to get costs', message: error.message });
    }
});

// ==========================================
// COMPLIANCE REPORTS
// ==========================================

/**
 * GET /api/ai-settings/compliance/export/:format
 * Export compliance report in specified format
 * Requires: Admin role
 */
router.get('/compliance/export/:format', authenticateToken, async (req, res) => {
    try {
        const { format } = req.params;
        const { standard = 'ISO21500' } = req.query;
        const orgId = req.user.organizationId;

        // Validate format
        const validFormats = ['pdf', 'csv', 'json'];
        if (!validFormats.includes(format)) {
            return res.status(400).json({ 
                error: 'Invalid format', 
                message: `Format must be one of: ${validFormats.join(', ')}` 
            });
        }

        // Validate standard
        const validStandards = ['ISO21500', 'PMBOK7', 'PRINCE2', 'GDPR', 'SOC2'];
        if (!validStandards.includes(standard)) {
            return res.status(400).json({ 
                error: 'Invalid standard', 
                message: `Standard must be one of: ${validStandards.join(', ')}` 
            });
        }

        // Check admin access
        if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const report = await AISettingsService.generateComplianceReport(orgId, standard, format);
        
        // Set appropriate headers based on format
        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename=compliance-${standard}-${Date.now()}.csv`);
            return res.send(report.data);
        } else if (format === 'pdf') {
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename=compliance-${standard}-${Date.now()}.pdf`);
            return res.send(report.data);
        } else {
            res.json(report);
        }
    } catch (error) {
        console.error('[AI Settings] Error generating compliance report:', error);
        res.status(500).json({ error: 'Failed to generate report', message: error.message });
    }
});

/**
 * POST /api/ai-settings/compliance/generate
 * Generate a new compliance report
 * Requires: Admin role
 */
router.post('/compliance/generate', authenticateToken, async (req, res) => {
    try {
        const { standard = 'ISO21500' } = req.body;
        const orgId = req.user.organizationId;

        // Check admin access
        if (req.user.role !== 'superadmin' && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Admin access required' });
        }

        const report = await AISettingsService.generateComplianceReport(orgId, standard, 'json');
        res.json(report);
    } catch (error) {
        console.error('[AI Settings] Error generating compliance report:', error);
        res.status(500).json({ error: 'Failed to generate report', message: error.message });
    }
});

export default router;

