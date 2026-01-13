/**
 * PMO Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All PMO-related API endpoints
 */

import { Response, Router } from 'express';

import { verifyToken } from '../middleware/auth.middleware.js';
import type { AuthenticatedRequest } from '../types/index.js';
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

        const pmoModule = await import('../../src/services/pmoHealthService.js');
        const getHealthSnapshot = (pmoModule as any).getHealthSnapshot || (pmoModule.default as any)?.getHealthSnapshot;
        const snapshot = await getHealthSnapshot(projectId);

        res.json(snapshot);
    }),
);

export default router;
