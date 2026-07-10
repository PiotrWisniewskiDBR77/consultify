/**
 * Stage Gates Routes
 * API endpoints for PMO stage gate management
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { requireProjectCapability } from '../../middleware/effectiveCapability.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string; role: string };
}

/**
 * GET /api/pmo/stage-gates
 * Get all stage gate definitions
 */
router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;

    const gates = await dbAll(
      `
    SELECT id, name, description, stage_order, criteria, required_approvers,
           is_active, created_at, updated_at
    FROM stage_gate_definitions
    WHERE organization_id = ? OR organization_id IS NULL
    ORDER BY stage_order ASC
  `,
      [orgId]
    );

    res.json(gates || []);
  })
);

/**
 * GET /api/pmo/stage-gates/:id
 * Get specific stage gate
 */
router.get(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    const gate = await dbGet(
      `
    SELECT id, name, description, stage_order, criteria, required_approvers,
           is_active, created_at, updated_at
    FROM stage_gate_definitions
    WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)
  `,
      [id, orgId]
    );

    if (!gate) {
      return res.status(404).json({ error: 'Stage gate not found' });
    }

    res.json(gate);
  })
);

/**
 * POST /api/pmo/stage-gates
 * Create new stage gate definition
 */
router.post(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;

    const { name, description, stageOrder, criteria, requiredApprovers } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const id = uuidv4();

    const result = await dbRun(
      `
    INSERT INTO stage_gate_definitions (id, organization_id, name, description, stage_order,
                                        criteria, required_approvers, is_active, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, datetime('now'))
  `,
      [
        id,
        orgId,
        name,
        description || '',
        stageOrder || 0,
        JSON.stringify(criteria || []),
        requiredApprovers || 1,
        userId,
      ]
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to create stage gate');
    }

    logger.info(`[StageGates] Created gate: ${name} (${id})`);
    res.status(201).json({ success: true, id, name });
  })
);

/**
 * PUT /api/pmo/stage-gates/:id
 * Update stage gate definition
 */
router.put(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    const { name, description, stageOrder, criteria, requiredApprovers, isActive } = req.body;

    const existing = await dbGet(
      `
    SELECT id FROM stage_gate_definitions WHERE id = ? AND organization_id = ?
  `,
      [id, orgId]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Stage gate not found' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      params.push(description);
    }
    if (stageOrder !== undefined) {
      updates.push('stage_order = ?');
      params.push(stageOrder);
    }
    if (criteria !== undefined) {
      updates.push('criteria = ?');
      params.push(JSON.stringify(criteria));
    }
    if (requiredApprovers !== undefined) {
      updates.push('required_approvers = ?');
      params.push(requiredApprovers);
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push("updated_at = datetime('now')");
    params.push(id);

    const result = await dbRun(
      `
    UPDATE stage_gate_definitions SET ${updates.join(', ')} WHERE id = ?
  `,
      params
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to update stage gate');
    }

    logger.info(`[StageGates] Updated gate: ${id}`);
    res.json({ success: true });
  })
);

/**
 * DELETE /api/pmo/stage-gates/:id
 * Delete stage gate definition
 */
router.delete(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    const existing = await dbGet(
      `
    SELECT id FROM stage_gate_definitions WHERE id = ? AND organization_id = ?
  `,
      [id, orgId]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Stage gate not found' });
    }

    // Soft delete
    const result = await dbRun(
      `
    UPDATE stage_gate_definitions SET is_active = 0, updated_at = datetime('now') WHERE id = ?
  `,
      [id]
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete stage gate');
    }

    logger.info(`[StageGates] Deleted gate: ${id}`);
    res.json({ success: true });
  })
);

/**
 * GET /api/pmo/stage-gates/project/:projectId
 * Get stage gates status for a project
 */
router.get(
  '/project/:projectId',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId } = req.params;
    const orgId = req.user?.organizationId;

    // Get gate definitions with project status
    const gates = await dbAll(
      `
    SELECT 
      sgd.id, sgd.name, sgd.description, sgd.stage_order, sgd.criteria, sgd.required_approvers,
      psg.status as project_status, psg.approved_at, psg.approved_by, psg.notes
    FROM stage_gate_definitions sgd
    LEFT JOIN project_stage_gates psg ON sgd.id = psg.gate_id AND psg.project_id = ?
    WHERE (sgd.organization_id = ? OR sgd.organization_id IS NULL) AND sgd.is_active = 1
    ORDER BY sgd.stage_order ASC
  `,
      [projectId, orgId]
    );

    res.json(gates || []);
  })
);

/**
 * POST /api/pmo/stage-gates/project/:projectId/:gateId/approve
 * Approve a project stage gate
 */
router.post(
  '/project/:projectId/:gateId/approve',
  verifyToken,
  isAuthenticated,
  requireProjectCapability('gate.approve', undefined, { shadow: true }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId, gateId } = req.params;
    const userId = req.user?.id;
    const { notes } = req.body;

    // Check if gate exists
    const gate = await dbGet('SELECT id, name FROM stage_gate_definitions WHERE id = ?', [gateId]);
    if (!gate) {
      return res.status(404).json({ error: 'Stage gate not found' });
    }

    // Check if project exists
    const project = await dbGet('SELECT id, name FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Upsert project stage gate status
    const id = uuidv4();
    const result = await dbRun(
      `
    INSERT INTO project_stage_gates (id, project_id, gate_id, status, approved_by, approved_at, notes)
    VALUES (?, ?, ?, 'approved', ?, datetime('now'), ?)
    ON CONFLICT(project_id, gate_id) DO UPDATE SET
      status = 'approved', approved_by = ?, approved_at = datetime('now'), notes = ?
  `,
      [id, projectId, gateId, userId, notes || '', userId, notes || '']
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to approve stage gate');
    }

    logger.info(`[StageGates] Project ${projectId} gate ${gateId} approved by ${userId}`);
    res.json({ success: true, message: 'Stage gate approved' });
  })
);

/**
 * POST /api/pmo/stage-gates/project/:projectId/:gateId/reject
 * Reject a project stage gate
 */
router.post(
  '/project/:projectId/:gateId/reject',
  verifyToken,
  isAuthenticated,
  requireProjectCapability('gate.approve', undefined, { shadow: true }),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId, gateId } = req.params;
    const userId = req.user?.id;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Rejection reason is required' });
    }

    const id = uuidv4();
    const result = await dbRun(
      `
    INSERT INTO project_stage_gates (id, project_id, gate_id, status, approved_by, approved_at, notes)
    VALUES (?, ?, ?, 'rejected', ?, datetime('now'), ?)
    ON CONFLICT(project_id, gate_id) DO UPDATE SET
      status = 'rejected', approved_by = ?, approved_at = datetime('now'), notes = ?
  `,
      [id, projectId, gateId, userId, reason, userId, reason]
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to reject stage gate');
    }

    logger.info(`[StageGates] Project ${projectId} gate ${gateId} rejected by ${userId}`);
    res.json({ success: true, message: 'Stage gate rejected' });
  })
);

export default router;
