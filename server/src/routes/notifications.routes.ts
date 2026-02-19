/**
 * Notifications Routes
 * API endpoints for notifications and escalations
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import EscalationService from '../services/escalationService.js';
import NotificationService from '../services/notificationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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
      return res.status(500).json({ error: err.message });
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
      return res.status(500).json({ error: err.message });
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
      return res.status(500).json({ error: err.message, count: 0 });
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
      return res.status(500).json({ error: err.message });
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
      return res.status(500).json({ error: err.message });
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
      return res.status(500).json({ error: err.message });
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
      typeof (req as any).can === 'function' ? Boolean((req as any).can('edit_project_settings')) : false;
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
      return res.status(500).json({ error: err.message });
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
      return res.status(500).json({ error: err.message });
    }
  })
);

export default router;
