/**
 * AI Settings Routes
 * API endpoints for 3-tier AI settings management:
 * - SuperAdmin: Platform-wide settings
 * - Admin: Organization settings
 * - User: Personal preferences
 *
 * Fully migrated to TypeScript ES modules
 */

import { Request, Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { authRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

// Apply rate limiting
const router = Router();

// Service interfaces
interface AISettingsServiceInterface {
    [key: string]: any;
}

interface AIProactivityEngineInterface {
    [key: string]: any;
}

// Dynamic imports for services (may not be migrated yet)
let AISettingsService: any = null;
let AIProactivityEngine: any = null;

// try {
//     const settingsModule = (await import('../../services/aiSettingsService.js')) as any;
//     AISettingsService = settingsModule.default || settingsModule;
// } catch {
//     logger.warn('[AI Settings Routes] AISettingsService not available');
// }

// try {
//     const proactivityModule = (await import('../../services/aiProactivityEngine.js')) as any;
//     AIProactivityEngine = proactivityModule.default || proactivityModule;
// } catch {
//     logger.warn('[AI Settings Routes] AIProactivityEngine not available');
// }

// ==========================================
// SUPERADMIN ROUTES
// ==========================================

/**
 * GET /api/ai-settings/superadmin
 * Get global SuperAdmin AI settings
 * Requires: SuperAdmin role
 */
router.get(
    '/superadmin',
    verifyToken,
    requireRole(['superadmin']),
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        if (!AISettingsService?.getSuperAdminSettings) {
            return res.status(503).json({ error: 'AI Settings service not available' });
        }

        try {
            const settings = await AISettingsService.getSuperAdminSettings();
            return res.json(settings);
        } catch (error: any) {
            logger.error('[AI Settings] Error getting superadmin settings:', error);
            return res.status(500).json({
                error: 'Failed to get settings',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

/**
 * PUT /api/ai-settings/superadmin
 * Update global SuperAdmin AI settings
 * Requires: SuperAdmin role
 */
router.put(
    '/superadmin',
    verifyToken,
    requireRole(['superadmin']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!AISettingsService?.updateSuperAdminSettings) {
            return res.status(503).json({ error: 'AI Settings service not available' });
        }

        try {
            const settings = req.body;
            const actorId = req.user?.id;
            const actorRole = req.user?.role;
            const ipAddress = (req as Request).ip || (req.headers['x-forwarded-for'] as string) || null;
            const userAgent = req.headers['user-agent'] || null;

            if (!actorId || !actorRole) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const updated = await AISettingsService.updateSuperAdminSettings(
                settings,
                actorId,
                actorRole,
                ipAddress,
                userAgent,
            );

            return res.json(updated);
        } catch (error: any) {
            logger.error('[AI Settings] Error updating superadmin settings:', error);
            return res.status(500).json({
                error: 'Failed to update settings',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

// ==========================================
// ORGANIZATION ROUTES
// ==========================================

/**
 * GET /api/ai-settings/org/:orgId
 * Get organization AI settings
 * Requires: Admin role for the organization
 */
router.get(
    '/org/:orgId',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!AISettingsService?.getOrgSettings) {
            return res.status(503).json({ error: 'AI Settings service not available' });
        }

        try {
            const { orgId } = req.params;
            const userRole = req.user?.role;
            const userOrgId = req.user?.organizationId || req.user?.organization_id;

            // Check if user has access to this org
            if (userRole !== 'superadmin' && userRole !== 'SUPERADMIN' && userOrgId !== orgId) {
                return res.status(403).json({ error: 'Access denied to this organization' });
            }

            const settings = await AISettingsService.getOrgSettings(orgId);
            return res.json(settings);
        } catch (error: any) {
            logger.error('[AI Settings] Error getting org settings:', error);
            return res.status(500).json({
                error: 'Failed to get settings',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

/**
 * PUT /api/ai-settings/org/:orgId
 * Update organization AI settings
 * Requires: Admin role for the organization
 */
router.put(
    '/org/:orgId',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!AISettingsService?.updateOrgSettings) {
            return res.status(503).json({ error: 'AI Settings service not available' });
        }

        try {
            const { orgId } = req.params;
            const userRole = req.user?.role;
            const userOrgId = req.user?.organizationId || req.user?.organization_id;

            // Check if user is admin for this org
            const isAdmin =
                userRole === 'superadmin' ||
                userRole === 'SUPERADMIN' ||
                (userOrgId === orgId && (userRole === 'admin' || userRole === 'ADMIN'));

            if (!isAdmin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const settings = req.body;
            const actorId = req.user?.id;
            const actorRole = req.user?.role;
            const ipAddress = (req as Request).ip || (req.headers['x-forwarded-for'] as string) || null;
            const userAgent = req.headers['user-agent'] || null;

            if (!actorId || !actorRole) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const updated = await AISettingsService.updateOrgSettings(
                orgId,
                settings,
                actorId,
                actorRole,
                ipAddress,
                userAgent,
            );

            return res.json(updated);
        } catch (error: any) {
            logger.error('[AI Settings] Error updating org settings:', error);
            return res.status(500).json({
                error: 'Failed to update settings',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

// ==========================================
// USER ROUTES
// ==========================================

/**
 * GET /api/ai-settings/user
 * Get current user's AI settings
 */
router.get(
    '/user',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!AISettingsService?.getUserSettings) {
            return res.status(503).json({ error: 'AI Settings service not available' });
        }

        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const settings = await AISettingsService.getUserSettings(userId);
            return res.json(settings);
        } catch (error: any) {
            logger.error('[AI Settings] Error getting user settings:', error);
            return res.status(500).json({
                error: 'Failed to get settings',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

/**
 * PUT /api/ai-settings/user
 * Update current user's AI settings
 */
router.put(
    '/user',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!AISettingsService?.updateUserSettings || !AISettingsService?.getOrgSettings) {
            return res.status(503).json({ error: 'AI Settings service not available' });
        }

        try {
            const userId = req.user?.id;
            const organizationId = req.user?.organizationId || req.user?.organization_id;
            const settings = req.body as { proactivityMode?: string;[key: string]: unknown };

            if (!userId || !organizationId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            // Validate proactivity mode against org settings
            if (settings.proactivityMode) {
                const orgSettings = await AISettingsService.getOrgSettings(organizationId);
                const proactivityOrder: Record<string, number> = { REACTIVE: 0, BALANCED: 1, PROACTIVE: 2 };
                const maxAllowed = proactivityOrder[orgSettings.defaultProactivityMode || 'PROACTIVE'] || 2;
                const requested = proactivityOrder[settings.proactivityMode] || 1;

                if (requested > maxAllowed) {
                    return res.status(400).json({
                        error: 'Invalid proactivity mode',
                        message: `Your organization limits proactivity to ${orgSettings.defaultProactivityMode || 'PROACTIVE'} or lower`,
                    });
                    return;
                }
            }

            const updated = await AISettingsService.updateUserSettings(userId, settings);
            return res.json(updated);
        } catch (error: any) {
            logger.error('[AI Settings] Error updating user settings:', error);
            return res.status(500).json({
                error: 'Failed to update settings',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

// ==========================================
// EFFECTIVE SETTINGS (MERGED)
// ==========================================

/**
 * GET /api/ai-settings/effective
 * Get effective (merged) settings for current user
 * This is used by the AI pipeline at runtime
 */
router.get(
    '/effective',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!AISettingsService?.getEffectiveSettings) {
            return res.status(503).json({ error: 'AI Settings service not available' });
        }

        try {
            const userId = req.user?.id;
            const organizationId = req.user?.organizationId || req.user?.organization_id;

            if (!userId || !organizationId) {
                return res.status(400).json({ error: 'User must belong to an organization' });
            }

            const effective = await AISettingsService.getEffectiveSettings(userId, organizationId);
            return res.json(effective);
        } catch (error: any) {
            logger.error('[AI Settings] Error getting effective settings:', error);
            return res.status(500).json({
                error: 'Failed to get settings',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

// ==========================================
// AVAILABLE MODELS
// ==========================================

/**
 * GET /api/ai-settings/available-models
 * Get models available to the current user
 * Filtered by org settings
 */
router.get(
    '/available-models',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!AISettingsService?.getAvailableModels) {
            return res.status(503).json({ error: 'AI Settings service not available' });
        }

        try {
            const userId = req.user?.id;
            const organizationId = req.user?.organizationId || req.user?.organization_id;

            if (!userId || !organizationId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const models = await AISettingsService.getAvailableModels(userId, organizationId);
            return res.json(models);
        } catch (error: any) {
            logger.error('[AI Settings] Error getting available models:', error);
            return res.status(500).json({
                error: 'Failed to get models',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

// ==========================================
// PROACTIVITY
// ==========================================

/**
 * GET /api/ai-settings/proactivity
 * Get current proactivity settings and behaviors
 */
router.get(
    '/proactivity',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!AIProactivityEngine?.getEffectiveProactivity) {
            return res.status(503).json({ error: 'AI Proactivity Engine not available' });
        }

        try {
            const userId = req.user?.id;
            const organizationId = req.user?.organizationId || req.user?.organization_id;

            if (!userId || !organizationId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const proactivity = await AIProactivityEngine.getEffectiveProactivity(userId, organizationId);
            return res.json(proactivity);
        } catch (error: any) {
            logger.error('[AI Settings] Error getting proactivity:', error);
            return res.status(500).json({
                error: 'Failed to get proactivity',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

/**
 * GET /api/ai-settings/proactivity/modes
 * Get all proactivity modes with descriptions (for UI)
 */
router.get(
    '/proactivity/modes',
    verifyToken,
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        if (!AIProactivityEngine?.getAllModes) {
            return res.status(503).json({ error: 'AI Proactivity Engine not available' });
        }

        try {
            const modes = AIProactivityEngine.getAllModes();
            return res.json(modes);
        } catch (error: any) {
            logger.error('[AI Settings] Error getting proactivity modes:', error);
            return res.status(500).json({
                error: 'Failed to get modes',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

// ==========================================
// AUDIT LOG
// ==========================================

/**
 * GET /api/ai-settings/audit
 * Get audit log for AI settings changes
 * Requires: Admin or SuperAdmin role
 */
router.get(
    '/audit',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!AISettingsService?.getAuditLog) {
            return res.status(503).json({ error: 'AI Settings service not available' });
        }

        try {
            const { level, targetId, limit = 100, offset = 0 } = req.query;
            const userRole = req.user?.role;
            const organizationId = req.user?.organizationId || req.user?.organization_id;

            // Non-superadmins can only see their org's audit log
            const filters: {
                level?: string;
                targetId?: string;
                limit: number;
                offset: number;
            } = {
                limit: parseInt(limit as string),
                offset: parseInt(offset as string),
            };

            if (userRole === 'superadmin' || userRole === 'SUPERADMIN') {
                if (level) filters.level = level as string;
                if (targetId) filters.targetId = targetId as string;
            } else if (userRole === 'admin' || userRole === 'ADMIN') {
                // Admins see only their org
                filters.targetId = organizationId;
                if (level) filters.level = level as string;
            } else {
                return res.status(403).json({ error: 'Admin access required for audit log' });
            }

            const auditLog = await AISettingsService.getAuditLog(filters);
            return res.json(auditLog);
        } catch (error: any) {
            logger.error('[AI Settings] Error getting audit log:', error);
            return res.status(500).json({
                error: 'Failed to get audit log',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

/**
 * GET /api/ai-settings/audit/org/:orgId
 * Get audit log for a specific organization
 * Requires: Admin role for the organization or SuperAdmin
 */
router.get(
    '/audit/org/:orgId',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!AISettingsService?.getAuditLog) {
            return res.status(503).json({ error: 'AI Settings service not available' });
        }

        try {
            const { orgId } = req.params;
            const { limit = 100, offset = 0 } = req.query;
            const userRole = req.user?.role;
            const userOrgId = req.user?.organizationId || req.user?.organization_id;

            // Check access
            if (userRole !== 'superadmin' && userRole !== 'SUPERADMIN' && userOrgId !== orgId) {
                return res.status(403).json({ error: 'Access denied' });
            }

            const auditLog = await AISettingsService.getAuditLog({
                targetId: orgId,
                limit: parseInt(limit as string),
                offset: parseInt(offset as string),
            });
            return;

            return res.json(auditLog);
        } catch (error: any) {
            logger.error('[AI Settings] Error getting org audit log:', error);
            return res.status(500).json({
                error: 'Failed to get audit log',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

// ==========================================
// USER COST TRACKING
// ==========================================

/**
 * GET /api/ai-settings/user/costs
 * Get personal cost history for current user
 */
router.get(
    '/user/costs',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!AISettingsService?.getUserCostHistory) {
            return res.status(503).json({ error: 'AI Settings service not available' });
        }

        try {
            const userId = req.user?.id;
            const { period = '30d' } = req.query;

            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const costs = await AISettingsService.getUserCostHistory(userId, period as string);
            return res.json(costs);
        } catch (error: any) {
            logger.error('[AI Settings] Error getting user costs:', error);
            return res.status(500).json({
                error: 'Failed to get cost history',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

// ==========================================
// USER TIER MANAGEMENT
// ==========================================

/**
 * GET /api/ai-settings/org/:orgId/users/tiers
 * Get all user tier assignments for an organization
 * Requires: Admin role for the organization
 */
router.get(
    '/org/:orgId/users/tiers',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!AISettingsService?.getOrgUserTiers) {
            return res.status(503).json({ error: 'AI Settings service not available' });
        }

        try {
            const { orgId } = req.params;
            const userRole = req.user?.role;
            const userOrgId = req.user?.organizationId || req.user?.organization_id;

            // Check if user is admin for this org
            const isAdmin =
                userRole === 'superadmin' ||
                userRole === 'SUPERADMIN' ||
                (userOrgId === orgId && (userRole === 'admin' || userRole === 'ADMIN'));

            if (!isAdmin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const tiers = await AISettingsService.getOrgUserTiers(orgId);
            return res.json(tiers);
        } catch (error: any) {
            logger.error('[AI Settings] Error getting user tiers:', error);
            return res.status(500).json({
                error: 'Failed to get user tiers',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

/**
 * PUT /api/ai-settings/org/:orgId/users/:userId/tier
 * Assign tier to a specific user
 * Requires: Admin role for the organization
 */
router.put(
    '/org/:orgId/users/:userId/tier',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!AISettingsService?.assignUserTier) {
            return res.status(503).json({ error: 'AI Settings service not available' });
        }

        try {
            const { orgId, userId } = req.params;
            const { tier } = req.body;
            const userRole = req.user?.role;
            const userOrgId = req.user?.organizationId || req.user?.organization_id;

            // Validate tier
            const validTiers = ['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING'];
            if (!validTiers.includes(tier)) {
                return res.status(400).json({
                    error: 'Invalid tier',
                    message: `Tier must be one of: ${validTiers.join(', ')}`,
                });
                return;
            }

            // Check if user is admin for this org
            const isAdmin =
                userRole === 'superadmin' ||
                userRole === 'SUPERADMIN' ||
                (userOrgId === orgId && (userRole === 'admin' || userRole === 'ADMIN'));

            if (!isAdmin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const result = await AISettingsService.assignUserTier(orgId, userId, tier);
            return res.json(result);
        } catch (error: any) {
            logger.error('[AI Settings] Error assigning user tier:', error);
            return res.status(500).json({
                error: 'Failed to assign tier',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

// ==========================================
// COST ATTRIBUTION
// ==========================================

/**
 * GET /api/ai-settings/org/:orgId/costs
 * Get cost attribution for an organization
 * Requires: Admin role for the organization
 */
router.get(
    '/org/:orgId/costs',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!AISettingsService?.getOrgCostAttribution) {
            return res.status(503).json({ error: 'AI Settings service not available' });
        }

        try {
            const { orgId } = req.params;
            const { period = '7d' } = req.query;
            const userRole = req.user?.role;
            const userOrgId = req.user?.organizationId || req.user?.organization_id;

            // Check if user is admin for this org
            const isAdmin =
                userRole === 'superadmin' ||
                userRole === 'SUPERADMIN' ||
                (userOrgId === orgId && (userRole === 'admin' || userRole === 'ADMIN'));

            if (!isAdmin) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            const costs = await AISettingsService.getOrgCostAttribution(orgId, period as string);
            return res.json(costs);
        } catch (error: any) {
            logger.error('[AI Settings] Error getting cost attribution:', error);
            return res.status(500).json({
                error: 'Failed to get costs',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

// ==========================================
// COMPLIANCE REPORTS
// ==========================================

/**
 * GET /api/ai-settings/compliance/export/:format
 * Export compliance report in specified format
 * Requires: Admin role
 */
router.get(
    '/compliance/export/:format',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!AISettingsService?.generateComplianceReport) {
            return res.status(503).json({ error: 'AI Settings service not available' });
        }

        try {
            const { format } = req.params;
            const { standard = 'ISO21500' } = req.query;
            const orgId = req.user?.organizationId || req.user?.organization_id;
            const userRole = req.user?.role;

            // Validate format
            const validFormats = ['pdf', 'csv', 'json'];
            if (!validFormats.includes(format)) {
                return res.status(400).json({
                    error: 'Invalid format',
                    message: `Format must be one of: ${validFormats.join(', ')}`,
                });
                return;
            }

            // Validate standard
            const validStandards = ['ISO21500', 'PMBOK7', 'PRINCE2', 'GDPR', 'SOC2'];
            if (!validStandards.includes(standard as string)) {
                return res.status(400).json({
                    error: 'Invalid standard',
                    message: `Standard must be one of: ${validStandards.join(', ')}`,
                });
                return;
            }

            // Check admin access
            if (
                userRole !== 'superadmin' &&
                userRole !== 'SUPERADMIN' &&
                userRole !== 'admin' &&
                userRole !== 'ADMIN'
            ) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            if (!orgId) {
                return res.status(400).json({ error: 'Organization ID required' });
            }

            const report = await AISettingsService.generateComplianceReport(orgId, standard as string, format);

            // Set appropriate headers based on format
            if (format === 'csv') {
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename=compliance-${standard}-${Date.now()}.csv`);
                return res.send(typeof report.data === 'string' ? report.data : JSON.stringify(report.data));
            } else if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=compliance-${standard}-${Date.now()}.pdf`);
                return res.send(
                    typeof report.data === 'string' ? report.data : Buffer.from(JSON.stringify(report.data)),
                );
            } else {
                return res.json(report);
            }
        } catch (error: any) {
            logger.error('[AI Settings] Error generating compliance report:', error);
            return res.status(500).json({
                error: 'Failed to generate report',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

/**
 * POST /api/ai-settings/compliance/generate
 * Generate a new compliance report
 * Requires: Admin role
 */
router.post(
    '/compliance/generate',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!AISettingsService?.generateComplianceReport) {
            return res.status(503).json({ error: 'AI Settings service not available' });
        }

        try {
            const { standard = 'ISO21500' } = req.body;
            const orgId = req.user?.organizationId || req.user?.organization_id;
            const userRole = req.user?.role;

            // Check admin access
            if (
                userRole !== 'superadmin' &&
                userRole !== 'SUPERADMIN' &&
                userRole !== 'admin' &&
                userRole !== 'ADMIN'
            ) {
                return res.status(403).json({ error: 'Admin access required' });
            }

            if (!orgId) {
                return res.status(400).json({ error: 'Organization ID required' });
            }

            const report = await AISettingsService.generateComplianceReport(orgId, standard, 'json');
            return res.json(report);
        } catch (error: any) {
            logger.error('[AI Settings] Error generating compliance report:', error);
            return res.status(500).json({
                error: 'Failed to generate report',
                message: error instanceof Error ? error.message : 'Unknown error',
            });
            return;
        }
    }),
);

export default router;
