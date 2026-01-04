/**
 * Sessions Routes
 * API endpoints for managing user sessions across devices
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { authRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, get as _dbGet, run as dbRun } from '../utils/DbPromise.ts';

const router = Router();

// Apply rate limiting
router.use(authRateLimiter);

/**
 * GET /api/sessions
 * Get all active sessions for current user
 */
router.get(
    '/',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const currentSessionId = (req as AuthRequest & { sessionId?: string }).sessionId;

        const sessions = await dbAll<{
            id: string;
            device: string;
            ip_address: string;
            last_active: string;
            created_at: string;
        }>(
            `SELECT id, device, ip_address, last_active, created_at
         FROM active_sessions 
         WHERE user_id = ?
         ORDER BY last_active DESC`,
            [userId],
        );

        // Mark current session
        const sessionsWithCurrent = sessions.map((s) => ({
            ...s,
            isCurrent: s.id === currentSessionId,
        }));

        res.json({
            success: true,
            data: sessionsWithCurrent,
        });
    }),
);

/**
 * POST /api/sessions
 * Create a new session (called on login)
 */
router.post(
    '/',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { device, ipAddress } = req.body;

        const id = uuidv4();
        const runResult = await dbRun(
            `INSERT INTO active_sessions (id, user_id, device, ip_address, last_active, created_at)
         VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [id, userId, device || 'Unknown Device', ipAddress || req.ip],
        );

        if (!runResult.success) {
            throw new Error(runResult.error || 'Failed to create session');
        }

        res.json({
            success: true,
            data: { sessionId: id },
        });
    }),
);

/**
 * PUT /api/sessions/:id/activity
 * Update session last_active timestamp
 */
router.put(
    '/:id/activity',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { id } = req.params;

        const runResult = await dbRun(
            `UPDATE active_sessions 
         SET last_active = datetime('now')
         WHERE id = ? AND user_id = ?`,
            [id, userId],
        );

        if (!runResult.success) {
            throw new Error(runResult.error || 'Failed to update session activity');
        }

        res.json({ success: true });
    }),
);

/**
 * DELETE /api/sessions/:id
 * Terminate a specific session
 */
router.delete(
    '/:id',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { id } = req.params;

        const runResult = await dbRun(`DELETE FROM active_sessions WHERE id = ? AND user_id = ?`, [id, userId]);

        if (!runResult.success) {
            throw new Error(runResult.error || 'Failed to terminate session');
        }

        res.json({
            success: true,
            message: 'Session terminated',
        });
    }),
);

/**
 * DELETE /api/sessions
 * Terminate all sessions except current
 */
router.delete(
    '/',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const currentSessionId = (req as AuthRequest & { sessionId?: string }).sessionId;

        const runResult = await dbRun(`DELETE FROM active_sessions WHERE user_id = ? AND id != ?`, [
            userId,
            currentSessionId || '',
        ]);

        if (!runResult.success) {
            throw new Error(runResult.error || 'Failed to terminate sessions');
        }

        res.json({
            success: true,
            message: 'All other sessions terminated',
        });
    }),
);

export default router;
