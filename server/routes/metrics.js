/**
 * Metrics API Routes
 * 
 * STEP 7: Metrics & Conversion Intelligence (Enterprise+)
 * 
 * Provides read-only API endpoints for metrics dashboards:
 * - SuperAdmin: Global metrics, funnels, warnings
 * - Admin: Organization-scoped metrics
 * 
 * RBAC:
 * - Admin can only see their own organization's data
 * - SuperAdmin can see everything
 * 
 * @module routes/metrics
 */

const express = require('express');
const router = express.Router();
const MetricsCollector = require('../services/metricsCollector');
const MetricsAggregator = require('../services/metricsAggregator');
const verifyToken = require('../middleware/authMiddleware');
const verifySuperAdmin = require('../middleware/superAdminMiddleware');

// ==========================================
// SUPERADMIN ENDPOINTS (Global Metrics)
// ==========================================

/**
 * GET /api/metrics/overview
 * 
 * Returns a complete metrics overview for SuperAdmin dashboard
 */
router.get('/overview', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const overview = await MetricsAggregator.getOverview();
        res.json(overview);
    } catch (err) {
        console.error('[Metrics] Overview error:', err.message);
        res.status(500).json({ error: 'Failed to fetch metrics overview' });
    }
});

/**
 * GET /api/metrics/funnels
 * 
 * Returns all funnel metrics with optional filtering
 */
router.get('/funnels', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { days = 30 } = req.query;

        const [
            demoToTrial,
            trialToPaid,
            helpCompletion,
            inviteAcceptance
        ] = await Promise.all([
            MetricsAggregator.getFunnel(
                MetricsCollector.EVENT_TYPES.DEMO_STARTED,
                MetricsCollector.EVENT_TYPES.TRIAL_STARTED,
                { days: parseInt(days) }
            ),
            MetricsAggregator.getFunnel(
                MetricsCollector.EVENT_TYPES.TRIAL_STARTED,
                MetricsCollector.EVENT_TYPES.UPGRADED_TO_PAID,
                { days: parseInt(days) }
            ),
            MetricsAggregator.getFunnel(
                MetricsCollector.EVENT_TYPES.HELP_STARTED,
                MetricsCollector.EVENT_TYPES.HELP_COMPLETED,
                { days: parseInt(days) }
            ),
            MetricsAggregator.getFunnel(
                MetricsCollector.EVENT_TYPES.INVITE_SENT,
                MetricsCollector.EVENT_TYPES.INVITE_ACCEPTED,
                { days: parseInt(days) }
            )
        ]);

        res.json({
            period: `${days} days`,
            funnels: {
                demoToTrial: {
                    name: 'Demo → Trial',
                    ...demoToTrial
                },
                trialToPaid: {
                    name: 'Trial → Paid',
                    ...trialToPaid
                },
                helpCompletion: {
                    name: 'Help Started → Completed',
                    ...helpCompletion
                },
                inviteAcceptance: {
                    name: 'Invite Sent → Accepted',
                    ...inviteAcceptance
                }
            }
        });
    } catch (err) {
        console.error('[Metrics] Funnels error:', err.message);
        res.status(500).json({ error: 'Failed to fetch funnels' });
    }
});

/**
 * GET /api/metrics/cohorts
 * 
 * Returns cohort analysis data
 */
router.get('/cohorts', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { type = 'weekly', weeks = 12 } = req.query;
        const cohorts = await MetricsAggregator.getCohortAnalysis(type, { weeks: parseInt(weeks) });
        res.json({ type, weeks, cohorts });
    } catch (err) {
        console.error('[Metrics] Cohorts error:', err.message);
        res.status(500).json({ error: 'Failed to fetch cohort analysis' });
    }
});

/**
 * GET /api/metrics/help
 * 
 * Returns help/playbook effectiveness metrics
 */
router.get('/help', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        const helpMetrics = await MetricsAggregator.getHelpEffectiveness({ days: parseInt(days) });
        res.json(helpMetrics);
    } catch (err) {
        console.error('[Metrics] Help metrics error:', err.message);
        res.status(500).json({ error: 'Failed to fetch help metrics' });
    }
});

/**
 * GET /api/metrics/attribution
 * 
 * Returns attribution channel performance metrics
 */
router.get('/attribution', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { days = 30 } = req.query;

        // Get events by source for key event types
        const [trialsBySource, conversionsBySource] = await Promise.all([
            MetricsCollector.getEventsBySource(MetricsCollector.EVENT_TYPES.TRIAL_STARTED, {
                startDate: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString()
            }),
            MetricsCollector.getEventsBySource(MetricsCollector.EVENT_TYPES.UPGRADED_TO_PAID, {
                startDate: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString()
            })
        ]);

        // Build attribution summary
        const attribution = trialsBySource.map(source => {
            const conversions = conversionsBySource.find(c => c.source === source.source);
            return {
                source: source.source || 'DIRECT',
                trials: source.count,
                uniqueOrgs: source.unique_orgs,
                conversions: conversions?.count || 0,
                conversionRate: source.count > 0
                    ? Math.round(((conversions?.count || 0) / source.count) * 100 * 100) / 100
                    : 0
            };
        });

        res.json({
            period: `${days} days`,
            channels: attribution,
            summary: {
                totalSources: attribution.length,
                totalTrials: attribution.reduce((sum, a) => sum + a.trials, 0),
                totalConversions: attribution.reduce((sum, a) => sum + a.conversions, 0)
            }
        });
    } catch (err) {
        console.error('[Metrics] Attribution error:', err.message);
        res.status(500).json({ error: 'Failed to fetch attribution metrics' });
    }
});

/**
 * GET /api/metrics/partners
 * 
 * Returns partner performance leaderboard
 */
router.get('/partners', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { days = 90, limit = 20 } = req.query;
        const partners = await MetricsAggregator.getPartnerPerformance({
            days: parseInt(days),
            limit: parseInt(limit)
        });

        res.json({
            period: `${days} days`,
            leaderboard: partners
        });
    } catch (err) {
        console.error('[Metrics] Partners error:', err.message);
        res.status(500).json({ error: 'Failed to fetch partner metrics' });
    }
});

/**
 * GET /api/metrics/warnings
 * 
 * Returns early warning system alerts
 */
router.get('/warnings', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const warnings = await MetricsAggregator.getEarlyWarnings();

        // Group by severity
        const bySeverity = warnings.reduce((acc, warning) => {
            const key = warning.severity;
            if (!acc[key]) acc[key] = [];
            acc[key].push(warning);
            return acc;
        }, {});

        res.json({
            totalWarnings: warnings.length,
            bySeverity,
            warnings
        });
    } catch (err) {
        console.error('[Metrics] Warnings error:', err.message);
        res.status(500).json({ error: 'Failed to fetch warnings' });
    }
});

/**
 * GET /api/metrics/events
 * 
 * Returns raw events with filtering (for debugging/audit)
 */
router.get('/events', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { type, days = 7, limit = 100, offset = 0 } = req.query;

        if (!type) {
            return res.status(400).json({ error: 'Event type is required' });
        }

        const events = await MetricsCollector.getEvents(type, {
            startDate: new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000).toISOString(),
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({
            eventType: type,
            period: `${days} days`,
            count: events.length,
            events
        });
    } catch (err) {
        console.error('[Metrics] Events error:', err.message);
        res.status(500).json({ error: 'Failed to fetch events' });
    }
});

/**
 * GET /api/metrics/snapshots
 * 
 * Returns historical snapshots for a metric
 */
router.get('/snapshots', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { key, startDate, endDate, limit = 30 } = req.query;

        if (!key) {
            return res.status(400).json({ error: 'Metric key is required' });
        }

        const snapshots = await MetricsAggregator.getSnapshots(key, {
            startDate,
            endDate,
            limit: parseInt(limit)
        });

        res.json({
            metricKey: key,
            snapshots
        });
    } catch (err) {
        console.error('[Metrics] Snapshots error:', err.message);
        res.status(500).json({ error: 'Failed to fetch snapshots' });
    }
});

/**
 * POST /api/metrics/snapshots/build
 * 
 * Manually trigger snapshot generation (for testing/recovery)
 */
router.post('/snapshots/build', verifyToken, verifySuperAdmin, async (req, res) => {
    try {
        const { date } = req.body;
        const result = await MetricsAggregator.buildDailySnapshots(date);
        res.json(result);
    } catch (err) {
        console.error('[Metrics] Snapshot build error:', err.message);
        res.status(500).json({ error: 'Failed to build snapshots' });
    }
});

// ==========================================
// ADMIN ENDPOINTS (Organization-Scoped)
// ==========================================

/**
 * GET /api/metrics/org/overview
 * 
 * Returns metrics overview for the current user's organization
 */
router.get('/org/overview', verifyToken, async (req, res) => {
    try {
        const organizationId = req.user.organizationId;

        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID not found' });
        }

        const metrics = await MetricsAggregator.getOrganizationMetrics(organizationId);
        res.json(metrics);
    } catch (err) {
        console.error('[Metrics] Org overview error:', err.message);
        res.status(500).json({ error: 'Failed to fetch organization metrics' });
    }
});

/**
 * GET /api/metrics/org/help
 * 
 * Returns help usage metrics for the current user's organization
 */
router.get('/org/help', verifyToken, async (req, res) => {
    try {
        const organizationId = req.user.organizationId;

        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID not found' });
        }

        // Get help events for this org
        const events = await MetricsCollector.getOrganizationEvents(organizationId, {
            eventTypes: [
                MetricsCollector.EVENT_TYPES.HELP_STARTED,
                MetricsCollector.EVENT_TYPES.HELP_COMPLETED
            ],
            limit: 100
        });

        // Group by playbook
        const byPlaybook = events.reduce((acc, event) => {
            const key = event.context?.playbookKey || 'unknown';
            if (!acc[key]) {
                acc[key] = { started: 0, completed: 0 };
            }
            if (event.event_type === MetricsCollector.EVENT_TYPES.HELP_STARTED) {
                acc[key].started++;
            } else if (event.event_type === MetricsCollector.EVENT_TYPES.HELP_COMPLETED) {
                acc[key].completed++;
            }
            return acc;
        }, {});

        res.json({
            organizationId,
            totalEvents: events.length,
            byPlaybook: Object.entries(byPlaybook).map(([key, stats]) => ({
                playbookKey: key,
                ...stats,
                completionRate: stats.started > 0
                    ? Math.round((stats.completed / stats.started) * 100)
                    : 0
            })),
            recentEvents: events.slice(0, 20)
        });
    } catch (err) {
        console.error('[Metrics] Org help error:', err.message);
        res.status(500).json({ error: 'Failed to fetch organization help metrics' });
    }
});

/**
 * GET /api/metrics/org/team
 * 
 * Returns team adoption metrics for the current user's organization
 */
router.get('/org/team', verifyToken, async (req, res) => {
    try {
        const organizationId = req.user.organizationId;

        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID not found' });
        }

        // Get invitation events for this org
        const events = await MetricsCollector.getOrganizationEvents(organizationId, {
            eventTypes: [
                MetricsCollector.EVENT_TYPES.INVITE_SENT,
                MetricsCollector.EVENT_TYPES.INVITE_ACCEPTED
            ],
            limit: 100
        });

        const sent = events.filter(e => e.event_type === MetricsCollector.EVENT_TYPES.INVITE_SENT).length;
        const accepted = events.filter(e => e.event_type === MetricsCollector.EVENT_TYPES.INVITE_ACCEPTED).length;

        res.json({
            organizationId,
            invitations: {
                sent,
                accepted,
                pending: sent - accepted,
                acceptanceRate: sent > 0 ? Math.round((accepted / sent) * 100) : 0
            },
            recentInviteEvents: events.slice(0, 20)
        });
    } catch (err) {
        console.error('[Metrics] Org team error:', err.message);
        res.status(500).json({ error: 'Failed to fetch organization team metrics' });
    }
});

/**
 * GET /api/metrics/org/events
 * 
 * Returns all metric events for the current user's organization
 */
router.get('/org/events', verifyToken, async (req, res) => {
    try {
        const organizationId = req.user.organizationId;
        const { limit = 50 } = req.query;

        if (!organizationId) {
            return res.status(400).json({ error: 'Organization ID not found' });
        }

        const events = await MetricsCollector.getOrganizationEvents(organizationId, {
            limit: parseInt(limit)
        });

        res.json({
            organizationId,
            count: events.length,
            events
        });
    } catch (err) {
        console.error('[Metrics] Org events error:', err.message);
        res.status(500).json({ error: 'Failed to fetch organization events' });
    }
});

module.exports = router;
