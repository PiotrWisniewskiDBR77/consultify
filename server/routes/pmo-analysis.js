// PMO Analysis Routes - AI-driven analysis
// Step 3: PMO Objects, Statuses & Stage Gates

const express = require('express');
const router = express.Router();
const PMOAnalysisService = require('../services/pmoAnalysisService');
const ProgressService = require('../services/progressService');
const DependencyService = require('../services/dependencyService');
const verifyToken = require('../middleware/authMiddleware');
const { asyncHandler } = require('../utils/errorHandler');

// GET /api/pmo-analysis/:projectId
// REFACTORED: Uses asyncHandler
router.get('/:projectId', verifyToken, asyncHandler(async (req, res) => {
    const analysis = await PMOAnalysisService.analyzeProject(req.params.projectId);
    res.json(analysis);
}));

// GET /api/pmo-analysis/:projectId/progress
// REFACTORED: Uses asyncHandler
router.get('/:projectId/progress', verifyToken, asyncHandler(async (req, res) => {
    const progress = await ProgressService.calculateProjectProgress(req.params.projectId);
    res.json(progress);
}));

// GET /api/pmo-analysis/:projectId/dependencies
// REFACTORED: Uses asyncHandler
router.get('/:projectId/dependencies', verifyToken, asyncHandler(async (req, res) => {
    const graph = await DependencyService.buildDependencyGraph(req.params.projectId);
    const deadlocks = await DependencyService.detectDeadlocks(req.params.projectId);
    res.json({ ...graph, ...deadlocks });
}));

// POST /api/pmo-analysis/:projectId/dependencies
// REFACTORED: Uses asyncHandler
router.post('/:projectId/dependencies', verifyToken, asyncHandler(async (req, res) => {
    const { fromInitiativeId, toInitiativeId, type } = req.body;

    if (!fromInitiativeId || !toInitiativeId) {
        return res.status(400).json({ error: 'Missing initiative IDs' });
    }

    const dependency = await DependencyService.addDependency(fromInitiativeId, toInitiativeId, type);
    res.status(201).json(dependency);
}));

// DELETE /api/pmo-analysis/dependencies/:id
// REFACTORED: Uses asyncHandler
router.delete('/dependencies/:id', verifyToken, asyncHandler(async (req, res) => {
    const result = await DependencyService.removeDependency(req.params.id);
    res.json(result);
}));

// GET /api/pmo-analysis/explain/:objectType/:objectId
// REFACTORED: Uses asyncHandler
router.get('/explain/:objectType/:objectId', verifyToken, asyncHandler(async (req, res) => {
    const explanation = await PMOAnalysisService.explainBlocker(
        req.params.objectType.toUpperCase(),
        req.params.objectId
    );
    res.json(explanation);
}));

// GET /api/pmo-analysis/portfolio/:organizationId
// REFACTORED: Uses asyncHandler
router.get('/portfolio/:organizationId', verifyToken, asyncHandler(async (req, res) => {
    const metrics = await ProgressService.calculatePortfolioMetrics(req.params.organizationId);
    res.json(metrics);
}));

module.exports = router;
