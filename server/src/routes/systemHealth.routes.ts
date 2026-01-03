/**
 * SystemHealth Routes
 * API endpoints for system health monitoring
 * 
 * Fully migrated to TypeScript ES modules
 */

import { Router, Response } from 'express';
import { verifySuperAdmin, type AuthRequest } from '../middleware/superAdmin.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Service interfaces
interface SystemHealthServiceInterface {
    getDetailedHealth?: () => Promise<unknown>;
    getMetrics?: () => Promise<unknown>;
    getServiceStatus?: () => Promise<unknown>;
}

// Dynamic import for SystemHealthService (may not be migrated yet)
let SystemHealthService: SystemHealthServiceInterface | null = null;

try {
    const healthModule = await import('../../services/systemHealthService.js');
    SystemHealthService = (healthModule.default || healthModule) as SystemHealthServiceInterface;
} catch {
    console.warn('[SystemHealth Routes] SystemHealthService not available');
}

/**
 * GET /api/system-health
 * Basic health check (public)
 */
router.get('/', asyncHandler(async (_req, res: Response) => {
    if (!SystemHealthService?.getDetailedHealth) {
        return res.status(503).json({ error: 'System health service not available' });
    }

    try {
        const health = await SystemHealthService.getDetailedHealth();
        res.json(health);
    } catch (error: unknown) {
        console.error('[SystemHealth] Error:', error);
        res.status(500).json({ error: 'Health check failed' });
    }
}));

/**
 * GET /api/system-health/detailed
 * Detailed health check (SuperAdmin only)
 */
router.get('/detailed', verifySuperAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
    if (!SystemHealthService?.getDetailedHealth) {
        return res.status(503).json({ error: 'System health service not available' });
    }

    try {
        const health = await SystemHealthService.getDetailedHealth();
        res.json(health);
    } catch (error: unknown) {
        console.error('[SystemHealth] Error:', error);
        res.status(500).json({ error: 'Health check failed' });
    }
}));

/**
 * GET /api/system-health/metrics
 * Get system metrics (SuperAdmin only)
 */
router.get('/metrics', verifySuperAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
    if (!SystemHealthService?.getMetrics) {
        return res.status(503).json({ error: 'System health service not available' });
    }

    try {
        const metrics = await SystemHealthService.getMetrics();
        res.json(metrics);
    } catch (error: unknown) {
        console.error('[SystemHealth] Error fetching metrics:', error);
        res.status(500).json({ error: 'Failed to fetch system metrics' });
    }
}));

/**
 * GET /api/system-health/services
 * Get service status (SuperAdmin only)
 */
router.get('/services', verifySuperAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
    if (!SystemHealthService?.getServiceStatus) {
        return res.status(503).json({ error: 'System health service not available' });
    }

    try {
        const status = await SystemHealthService.getServiceStatus();
        res.json(status);
    } catch (error: unknown) {
        console.error('[SystemHealth] Error fetching service status:', error);
        res.status(500).json({ error: 'Failed to fetch service status' });
    }
}));

/**
 * POST /api/system-health/refresh
 * Force refresh health data (SuperAdmin only)
 */
router.post('/refresh', verifySuperAdmin, asyncHandler(async (_req: AuthRequest, res: Response) => {
    if (!SystemHealthService?.getDetailedHealth) {
        return res.status(503).json({ error: 'System health service not available' });
    }

    try {
        const health = await SystemHealthService.getDetailedHealth();
        res.json(health);
    } catch (error: unknown) {
        console.error('[SystemHealth] Error refreshing:', error);
        res.status(500).json({ error: 'Failed to refresh health data' });
    }
}));

export default router;
