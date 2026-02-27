/**
 * SystemHealth Routes
 * API endpoints for system health monitoring
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest } from '../middleware/auth.middleware.js';
import { verifySuperAdmin } from '../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Apply rate limiting
router.use(defaultRateLimiter);

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import SystemHealthService from '../services/systemHealthService.js';
import logger from '../utils/Logger.js';

const serviceFallback = (
  req: AuthRequest,
  res: Response,
  readPayload?: Record<string, unknown>
) => {
  if (req.method === 'GET' || req.method === 'HEAD') {
    return res.status(200).json({
      success: true,
      status: 'not_configured',
      feature: 'system-health',
      writable: false,
      ...(readPayload || {}),
    });
  }
  return res.status(501).json({
    success: false,
    error: 'Feature not configured in this deployment',
    code: 'FEATURE_NOT_CONFIGURED',
    feature: 'system-health',
    writable: false,
  });
};

/**
 * GET /api/system-health
 * Basic health check (public)
 */
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!SystemHealthService?.getDetailedHealth) {
      return serviceFallback(req, res, { health: {} });
    }

    try {
      const health = await SystemHealthService.getDetailedHealth();
      return res.json(health);
    } catch (error: unknown) {
      logger.error('[SystemHealth] Error:', error);
      return res.status(500).json({ error: 'Health check failed' });
    }
  })
);

/**
 * GET /api/system-health/detailed
 * Detailed health check (SuperAdmin only)
 */
router.get(
  '/detailed',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!SystemHealthService?.getDetailedHealth) {
      return serviceFallback(req, res, { health: {} });
    }

    try {
      const health = await SystemHealthService.getDetailedHealth();
      return res.json(health);
    } catch (error: unknown) {
      logger.error('[SystemHealth] Error:', error);
      return res.status(500).json({ error: 'Health check failed' });
    }
  })
);

/**
 * GET /api/system-health/metrics
 * Get system metrics (SuperAdmin only)
 */
router.get(
  '/metrics',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!SystemHealthService?.getMetrics) {
      return serviceFallback(req, res, { metrics: {} });
    }

    try {
      const metrics = await SystemHealthService.getMetrics();
      return res.json(metrics);
    } catch (error: unknown) {
      logger.error('[SystemHealth] Error fetching metrics:', error);
      return res.status(500).json({ error: 'Failed to fetch system metrics' });
    }
  })
);

/**
 * GET /api/system-health/services
 * Get service status (SuperAdmin only)
 */
router.get(
  '/services',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!SystemHealthService?.getServiceStatus) {
      return serviceFallback(req, res, { services: [] });
    }

    try {
      const status = await SystemHealthService.getServiceStatus();
      return res.json(status);
    } catch (error: unknown) {
      logger.error('[SystemHealth] Error fetching service status:', error);
      return res.status(500).json({ error: 'Failed to fetch service status' });
    }
  })
);

/**
 * POST /api/system-health/refresh
 * Force refresh health data (SuperAdmin only)
 */
router.post(
  '/refresh',
  verifySuperAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!SystemHealthService?.getDetailedHealth) {
      return serviceFallback(req, res);
    }

    try {
      const health = await SystemHealthService.getDetailedHealth();
      return res.json(health);
    } catch (error: unknown) {
      logger.error('[SystemHealth] Error refreshing:', error);
      return res.status(500).json({ error: 'Failed to refresh health data' });
    }
  })
);

/**
 * GET /api/system-health/encryption
 * Encryption health check (SuperAdmin only)
 */
router.get(
  '/encryption',
  verifySuperAdmin,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    try {
      // Dynamic import to avoid circular dependencies
      const { KeyManagementService, getCurrentKeyVersion } =
        (await import('../services/encryption/index.js')) as any;

      const health = KeyManagementService.checkHealth();
      const keyStatus = KeyManagementService.getKeyStatus();
      const currentVersion = getCurrentKeyVersion();

      return res.json({
        healthy: health.healthy,
        currentKeyVersion: currentVersion,
        keyStatus,
        issues: health.issues,
        recommendations: health.recommendations,
        timestamp: new Date().toISOString(),
      });
    } catch (error: unknown) {
      logger.error('[SystemHealth] Encryption health check error:', error);
      return res.status(500).json({
        error: 'Encryption health check failed',
        healthy: false,
      });
    }
  })
);

export default router;
