/**
 * Megatrend Routes
 * API endpoints for the Megatrend Scanner module
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { megatrendService } from '../services/megatrendService.js';
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

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/megatrends/baseline
 * Get baseline trends for industry
 */
router.get(
  '/baseline',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!megatrendService) {
      return notConfigured(res);
    }

    try {
      const industry = req.query.industry as string | undefined;
      const data = await megatrendService.getBaselineTrends(industry);
      return res.json(data);
    } catch (err: any) {
      const unavailable = respondIfUnavailable(res, err);
      if (unavailable) return unavailable;
      // Unexpected (not the known "not configured" path) — code + log with
      // correlationId, no err.message leak to the client.
      logger.error('[Megatrend] baseline error', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Nie udało się pobrać megatrendów', code: 'MEGATREND_BASELINE_FAILED' });
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
    if (!megatrendService) {
      return notConfigured(res);
    }

    try {
      const industry = req.query.industry as string | undefined;
      const data = await megatrendService.getRadarData(industry);
      return res.json(data);
    } catch (err: any) {
      const unavailable = respondIfUnavailable(res, err);
      if (unavailable) return unavailable;
      logger.error('[Megatrend] radar error', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Nie udało się pobrać danych radaru', code: 'MEGATREND_RADAR_FAILED' });
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
    if (!megatrendService) {
      return notConfigured(res);
    }

    try {
      const detail = await megatrendService.getTrendDetail(req.params.id);
      if (!detail) {
        return res.status(404).json({ error: 'Trend not found' });
      }
      return res.json(detail);
    } catch (err: any) {
      const unavailable = respondIfUnavailable(res, err);
      if (unavailable) return unavailable;
      logger.error('[Megatrend] detail error', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Nie udało się pobrać szczegółów trendu', code: 'MEGATREND_DETAIL_FAILED' });
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
    if (!megatrendService) {
      return notConfigured(res);
    }

    try {
      const companyId =
        (req.user as { companyId?: string; organizationId?: string })?.companyId ||
        req.user?.organizationId;
      if (!companyId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const created = await megatrendService.createCustomTrend(req.body, companyId);
      return res.status(201).json(created);
    } catch (err: any) {
      // Write — NEVER fail-soft. Code + log with correlationId, no err.message leak.
      logger.error('[Megatrend] create custom error', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Nie udało się utworzyć trendu', code: 'MEGATREND_CUSTOM_CREATE_FAILED' });
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
    if (!megatrendService) {
      return notConfigured(res);
    }

    try {
      const companyId =
        (req.user as { companyId?: string; organizationId?: string })?.companyId ||
        req.user?.organizationId;
      if (!companyId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const updated = await megatrendService.updateCustomTrend(req.params.id, req.body, companyId);
      if (!updated) {
        return res.status(404).json({ error: 'Custom trend not found' });
      }
      return res.json(updated);
    } catch (err: any) {
      // Write — NEVER fail-soft.
      logger.error('[Megatrend] update custom error', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Nie udało się zaktualizować trendu',
        code: 'MEGATREND_CUSTOM_UPDATE_FAILED',
      });
    }
  })
);

export default router;
