const express = require('express');
const router = express.Router();
const ActionDecisionService = require('../ai/actionDecisionService');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth to all routes in this file
router.use(authMiddleware);

/**
 * @route POST /api/ai/actions/decide
 * @desc Record a decision for an AI Action Proposal
 * @access Private (Admin / SuperAdmin)
 */
router.post('/decide', async (req, res) => {
    try {
        const { proposal_id, decision, reason, original_payload, modified_payload } = req.body;

        // RBAC CHECK
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const decisionRecord = await ActionDecisionService.recordDecision({
            proposal_id,
            decision,
            decided_by_user_id: req.user.id,
            reason,
            original_payload,
            modified_payload
        });

        res.status(201).json({
            message: 'Decision recorded successfully',
            audit_id: decisionRecord.id,
            decision: decisionRecord.decision
        });
    } catch (err) {
        console.error('[ActionDecisionsRoute] Error:', err);
        res.status(400).json({ error: err.message });
    }
});

/**
 * @route POST /api/ai/actions/decisions/:id/execute
 * @desc Execute an approved decision
 * @access Private (Admin / SuperAdmin)
 */
router.post('/decisions/:id/execute', async (req, res) => {
    try {
        const { id } = req.params;
        const ActionExecutionAdapter = require('../ai/actionExecutionAdapter');

        // RBAC CHECK
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const executionResult = await ActionExecutionAdapter.executeDecision(id, req.user.id);

        if (!executionResult.success) {
            return res.status(400).json(executionResult);
        }

        res.json(executionResult);
    } catch (err) {
        console.error('[ActionExecutionRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/ai/actions/audit
 * @desc Get decision audit log
 * @access Private (Admin / SuperAdmin)
 */
router.get('/audit', async (req, res) => {
    try {
        // RBAC CHECK
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const log = await ActionDecisionService.getAuditLog();
        res.json(log);
    } catch (err) {
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

module.exports = router;
