// @ts-nocheck
/**
 * AnalyticsAdvanced Routes
 * API endpoints for advanced analytics
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { verifyAdmin } from '../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

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
interface CohortServiceInterface {
  getRetentionMatrix?: () => Promise<unknown>;
}

interface ExperimentServiceInterface {
  getAllUserExperiments?: (userId: string) => Promise<unknown>;
}

// Dynamic imports for services (may not be migrated yet)
const CohortService: CohortServiceInterface | null = null;
const ExperimentService: ExperimentServiceInterface | null = null;

// try {
//     const cohortModule = (await import('../services/cohortService.js')) as any;
//     CohortService = (cohortModule.default || cohortModule) as CohortServiceInterface;
// } catch {
//     logger.warn('[AnalyticsAdvanced Routes] CohortService not available');
// }

// try {
//     const experimentModule = (await import('../services/experimentService.js')) as any;
//     ExperimentService = (experimentModule.default || experimentModule) as ExperimentServiceInterface;
// } catch {
//     logger.warn('[AnalyticsAdvanced Routes] ExperimentService not available');
// }

/**
 * GET /api/analytics/cohorts
 * Cohort Matrix (Admin only)
 */
router.get(
  '/cohorts',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!CohortService?.getRetentionMatrix) {
      return serviceFallback(req, res, { matrix: [] });
    }

    try {
      const matrix = await CohortService.getRetentionMatrix();
      return res.json({ success: true, matrix });
    } catch (error: unknown) {
      logger.error('Cohort analysis error:', error);
      return res.status(500).json({ error: 'Unknown error' });
    }
  })
);

/**
 * GET /api/experiments/me
 * User's feature flags
 */
router.get(
  '/experiments/me',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!ExperimentService?.getAllUserExperiments) {
      return serviceFallback(req, res, { flags: [] });
    }

    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const flags = await ExperimentService.getAllUserExperiments(userId);
      return res.json({ success: true, flags });
    } catch (error: unknown) {
      logger.error('Experiment assignment error:', error);
      return res.status(500).json({ error: 'Unknown error' });
    }
  })
);

export default router;
