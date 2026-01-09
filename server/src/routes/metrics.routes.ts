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
 * Conversion funnel metrics - format matching frontend SuperAdminMetricsView
 */
router.get('/funnels', async (_req, res) => {
    try {
        // Data structure matching frontend expectations
        const data = {
            funnels: {
                trialToPaid: {
                    name: 'Trial → Paid',
                    conversionRate: 12.5,
                    startCount: 1000,
                    endCount: 125,
                },
                leadToTrial: {
                    name: 'Lead → Trial',
                    conversionRate: 45.2,
                    startCount: 2000,
                    endCount: 904,
                },
                demoToTrial: {
                    name: 'Demo → Trial',
                    conversionRate: 68.0,
                    startCount: 500,
                    endCount: 340,
                },
                visitToLead: {
                    name: 'Visit → Lead',
                    conversionRate: 8.5,
                    startCount: 10000,
                    endCount: 850,
                },
            },
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
 * Attribution channel metrics - format matching frontend SuperAdminMetricsView
 */
router.get('/attribution', async (_req, res) => {
    try {
        // Data structure matching frontend expectations
        const data = {
            channels: [
                { source: 'Direct', trials: 450, conversions: 85, conversionRate: 18.9 },
                { source: 'Organic Search', trials: 320, conversions: 45, conversionRate: 14.1 },
                { source: 'Referral', trials: 180, conversions: 32, conversionRate: 17.8 },
                { source: 'Paid Search', trials: 150, conversions: 18, conversionRate: 12.0 },
                { source: 'Social Media', trials: 95, conversions: 8, conversionRate: 8.4 },
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

/**
 * GET /api/metrics/warnings
 * Early warning signals for churn risk
 */
router.get('/warnings', async (_req, res) => {
    try {
        // TODO: In production, query from database for real warnings
        const data = {
            warnings: [
                // Example warnings - in production these would come from real analytics
                // { organizationName: 'Acme Corp', type: 'USAGE_DROP', severity: 'HIGH', message: 'Usage dropped 50% this week' },
            ],
        };
        return res.json(data);
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('[MetricsRoutes] Error fetching warnings:', err);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/metrics/partners
 * Partner/affiliate leaderboard metrics
 */
router.get('/partners', async (_req, res) => {
    try {
        // TODO: In production, query from partner_referrals table
        const data = {
            leaderboard: [
                // Example data - in production these would come from real partner data
                // { partnerName: 'TechPartner Inc', partnerType: 'RESELLER', totalRevenue: 15000, orgCount: 12 },
            ],
        };
        return res.json(data);
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('[MetricsRoutes] Error fetching partners:', err);
        return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /api/metrics/help
 * Help system effectiveness metrics (playbook completion)
 */
router.get('/help', async (_req, res) => {
    try {
        // TODO: In production, query from help_progress table
        const data = {
            byPlaybook: [
                { playbookKey: 'getting_started', started: 500, completed: 425, completionRate: 85 },
                { playbookKey: 'first_project', started: 400, completed: 280, completionRate: 70 },
                { playbookKey: 'team_setup', started: 200, completed: 140, completionRate: 70 },
                { playbookKey: 'integrations', started: 150, completed: 90, completionRate: 60 },
            ],
            totalStarted: 1250,
            totalCompleted: 935,
            overallCompletionRate: 74.8,
        };
        return res.json(data);
    } catch (error: unknown) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error('[MetricsRoutes] Error fetching help metrics:', err);
        return res.status(500).json({ error: err.message });
    }
});

// ==========================================
// BUSINESS METRICS ENDPOINTS (Legacy)
// ==========================================

router.use('/', legacyMetricsRouter);

export default router;
