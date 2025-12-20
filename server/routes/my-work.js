// My Work Routes - Execution hub
// Step 5: Execution Control, My Work & Notifications

const express = require('express');
const router = express.Router();
const MyWorkService = require('../services/myWorkService');
const ExecutionMonitorService = require('../services/executionMonitorService');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/my-work
router.get('/', verifyToken, async (req, res) => {
    try {
        const myWork = await MyWorkService.getMyWork(req.userId, req.organizationId);
        res.json(myWork);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/my-work/tasks
router.get('/tasks', verifyToken, async (req, res) => {
    try {
        const tasks = await MyWorkService._getMyTasks(req.userId);
        res.json(tasks);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/my-work/initiatives
router.get('/initiatives', verifyToken, async (req, res) => {
    try {
        const initiatives = await MyWorkService._getMyInitiatives(req.userId);
        res.json(initiatives);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/my-work/decisions
router.get('/decisions', verifyToken, async (req, res) => {
    try {
        const decisions = await MyWorkService._getMyDecisions(req.userId);
        res.json(decisions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/my-work/alerts
router.get('/alerts', verifyToken, async (req, res) => {
    try {
        const alerts = await MyWorkService._getMyAlerts(req.userId);
        res.json(alerts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/my-work/execution-summary/:projectId (PMO/Admin view)
router.get('/execution-summary/:projectId', verifyToken, async (req, res) => {
    try {
        const summary = await ExecutionMonitorService.generateExecutionSummary(req.params.projectId);
        res.json(summary);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/my-work/monitor/:projectId (Run daily monitor)
router.post('/monitor/:projectId', verifyToken, async (req, res) => {
    if (!req.can('edit_project_settings')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        const result = await ExecutionMonitorService.runDailyMonitor(req.params.projectId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
