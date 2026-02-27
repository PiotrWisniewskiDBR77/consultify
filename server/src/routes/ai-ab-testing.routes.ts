/**
 * AI A/B Testing Routes
 * API endpoints for managing A/B test experiments
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

const serviceFallback = (req: AuthRequest, res: Response, readPayload?: Record<string, unknown>) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.status(200).json({
      success: true,
      status: 'not_configured',
      feature: 'ai-ab-testing',
      writable: false,
      ...(readPayload || {}),
    });
  }
  return res.status(501).json({
    success: false,
    error: 'Feature not configured in this deployment',
    code: 'FEATURE_NOT_CONFIGURED',
    feature: 'ai-ab-testing',
    writable: false,
  });
};

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
  getExperimentStats?: (id: string) => Promise<unknown>;
  startExperiment?: (id: string, userId: string) => Promise<unknown>;
  stopExperiment?: (id: string, reason: string) => Promise<unknown>;
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
  const abTestingModule = await import('../../services/ai/abTesting.js');
  const module = abTestingModule.default || abTestingModule;
  abTestingService = (module.abTestingService || module) as ABTestingServiceInterface;
} catch {
  console.warn('[AI AB Testing Routes] abTestingService not available');
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

      res.json({
        success: true,
        data: experiments.map((e) => ({
          ...e,
          variants: JSON.parse((e.variants as string) || '[]'),
          traffic_split: JSON.parse((e.traffic_split as string) || '[]'),
        })),
      });
    } catch (error: unknown) {
      console.error('[AB Testing API] Error listing experiments:', error);
      return res.status(500).json({
        error: 'Failed to list experiments',
        details: error instanceof Error ? error.message : 'Unknown error',
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

      res.status(201).json({ success: true, data: result });
    } catch (error: unknown) {
      console.error('[AB Testing API] Error creating experiment:', error);
      return res.status(500).json({
        error: 'Failed to create experiment',
        details: error instanceof Error ? error.message : 'Unknown error',
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
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const stats = await abTestingService.getExperimentStats(id);
      res.json({ success: true, data: stats });
    } catch (error: unknown) {
      console.error('[AB Testing API] Error getting experiment:', error);
      return res.status(500).json({
        error: 'Failed to get experiment',
        details: error instanceof Error ? error.message : 'Unknown error',
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

      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await abTestingService.startExperiment(id, userId);
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      console.error('[AB Testing API] Error starting experiment:', error);
      return res.status(500).json({
        error: 'Failed to start experiment',
        details: error instanceof Error ? error.message : 'Unknown error',
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
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      const result = await abTestingService.stopExperiment(id, reason);
      res.json({ success: true, data: result });
    } catch (error: unknown) {
      console.error('[AB Testing API] Error stopping experiment:', error);
      return res.status(500).json({
        error: 'Failed to stop experiment',
        details: error instanceof Error ? error.message : 'Unknown error',
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
      res.json({ success: true });
    } catch (error: unknown) {
      console.error('[AB Testing API] Error recording outcome:', error);
      return res.status(500).json({
        error: 'Failed to record outcome',
        details: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  })
);

export default router;
