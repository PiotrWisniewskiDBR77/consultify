// Reports Routes - Executive reporting
// Step 6: Stabilization, Reporting & Economics

const express = require('express');
const router = express.Router();
const ReportingService = require('../services/reportingService');
const NarrativeService = require('../services/narrativeService');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/reports/executive-overview
router.get('/executive-overview', verifyToken, async (req, res) => {
    try {
        const report = await ReportingService.generateExecutiveOverview(req.organizationId, req.userId);
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/project-health/:projectId
router.get('/project-health/:projectId', verifyToken, async (req, res) => {
    try {
        const report = await ReportingService.generateProjectHealthReport(req.params.projectId, req.userId);
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/governance/:projectId
router.get('/governance/:projectId', verifyToken, async (req, res) => {
    try {
        const report = await ReportingService.generateGovernanceReport(req.params.projectId, req.userId);
        res.json(report);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== NARRATIVES ====================

// GET /api/reports/narrative/weekly/:projectId
router.get('/narrative/weekly/:projectId', verifyToken, async (req, res) => {
    try {
        const narrative = await NarrativeService.generateWeeklySummary(req.params.projectId);
        res.json(narrative);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/narrative/memo/:projectId
router.get('/narrative/memo/:projectId', verifyToken, async (req, res) => {
    const { topic } = req.query;
    try {
        const narrative = await NarrativeService.generateExecutiveMemo(req.params.projectId, topic);
        res.json(narrative);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/reports/narrative/progress/:projectId
router.get('/narrative/progress/:projectId', verifyToken, async (req, res) => {
    try {
        const narrative = await NarrativeService.generateProgressNarrative(req.params.projectId);
        res.json(narrative);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
