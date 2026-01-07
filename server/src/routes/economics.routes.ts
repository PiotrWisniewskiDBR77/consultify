/**
 * Economics Routes
 * API endpoints for economics/digitization analyses
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { all as dbAll, run as dbRun, get as dbGet } from '../utils/DbPromise.js';
import logger from '../utils/Logger.js';

console.log('[Economics Routes] Module loaded - TypeScript version');
console.log('[Economics Routes] Router type:', typeof Router);
const router = Router();
console.log('[Economics Routes] Router created. Stack length:', router.stack?.length);

/**
 * GET /api/economics/analyses
 * List all analyses for organization
 */
router.get(
    '/analyses',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const orgId = req.user?.organizationId || (req.user as any)?.organization_id;

        if (!orgId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const analyses = await dbAll<any>(
                `SELECT * FROM economics_analyses WHERE organization_id = ? ORDER BY created_at DESC`,
                [orgId],
            );
            return res.json({ success: true, data: analyses });
        } catch (error: any) {
            logger.error('[Economics] Error fetching analyses:', error);
            return res.json({ success: true, data: [] });
        }
    }),
);

console.log('[Economics Routes] After /analyses route. Stack length:', router.stack?.length);

/**
 * GET /api/economics/stats
 * Get catalog statistics
 */
router.get(
    '/stats',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const orgId = req.user?.organizationId || (req.user as any)?.organization_id;

        if (!orgId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const countResult = await dbGet<{ count: number }>(
                `SELECT COUNT(*) as count FROM economics_analyses WHERE organization_id = ?`,
                [orgId],
            );

            return res.json({
                success: true,
                data: {
                    totalAnalyses: countResult?.count || 0,
                    completedAnalyses: 0,
                    pendingAnalyses: 0,
                },
            });
        } catch (error: any) {
            logger.error('[Economics] Error fetching stats:', error);
            return res.json({
                success: true,
                data: {
                    totalAnalyses: 0,
                    completedAnalyses: 0,
                    pendingAnalyses: 0,
                },
            });
        }
    }),
);

/**
 * POST /api/economics/analyses
 * Create new analysis
 */
router.post(
    '/analyses',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const orgId = req.user?.organizationId || (req.user as any)?.organization_id;

        if (!orgId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name, description, projectId, tags } = req.body;
        const id = uuidv4();

        try {
            await dbRun(
                `INSERT INTO economics_analyses (id, organization_id, project_id, analysis_type, data, status) 
                 VALUES (?, ?, ?, ?, ?, ?)`,
                [id, orgId, projectId || null, 'general', JSON.stringify({ name, description, tags }), 'pending'],
            );

            return res.status(201).json({
                success: true,
                data: {
                    id,
                    name,
                    description,
                    projectId,
                    status: 'pending',
                    createdAt: new Date().toISOString(),
                },
            });
        } catch (error: any) {
            logger.error('[Economics] Error creating analysis:', error);
            return res.status(500).json({ error: 'Failed to create analysis' });
        }
    }),
);

/**
 * GET /api/economics/analyses/:id
 * Get single analysis
 */
router.get(
    '/analyses/:id',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { id } = req.params;
        const orgId = req.user?.organizationId || (req.user as any)?.organization_id;

        if (!orgId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        try {
            const analysis = await dbGet<any>(
                `SELECT * FROM economics_analyses WHERE id = ? AND organization_id = ?`,
                [id, orgId],
            );

            if (!analysis) {
                return res.status(404).json({ error: 'Analysis not found' });
            }

            return res.json({ success: true, data: analysis });
        } catch (error: any) {
            logger.error('[Economics] Error fetching analysis:', error);
            return res.status(500).json({ error: 'Failed to fetch analysis' });
        }
    }),
);

export default router;
