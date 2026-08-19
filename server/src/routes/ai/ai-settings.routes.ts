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

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireActiveMembership } from '../../services/legacyCutover/requireActiveMembership.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { AppError } from '../../utils/ErrorHandler.js';
import logger from '../../utils/Logger.js';
import { normalizePlatformRole } from '../../utils/roleNormalization.js';

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

try {
  const settingsModule = (await import('../../services/aiSettingsService.js')) as any;
  AISettingsService = settingsModule.default || settingsModule;
  logger.info('[AI Settings Routes] AISettingsService loaded successfully');
} catch (err) {
  logger.warn('[AI Settings Routes] AISettingsService not available:', err);
}

try {
  const proactivityModule = (await import('../../services/aiProactivityEngine.js')) as any;
  AIProactivityEngine = proactivityModule.default || proactivityModule;
  logger.info('[AI Settings Routes] AIProactivityEngine loaded successfully');
} catch (err) {
  logger.warn('[AI Settings Routes] AIProactivityEngine not available:', err);
}

// ==========================================
// SUPERADMIN ROUTES
// ==========================================

/**
 * Transform snake_case settings to camelCase for frontend
 */
const transformSettingsToCamelCase = (settings: any) => ({
  id: settings.id || 'global',
  defaultProvider: settings.default_provider || null,
  fallbackChain: settings.fallback_chain || [],
  circuitBreakerConfig: settings.circuit_breaker_config || {
    failureThreshold: 5,
    cooldownSeconds: 60,
  },
  globalTokenLimit: settings.global_token_limit || 10000000,
  globalRateLimit: settings.global_rate_limit || { requestsPerMinute: 60, requestsPerHour: 1000 },
  maxContextWindowSize: settings.max_context_window_size || 128000,
  maxTokensPerRequest: settings.max_tokens_per_request || 8192,
  piiDetectionSensitivity: settings.pii_detection_sensitivity || 'medium',
  requireEncryption: settings.require_encryption ?? true,
  dataResidency: settings.data_residency || null,
  updatedAt: settings.updated_at,
  updatedBy: settings.updated_by,
});

/**
 * Transform camelCase settings from frontend to snake_case for backend
 */
const transformSettingsToSnakeCase = (settings: any) => ({
  default_provider: settings.defaultProvider,
  fallback_chain: settings.fallbackChain,
  circuit_breaker_config: settings.circuitBreakerConfig,
  global_token_limit: settings.globalTokenLimit,
  global_rate_limit: settings.globalRateLimit,
  max_context_window_size: settings.maxContextWindowSize,
  max_tokens_per_request: settings.maxTokensPerRequest,
  pii_detection_sensitivity: settings.piiDetectionSensitivity,
  require_encryption: settings.requireEncryption,
  data_residency: settings.dataResidency,
});

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
      return respondServiceNotConfigured(req, res, 'ai-settings', { settings: {} });
    }

    try {
      const settings = await AISettingsService.getSuperAdminSettings();
      // Transform snake_case to camelCase for frontend
      return res.json(transformSettingsToCamelCase(settings));
    } catch (error: any) {
      logger.warn('[AI Settings] Service error:', error);
      return respondServiceNotConfigured(req, res, 'ai-settings', { settings: {} });
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
    const settingsCamelCase = req.body;
    const actorId = req.user?.id;
    const actorRole = req.user?.role;

    if (!actorId || !actorRole) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Transform camelCase input to snake_case for backend service
    const settingsSnakeCase = transformSettingsToSnakeCase(settingsCamelCase);

    if (!AISettingsService?.updateSuperAdminSettings) {
      return respondServiceNotConfigured(req as Request, res, 'ai-settings');
    }

    try {
      const ipAddress = (req as Request).ip || (req.headers['x-forwarded-for'] as string) || null;
      const userAgent = req.headers['user-agent'] || null;

      const updated = await AISettingsService.updateSuperAdminSettings(
        settingsSnakeCase,
        actorId,
        actorRole,
        ipAddress,
        userAgent
      );

      // Transform response back to camelCase for frontend
      return res.json(transformSettingsToCamelCase(updated));
    } catch (error: any) {
      logger.warn('[AI Settings] Service error on update:', error);
      return respondServiceNotConfigured(req as Request, res, 'ai-settings');
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
      const userRole = req.user?.role;
      const userOrgId = req.user?.organizationId || req.user?.organization_id;

      const normalizedGetRole = String(userRole || '')
        .trim()
        .toLowerCase();
      const isSuperAdmin =
        normalizedGetRole === 'superadmin' || normalizedGetRole === 'super_admin';
      const isOrgAdmin =
        userOrgId === orgId && ['owner', 'admin', 'administrator'].includes(normalizedGetRole);
      if (!isSuperAdmin && !isOrgAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const settings = await AISettingsService.getOrgSettings(orgId);
      return res.json(settings);
    } catch (error: any) {
      logger.error('[AI Settings] Error getting org settings:', error);
      return res.status(500).json({
        error: 'Failed to get settings',
        message: 'Unknown error',
      });
      return;
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
      const userRole = req.user?.role;
      const userOrgId = req.user?.organizationId || req.user?.organization_id;

      // Check if user is admin for this org
      const normalizedRole = String(userRole || '')
        .trim()
        .toLowerCase();
      const isAdmin =
        normalizedRole === 'superadmin' ||
        (userOrgId === orgId &&
          ['owner', 'admin', 'administrator', 'super_admin'].includes(normalizedRole));

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
        userAgent
      );

      // Mirror the change into the admin audit surface (H2.12). Fail-safe: an
      // audit-write failure must never block the settings update.
      try {
        const { default: adminAuditService } = await import('../../services/adminAuditService.js');
        await adminAuditService.logAction({
          adminId: actorId,
          organizationId: orgId,
          actionType: 'ai_settings_update',
          resourceType: 'ai_settings',
          details: { orgId, isSensitive: true, scope: 'organization' },
        });
      } catch {
        /* best-effort */
      }

      return res.json(updated);
    } catch (error: any) {
      logger.error('[AI Settings] Error updating org settings:', error);
      return res.status(500).json({
        error: 'Failed to update settings',
        message: 'Unknown error',
      });
      return;
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
    if (!AISettingsService?.getUserSettings) {
      return respondServiceNotConfigured(req as Request, res, 'ai-settings', { settings: {} });
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
        message: 'Unknown error',
      });
      return;
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
  requireActiveMembership,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!AISettingsService?.updateUserSettings || !AISettingsService?.getOrgSettings) {
      return respondServiceNotConfigured(req as Request, res, 'ai-settings');
    }

    try {
      const userId = req.user?.id;
      const organizationId = req.user?.organizationId || req.user?.organization_id;
      const settings = req.body as { proactivityMode?: string; [key: string]: unknown };

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
        message: 'Unknown error',
      });
      return;
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
    if (!AISettingsService?.getEffectiveSettings) {
      return respondServiceNotConfigured(req as Request, res, 'ai-settings', { settings: {} });
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
        message: 'Unknown error',
      });
      return;
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
    if (!AISettingsService?.getAvailableModels) {
      return respondServiceNotConfigured(req as Request, res, 'ai-settings', { models: [] });
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
      if (error instanceof AppError) {
        return res.status(error.statusCode).json({
          error: error.message,
          code: error.code,
          details: error.details,
        });
      }
      return res.status(500).json({
        error: 'Failed to get models',
        message: 'Unknown error',
      });
      return;
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
    if (!AIProactivityEngine?.getEffectiveProactivity) {
      return respondServiceNotConfigured(req as Request, res, 'ai-proactivity', {
        mode: 'BALANCED',
        behaviors: [],
      });
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
        message: 'Unknown error',
      });
      return;
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
    if (!AIProactivityEngine?.getAllModes) {
      return respondServiceNotConfigured(req as Request, res, 'ai-proactivity', { modes: [] });
    }

    try {
      const modes = AIProactivityEngine.getAllModes();
      return res.json(modes);
    } catch (error: any) {
      logger.error('[AI Settings] Error getting proactivity modes:', error);
      return res.status(500).json({
        error: 'Failed to get modes',
        message: 'Unknown error',
      });
      return;
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

      const normalizedRole = String(userRole || '')
        .trim()
        .toLowerCase();
      const isSuperAdmin = normalizedRole === 'superadmin' || normalizedRole === 'super_admin';
      // Org admins/owners may read their own org's AI-settings audit trail.
      // Previously only exact `admin`/`ADMIN` passed, so org OWNERs got a 403 and
      // the AI Controls → Audit Log tab surfaced "Failed to fetch audit log".
      const isOrgAdmin = ['owner', 'admin', 'administrator'].includes(normalizedRole);

      if (isSuperAdmin) {
        if (level) filters.level = level as string;
        if (targetId) filters.targetId = targetId as string;
      } else if (isOrgAdmin) {
        // Non-superadmins are scoped to their own organization.
        filters.targetId = organizationId;
        if (level) filters.level = level as string;
      } else {
        return res.status(403).json({ error: 'Admin access required for audit log' });
      }

      const auditLog = await AISettingsService.getAuditLog(filters);
      // The FE (AISettings/AuditLogViewer) expects an array of entries. The
      // service returns { total, rows, entries }, so hand back the entries array
      // while keeping the paging metadata available via headers for callers that want it.
      const entries = Array.isArray(auditLog)
        ? auditLog
        : auditLog?.entries || auditLog?.rows || [];
      res.setHeader('X-Total-Count', String(auditLog?.total ?? entries.length));
      return res.json(entries);
    } catch (error: any) {
      logger.error('[AI Settings] Error getting audit log:', error);
      return res.status(500).json({
        error: 'Failed to get audit log',
        message: 'Unknown error',
      });
      return;
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
      const { limit = 100, offset = 0 } = req.query;
      const userRole = req.user?.role;
      const userOrgId = req.user?.organizationId || req.user?.organization_id;

      // Access: superadmin, OR an admin/owner of THIS org. Same-org non-admins
      // and cross-org admins are both denied (IDOR guard). Owners were previously
      // rejected here, which surfaced "Failed to fetch audit log" for org owners.
      const normalizedRole = String(userRole || '')
        .trim()
        .toLowerCase();
      const isSuperAdmin = normalizedRole === 'superadmin' || normalizedRole === 'super_admin';
      const isSameOrgAdmin =
        userOrgId === orgId && ['owner', 'admin', 'administrator'].includes(normalizedRole);
      if (!isSuperAdmin && !isSameOrgAdmin) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const auditLog = await AISettingsService.getAuditLog({
        targetId: orgId,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      });

      const entries = Array.isArray(auditLog)
        ? auditLog
        : auditLog?.entries || auditLog?.rows || [];
      res.setHeader('X-Total-Count', String(auditLog?.total ?? entries.length));
      return res.json(entries);
    } catch (error: any) {
      logger.error('[AI Settings] Error getting org audit log:', error);
      return res.status(500).json({
        error: 'Failed to get audit log',
        message: 'Unknown error',
      });
      return;
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
    if (!AISettingsService?.getUserCostHistory) {
      return respondServiceNotConfigured(req as Request, res, 'ai-settings', { costs: [] });
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
        message: 'Unknown error',
      });
      return;
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
        message: 'Unknown error',
      });
      return;
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
        message: 'Unknown error',
      });
      return;
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
        message: 'Unknown error',
      });
      return;
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

      const report = await AISettingsService.generateComplianceReport(
        orgId,
        standard as string,
        format
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
        return res.json(report);
      }
    } catch (error: any) {
      logger.error('[AI Settings] Error generating compliance report:', error);
      return res.status(500).json({
        error: 'Failed to generate report',
        message: 'Unknown error',
      });
      return;
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
        message: 'Unknown error',
      });
      return;
    }
  })
);

export default router;
