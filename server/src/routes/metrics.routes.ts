import { Router } from 'express';

import { defaultRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { getMetricsService } from '../services/metricsService.js';
import logger from '../utils/Logger.js';
// Import legacy router
// @ts-ignore
// // import legacyMetricsRouter from "./metrics.js";

const legacyMetricsRouter = Router(); // Stubbed legacy router

const router = Router();

// Apply rate limiting
router.use(defaultRateLimiter);

// ==========================================
// PROMETHEUS METRICS ENDPOINT
// ==========================================

/**
 * GET /api/metrics/
 * Prometheus metrics endpoint
 */
router.get('/', async (_req, res) => {
    try {
        const metricsService = getMetricsService();
        const metrics = await metricsService.getMetrics();

        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        return res.send(metrics);
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('[MetricsRoutes] Error generating metrics:', err);
        return res.status(500).send(`# Error generating metrics: ${err.message}\n`);
    }
});

// ==========================================
// BUSINESS METRICS ENDPOINTS (Legacy)
// ==========================================

router.use('/', legacyMetricsRouter);

export default router;
