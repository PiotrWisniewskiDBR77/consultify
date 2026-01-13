/**
 * PMO Analysis Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware.js';
import PMOAnalysisController from '../../controllers/PMOAnalysisController.js';

const router = Router();

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/pmo-analysis/:projectId
 * Get full project analysis snapshot
 */
router.get('/:projectId', PMOAnalysisController.getProjectAnalysis);

/**
 * GET /api/pmo-analysis/:projectId/progress
 * Get project progress analysis
 */
router.get('/:projectId/progress', PMOAnalysisController.getProjectProgress);

/**
 * GET /api/pmo-analysis/:projectId/dependencies
 * Get project dependency graph
 */
router.get('/:projectId/dependencies', PMOAnalysisController.getProjectDependencies);

export default router;
