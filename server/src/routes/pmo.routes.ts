/**
 * PMO Routes
 * Enterprise SaaS Architecture - TypeScript Backend
 * 
 * All PMO-related API endpoints
 */

import { Router } from 'express';
import { verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import type { AuthenticatedRequest, Response } from '../types/index.js';

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
router.get('/health/:projectId', asyncHandler(async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const { projectId } = req.params;
    
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const PMOHealthService = require('../../services/pmoHealthService');
    const snapshot = await PMOHealthService.getHealthSnapshot(projectId);

    res.json(snapshot);
}));

export default router;
