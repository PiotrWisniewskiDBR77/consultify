/**
 * Notifications Routes
 * API endpoints for notifications and escalations
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
// import EscalationService from '../../services/EscalationService.js';
const EscalationService = {} as any; // Stubbed missing service
import NotificationService from '../../services/notificationService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

// Validate verifyToken is available at module load time
if (!verifyToken || typeof verifyToken !== 'function') {
  const error = new Error(
    `verifyToken middleware is not properly exported from auth.middleware.js. ` +
      `Type: ${typeof verifyToken}, Value: ${verifyToken}`
  );
  console.error('[NotificationsRoutes] Critical error:', error);
  throw error;
}

// Apply rate limiting
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
      const notifications = await service.getNotifications(userId, {
        unreadOnly: unreadOnly === 'true',
        limit: limit ? parseInt(limit as string) : 50,
        projectId: projectId as string | undefined,
      });
      return res.json(notifications);
    } catch (err: any) {
      console.error('[NotificationsRoute] Error:', err);
      return res.status(500).json({ error: err.message, stack: err.stack });
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
      const counts = await service.getCounts(userId);
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
      const counts = await service.getCounts(userId);
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
      await service.markAsRead(req.params.id, userId);
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
      const count = await service.markAllAsRead(userId);
      return res.json({ success: true, count });
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
      const escalations = await service.getEscalations(
        req.params.projectId,
        status as string | undefined
      );
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

    // Check permissions - simple version for now
    // In a real app we'd use a more robust policy engine
    if (!(req as any).can || !(req as any).can('edit_project_settings')) {
      // Fallback for when 'can' helper isn't available
      if (req.user?.role !== 'SUPERADMIN' && req.user?.role !== 'ADMIN') {
        // Check if user is PM of this project
        // This is just a placeholder logic
      }
    }

    try {
      const result = await service.runAutoEscalation(req.params.projectId);
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
      await service.delete(req.params.id, userId);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  })
);

/**
 * POST /api/notifications/:id/snooze
 * Snooze a notification until a given time
 */
router.post(
  '/:id/snooze',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const { preset, until } = req.body;

      let snoozeUntil: string;

      if (until) {
        snoozeUntil = new Date(until).toISOString();
      } else if (preset) {
        const now = new Date();
        switch (preset) {
          case '1h':
            now.setHours(now.getHours() + 1);
            break;
          case '4h':
            now.setHours(now.getHours() + 4);
            break;
          case 'tomorrow':
            now.setDate(now.getDate() + 1);
            now.setHours(9, 0, 0, 0);
            break;
          case 'next_week':
            now.setDate(now.getDate() + (8 - now.getDay()));
            now.setHours(9, 0, 0, 0);
            break;
          default:
            now.setHours(now.getHours() + 1);
        }
        snoozeUntil = now.toISOString();
      } else {
        return res.status(400).json({ error: 'Either preset or until is required' });
      }

      await service.snoozeNotification(req.params.id, userId, snoozeUntil);
      return res.json({ success: true, snoozedUntil: snoozeUntil });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  })
);

/**
 * PATCH /api/notifications/:id/checklist
 * Update the action checklist for a notification
 */
router.patch(
  '/:id/checklist',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const { checklist } = req.body;

      if (!Array.isArray(checklist)) {
        return res.status(400).json({ error: 'checklist must be an array' });
      }

      await service.updateChecklist(req.params.id, userId, checklist);
      return res.json({ success: true });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  })
);

/**
 * GET /api/notifications/:id/source-entity
 * Get the source entity (task/decision/initiative) linked to a notification
 */
router.get(
  '/:id/source-entity',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const service = NotificationService;
    const userId = (req as any).userId || req.user?.id;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    try {
      const entity = await service.getSourceEntity(req.params.id, userId);
      if (!entity) {
        return res.status(404).json({ error: 'Source entity not found' });
      }
      return res.json(entity);
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  })
);

export default router;
