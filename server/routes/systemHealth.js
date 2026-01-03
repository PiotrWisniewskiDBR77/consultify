import express from 'express';
const router = express.Router();
const SystemHealthService = import('systemHealthService.js');
const metricsService = import('metricsService.js');
import verifySuperAdmin from '../middleware/superAdminMiddleware.js';

/**
 * GET /api/system-health
 * Basic health check
 */
router.get('/', async (req, res) => {
    try {
        const health = await SystemHealthService.getDetailedHealth();
        res.json(health);
    } catch (error) {
        console.error('[SystemHealth] Error:', error);
        res.status(500).json({ error: 'Health check failed' });
    }
});

/**
 * GET /api/system-health/detailed
 * Detailed health check (SuperAdmin only)
 */
router.get('/detailed', verifySuperAdmin, async (req, res) => {
    try {
        const health = await SystemHealthService.getDetailedHealth();
        res.json(health);
    } catch (error) {
        console.error('[SystemHealth] Error:', error);
        res.status(500).json({ error: 'Health check failed' });
    }
});

/**
 * GET /api/system-health/metrics
 * Get system metrics
 */
router.get('/metrics', verifySuperAdmin, async (req, res) => {
    try {
        const metrics = await SystemHealthService.getMetrics();
        res.json(metrics);
    } catch (error) {
        console.error('[SystemHealth] Error fetching metrics:', error);
        res.status(500).json({ error: 'Failed to fetch system metrics' });
    }
});

/**
 * GET /api/system-health/services
 * Get service status
 */
router.get('/services', verifySuperAdmin, async (req, res) => {
    try {
        const status = await SystemHealthService.getServiceStatus();
        res.json(status);
    } catch (error) {
        console.error('[SystemHealth] Error fetching service status:', error);
        res.status(500).json({ error: 'Failed to fetch service status' });
    }
});

/**
 * POST /api/system-health/refresh
 * Force refresh health data
 */
router.post('/refresh', verifySuperAdmin, async (req, res) => {
    try {
        const health = await SystemHealthService.getDetailedHealth();
        res.json(health);
    } catch (error) {
        console.error('[SystemHealth] Error refreshing:', error);
        res.status(500).json({ error: 'Failed to refresh health data' });
    }
});

export default router;
