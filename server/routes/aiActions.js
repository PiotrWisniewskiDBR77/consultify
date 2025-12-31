/**
 * AI Actions API Routes
 * 
 * Backend endpoints for AI-initiated action execution.
 * Part of the Harvard-Level Co-Thinker AI System
 */

const express = require('express');
const router = express.Router();
const { actionExecutor, ACTION_TYPES } = require('../services/ai/actionExecutor');
const { aiLogger } = require('../services/ai/logger');

// Middleware to extract user context
const getUserContext = (req) => ({
    userId: req.user?.id || req.user?.userId,
    organizationId: req.user?.organizationId,
    projectId: req.body?.projectId || req.query?.projectId
});

/**
 * POST /api/ai/actions/execute
 * Execute an AI-initiated action
 */
router.post('/execute', async (req, res) => {
    try {
        const { type, payload, confirmed = false, requiresConfirmation = false } = req.body;
        const context = getUserContext(req);

        if (!type) {
            return res.status(400).json({ 
                error: 'Action type is required',
                validTypes: Object.values(ACTION_TYPES)
            });
        }

        aiLogger.info('AIActions', `Executing action: ${type}`, { 
            userId: context.userId, 
            confirmed 
        });

        const result = await actionExecutor.execute(
            { type, payload, requiresConfirmation, confirmed },
            context
        );

        res.json(result);

    } catch (error) {
        aiLogger.error('AIActions', `Action execution failed: ${error.message}`);
        res.status(500).json({ 
            status: 'error',
            error: error.message 
        });
    }
});

/**
 * POST /api/ai/actions/confirm/:actionId
 * Confirm or reject a pending action
 */
router.post('/confirm/:actionId', async (req, res) => {
    try {
        const { actionId } = req.params;
        const { confirmed } = req.body;

        if (typeof confirmed !== 'boolean') {
            return res.status(400).json({ 
                error: 'confirmed (boolean) is required' 
            });
        }

        const result = await actionExecutor.confirmAction(actionId, confirmed);
        res.json(result);

    } catch (error) {
        aiLogger.error('AIActions', `Action confirmation failed: ${error.message}`);
        res.status(500).json({ 
            status: 'error',
            error: error.message 
        });
    }
});

/**
 * GET /api/ai/actions/history
 * Get recent action history
 */
router.get('/history', (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 20;
        const history = actionExecutor.getHistory(limit);
        
        res.json({
            history,
            count: history.length
        });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/ai/actions/pending
 * Get pending actions for current user
 */
router.get('/pending', (req, res) => {
    try {
        const pending = Array.from(actionExecutor.pendingActions.values())
            .filter(p => p.context.userId === req.user?.id)
            .map(p => ({
                actionId: p.action.actionId,
                type: p.action.type,
                message: actionExecutor.getConfirmationMessage(p.action.type, p.action.payload),
                createdAt: p.createdAt
            }));

        res.json({ pending });

    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/ai/actions/types
 * Get available action types
 */
router.get('/types', (req, res) => {
    res.json({
        types: ACTION_TYPES,
        descriptions: {
            [ACTION_TYPES.NAVIGATE]: 'Navigate to a different view',
            [ACTION_TYPES.CREATE_PROJECT]: 'Create a new project',
            [ACTION_TYPES.CREATE_INITIATIVE]: 'Create a new initiative',
            [ACTION_TYPES.CREATE_TASK]: 'Create a new task',
            [ACTION_TYPES.UPDATE_ASSESSMENT]: 'Update an assessment score',
            [ACTION_TYPES.FILL_FORM]: 'Fill a form field',
            [ACTION_TYPES.GENERATE_CONTENT]: 'Generate content using AI',
            [ACTION_TYPES.SHOW_DATA]: 'Display data in UI',
            [ACTION_TYPES.HIGHLIGHT_ELEMENT]: 'Highlight a UI element',
            [ACTION_TYPES.OPEN_MODAL]: 'Open a modal dialog',
            [ACTION_TYPES.TRIGGER_WORKFLOW]: 'Trigger a workflow'
        }
    });
});

module.exports = router;

