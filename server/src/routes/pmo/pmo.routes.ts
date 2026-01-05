/**
 * PMO Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 *
 * All PMO-related API endpoints
 */

import { Response, Router } from 'express';

import { verifyToken } from '../../middleware/auth.middleware.js';
import { authRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import type { AuthenticatedRequest } from '../../types/index.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

const router = Router();

// Apply rate limiting
router.use(authRateLimiter);

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
    asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
        const { projectId } = req.params;

        const { getHealthSnapshot } = (await import('../../services/pmoHealthService.js')) as any;
        const snapshot = await getHealthSnapshot(projectId);

        return res.json(snapshot);
    }),
);

export default router;
