/**
 * Execution Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { Router } from 'express';
import { verifyToken } from '../../middleware/auth.middleware.js';
import ExecutionController from '../../controllers/ExecutionController.js';

const router = Router();

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/execution/:projectId/summary
 * Get execution summary for a project
 */
router.get('/:projectId/summary', ExecutionController.getExecutionSummary);

/**
 * GET /api/execution/:projectId/blockers
 * Get blocked tasks with reasons
 */
router.get('/:projectId/blockers', ExecutionController.getBlockers);

/**
 * POST /api/execution/:projectId/gate-check
 * Check if project can advance phase (Decision Gate)
 */
router.post('/:projectId/gate-check', ExecutionController.checkGate);

export default router;
