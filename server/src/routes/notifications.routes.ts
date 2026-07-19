/**
 * Notifications Routes
 * API endpoints for notifications and escalations
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import EscalationService from '../services/escalationService.js';
import NotificationService from '../services/notificationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

/**
 * GET /api/notifications
 * Get notifications for user
 */
router.get(
  '/',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const { unreadOnly, limit, projectId } = req.query;
      const notifications = await (service as any).getNotifications(userId, {
        unreadOnly: unreadOnly === 'true',
        limit: limit ? parseInt(limit as string) : 50,
        projectId: projectId as string | undefined,
      });
      return res.json(notifications);
    } catch (err: any) {
      // Enrichment read (notifications list) — degrade to safe default instead of 500.
      logger.warn('[Notifications] getNotifications degraded', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json([]);
    }
  })
);

/**
 * GET /api/notifications/counts
 * Get notification counts for user
 */
router.get(
  '/counts',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const counts = await (service as any).getCounts(userId);
      return res.json(counts);
    } catch (err: any) {
      // Enrichment badge read — degrade to zeroed counts instead of 500.
      logger.warn('[Notifications] getCounts degraded', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({ unread: 0, degraded: true });
    }
  })
);

/**
 * GET /api/notifications/unread-count
 */
router.get(
  '/unread-count',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized', count: 0 });

    try {
      const counts = await (service as any).getCounts(userId);
      return res.json({ count: counts.unread || 0 });
    } catch (err: any) {
      // Enrichment badge read — degrade to zero instead of 500.
      logger.warn('[Notifications] unread-count degraded', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json({ count: 0, degraded: true });
    }
  })
);

/**
 * PATCH /api/notifications/:id/read
 */
router.patch(
  '/:id/read',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return res.status(400).json({ error: 'id is required' });
      await (service as any).markAsRead(id, userId);
      return res.json({ success: true });
    } catch (err: any) {
      // Write — never fail-soft; surface a real error with a code.
      logger.error('[Notifications] markAsRead failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Failed to mark notification as read',
        code: 'NOTIFICATIONS_MARK_READ_FAILED',
      });
    }
  })
);

/**
 * POST /api/notifications/mark-all-read
 */
router.post(
  '/mark-all-read',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const updated = await (service as any).markAllAsRead(userId);
      return res.json({ success: true, updated });
    } catch (err: any) {
      // Write — never fail-soft; surface a real error with a code.
      logger.error('[Notifications] markAllAsRead failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.status(500).json({
        error: 'Failed to mark all notifications as read',
        code: 'NOTIFICATIONS_MARK_ALL_READ_FAILED',
      });
    }
  })
);

/**
 * GET /api/notifications/escalations/:projectId
 */
router.get(
  '/escalations/:projectId',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = EscalationService;
    try {
      const { status } = req.query;
      const projectId = Array.isArray(req.params.projectId)
        ? req.params.projectId[0]
        : req.params.projectId;
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });
      const escalations = await service.getEscalations(projectId, status as string | undefined);
      return res.json(escalations);
    } catch (err: any) {
      // Enrichment read (project escalations panel) — degrade to safe default instead of 500.
      logger.warn('[Notifications] getEscalations degraded', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res.json([]);
    }
  })
);

/**
 * POST /api/notifications/escalations/:projectId/run
 */
router.post(
  '/escalations/:projectId/run',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = EscalationService;

    const role = (req as any).userRole || req.user?.role;
    const canEditProject =
      typeof (req as any).can === 'function'
        ? Boolean((req as any).can('edit_project_settings'))
        : false;
    const isAdmin = role === 'ADMIN' || role === 'SUPERADMIN';
    if (!isAdmin && !canEditProject) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    try {
      const projectId = Array.isArray(req.params.projectId)
        ? req.params.projectId[0]
        : req.params.projectId;
      if (!projectId) return res.status(400).json({ error: 'projectId is required' });
      const result = await service.runAutoEscalation(projectId);
      return res.json(result);
    } catch (err: any) {
      // Write (triggers escalation actions) — never fail-soft.
      logger.error('[Notifications] runAutoEscalation failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Failed to run escalations', code: 'NOTIFICATIONS_ESCALATION_RUN_FAILED' });
    }
  })
);

/**
 * DELETE /api/notifications/:id
 */
router.delete(
  '/:id',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      if (!id) return res.status(400).json({ error: 'id is required' });
      await (service as any).delete(id, userId);
      return res.json({ success: true });
    } catch (err: any) {
      // Write — never fail-soft; surface a real error with a code.
      logger.error('[Notifications] delete failed', {
        err,
        correlationId: (req as any).correlationId,
      });
      return res
        .status(500)
        .json({ error: 'Failed to delete notification', code: 'NOTIFICATIONS_DELETE_FAILED' });
    }
  })
);

export default router;
