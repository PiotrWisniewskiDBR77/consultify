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
    const { enabled } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
    }

    const isDemoEnabled = enabled === true || enabled === 'true' || enabled === 1;

    try {
      // Save preference to database (non-blocking if storage unavailable)
      try {
        await setUserDemoPreference(userId, isDemoEnabled);
      } catch (prefErr: any) {
        logger.warn('[DemoMode] Preference storage failed (continuing):', prefErr?.message || prefErr);
      }

      if (isDemoEnabled) {
        let demoOrganization: any;
        let stats: any;
        try {
          [demoOrganization, stats] = await Promise.all([getDemoOrganization(), getDemoStats()]);
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
          organizationId: demoOrganization.id || DEMO_ORG_ID,
          userId,
          source: 'demo_toggle',
          language,
        });
        await recordDemoTrialEvent({
          eventType: DEMO_TRIAL_EVENT_TYPES.DEMO_STARTED,
          organizationId: demoOrganization.id || DEMO_ORG_ID,
          userId,
          source: 'demo_toggle',
          language,
        });

        return res.json({
          success: true,
          isDemoMode: true,
          demoOrganization: {
            id: demoOrganization.id,
            name: demoOrganization.name || DEMO_ORG_NAME,
            slug: demoOrganization.slug,
            description: demoOrganization.description,
          },
          stats,
          message: 'Demo mode enabled',
        });
      } else {
        logger.info(`[DemoMode] User ${userId} disabled demo mode`);
        await recordDemoTrialEvent({
          eventType: DEMO_TRIAL_EVENT_TYPES.DEMO_MODE_DISABLED,
          organizationId: DEMO_ORG_ID,
          userId,
          source: 'demo_toggle',
          language: preferredLanguage(String(req.get('Accept-Language') || '')),
        });

        return res.json({
          success: true,
          isDemoMode: false,
          message: 'Demo mode disabled',
        });
      }
    } catch (error: any) {
      logger.error('[DemoMode] Error toggling demo mode:', error);
      return res.status(503).json({
        success: false,
        error: 'Demo mode unavailable',
        code: 'DEMO_UNAVAILABLE',
        message: error.message,
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
      const isDemoEnabled = await checkUserDemoPreference(userId);

      if (isDemoEnabled) {
        let demoOrganization: any;
        let stats: any;
        try {
          [demoOrganization, stats] = await Promise.all([getDemoOrganization(), getDemoStats()]);
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
          demoOrganization: {
            id: demoOrganization.id,
            name: demoOrganization.name,
            slug: demoOrganization.slug,
            description: demoOrganization.description,
          },
          stats,
        });
      } else {
        return res.json({
          success: true,
          isDemoMode: false,
        });
      }
    } catch (error: any) {
      logger.error('[DemoMode] Error getting demo status:', error);
      return res.status(503).json({
        success: false,
        error: 'Demo mode unavailable',
        code: 'DEMO_UNAVAILABLE',
        message: error.message,
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
      const [demoOrganization, stats] = await Promise.all([getDemoOrganization(), getDemoStats()]);
      return res.json({
        success: true,
        organization: {
          id: demoOrganization.id,
          name: demoOrganization.name || DEMO_ORG_NAME,
          slug: demoOrganization.slug,
          description: demoOrganization.description,
        },
        stats,
        scenarios: [
          {
            id: 'executive-overview',
            title: 'Executive Overview',
            duration: '8 min',
            audience: 'C-suite, board members',
            persona: 'Katarzyna Nowak (Admin)',
          },
          {
            id: 'initiatives-execution',
            title: 'Deep Dive: Initiatives & Execution',
            duration: '10 min',
            audience: 'PMO, program managers',
            persona: 'Tomasz Kowalski (PMO)',
          },
          {
            id: 'finance-roi',
            title: 'Deep Dive: Finance & ROI',
            duration: '8 min',
            audience: 'CFO, finance team',
            persona: 'Aleksandra Wiśniewska (CFO)',
          },
        ],
      });
    } catch (error: any) {
      logger.error('[DemoMode] Error getting demo organization:', error);
      return res.status(503).json({
        success: false,
        error: 'Demo organization unavailable',
        code: 'DEMO_UNAVAILABLE',
        message: error.message,
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
    const { eventType, organizationId, metadata } = req.body || {};
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
    await recordDemoTrialEvent({
      eventType,
      organizationId: organizationId || (req as any).user?.organizationId,
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
