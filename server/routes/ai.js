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
    const { message, history, systemInstruction, context, roleName, language } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'message required' });
    }

    // Build language instruction based on user's i18n setting
    const languageMap = {
        'pl': 'Polish (Polski)',
        'en': 'English',
        'de': 'German (Deutsch)',
        'es': 'Spanish (Español)',
        'ja': 'Japanese (日本語)',
        'ar': 'Arabic (العربية)'
    };
    const langName = languageMap[language] || languageMap['pl'];
    const languageInstruction = `\n\n[LANGUAGE INSTRUCTION: Always respond in ${langName}. This is critical - the user's interface is set to ${langName}, so ALL your responses MUST be in ${langName}.]\n`;

    // Prepend language instruction to system instruction
    const enhancedSystemInstruction = (systemInstruction || '') + languageInstruction;

    // Use New Professional AIPipeline
    const { AIPipeline } = require('../services/ai/aiPipeline');
    const aiPipeline = new AIPipeline();

    try {
        const pipelineRequest = {
            type: 'chat',
            userId: req.userId,
            organizationId: req.organizationId,
            prompt: message,
            messages: (history || []).map(m => ({
                role: m.role === 'model' ? 'assistant' : m.role,
                content: m.parts?.[0]?.text || m.content || ''
            })),
            capability: 'chat',
            screenContext: context?.screenContext || req.body.screenContext,
            stream: true,
            options: {
                role: roleName,
                systemInstruction: enhancedSystemInstruction
            }
        };

        const response = await aiPipeline.process(pipelineRequest);

        // Set headers for SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        if (response.stream) {
            for await (const chunk of response.stream) {
                if (chunk) res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            }
            res.write('data: [DONE]\n\n');
            res.end();
        } else {
            res.write(`data: ${JSON.stringify({ text: response.content || '' })}\n\n`);
            res.write('data: [DONE]\n\n');
            res.end();
        }

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
        console.error('Chat Error:', err);
        if (err.isBudgetError) {
            return res.status(403).json({
                error: err.message,
                code: 'AI_BUDGET_EXHAUSTED',
                budgetStatus: err.budgetStatus
            });
        }
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

// GET /api/ai/actions/proposals
router.get('/actions/proposals', verifyToken, async (req, res) => {
    // RBAC: ADMIN or SUPERADMIN
    if (req.userRole !== 'ADMIN' && req.userRole !== 'SUPERADMIN') {
        const logger = require('../utils/logger');
        logger.warn('Unauthorized proposal access attempt', { userId: req.userId, role: req.userRole });
        return res.status(403).json({ error: 'Permission denied. ADMIN or SUPERADMIN required.' });
    }

    // SUPERADMIN can specify ?organizationId=...
    const organizationId = (req.userRole === 'SUPERADMIN' && req.query.organizationId)
        ? req.query.organizationId
        : req.organizationId;

    if (!organizationId) {
        return res.status(400).json({ error: 'organizationId required' });
    }

    try {
        const logger = require('../utils/logger');
        const { getRequestContext } = require('../utils/requestContext');

        logger.info('Generating action proposals', {
            ...getRequestContext(req),
            targetOrgId: organizationId
        });

        // Use the correct paths for AI components
        const AIContextBuilder = require('../services/aiContextBuilder');
        const ActionProposalEngine = require('../ai/actionProposalEngine');

        const context = await AIContextBuilder.buildContext(null, organizationId);
        const proposals = ActionProposalEngine.generateProposals(context);

        res.json(proposals);
    } catch (err) {
        console.error('[AI Proposals] Error:', err);
        if (err.isBudgetError) {
            return res.status(403).json({
                error: err.message,
                code: 'AI_BUDGET_EXHAUSTED',
                budgetStatus: err.budgetStatus
            });
        }
        res.status(500).json({ error: err.message });
    }
});

// LAYER 2: RECOMMEND (Generate initiatives from diagnosis/assessment)
router.post('/recommend', verifyToken, async (req, res) => {
    const { diagnosisReport } = req.body;

    if (!diagnosisReport) {
        return res.status(400).json({ error: 'diagnosisReport required' });
    }

    try {
        const { AIPipeline } = require('../services/ai/aiPipeline');
        const aiPipeline = new AIPipeline();

        // Build a rich prompt for initiative generation
        const assessment = diagnosisReport.assessment || {};
        const goals = diagnosisReport.goals || ['Digital Transformation'];
        const painPoints = diagnosisReport.painPoints || [];
        const industry = diagnosisReport.industry || 'General';

        const initiativesPrompt = `You are a strategic transformation consultant. Based on the assessment data and business context, generate specific transformation initiatives.

BUSINESS CONTEXT:
- Industry: ${industry}
- Strategic Goals: ${goals.join(', ')}
- Pain Points: ${painPoints.join(', ')}

ASSESSMENT DATA:
${JSON.stringify(assessment, null, 2)}

Generate 5-10 strategic initiatives. For each initiative, provide:
1. name: Clear, actionable initiative name
2. description: Brief description of what the initiative involves
3. axis: Which assessment axis it addresses (processes, digitalProducts, businessModels, dataManagement, culture, cybersecurity, aiMaturity)
4. priority: HIGH, MEDIUM, or LOW
5. complexity: Low, Medium, or High
6. estimatedROI: Expected ROI multiplier (e.g., 1.5x, 2x, 3x)
7. estimatedBudget: Rough budget range in PLN
8. hypothesis: The expected outcome/benefit

Return as a JSON array of initiatives.`;

        const response = await aiPipeline.process({
            type: 'chat',
            capability: 'strategic',
            userId: req.userId,
            organizationId: req.organizationId,
            prompt: initiativesPrompt,
            stream: false
        });

        // Parse the response - try to extract JSON from the text
        let initiatives = [];
        try {
            const text = response.text || response.content || '';
            // Try to find JSON array in response
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                initiatives = JSON.parse(jsonMatch[0]);
            }
        } catch (parseErr) {
            console.warn('[AI Recommend] Failed to parse AI response as JSON:', parseErr);
        }

        // If no valid initiatives, generate fallback based on assessment
        if (!initiatives || initiatives.length === 0) {
            console.warn('[AI Recommend] No initiatives parsed, using fallback generation');
            initiatives = generateFallbackInitiatives(assessment, goals, industry);
        }

        // Ensure each initiative has required fields and a unique ID
        const { v4: uuidv4 } = require('uuid');
        initiatives = initiatives.map((init, idx) => ({
            id: init.id || uuidv4(),
            name: init.name || `Initiative ${idx + 1}`,
            description: init.description || init.summary || '',
            hypothesis: init.hypothesis || init.description || '',
            axis: init.axis || 'processes',
            area: init.area || null,
            priority: init.priority || 'MEDIUM',
            complexity: init.complexity || 'Medium',
            estimatedROI: parseFloat(init.estimatedROI) || 1.5,
            estimatedBudget: parseInt(init.estimatedBudget) || 100000,
            status: 'DRAFT',
            progress: 0,
            quarter: 'Q1',
            wave: 'Wave 1'
        }));

        res.json(initiatives);
    } catch (err) {
        console.error('[AI Recommend] Error:', err);
        
        // Return fallback initiatives instead of error
        const fallbackInitiatives = generateFallbackInitiatives(
            diagnosisReport.assessment || {},
            diagnosisReport.goals || ['Digital Transformation'],
            diagnosisReport.industry || 'General'
        );
        res.json(fallbackInitiatives);
    }
});

// Fallback initiative generator
function generateFallbackInitiatives(assessment, goals, industry) {
    const { v4: uuidv4 } = require('uuid');
    const axes = ['processes', 'digitalProducts', 'businessModels', 'dataManagement', 'culture', 'cybersecurity', 'aiMaturity'];
    
    const templates = {
        processes: { name: 'Process Automation Initiative', priority: 'HIGH', roi: 2.0, budget: 200000 },
        digitalProducts: { name: 'Digital Product Development', priority: 'MEDIUM', roi: 2.5, budget: 300000 },
        businessModels: { name: 'Business Model Innovation', priority: 'MEDIUM', roi: 3.0, budget: 250000 },
        dataManagement: { name: 'Data Governance Implementation', priority: 'HIGH', roi: 1.8, budget: 150000 },
        culture: { name: 'Digital Culture Transformation', priority: 'MEDIUM', roi: 1.5, budget: 100000 },
        cybersecurity: { name: 'Cybersecurity Enhancement Program', priority: 'HIGH', roi: 1.5, budget: 180000 },
        aiMaturity: { name: 'AI Adoption Roadmap', priority: 'MEDIUM', roi: 2.2, budget: 220000 }
    };

    // Generate initiatives for axes with gaps (or all if no assessment)
    const initiativesToGenerate = Object.keys(assessment).length > 0 
        ? axes.filter(axis => assessment[axis]?.current < assessment[axis]?.target)
        : axes.slice(0, 5);

    return initiativesToGenerate.map(axis => {
        const template = templates[axis] || templates.processes;
        return {
            id: uuidv4(),
            name: template.name,
            description: `${template.name} for ${industry}`,
            hypothesis: `Implementing this initiative will improve ${axis} maturity and support: ${goals[0]}`,
            axis,
            area: null,
            priority: template.priority,
            complexity: 'Medium',
            estimatedROI: template.roi,
            estimatedBudget: template.budget,
            status: 'DRAFT',
            progress: 0,
            quarter: 'Q1',
            wave: 'Wave 1'
        };
    });
}

// LAYER 3: ROADMAP
router.post('/roadmap', verifyToken, async (req, res) => {
    const { initiatives } = req.body;

    if (!initiatives || !Array.isArray(initiatives)) {
        return res.status(400).json({ error: 'initiatives array required' });
    }

    try {
        const { AIPipeline } = require('../services/ai/aiPipeline');
        const aiPipeline = new AIPipeline();

        // Format initiatives for the prompt
        const initiativesSummary = initiatives.map((init, idx) => 
            `${idx + 1}. "${init.name}" - Priority: ${init.priority || 'Medium'}, Complexity: ${init.complexity || 'Medium'}, ROI: ${init.expectedRoi || init.roi || 'Unknown'}`
        ).join('\n');

        const roadmapPrompt = `You are a strategic transformation consultant. Create an optimized implementation roadmap for the following initiatives.

INITIATIVES TO SCHEDULE:
${initiativesSummary}

RULES:
1. High priority + Low complexity initiatives should go in Q1-Q2 Year 1 (quick wins)
2. High priority + High complexity initiatives should start Q2 Year 1 with longer duration
3. Medium/Low priority can be scheduled in Year 2-3
4. Consider dependencies - foundation initiatives before dependent ones
5. Balance workload across quarters - no more than 3-4 major initiatives per quarter
6. Return the EXACT initiative names as provided (case-sensitive)

Return a structured roadmap assigning each initiative to a specific quarter.`;

        const response = await aiPipeline.process({
            type: 'structured',
            capability: 'strategic',
            userId: req.userId,
            organizationId: req.organizationId,
            prompt: roadmapPrompt,
            schema: 'roadmap',
            stream: false
        });

        // Ensure we have a valid response structure
        const roadmapData = response.object || response;
        
        // Validate response has required structure
        if (!roadmapData.year1) {
            console.warn('[AI Roadmap] Invalid response structure, using fallback');
            // Fallback: distribute initiatives evenly
            const fallback = {
                year1: { q1: [], q2: [], q3: [], q4: [] },
                year2: { q1: [], q2: [], q3: [], q4: [] },
                reasoning: 'Fallback distribution due to AI response error'
            };
            
            initiatives.forEach((init, idx) => {
                const quarter = idx % 4;
                const year = idx < 8 ? 'year1' : 'year2';
                const qKey = `q${quarter + 1}`;
                fallback[year][qKey].push(init.name);
            });
            
            return res.json(fallback);
        }

        res.json(roadmapData);
    } catch (err) {
        console.error('[AI Roadmap] Error:', err);
        
        // Return fallback roadmap instead of error
        const fallback = {
            year1: { q1: [], q2: [], q3: [], q4: [] },
            year2: { q1: [], q2: [], q3: [], q4: [] },
            reasoning: 'Fallback distribution due to error: ' + err.message
        };
        
        initiatives.forEach((init, idx) => {
            const quarter = idx % 4;
            const year = idx < 8 ? 'year1' : 'year2';
            const qKey = `q${quarter + 1}`;
            fallback[year][qKey].push(init.name);
        });
        
        res.json(fallback);
    }
});

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

