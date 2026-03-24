/**
 * Execution Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 */

import { Router } from 'express';

import ExecutionController from '../../controllers/ExecutionController.js';
import { verifyToken } from '../../middleware/auth.middleware.js';

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

/**
 * GET /api/execution/:projectId/health
 * V4-EXEC-01: Portfolio health with per-initiative whyRed chain
 */
router.get('/:projectId/health', ExecutionController.getPortfolioHealth);

/**
 * GET /api/execution/:projectId/action-queue
 * V4-EXEC-02: Action Queue — overdue decisions, high P×I risks, overdue tasks
 */
router.get('/:projectId/action-queue', ExecutionController.getActionQueue);

export default router;
