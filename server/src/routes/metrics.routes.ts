/**
 * Metrics Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * Prometheus metrics endpoint
 * GET /metrics - Returns metrics in Prometheus format
 */

import { Router } from 'express';

import { getMetricsService } from '../services/MetricsService.js';

const router = Router();

// ==========================================
// METRICS ENDPOINT
// ==========================================

/**
 * GET /metrics
 * Prometheus metrics endpoint
 * Optionally protected with basic auth in production
 */
router.get('/', async (_req, res) => {
    try {
        const metricsService = getMetricsService();
        const metrics = await metricsService.getMetrics();

        res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
        res.send(metrics);
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        console.error('[MetricsRoutes] Error generating metrics:', err);
        res.status(500).send(`# Error generating metrics: ${err.message}\n`);
    }
});

export default router;
