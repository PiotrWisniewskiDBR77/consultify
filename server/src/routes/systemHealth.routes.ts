/**
 * SystemHealth Routes
 * API endpoints for system health monitoring
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { verifySuperAdmin } from '../middleware/superAdmin.middleware.js';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

import SystemHealthService from '../../services/systemHealthService.js';

/**
 * GET /api/system-health
 * Basic health check (public)
 */
router.get(
    '/',
    asyncHandler(async (_req, res: Response) => {
        if (!SystemHealthService?.getDetailedHealth) {
            return res.status(503).json({ error: 'System health service not available' });
        }

        try {
            const health = await SystemHealthService.getDetailedHealth();
            res.json(health);
        } catch (error: unknown) {
            console.error('[SystemHealth] Error:', error);
            return res.status(500).json({ error: 'Health check failed' });
        }
    }),
);

/**
 * GET /api/system-health/detailed
 * Detailed health check (SuperAdmin only)
 */
router.get(
    '/detailed',
    verifySuperAdmin,
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        if (!SystemHealthService?.getDetailedHealth) {
            return res.status(503).json({ error: 'System health service not available' });
        }

        try {
            const health = await SystemHealthService.getDetailedHealth();
            res.json(health);
        } catch (error: unknown) {
            console.error('[SystemHealth] Error:', error);
            return res.status(500).json({ error: 'Health check failed' });
        }
    }),
);

/**
 * GET /api/system-health/metrics
 * Get system metrics (SuperAdmin only)
 */
router.get(
    '/metrics',
    verifySuperAdmin,
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        if (!SystemHealthService?.getMetrics) {
            return res.status(503).json({ error: 'System health service not available' });
        }

        try {
            const metrics = await SystemHealthService.getMetrics();
            res.json(metrics);
        } catch (error: unknown) {
            console.error('[SystemHealth] Error fetching metrics:', error);
            return res.status(500).json({ error: 'Failed to fetch system metrics' });
        }
    }),
);

/**
 * GET /api/system-health/services
 * Get service status (SuperAdmin only)
 */
router.get(
    '/services',
    verifySuperAdmin,
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        if (!SystemHealthService?.getServiceStatus) {
            return res.status(503).json({ error: 'System health service not available' });
        }

        try {
            const status = await SystemHealthService.getServiceStatus();
            res.json(status);
        } catch (error: unknown) {
            console.error('[SystemHealth] Error fetching service status:', error);
            return res.status(500).json({ error: 'Failed to fetch service status' });
        }
    }),
);

/**
 * POST /api/system-health/refresh
 * Force refresh health data (SuperAdmin only)
 */
router.post(
    '/refresh',
    verifySuperAdmin,
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        if (!SystemHealthService?.getDetailedHealth) {
            return res.status(503).json({ error: 'System health service not available' });
        }

        try {
            const health = await SystemHealthService.getDetailedHealth();
            res.json(health);
        } catch (error: unknown) {
            console.error('[SystemHealth] Error refreshing:', error);
            return res.status(500).json({ error: 'Failed to refresh health data' });
        }
    }),
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
            const { KeyManagementService, getCurrentKeyVersion } = await import('../services/encryption/index.js');
            
            const health = KeyManagementService.checkHealth();
            const keyStatus = KeyManagementService.getKeyStatus();
            const currentVersion = getCurrentKeyVersion();
            
            res.json({
                healthy: health.healthy,
                currentKeyVersion: currentVersion,
                keyStatus,
                issues: health.issues,
                recommendations: health.recommendations,
                timestamp: new Date().toISOString(),
            });
        } catch (error: unknown) {
            console.error('[SystemHealth] Encryption health check error:', error);
            return res.status(500).json({ 
                error: 'Encryption health check failed',
                healthy: false,
            });
        }
    }),
);

export default router;
