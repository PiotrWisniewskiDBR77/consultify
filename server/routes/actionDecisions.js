const express = require('express');
const router = express.Router();
const ActionDecisionService = require('../ai/actionDecisionService');
const authMiddleware = require('../middleware/authMiddleware');

// Apply auth to all routes in this file
router.use(authMiddleware);

/**
 * @route POST /api/ai/actions/decide
 * @desc Record a decision for an AI Action Proposal (Snapshot server-side)
 * @access Private (Admin / SuperAdmin)
 */
router.post('/decide', async (req, res) => {
    try {
        // STRICT PARSING: Only accept proposal_id, decision, reason, and modified_payload.
        // DO NOT accept snapshot or original_payload from client to prevent audit tampering.
        const { proposal_id, decision, reason, modified_payload } = req.body;

        // RBAC CHECK
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const decisionRecord = await ActionDecisionService.recordDecision({
            proposal_id,
            organization_id: req.organizationId, // From authMiddleware attachUser
            decision,
            decided_by_user_id: req.userId,      // From authMiddleware attachUser
            reason,
            modified_payload
        });

        res.status(201).json({
            message: 'Decision recorded successfully',
            audit_id: decisionRecord.id,
            decision: decisionRecord.decision
        });
    } catch (err) {
        console.error('[ActionDecisionsRoute] Error:', err);
        const status = err.status || 400;
        res.status(status).json({ error: err.message });
    }
});

/**
 * @route GET /api/ai/actions/audit
 * @desc Get decision audit log (Isolated by organization)
 * @access Private (Admin / SuperAdmin)
 */
router.get('/audit', async (req, res) => {
    try {
        // RBAC CHECK
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        // Filters from query params
        const { actionType, decision, limit, offset } = req.query;

        // ADMIN can only see their own org. SUPERADMIN can bypass.
        const orgId = req.user.role === 'SUPERADMIN' ? 'SUPERADMIN_BYPASS' : req.organizationId;

        const log = await ActionDecisionService.getAuditLog(orgId, {
            actionType,
            decision,
            limit: limit ? parseInt(limit) : 50,
            offset: offset ? parseInt(offset) : 0
        });

        res.json(log);
    } catch (err) {
        console.error('[ActionAuditRoute] Error:', err);
        res.status(500).json({ error: 'Failed to fetch audit log' });
    }
});

/**
 * @route POST /api/ai/actions/decisions/:id/execute
 * @desc Execute an approved decision (Hardened Isolation)
 * @access Private (Admin / SuperAdmin)
 */
router.post('/decisions/:id/execute', async (req, res) => {
    try {
        const { id } = req.params;
        const ActionExecutionAdapter = require('../ai/actionExecutionAdapter');

        // RBAC check: ADMIN only their own org, SUPERADMIN any org
        // Fetch specific decision to check organization_id
        const orgId = req.user.role === 'SUPERADMIN' ? 'SUPERADMIN_BYPASS' : req.organizationId;
        const decisions = await ActionDecisionService.getAuditLog(orgId);
        const decision = decisions.find(d => d.id === id);

        if (!decision) {
            return res.status(404).json({ error: `Decision not found: ${id}` });
        }

        // Double check isolation for non-superadmins
        if (req.user.role !== 'SUPERADMIN' && decision.organization_id !== req.organizationId) {
            return res.status(403).json({ error: 'Forbidden: Organization mismatch' });
        }

        const executionResult = await ActionExecutionAdapter.executeDecision(id, req.userId);

        if (!executionResult.success) {
            return res.status(400).json(executionResult);
        }

        // Include correlation_id in response (Step 9.5)
        res.json(executionResult);
    } catch (err) {
        console.error('[ActionExecutionRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/ai/actions/decisions/:id/dry-run
 * @desc Dry-run an approved decision (no side effects) - Step 9.6
 * @access Private (Admin / SuperAdmin)
 */
router.post('/decisions/:id/dry-run', async (req, res) => {
    try {
        const { id } = req.params;
        const ActionExecutionAdapter = require('../ai/actionExecutionAdapter');

        // RBAC check
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        // Fetch specific decision to check organization_id
        const orgId = req.user.role === 'SUPERADMIN' ? 'SUPERADMIN_BYPASS' : req.organizationId;
        const decisions = await ActionDecisionService.getAuditLog(orgId);
        const decision = decisions.find(d => d.id === id);

        if (!decision) {
            return res.status(404).json({ error: `Decision not found: ${id}` });
        }

        // Double check isolation for non-superadmins
        if (req.user.role !== 'SUPERADMIN' && decision.organization_id !== req.organizationId) {
            return res.status(403).json({ error: 'Forbidden: Organization mismatch' });
        }

        const dryRunResult = await ActionExecutionAdapter.executeDecision(id, req.userId, { dry_run: true });

        res.json(dryRunResult);
    } catch (err) {
        console.error('[ActionDryRunRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/ai/actions/audit/export
 * @desc Export decisions audit log (CSV or JSON) - Step 9.7
 * @access Private (Admin / SuperAdmin)
 */
router.get('/audit/export', async (req, res) => {
    try {
        const AuditExportService = require('../ai/auditExport');

        // RBAC check
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const { format = 'json', include_archived } = req.query;

        // ADMIN can only see their own org. SUPERADMIN can bypass.
        const orgId = req.user.role === 'SUPERADMIN' ? 'SUPERADMIN_BYPASS' : req.organizationId;
        const includeArchived = req.user.role === 'SUPERADMIN' && include_archived === 'true';

        const result = await AuditExportService.exportDecisions({
            organizationId: orgId,
            format,
            includeArchived
        });

        if (result.format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="audit_decisions.csv"');
            return res.send(result.data);
        }

        res.json(result.data);
    } catch (err) {
        console.error('[AuditExportRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/ai/actions/executions/export
 * @desc Export executions audit log (CSV or JSON) - Step 9.7
 * @access Private (Admin / SuperAdmin)
 */
router.get('/executions/export', async (req, res) => {
    try {
        const AuditExportService = require('../ai/auditExport');

        // RBAC check
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const { format = 'json', include_archived } = req.query;

        // ADMIN can only see their own org. SUPERADMIN can bypass.
        const orgId = req.user.role === 'SUPERADMIN' ? 'SUPERADMIN_BYPASS' : req.organizationId;
        const includeArchived = req.user.role === 'SUPERADMIN' && include_archived === 'true';

        const result = await AuditExportService.exportExecutions({
            organizationId: orgId,
            format,
            includeArchived
        });

        if (result.format === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', 'attachment; filename="audit_executions.csv"');
            return res.send(result.data);
        }

        res.json(result.data);
    } catch (err) {
        console.error('[ExecutionsExportRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// STEP 9.8: POLICY ENGINE ROUTES
// ==========================================

const PolicyEngine = require('../ai/policyEngine');

/**
 * @route GET /api/ai/actions/policy-rules
 * @desc List policy rules (ADMIN: own org, SUPERADMIN: all)
 * @access Private (Admin / SuperAdmin)
 */
router.get('/policy-rules', async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        let rules;
        if (req.user.role === 'SUPERADMIN') {
            rules = await PolicyEngine.getAllRules();
        } else {
            rules = await PolicyEngine.getRules(req.organizationId);
        }

        res.json(rules);
    } catch (err) {
        console.error('[PolicyRulesRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PATCH /api/ai/actions/policy-rules/:id/toggle
 * @desc Enable/disable a policy rule
 * @access Private (Admin / SuperAdmin)
 */
router.patch('/policy-rules/:id/toggle', async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'enabled (boolean) is required' });
        }

        const result = await PolicyEngine.toggleRule(req.params.id, enabled);
        res.json(result);
    } catch (err) {
        if (err.message === 'Rule not found') {
            return res.status(404).json({ error: err.message });
        }
        console.error('[PolicyToggleRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/ai/actions/policy-rules
 * @desc Create a new policy rule (ADMIN: own org only)
 * @access Private (Admin / SuperAdmin)
 */
router.post('/policy-rules', async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const { action_type, scope, max_risk_level, conditions, auto_decision, auto_decision_reason, organization_id } = req.body;

        // SUPERADMIN can specify organization_id, ADMIN can only create for own org
        const targetOrgId = req.user.role === 'SUPERADMIN' && organization_id
            ? organization_id
            : req.organizationId;

        if (!action_type || !scope || !max_risk_level || !auto_decision || !auto_decision_reason) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const rule = await PolicyEngine.createRule({
            organization_id: targetOrgId,
            action_type,
            scope,
            max_risk_level,
            conditions: conditions || {},
            auto_decision,
            auto_decision_reason,
            created_by_user_id: req.userId
        });

        res.status(201).json(rule);
    } catch (err) {
        console.error('[PolicyCreateRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/ai/actions/policy-engine/status
 * @desc Get global Policy Engine status
 * @access Private (SUPERADMIN only)
 */
router.get('/policy-engine/status', async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: SuperAdmin access required' });
        }

        const status = await PolicyEngine.getGlobalStatus();
        res.json(status);
    } catch (err) {
        console.error('[PolicyStatusRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route PATCH /api/ai/actions/policy-engine/global
 * @desc Toggle global Policy Engine status (emergency kill switch)
 * @access Private (SUPERADMIN only)
 */
router.patch('/policy-engine/global', async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'SUPERADMIN') {
            return res.status(403).json({ error: 'Forbidden: SuperAdmin access required' });
        }

        const { enabled } = req.body;
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: 'enabled (boolean) is required' });
        }

        const result = await PolicyEngine.setGlobalStatus(enabled, req.userId);
        res.json(result);
    } catch (err) {
        console.error('[PolicyGlobalRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/ai/actions/proposals/:id/evaluate-policy
 * @desc Evaluate a proposal against policy rules (pre-check, no side effects)
 * @access Private (Admin / SuperAdmin)
 */
router.post('/proposals/:id/evaluate-policy', async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const ActionProposalEngine = require('../ai/actionProposalEngine');
        const organizationId = req.user.role === 'SUPERADMIN' && req.query.organizationId
            ? req.query.organizationId
            : req.organizationId;

        const proposal = await ActionProposalEngine.getProposalById(organizationId, req.params.id);
        if (!proposal) {
            return res.status(404).json({ error: 'Proposal not found' });
        }

        const result = await ActionDecisionService.evaluatePolicyForProposal(proposal, organizationId);
        res.json(result);
    } catch (err) {
        console.error('[PolicyEvaluateRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

// ==========================================
// STEP 11: ASYNC JOB ENDPOINTS
// ==========================================

const AsyncJobService = require('../ai/asyncJobService');
const { v4: uuidv4 } = require('uuid');

/**
 * @route POST /api/ai/actions/decisions/:id/execute-async
 * @desc Enqueue async execution of an approved decision
 * @access Private (Admin / SuperAdmin)
 */
router.post('/decisions/:id/execute-async', async (req, res) => {
    try {
        const { id } = req.params;
        const { priority = 'normal' } = req.body;

        // RBAC check
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        // Fetch decision to validate org isolation
        const orgId = req.user.role === 'SUPERADMIN' ? 'SUPERADMIN_BYPASS' : req.organizationId;
        const decisions = await ActionDecisionService.getAuditLog(orgId);
        const decision = decisions.find(d => d.id === id);

        if (!decision) {
            return res.status(404).json({ error: `Decision not found: ${id}` });
        }

        // Validate org isolation for ADMIN
        if (req.user.role !== 'SUPERADMIN' && decision.organization_id !== req.organizationId) {
            return res.status(403).json({ error: 'Forbidden: Organization mismatch' });
        }

        // Validate decision state
        const validStates = ['APPROVED', 'MODIFIED'];
        if (!validStates.includes(decision.decision)) {
            return res.status(400).json({
                error: `Decision ${id} is ${decision.decision}, but only APPROVED/MODIFIED are executable`
            });
        }

        // Enqueue the job
        const correlationId = decision.correlation_id || `corr-${uuidv4()}`;
        const result = await AsyncJobService.enqueueActionExecution({
            decisionId: id,
            organizationId: decision.organization_id,
            correlationId,
            priority,
            createdBy: req.userId
        });

        res.status(202).json(result);
    } catch (err) {
        console.error('[AsyncExecuteRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/ai/actions/jobs/:jobId
 * @desc Get async job status
 * @access Private (Admin / SuperAdmin)
 */
router.get('/jobs/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;

        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const orgId = req.user.role === 'SUPERADMIN' ? 'SUPERADMIN_BYPASS' : req.organizationId;
        const job = await AsyncJobService.getJob(jobId, orgId);

        if (!job) {
            return res.status(404).json({ error: 'Job not found' });
        }

        res.json(job);
    } catch (err) {
        console.error('[AsyncJobStatusRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/ai/actions/jobs/:jobId/retry
 * @desc Retry a failed or dead-letter job
 * @access Private (Admin / SuperAdmin)
 */
router.post('/jobs/:jobId/retry', async (req, res) => {
    try {
        const { jobId } = req.params;

        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const orgId = req.user.role === 'SUPERADMIN' ? 'SUPERADMIN_BYPASS' : req.organizationId;

        const result = await AsyncJobService.retryJob(jobId, orgId);
        res.json(result);
    } catch (err) {
        if (err.code === 'JOB_NOT_FOUND') {
            return res.status(404).json({ error: err.message });
        }
        if (err.code === 'JOB_INVALID_STATE') {
            return res.status(400).json({ error: err.message });
        }
        console.error('[AsyncJobRetryRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route POST /api/ai/actions/jobs/:jobId/cancel
 * @desc Cancel a queued job
 * @access Private (Admin / SuperAdmin)
 */
router.post('/jobs/:jobId/cancel', async (req, res) => {
    try {
        const { jobId } = req.params;

        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const orgId = req.user.role === 'SUPERADMIN' ? 'SUPERADMIN_BYPASS' : req.organizationId;

        const result = await AsyncJobService.cancelJob(jobId, orgId);
        res.json(result);
    } catch (err) {
        if (err.code === 'JOB_NOT_FOUND') {
            return res.status(404).json({ error: err.message });
        }
        if (err.code === 'JOB_INVALID_STATE') {
            return res.status(400).json({ error: err.message });
        }
        console.error('[AsyncJobCancelRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/ai/actions/jobs/dead-letter
 * @desc List dead-letter jobs for UI visibility
 * @access Private (Admin / SuperAdmin)
 */
router.get('/jobs/dead-letter', async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const orgId = req.user.role === 'SUPERADMIN' ? 'SUPERADMIN_BYPASS' : req.organizationId;
        const { limit = 50, offset = 0 } = req.query;

        const jobs = await AsyncJobService.listJobs(orgId, {
            deadLetterOnly: true,
            limit: parseInt(limit),
            offset: parseInt(offset)
        });

        res.json({ jobs, count: jobs.length });
    } catch (err) {
        console.error('[DeadLetterListRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/**
 * @route GET /api/ai/actions/jobs/stats
 * @desc Get dead-letter and job statistics for dashboard
 * @access Private (Admin / SuperAdmin)
 */
router.get('/jobs/stats', async (req, res) => {
    try {
        if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPERADMIN')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }

        const orgId = req.organizationId;
        const stats = await AsyncJobService.getDeadLetterStats(orgId);

        res.json(stats);
    } catch (err) {
        console.error('[JobStatsRoute] Error:', err);
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

