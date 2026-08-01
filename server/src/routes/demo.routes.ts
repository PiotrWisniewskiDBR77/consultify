/**
 * Demo Mode Routes
 * API endpoints for demo mode management
 *
 * Handles enabling/disabling demo mode and providing demo organization info.
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import {
  checkUserDemoPreference,
  DEMO_ORG_ID,
  DEMO_ORG_NAME,
  getDemoOrganization,
  getDemoStats,
  setUserDemoPreference,
} from '../middleware/demoGuard.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import {
  getAtelierToysDemoScenarios,
  getAtelierToysToolCoverage,
} from '../services/demo/atelierToysDemoTemplate.js';
import { normalizeDemoLocale } from '../services/demo/demoLocale.js';
import {
  cleanupExpiredDemoSessions,
  endDemoSession,
  getActiveDemoSession,
  resolveOrCreateDemoSession,
} from '../services/demo/demoSessionService.js';
import {
  DEMO_TRIAL_EVENT_TYPES,
  recordDemoTrialEvent,
} from '../services/demoTrialTelemetryService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

function isUnavailableError(error: unknown): boolean {
  const message = (error as any)?.message;
  return typeof message === 'string' && message.toLowerCase().includes('unavailable');
}

function preferredLanguage(raw: string | undefined): string | null {
  if (!raw) return null;
  const normalized = raw.split(',')[0]?.trim().split('-')[0]?.toLowerCase();
  return normalized || null;
}

function getRequestedDemoLocale(req: AuthRequest): 'en' | 'pl' {
  return normalizeDemoLocale(String(req.get('X-App-Language') || req.get('Accept-Language') || ''));
}

function getDemoExperienceType(source: string | undefined | null): 'sales_demo' | 'workspace_demo' {
  const normalized = String(source || '')
    .trim()
    .toLowerCase();

  if (!normalized) return 'sales_demo';
  if (normalized.includes('profile_menu') || normalized.includes('workspace')) {
    return 'workspace_demo';
  }

  return 'sales_demo';
}

// Apply rate limiting
router.use(authRateLimiter);

// ==========================================
// DEMO MODE TOGGLE
// ==========================================

/**
 * POST /api/demo/toggle
 * Toggle demo mode on/off for the current user
 */
router.post(
  '/toggle',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    const { enabled, source } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const isDemoEnabled = enabled === true || enabled === 'true' || enabled === 1;
    const telemetrySource =
      typeof source === 'string' && source.trim().length > 0 ? source.trim() : 'demo_toggle';
    const requestedLocale = getRequestedDemoLocale(req);

    try {
      await cleanupExpiredDemoSessions();
      // Save preference to database (non-blocking if storage unavailable)
      try {
        await setUserDemoPreference(userId, isDemoEnabled);
      } catch (prefErr: any) {
        logger.warn(
          '[DemoMode] Preference storage failed (continuing):',
          prefErr?.message || prefErr
        );
      }

      if (isDemoEnabled) {
        let demoOrganization: any;
        let stats: any;
        let session: Awaited<ReturnType<typeof resolveOrCreateDemoSession>> | null = null;
        const demoExperienceType = getDemoExperienceType(telemetrySource);
        try {
          session = await resolveOrCreateDemoSession(userId, telemetrySource, requestedLocale, {
            restartOnLocaleMismatch: true,
          });
          [demoOrganization, stats] = await Promise.all([
            getDemoOrganization(session.session_org_id),
            getDemoStats(session.session_org_id),
          ]);
        } catch (error: any) {
          const message = String(error?.message || error);
          logger.warn('[DemoMode] Demo enable failed:', message);
          return res.status(503).json({
            success: false,
            error: 'Demo mode unavailable',
            code: isUnavailableError(error) ? 'DEMO_UNAVAILABLE' : 'DEMO_NOT_CONFIGURED',
            message,
          });
        }

        logger.info(`[DemoMode] User ${userId} enabled demo mode`);
        const language = preferredLanguage(String(req.get('Accept-Language') || ''));
        await recordDemoTrialEvent({
          eventType: DEMO_TRIAL_EVENT_TYPES.DEMO_MODE_ENABLED,
          organizationId: demoOrganization.id || session?.session_org_id || DEMO_ORG_ID,
          userId,
          source: telemetrySource,
          language,
          metadata: { experienceType: demoExperienceType },
        });
        await recordDemoTrialEvent({
          eventType: DEMO_TRIAL_EVENT_TYPES.DEMO_STARTED,
          organizationId: demoOrganization.id || session?.session_org_id || DEMO_ORG_ID,
          userId,
          source: telemetrySource,
          language,
          metadata: { experienceType: demoExperienceType },
        });

        return res.json({
          success: true,
          isDemoMode: true,
          demoExperienceType,
          demoSession: session
            ? {
                id: session.id,
                organizationId: session.session_org_id,
                locale: session.locale,
                expiresAt: session.expires_at,
                anchorDate: session.anchor_date,
              }
            : null,
          demoLocale: session?.locale || requestedLocale,
          demoOrganization: {
            id: demoOrganization.id,
            name: demoOrganization.name || DEMO_ORG_NAME,
            slug: demoOrganization.slug,
            description: demoOrganization.description,
          },
          stats,
          coverage: getAtelierToysToolCoverage(session?.locale || requestedLocale),
          message: 'Demo mode enabled',
        });
      } else {
        await endDemoSession(userId);
        logger.info(`[DemoMode] User ${userId} disabled demo mode`);
        await recordDemoTrialEvent({
          eventType: DEMO_TRIAL_EVENT_TYPES.DEMO_MODE_DISABLED,
          organizationId: DEMO_ORG_ID,
          userId,
          source: telemetrySource,
          language: preferredLanguage(String(req.get('Accept-Language') || '')),
          metadata: { experienceType: getDemoExperienceType(telemetrySource) },
        });

        return res.json({
          success: true,
          isDemoMode: false,
          demoExperienceType: getDemoExperienceType(telemetrySource),
          demoSession: null,
          message: 'Demo mode disabled',
        });
      }
    } catch (error: any) {
      logger.error('[DemoMode] Error toggling demo mode:', error);
      return res.status(503).json({
        success: false,
        error: 'Demo mode unavailable',
        code: 'DEMO_UNAVAILABLE',
      });
    }
  })
);

// ==========================================
// DEMO STATUS
// ==========================================

/**
 * GET /api/demo/status
 * Get current demo mode status for the user
 */
router.get(
  '/status',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    try {
      await cleanupExpiredDemoSessions();
      const isDemoEnabled = await checkUserDemoPreference(userId);
      const requestedLocale = getRequestedDemoLocale(req);

      if (isDemoEnabled) {
        let demoOrganization: any;
        let stats: any;
        let session: Awaited<ReturnType<typeof resolveOrCreateDemoSession>> | null = null;
        try {
          session = await resolveOrCreateDemoSession(userId, 'status_refresh', requestedLocale);
          [demoOrganization, stats] = await Promise.all([
            getDemoOrganization(session.session_org_id),
            getDemoStats(session.session_org_id),
          ]);
        } catch (error: any) {
          const message = String(error?.message || error);
          return res.status(503).json({
            success: false,
            error: 'Demo mode unavailable',
            code: isUnavailableError(error) ? 'DEMO_UNAVAILABLE' : 'DEMO_NOT_CONFIGURED',
            message,
          });
        }

        return res.json({
          success: true,
          isDemoMode: true,
          demoExperienceType: getDemoExperienceType(session?.source || 'status_refresh'),
          demoSession: session
            ? {
                id: session.id,
                organizationId: session.session_org_id,
                locale: session.locale,
                expiresAt: session.expires_at,
                anchorDate: session.anchor_date,
              }
            : null,
          demoLocale: session?.locale || requestedLocale,
          demoOrganization: {
            id: demoOrganization.id,
            name: demoOrganization.name,
            slug: demoOrganization.slug,
            description: demoOrganization.description,
          },
          stats,
          coverage: getAtelierToysToolCoverage(session?.locale || requestedLocale),
        });
      } else {
        return res.json({
          success: true,
          isDemoMode: false,
          demoExperienceType: null,
          demoSession: null,
        });
      }
    } catch (error: any) {
      logger.error('[DemoMode] Error getting demo status:', error);
      return res.status(503).json({
        success: false,
        error: 'Demo mode unavailable',
        code: 'DEMO_UNAVAILABLE',
      });
    }
  })
);

// ==========================================
// DEMO ORGANIZATION INFO
// ==========================================

/**
 * GET /api/demo/organization
 * Get demo organization details (public info)
 */
router.get(
  '/organization',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      await cleanupExpiredDemoSessions();
      const session = req.user?.id ? await getActiveDemoSession(req.user.id) : null;
      const orgId = session?.session_org_id || DEMO_ORG_ID;
      const locale = session?.locale || getRequestedDemoLocale(req);
      const [demoOrganization, stats] = await Promise.all([
        getDemoOrganization(orgId),
        getDemoStats(orgId),
      ]);
      return res.json({
        success: true,
        demoExperienceType: getDemoExperienceType(session?.source || null),
        demoSession: session
          ? {
              id: session.id,
              organizationId: session.session_org_id,
              locale: session.locale,
              expiresAt: session.expires_at,
              anchorDate: session.anchor_date,
            }
          : null,
        demoLocale: locale,
        organization: {
          id: demoOrganization.id,
          name: demoOrganization.name || DEMO_ORG_NAME,
          slug: demoOrganization.slug,
          description: demoOrganization.description,
        },
        stats,
        scenarios: getAtelierToysDemoScenarios(locale),
        coverage: getAtelierToysToolCoverage(locale),
      });
    } catch (error: any) {
      logger.error('[DemoMode] Error getting demo organization:', error);
      return res.status(503).json({
        success: false,
        error: 'Demo organization unavailable',
        code: 'DEMO_UNAVAILABLE',
      });
    }
  })
);

// ==========================================
// RECORD TELEMETRY EVENT (from frontend)
// ==========================================

/**
 * POST /api/demo/record-event
 * Record demo/trial telemetry events (e.g. trial_expiry_warning_shown when user sees banner)
 */
router.post(
  '/record-event',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }
    // `organizationId` is deliberately NOT read from the body. It used to be
    // (`organizationId || req.user.organizationId`), with the body winning — so any
    // authenticated caller, a public demo account included, could file a telemetry
    // event against an arbitrary tenant. The attribution is now always the
    // server-resolved organization: for a public demo principal that is its active
    // session tenant, decided in `attachUser` from the database.
    const { eventType, metadata } = req.body || {};
    const resolvedOrganizationId =
      (req as AuthRequest & { organizationId?: string }).organizationId ||
      req.user?.organizationId ||
      (req.user as { organization_id?: string } | undefined)?.organization_id;

    const allowed = [
      DEMO_TRIAL_EVENT_TYPES.TRIAL_EXPIRY_WARNING_SHOWN,
      DEMO_TRIAL_EVENT_TYPES.DEMO_AI_LIMIT_REACHED,
    ];
    if (!eventType || !allowed.includes(eventType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid eventType',
        allowed: allowed.join(', '),
      });
    }
    if (!resolvedOrganizationId) {
      return res.status(403).json({ success: false, error: 'Organization context required' });
    }
    await recordDemoTrialEvent({
      eventType,
      organizationId: resolvedOrganizationId,
      userId,
      source: 'frontend',
      metadata: typeof metadata === 'object' ? metadata : undefined,
    });
    return res.json({ success: true });
  })
);

// ==========================================
// DEMO TOURS (Educational Guides)
// ==========================================

/**
 * GET /api/demo/tours
 * Get available guided tours for demo mode
 */
router.get(
  '/tours',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const raw = process.env.DEMO_TOURS_JSON;
    if (!raw || !raw.trim()) {
      return res.status(503).json({
        success: false,
        error: 'Demo tours unavailable',
        code: 'DEMO_TOURS_UNAVAILABLE',
      });
    }
    try {
      const parsed = JSON.parse(raw);
      return res.json(parsed);
    } catch (error: any) {
      return res.status(500).json({ success: false, error: 'Invalid DEMO_TOURS_JSON' });
    }
  })
);

export default router;
