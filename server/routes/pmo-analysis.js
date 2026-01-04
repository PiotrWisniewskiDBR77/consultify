import express from 'express';
import PMOAnalysisService from '../services/pmoAnalysisService.js';
import ProgressService from '../services/progressService.js';
import DependencyService from '../services/dependencyService.js';
import verifyToken from '../middleware/authMiddleware.js';
import { asyncHandler } from '../src/utils/asyncHandler.ts';

const router = express.Router();

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

export default router;
