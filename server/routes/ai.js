// AI Routes - Complete AI API
// AI Core Layer — Enterprise PMO Brain

const express = require('express');
const router = express.Router();
const AIContextBuilder = require('../services/aiContextBuilder');
const AIPolicyEngine = require('../services/aiPolicyEngine');
const AIMemoryManager = require('../services/aiMemoryManager');
const AIOrchestrator = require('../services/aiOrchestrator');
const AIActionExecutor = require('../services/aiActionExecutor');
const AIAuditLogger = require('../services/aiAuditLogger');
const verifyToken = require('../middleware/authMiddleware');

// ==================== CONTEXT ====================

// GET /api/ai/context
router.get('/context', verifyToken, async (req, res) => {
    try {
        const context = await AIContextBuilder.buildContext(
            req.userId,
            req.organizationId,
            null,
            { currentScreen: req.query.screen }
        );
        res.json(context);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/ai/context/:projectId
router.get('/context/:projectId', verifyToken, async (req, res) => {
    try {
        const context = await AIContextBuilder.buildContext(
            req.userId,
            req.organizationId,
            req.params.projectId,
            { currentScreen: req.query.screen }
        );
        res.json(context);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== CHAT ====================

// POST /api/ai/chat/stream
router.post('/chat/stream', verifyToken, async (req, res) => {
    const { message, history, systemInstruction, context, roleName } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'message required' });
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
        const stream = AIOrchestrator.streamMessage ?
            AIOrchestrator.streamMessage(message, req.userId, req.organizationId, context?.projectId, { ...context, roleName }) :
            // Fallback to direct service call if Orchestrator doesn't support stream yet (likely case based on file view)
            // Actually, let's use the AiService directly as seen in aiService.js
            require('../services/aiService').streamLLM(
                message,
                systemInstruction || '',
                history || [],
                null,
                req.userId,
                'chat'
            );

        for await (const chunk of stream) {
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            // res.flush() is not needed in Node http/express usually, but good practice if compression is off
        }

        res.write('data: [DONE]\n\n');
        res.end();

        // TODO: Log interaction via AuditLogger (async)

    } catch (err) {
        console.error('Stream Error:', err);
        res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
        res.end();
    }
});

// POST /api/ai/chat
router.post('/chat', verifyToken, async (req, res) => {
    const { message, projectId, currentScreen, selectedObjectId, selectedObjectType } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'message required' });
    }

    try {
        const result = await AIOrchestrator.processMessage(
            message,
            req.userId,
            req.organizationId,
            projectId,
            { currentScreen, selectedObjectId, selectedObjectType }
        );

        // Log the interaction
        await AIAuditLogger.logSuggestion(
            req.userId, req.organizationId, projectId,
            result.role, result.prompt, result.contextSummary
        );

        res.json({
            role: result.role,
            roleDescription: AIOrchestrator.getRoleDescription(result.role),
            intent: result.intent,
            contextSummary: result.contextSummary,
            dataSources: result.responseContext.dataSources,
            prompt: result.prompt, // For LLM integration
            policyLevel: result.responseContext.policy.policyLevel
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== POLICY ====================

// GET /api/ai/policy
router.get('/policy', verifyToken, async (req, res) => {
    try {
        const policy = await AIPolicyEngine.getPolicySummary(req.organizationId);
        res.json(policy);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/ai/policy (Admin only)
router.patch('/policy', verifyToken, async (req, res) => {
    if (!req.can('edit_organization_settings')) {
        return res.status(403).json({ error: 'Admin required' });
    }

    try {
        const result = await AIPolicyEngine.updatePolicy(req.organizationId, req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/ai/policy/can-perform/:actionType
router.get('/policy/can-perform/:actionType', verifyToken, async (req, res) => {
    const { projectId } = req.query;
    try {
        const result = await AIPolicyEngine.canPerformAction(
            req.params.actionType, req.organizationId, projectId, req.userId
        );
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== MEMORY ====================

// GET /api/ai/memory/project/:projectId
router.get('/memory/project/:projectId', verifyToken, async (req, res) => {
    try {
        const memory = await AIMemoryManager.buildProjectMemorySummary(req.params.projectId);
        res.json(memory);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/ai/memory/project/:projectId/decision
router.post('/memory/project/:projectId/decision', verifyToken, async (req, res) => {
    const { decisionId, title, outcome, rationale } = req.body;

    try {
        const result = await AIMemoryManager.recordDecision(
            req.params.projectId, decisionId, title, outcome, rationale, req.userId
        );
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/ai/memory/user
router.get('/memory/user', verifyToken, async (req, res) => {
    try {
        const preferences = await AIMemoryManager.getUserPreferences(req.userId);
        res.json(preferences);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/ai/memory/user
router.patch('/memory/user', verifyToken, async (req, res) => {
    try {
        const result = await AIMemoryManager.updateUserPreferences(req.userId, req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/ai/memory/project/:projectId (Admin)
router.delete('/memory/project/:projectId', verifyToken, async (req, res) => {
    if (!req.can('edit_project_settings')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    try {
        const result = await AIMemoryManager.clearProjectMemory(req.params.projectId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== ACTIONS ====================

// POST /api/ai/actions/draft
router.post('/actions/draft', verifyToken, async (req, res) => {
    const { draftType, content, projectId } = req.body;

    if (!draftType || !content || !projectId) {
        return res.status(400).json({ error: 'draftType, content, and projectId required' });
    }

    try {
        const result = await AIActionExecutor.createDraft(
            draftType, content, req.userId, req.organizationId, projectId
        );
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/ai/actions/pending
router.get('/actions/pending', verifyToken, async (req, res) => {
    const { projectId } = req.query;
    try {
        const actions = await AIActionExecutor.getPendingActions(
            null, projectId, req.organizationId
        );
        res.json(actions);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/ai/actions/:id/approve
router.patch('/actions/:id/approve', verifyToken, async (req, res) => {
    try {
        const result = await AIActionExecutor.approveAction(req.params.id, req.userId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/ai/actions/:id/reject
router.patch('/actions/:id/reject', verifyToken, async (req, res) => {
    const { reason } = req.body;
    try {
        const result = await AIActionExecutor.rejectAction(req.params.id, req.userId, reason);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/ai/actions/:id/execute
router.post('/actions/:id/execute', verifyToken, async (req, res) => {
    try {
        const result = await AIActionExecutor.executeAction(req.params.id, req.userId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== AUDIT ====================

// GET /api/ai/audit
router.get('/audit', verifyToken, async (req, res) => {
    if (!req.can('view_audit_logs')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    const { projectId, userId, actionType, limit, offset } = req.query;

    try {
        const logs = await AIAuditLogger.getAuditLogs(req.organizationId, {
            projectId, userId, actionType,
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0
        });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/ai/audit/stats
router.get('/audit/stats', verifyToken, async (req, res) => {
    const { projectId } = req.query;
    try {
        const stats = await AIAuditLogger.getAuditStats(req.organizationId, projectId);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /api/ai/audit/:id/decision
router.post('/audit/:id/decision', verifyToken, async (req, res) => {
    const { decision, feedback } = req.body;
    try {
        const result = await AIAuditLogger.recordUserDecision(req.params.id, decision, feedback);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==================== EXPLAINABILITY ====================

// GET /api/ai/explanations/:projectId - Get AI explanations for a project
router.get('/explanations/:projectId', verifyToken, async (req, res) => {
    if (!req.can('view_audit_logs')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    const { limit, offset } = req.query;

    try {
        const logs = await AIAuditLogger.getAuditLogs(req.organizationId, {
            projectId: req.params.projectId,
            limit: parseInt(limit) || 50,
            offset: parseInt(offset) || 0,
            includeExplanation: true
        });

        // Extract only explanation data for clean API response
        const explanations = logs.map(log => ({
            id: log.id,
            timestamp: log.created_at,
            explanation: log.explanation,
            aiResponse: log.ai_suggestion,
            userDecision: log.user_decision
        }));

        res.json({
            projectId: req.params.projectId,
            total: explanations.length,
            explanations
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /api/ai/explanations/export - Export all explanations as JSON for compliance
router.get('/explanations/export', verifyToken, async (req, res) => {
    if (!req.can('view_audit_logs')) {
        return res.status(403).json({ error: 'Permission denied' });
    }

    const { projectId, startDate, endDate } = req.query;

    try {
        const logs = await AIAuditLogger.getAuditLogs(req.organizationId, {
            projectId: projectId || null,
            limit: 1000, // Reasonable limit for export
            offset: 0,
            includeExplanation: true
        });

        // Filter by date range if provided
        let filteredLogs = logs;
        if (startDate) {
            const start = new Date(startDate);
            filteredLogs = filteredLogs.filter(log => new Date(log.created_at) >= start);
        }
        if (endDate) {
            const end = new Date(endDate);
            filteredLogs = filteredLogs.filter(log => new Date(log.created_at) <= end);
        }

        // Format for compliance export
        const exportData = {
            exportedAt: new Date().toISOString(),
            organizationId: req.organizationId,
            projectId: projectId || 'ALL',
            totalRecords: filteredLogs.length,
            dateRange: {
                start: startDate || 'N/A',
                end: endDate || 'N/A'
            },
            records: filteredLogs.map(log => ({
                id: log.id,
                userId: log.user_id,
                projectId: log.project_id,
                timestamp: log.created_at,
                actionType: log.action_type,
                explanation: log.explanation,
                aiResponse: log.ai_suggestion,
                userDecision: log.user_decision,
                userFeedback: log.user_feedback
            }))
        };

        // Set headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="ai_explanations_${new Date().toISOString().split('T')[0]}.json"`);
        res.json(exportData);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;

