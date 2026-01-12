/**
 * PMO Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All PMO-related API endpoints
 */

import { Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import type { AuthenticatedRequest, Response } from '../types/index.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Apply auth middleware to all routes
router.use(verifyToken);

// ==========================================
// PMO HEALTH
// ==========================================

/**
 * GET /api/pmo/health/:projectId
 * Returns canonical PMOHealthSnapshot for a project
 */
router.get(
    '/health/:projectId',
    asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
        const { projectId } = req.params;

        const { getHealthSnapshot } = await import('../../services/pmoHealthService.js');
        const snapshot = await getHealthSnapshot(projectId);

        res.json(snapshot);
    }),
);

export default router;
