/**
 * Megatrend Routes
 * API endpoints for the Megatrend Scanner module
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/ErrorHandler.js';
import logger from '../utils/Logger.js';

// Apply rate limiting
const router = Router();
const notConfigured = (res: Response) =>
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
    userMessage: 'Megatrends data is not yet configured for this environment.',
  });
const respondIfUnavailable = (res: Response, err: unknown) => {
  if (err instanceof AppError && err.code === 'FEATURE_UNAVAILABLE') {
    return notConfigured(res);
  }
  if ((err as any)?.code === 'FEATURE_UNAVAILABLE' || (err as any)?.statusCode === 503) {
    return notConfigured(res);
  }
  return null;
};

// Megatrend Service interface
interface MegatrendServiceInterface {
  getBaselineTrends?: (industry?: string) => Promise<unknown>;
  getRadarData?: (industry?: string) => Promise<unknown>;
  getTrendDetail?: (id: string) => Promise<unknown>;
  createCustomTrend?: (data: unknown, companyId: string) => Promise<unknown>;
  updateCustomTrend?: (id: string, data: unknown, companyId: string) => Promise<unknown>;
}

// Dynamic import for MegatrendService (may not be migrated yet)
let MegatrendService: MegatrendServiceInterface | null = null;

try {
  const megatrendModule = (await import('../models/megatrend.js')) as any;
  MegatrendService = (megatrendModule.default || megatrendModule) as MegatrendServiceInterface;
} catch {
  // Service may not exist or not migrated yet
  logger.warn('[Megatrend] Service not available');
}

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/megatrends/baseline
 * Get baseline trends for industry
 */
router.get(
  '/baseline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!MegatrendService?.getBaselineTrends) {
      return notConfigured(res);
    }

    try {
      const industry = req.query.industry as string | undefined;
      const data = await MegatrendService.getBaselineTrends(industry);
      return res.json(data);
    } catch (err: any) {
      logger.error('[Megatrend] baseline error', err);
      const unavailable = respondIfUnavailable(res, err);
      if (unavailable) return unavailable;
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  })
);

/**
 * GET /api/megatrends/radar
 * Get radar data for industry
 */
router.get(
  '/radar',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!MegatrendService?.getRadarData) {
      return notConfigured(res);
    }

    try {
      const industry = req.query.industry as string | undefined;
      const data = await MegatrendService.getRadarData(industry);
      return res.json(data);
    } catch (err: any) {
      logger.error('[Megatrend] radar error', err);
      const unavailable = respondIfUnavailable(res, err);
      if (unavailable) return unavailable;
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  })
);

/**
 * GET /api/megatrends/:id
 * Get trend detail by ID
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!MegatrendService?.getTrendDetail) {
      return notConfigured(res);
    }

    try {
      const detail = await MegatrendService.getTrendDetail(req.params.id);
      if (!detail) {
        return res.status(404).json({ error: 'Trend not found' });
      }
      return res.json(detail);
    } catch (err: any) {
      logger.error('[Megatrend] detail error', err);
      const unavailable = respondIfUnavailable(res, err);
      if (unavailable) return unavailable;
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  })
);

/**
 * POST /api/megatrends/custom
 * Create custom trend
 */
router.post(
  '/custom',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!MegatrendService?.createCustomTrend) {
      return notConfigured(res);
    }

    try {
      const companyId =
        (req.user as { companyId?: string; organizationId?: string })?.companyId ||
        req.user?.organizationId;
      if (!companyId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const created = await MegatrendService.createCustomTrend(req.body, companyId);
      return res.status(201).json(created);
    } catch (err: any) {
      logger.error('[Megatrend] create custom error', err);
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  })
);

/**
 * PUT /api/megatrends/custom/:id
 * Update custom trend
 */
router.put(
  '/custom/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!MegatrendService?.updateCustomTrend) {
      return notConfigured(res);
    }

    try {
      const companyId =
        (req.user as { companyId?: string; organizationId?: string })?.companyId ||
        req.user?.organizationId;
      if (!companyId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const updated = await MegatrendService.updateCustomTrend(req.params.id, req.body, companyId);
      if (!updated) {
        return res.status(404).json({ error: 'Custom trend not found' });
      }
      return res.json(updated);
    } catch (err: any) {
      logger.error('[Megatrend] update custom error', err);
      return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
  })
);

export default router;
