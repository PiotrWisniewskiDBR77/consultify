/**
 * AI Budgets Routes
 * API endpoints for AI spending budget management.
 * Delegates to aiBudgetService for all DB operations.
 */

import { Response, Router } from 'express';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../../middleware/auth.middleware.js';
import { requireRole } from '../../middleware/rbac.middleware.js';
import { validateBody } from '../../middleware/validation.middleware.js';
import aiBudgetService from '../../services/aiBudgetService.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import logger from '../../utils/Logger.js';

const CreateBudgetSchema = z.object({
  userId: z.string().optional(),
  budgetType: z.enum(['cost', 'tokens', 'requests']).default('cost'),
  period: z.enum(['daily', 'weekly', 'monthly', 'yearly']).default('monthly'),
  budgetLimit: z.number(),
  warningThreshold: z.number().optional(),
  hardLimit: z.boolean().optional(),
});

const router = Router();

// ====== BUDGET MANAGEMENT ======

router.get(
  '/budgets',
  verifyToken,
  requireRole('super_admin', 'admin', 'owner'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId || req.organizationId;
      if (!organizationId) {
        return res.status(403).json({ success: false, error: 'Organization access required' });
      }
      const includeUserBudgets =
        String(req.query.includeUserBudgets || '').toLowerCase() !== 'false';
      const budgets = await aiBudgetService.getOrganizationBudgets(
        organizationId,
        includeUserBudgets
      );
      return res.json({ success: true, data: budgets });
    } catch (error: unknown) {
      logger.error('[AI Budgets] List budgets error:', error);
      return res.status(500).json({ success: false, error: 'Failed to list budgets' });
    }
  })
);

router.post(
  '/budgets',
  verifyToken,
  requireRole('super_admin', 'admin', 'owner'),
  validateBody(CreateBudgetSchema),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId || req.organizationId;
      const createdBy = req.user?.id;
      if (!organizationId || !createdBy) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }

      const { userId, budgetType, period, budgetLimit, warningThreshold, hardLimit } = req.body;

      const result = await aiBudgetService.createBudget(organizationId, {
        userId,
        budgetType: budgetType ?? 'cost',
        period: period ?? 'monthly',
        budgetLimit,
        warningThreshold,
        hardLimit: hardLimit ? 1 : 0,
        createdBy,
      });

      return res.status(201).json({ success: true, data: result });
    } catch (error: unknown) {
      logger.error('[AI Budgets] Create budget error:', error);
      return res.status(500).json({ success: false, error: 'Failed to create budget' });
    }
  })
);

router.get(
  '/budgets/:id',
  verifyToken,
  requireRole('super_admin', 'admin', 'owner'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const budget = await aiBudgetService.getBudget(req.params.id);
      if (!budget) {
        return res.status(404).json({ success: false, error: 'Budget not found' });
      }
      const organizationId = req.user?.organizationId || req.organizationId;
      if (budget.organizationId !== organizationId) {
        return res.status(404).json({ success: false, error: 'Budget not found' });
      }
      return res.json({ success: true, data: budget });
    } catch (error: unknown) {
      logger.error('[AI Budgets] Get budget error:', error);
      return res.status(500).json({ success: false, error: 'Failed to get budget' });
    }
  })
);

router.put(
  '/budgets/:id',
  verifyToken,
  requireRole('super_admin', 'admin', 'owner'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const result = await aiBudgetService.updateBudget(req.params.id, req.body);
      if (!result.updated) {
        return res
          .status(404)
          .json({ success: false, error: 'Budget not found or no changes made' });
      }
      return res.json({ success: true, message: 'Budget updated successfully' });
    } catch (error: unknown) {
      logger.error('[AI Budgets] Update budget error:', error);
      return res.status(500).json({ success: false, error: 'Failed to update budget' });
    }
  })
);

router.delete(
  '/budgets/:id',
  verifyToken,
  requireRole('super_admin', 'admin', 'owner'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const result = await aiBudgetService.deleteBudget(req.params.id);
      if (!result.deleted) {
        return res.status(404).json({ success: false, error: 'Budget not found' });
      }
      return res.json({ success: true, message: 'Budget deleted successfully' });
    } catch (error: unknown) {
      logger.error('[AI Budgets] Delete budget error:', error);
      return res.status(500).json({ success: false, error: 'Failed to delete budget' });
    }
  })
);

router.post(
  '/budgets/:id/reset',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const result = await aiBudgetService.resetBudgetUsage(req.params.id);
      if (!result.reset) {
        return res.status(404).json({ success: false, error: 'Budget not found' });
      }
      return res.json({ success: true, data: result, message: 'Budget reset successfully' });
    } catch (error: unknown) {
      logger.error('[AI Budgets] Reset budget error:', error);
      return res.status(500).json({ success: false, error: 'Failed to reset budget' });
    }
  })
);

// ====== USAGE & CHECKING ======

router.get(
  '/check',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { tokens, cost } = req.query;
      const organizationId = req.user?.organizationId || req.organizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const result = await aiBudgetService.checkBudget(organizationId, userId, {
        tokens: parseInt(tokens as string) || 0,
        cost: parseFloat(cost as string) || 0,
      });
      return res.json({ success: true, data: result });
    } catch (error: unknown) {
      logger.error('[AI Budgets] Check budget error:', error);
      return res.status(500).json({ success: false, error: 'Failed to check budget' });
    }
  })
);

router.post(
  '/record',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { model, inputTokens, outputTokens, requestCount } = req.body;
      const organizationId = req.user?.organizationId || req.organizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const result = await aiBudgetService.recordUsage(organizationId, userId, {
        model,
        inputTokens,
        outputTokens,
        requestCount,
      });
      return res.json({ success: true, data: result });
    } catch (error: unknown) {
      logger.error('[AI Budgets] Record usage error:', error);
      return res.status(500).json({ success: false, error: 'Failed to record usage' });
    }
  })
);

router.get(
  '/stats',
  verifyToken,
  requireRole('super_admin', 'admin', 'owner'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId || req.organizationId;
      if (!organizationId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const { startDate, endDate, groupBy } = req.query;
      const stats = await aiBudgetService.getUsageStats(organizationId, {
        startDate: startDate as string | undefined,
        endDate: endDate as string | undefined,
        groupBy: groupBy as string | undefined,
      });
      return res.json({ success: true, data: stats });
    } catch (error: unknown) {
      logger.error('[AI Budgets] Get stats error:', error);
      return res.status(500).json({ success: false, error: 'Failed to get statistics' });
    }
  })
);

// ====== ALERTS ======

router.get(
  '/alerts',
  verifyToken,
  requireRole('super_admin', 'admin', 'owner'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId || req.organizationId;
      if (!organizationId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const { status, alertType, limit, offset } = req.query;
      const alerts = await aiBudgetService.getAlerts(organizationId, {
        status: status as string | undefined,
        alertType: alertType as string | undefined,
        limit: parseInt(limit as string) || 100,
        offset: parseInt(offset as string) || 0,
      });
      return res.json({ success: true, data: alerts });
    } catch (error: unknown) {
      logger.error('[AI Budgets] List alerts error:', error);
      return res.status(500).json({ success: false, error: 'Failed to list alerts' });
    }
  })
);

router.post(
  '/alerts/:id/acknowledge',
  verifyToken,
  requireRole('super_admin', 'admin', 'owner'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const result = await aiBudgetService.acknowledgeAlert(req.params.id, userId);
      if (!result.acknowledged) {
        return res.status(404).json({ success: false, error: 'Alert not found' });
      }
      return res.json({ success: true, message: 'Alert acknowledged' });
    } catch (error: unknown) {
      logger.error('[AI Budgets] Acknowledge alert error:', error);
      return res.status(500).json({ success: false, error: 'Failed to acknowledge alert' });
    }
  })
);

router.post(
  '/alerts/:id/dismiss',
  verifyToken,
  requireRole('super_admin', 'admin', 'owner'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const result = await aiBudgetService.dismissAlert(req.params.id);
      if (!result.dismissed) {
        return res.status(404).json({ success: false, error: 'Alert not found' });
      }
      return res.json({ success: true, message: 'Alert dismissed' });
    } catch (error: unknown) {
      logger.error('[AI Budgets] Dismiss alert error:', error);
      return res.status(500).json({ success: false, error: 'Failed to dismiss alert' });
    }
  })
);

// ====== MODEL PERMISSIONS ======

router.get(
  '/model-permissions',
  verifyToken,
  requireRole('super_admin', 'admin', 'owner'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId || req.organizationId;
      if (!organizationId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const { scopeType, scopeId } = req.query;
      const permissions = await aiBudgetService.getModelPermissions(
        organizationId,
        scopeType as string | undefined,
        scopeId as string | undefined
      );
      return res.json({ success: true, data: permissions });
    } catch (error: unknown) {
      logger.error('[AI Budgets] List model permissions error:', error);
      return res.status(500).json({ success: false, error: 'Failed to list model permissions' });
    }
  })
);

router.post(
  '/model-permissions',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const { scopeType, scopeId, modelId, modelProvider, isAllowed, maxTokensPerRequest, dailyTokenLimit, priority } =
        req.body;
      const organizationId = req.user?.organizationId || req.organizationId;
      const userId = req.user?.id;
      if (!organizationId || !userId) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      if (!modelId || !modelProvider) {
        return res.status(400).json({
          success: false,
          error: 'modelId and modelProvider are required',
        });
      }
      const result = await aiBudgetService.setModelPermission(organizationId, {
        scopeType: scopeType || 'organization',
        scopeId: scopeId || organizationId,
        modelId,
        modelProvider,
        isAllowed,
        maxTokensPerRequest,
        dailyTokenLimit,
        priority,
        createdBy: userId,
      });
      return res.json({ success: true, data: result, message: 'Model permission set successfully' });
    } catch (error: unknown) {
      logger.error('[AI Budgets] Set model permission error:', error);
      return res.status(500).json({ success: false, error: 'Failed to set model permission' });
    }
  })
);

router.get(
  '/model-access',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const organizationId = req.user?.organizationId || req.organizationId;
      const userId = req.user?.id;
      const userRole = req.user?.role;
      if (!organizationId || !userId || !userRole) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      if (!req.query.modelId) {
        return res.status(400).json({ success: false, error: 'modelId is required' });
      }
      const result = await aiBudgetService.checkModelAccess(
        organizationId,
        userId,
        userRole,
        req.query.modelId as string
      );
      return res.json({ success: true, data: result });
    } catch (error: unknown) {
      logger.error('[AI Budgets] Check model access error:', error);
      return res.status(500).json({ success: false, error: 'Failed to check model access' });
    }
  })
);

router.delete(
  '/model-permissions/:id',
  verifyToken,
  requireRole('super_admin', 'admin'),
  asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
      const result = await aiBudgetService.deleteModelPermission(req.params.id);
      if (!result.deleted) {
        return res.status(404).json({ success: false, error: 'Permission not found' });
      }
      return res.json({ success: true, message: 'Model permission deleted successfully' });
    } catch (error: unknown) {
      logger.error('[AI Budgets] Delete model permission error:', error);
      return res.status(500).json({ success: false, error: 'Failed to delete model permission' });
    }
  })
);

// ====== MODEL COSTS ======

router.get(
  '/model-costs',
  verifyToken,
  asyncHandler(async (_req: AuthRequest, res: Response) => {
    return res.json({ success: true, data: aiBudgetService.getModelCosts() });
  })
);

router.post(
  '/estimate-cost',
  verifyToken,
  asyncHandler(async (req: AuthRequest, res: Response) => {
    const { model, inputTokens, outputTokens } = req.body;
    const cost = aiBudgetService.estimateCost(model, inputTokens || 0, outputTokens || 0);
    return res.json({
      success: true,
      data: { model, inputTokens, outputTokens, estimatedCost: cost },
    });
  })
);

export default router;
