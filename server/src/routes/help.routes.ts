/**
 * Help Routes
 * API endpoints for help system and playbooks
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

const router = Router();

/**
 * GET /api/help/playbooks
 * List all help playbooks
 */
router.get(
    '/playbooks',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const playbooks = await dbAll<any>(
                `SELECT * FROM help_playbooks WHERE status = 'published' ORDER BY created_at DESC`,
                [],
            );
            return res.json({ 
                success: true, 
                playbooks: playbooks || [],
                recommendedKey: playbooks?.[0]?.key || 'getting-started'
            });
        } catch (error: any) {
            logger.error('[Help] Error fetching playbooks:', error);
            return res.json({ 
                success: true, 
                playbooks: [],
                recommendedKey: 'getting-started'
            });
        }
    }),
);

/**
 * GET /api/help/playbooks/:id
 * Get single playbook
 */
router.get(
    '/playbooks/:id',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;

        try {
            const playbooks = await dbAll<any>(`SELECT * FROM help_playbooks WHERE id = ?`, [id]);

            if (!playbooks || playbooks.length === 0) {
                return res.status(404).json({ error: 'Playbook not found' });
            }

            return res.json({ success: true, data: playbooks[0] });
        } catch (error: any) {
            logger.error('[Help] Error fetching playbook:', error);
            return res.status(500).json({ error: 'Failed to fetch playbook' });
        }
    }),
);

/**
 * GET /api/help/articles
 * Search help articles
 */
router.get(
    '/articles',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { q } = req.query;

        // Return empty array for search (stub implementation)
        return res.json({
            success: true,
            data: [],
            query: q || '',
        });
    }),
);

/**
 * GET /api/help/categories
 * List help categories
 */
router.get(
    '/categories',
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        return res.json({
            success: true,
            data: [
                { id: 'getting-started', name: 'Getting Started', count: 5 },
                { id: 'projects', name: 'Projects', count: 10 },
                { id: 'teams', name: 'Teams', count: 8 },
                { id: 'billing', name: 'Billing', count: 3 },
            ],
        });
    }),
);

/**
 * POST /api/help/events
 * Log help event (e.g., user viewed article, clicked help button)
 */
router.post(
    '/events',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { eventType, articleId, metadata } = req.body;
        const userId = req.user?.id;

        // Log help event (stub - in production would save to database)
        logger.info(`[Help] Event logged: ${eventType} by user ${userId}`, {
            articleId,
            metadata,
        });

        return res.json({
            success: true,
            message: 'Event logged',
            eventId: `evt-${Date.now()}`
        });
    }),
);

export default router;
