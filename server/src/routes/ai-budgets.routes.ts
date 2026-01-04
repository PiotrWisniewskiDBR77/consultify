/**
 * AI Budgets Routes
 * API endpoints for AI spending budget management
 *
 * Fully migrated to TypeScript ES modules
 */

import { Response, Router } from 'express';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import logger from '../utils/Logger.js';

const router = Router();

// Service interfaces
interface AIBudgetServiceInterface {
    getOrganizationBudgets?: (organizationId: string, includeUserBudgets?: boolean) => Promise<unknown[]>;
    createBudget?: (
        organizationId: string,
        data: {
            userId?: string;
            budgetType: string;
            period: string;
            budgetLimit: number;
            warningThreshold?: number;
            hardLimit?: number;
            periodStart?: string;
            periodEnd?: string;
            rolloverEnabled?: boolean;
            rolloverPercentage?: number;
            createdBy: string;
        },
    ) => Promise<unknown>;
    getBudget?: (id: string) => Promise<unknown>;
    updateBudget?: (id: string, data: unknown) => Promise<{ updated: boolean }>;
    deleteBudget?: (id: string) => Promise<{ deleted: boolean }>;
    resetBudgetUsage?: (id: string) => Promise<{ reset: boolean }>;
    checkBudget?: (organizationId: string, userId: string, usage: { tokens: number; cost: number }) => Promise<unknown>;
    recordUsage?: (
        organizationId: string,
        userId: string,
        data: { model?: string; inputTokens?: number; outputTokens?: number; requestCount?: number },
    ) => Promise<unknown>;
    getUsageStats?: (
        organizationId: string,
        options: { startDate?: string; endDate?: string; groupBy?: string },
    ) => Promise<unknown>;
    getAlerts?: (
        organizationId: string,
        options: { status?: string; alertType?: string; limit?: number; offset?: number },
    ) => Promise<unknown[]>;
    acknowledgeAlert?: (id: string, userId: string) => Promise<{ acknowledged: boolean }>;
    dismissAlert?: (id: string) => Promise<{ dismissed: boolean }>;
    getModelPermissions?: (organizationId: string, scopeType?: string, scopeId?: string) => Promise<unknown[]>;
    setModelPermission?: (
        organizationId: string,
        data: {
            scopeType: string;
            scopeId: string;
            modelId: string;
            modelProvider: string;
            isAllowed?: boolean;
            maxTokensPerRequest?: number;
            dailyTokenLimit?: number;
            priority?: number;
            createdBy: string;
        },
    ) => Promise<unknown>;
    checkModelAccess?: (organizationId: string, userId: string, userRole: string, modelId: string) => Promise<unknown>;
    deleteModelPermission?: (id: string) => Promise<{ deleted: boolean }>;
    getModelCosts?: () => unknown;
    estimateCost?: (model: string, inputTokens: number, outputTokens: number) => number;
}

// Dynamic import for aiBudgetService (may not be migrated yet)
let aiBudgetService: AIBudgetServiceInterface | null = null;

try {
    const budgetModule = await import('../../services/aiBudgetService.js');
    aiBudgetService = (budgetModule.default || budgetModule) as AIBudgetServiceInterface;
} catch {
    logger.warn('[AI Budgets Routes] aiBudgetService not available');
}

// ====== BUDGET MANAGEMENT ======

/**
 * GET /budgets
 * List all budgets for organization
 */
router.get(
    '/budgets',
    verifyToken,
    requireRole(['super_admin', 'admin', 'owner']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.getOrganizationBudgets) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const { includeUserBudgets } = req.query;
            const organizationId = req.user?.organizationId || req.user?.organization_id;

            if (!organizationId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const budgets = await aiBudgetService.getOrganizationBudgets(
                organizationId,
                includeUserBudgets !== 'false',
            );

            res.json({
                success: true,
                data: budgets,
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] List budgets error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to list budgets',
            });
        }
    }),
);

/**
 * POST /budgets
 * Create a new budget
 */
router.post(
    '/budgets',
    verifyToken,
    requireRole(['super_admin', 'admin', 'owner']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.createBudget) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const {
                userId,
                budgetType,
                period,
                budgetLimit,
                warningThreshold,
                hardLimit,
                periodStart,
                periodEnd,
                rolloverEnabled,
                rolloverPercentage,
            } = req.body;

            const organizationId = req.user?.organizationId || req.user?.organization_id;
            const userId_created = req.user?.id;

            if (!organizationId || !userId_created) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            if (!budgetType || !period || !budgetLimit) {
                return res.status(400).json({
                    success: false,
                    error: 'budgetType, period, and budgetLimit are required',
                });
            }

            const result = await aiBudgetService.createBudget(organizationId, {
                userId,
                budgetType,
                period,
                budgetLimit,
                warningThreshold,
                hardLimit,
                periodStart,
                periodEnd,
                rolloverEnabled,
                rolloverPercentage,
                createdBy: userId_created,
            });

            res.status(201).json({
                success: true,
                data: result,
                message: 'Budget created successfully',
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] Create budget error:', error);
            res.status(500).json({
                success: false,
                error: error instanceof Error ? error.message : 'Failed to create budget',
            });
        }
    }),
);

/**
 * GET /budgets/:id
 * Get a specific budget
 */
router.get(
    '/budgets/:id',
    verifyToken,
    requireRole(['super_admin', 'admin', 'owner']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.getBudget) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const budget = await aiBudgetService.getBudget(req.params.id);

            if (!budget) {
                return res.status(404).json({
                    success: false,
                    error: 'Budget not found',
                });
            }

            res.json({
                success: true,
                data: budget,
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] Get budget error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get budget',
            });
        }
    }),
);

/**
 * PUT /budgets/:id
 * Update a budget
 */
router.put(
    '/budgets/:id',
    verifyToken,
    requireRole(['super_admin', 'admin', 'owner']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.updateBudget) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const result = await aiBudgetService.updateBudget(req.params.id, req.body);

            if (!result.updated) {
                return res.status(404).json({
                    success: false,
                    error: 'Budget not found or no changes made',
                });
            }

            res.json({
                success: true,
                message: 'Budget updated successfully',
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] Update budget error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to update budget',
            });
        }
    }),
);

/**
 * DELETE /budgets/:id
 * Delete a budget
 */
router.delete(
    '/budgets/:id',
    verifyToken,
    requireRole(['super_admin', 'admin', 'owner']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.deleteBudget) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const result = await aiBudgetService.deleteBudget(req.params.id);

            if (!result.deleted) {
                return res.status(404).json({
                    success: false,
                    error: 'Budget not found',
                });
            }

            res.json({
                success: true,
                message: 'Budget deleted successfully',
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] Delete budget error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete budget',
            });
        }
    }),
);

/**
 * POST /budgets/:id/reset
 * Reset a budget's usage
 */
router.post(
    '/budgets/:id/reset',
    verifyToken,
    requireRole(['super_admin', 'admin']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.resetBudgetUsage) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const result = await aiBudgetService.resetBudgetUsage(req.params.id);

            if (!result.reset) {
                return res.status(404).json({
                    success: false,
                    error: 'Budget not found',
                });
            }

            res.json({
                success: true,
                data: result,
                message: 'Budget reset successfully',
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] Reset budget error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to reset budget',
            });
        }
    }),
);

// ====== USAGE & CHECKING ======

/**
 * GET /check
 * Check if current user can make AI request
 */
router.get(
    '/check',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.checkBudget) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const { tokens, cost } = req.query;
            const organizationId = req.user?.organizationId || req.user?.organization_id;
            const userId = req.user?.id;

            if (!organizationId || !userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const result = await aiBudgetService.checkBudget(organizationId, userId, {
                tokens: parseInt(tokens as string) || 0,
                cost: parseFloat(cost as string) || 0,
            });

            res.json({
                success: true,
                data: result,
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] Check budget error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to check budget',
            });
        }
    }),
);

/**
 * POST /record
 * Record AI usage (internal use, typically called by AI service)
 */
router.post(
    '/record',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.recordUsage) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const { model, inputTokens, outputTokens, requestCount } = req.body;
            const organizationId = req.user?.organizationId || req.user?.organization_id;
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

            res.json({
                success: true,
                data: result,
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] Record usage error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to record usage',
            });
        }
    }),
);

/**
 * GET /stats
 * Get usage statistics
 */
router.get(
    '/stats',
    verifyToken,
    requireRole(['super_admin', 'admin', 'owner']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.getUsageStats) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const { startDate, endDate, groupBy } = req.query;
            const organizationId = req.user?.organizationId || req.user?.organization_id;

            if (!organizationId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const stats = await aiBudgetService.getUsageStats(organizationId, {
                startDate: startDate as string | undefined,
                endDate: endDate as string | undefined,
                groupBy: groupBy as string | undefined,
            });

            res.json({
                success: true,
                data: stats,
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] Get stats error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get statistics',
            });
        }
    }),
);

// ====== ALERTS ======

/**
 * GET /alerts
 * List spending alerts
 */
router.get(
    '/alerts',
    verifyToken,
    requireRole(['super_admin', 'admin', 'owner']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.getAlerts) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const { status, alertType, limit, offset } = req.query;
            const organizationId = req.user?.organizationId || req.user?.organization_id;

            if (!organizationId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const alerts = await aiBudgetService.getAlerts(organizationId, {
                status: status as string | undefined,
                alertType: alertType as string | undefined,
                limit: parseInt(limit as string) || 100,
                offset: parseInt(offset as string) || 0,
            });

            res.json({
                success: true,
                data: alerts,
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] List alerts error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to list alerts',
            });
        }
    }),
);

/**
 * POST /alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.post(
    '/alerts/:id/acknowledge',
    verifyToken,
    requireRole(['super_admin', 'admin', 'owner']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.acknowledgeAlert) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const userId = req.user?.id;
            if (!userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const result = await aiBudgetService.acknowledgeAlert(req.params.id, userId);

            if (!result.acknowledged) {
                return res.status(404).json({
                    success: false,
                    error: 'Alert not found',
                });
            }

            res.json({
                success: true,
                message: 'Alert acknowledged',
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] Acknowledge alert error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to acknowledge alert',
            });
        }
    }),
);

/**
 * POST /alerts/:id/dismiss
 * Dismiss an alert
 */
router.post(
    '/alerts/:id/dismiss',
    verifyToken,
    requireRole(['super_admin', 'admin', 'owner']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.dismissAlert) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const result = await aiBudgetService.dismissAlert(req.params.id);

            if (!result.dismissed) {
                return res.status(404).json({
                    success: false,
                    error: 'Alert not found',
                });
            }

            res.json({
                success: true,
                message: 'Alert dismissed',
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] Dismiss alert error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to dismiss alert',
            });
        }
    }),
);

// ====== MODEL PERMISSIONS ======

/**
 * GET /model-permissions
 * List model permissions
 */
router.get(
    '/model-permissions',
    verifyToken,
    requireRole(['super_admin', 'admin', 'owner']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.getModelPermissions) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const { scopeType, scopeId } = req.query;
            const organizationId = req.user?.organizationId || req.user?.organization_id;

            if (!organizationId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            const permissions = await aiBudgetService.getModelPermissions(
                organizationId,
                scopeType as string | undefined,
                scopeId as string | undefined,
            );

            res.json({
                success: true,
                data: permissions,
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] List model permissions error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to list model permissions',
            });
        }
    }),
);

/**
 * POST /model-permissions
 * Set model permission
 */
router.post(
    '/model-permissions',
    verifyToken,
    requireRole(['super_admin', 'admin']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.setModelPermission) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const {
                scopeType,
                scopeId,
                modelId,
                modelProvider,
                isAllowed,
                maxTokensPerRequest,
                dailyTokenLimit,
                priority,
            } = req.body;

            const organizationId = req.user?.organizationId || req.user?.organization_id;
            const userId = req.user?.id;

            if (!organizationId || !userId) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            if (!scopeType || !scopeId || !modelId || !modelProvider) {
                return res.status(400).json({
                    success: false,
                    error: 'scopeType, scopeId, modelId, and modelProvider are required',
                });
            }

            const result = await aiBudgetService.setModelPermission(organizationId, {
                scopeType,
                scopeId,
                modelId,
                modelProvider,
                isAllowed,
                maxTokensPerRequest,
                dailyTokenLimit,
                priority,
                createdBy: userId,
            });

            res.json({
                success: true,
                data: result,
                message: 'Model permission set successfully',
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] Set model permission error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to set model permission',
            });
        }
    }),
);

/**
 * GET /model-access
 * Check if current user can access a model
 */
router.get(
    '/model-access',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.checkModelAccess) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const { modelId } = req.query;
            const organizationId = req.user?.organizationId || req.user?.organization_id;
            const userId = req.user?.id;
            const userRole = req.user?.role;

            if (!organizationId || !userId || !userRole) {
                return res.status(401).json({ success: false, error: 'Unauthorized' });
            }

            if (!modelId) {
                return res.status(400).json({
                    success: false,
                    error: 'modelId is required',
                });
            }

            const result = await aiBudgetService.checkModelAccess(organizationId, userId, userRole, modelId as string);

            res.json({
                success: true,
                data: result,
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] Check model access error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to check model access',
            });
        }
    }),
);

/**
 * DELETE /model-permissions/:id
 * Delete model permission
 */
router.delete(
    '/model-permissions/:id',
    verifyToken,
    requireRole(['super_admin', 'admin']),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.deleteModelPermission) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const result = await aiBudgetService.deleteModelPermission(req.params.id);

            if (!result.deleted) {
                return res.status(404).json({
                    success: false,
                    error: 'Permission not found',
                });
            }

            res.json({
                success: true,
                message: 'Model permission deleted successfully',
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] Delete model permission error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete model permission',
            });
        }
    }),
);

/**
 * GET /model-costs
 * Get model cost information
 */
router.get(
    '/model-costs',
    verifyToken,
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.getModelCosts) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const costs = aiBudgetService.getModelCosts();
            res.json({
                success: true,
                data: costs,
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] Get model costs error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to get model costs',
            });
        }
    }),
);

/**
 * POST /estimate-cost
 * Estimate cost for a request
 */
router.post(
    '/estimate-cost',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!aiBudgetService?.estimateCost) {
            return res.status(503).json({ success: false, error: 'AI Budget service not available' });
        }

        try {
            const { model, inputTokens, outputTokens } = req.body;

            const cost = aiBudgetService.estimateCost(model, inputTokens || 0, outputTokens || 0);

            res.json({
                success: true,
                data: {
                    model,
                    inputTokens,
                    outputTokens,
                    estimatedCost: cost,
                },
            });
        } catch (error: unknown) {
            logger.error('[AI Budgets] Estimate cost error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to estimate cost',
            });
        }
    }),
);

export default router;
