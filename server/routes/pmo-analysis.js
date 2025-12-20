// PMO Analysis Routes - AI-driven analysis
// Step 3: PMO Objects, Statuses & Stage Gates

const express = require('express');
const router = express.Router();
const PMOAnalysisService = require('../services/pmoAnalysisService');
const ProgressService = require('../services/progressService');
const DependencyService = require('../services/dependencyService');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/pmo-analysis/:projectId
router.get('/:projectId', verifyToken, async (req, res) => {
    try {
        const analysis = await PMOAnalysisService.analyzeProject(req.params.projectId);
        res.json(analysis);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pmo-analysis/:projectId/progress
router.get('/:projectId/progress', verifyToken, async (req, res) => {
    try {
        const progress = await ProgressService.calculateProjectProgress(req.params.projectId);
        res.json(progress);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pmo-analysis/:projectId/dependencies
router.get('/:projectId/dependencies', verifyToken, async (req, res) => {
    try {
        const graph = await DependencyService.buildDependencyGraph(req.params.projectId);
        const deadlocks = await DependencyService.detectDeadlocks(req.params.projectId);
        res.json({ ...graph, ...deadlocks });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/pmo-analysis/:projectId/dependencies
router.post('/:projectId/dependencies', verifyToken, async (req, res) => {
    const { fromInitiativeId, toInitiativeId, type } = req.body;

    if (!fromInitiativeId || !toInitiativeId) {
        return res.status(400).json({ error: 'Missing initiative IDs' });
    }

    try {
        const dependency = await DependencyService.addDependency(fromInitiativeId, toInitiativeId, type);
        res.status(201).json(dependency);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/pmo-analysis/dependencies/:id
router.delete('/dependencies/:id', verifyToken, async (req, res) => {
    try {
        const result = await DependencyService.removeDependency(req.params.id);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pmo-analysis/explain/:objectType/:objectId
router.get('/explain/:objectType/:objectId', verifyToken, async (req, res) => {
    try {
        const explanation = await PMOAnalysisService.explainBlocker(
            req.params.objectType.toUpperCase(),
            req.params.objectId
        );
        res.json(explanation);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/pmo-analysis/portfolio/:organizationId
router.get('/portfolio/:organizationId', verifyToken, async (req, res) => {
    try {
        const metrics = await ProgressService.calculatePortfolioMetrics(req.params.organizationId);
        res.json(metrics);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
