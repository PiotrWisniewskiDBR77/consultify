const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { requireOrgAccess } = require('../middleware/rbac');
const budgetManagementService = require('../services/budgetManagementService');

/**
 * GET /api/budgets/user/:userId
 * Get user budget
 */
router.get('/user/:userId', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { userId } = req.params;

        const budget = await budgetManagementService.getBudgetStatus(orgId, userId);
        res.json({ budget });
    } catch (error) {
        console.error('[Budgets] Get user budget error:', error);
        res.status(500).json({ error: 'Failed to get user budget' });
    }
});

/**
 * PUT /api/budgets/user/:userId
 * Set user budget
 */
router.put('/user/:userId', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { userId } = req.params;
        const budget = req.body;

        await budgetManagementService.setUserBudget(orgId, userId, budget);
        res.json({ success: true });
    } catch (error) {
        console.error('[Budgets] Set user budget error:', error);
        res.status(500).json({ error: 'Failed to set user budget' });
    }
});

/**
 * GET /api/budgets/project/:projectId
 * Get project budget
 */
router.get('/project/:projectId', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { projectId } = req.params;

        const budget = await budgetManagementService.getBudgetStatus(orgId, null, projectId);
        res.json({ budget });
    } catch (error) {
        console.error('[Budgets] Get project budget error:', error);
        res.status(500).json({ error: 'Failed to get project budget' });
    }
});

/**
 * PUT /api/budgets/project/:projectId
 * Set project budget
 */
router.put('/project/:projectId', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { projectId } = req.params;
        const budget = req.body;

        await budgetManagementService.setProjectBudget(orgId, projectId, budget);
        res.json({ success: true });
    } catch (error) {
        console.error('[Budgets] Set project budget error:', error);
        res.status(500).json({ error: 'Failed to set project budget' });
    }
});

/**
 * GET /api/budgets/organization
 * Get organization budget
 */
router.get('/organization', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;

        const budget = await budgetManagementService.getBudgetStatus(orgId);
        res.json({ budget });
    } catch (error) {
        console.error('[Budgets] Get org budget error:', error);
        res.status(500).json({ error: 'Failed to get organization budget' });
    }
});

/**
 * PUT /api/budgets/organization
 * Set organization budget
 */
router.put('/organization', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const budget = req.body;

        await budgetManagementService.setOrgBudget(orgId, budget);
        res.json({ success: true });
    } catch (error) {
        console.error('[Budgets] Set org budget error:', error);
        res.status(500).json({ error: 'Failed to set organization budget' });
    }
});

/**
 * GET /api/budgets/status
 * Get status of all budgets
 */
router.get('/status', authMiddleware, requireOrgAccess({ roles: ['ADMIN', 'OWNER'] }), async (req, res) => {
    try {
        const orgId = req.org?.id || req.user.organizationId;
        const { userId, projectId } = req.query;

        const budget = await budgetManagementService.getBudgetStatus(orgId, userId, projectId);
        res.json({ budget });
    } catch (error) {
        console.error('[Budgets] Get budget status error:', error);
        res.status(500).json({ error: 'Failed to get budget status' });
    }
});

module.exports = router;

