/**
 * AI Analytics Routes
 * Step 18: Outcomes, ROI & Continuous Learning Loop
 * 
 * API endpoints for AI analytics dashboard:
 * - Action success rates and approval breakdown
 * - Playbook completion rates and time-to-resolution
 * - Policy effectiveness and auto-approval rates
 * - ROI dashboard data
 * - Export functionality (CSV/JSON)
 */

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/authMiddleware');
const { verifyAdmin } = require('../middleware/adminMiddleware');
const AIAnalyticsService = require('../services/aiAnalyticsService');
const OutcomeService = require('../services/outcomeService');
const ROIService = require('../services/roiService');

// Apply authentication to all routes
router.use(verifyToken);

// ==========================================
// DASHBOARD SUMMARY
// ==========================================

/**
 * GET /api/analytics/ai/dashboard
 * Get complete dashboard summary for UI
 */
router.get('/dashboard', async (req, res) => {
    try {
        const orgId = req.user.organizationId || req.user.organization_id;
        const { from, to } = req.query;

        const summary = await AIAnalyticsService.getDashboardSummary(orgId, {
            from: from || null,
            to: to || null
        });

        res.json(summary);
    } catch (error) {
        console.error('[AI Analytics] Dashboard error:', error);
        res.status(500).json({ error: 'Failed to get dashboard data' });
    }
});

// ==========================================
// ACTION ANALYTICS
// ==========================================

/**
 * GET /api/analytics/ai/actions
 * Get action execution statistics
 */
router.get('/actions', async (req, res) => {
    try {
        const orgId = req.user.organizationId || req.user.organization_id;
        const { from, to } = req.query;

        const stats = await AIAnalyticsService.getActionStats(orgId, {
            from: from || null,
            to: to || null
        });

        res.json(stats);
    } catch (error) {
        console.error('[AI Analytics] Actions error:', error);
        res.status(500).json({ error: 'Failed to get action statistics' });
    }
});

/**
 * GET /api/analytics/ai/approvals
 * Get approval statistics (manual vs auto)
 */
router.get('/approvals', async (req, res) => {
    try {
        const orgId = req.user.organizationId || req.user.organization_id;
        const { from, to } = req.query;

        const stats = await AIAnalyticsService.getApprovalStats(orgId, {
            from: from || null,
            to: to || null
        });

        res.json(stats);
    } catch (error) {
        console.error('[AI Analytics] Approvals error:', error);
        res.status(500).json({ error: 'Failed to get approval statistics' });
    }
});

// ==========================================
// PLAYBOOK ANALYTICS
// ==========================================

/**
 * GET /api/analytics/ai/playbooks
 * Get playbook completion statistics
 */
router.get('/playbooks', async (req, res) => {
    try {
        const orgId = req.user.organizationId || req.user.organization_id;
        const { from, to } = req.query;

        const stats = await AIAnalyticsService.getPlaybookStats(orgId, {
            from: from || null,
            to: to || null
        });

        res.json(stats);
    } catch (error) {
        console.error('[AI Analytics] Playbooks error:', error);
        res.status(500).json({ error: 'Failed to get playbook statistics' });
    }
});

/**
 * GET /api/analytics/ai/time-to-resolution
 * Get time-to-resolution metrics
 */
router.get('/time-to-resolution', async (req, res) => {
    try {
        const orgId = req.user.organizationId || req.user.organization_id;
        const { from, to } = req.query;

        const stats = await AIAnalyticsService.getTimeToResolution(orgId, {
            from: from || null,
            to: to || null
        });

        res.json(stats);
    } catch (error) {
        console.error('[AI Analytics] Time-to-resolution error:', error);
        res.status(500).json({ error: 'Failed to get time-to-resolution data' });
    }
});

// ==========================================
// DEAD-LETTER & JOBS
// ==========================================

/**
 * GET /api/analytics/ai/dead-letter
 * Get dead-letter job statistics
 */
router.get('/dead-letter', async (req, res) => {
    try {
        const orgId = req.user.organizationId || req.user.organization_id;
        const { from, to } = req.query;

        const stats = await AIAnalyticsService.getDeadLetterStats(orgId, {
            from: from || null,
            to: to || null
        });

        res.json(stats);
    } catch (error) {
        console.error('[AI Analytics] Dead-letter error:', error);
        res.status(500).json({ error: 'Failed to get dead-letter statistics' });
    }
});

// ==========================================
// ROI ANALYTICS
// ==========================================

/**
 * GET /api/analytics/roi
 * Get ROI dashboard summary
 */
router.get('/roi', async (req, res) => {
    try {
        const orgId = req.user.organizationId || req.user.organization_id;
        const { from, to } = req.query;

        const roi = await AIAnalyticsService.getROISummary(orgId, {
            from: from || null,
            to: to || null
        });

        res.json(roi);
    } catch (error) {
        console.error('[AI Analytics] ROI error:', error);
        res.status(500).json({ error: 'Failed to get ROI data' });
    }
});

/**
 * GET /api/analytics/roi/hours-saved
 * Get detailed hours saved estimation
 */
router.get('/roi/hours-saved', async (req, res) => {
    try {
        const orgId = req.user.organizationId || req.user.organization_id;
        const { from, to } = req.query;

        const data = await ROIService.estimateHoursSaved(orgId, {
            from: from || null,
            to: to || null
        });

        res.json(data);
    } catch (error) {
        console.error('[AI Analytics] Hours saved error:', error);
        res.status(500).json({ error: 'Failed to get hours saved data' });
    }
});

/**
 * GET /api/analytics/roi/cost-reduction
 * Get detailed cost reduction estimation
 */
router.get('/roi/cost-reduction', async (req, res) => {
    try {
        const orgId = req.user.organizationId || req.user.organization_id;
        const { from, to } = req.query;

        const data = await ROIService.estimateCostReduction(orgId, {
            from: from || null,
            to: to || null
        });

        res.json(data);
    } catch (error) {
        console.error('[AI Analytics] Cost reduction error:', error);
        res.status(500).json({ error: 'Failed to get cost reduction data' });
    }
});

/**
 * GET /api/analytics/roi/models
 * Get ROI models for organization
 */
router.get('/roi/models', verifyAdmin, async (req, res) => {
    try {
        const orgId = req.user.organizationId || req.user.organization_id;

        const models = await ROIService.getModels(orgId);

        res.json({ models });
    } catch (error) {
        console.error('[AI Analytics] ROI models error:', error);
        res.status(500).json({ error: 'Failed to get ROI models' });
    }
});

/**
 * PUT /api/analytics/roi/models/:modelId
 * Update ROI model assumptions
 */
router.put('/roi/models/:modelId', verifyAdmin, async (req, res) => {
    try {
        const orgId = req.user.organizationId || req.user.organization_id;
        const { modelId } = req.params;
        const { name, description, assumptions, metric_mappings } = req.body;

        const result = await ROIService.updateModel(orgId, modelId, {
            name,
            description,
            assumptions,
            metric_mappings
        });

        res.json(result);
    } catch (error) {
        console.error('[AI Analytics] ROI model update error:', error);
        res.status(500).json({ error: 'Failed to update ROI model' });
    }
});

// ==========================================
// OUTCOMES
// ==========================================

/**
 * POST /api/analytics/outcomes/recompute
 * Trigger recomputation of outcome measurements
 */
router.post('/outcomes/recompute', verifyAdmin, async (req, res) => {
    try {
        const orgId = req.user.organizationId || req.user.organization_id;
        const { from, to } = req.query;

        const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const toDate = to || new Date().toISOString();

        const result = await OutcomeService.recompute(orgId, fromDate, toDate);

        res.json({
            message: `Recomputed ${result.processed} measurements`,
            ...result
        });
    } catch (error) {
        console.error('[AI Analytics] Recompute error:', error);
        res.status(500).json({ error: 'Failed to recompute outcomes' });
    }
});

/**
 * GET /api/analytics/outcomes/pending
 * Get pending measurements that need after-capture
 */
router.get('/outcomes/pending', verifyAdmin, async (req, res) => {
    try {
        const { limit = 100 } = req.query;

        const pending = await OutcomeService.getPendingMeasurements(parseInt(limit, 10));

        res.json({ pending, count: pending.length });
    } catch (error) {
        console.error('[AI Analytics] Pending outcomes error:', error);
        res.status(500).json({ error: 'Failed to get pending outcomes' });
    }
});

// ==========================================
// EXPORT
// ==========================================

/**
 * GET /api/analytics/ai/export
 * Export analytics data as CSV or JSON
 */
router.get('/export', async (req, res) => {
    try {
        const orgId = req.user.organizationId || req.user.organization_id;
        const { format = 'json', from, to } = req.query;

        const data = await AIAnalyticsService.exportData(orgId, format, {
            from: from || null,
            to: to || null
        });

        if (format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${data.filename}"`);
            return res.send(data.content);
        }

        res.json(data);
    } catch (error) {
        console.error('[AI Analytics] Export error:', error);
        res.status(500).json({ error: 'Failed to export analytics data' });
    }
});

module.exports = router;
