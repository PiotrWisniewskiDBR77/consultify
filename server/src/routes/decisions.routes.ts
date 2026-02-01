/**
 * Decision Routes
 * FLOW-DECISION-001: Core decision management API
 */

import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import { verifyToken } from '../middleware/auth.middleware.js';
import DecisionDelegationService from '../services/decisionDelegationService.js';
import DecisionEscalationChainService from '../services/decisionEscalationChainService.js';
import decisionService from '../services/decisionService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// ==========================================
// SCHEMAS
// ==========================================

const CreateDecisionSchema = z.object({
  projectId: z.string().uuid().optional(),
  initiativeId: z.string().uuid().optional(),
  taskId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  description: z.string().max(5000).optional(),
  type: z.enum(['GO_NO_GO', 'APPROVAL', 'RESOURCE_ALLOCATION', 'OTHER']),
  decisionMakerId: z.string().uuid(),
  options: z
    .array(
      z.object({
        id: z.string(),
        label: z.string(),
        description: z.string().optional(),
      })
    )
    .optional(),
  criteria: z.string().max(2000).optional(),
  deadline: z.string().optional(),
  stakeholderIds: z.array(z.string().uuid()).optional(),
});

const MakeDecisionSchema = z.object({
  selectedOption: z.string(),
  rationale: z.string().max(2000).optional(),
});

const CancelDecisionSchema = z.object({
  reason: z.string().max(500).optional(),
});

// ==========================================
// MIDDLEWARE
// ==========================================

router.use(verifyToken);

// ==========================================
// ROUTES
// ==========================================

/**
 * GET /api/decisions
 * List decisions for organization
 */
router.get(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const { projectId, status, decisionMakerId } = req.query;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const db = await import('../database/Database.js').then((m) => m.getDatabase());

    let query = `SELECT * FROM decisions WHERE organization_id = ?`;
    const params: (string | undefined)[] = [orgId];

    if (projectId) {
      query += ` AND project_id = ?`;
      params.push(projectId as string);
    }

    if (status) {
      query += ` AND status = ?`;
      params.push(status as string);
    }

    if (decisionMakerId) {
      query += ` AND decision_maker_id = ?`;
      params.push(decisionMakerId as string);
    }

    query += ` ORDER BY deadline ASC`;

    const rawDecisions = await db.all(query, params);

    // Transform snake_case to camelCase for frontend compatibility
    const decisions = (rawDecisions || []).map((d: Record<string, unknown>) => ({
      id: d.id,
      organizationId: d.organization_id,
      projectId: d.project_id,
      initiativeId: d.initiative_id,
      taskId: d.task_id,
      title: d.title,
      description: d.description,
      type: d.type,
      decisionType: d.type,
      decisionMakerId: d.decision_maker_id,
      decisionOwnerId: d.decision_owner_id || d.decision_maker_id,
      options: typeof d.options === 'string' ? JSON.parse(d.options as string) : d.options,
      criteria: d.criteria,
      deadline: d.deadline,
      dueDate: d.deadline,
      escalationDeadline: d.escalation_deadline,
      status: (d.status as string)?.toUpperCase() || 'PENDING',
      priority: d.priority || 'MEDIUM',
      selectedOption: d.selected_option,
      decisionRationale: d.decision_rationale,
      decidedAt: d.decided_at,
      createdBy: d.created_by,
      requestedById: d.created_by,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    }));

    return res.json({
      success: true,
      decisions,
    });
  })
);

/**
 * GET /api/decisions/pending
 * Get my pending decisions
 */
router.get(
  '/pending',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const userId = req.userId;

    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decisions = await decisionService.getPendingDecisions(userId, orgId);

    return res.json({
      success: true,
      decisions,
      count: decisions.length,
    });
  })
);

/**
 * POST /api/decisions
 * Create a new decision request
 */
router.post(
  '/',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const userId = req.userId;

    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validation = CreateDecisionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.issues });
    }

    const data = validation.data;

    const decision = await decisionService.createDecision({
      organizationId: orgId,
      projectId: data.projectId,
      initiativeId: data.initiativeId,
      taskId: data.taskId,
      title: data.title,
      description: data.description,
      type: data.type,
      decisionMakerId: data.decisionMakerId,
      options: data.options,
      criteria: data.criteria,
      deadline: data.deadline,
      stakeholderIds: data.stakeholderIds,
      createdBy: userId,
    });

    return res.status(201).json({
      success: true,
      decision,
    });
  })
);

/**
 * GET /api/decisions/:id
 * Get decision details
 */
router.get(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const decisionId = req.params.id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decision = await decisionService.getDecision(decisionId);

    if (!decision || decision.organizationId !== orgId) {
      return res.status(404).json({ error: 'Decision not found' });
    }

    return res.json({
      success: true,
      decision,
    });
  })
);

/**
 * PUT /api/decisions/:id
 * Make a decision
 */
router.put(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const userId = req.userId;
    const decisionId = req.params.id;

    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validation = MakeDecisionSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({ error: 'Validation failed', details: validation.error.issues });
    }

    // Verify decision exists and user is the decision maker
    const existing = await decisionService.getDecision(decisionId);
    if (!existing || existing.organizationId !== orgId) {
      return res.status(404).json({ error: 'Decision not found' });
    }

    if (existing.decisionMakerId !== userId) {
      return res.status(403).json({ error: 'Only the decision maker can make this decision' });
    }

    const decision = await decisionService.makeDecision({
      decisionId,
      selectedOption: validation.data.selectedOption,
      rationale: validation.data.rationale,
      decidedBy: userId,
    });

    return res.json({
      success: true,
      decision,
      message: 'Decision made successfully',
    });
  })
);

/**
 * DELETE /api/decisions/:id
 * Cancel a decision request
 */
router.delete(
  '/:id',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const userId = req.userId;
    const decisionId = req.params.id;

    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const validation = CancelDecisionSchema.safeParse(req.body);
    const reason = validation.success ? validation.data.reason : undefined;

    const existing = await decisionService.getDecision(decisionId);
    if (!existing || existing.organizationId !== orgId) {
      return res.status(404).json({ error: 'Decision not found' });
    }

    const decision = await decisionService.cancelDecision(decisionId, userId, reason);

    return res.json({
      success: true,
      decision,
      message: 'Decision cancelled',
    });
  })
);

/**
 * POST /api/decisions/:id/escalate
 * Escalate a decision
 */
router.post(
  '/:id/escalate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const userId = req.userId;
    const decisionId = req.params.id;

    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { reason } = req.body;

    const existing = await decisionService.getDecision(decisionId);
    if (!existing || existing.organizationId !== orgId) {
      return res.status(404).json({ error: 'Decision not found' });
    }

    const decision = await decisionService.escalateDecision(decisionId, userId, reason);

    return res.json({
      success: true,
      decision,
      message: 'Decision escalated',
    });
  })
);

/**
 * GET /api/decisions/:id/history
 * Get decision history (audit trail)
 */
router.get(
  '/:id/history',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const decisionId = req.params.id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verify access
    const existing = await decisionService.getDecision(decisionId);
    if (!existing || existing.organizationId !== orgId) {
      return res.status(404).json({ error: 'Decision not found' });
    }

    const history = await decisionService.getDecisionHistory(decisionId);

    return res.json({
      success: true,
      history,
    });
  })
);

/**
 * GET /api/decisions/project/:projectId
 * Get all decisions for a project
 */
router.get(
  '/project/:projectId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const projectId = req.params.projectId;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const decisions = await decisionService.getProjectDecisions(projectId, orgId);

    return res.json({
      success: true,
      decisions,
      count: decisions.length,
    });
  })
);

// ==========================================
// ESCALATION CHAIN ROUTES
// ==========================================

/**
 * GET /api/decisions/:id/escalation-chain
 * Get escalation chain for a decision
 */
router.get(
  '/:id/escalation-chain',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const decisionId = req.params.id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const chain = await DecisionEscalationChainService.getEscalationChain(decisionId);

    return res.json({
      success: true,
      chain,
    });
  })
);

/**
 * PUT /api/decisions/:id/escalation-chain
 * Set escalation chain for a decision
 */
router.put(
  '/:id/escalation-chain',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const userId = req.userId;
    const decisionId = req.params.id;

    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { chain } = req.body;

    if (!Array.isArray(chain)) {
      return res.status(400).json({ error: 'Chain must be an array' });
    }

    const result = await DecisionEscalationChainService.setEscalationChain(
      decisionId,
      chain,
      userId
    );

    return res.json({
      success: true,
      chain: result,
    });
  })
);

/**
 * GET /api/decisions/:id/escalation-log
 * Get escalation history for a decision
 */
router.get(
  '/:id/escalation-log',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const decisionId = req.params.id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const log = await DecisionEscalationChainService.getEscalationLog(decisionId);

    return res.json({
      success: true,
      log,
    });
  })
);

/**
 * POST /api/decisions/:id/manual-escalate
 * Manually escalate a decision
 */
router.post(
  '/:id/manual-escalate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const userId = req.userId;
    const decisionId = req.params.id;

    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { reason, escalateToUserId } = req.body;

    await DecisionEscalationChainService.manualEscalate(
      decisionId,
      userId,
      reason || 'Manual escalation',
      escalateToUserId
    );

    return res.json({
      success: true,
      message: 'Decision escalated',
    });
  })
);

// ==========================================
// DELEGATION ROUTES
// ==========================================

/**
 * POST /api/decisions/:id/delegate
 * Delegate a decision to another user
 */
router.post(
  '/:id/delegate',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const userId = req.userId;
    const decisionId = req.params.id;

    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { toUserId, delegationType, reason, comment, expiresAt } = req.body;

    if (!toUserId) {
      return res.status(400).json({ error: 'toUserId is required' });
    }

    const delegation = await DecisionDelegationService.delegate(
      decisionId,
      userId,
      toUserId,
      delegationType || 'full',
      { reason, comment, expiresAt }
    );

    return res.status(201).json({
      success: true,
      delegation,
    });
  })
);

/**
 * POST /api/decisions/:id/request-input
 * Request input from multiple users
 */
router.post(
  '/:id/request-input',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const userId = req.userId;
    const decisionId = req.params.id;

    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { userIds, comment } = req.body;

    if (!Array.isArray(userIds) || userIds.length === 0) {
      return res.status(400).json({ error: 'userIds must be a non-empty array' });
    }

    const delegations = await DecisionDelegationService.requestInput(
      decisionId,
      userId,
      userIds,
      comment
    );

    return res.status(201).json({
      success: true,
      delegations,
      count: delegations.length,
    });
  })
);

/**
 * GET /api/decisions/:id/delegations
 * Get delegation history for a decision
 */
router.get(
  '/:id/delegations',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const decisionId = req.params.id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const delegations = await DecisionDelegationService.getDelegationHistory(decisionId);

    return res.json({
      success: true,
      delegations,
    });
  })
);

/**
 * GET /api/decisions/:id/opinions
 * Get consulted opinions for a decision
 */
router.get(
  '/:id/opinions',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const decisionId = req.params.id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const opinions = await DecisionDelegationService.getConsultedOpinions(decisionId);

    return res.json({
      success: true,
      opinions,
    });
  })
);

/**
 * GET /api/decisions/:id/stakeholders
 * Get stakeholders for a decision
 */
router.get(
  '/:id/stakeholders',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const decisionId = req.params.id;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const stakeholders = await DecisionDelegationService.getStakeholders(decisionId);

    return res.json({
      success: true,
      stakeholders,
    });
  })
);

/**
 * POST /api/decisions/:id/stakeholders
 * Add stakeholder to a decision
 */
router.post(
  '/:id/stakeholders',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const userId = req.userId;
    const decisionId = req.params.id;

    if (!orgId || !userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { stakeholderUserId, role } = req.body;

    if (!stakeholderUserId || !role) {
      return res.status(400).json({ error: 'stakeholderUserId and role are required' });
    }

    const stakeholder = await DecisionDelegationService.addStakeholder(
      decisionId,
      stakeholderUserId,
      role,
      userId
    );

    return res.status(201).json({
      success: true,
      stakeholder,
    });
  })
);

/**
 * DELETE /api/decisions/:id/stakeholders/:userId
 * Remove stakeholder from a decision
 */
router.delete(
  '/:id/stakeholders/:stakeholderUserId',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.organizationId;
    const decisionId = req.params.id;
    const stakeholderUserId = req.params.stakeholderUserId;

    if (!orgId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    await DecisionDelegationService.removeStakeholder(decisionId, stakeholderUserId);

    return res.json({
      success: true,
      message: 'Stakeholder removed',
    });
  })
);

// ==========================================
// DELEGATION ACTION ROUTES
// ==========================================

/**
 * POST /api/delegations/:id/accept
 * Accept a delegation
 */
router.post(
  '/delegations/:delegationId/accept',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    const delegationId = req.params.delegationId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { responseComment } = req.body;

    const delegation = await DecisionDelegationService.acceptDelegation(
      delegationId,
      userId,
      responseComment
    );

    return res.json({
      success: true,
      delegation,
      message: 'Delegation accepted',
    });
  })
);

/**
 * POST /api/delegations/:id/reject
 * Reject a delegation
 */
router.post(
  '/delegations/:delegationId/reject',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    const delegationId = req.params.delegationId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { rejectionReason } = req.body;

    const delegation = await DecisionDelegationService.rejectDelegation(
      delegationId,
      userId,
      rejectionReason
    );

    return res.json({
      success: true,
      delegation,
      message: 'Delegation rejected',
    });
  })
);

/**
 * POST /api/delegations/:id/submit-input
 * Submit input for a delegation
 */
router.post(
  '/delegations/:delegationId/submit-input',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;
    const delegationId = req.params.delegationId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { opinion, recommendation, confidenceLevel } = req.body;

    if (!opinion) {
      return res.status(400).json({ error: 'Opinion is required' });
    }

    const result = await DecisionDelegationService.submitInput(delegationId, userId, opinion, {
      recommendation,
      confidenceLevel,
    });

    return res.json({
      success: true,
      opinion: result,
      message: 'Input submitted',
    });
  })
);

/**
 * GET /api/delegations/pending
 * Get pending delegations for current user
 */
router.get(
  '/delegations/pending',
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const delegations = await DecisionDelegationService.getPendingDelegations(userId);

    return res.json({
      success: true,
      delegations,
      count: delegations.length,
    });
  })
);

export default router;
