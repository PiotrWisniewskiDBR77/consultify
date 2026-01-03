/**
 * AI Budgets Routes
 * 
 * Endpoints for AI spending budget management
 * Includes budgets, alerts, and model permissions
 */

import express from 'express';
const router = express.Router();
const aiBudgetService = import('aiBudgetService.js');
import verifyToken from '../middleware/authMiddleware.js';
const { requireRole } = require('../middleware/rbac');

// ====== BUDGET MANAGEMENT ======

/**
 * GET /budgets
 * List all budgets for organization
 */
router.get('/budgets', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const { includeUserBudgets } = req.query;
        
        const budgets = await aiBudgetService.getOrganizationBudgets(
            req.user.organization_id,
            includeUserBudgets !== 'false'
        );

        res.json({
            success: true,
            data: budgets,
        });
    } catch (error) {
        console.error('[AI Budgets] List budgets error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list budgets',
        });
    }
});

/**
 * POST /budgets
 * Create a new budget
 */
router.post('/budgets', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
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

        if (!budgetType || !period || !budgetLimit) {
            return res.status(400).json({
                success: false,
                error: 'budgetType, period, and budgetLimit are required',
            });
        }

        const result = await aiBudgetService.createBudget(req.user.organization_id, {
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
            createdBy: req.user.id,
        });

        res.status(201).json({
            success: true,
            data: result,
            message: 'Budget created successfully',
        });
    } catch (error) {
        console.error('[AI Budgets] Create budget error:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to create budget',
        });
    }
});

/**
 * GET /budgets/:id
 * Get a specific budget
 */
router.get('/budgets/:id', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
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
    } catch (error) {
        console.error('[AI Budgets] Get budget error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get budget',
        });
    }
});

/**
 * PUT /budgets/:id
 * Update a budget
 */
router.put('/budgets/:id', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
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
    } catch (error) {
        console.error('[AI Budgets] Update budget error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update budget',
        });
    }
});

/**
 * DELETE /budgets/:id
 * Delete a budget
 */
router.delete('/budgets/:id', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
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
    } catch (error) {
        console.error('[AI Budgets] Delete budget error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete budget',
        });
    }
});

/**
 * POST /budgets/:id/reset
 * Reset a budget's usage
 */
router.post('/budgets/:id/reset', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
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
    } catch (error) {
        console.error('[AI Budgets] Reset budget error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reset budget',
        });
    }
});

// ====== USAGE & CHECKING ======

/**
 * GET /check
 * Check if current user can make AI request
 */
router.get('/check', verifyToken, async (req, res) => {
    try {
        const { tokens, cost } = req.query;

        const result = await aiBudgetService.checkBudget(
            req.user.organization_id,
            req.user.id,
            {
                tokens: parseInt(tokens) || 0,
                cost: parseFloat(cost) || 0,
            }
        );

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[AI Budgets] Check budget error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check budget',
        });
    }
});

/**
 * POST /record
 * Record AI usage (internal use, typically called by AI service)
 */
router.post('/record', verifyToken, async (req, res) => {
    try {
        const { model, inputTokens, outputTokens, requestCount } = req.body;

        const result = await aiBudgetService.recordUsage(
            req.user.organization_id,
            req.user.id,
            { model, inputTokens, outputTokens, requestCount }
        );

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[AI Budgets] Record usage error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to record usage',
        });
    }
});

/**
 * GET /stats
 * Get usage statistics
 */
router.get('/stats', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const { startDate, endDate, groupBy } = req.query;

        const stats = await aiBudgetService.getUsageStats(req.user.organization_id, {
            startDate,
            endDate,
            groupBy,
        });

        res.json({
            success: true,
            data: stats,
        });
    } catch (error) {
        console.error('[AI Budgets] Get stats error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get statistics',
        });
    }
});

// ====== ALERTS ======

/**
 * GET /alerts
 * List spending alerts
 */
router.get('/alerts', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const { status, alertType, limit, offset } = req.query;

        const alerts = await aiBudgetService.getAlerts(req.user.organization_id, {
            status,
            alertType,
            limit: parseInt(limit) || 100,
            offset: parseInt(offset) || 0,
        });

        res.json({
            success: true,
            data: alerts,
        });
    } catch (error) {
        console.error('[AI Budgets] List alerts error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list alerts',
        });
    }
});

/**
 * POST /alerts/:id/acknowledge
 * Acknowledge an alert
 */
router.post('/alerts/:id/acknowledge', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const result = await aiBudgetService.acknowledgeAlert(req.params.id, req.user.id);

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
    } catch (error) {
        console.error('[AI Budgets] Acknowledge alert error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to acknowledge alert',
        });
    }
});

/**
 * POST /alerts/:id/dismiss
 * Dismiss an alert
 */
router.post('/alerts/:id/dismiss', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
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
    } catch (error) {
        console.error('[AI Budgets] Dismiss alert error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to dismiss alert',
        });
    }
});

// ====== MODEL PERMISSIONS ======

/**
 * GET /model-permissions
 * List model permissions
 */
router.get('/model-permissions', verifyToken, requireRole(['super_admin', 'admin', 'owner']), async (req, res) => {
    try {
        const { scopeType, scopeId } = req.query;

        const permissions = await aiBudgetService.getModelPermissions(
            req.user.organization_id,
            scopeType,
            scopeId
        );

        res.json({
            success: true,
            data: permissions,
        });
    } catch (error) {
        console.error('[AI Budgets] List model permissions error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to list model permissions',
        });
    }
});

/**
 * POST /model-permissions
 * Set model permission
 */
router.post('/model-permissions', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
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

        if (!scopeType || !scopeId || !modelId || !modelProvider) {
            return res.status(400).json({
                success: false,
                error: 'scopeType, scopeId, modelId, and modelProvider are required',
            });
        }

        const result = await aiBudgetService.setModelPermission(req.user.organization_id, {
            scopeType,
            scopeId,
            modelId,
            modelProvider,
            isAllowed,
            maxTokensPerRequest,
            dailyTokenLimit,
            priority,
            createdBy: req.user.id,
        });

        res.json({
            success: true,
            data: result,
            message: 'Model permission set successfully',
        });
    } catch (error) {
        console.error('[AI Budgets] Set model permission error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to set model permission',
        });
    }
});

/**
 * GET /model-access
 * Check if current user can access a model
 */
router.get('/model-access', verifyToken, async (req, res) => {
    try {
        const { modelId } = req.query;

        if (!modelId) {
            return res.status(400).json({
                success: false,
                error: 'modelId is required',
            });
        }

        const result = await aiBudgetService.checkModelAccess(
            req.user.organization_id,
            req.user.id,
            req.user.role,
            modelId
        );

        res.json({
            success: true,
            data: result,
        });
    } catch (error) {
        console.error('[AI Budgets] Check model access error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check model access',
        });
    }
});

/**
 * DELETE /model-permissions/:id
 * Delete model permission
 */
router.delete('/model-permissions/:id', verifyToken, requireRole(['super_admin', 'admin']), async (req, res) => {
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
    } catch (error) {
        console.error('[AI Budgets] Delete model permission error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete model permission',
        });
    }
});

/**
 * GET /model-costs
 * Get model cost information
 */
router.get('/model-costs', verifyToken, (req, res) => {
    const costs = aiBudgetService.getModelCosts();
    res.json({
        success: true,
        data: costs,
    });
});

/**
 * POST /estimate-cost
 * Estimate cost for a request
 */
router.post('/estimate-cost', verifyToken, (req, res) => {
    const { model, inputTokens, outputTokens } = req.body;

    const cost = aiBudgetService.estimateCost(
        model,
        inputTokens || 0,
        outputTokens || 0
    );

    res.json({
        success: true,
        data: {
            model,
            inputTokens,
            outputTokens,
            estimatedCost: cost,
        },
    });
});

export default router;

