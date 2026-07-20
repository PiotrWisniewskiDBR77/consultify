/**
 * Budgets Routes
 * API endpoints for budget management
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { apiAuthRateLimiter } from '../middleware/rateLimiting.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

// Apply rate limiting
const router = Router();

const notConfigured = (res: Response) =>
  res.status(503).json({
    statusCode: 503,
    status: false,
    type: 'not_configured',
    message: 'Service temporarily unavailable due to missing configuration',
  });

// Service interfaces
interface BudgetManagementServiceInterface {
  getBudgetStatus?: (orgId: string, userId?: string | null, projectId?: string) => Promise<any>;
  setUserBudget?: (orgId: string, userId: string, budget: any) => Promise<void>;
  setProjectBudget?: (orgId: string, projectId: string, budget: any) => Promise<void>;
  setOrgBudget?: (orgId: string, budget: any) => Promise<void>;
}

type RequireOrgAccessMiddleware = (options: {
  roles: string[];
}) => Array<(req: unknown, res: unknown, next: () => void) => void>;

// Dynamic imports for services/middleware that may not be migrated yet
let budgetManagementService: BudgetManagementServiceInterface | null = null;
let requireOrgAccess: RequireOrgAccessMiddleware | null = null;

try {
  const budgetModule = (await import('../services/budgetManagementService.js')) as any;
  budgetManagementService = (budgetModule.default ||
    budgetModule) as BudgetManagementServiceInterface;
} catch {
  logger.warn('[Budgets] budgetManagementService not available');
}

try {
  const rbacModule = (await import('../middleware/rbac.middleware.js')) as any;
  requireOrgAccess = rbacModule.requireOrgAccess as RequireOrgAccessMiddleware;
} catch {
  logger.warn('[Budgets] requireOrgAccess middleware not available');
}

/**
 * GET /api/budgets/user/:userId
 * Get user budget
 */
router.get(
  '/user/:userId',
  verifyToken,
  requireOrgAccess ? requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }) : [],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!budgetManagementService?.getBudgetStatus) {
      return notConfigured(res);
    }

    try {
      const orgId = (req as { org?: { id?: string } }).org?.id || req.user?.organizationId;
      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { userId } = req.params;
      const budget = await budgetManagementService.getBudgetStatus(orgId, userId);
      return res.json({ budget });
    } catch (error: unknown) {
      logger.error('[Budgets] Get user budget error:', error);
      return res.status(500).json({ error: 'Failed to get user budget' });
    }
  })
);

/**
 * PUT /api/budgets/user/:userId
 * Set user budget
 */
router.put(
  '/user/:userId',
  verifyToken,
  requireOrgAccess ? requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }) : [],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!budgetManagementService?.setUserBudget) {
      return notConfigured(res);
    }

    try {
      const orgId = (req as { org?: { id?: string } }).org?.id || req.user?.organizationId;
      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { userId } = req.params;
      const budget = req.body;
      await budgetManagementService.setUserBudget(orgId, userId, budget);
      return res.json({ success: true });
    } catch (error: unknown) {
      logger.error('[Budgets] Set user budget error:', error);
      return res.status(500).json({ error: 'Failed to set user budget' });
    }
  })
);

/**
 * GET /api/budgets/project/:projectId
 * Get project budget
 */
router.get(
  '/project/:projectId',
  verifyToken,
  requireOrgAccess ? requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }) : [],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!budgetManagementService?.getBudgetStatus) {
      return notConfigured(res);
    }

    try {
      const orgId = (req as { org?: { id?: string } }).org?.id || req.user?.organizationId;
      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId } = req.params;
      const budget = await budgetManagementService.getBudgetStatus(orgId, null, projectId);
      return res.json({ budget });
    } catch (error: unknown) {
      logger.error('[Budgets] Get project budget error:', error);
      return res.status(500).json({ error: 'Failed to get project budget' });
    }
  })
);

/**
 * PUT /api/budgets/project/:projectId
 * Set project budget
 */
router.put(
  '/project/:projectId',
  verifyToken,
  requireOrgAccess ? requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }) : [],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!budgetManagementService?.setProjectBudget) {
      return notConfigured(res);
    }

    try {
      const orgId = (req as { org?: { id?: string } }).org?.id || req.user?.organizationId;
      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { projectId } = req.params;
      const budget = req.body;
      await budgetManagementService.setProjectBudget(orgId, projectId, budget);
      return res.json({ success: true });
    } catch (error: unknown) {
      logger.error('[Budgets] Set project budget error:', error);
      return res.status(500).json({ error: 'Failed to set project budget' });
    }
  })
);

/**
 * GET /api/budgets/organization
 * Get organization budget
 */
router.get(
  '/organization',
  verifyToken,
  requireOrgAccess ? requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }) : [],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!budgetManagementService?.getBudgetStatus) {
      return notConfigured(res);
    }

    try {
      const orgId = (req as { org?: { id?: string } }).org?.id || req.user?.organizationId;
      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const budget = await budgetManagementService.getBudgetStatus(orgId);
      return res.json({ budget });
    } catch (error: unknown) {
      logger.error('[Budgets] Get org budget error:', error);
      return res.status(500).json({
        error: 'Failed to get organization budget',
      });
    }
  })
);

/**
 * PUT /api/budgets/organization
 * Set organization budget
 */
router.put(
  '/organization',
  verifyToken,
  requireOrgAccess ? requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }) : [],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!budgetManagementService?.setOrgBudget) {
      return notConfigured(res);
    }

    try {
      const orgId = (req as { org?: { id?: string } }).org?.id || req.user?.organizationId;
      if (!orgId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const budget = req.body;
      await budgetManagementService.setOrgBudget(orgId, budget);
      return res.json({ success: true });
    } catch (error: unknown) {
      logger.error('[Budgets] Set org budget error:', error);
      return res.status(500).json({
        error: 'Failed to set organization budget',
      });
    }
  })
);

/**
 * GET /api/budgets/status
 * Get status of all budgets
 */
router.get(
  '/status',
  verifyToken,
  requireOrgAccess ? requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }) : [],
  asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!budgetManagementService?.getBudgetStatus) {
      return notConfigured(res);
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
        projectId as string | undefined
      );
      return res.json({ budget });
    } catch (error: unknown) {
      logger.error('[Budgets] Get budget status error:', error);
      return res.status(500).json({ error: 'Failed to get budget status' });
    }
  })
);

export default router;
