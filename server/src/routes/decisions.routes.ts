/**
 * Decisions Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * All decision-related API endpoints with Zod validation
 */

import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validation.middleware.js';
import DecisionController from '../controllers/DecisionController.js';
import {
    CreateDecisionSchema,
    DecideSchema,
    EscalateDecisionSchema,
} from '../validators/decision.validators.js';

const router = Router();

// Apply auth middleware to all routes
router.use(verifyToken);

// ==========================================
// DECISION CRUD
// ==========================================

/**
 * GET /api/decisions
 * Get all decisions
 */
router.get('/', DecisionController.getDecisions);

/**
 * GET /api/decisions/bottlenecks
 * Get decision bottleneck analysis
 */
router.get('/bottlenecks', DecisionController.getBottlenecks);

/**
 * GET /api/decisions/:id
 * Get single decision by ID
 */
router.get('/:id', DecisionController.getDecisionById);

/**
 * POST /api/decisions
 * Create a new decision (requires approve_changes permission)
 */
router.post(
    '/',
    validateBody(CreateDecisionSchema),
    DecisionController.createDecision
);

/**
 * PATCH /api/decisions/:id/decide
 * Make a decision (approve/reject/defer)
 */
router.patch(
    '/:id/decide',
    validateBody(DecideSchema),
    DecisionController.decide
);

/**
 * PUT /api/decisions/:id/decide
 * Alias for PATCH /:id/decide
 */
router.put(
    '/:id/decide',
    validateBody(DecideSchema),
    DecisionController.decide
);

/**
 * POST /api/decisions/:id/escalate
 * Escalate decision
 */
router.post(
    '/:id/escalate',
    validateBody(EscalateDecisionSchema),
    DecisionController.escalateDecision
);

export default router;
