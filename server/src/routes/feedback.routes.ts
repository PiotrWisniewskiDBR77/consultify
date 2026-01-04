/**
 * Feedback Routes
 * API endpoints for system feedback
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { _verifyToken, type AuthRequest } from '../middleware/auth.middleware.js';
import NotificationService from '../services/NotificationService.js';
import WhatsAppService from '../services/WhatsAppService.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

/**
 * POST /api/feedback
 * Submit new feedback
 */
router.post(
    '/',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { userId, userEmail, userName, type, message, rating, severity, metadata } = req.body;

        if (!message || !type) {
            return res.status(400).json({ error: 'Message and type are required' });
        }

        const id = uuidv4();
        const sql = `INSERT INTO system_feedback (id, user_id, user_email, user_name, type, message, rating, status, metadata, created_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'NEW', ?, CURRENT_TIMESTAMP)`;

        const runResult = await dbRun(sql, [
            id,
            userId,
            userEmail,
            userName,
            type,
            message,
            rating,
            JSON.stringify(metadata || {}),
        ]);

        if (!runResult.success) {
            throw new Error(runResult.error || 'Failed to insert feedback');
        }

        // Send Notifications (Async)
        try {
            await WhatsAppService.sendNewFeedbackAlert({ userId, userEmail, type, message });
        } catch (e: unknown) {
            logger.warn('WhatsApp notification failed:', e);
        }

        // Create Internal Notification (Triggers Slack via NotificationService)
        try {
            const isCritical = severity === 'CRITICAL';
            const notificationType = isCritical ? 'CLIENT_TICKET' : 'USER_FEEDBACK';
            const notificationSeverity = isCritical ? 'WARNING' : 'INFO';

            await (NotificationService as any).create({
                userId: userId,
                organizationId: 'system',
                projectId: null,
                type: notificationType,
                severity: notificationSeverity,
                title: isCritical ? `Critical Feedback: ${type}` : `New Feedback: ${type}`,
                message: message.substring(0, 200) + (message.length > 200 ? '...' : ''),
                relatedObjectType: 'FEEDBACK',
                relatedObjectId: id,
                isActionable: true,
                actionUrl: '/admin?section=feedback',
            });
        } catch (noteErr) {
            logger.error('Failed to create notification for feedback:', noteErr);
        }

        res.json({ success: true, id });
    }),
);

/**
 * GET /api/feedback
 * List all feedback (Admin only)
 */
router.get(
    '/',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        const sql = `SELECT * FROM system_feedback ORDER BY created_at DESC`;

        const rows = await dbAll<{
            id: string;
            user_id: string | null;
            user_email: string | null;
            user_name: string | null;
            type: string;
            message: string;
            rating: number | null;
            status: string;
            metadata: string | null;
            admin_response: string | null;
            responded_at: string | null;
            created_at: string;
            updated_at: string | null;
        }>(sql, []);

        res.json(rows);
    }),
);

/**
 * PATCH /api/feedback/:id/status
 * Update feedback status
 */
router.patch(
    '/:id/status',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { status } = req.body;
        const { id } = req.params;

        const validStatuses = ['NEW', 'PENDING', 'IN_PROGRESS', 'REVIEWED', 'RESOLVED', 'ARCHIVED'];
        if (!validStatuses.includes(status.toUpperCase())) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const sql = `UPDATE system_feedback SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

        const runResult = await dbRun(sql, [status.toUpperCase(), id]);

        if (!runResult.success) {
            throw new Error(runResult.error || 'Failed to update feedback status');
        }

        res.json({ success: true });
    }),
);

/**
 * POST /api/feedback/:id/respond
 * Admin response to feedback
 */
router.post(
    '/:id/respond',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { response } = req.body;
        const { id } = req.params;

        if (!response || !response.trim()) {
            return res.status(400).json({ error: 'Response is required' });
        }

        const sql = `UPDATE system_feedback SET admin_response = ?, responded_at = CURRENT_TIMESTAMP, status = 'REVIEWED', updated_at = CURRENT_TIMESTAMP WHERE id = ?`;

        const runResult = await dbRun(sql, [response.trim(), id]);

        if (!runResult.success) {
            throw new Error(runResult.error || 'Failed to update feedback');
        }

        // Get the feedback to notify the user
        const feedback = await dbGet<{
            id: string;
            user_id: string | null;
            user_email: string | null;
            user_name: string | null;
            type: string;
            message: string;
            rating: number | null;
            status: string;
            metadata: string | null;
            admin_response: string | null;
            responded_at: string | null;
            created_at: string;
            updated_at: string | null;
        }>('SELECT * FROM system_feedback WHERE id = ?', [id]);

        if (feedback && feedback.user_id) {
            try {
                await (NotificationService as any).create({
                    userId: feedback.user_id,
                    organizationId: 'system',
                    projectId: null,
                    type: 'FEEDBACK_RESPONSE',
                    severity: 'INFO',
                    title: 'Odpowiedź na Twój feedback',
                    message: response.substring(0, 200) + (response.length > 200 ? '...' : ''),
                    relatedObjectType: 'FEEDBACK',
                    relatedObjectId: id,
                    isActionable: false,
                });
            } catch (noteErr) {
                logger.error('Failed to create response notification:', noteErr);
            }
        }

        res.json({ success: true });
    }),
);

/**
 * GET /api/feedback/:id
 * Get single feedback item
 */
router.get(
    '/:id',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;

        const row = await dbGet<{
            id: string;
            user_id: string | null;
            user_email: string | null;
            user_name: string | null;
            type: string;
            message: string;
            rating: number | null;
            status: string;
            metadata: string | null;
            admin_response: string | null;
            responded_at: string | null;
            created_at: string;
            updated_at: string | null;
        }>('SELECT * FROM system_feedback WHERE id = ?', [id]);

        if (!row) {
            return res.status(404).json({ error: 'Feedback not found' });
        }

        res.json(row);
    }),
);

/**
 * GET /api/feedback/stats/summary
 * Get feedback statistics
 */
router.get(
    '/stats/summary',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        const queries = {
            total: 'SELECT COUNT(*) as count FROM system_feedback',
            new: "SELECT COUNT(*) as count FROM system_feedback WHERE status = 'NEW'",
            pending: "SELECT COUNT(*) as count FROM system_feedback WHERE status IN ('PENDING', 'IN_PROGRESS')",
            bugs: "SELECT COUNT(*) as count FROM system_feedback WHERE type = 'bug' AND status != 'RESOLVED'",
            avgRating: 'SELECT AVG(rating) as avg FROM system_feedback WHERE rating IS NOT NULL',
        };

        const results: Record<string, number> = {};
        const promises = Object.entries(queries).map(async ([key, sql]) => {
            const row = await dbGet<{ avg?: number; count?: number }>(sql, []);
            results[key] = key === 'avgRating' ? row?.avg || 0 : row?.count || 0;
        });

        await Promise.all(promises);
        res.json(results);
    }),
);

export default router;
