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
// Enhanced with connection monitoring, partial save, and reconnection support
router.post('/chat/stream', verifyToken, async (req, res) => {
    const { message, history, systemInstruction, context, roleName, language, conversationId, resumeFromPartial } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'message required' });
    }

    // Generate stream session ID for partial save/resume
    const streamSessionId = conversationId || `stream-${req.userId}-${Date.now()}`;
    let accumulatedContent = '';
    let lastSaveTime = Date.now();
    let isClientConnected = true;
    let streamAborted = false;

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

    // Set headers for SSE BEFORE any data is written
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Stream-Session-Id', streamSessionId);
    res.flushHeaders();

    // CONNECTION MONITORING: Detect client disconnect
    const connectionCleanup = () => {
        isClientConnected = false;
        streamAborted = true;
        console.log(`[Stream] Client disconnected: ${streamSessionId}`);
        
        // Save partial response on disconnect
        if (accumulatedContent.length > 0) {
            savePartialResponse(streamSessionId, accumulatedContent, req.userId, req.organizationId)
                .catch(err => console.error('[Stream] Failed to save partial:', err));
        }
    };

    req.socket.on('close', connectionCleanup);
    req.socket.on('error', connectionCleanup);
    res.on('close', connectionCleanup);

    // Helper: Save partial response to database
    const savePartialResponse = async (sessionId, content, userId, orgId) => {
        const db = require('../database');
        const { v4: uuidv4 } = require('uuid');
        
        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO ai_partial_responses (id, session_id, user_id, organization_id, content, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(session_id) DO UPDATE SET
                    content = excluded.content,
                    updated_at = CURRENT_TIMESTAMP
            `, [uuidv4(), sessionId, userId, orgId, content], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    };

    try {
        // RESUME FROM PARTIAL: Check if we should resume from saved partial
        if (resumeFromPartial && conversationId) {
            const db = require('../database');
            const partial = await new Promise((resolve) => {
                db.get(`SELECT content FROM ai_partial_responses WHERE session_id = ? AND user_id = ?`,
                    [conversationId, req.userId], (err, row) => {
                        resolve(row?.content || null);
                    });
            });
            
            if (partial) {
                accumulatedContent = partial;
                res.write(`data: ${JSON.stringify({ 
                    type: 'resume', 
                    text: partial,
                    sessionId: streamSessionId 
                })}\n\n`);
            }
        }

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

        const response = await aiPipeline.process(pipelineRequest, (progress) => {
            // Check if client still connected before writing
            if (!isClientConnected || res.destroyed) return;
            
            // Stream thinking steps to client
            res.write(`data: ${JSON.stringify({
                type: 'thought',
                ...progress
            })}\n\n`);
        });

        if (response.stream) {
            for await (const chunk of response.stream) {
                // Check connection before each write
                if (!isClientConnected || res.destroyed || streamAborted) {
                    console.log(`[Stream] Aborting stream - client disconnected: ${streamSessionId}`);
                    break;
                }
                
                if (chunk) {
                    accumulatedContent += chunk;
                    res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
                    
                    // PARTIAL SAVE: Save every 2 seconds during stream
                    if (Date.now() - lastSaveTime > 2000) {
                        savePartialResponse(streamSessionId, accumulatedContent, req.userId, req.organizationId)
                            .catch(err => console.warn('[Stream] Partial save failed:', err.message));
                        lastSaveTime = Date.now();
                    }
                }
            }
            
            // Stream completed successfully - cleanup partial
            if (isClientConnected && !streamAborted) {
                res.write('data: [DONE]\n\n');
                
                // Delete partial response on successful completion
                const db = require('../database');
                db.run(`DELETE FROM ai_partial_responses WHERE session_id = ?`, [streamSessionId], () => {});
            }
            res.end();
        } else {
            if (isClientConnected && !res.destroyed) {
                res.write(`data: ${JSON.stringify({ text: response.content || '' })}\n\n`);
                res.write('data: [DONE]\n\n');
            }
            res.end();
        }

    } catch (err) {
        console.error('Stream Error:', err);
        
        // Save partial on error
        if (accumulatedContent.length > 0) {
            savePartialResponse(streamSessionId, accumulatedContent, req.userId, req.organizationId)
                .catch(e => console.warn('[Stream] Failed to save partial on error:', e.message));
        }
        
        if (isClientConnected && !res.destroyed) {
            res.write(`data: ${JSON.stringify({ 
                error: err.message,
                sessionId: streamSessionId,
                canResume: accumulatedContent.length > 0
            })}\n\n`);
            res.end();
        }
    } finally {
        // Cleanup listeners
        req.socket.removeListener('close', connectionCleanup);
        req.socket.removeListener('error', connectionCleanup);
        res.removeListener('close', connectionCleanup);
    }
});

// GET /api/ai/stream/partial/:sessionId - Get partial response for resume
router.get('/stream/partial/:sessionId', verifyToken, async (req, res) => {
    const db = require('../database');
    
    db.get(`
        SELECT content, updated_at 
        FROM ai_partial_responses 
        WHERE session_id = ? AND user_id = ?
    `, [req.params.sessionId, req.userId], (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!row) return res.status(404).json({ error: 'No partial response found' });
        
        res.json({
            sessionId: req.params.sessionId,
            content: row.content,
            updatedAt: row.updated_at,
            canResume: true
        });
    });
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
            dataSources: result.responseContext?.dataSources || [],
            prompt: result.prompt, // For LLM integration
            policyLevel: result.responseContext?.policy?.policyLevel || 'ADVISORY'
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

// ==================== HEALTH MONITORING ====================

// GET /api/ai/health - AI System Health Status
router.get('/health', async (req, res) => {
    try {
        const { healthMonitor } = require('../services/ai/healthMonitor');
        const status = healthMonitor.getStatus();

        res.json({
            status: status.lastCheck?.overall || 'unknown',
            isRunning: status.isRunning,
            lastCheck: status.lastCheck?.timestamp,
            consecutiveFailures: status.consecutiveFailures,
            providers: status.providers,
            checks: status.lastCheck?.checks || []
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            error: err.message
        });
    }
});

// POST /api/ai/health/diagnose - Run Full Diagnostics
router.post('/health/diagnose', verifyToken, async (req, res) => {
    try {
        const { healthMonitor } = require('../services/ai/healthMonitor');
        const results = await healthMonitor.runDiagnostics();

        res.json(results);
    } catch (err) {
        res.status(500).json({
            status: 'error',
            error: err.message
        });
    }
});

// ==================== SMART SUGGESTIONS ====================

// GET /api/ai/suggestions - Get context-aware suggestions
router.get('/suggestions', verifyToken, async (req, res) => {
    try {
        const { projectId } = req.query;
        const smartSuggestions = require('../services/ai/smartSuggestions');

        const suggestions = await smartSuggestions.getCachedSuggestions(
            req.userId,
            projectId,
            {} // No conversation context for standalone call
        );

        res.json({ suggestions });
    } catch (err) {
        console.error('[AI] Suggestions error:', err);
        res.status(500).json({
            error: err.message,
            suggestions: []
        });
    }
});

// POST /api/ai/suggestions - Get suggestions with conversation context
router.post('/suggestions', verifyToken, async (req, res) => {
    try {
        const { projectId, conversationContext } = req.body;
        const smartSuggestions = require('../services/ai/smartSuggestions');

        const suggestions = await smartSuggestions.getSuggestions(
            req.userId,
            projectId,
            conversationContext || {}
        );

        res.json({ suggestions });
    } catch (err) {
        console.error('[AI] Suggestions error:', err);
        res.status(500).json({
            error: err.message,
            suggestions: []
        });
    }
});

// ==================== APPROVAL PATTERNS (HITL Learning) ====================

const ApprovalPatternService = require('../services/approvalPatternService');

// GET /api/ai/patterns - Get user's approval patterns
router.get('/patterns', verifyToken, async (req, res) => {
    try {
        const { actionType } = req.query;
        const patterns = await ApprovalPatternService.getUserPatterns(req.userId, actionType);
        res.json({ success: true, patterns });
    } catch (err) {
        console.error('[AI] Get patterns error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/ai/patterns/stats - Get pattern statistics
router.get('/patterns/stats', verifyToken, async (req, res) => {
    try {
        const stats = await ApprovalPatternService.getPatternStats(req.userId);
        res.json(stats);
    } catch (err) {
        console.error('[AI] Pattern stats error:', err);
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/ai/patterns/:patternId/auto-apply - Toggle auto-apply
router.patch('/patterns/:patternId/auto-apply', verifyToken, async (req, res) => {
    try {
        const { enabled } = req.body;
        const result = await ApprovalPatternService.setAutoApply(
            req.params.patternId,
            enabled,
            req.userId
        );
        res.json(result);
    } catch (err) {
        console.error('[AI] Toggle auto-apply error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// DELETE /api/ai/patterns/:patternId - Delete a pattern
router.delete('/patterns/:patternId', verifyToken, async (req, res) => {
    try {
        const result = await ApprovalPatternService.deletePattern(
            req.params.patternId,
            req.userId
        );
        res.json(result);
    } catch (err) {
        console.error('[AI] Delete pattern error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/ai/actions/:actionId/approve - Approve action with pattern learning
router.post('/actions/:actionId/approve', verifyToken, async (req, res) => {
    try {
        const { alwaysApprove } = req.body;
        const result = await AIActionExecutor.approveAction(
            req.params.actionId,
            req.userId,
            { alwaysApprove }
        );
        res.json(result);
    } catch (err) {
        console.error('[AI] Approve action error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/ai/actions/:actionId/reject - Reject action with pattern learning
router.post('/actions/:actionId/reject', verifyToken, async (req, res) => {
    try {
        const { reason, alwaysReject } = req.body;
        const result = await AIActionExecutor.rejectAction(
            req.params.actionId,
            req.userId,
            reason,
            { alwaysReject }
        );
        res.json(result);
    } catch (err) {
        console.error('[AI] Reject action error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/ai/actions/pending - Get pending actions with pattern info
router.get('/actions/pending', verifyToken, async (req, res) => {
    try {
        const { projectId } = req.query;
        const actions = await AIActionExecutor.getPendingActions(
            req.userId,
            projectId,
            req.organizationId
        );

        // Enrich with pattern info
        const actionsWithPatterns = await Promise.all(
            actions.map(async (action) => {
                const patternInfo = await AIActionExecutor.getPatternInfo(
                    req.userId,
                    action.action_type,
                    action.payload || {}
                );
                return { ...action, patternInfo };
            })
        );

        res.json({ success: true, actions: actionsWithPatterns });
    } catch (err) {
        console.error('[AI] Get pending actions error:', err);
        res.status(500).json({ success: false, error: err.message, actions: [] });
    }
});

// ==================== FEEDBACK & REPORTING ====================

/**
 * POST /api/ai/feedback
 * Report user feedback on an AI message (thumbs up/down)
 */
router.post('/feedback', verifyToken, async (req, res) => {
    const { messageId, rating } = req.body;
    const userId = req.userId;

    try {
        // Log feedback for analytics
        console.log(`[AI Feedback] User ${userId} rated message ${messageId} as ${rating}`);
        
        // Store in audit log for tracking (non-blocking)
        try {
            const aiLogger = require('../services/ai/logger');
            await aiLogger.log('feedback', {
                userId,
                messageId,
                rating,
                timestamp: new Date().toISOString()
            });
        } catch (logErr) {
            console.warn('[AI] Could not log feedback:', logErr.message);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[AI] Feedback error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * POST /api/ai/report
 * Report a problematic AI message
 */
router.post('/report', verifyToken, async (req, res) => {
    const { messageId, reason } = req.body;
    const userId = req.userId;

    try {
        // Log report - this is serious, log with emphasis
        console.error(`[AI REPORT] 🚨 User ${userId} reported message ${messageId}: ${reason}`);
        
        // Store in audit log for review (non-blocking)
        try {
            const aiLogger = require('../services/ai/logger');
            await aiLogger.log('report', {
                userId,
                messageId,
                reason,
                timestamp: new Date().toISOString(),
                severity: reason === 'harmful' ? 'critical' : 'warning'
            });
        } catch (logErr) {
            console.warn('[AI] Could not log report:', logErr.message);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[AI] Report error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==================== MEMORY METRICS (Enterprise Dashboard) ====================

/**
 * GET /api/ai/memory/metrics
 * Get memory metrics for dashboard visualization
 */
router.get('/memory/metrics', verifyToken, async (req, res) => {
    try {
        const AIMemoryMetricsService = require('../services/ai/aiMemoryMetricsService');
        const { period = 7 } = req.query;
        
        const metrics = await AIMemoryMetricsService.getDashboardMetrics(
            req.organizationId,
            parseInt(period, 10)
        );
        
        res.json({ success: true, ...metrics });
    } catch (err) {
        console.error('[AI] Memory metrics error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/ai/memory/current
 * Get current memory state for a project
 */
router.get('/memory/current', verifyToken, async (req, res) => {
    try {
        const AIMemoryMetricsService = require('../services/ai/aiMemoryMetricsService');
        const { projectId } = req.query;
        
        const state = await AIMemoryMetricsService.getCurrentMemoryState(
            projectId,
            req.organizationId
        );
        
        res.json({ success: true, ...state });
    } catch (err) {
        console.error('[AI] Current memory state error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

/**
 * GET /api/ai/memory/latency
 * Get memory operation latency percentiles
 */
router.get('/memory/latency', verifyToken, async (req, res) => {
    try {
        const AIMemoryMetricsService = require('../services/ai/aiMemoryMetricsService');
        const { hours = 24 } = req.query;
        
        const latency = await AIMemoryMetricsService.getLatencyPercentiles(
            req.organizationId,
            parseInt(hours, 10)
        );
        
        res.json({ success: true, ...latency });
    } catch (err) {
        console.error('[AI] Latency metrics error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==================== PROACTIVE SUGGESTIONS ====================

const ProactiveSuggestionsService = require('../services/ai/proactiveSuggestionsService');
const ResponseQualityService = require('../services/ai/responseQualityService');

// GET /api/ai/suggestions - Get proactive suggestions based on context
router.get('/suggestions', verifyToken, async (req, res) => {
    try {
        const { projectId, screenContext } = req.query;
        
        const suggestions = await ProactiveSuggestionsService.generateSuggestions({
            userId: req.userId,
            organizationId: req.organizationId,
            projectId: projectId || null,
            screenContext: screenContext ? JSON.parse(screenContext) : null,
            recentActions: [] // Could be populated from session or recent activity
        });

        res.json({ success: true, suggestions });
    } catch (err) {
        console.error('[AI] Proactive suggestions error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// POST /api/ai/suggestions/action - Record suggestion action (accepted/dismissed)
router.post('/suggestions/action', verifyToken, async (req, res) => {
    try {
        const { suggestionId, action, feedback } = req.body;
        
        if (!suggestionId || !action) {
            return res.status(400).json({ success: false, error: 'suggestionId and action required' });
        }
        
        const validActions = ['accepted', 'dismissed', 'clicked'];
        if (!validActions.includes(action)) {
            return res.status(400).json({ success: false, error: 'Invalid action type' });
        }

        await ProactiveSuggestionsService.recordSuggestionAction(
            suggestionId,
            req.userId,
            action,
            feedback
        );

        res.json({ success: true });
    } catch (err) {
        console.error('[AI] Suggestion action error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/ai/suggestions/metrics - Get suggestion effectiveness metrics
router.get('/suggestions/metrics', verifyToken, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        
        const metrics = await ProactiveSuggestionsService.getSuggestionMetrics(
            req.organizationId,
            parseInt(days, 10)
        );

        res.json({ success: true, metrics });
    } catch (err) {
        console.error('[AI] Suggestion metrics error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==================== RESPONSE QUALITY ====================

// POST /api/ai/quality/calculate - Calculate quality metrics for a response
router.post('/quality/calculate', verifyToken, async (req, res) => {
    try {
        const { query, response, context, sources } = req.body;
        
        if (!query || !response) {
            return res.status(400).json({ success: false, error: 'query and response required' });
        }

        const metrics = await ResponseQualityService.calculateQuality({
            query,
            response,
            context: {
                ...context,
                organizationId: req.organizationId
            },
            sources: sources || []
        });

        res.json({ success: true, metrics });
    } catch (err) {
        console.error('[AI] Quality calculation error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/ai/quality/aggregate - Get aggregate quality metrics
router.get('/quality/aggregate', verifyToken, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        
        const metrics = await ResponseQualityService.getAggregateMetrics(
            req.organizationId,
            parseInt(days, 10)
        );

        res.json({ success: true, metrics });
    } catch (err) {
        console.error('[AI] Aggregate quality metrics error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

// GET /api/ai/quality/trends - Get quality trends over time
router.get('/quality/trends', verifyToken, async (req, res) => {
    try {
        const { days = 30 } = req.query;
        
        const trends = await ResponseQualityService.getQualityTrends(
            req.organizationId,
            parseInt(days, 10)
        );

        res.json({ success: true, trends });
    } catch (err) {
        console.error('[AI] Quality trends error:', err);
        res.status(500).json({ success: false, error: err.message });
    }
});

module.exports = router;

