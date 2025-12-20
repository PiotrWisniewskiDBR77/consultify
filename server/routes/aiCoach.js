const express = require('express');
const router = express.Router();
const AICoach = require('../ai/aiCoach');
// Assuming userMiddleware or similar exists for auth
// For this demo, we'll use a simple mock-up of auth check if not already implemented globally

/**
 * @route GET /api/ai/coach/report/:orgId
 * @desc Get full advisory report for an organization
 * @access Private (Admin / SuperAdmin)
 */
router.get('/report/:orgId', async (req, res) => {
    try {
        const { orgId } = req.params;

        // RBAC Check (Placeholder - should use real middleware)
        // Only allow if user belongs to org or is SUPERADMIN
        if (req.user && req.user.role !== 'SUPERADMIN' && req.user.organization_id !== orgId) {
            return res.status(403).json({ error: 'Access denied: Organization mismatch' });
        }

        const report = await AICoach.getAdvisoryReport(orgId);
        res.json(report);
    } catch (err) {
        console.error('[AICoachRoute] Error:', err);
        res.status(500).json({ error: 'Failed to generate advisory report' });
    }
});

/**
 * @route GET /api/ai/coach/signals/:orgId
 * @desc Get only signals for an organization
 */
router.get('/signals/:orgId', async (req, res) => {
    try {
        const { orgId } = req.params;
        const report = await AICoach.getAdvisoryReport(orgId);
        res.json({ signals: report.signals });
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch signals' });
    }
});

module.exports = router;
