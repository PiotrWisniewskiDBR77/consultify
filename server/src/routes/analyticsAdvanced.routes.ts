/**
 * AnalyticsAdvanced Routes
 * API endpoints for advanced analytics
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { verifyAdmin } from '../middleware/admin.middleware.js';
import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Service interfaces
interface CohortServiceInterface {
    getRetentionMatrix?: () => Promise<unknown>;
}

interface ExperimentServiceInterface {
    getAllUserExperiments?: (userId: string) => Promise<unknown>;
}

// Dynamic imports for services (may not be migrated yet)
let CohortService: CohortServiceInterface | null = null;
let ExperimentService: ExperimentServiceInterface | null = null;

try {
    const cohortModule = await import('../../services/cohortService.js');
    CohortService = (cohortModule.default || cohortModule) as CohortServiceInterface;
} catch {
    console.warn('[AnalyticsAdvanced Routes] CohortService not available');
}

try {
    const experimentModule = await import('../../services/experimentService.js');
    ExperimentService = (experimentModule.default || experimentModule) as ExperimentServiceInterface;
} catch {
    console.warn('[AnalyticsAdvanced Routes] ExperimentService not available');
}

/**
 * GET /api/analytics/cohorts
 * Cohort Matrix (Admin only)
 */
router.get(
    '/cohorts',
    verifyToken,
    verifyAdmin,
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        if (!CohortService?.getRetentionMatrix) {
            return res.status(503).json({ error: 'Cohort service not available' });
        }

        try {
            const matrix = await CohortService.getRetentionMatrix();
            res.json({ success: true, matrix });
        } catch (error: unknown) {
            console.error('Cohort analysis error:', error);
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }),
);

/**
 * GET /api/experiments/me
 * User's feature flags
 */
router.get(
    '/experiments/me',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!ExperimentService?.getAllUserExperiments) {
            return res.status(503).json({ error: 'Experiment service not available' });
        }

        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const flags = await ExperimentService.getAllUserExperiments(userId);
            res.json({ success: true, flags });
        } catch (error: unknown) {
            console.error('Experiment assignment error:', error);
            res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
        }
    }),
);

export default router;
