/**
 * Budgets Routes
 * API endpoints for budget management
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Service interfaces
interface BudgetManagementServiceInterface {
    getBudgetStatus?: (orgId: string, userId?: string | null, projectId?: string) => Promise<unknown>;
    setUserBudget?: (orgId: string, userId: string, budget: unknown) => Promise<void>;
    setProjectBudget?: (orgId: string, projectId: string, budget: unknown) => Promise<void>;
}

type RequireOrgAccessMiddleware = (options: {
    roles: string[];
}) => Array<(req: unknown, res: unknown, next: () => void) => void>;

// Dynamic imports for services/middleware that may not be migrated yet
let budgetManagementService: BudgetManagementServiceInterface | null = null;
let requireOrgAccess: RequireOrgAccessMiddleware | null = null;

try {
    const budgetModule = await import('../services/budgetManagementService.js');
    budgetManagementService = (budgetModule.default || budgetModule) as unknown as BudgetManagementServiceInterface;
} catch {
    console.warn('[Budgets] budgetManagementService not available');
}

try {
    const rbacModule = await import('../../middleware/rbac.middleware.js');
    requireOrgAccess = (rbacModule as any).requireOrgAccess as RequireOrgAccessMiddleware;
} catch {
    console.warn('[Budgets] requireOrgAccess middleware not available');
}

/**
 * GET /api/budgets/user/:userId
 * Get user budget
 */
router.get(
    '/user/:userId',
    verifyToken,
    requireOrgAccess ? requireOrgAccess({ roles: ['administrator', 'owner'] }) : [],
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!budgetManagementService?.getBudgetStatus) {
            return res.status(503).json({ error: 'Budget service not available' });
        }

        try {
            const orgId = (req as { org?: { id?: string } }).org?.id || req.user?.organizationId;
            if (!orgId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { userId } = req.params;
            const userIdStr = Array.isArray(userId) ? userId[0] : userId;
            const budget = await budgetManagementService.getBudgetStatus(orgId, userIdStr);
            res.json({ budget });
        } catch (error: unknown) {
            console.error('[Budgets] Get user budget error:', error);
            return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get user budget' });
        }
    }),
);

/**
 * PUT /api/budgets/user/:userId
 * Set user budget
 */
router.put(
    '/user/:userId',
    verifyToken,
    requireOrgAccess ? requireOrgAccess({ roles: ['administrator', 'owner'] }) : [],
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!budgetManagementService?.setUserBudget) {
            return res.status(503).json({ error: 'Budget service not available' });
        }

        try {
            const orgId = (req as { org?: { id?: string } }).org?.id || req.user?.organizationId;
            if (!orgId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { userId } = req.params;
            const userIdStr = Array.isArray(userId) ? userId[0] : userId;
            const budget = req.body;
            await budgetManagementService.setUserBudget(orgId, userIdStr, budget);
            res.json({ success: true });
        } catch (error: unknown) {
            console.error('[Budgets] Set user budget error:', error);
            return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to set user budget' });
        }
    }),
);

/**
 * GET /api/budgets/project/:projectId
 * Get project budget
 */
router.get(
    '/project/:projectId',
    verifyToken,
    requireOrgAccess ? requireOrgAccess({ roles: ['administrator', 'owner'] }) : [],
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!budgetManagementService?.getBudgetStatus) {
            return res.status(503).json({ error: 'Budget service not available' });
        }

        try {
            const orgId = (req as { org?: { id?: string } }).org?.id || req.user?.organizationId;
            if (!orgId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { projectId } = req.params;
            const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;
            const budget = await budgetManagementService.getBudgetStatus(orgId, null, projectIdStr);
            res.json({ budget });
        } catch (error: unknown) {
            console.error('[Budgets] Get project budget error:', error);
            return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get project budget' });
        }
    }),
);

/**
 * PUT /api/budgets/project/:projectId
 * Set project budget
 */
router.put(
    '/project/:projectId',
    verifyToken,
    requireOrgAccess ? requireOrgAccess({ roles: ['administrator', 'owner'] }) : [],
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!budgetManagementService?.setProjectBudget) {
            return res.status(503).json({ error: 'Budget service not available' });
        }

        try {
            const orgId = (req as { org?: { id?: string } }).org?.id || req.user?.organizationId;
            if (!orgId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { projectId } = req.params;
            const projectIdStr = Array.isArray(projectId) ? projectId[0] : projectId;
            const budget = req.body;
            await budgetManagementService.setProjectBudget(orgId, projectIdStr, budget);
            res.json({ success: true });
        } catch (error: unknown) {
            console.error('[Budgets] Set project budget error:', error);
            return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to set project budget' });
        }
    }),
);

/**
 * GET /api/budgets/organization
 * Get organization budget
 */
router.get(
    '/organization',
    verifyToken,
    requireOrgAccess ? requireOrgAccess({ roles: ['administrator', 'owner'] }) : [],
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!budgetManagementService?.getBudgetStatus) {
            return res.status(503).json({ error: 'Budget service not available' });
        }

        try {
            const orgId = (req as { org?: { id?: string } }).org?.id || req.user?.organizationId;
            if (!orgId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const budget = await budgetManagementService.getBudgetStatus(orgId);
            res.json({ budget });
        } catch (error: unknown) {
            console.error('[Budgets] Get org budget error:', error);
            return res.status(500).json({
                error: error instanceof Error ? error.message : 'Failed to get organization budget',
            });
        }
    }),
);

/**
 * PUT /api/budgets/organization
 * Set organization budget
 */
router.put(
    '/organization',
    verifyToken,
    requireOrgAccess ? requireOrgAccess({ roles: ['administrator', 'owner'] }) : [],
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!budgetManagementService) {
            return res.status(503).json({ error: 'Budget service not available' });
        }

        try {
            const orgId = (req as { org?: { id?: string } }).org?.id || req.user?.organizationId;
            if (!orgId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const budget = req.body;
            await (budgetManagementService as any).setOrgBudget(orgId, budget);
            res.json({ success: true });
        } catch (error: unknown) {
            console.error('[Budgets] Set org budget error:', error);
            return res.status(500).json({
                error: error instanceof Error ? error.message : 'Failed to set organization budget',
            });
        }
    }),
);

/**
 * GET /api/budgets/status
 * Get status of all budgets
 */
router.get(
    '/status',
    verifyToken,
    requireOrgAccess ? requireOrgAccess({ roles: ['administrator', 'owner'] }) : [],
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!budgetManagementService?.getBudgetStatus) {
            return res.status(503).json({ error: 'Budget service not available' });
        }

        try {
            const orgId = (req as { org?: { id?: string } }).org?.id || req.user?.organizationId;
            if (!orgId) {
                return res.status(401).json({ error: 'Unauthorized' });
            }

            const { userId, projectId } = req.query;
            const budget = await budgetManagementService.getBudgetStatus(
                orgId,
                userId as string | undefined,
                projectId as string | undefined,
            );
            res.json({ budget });
        } catch (error: unknown) {
            console.error('[Budgets] Get budget status error:', error);
            return res.status(500).json({ error: error instanceof Error ? error.message : 'Failed to get budget status' });
        }
    }),
);

export default router;
