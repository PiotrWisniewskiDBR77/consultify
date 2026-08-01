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
import { verifyAdmin } from '../../middleware/admin.middleware.js';
import { verifyToken } from '../../middleware/auth.middleware.js';
import { requireDecisionCapability } from '../../middleware/effectiveCapability.middleware.js';
import { apiAuthRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { requireOrgAccess } from '../../middleware/rbac.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import { PlaybookSchema } from '../../services/decisionPlaybookService.js';
import {
  CreateDecisionAlternativeSchema,
  CreateDecisionCommentSchema,
  CreateDecisionRiskSchema,
  CreateDecisionSchema,
  DecideSchema,
  EscalateDecisionSchema,
  RemindDecisionSchema,
  UpdateDecisionAlternativeSchema,
  UpdateDecisionCommentSchema,
  UpdateDecisionRiskSchema,
  UpdateDecisionSchema,
} from '../../validators/decision.validators.js';

// Apply rate limiting
const router = Router();

// Apply auth middleware to all routes
router.use(verifyToken);
router.use(requireOrgAccess());

// ==========================================
// PLAYBOOK CRUD (before /:id to avoid conflicts)
// ==========================================

router.get('/playbooks', DecisionPlaybookController.listPlaybooks);
router.post(
  '/playbooks',
  verifyAdmin,
  validateBody(PlaybookSchema),
  DecisionPlaybookController.createPlaybook
);
router.get('/playbooks/:playbookId', DecisionPlaybookController.getPlaybook);
router.put(
  '/playbooks/:playbookId',
  verifyAdmin,
  validateBody(PlaybookSchema),
  DecisionPlaybookController.updatePlaybook
);
router.delete('/playbooks/:playbookId', verifyAdmin, DecisionPlaybookController.deletePlaybook);

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
router.post(
  '/',
  requireDecisionCapability('decision.request', { shadow: true }),
  validateBody(CreateDecisionSchema),
  DecisionController.createDecision
);

/**
 * PUT /api/decisions/:id
 * Update a decision (delegate, reschedule, reprioritize)
 */
router.put(
  '/:id',
  requireDecisionCapability('decision.update', { shadow: true }),
  validateBody(UpdateDecisionSchema),
  DecisionController.updateDecision
);

/**
 * DELETE /api/decisions/:id
 * Soft-delete (archive/cancel) a decision — reversible, org-scoped.
 * Allowed for requester, decision owner, or admin. Body: { reason?: string }
 */
router.delete(
  '/:id',
  requireDecisionCapability('decision.delete', { shadow: true }),
  DecisionController.deleteDecision
);

/**
 * PATCH /api/decisions/:id/decide
 * Make a decision (approve/reject/defer)
 */
router.patch(
  '/:id/decide',
  requireDecisionCapability('decision.approve', { shadow: true }),
  validateBody(DecideSchema),
  DecisionController.decide
);

/**
 * PUT /api/decisions/:id/decide
 * Alias for PATCH /:id/decide
 */
router.put(
  '/:id/decide',
  requireDecisionCapability('decision.approve', { shadow: true }),
  validateBody(DecideSchema),
  DecisionController.decide
);

/**
 * POST /api/decisions/:id/escalate
 * Escalate decision — requires ADMIN or OWNER (or SUPERADMIN)
 */
router.post(
  '/:id/escalate',
  verifyAdmin,
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
 * Requires ADMIN or OWNER (approve + publish trigger task creation)
 */
router.patch('/:id/workflow', verifyAdmin, DecisionController.transitionWorkflow);

/**
 * POST /api/decisions/:id/generate-section
 * Wzorzec N — generate a BCG-grade AI draft for ONE decision card. Proposer-only
 * (does not persist); the client renders the draft as `ai-draft` for review.
 * Body: { sectionKey: 'description'|'alternatives'|'risk'|'consequencesOfInaction',
 *         language?: 'pl'|'en', context?: string }
 */
router.post('/:id/generate-section', DecisionController.generateSection);

// ==========================================
// MW-DEC-001 — Decision detail aggregate + comments/alternatives/risks
//
// Real backend for what DecisionDetailView.tsx (frontend) previously faked
// entirely in localStorage. Single canonical Decision domain owner — same
// controller/router as everything else in this file, per CLAUDE.md
// architectural rules (no second Decision backend).
// ==========================================

/**
 * GET /api/decisions/:id/detail
 * Single aggregate read: decision + impacts + audit history + comments +
 * alternatives + risks + evidence links — avoids N+1 orchestration on the
 * client.
 */
router.get('/:id/detail', DecisionController.getDecisionDetail);

/**
 * POST /api/decisions/:id/comments
 * Any org member with access to the decision may comment (matches the
 * existing GET /:id read-scope: org membership, not team membership).
 */
router.post(
  '/:id/comments',
  requireDecisionCapability('decision.comment', { shadow: true }),
  validateBody(CreateDecisionCommentSchema),
  DecisionController.createComment
);

/** PUT /api/decisions/:id/comments/:commentId — author or admin only. */
router.put(
  '/:id/comments/:commentId',
  requireDecisionCapability('decision.comment', { shadow: true }),
  validateBody(UpdateDecisionCommentSchema),
  DecisionController.updateComment
);

/** DELETE /api/decisions/:id/comments/:commentId — soft-delete; author or admin only. */
router.delete(
  '/:id/comments/:commentId',
  requireDecisionCapability('decision.comment', { shadow: true }),
  DecisionController.deleteComment
);

/**
 * POST /api/decisions/:id/alternatives
 * Decision preparer (created_by), decision owner (decision_maker_id), or
 * admin only — dossier content, not open discussion.
 */
router.post(
  '/:id/alternatives',
  requireDecisionCapability('decision.update', { shadow: true }),
  validateBody(CreateDecisionAlternativeSchema),
  DecisionController.createAlternative
);

router.put(
  '/:id/alternatives/:alternativeId',
  requireDecisionCapability('decision.update', { shadow: true }),
  validateBody(UpdateDecisionAlternativeSchema),
  DecisionController.updateAlternative
);

router.delete(
  '/:id/alternatives/:alternativeId',
  requireDecisionCapability('decision.update', { shadow: true }),
  DecisionController.deleteAlternative
);

/**
 * POST /api/decisions/:id/risks
 * Same authorization as alternatives (preparer/owner/admin).
 */
router.post(
  '/:id/risks',
  requireDecisionCapability('decision.update', { shadow: true }),
  validateBody(CreateDecisionRiskSchema),
  DecisionController.createRisk
);

router.put(
  '/:id/risks/:riskId',
  requireDecisionCapability('decision.update', { shadow: true }),
  validateBody(UpdateDecisionRiskSchema),
  DecisionController.updateRisk
);

router.delete(
  '/:id/risks/:riskId',
  requireDecisionCapability('decision.update', { shadow: true }),
  DecisionController.deleteRisk
);

export default router;
