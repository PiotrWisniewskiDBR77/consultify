/**
 * Notification Rules Routes
 * API endpoints for managing notification rules and automation
 */
import { Request, Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { verifyAdmin } from '../../middleware/admin.middleware.js';
import { isAuthenticated, verifyToken } from '../../middleware/auth.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../../utils/DbPromise.js';
import logger from '../../utils/Logger.js';

const router = Router();

interface AuthRequest extends Request {
  user?: { id: string; organizationId: string; role: string };
}

/**
 * GET /api/notification-rules
 * Get all notification rules for organization
 */
router.get(
  '/',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;

    const rules = await dbAll(
      `
    SELECT id, name, description, event_type, conditions, actions,
           is_active, priority, created_at, updated_at
    FROM notification_rules
    WHERE organization_id = ? OR organization_id IS NULL
    ORDER BY priority DESC, created_at DESC
  `,
      [orgId]
    );

    res.json(rules || []);
  })
);

/**
 * GET /api/notification-rules/:id
 * Get specific notification rule
 */
router.get(
  '/:id',
  verifyToken,
  isAuthenticated,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    const rule = await dbGet(
      `
    SELECT id, name, description, event_type, conditions, actions,
           is_active, priority, created_at, updated_at
    FROM notification_rules
    WHERE id = ? AND (organization_id = ? OR organization_id IS NULL)
  `,
      [id, orgId]
    );

    if (!rule) {
      return res.status(404).json({ error: 'Notification rule not found' });
    }

    res.json(rule);
  })
);

/**
 * POST /api/notification-rules
 * Create new notification rule (Admin only)
 */
router.post(
  '/',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const orgId = req.user?.organizationId;
    const userId = req.user?.id;

    const { name, description, eventType, conditions, actions, priority = 0 } = req.body;

    if (!name || !eventType) {
      return res.status(400).json({ error: 'Name and event type are required' });
    }

    const id = uuidv4();

    const result = await dbRun(
      `
    INSERT INTO notification_rules (id, organization_id, name, description, event_type,
                                    conditions, actions, is_active, priority, created_by, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, TRUE, ?, ?, now())
  `,
      [
        id,
        orgId,
        name,
        description || '',
        eventType,
        JSON.stringify(conditions || {}),
        JSON.stringify(actions || []),
        priority,
        userId,
      ]
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to create notification rule');
    }

    logger.info(`[NotificationRules] Created rule: ${name} (${id})`);
    res.status(201).json({ success: true, id, name });
  })
);

/**
 * PUT /api/notification-rules/:id
 * Update notification rule (Admin only)
 */
router.put(
  '/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    const { name, description, eventType, conditions, actions, isActive, priority } = req.body;

    const existing = await dbGet(
      `
    SELECT id FROM notification_rules WHERE id = ? AND organization_id = ?
  `,
      [id, orgId]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Notification rule not found' });
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
    if (eventType !== undefined) {
      updates.push('event_type = ?');
      params.push(eventType);
    }
    if (conditions !== undefined) {
      updates.push('conditions = ?');
      params.push(JSON.stringify(conditions));
    }
    if (actions !== undefined) {
      updates.push('actions = ?');
      params.push(JSON.stringify(actions));
    }
    if (isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(isActive ? 1 : 0);
    }
    if (priority !== undefined) {
      updates.push('priority = ?');
      params.push(priority);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    updates.push('updated_at = now()');
    params.push(id);

    const result = await dbRun(
      `
    UPDATE notification_rules SET ${updates.join(', ')} WHERE id = ?
  `,
      params
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to update notification rule');
    }

    logger.info(`[NotificationRules] Updated rule: ${id}`);
    res.json({ success: true });
  })
);

/**
 * DELETE /api/notification-rules/:id
 * Delete notification rule (Admin only)
 */
router.delete(
  '/:id',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    const existing = await dbGet(
      `
    SELECT id FROM notification_rules WHERE id = ? AND organization_id = ?
  `,
      [id, orgId]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Notification rule not found' });
    }

    const result = await dbRun('DELETE FROM notification_rules WHERE id = ?', [id]);

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete notification rule');
    }

    logger.info(`[NotificationRules] Deleted rule: ${id}`);
    res.json({ success: true });
  })
);

/**
 * POST /api/notification-rules/:id/toggle
 * Toggle notification rule active status
 */
router.post(
  '/:id/toggle',
  verifyToken,
  verifyAdmin,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { id } = req.params;
    const orgId = req.user?.organizationId;

    const existing = await dbGet<{ is_active: number }>(
      `
    SELECT is_active FROM notification_rules WHERE id = ? AND organization_id = ?
  `,
      [id, orgId]
    );

    if (!existing) {
      return res.status(404).json({ error: 'Notification rule not found' });
    }

    const newStatus = existing.is_active === 1 ? 0 : 1;

    const result = await dbRun(
      `
    UPDATE notification_rules SET is_active = ?, updated_at = now() WHERE id = ?
  `,
      [newStatus, id]
    );

    if (!result.success) {
      throw new Error(result.error || 'Failed to toggle notification rule');
    }

    res.json({ success: true, isActive: newStatus === 1 });
  })
);

/**
 * GET /api/notification-rules/event-types
 * Get available event types for rules
 */
router.get(
  '/meta/event-types',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const eventTypes = [
      { id: 'project.created', name: 'Project Created', category: 'projects' },
      { id: 'project.updated', name: 'Project Updated', category: 'projects' },
      { id: 'project.status_changed', name: 'Project Status Changed', category: 'projects' },
      { id: 'task.assigned', name: 'Task Assigned', category: 'tasks' },
      { id: 'task.completed', name: 'Task Completed', category: 'tasks' },
      { id: 'task.overdue', name: 'Task Overdue', category: 'tasks' },
      { id: 'decision.pending', name: 'Decision Pending', category: 'governance' },
      { id: 'decision.approved', name: 'Decision Approved', category: 'governance' },
      { id: 'gate.approaching', name: 'Gate Approaching', category: 'governance' },
      { id: 'user.invited', name: 'User Invited', category: 'users' },
      { id: 'user.joined', name: 'User Joined', category: 'users' },
      { id: 'billing.payment_failed', name: 'Payment Failed', category: 'billing' },
      { id: 'billing.subscription_expiring', name: 'Subscription Expiring', category: 'billing' },
      { id: 'security.login_failed', name: 'Login Failed', category: 'security' },
      { id: 'security.mfa_disabled', name: 'MFA Disabled', category: 'security' },
    ];

    res.json(eventTypes);
  })
);

export default router;
