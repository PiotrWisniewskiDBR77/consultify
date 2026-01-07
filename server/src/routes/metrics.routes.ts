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
// BUSINESS METRICS ENDPOINTS
// ==========================================

/**
 * GET /api/metrics/conversion-intelligence
 * Conversion intelligence metrics
 */
router.get('/conversion-intelligence', async (_req, res) => {
    try {
        // Mock data for conversion intelligence
        const data = {
            overallConversionRate: 12.5,
            trialToPaid: 8.3,
            leadToTrial: 45.2,
            trends: {
                last7Days: 11.8,
                last30Days: 12.1,
                last90Days: 13.2,
            },
            topPerformers: [
                { channel: 'Direct', rate: 18.5 },
                { channel: 'Referral', rate: 15.2 },
                { channel: 'Organic', rate: 10.8 },
            ],
        };
        return res.json(data);
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('[MetricsRoutes] Error fetching conversion intelligence:', err);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/metrics/funnels
 * Conversion funnel metrics
 */
router.get('/funnels', async (_req, res) => {
    try {
        // Mock data for funnels
        const data = {
            funnels: [
                {
                    name: 'Trial to Paid',
                    stages: [
                        { name: 'Trial Started', count: 1000, percentage: 100 },
                        { name: 'Activated', count: 750, percentage: 75 },
                        { name: 'Engaged', count: 500, percentage: 50 },
                        { name: 'Converted', count: 125, percentage: 12.5 },
                    ],
                },
                {
                    name: 'Lead to Trial',
                    stages: [
                        { name: 'Lead Captured', count: 2000, percentage: 100 },
                        { name: 'Qualified', count: 1200, percentage: 60 },
                        { name: 'Demo Scheduled', count: 800, percentage: 40 },
                        { name: 'Trial Started', count: 400, percentage: 20 },
                    ],
                },
            ],
        };
        return res.json(data);
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('[MetricsRoutes] Error fetching funnels:', err);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/metrics/attribution
 * Attribution channel metrics
 */
router.get('/attribution', async (_req, res) => {
    try {
        // Mock data for attribution
        const data = {
            channels: [
                { channel: 'Direct', trials: 450, paid: 85, conversionRate: 18.9 },
                { channel: 'Organic Search', trials: 320, paid: 45, conversionRate: 14.1 },
                { channel: 'Referral', trials: 180, paid: 32, conversionRate: 17.8 },
                { channel: 'Paid Search', trials: 150, paid: 18, conversionRate: 12.0 },
                { channel: 'Social', trials: 95, paid: 8, conversionRate: 8.4 },
            ],
            totalTrials: 1195,
            totalPaid: 188,
            overallConversionRate: 15.7,
        };
        return res.json(data);
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('[MetricsRoutes] Error fetching attribution:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ==========================================
// BUSINESS METRICS ENDPOINTS (Legacy)
// ==========================================

router.use('/', legacyMetricsRouter);

export default router;
