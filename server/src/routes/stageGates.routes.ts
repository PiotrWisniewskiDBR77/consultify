/**
 * Stage Gates Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * All stage gate-related API endpoints with Zod validation
 */

import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import StageGateController from '../controllers/StageGateController.js';
import { PassGateSchema } from '../validators/stageGate.validators.js';

const router = Router();

// Apply auth middleware to all routes
router.use(verifyToken);

// ==========================================
// STAGE GATE OPERATIONS
// ==========================================

/**
 * GET /api/stage-gates/:projectId/evaluate/:gateType
 * Evaluate gate readiness
 */
router.get('/:projectId/evaluate/:gateType', StageGateController.evaluateGate);

/**
 * GET /api/stage-gates/:projectId/current
 * Get current gate for project
 */
router.get('/:projectId/current', StageGateController.getCurrentGate);

/**
 * POST /api/stage-gates/:projectId/pass/:gateType
 * Pass gate (requires manage_stage_gates permission)
 */
router.post(
    '/:projectId/pass/:gateType',
    validateBody(PassGateSchema),
    StageGateController.passGate
);

/**
 * GET /api/stage-gates/:projectId/history
 * Get gate history for project
 */
router.get('/:projectId/history', StageGateController.getGateHistory);

export default router;

