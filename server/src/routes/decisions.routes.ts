/**
 * Decision Routes
 * FLOW-DECISION-001: Core decision management API
 */

import type { Response } from 'express';
import { Router } from 'express';
import { z } from 'zod';

import type { AuthRequest } from '../middleware/auth.middleware.js';
import { verifyToken } from '../middleware/auth.middleware.js';
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
    const decisions = Array.isArray(rawDecisions) ? rawDecisions.map((d: unknown) => {
      const record = d as Record<string, unknown>;
      return {
        id: record.id,
        organizationId: record.organization_id,
        projectId: record.project_id,
        initiativeId: record.initiative_id,
        taskId: record.task_id,
        title: record.title,
        description: record.description,
        type: record.type,
        decisionType: record.type,
        decisionMakerId: record.decision_maker_id,
        decisionOwnerId: record.decision_owner_id || record.decision_maker_id,
        options: typeof record.options === 'string' ? JSON.parse(record.options as string) : record.options,
        criteria: record.criteria,
        deadline: record.deadline,
        dueDate: record.deadline,
        escalationDeadline: record.escalation_deadline,
        status: (record.status as string)?.toUpperCase() || 'PENDING',
        priority: record.priority || 'MEDIUM',
        selectedOption: record.selected_option,
        decisionRationale: record.decision_rationale,
        decidedAt: record.decided_at,
        createdBy: record.created_by,
        requestedById: record.created_by,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
      };
    }) : [];

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

export default router;
