/**
 * Execution Routes
 * API endpoints for execution monitoring
 * 
 * Fully migrated to TypeScript ES modules
 */

import { Router, Response } from 'express';
import { verifyToken, type AuthRequest } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

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
    const executionModule = await import('../../services/executionService.js');
    ExecutionService = (executionModule.default || executionModule) as ExecutionServiceInterface;
} catch {
    console.warn('[Execution Routes] ExecutionService not available');
}

/**
 * GET /api/execution/:projectId/summary
 * Get execution summary for a project
 */
router.get('/:projectId/summary', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!ExecutionService?.getExecutionSummary) {
        return res.status(503).json({ error: 'Execution service not available' });
    }

    try {
        const summary = await ExecutionService.getExecutionSummary(req.params.projectId);
        res.json(summary);
    } catch (err: unknown) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
}));

/**
 * GET /api/execution/:projectId/blockers
 * Get blocked tasks with reasons
 */
router.get('/:projectId/blockers', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!ExecutionService?.getBlockedTasks) {
        return res.status(503).json({ error: 'Execution service not available' });
    }

    try {
        const blockers = await ExecutionService.getBlockedTasks(req.params.projectId);
        res.json(blockers);
    } catch (err: unknown) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
}));

/**
 * POST /api/execution/:projectId/gate-check
 * Check if project can advance phase (Decision Gate)
 */
router.post('/:projectId/gate-check', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!ExecutionService?.checkDecisionGate) {
        return res.status(503).json({ error: 'Execution service not available' });
    }

    try {
        const { targetPhase } = req.body;
        const result = await ExecutionService.checkDecisionGate(req.params.projectId, targetPhase);
        res.json(result);
    } catch (err: unknown) {
        res.status(500).json({ error: err instanceof Error ? err.message : 'Unknown error' });
    }
}));

export default router;
