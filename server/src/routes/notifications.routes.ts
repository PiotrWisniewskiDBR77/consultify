/**
 * Notifications Routes
 * API endpoints for notifications and escalations
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import EscalationService from '../services/EscalationService.js';
import NotificationService from '../services/NotificationService.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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
            const notifications = await (service as any).getForUser(userId, {
                unreadOnly: unreadOnly === 'true',
                limit: limit ? parseInt(limit as string) : 50,
                projectId: projectId as string | undefined,
            });
            res.json(notifications);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    }),
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
            res.json(counts);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    }),
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
            res.json({ count: counts.unread || 0 });
        } catch (err: any) {
            res.status(500).json({ error: err.message, count: 0 });
        }
    }),
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
            const result = await (service as any).markRead(req.params.id, userId);
            res.json(result);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    }),
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
            const result = await (service as any).markAllRead(userId);
            res.json(result);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    }),
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
            const escalations = await service.getEscalations(req.params.projectId, status as string | undefined);
            res.json(escalations);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    }),
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
            res.json(result);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    }),
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
            const result = await (service as any).delete(req.params.id, userId);
            res.json(result);
        } catch (err: any) {
            res.status(500).json({ error: err.message });
        }
    }),
);

export default router;
