/**
 * Execution Routes
 * API endpoints for Execution Center module
 *
 * Endpoints:
 * - GET /api/execution/:projectId/summary - Execution summary
 * - GET /api/execution/:projectId/blockers - Blocked items
 * - POST /api/execution/:projectId/gate-check - Gate validation
 * - GET /api/execution/:projectId/health - Portfolio health metrics
 * - GET /api/execution/stats - Execution statistics by status
 * - GET /api/execution/escalations - Escalation dashboard
 * - GET /api/execution/calendar - Calendar items (tasks/decisions)
 *
 * Fully migrated to TypeScript ES modules
 */

import { Router } from 'express';

import { ExecutionController } from '../controllers/ExecutionController.js';
import { verifyToken } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * GET /api/execution/stats
 * Get execution statistics by status
 */
router.get('/stats', verifyToken, ExecutionController.getExecutionStats);

/**
 * GET /api/execution/escalations
 * Get escalations dashboard data
 */
router.get('/escalations', verifyToken, ExecutionController.getEscalations);

/**
 * GET /api/execution/calendar
 * Get calendar items (tasks and decisions with deadlines)
 */
router.get('/calendar', verifyToken, ExecutionController.getCalendarItems);

/**
 * GET /api/execution/:projectId/summary
 * Get execution summary for a project
 */
router.get('/:projectId/summary', verifyToken, ExecutionController.getExecutionSummary);

/**
 * GET /api/execution/:projectId/blockers
 * Get blocked items with reasons
 */
router.get('/:projectId/blockers', verifyToken, ExecutionController.getBlockers);

/**
 * GET /api/execution/:projectId/health
 * Get portfolio health metrics for Execution Center dashboard
 */
router.get('/:projectId/health', verifyToken, ExecutionController.getPortfolioHealth);

/**
 * POST /api/execution/:projectId/gate-check
 * Check if initiative can advance status (Decision Gate)
 */
router.post('/:projectId/gate-check', verifyToken, ExecutionController.checkGate);

export default router;
