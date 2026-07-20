/**
 * AI A/B Testing Routes
 * API endpoints for managing A/B test experiments
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

// Apply rate limiting
const router = Router();

const serviceFallback = (
  _req: AuthRequest,
  res: Response,
  _readPayload?: Record<string, unknown>
) =>
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });

// Service interfaces
interface ABTestingServiceInterface {
  listExperiments?: (filters: { status?: string; promptId?: string }) => Promise<
    Array<{
      variants?: string;
      traffic_split?: string;
      [key: string]: unknown;
    }>
  >;
  createExperiment?: (data: { createdBy: string; [key: string]: unknown }) => Promise<unknown>;
  getExperiment?: (id: string) => Promise<unknown>;
  getExperimentStats?: (id: string) => Promise<unknown>;
  startExperiment?: (id: string, userId: string) => Promise<unknown>;
  stopExperiment?: (id: string, reason?: string) => Promise<unknown>;
  pauseExperiment?: (id: string) => Promise<unknown>;
  resumeExperiment?: (id: string) => Promise<unknown>;
  archiveExperiment?: (id: string) => Promise<unknown>;
  recordOutcome?: (
    experimentId: string,
    userId: string,
    metric: string,
    value: unknown
  ) => Promise<void>;
}

// Dynamic import for abTestingService (may not be migrated yet)
let abTestingService: ABTestingServiceInterface | null = null;

try {
  const abTestingModule = (await import('../../services/ai/abTesting.js')) as any;
  const module = abTestingModule.default || abTestingModule;
  abTestingService = (module.abTestingService || module) as ABTestingServiceInterface;
} catch {
  logger.warn('[AI AB Testing Routes] abTestingService not available');
}

/**
 * GET /api/ai-ab-testing/experiments
 * List all experiments
 */
router.get(
  '/experiments',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!abTestingService?.listExperiments) {
      return serviceFallback(req, res, { data: [] });
    }

    try {
      const { status, promptId } = req.query;
      const experiments = await abTestingService.listExperiments({
        status: status as string | undefined,
        promptId: promptId as string | undefined,
      });

      return res.json({
        success: true,
        data: experiments.map((e) => ({
          ...e,
          variants: JSON.parse((e.variants as string) || '[]'),
          traffic_split: JSON.parse((e.traffic_split as string) || '[]'),
        })),
      });
    } catch (error: unknown) {
      logger.error('[AB Testing API] Error listing experiments:', error);
      return res.status(500).json({
        error: 'Failed to list experiments',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-ab-testing/experiments
 * Create new experiment
 */
router.post(
  '/experiments',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!abTestingService?.createExperiment) {
      return serviceFallback(req, res);
    }

    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await abTestingService.createExperiment({
        ...req.body,
        createdBy: userId,
      });

      return res.status(201).json({ success: true, data: result });
    } catch (error: unknown) {
      logger.error('[AB Testing API] Error creating experiment:', error);
      return res.status(500).json({
        error: 'Failed to create experiment',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * GET /api/ai-ab-testing/experiments/:id
 * Get experiment details with statistics
 */
router.get(
  '/experiments/:id',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!abTestingService?.getExperimentStats) {
      return serviceFallback(req, res, { data: null });
    }

    try {
      const stats = await abTestingService.getExperimentStats(req.params.id);
      return res.json({ success: true, data: stats });
    } catch (error: unknown) {
      logger.error('[AB Testing API] Error getting experiment:', error);
      return res.status(500).json({
        error: 'Failed to get experiment',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-ab-testing/experiments/:id/start
 * Start an experiment
 */
router.post(
  '/experiments/:id/start',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!abTestingService?.startExperiment) {
      return serviceFallback(req, res);
    }

    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const result = await abTestingService.startExperiment(req.params.id, userId);
      return res.json({ success: true, data: result });
    } catch (error: unknown) {
      logger.error('[AB Testing API] Error starting experiment:', error);
      return res.status(500).json({
        error: 'Failed to start experiment',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-ab-testing/experiments/:id/stop
 * Stop an experiment
 */
router.post(
  '/experiments/:id/stop',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!abTestingService?.stopExperiment) {
      return serviceFallback(req, res);
    }

    try {
      const { reason = 'manual' } = req.body;
      const result = await abTestingService.stopExperiment(req.params.id, reason);
      return res.json({ success: true, data: result });
    } catch (error: unknown) {
      logger.error('[AB Testing API] Error stopping experiment:', error);
      return res.status(500).json({
        error: 'Failed to stop experiment',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-ab-testing/experiments/:id/pause
 * Pause an experiment
 */
router.post(
  '/experiments/:id/pause',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!abTestingService?.pauseExperiment) {
      return serviceFallback(req, res);
    }

    try {
      const result = await abTestingService.pauseExperiment(req.params.id);
      return res.json({ success: true, data: result });
    } catch (error: unknown) {
      logger.error('[AB Testing API] Error pausing experiment:', error);
      return res.status(500).json({
        error: 'Failed to pause experiment',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-ab-testing/experiments/:id/resume
 * Resume a paused experiment
 */
router.post(
  '/experiments/:id/resume',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!abTestingService?.resumeExperiment) {
      return serviceFallback(req, res);
    }

    try {
      const result = await abTestingService.resumeExperiment(req.params.id);
      return res.json({ success: true, data: result });
    } catch (error: unknown) {
      logger.error('[AB Testing API] Error resuming experiment:', error);
      return res.status(500).json({
        error: 'Failed to resume experiment',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-ab-testing/experiments/:id/archive
 * Archive an experiment
 */
router.post(
  '/experiments/:id/archive',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!abTestingService?.archiveExperiment) {
      return serviceFallback(req, res);
    }

    try {
      const result = await abTestingService.archiveExperiment(req.params.id);
      return res.json({ success: true, data: result });
    } catch (error: unknown) {
      logger.error('[AB Testing API] Error archiving experiment:', error);
      return res.status(500).json({
        error: 'Failed to archive experiment',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-ab-testing/experiments/:id/declare-winner
 * Declare a winner variant
 */
router.post(
  '/experiments/:id/declare-winner',
  verifyToken,
  requireRole('super_admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!abTestingService?.stopExperiment) {
      return serviceFallback(req, res);
    }

    try {
      const { winningVariantId } = req.body;
      if (!winningVariantId) {
        return res.status(400).json({ error: 'winningVariantId is required' });
      }

      const result = await abTestingService.stopExperiment(
        req.params.id,
        `Winner declared: ${winningVariantId}`
      );
      return res.json({ success: true, data: result, winner: winningVariantId });
    } catch (error: unknown) {
      logger.error('[AB Testing API] Error declaring winner:', error);
      return res.status(500).json({
        error: 'Failed to declare winner',
        details: 'Unknown error',
      });
    }
  })
);

/**
 * POST /api/ai-ab-testing/record-outcome
 * Record experiment outcome (called internally by AI pipeline)
 */
router.post(
  '/record-outcome',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!abTestingService?.recordOutcome) {
      return serviceFallback(req, res);
    }

    try {
      const { experimentId, metric, value } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      if (!experimentId || !metric || value === undefined) {
        return res.status(400).json({ error: 'experimentId, metric, and value are required' });
      }

      await abTestingService.recordOutcome(experimentId, userId, metric, value);
      return res.json({ success: true });
    } catch (error: unknown) {
      logger.error('[AB Testing API] Error recording outcome:', error);
      return res.status(500).json({
        error: 'Failed to record outcome',
        details: 'Unknown error',
      });
    }
  })
);

export default router;
