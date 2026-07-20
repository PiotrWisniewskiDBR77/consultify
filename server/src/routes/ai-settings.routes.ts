/**
 * AI Settings Routes
 * API endpoints for 3-tier AI settings management:
 * - SuperAdmin: Platform-wide settings
 * - Admin: Organization settings
 * - User: Personal preferences
 *
 * Fully migrated to TypeScript ES modules
 */

import { NextFunction, Request, Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/ErrorHandler.js';
import logger from '../utils/Logger.js';
import { normalizePlatformRole } from '../utils/roleNormalization.js';
import {
  getEffectiveSettingsFallback,
  getUserSettingsFallback,
  updateUserSettingsFallback,
} from './aiSettingsFallback.js';

const router = Router();

// Service interfaces
interface AISettingsServiceInterface {
  getSuperAdminSettings?: () => Promise<unknown>;
  updateSuperAdminSettings?: (
    settings: unknown,
    actorId: string,
    actorRole: string,
    ipAddress: string | null,
    userAgent: string | null
  ) => Promise<unknown>;
  getOrgSettings?: (
    orgId: string
  ) => Promise<{ defaultProactivityMode?: string; [key: string]: unknown }>;
  updateOrgSettings?: (
    orgId: string,
    settings: unknown,
    actorId: string,
    actorRole: string,
    ipAddress: string | null,
    userAgent: string | null
  ) => Promise<unknown>;
  getUserSettings?: (userId: string) => Promise<unknown>;
  updateUserSettings?: (userId: string, settings: unknown) => Promise<unknown>;
  getEffectiveSettings?: (userId: string, organizationId: string) => Promise<unknown>;
  getAvailableModels?: (userId: string, organizationId: string) => Promise<unknown[]>;
  getAuditLog?: (filters: {
    level?: string;
    targetId?: string;
    limit: number;
    offset: number;
  }) => Promise<unknown[]>;
  getUserCostHistory?: (userId: string, period: string) => Promise<unknown>;
  getOrgUserTiers?: (orgId: string) => Promise<unknown[]>;
  assignUserTier?: (orgId: string, userId: string, tier: string) => Promise<unknown>;
  getOrgCostAttribution?: (orgId: string, period: string) => Promise<unknown>;
  generateComplianceReport?: (
    orgId: string,
    standard: string,
    format: string
  ) => Promise<{ data: string | unknown }>;
}

interface AIProactivityEngineInterface {
  getEffectiveProactivity?: (userId: string, organizationId: string) => Promise<unknown>;
  getAllModes?: () => unknown[];
}

// Dynamic imports for services (may not be migrated yet)
let AISettingsService: AISettingsServiceInterface | null = null;
let AIProactivityEngine: AIProactivityEngineInterface | null = null;

const respondServiceNotConfigured = (
  _req: Request,
  res: Response,
  _feature: string,
  _readPayload?: Record<string, unknown>
) => {
  return res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });
};

const requirePlatformSuperAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const role = req.userRole || req.user?.role;
  if (normalizePlatformRole(role) !== 'SUPERADMIN') {
    res.status(403).json({
      error: 'Requires Super Admin privileges',
      code: 'INSUFFICIENT_PLATFORM_ROLE',
      guidance: 'Use a platform superadmin session to access this control plane.',
    });
    return;
  }
  next();
};

try {
  const settingsModule = await import('../../services/aiSettingsService.js');
  AISettingsService = (settingsModule.default || settingsModule) as AISettingsServiceInterface;
} catch {
  logger.warn('[AI Settings Routes] AISettingsService not available');
}

try {
  const proactivityModule = await import('../../services/aiProactivityEngine.js');
  AIProactivityEngine = (proactivityModule.default ||
    proactivityModule) as AIProactivityEngineInterface;
} catch {
  logger.warn('[AI Settings Routes] AIProactivityEngine not available');
}

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
  requirePlatformSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AISettingsService?.getSuperAdminSettings) {
      return respondServiceNotConfigured(req as Request, res, 'ai-settings', { settings: {} });
    }

    try {
      const settings = await AISettingsService.getSuperAdminSettings();
      res.json(settings);
    } catch (error: unknown) {
      logger.error('[AI Settings] Error getting superadmin settings:', error);
      return res.status(500).json({
        error: 'Failed to get settings',
        message: 'Unknown error',
      });
    }
  })
);

/**
 * PUT /api/ai-settings/superadmin
 * Update global SuperAdmin AI settings
 * Requires: SuperAdmin role
 */
router.put(
  '/superadmin',
  verifyToken,
  requirePlatformSuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AISettingsService?.updateSuperAdminSettings) {
      return respondServiceNotConfigured(req as Request, res, 'ai-settings');
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
        userAgent
      );

      res.json(updated);
    } catch (error: unknown) {
      logger.error('[AI Settings] Error updating superadmin settings:', error);
      return res.status(500).json({
        error: 'Failed to update settings',
        message: 'Unknown error',
      });
    }
  })
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
      return respondServiceNotConfigured(req as Request, res, 'ai-settings', { settings: {} });
    }

    try {
      const { orgId } = req.params;
      const orgIdStr = Array.isArray(orgId) ? orgId[0] : orgId;
      const userRole = req.user?.role;
      const userOrgId = req.user?.organizationId;

      // Access requires BOTH org membership AND admin/owner role (or superadmin)
      const isSuperAdmin = userRole === 'super_admin';
      const isOrgAdmin =
        userOrgId === orgIdStr && (userRole === 'owner' || userRole === 'administrator');
      if (!isSuperAdmin && !isOrgAdmin) {
        return res.status(403).json({ error: 'Access denied to this organization' });
      }

      const settings = await AISettingsService.getOrgSettings(orgIdStr);
      res.json(settings);
    } catch (error: unknown) {
      logger.error('[AI Settings] Error getting org settings:', error);
      return res.status(500).json({
        error: 'Failed to get settings',
        message: 'Unknown error',
      });
    }
  })
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
      return respondServiceNotConfigured(req as Request, res, 'ai-settings');
    }

    try {
      const { orgId } = req.params;
      const orgIdStr = Array.isArray(orgId) ? orgId[0] : orgId;
      const userRole = req.user?.role;
      const userOrgId = req.user?.organizationId;

      // Must be in this org AND be owner/administrator, or be superadmin
      const isAdmin =
        userRole === 'super_admin' ||
        (userOrgId === orgIdStr && (userRole === 'owner' || userRole === 'administrator'));

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
        orgIdStr,
        settings,
        actorId,
        actorRole,
        ipAddress,
        userAgent
      );

      res.json(updated);
    } catch (error: unknown) {
      logger.error('[AI Settings] Error updating org settings:', error);
      return res.status(500).json({
        error: 'Failed to update settings',
        message: 'Unknown error',
      });
    }
  })
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
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Graceful degradation: if the AI settings service is unavailable, serve the
    // user's personal settings from the user_preferences fallback store so the
    // AI Behavior / Model / Parameters pages still render and persist.
    if (!AISettingsService?.getUserSettings) {
      const settings = await getUserSettingsFallback(userId);
      return res.json({ ...settings, degraded: true });
    }

    try {
      const settings = await AISettingsService.getUserSettings(userId);
      res.json(settings);
    } catch (error: unknown) {
      logger.error('[AI Settings] Error getting user settings, using fallback:', error);
      const settings = await getUserSettingsFallback(userId);
      return res.json({ ...settings, degraded: true });
    }
  })
);

/**
 * PUT /api/ai-settings/user
 * Update current user's AI settings
 */
router.put(
  '/user',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId || req.user?.organizationId;
    const settings = req.body as { proactivityMode?: string; [key: string]: unknown };

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Graceful degradation: persist personal AI settings to the user_preferences
    // fallback store when the service (or org validation) is unavailable.
    if (!AISettingsService?.updateUserSettings || !AISettingsService?.getOrgSettings) {
      const updated = await updateUserSettingsFallback(userId, settings as Record<string, unknown>);
      return res.json({ ...updated, degraded: true });
    }

    try {
      if (!organizationId) {
        // No org context: fall back to personal-only persistence.
        const updated = await updateUserSettingsFallback(
          userId,
          settings as Record<string, unknown>
        );
        return res.json({ ...updated, degraded: true });
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
        }
      }

      const updated = await AISettingsService.updateUserSettings(userId, settings);
      res.json(updated);
    } catch (error: unknown) {
      logger.error('[AI Settings] Error updating user settings, using fallback:', error);
      try {
        const updated = await updateUserSettingsFallback(
          userId,
          settings as Record<string, unknown>
        );
        return res.json({ ...updated, degraded: true });
      } catch (fallbackError: unknown) {
        logger.error('[AI Settings] Fallback persistence also failed:', fallbackError);
        return res.status(500).json({
          error: 'Failed to update settings',
          message: 'Unknown error',
        });
      }
    }
  })
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
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId || req.user?.organizationId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Graceful degradation: serve user-tier effective settings from the fallback
    // store when the service is unavailable or the user has no org context.
    if (!AISettingsService?.getEffectiveSettings || !organizationId) {
      const effective = await getEffectiveSettingsFallback(userId);
      return res.json({ ...effective, degraded: true });
    }

    try {
      const effective = await AISettingsService.getEffectiveSettings(userId, organizationId);
      res.json(effective);
    } catch (error: unknown) {
      logger.error('[AI Settings] Error getting effective settings, using fallback:', error);
      const effective = await getEffectiveSettingsFallback(userId);
      return res.json({ ...effective, degraded: true });
    }
  })
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
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId || req.user?.organizationId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Graceful degradation: an empty model list is preferable to a 503 that
    // blanks the AI Model Selection page.
    if (!AISettingsService?.getAvailableModels || !organizationId) {
      return res.json([]);
    }

    try {
      const models = await AISettingsService.getAvailableModels(userId, organizationId);
      res.json(models);
    } catch (error: unknown) {
      logger.error('[AI Settings] Error getting available models:', error);
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
          details: error.details,
        });
      }
      // Degrade to an empty list rather than failing the page.
      return res.json([]);
    }
  })
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
    const userId = req.user?.id;
    const organizationId = req.user?.organizationId || req.user?.organizationId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Graceful degradation: BALANCED is the safe default mode.
    if (!AIProactivityEngine?.getEffectiveProactivity || !organizationId) {
      return res.json({ mode: 'BALANCED', behaviors: [], degraded: true });
    }

    try {
      const proactivity = await AIProactivityEngine.getEffectiveProactivity(userId, organizationId);
      res.json(proactivity);
    } catch (error: unknown) {
      logger.error('[AI Settings] Error getting proactivity, using fallback:', error);
      return res.json({ mode: 'BALANCED', behaviors: [], degraded: true });
    }
  })
);

/**
 * GET /api/ai-settings/proactivity/modes
 * Get all proactivity modes with descriptions (for UI)
 */
router.get(
  '/proactivity/modes',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    // Static fallback list mirrors the engine's canonical proactivity modes so
    // the selector UI still works when the engine is unavailable.
    const fallbackModes = [
      { id: 'REACTIVE', name: 'Reactive', description: 'Only responds when asked.' },
      { id: 'BALANCED', name: 'Balanced', description: 'Helpful suggestions in context.' },
      { id: 'PROACTIVE', name: 'Proactive', description: 'Anticipates needs and offers help.' },
    ];

    if (!AIProactivityEngine?.getAllModes) {
      return res.json(fallbackModes);
    }

    try {
      const modes = AIProactivityEngine.getAllModes();
      res.json(modes);
    } catch (error: unknown) {
      logger.error('[AI Settings] Error getting proactivity modes, using fallback:', error);
      return res.json(fallbackModes);
    }
  })
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
      return respondServiceNotConfigured(req as Request, res, 'ai-settings', { auditLog: [] });
    }

    try {
      const { level, targetId, limit = 100, offset = 0 } = req.query;
      const userRole = req.user?.role;
      const organizationId = req.user?.organizationId || req.user?.organizationId;

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

      if (userRole === 'owner') {
        if (level) filters.level = level as string;
        if (targetId) filters.targetId = targetId as string;
      } else if (userRole === 'administrator') {
        // Admins see only their org
        filters.targetId = organizationId;
        if (level) filters.level = level as string;
      } else {
        return res.status(403).json({ error: 'Admin access required for audit log' });
      }

      const auditLog = await AISettingsService.getAuditLog(filters);
      res.json(auditLog);
    } catch (error: unknown) {
      logger.error('[AI Settings] Error getting audit log:', error);
      return res.status(500).json({
        error: 'Failed to get audit log',
        message: 'Unknown error',
      });
    }
  })
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
      return respondServiceNotConfigured(req as Request, res, 'ai-settings', { auditLog: [] });
    }

    try {
      const { orgId } = req.params;
      const orgIdStr = Array.isArray(orgId) ? orgId[0] : (orgId as string);
      const { limit = 100, offset = 0 } = req.query;
      const userRole = req.user?.role;
      const userOrgId = req.user?.organizationId;

      // Access requires superadmin, OR membership in THIS org AND owner/admin role.
      // (Matches the canonical gate at :218-221/:258-259 — an admin from a different
      // org must NOT read another org's audit log.)
      const isSuperAdmin = userRole === 'super_admin';
      const isOrgAdmin =
        userOrgId === orgIdStr && (userRole === 'owner' || userRole === 'administrator');
      if (!isSuperAdmin && !isOrgAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const auditLog = await AISettingsService.getAuditLog({
        targetId: orgIdStr as string,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });
      res.json(auditLog);
    } catch (error: unknown) {
      logger.error('[AI Settings] Error getting org audit log:', error);
      return res.status(500).json({
        error: 'Failed to get audit log',
        message: 'Unknown error',
      });
    }
  })
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
    const userId = req.user?.id;
    const { period = '30d' } = req.query;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Graceful degradation: an empty cost history keeps the usage dashboard
    // rendering (it already handles the zero-data case) instead of 503.
    if (!AISettingsService?.getUserCostHistory) {
      return res.json({ costs: [], total: 0, period });
    }

    try {
      const costs = await AISettingsService.getUserCostHistory(userId, period as string);
      res.json(costs);
    } catch (error: unknown) {
      logger.error('[AI Settings] Error getting user costs:', error);
      return res.json({ costs: [], total: 0, period });
    }
  })
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
      return respondServiceNotConfigured(req as Request, res, 'ai-settings', { tiers: [] });
    }

    try {
      const { orgId } = req.params;
      const orgIdStr = Array.isArray(orgId) ? orgId[0] : (orgId as string);
      const userRole = req.user?.role;
      const userOrgId = req.user?.organizationId || req.user?.organizationId;

      // Check if user is admin for this org
      const isAdmin = userOrgId === orgIdStr && userRole === 'administrator';

      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const tiers = await AISettingsService.getOrgUserTiers(orgIdStr);
      res.json(tiers);
    } catch (error: unknown) {
      logger.error('[AI Settings] Error getting user tiers:', error);
      return res.status(500).json({
        error: 'Failed to get user tiers',
        message: 'Unknown error',
      });
    }
  })
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
      return respondServiceNotConfigured(req as Request, res, 'ai-settings');
    }

    try {
      const { orgId, userId } = req.params;
      const orgIdStr = Array.isArray(orgId) ? orgId[0] : orgId;
      const userIdStr = Array.isArray(userId) ? userId[0] : userId;
      const { tier } = req.body;
      const userRole = req.user?.role;
      const userOrgId = req.user?.organizationId || req.user?.organizationId;

      // Validate tier
      const validTiers = ['BUDGET', 'STANDARD', 'PREMIUM', 'REASONING'];
      if (!validTiers.includes(tier)) {
        return res.status(400).json({
          error: 'Invalid tier',
          message: `Tier must be one of: ${validTiers.join(', ')}`,
        });
      }

      // Check if user is admin for this org
      const isAdmin = userOrgId === orgIdStr && userRole === 'administrator';

      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const result = await AISettingsService.assignUserTier(orgIdStr, userIdStr, tier);
      res.json(result);
    } catch (error: unknown) {
      logger.error('[AI Settings] Error assigning user tier:', error);
      return res.status(500).json({
        error: 'Failed to assign tier',
        message: 'Unknown error',
      });
    }
  })
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
      return respondServiceNotConfigured(req as Request, res, 'ai-settings', { costs: [] });
    }

    try {
      const { orgId } = req.params;
      const orgIdStr = Array.isArray(orgId) ? orgId[0] : orgId;
      const { period = '7d' } = req.query;
      const userRole = req.user?.role;
      const userOrgId = req.user?.organizationId || req.user?.organizationId;

      // Check if user is admin for this org
      const isAdmin = userOrgId === orgIdStr && userRole === 'administrator';

      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const costs = await AISettingsService.getOrgCostAttribution(orgIdStr, period as string);
      res.json(costs);
    } catch (error: unknown) {
      logger.error('[AI Settings] Error getting cost attribution:', error);
      return res.status(500).json({
        error: 'Failed to get costs',
        message: 'Unknown error',
      });
    }
  })
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
      return respondServiceNotConfigured(req as Request, res, 'ai-settings', { report: null });
    }

    try {
      const { format } = req.params;
      const { standard = 'ISO21500' } = req.query;
      const orgId = req.user?.organizationId || req.user?.organizationId;
      const userRole = req.user?.role;
      const formatStr = Array.isArray(format) ? format[0] : format;

      // Validate format
      const validFormats = ['pdf', 'csv', 'json'];
      if (!validFormats.includes(formatStr)) {
        return res.status(400).json({
          error: 'Invalid format',
          message: `Format must be one of: ${validFormats.join(', ')}`,
        });
      }

      // Validate standard
      const validStandards = ['ISO21500', 'PMBOK7', 'PRINCE2', 'GDPR', 'SOC2'];
      if (!validStandards.includes(standard as string)) {
        return res.status(400).json({
          error: 'Invalid standard',
          message: `Standard must be one of: ${validStandards.join(', ')}`,
        });
      }

      // Check admin access
      if (userRole !== 'administrator') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      if (!orgId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const orgIdStr = Array.isArray(orgId) ? orgId[0] : (orgId as string);
      const standardStr = Array.isArray(standard) ? standard[0] : (standard as string);
      const report = await AISettingsService.generateComplianceReport(
        orgIdStr as string,
        standardStr as string,
        formatStr
      );

      // Set appropriate headers based on format
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=compliance-${standard}-${Date.now()}.csv`
        );
        return res.send(
          typeof report.data === 'string' ? report.data : JSON.stringify(report.data)
        );
      } else if (format === 'pdf') {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename=compliance-${standard}-${Date.now()}.pdf`
        );
        return res.send(
          typeof report.data === 'string' ? report.data : Buffer.from(JSON.stringify(report.data))
        );
      } else {
        res.json(report);
      }
    } catch (error: unknown) {
      logger.error('[AI Settings] Error generating compliance report:', error);
      return res.status(500).json({
        error: 'Failed to generate report',
        message: 'Unknown error',
      });
    }
  })
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
      return respondServiceNotConfigured(req as Request, res, 'ai-settings');
    }

    try {
      const { standard = 'ISO21500' } = req.body;
      const orgId = req.user?.organizationId || req.user?.organizationId;
      const orgIdStr = Array.isArray(orgId) ? orgId[0] : (orgId as string);
      const userRole = req.user?.role;

      // Check admin access
      if (userRole !== 'administrator') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      if (!orgId) {
        return res.status(400).json({ error: 'Organization ID required' });
      }

      const report = await AISettingsService.generateComplianceReport(orgIdStr, standard, 'json');
      res.json(report);
    } catch (error: unknown) {
      logger.error('[AI Settings] Error generating compliance report:', error);
      return res.status(500).json({
        error: 'Failed to generate report',
        message: 'Unknown error',
      });
    }
  })
);

export default router;
