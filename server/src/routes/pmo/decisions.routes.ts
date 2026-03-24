/**
 * Decisions Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All decision-related API endpoints with Zod validation
 */

import { Router } from 'express';

import DecisionControllerRaw from '../../controllers/DecisionController.js';
const DecisionController = DecisionControllerRaw as any;
import DecisionPlaybookControllerRaw from '../../controllers/DecisionPlaybookController.js';
const DecisionPlaybookController = DecisionPlaybookControllerRaw as any;
import { verifyToken } from '../../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import {
  CreateDecisionSchema,
  DecideSchema,
  EscalateDecisionSchema,
  RemindDecisionSchema,
  UpdateDecisionSchema,
} from '../../validators/decision.validators.js';
import { PlaybookSchema } from '../../services/decisionPlaybookService.js';

// Apply rate limiting
const router = Router();

// Apply auth middleware to all routes
router.use(verifyToken);

// ==========================================
// PLAYBOOK CRUD (before /:id to avoid conflicts)
// ==========================================

router.get('/playbooks', DecisionPlaybookController.listPlaybooks);
router.post('/playbooks', validateBody(PlaybookSchema), DecisionPlaybookController.createPlaybook);
router.get('/playbooks/:playbookId', DecisionPlaybookController.getPlaybook);
router.put('/playbooks/:playbookId', validateBody(PlaybookSchema), DecisionPlaybookController.updatePlaybook);
router.delete('/playbooks/:playbookId', DecisionPlaybookController.deletePlaybook);

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
 * GET /api/decisions/:id/required-fields-status
 * Check required fields for a decision against its playbook
 */
router.get('/:id/required-fields-status', DecisionPlaybookController.getRequiredFieldsStatus);

/**
 * GET /api/decisions/:id
 * Get single decision by ID
 */
router.get('/:id', DecisionController.getDecisionById);

/**
 * POST /api/decisions
 * Create a new decision (requires approve_changes permission)
 */
router.post('/', validateBody(CreateDecisionSchema), DecisionController.createDecision);

/**
 * PUT /api/decisions/:id
 * Update a decision (delegate, reschedule, reprioritize)
 */
router.put('/:id', validateBody(UpdateDecisionSchema), DecisionController.updateDecision);

/**
 * PATCH /api/decisions/:id/decide
 * Make a decision (approve/reject/defer)
 */
router.patch('/:id/decide', validateBody(DecideSchema), DecisionController.decide);

/**
 * PUT /api/decisions/:id/decide
 * Alias for PATCH /:id/decide
 */
router.put('/:id/decide', validateBody(DecideSchema), DecisionController.decide);

/**
 * POST /api/decisions/:id/escalate
 * Escalate decision
 */
router.post(
  '/:id/escalate',
  validateBody(EscalateDecisionSchema),
  DecisionController.escalateDecision
);

/**
 * POST /api/decisions/:id/remind
 * Send a nudge/reminder to the current decision owner (rate-limited server-side).
 */
router.post('/:id/remind', validateBody(RemindDecisionSchema), DecisionController.remindDecision);

/**
 * GET /api/decisions/:id/created-tasks
 * V4-EXEC-06: Get tasks auto-created from a published decision
 */
router.get('/:id/created-tasks', DecisionController.getCreatedTasks);

/**
 * PATCH /api/decisions/:id/workflow
 * V4-EXEC-06: Decision workflow — propose→review→approve→publish; auto-create tasks on publish
 * Body: { toStatus: 'proposed'|'review'|'approve'|'published' }
 */
router.patch('/:id/workflow', DecisionController.transitionWorkflow);

export default router;
