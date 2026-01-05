/**
 * Execution Routes
 * API endpoints for execution monitoring
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { authRateLimiter } from '../../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

// Apply rate limiting
const router = Router();

// Service interfaces
interface ExecutionServiceInterface {
    getExecutionSummary?: (projectId: string) => Promise<unknown>;
    getBlockedTasks?: (projectId: string) => Promise<unknown>;
    checkDecisionGate?: (projectId: string, targetPhase: string) => Promise<unknown>;
}

// Dynamic import for ExecutionService (may not be migrated yet)
let ExecutionService: ExecutionServiceInterface | null = null;

try {
//     const executionModule = (await import('../../services/executionService.js')) as any;
    ExecutionService = (executionModule.default || executionModule) as ExecutionServiceInterface;
} catch {
    logger.warn('[Execution Routes] ExecutionService not available');
}

/**
 * GET /api/execution/:projectId/summary
 * Get execution summary for a project
 */
router.get(
    '/:projectId/summary',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!ExecutionService?.getExecutionSummary) {
            return res.status(503).json({ error: 'Execution service not available' });
        }

        try {
            const summary = await ExecutionService.getExecutionSummary(req.params.projectId);
            return res.json(summary);
        } catch (err: any) {
            return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
        }
    }),
);

/**
 * GET /api/execution/:projectId/blockers
 * Get blocked tasks with reasons
 */
router.get(
    '/:projectId/blockers',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!ExecutionService?.getBlockedTasks) {
            return res.status(503).json({ error: 'Execution service not available' });
        }

        try {
            const blockers = await ExecutionService.getBlockedTasks(req.params.projectId);
            return res.json(blockers);
        } catch (err: any) {
            return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
        }
    }),
);

/**
 * POST /api/execution/:projectId/gate-check
 * Check if project can advance phase (Decision Gate)
 */
router.post(
    '/:projectId/gate-check',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!ExecutionService?.checkDecisionGate) {
            return res.status(503).json({ error: 'Execution service not available' });
        }

        try {
            const { targetPhase } = req.body;
            const result = await ExecutionService.checkDecisionGate(req.params.projectId, targetPhase);
            return res.json(result);
        } catch (err: any) {
            return res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
        }
    }),
);

export default router;
