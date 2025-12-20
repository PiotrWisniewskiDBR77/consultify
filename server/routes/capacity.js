// Capacity Routes - Workload management
// Step 4: Roadmap, Sequencing & Capacity

const express = require('express');
const router = express.Router();
const CapacityService = require('../services/capacityService');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/capacity/user/:userId
router.get('/user/:userId', verifyToken, async (req, res) => {
    const { projectId } = req.query;
    try {
        const capacity = await CapacityService.calculateUserCapacity(req.params.userId, projectId);
        res.json(capacity);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/capacity/project/:projectId/overloads
router.get('/project/:projectId/overloads', verifyToken, async (req, res) => {
    try {
        const overloads = await CapacityService.detectOverloads(req.params.projectId);
        const suggestions = CapacityService.suggestResolutions(overloads);
        res.json({ ...overloads, suggestions });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/capacity/project/:projectId/summary
router.get('/project/:projectId/summary', verifyToken, async (req, res) => {
    try {
        const overloads = await CapacityService.detectOverloads(req.params.projectId);
        res.json({
            projectId: req.params.projectId,
            usersAnalyzed: overloads.totalUsersAnalyzed,
            overloadedUsers: overloads.overloadedUsers.length,
            sustainedOverloads: overloads.sustainedOverloads,
            status: overloads.sustainedOverloads > 0 ? 'CRITICAL' : (overloads.hasOverloads ? 'WARNING' : 'HEALTHY')
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
