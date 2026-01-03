/**
 * AI Routes
 * Complete AI API - Enterprise PMO Brain
 */

import { Router, Response } from 'express';
import { z } from 'zod';
import { verifyToken, type AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';
import { validateBody, validateQuery, validateParams } from '../middleware/validation.middleware';
import {
    ChatRequestSchema,
    ChatStreamRequestSchema,
    AIContextQuerySchema,
    UpdatePolicyRequestSchema,
    CanPerformActionQuerySchema,
    RecordDecisionRequestSchema,
    UpdateUserPreferencesRequestSchema,
    CreateDraftRequestSchema,
    GetPendingActionsQuerySchema,
    ApproveActionRequestSchema,
    RejectActionRequestSchema,
    GenerateProposalsQuerySchema,
    RecommendRequestSchema,
    RoadmapRequestSchema,
    GetAuditLogsQuerySchema,
    RecordAuditDecisionRequestSchema,
    GetExplanationsQuerySchema,
    ExportExplanationsQuerySchema,
    GetSuggestionsQuerySchema,
    PostSuggestionsRequestSchema,
    RecordSuggestionActionRequestSchema,
    GetSuggestionMetricsQuerySchema,
    CalculateQualityRequestSchema,
    GetAggregateQualityQuerySchema,
    GetQualityTrendsQuerySchema,
    GetPatternsQuerySchema,
    ToggleAutoApplyRequestSchema,
    RecordFeedbackRequestSchema,
    ReportMessageRequestSchema,
    GetMemoryMetricsQuerySchema,
    GetCurrentMemoryQuerySchema,
    GetMemoryLatencyQuerySchema,
    ProjectIdParamSchema,
    ActionIdParamSchema,
    PatternIdParamSchema,
    AuditIdParamSchema,
    SessionIdParamSchema,
    ActionTypeParamSchema,
} from '../validators/ai.validators';

const router = Router();

// Lazy load services to avoid circular dependencies
const getAIContextBuilder = () => require('../../services/aiContextBuilder');
const getAIPolicyEngine = () => require('../../services/aiPolicyEngine');
const getAIMemoryManager = () => require('../../services/aiMemoryManager');
const getAIOrchestrator = () => require('../../services/aiOrchestrator');
const getAIActionExecutor = () => require('../../services/aiActionExecutor');
const getAIAuditLogger = () => require('../../services/aiAuditLogger');
const getAIPipeline = () => {
    const { AIPipeline } = require('../../services/ai/aiPipeline');
    return new AIPipeline();
};

// ==================== CONTEXT ====================

router.get('/context', verifyToken, validateQuery(AIContextQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const AIContextBuilder = getAIContextBuilder();
        const context = await AIContextBuilder.buildContext(
            req.userId,
            req.organizationId,
            null,
            { currentScreen: (req.query as { screen?: string }).screen }
        );
        res.json(context);
    } catch (err) {
        const error = err as Error;
        res.status(500).json({ error: error.message });
    }
}));

router.get('/context/:projectId', verifyToken, validateParams(ProjectIdParamSchema), validateQuery(AIContextQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const AIContextBuilder = getAIContextBuilder();
        const context = await AIContextBuilder.buildContext(
            req.userId,
            req.organizationId,
            req.params.projectId,
            { currentScreen: (req.query as { screen?: string }).screen }
        );
        res.json(context);
    } catch (err) {
        const error = err as Error;
        res.status(500).json({ error: error.message });
    }
}));

// ==================== CHAT ====================

router.post('/chat/stream', verifyToken, validateBody(ChatStreamRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    const body = req.body as {
        message: string;
        history?: Array<{ role: string; content?: string; parts?: Array<{ text: string }> }>;
        systemInstruction?: string;
        context?: Record<string, unknown>;
        roleName?: string;
        language?: string;
        conversationId?: string;
        resumeFromPartial?: boolean;
    };
    
    const { message, history, systemInstruction, context, roleName, language, conversationId, resumeFromPartial } = body;

    const streamSessionId = conversationId || `stream-${req.userId}-${Date.now()}`;
    let accumulatedContent = '';
    let lastSaveTime = Date.now();
    let isClientConnected = true;
    let streamAborted = false;

    const languageMap: Record<string, string> = {
        'pl': 'Polish (Polski)',
        'en': 'English',
        'de': 'German (Deutsch)',
        'es': 'Spanish (Español)',
        'ja': 'Japanese (日本語)',
        'ar': 'Arabic (العربية)'
    };
    const langName = languageMap[language || 'pl'] || languageMap['pl'];
    const languageInstruction = `\n\n[LANGUAGE INSTRUCTION: Always respond in ${langName}. This is critical - the user's interface is set to ${langName}, so ALL your responses MUST be in ${langName}.]\n`;

    const enhancedSystemInstruction = (systemInstruction || '') + languageInstruction;
    const aiPipeline = getAIPipeline();

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Stream-Session-Id', streamSessionId);
    res.flushHeaders();

    const connectionCleanup = () => {
        isClientConnected = false;
        streamAborted = true;
        console.log(`[Stream] Client disconnected: ${streamSessionId}`);
        
        if (accumulatedContent.length > 0) {
            savePartialResponse(streamSessionId, accumulatedContent, req.userId!, req.organizationId!)
                .catch(err => console.error('[Stream] Failed to save partial:', err));
        }
    };

    req.socket?.on('close', connectionCleanup);
    req.socket?.on('error', connectionCleanup);
    res.on('close', connectionCleanup);

    const savePartialResponse = async (sessionId: string, content: string, userId: string, orgId: string): Promise<void> => {
        const db = require('../../database');
        const { v4: uuidv4 } = require('uuid');
        
        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO ai_partial_responses (id, session_id, user_id, organization_id, content, updated_at)
                VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                ON CONFLICT(session_id) DO UPDATE SET
                    content = excluded.content,
                    updated_at = CURRENT_TIMESTAMP
            `, [uuidv4(), sessionId, userId, orgId, content], (err: Error | null) => {
                if (err) reject(err);
                else resolve();
            });
        });
    };

    try {
        if (resumeFromPartial && conversationId) {
            const db = require('../../database');
            const partial = await new Promise<string | null>((resolve) => {
                db.get(`SELECT content FROM ai_partial_responses WHERE session_id = ? AND user_id = ?`,
                    [conversationId, req.userId], (err: Error | null, row: { content: string } | null) => {
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
                content: (m as { parts?: Array<{ text: string }> }).parts?.[0]?.text || m.content || ''
            })),
            capability: 'chat',
            screenContext: (context as { screenContext?: unknown })?.screenContext || (req.body as { screenContext?: unknown }).screenContext,
            stream: true,
            options: {
                role: roleName,
                systemInstruction: enhancedSystemInstruction
            }
        };

        const response = await aiPipeline.process(pipelineRequest, (progress: Record<string, unknown>) => {
            if (!isClientConnected || res.destroyed) return;
            
            res.write(`data: ${JSON.stringify({
                type: 'thought',
                ...progress
            })}\n\n`);
        });

        if ((response as { stream?: AsyncIterable<string> }).stream) {
            for await (const chunk of (response as { stream: AsyncIterable<string> }).stream) {
                if (!isClientConnected || res.destroyed || streamAborted) {
                    console.log(`[Stream] Aborting stream - client disconnected: ${streamSessionId}`);
                    break;
                }
                
                if (chunk) {
                    accumulatedContent += chunk;
                    res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
                    
                    if (Date.now() - lastSaveTime > 2000) {
                        savePartialResponse(streamSessionId, accumulatedContent, req.userId!, req.organizationId!)
                            .catch(err => console.warn('[Stream] Partial save failed:', (err as Error).message));
                        lastSaveTime = Date.now();
                    }
                }
            }
            
            if (isClientConnected && !streamAborted) {
                res.write('data: [DONE]\n\n');
                
                const db = require('../../database');
                db.run(`DELETE FROM ai_partial_responses WHERE session_id = ?`, [streamSessionId], () => {});
            }
            res.end();
        } else {
            if (isClientConnected && !res.destroyed) {
                res.write(`data: ${JSON.stringify({ text: (response as { content?: string }).content || '' })}\n\n`);
                res.write('data: [DONE]\n\n');
            }
            res.end();
        }

    } catch (err) {
        console.error('Stream Error:', err);
        
        if (accumulatedContent.length > 0) {
            savePartialResponse(streamSessionId, accumulatedContent, req.userId!, req.organizationId!)
                .catch(e => console.warn('[Stream] Failed to save partial on error:', (e as Error).message));
        }
        
        if (isClientConnected && !res.destroyed) {
            res.write(`data: ${JSON.stringify({ 
                error: (err as Error).message,
                sessionId: streamSessionId,
                canResume: accumulatedContent.length > 0
            })}\n\n`);
            res.end();
        }
    } finally {
        req.socket?.removeListener('close', connectionCleanup);
        req.socket?.removeListener('error', connectionCleanup);
        res.removeListener('close', connectionCleanup);
    }
}));

router.get('/stream/partial/:sessionId', verifyToken, validateParams(SessionIdParamSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    const db = require('../../database');
    
    db.get(`
        SELECT content, updated_at 
        FROM ai_partial_responses 
        WHERE session_id = ? AND user_id = ?
    `, [req.params.sessionId, req.userId], (err: Error | null, row: { content: string; updated_at: string } | null) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row) {
            res.status(404).json({ error: 'No partial response found' });
            return;
        }
        
        res.json({
            sessionId: req.params.sessionId,
            content: row.content,
            updatedAt: row.updated_at,
            canResume: true
        });
    });
}));

router.post('/chat', verifyToken, validateBody(ChatRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { message, projectId, currentScreen, selectedObjectId, selectedObjectType } = req.body;

    try {
        const AIOrchestrator = getAIOrchestrator();
        const AIAuditLogger = getAIAuditLogger();

        const result = await AIOrchestrator.processMessage(
            message,
            req.userId!,
            req.organizationId!,
            projectId,
            { currentScreen, selectedObjectId, selectedObjectType }
        );

        await AIAuditLogger.logSuggestion(
            req.userId!,
            req.organizationId!,
            projectId,
            result.role,
            result.prompt,
            result.contextSummary
        );

        res.json({
            role: result.role,
            roleDescription: AIOrchestrator.getRoleDescription(result.role),
            intent: result.intent,
            contextSummary: result.contextSummary,
            dataSources: (result.responseContext as { dataSources?: unknown[] })?.dataSources || [],
            prompt: result.prompt,
            policyLevel: ((result.responseContext as { policy?: { policyLevel?: string } })?.policy?.policyLevel) || 'ADVISORY'
        });
    } catch (err) {
        console.error('Chat Error:', err);
        const error = err as Error & { isBudgetError?: boolean; budgetStatus?: unknown };
        if (error.isBudgetError) {
            res.status(403).json({
                error: error.message,
                code: 'AI_BUDGET_EXHAUSTED',
                budgetStatus: error.budgetStatus
            });
            return;
        }
        res.status(500).json({ error: error.message });
    }
}));

// ==================== POLICY ====================

router.get('/policy', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const AIPolicyEngine = getAIPolicyEngine();
        const policy = await AIPolicyEngine.getPolicySummary(req.organizationId!);
        res.json(policy);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
}));

router.patch('/policy', verifyToken, validateBody(UpdatePolicyRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('edit_organization_settings')) {
        res.status(403).json({ error: 'Admin required' });
        return;
    }

    try {
        const AIPolicyEngine = getAIPolicyEngine();
        const result = await AIPolicyEngine.updatePolicy(req.organizationId!, req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
}));

router.get('/policy/can-perform/:actionType', verifyToken, validateParams(ActionTypeParamSchema), validateQuery(CanPerformActionQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId } = req.query as { projectId?: string };
    try {
        const AIPolicyEngine = getAIPolicyEngine();
        const result = await AIPolicyEngine.canPerformAction(
            req.params.actionType,
            req.organizationId!,
            projectId,
            req.userId!
        );
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
}));

// ==================== MEMORY ====================

router.get('/memory/project/:projectId', verifyToken, validateParams(ProjectIdParamSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const AIMemoryManager = getAIMemoryManager();
        const memory = await AIMemoryManager.buildProjectMemorySummary(req.params.projectId);
        res.json(memory);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
}));

router.post('/memory/project/:projectId/decision', verifyToken, validateParams(ProjectIdParamSchema), validateBody(RecordDecisionRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { decisionId, title, outcome, rationale } = req.body;

    try {
        const AIMemoryManager = getAIMemoryManager();
        const result = await AIMemoryManager.recordDecision(
            req.params.projectId,
            decisionId,
            title,
            outcome,
            rationale,
            req.userId!
        );
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
}));

router.get('/memory/user', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const AIMemoryManager = getAIMemoryManager();
        const preferences = await AIMemoryManager.getUserPreferences(req.userId!);
        res.json(preferences);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
}));

router.patch('/memory/user', verifyToken, validateBody(UpdateUserPreferencesRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const AIMemoryManager = getAIMemoryManager();
        const result = await AIMemoryManager.updateUserPreferences(req.userId!, req.body);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
}));

router.delete('/memory/project/:projectId', verifyToken, validateParams(ProjectIdParamSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('edit_project_settings')) {
        res.status(403).json({ error: 'Permission denied' });
        return;
    }

    try {
        const AIMemoryManager = getAIMemoryManager();
        const result = await AIMemoryManager.clearProjectMemory(req.params.projectId);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
}));

// ==================== ACTIONS ====================

router.post('/actions/draft', verifyToken, validateBody(CreateDraftRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { draftType, content, projectId } = req.body;

    try {
        const AIActionExecutor = getAIActionExecutor();
        const result = await AIActionExecutor.createDraft(
            draftType,
            content,
            req.userId!,
            req.organizationId!,
            projectId
        );
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
}));

router.get('/actions/pending', verifyToken, validateQuery(GetPendingActionsQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId } = req.query as { projectId?: string };
    try {
        const AIActionExecutor = getAIActionExecutor();
        const actions = await AIActionExecutor.getPendingActions(
            null,
            projectId,
            req.organizationId!
        );
        res.json(actions);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
}));

router.patch('/actions/:id/approve', verifyToken, validateParams(ActionIdParamSchema), validateBody(ApproveActionRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const AIActionExecutor = getAIActionExecutor();
        const result = await AIActionExecutor.approveAction(req.params.id, req.userId!);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
}));

router.patch('/actions/:id/reject', verifyToken, validateParams(ActionIdParamSchema), validateBody(RejectActionRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { reason } = req.body;
    try {
        const AIActionExecutor = getAIActionExecutor();
        const result = await AIActionExecutor.rejectAction(req.params.id, req.userId!, reason);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
}));

router.post('/actions/:id/execute', verifyToken, validateParams(ActionIdParamSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const AIActionExecutor = getAIActionExecutor();
        const result = await AIActionExecutor.executeAction(req.params.id, req.userId!);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
}));

router.get('/actions/proposals', verifyToken, validateQuery(GenerateProposalsQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    if (req.userRole !== 'ADMIN' && req.userRole !== 'SUPERADMIN') {
        const logger = require('../../utils/logger');
        logger.warn('Unauthorized proposal access attempt', { userId: req.userId, role: req.userRole });
        res.status(403).json({ error: 'Permission denied. ADMIN or SUPERADMIN required.' });
        return;
    }

    const { organizationId: queryOrgId } = req.query as { organizationId?: string };
    const organizationId = (req.userRole === 'SUPERADMIN' && queryOrgId)
        ? queryOrgId
        : req.organizationId;

    if (!organizationId) {
        res.status(400).json({ error: 'organizationId required' });
        return;
    }

    try {
        const logger = require('../../utils/logger');
        const { getRequestContext } = require('../../utils/requestContext');

        logger.info('Generating action proposals', {
            ...getRequestContext(req),
            targetOrgId: organizationId
        });

        const AIContextBuilder = getAIContextBuilder();
        const ActionProposalEngine = require('../../ai/actionProposalEngine');

        const context = await AIContextBuilder.buildContext(null, organizationId);
        const proposals = ActionProposalEngine.generateProposals(context);

        res.json(proposals);
    } catch (err) {
        console.error('[AI Proposals] Error:', err);
        const error = err as Error & { isBudgetError?: boolean; budgetStatus?: unknown };
        if (error.isBudgetError) {
            res.status(403).json({
                error: error.message,
                code: 'AI_BUDGET_EXHAUSTED',
                budgetStatus: error.budgetStatus
            });
            return;
        }
        res.status(500).json({ error: error.message });
    }
}));

// LAYER 2: RECOMMEND
router.post('/recommend', verifyToken, validateBody(RecommendRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { diagnosisReport } = req.body;

    const generateFallbackInitiatives = (assessment: Record<string, unknown>, goals: string[], industry: string) => {
        const { v4: uuidv4 } = require('uuid');
        const axes = ['processes', 'digitalProducts', 'businessModels', 'dataManagement', 'culture', 'cybersecurity', 'aiMaturity'];

        const templates: Record<string, { name: string; priority: string; roi: number; budget: number }> = {
            processes: { name: 'Process Automation Initiative', priority: 'HIGH', roi: 2.0, budget: 200000 },
            digitalProducts: { name: 'Digital Product Development', priority: 'MEDIUM', roi: 2.5, budget: 300000 },
            businessModels: { name: 'Business Model Innovation', priority: 'MEDIUM', roi: 3.0, budget: 250000 },
            dataManagement: { name: 'Data Governance Implementation', priority: 'HIGH', roi: 1.8, budget: 150000 },
            culture: { name: 'Digital Culture Transformation', priority: 'MEDIUM', roi: 1.5, budget: 100000 },
            cybersecurity: { name: 'Cybersecurity Enhancement Program', priority: 'HIGH', roi: 1.5, budget: 180000 },
            aiMaturity: { name: 'AI Adoption Roadmap', priority: 'MEDIUM', roi: 2.2, budget: 220000 }
        };

        const initiativesToGenerate = Object.keys(assessment).length > 0
            ? axes.filter(axis => {
                const axisData = assessment[axis] as { current?: number; target?: number } | undefined;
                return axisData && axisData.current !== undefined && axisData.target !== undefined && axisData.current < axisData.target;
            })
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
    };

    try {
        const aiPipeline = getAIPipeline();

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
            userId: req.userId!,
            organizationId: req.organizationId!,
            prompt: initiativesPrompt,
            stream: false
        });

        let initiatives: unknown[] = [];
        try {
            const text = (response as { text?: string; content?: string }).text || (response as { content?: string }).content || '';
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                initiatives = JSON.parse(jsonMatch[0]);
            }
        } catch (parseErr) {
            console.warn('[AI Recommend] Failed to parse AI response as JSON:', parseErr);
        }

        if (!initiatives || (Array.isArray(initiatives) && initiatives.length === 0)) {
            console.warn('[AI Recommend] No initiatives parsed, using fallback generation');
            initiatives = generateFallbackInitiatives(assessment, goals, industry);
        }

        const { v4: uuidv4 } = require('uuid');
        const processedInitiatives = (Array.isArray(initiatives) ? initiatives : []).map((init: Record<string, unknown>, idx: number) => ({
            id: (init.id as string) || uuidv4(),
            name: (init.name as string) || `Initiative ${idx + 1}`,
            description: (init.description as string) || (init.summary as string) || '',
            hypothesis: (init.hypothesis as string) || (init.description as string) || '',
            axis: (init.axis as string) || 'processes',
            area: (init.area as string | null) || null,
            priority: (init.priority as string) || 'MEDIUM',
            complexity: (init.complexity as string) || 'Medium',
            estimatedROI: parseFloat((init.estimatedROI as string) || '1.5') || 1.5,
            estimatedBudget: parseInt((init.estimatedBudget as string) || '100000', 10) || 100000,
            status: 'DRAFT',
            progress: 0,
            quarter: 'Q1',
            wave: 'Wave 1'
        }));

        res.json(processedInitiatives);
    } catch (err) {
        console.error('[AI Recommend] Error:', err);
        const fallbackInitiatives = generateFallbackInitiatives(
            diagnosisReport.assessment || {},
            diagnosisReport.goals || ['Digital Transformation'],
            diagnosisReport.industry || 'General'
        );
        res.json(fallbackInitiatives);
    }
}));

// LAYER 3: ROADMAP
router.post('/roadmap', verifyToken, validateBody(RoadmapRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { initiatives } = req.body;

    try {
        const aiPipeline = getAIPipeline();

        const initiativesSummary = initiatives.map((init: Record<string, unknown>, idx: number) =>
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
            userId: req.userId!,
            organizationId: req.organizationId!,
            prompt: roadmapPrompt,
            schema: 'roadmap',
            stream: false
        });

        const roadmapData = (response as { object?: unknown }).object || response;

        if (!(roadmapData as { year1?: unknown }).year1) {
            console.warn('[AI Roadmap] Invalid response structure, using fallback');
            const fallback: Record<string, Record<string, string[]>> = {
                year1: { q1: [], q2: [], q3: [], q4: [] },
                year2: { q1: [], q2: [], q3: [], q4: [] },
                reasoning: 'Fallback distribution due to AI response error'
            } as unknown as Record<string, Record<string, string[]>>;

            initiatives.forEach((init: Record<string, unknown>, idx: number) => {
                const quarter = idx % 4;
                const year = idx < 8 ? 'year1' : 'year2';
                const qKey = `q${quarter + 1}`;
                (fallback[year][qKey] as string[]).push(init.name as string);
            });

            res.json(fallback);
            return;
        }

        res.json(roadmapData);
    } catch (err) {
        console.error('[AI Roadmap] Error:', err);
        const fallback: Record<string, Record<string, string[]>> = {
            year1: { q1: [], q2: [], q3: [], q4: [] },
            year2: { q1: [], q2: [], q3: [], q4: [] },
            reasoning: 'Fallback distribution due to error: ' + (err as Error).message
        } as unknown as Record<string, Record<string, string[]>>;

        initiatives.forEach((init: Record<string, unknown>, idx: number) => {
            const quarter = idx % 4;
            const year = idx < 8 ? 'year1' : 'year2';
            const qKey = `q${quarter + 1}`;
            (fallback[year][qKey] as string[]).push(init.name as string);
        });

        res.json(fallback);
    }
}));

// ==================== AUDIT ====================

router.get('/audit', verifyToken, validateQuery(GetAuditLogsQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('view_audit_logs')) {
        res.status(403).json({ error: 'Permission denied' });
        return;
    }

    const { projectId, userId, actionType, limit, offset } = req.query as {
        projectId?: string;
        userId?: string;
        actionType?: string;
        limit: number;
        offset: number;
    };

    try {
        const AIAuditLogger = getAIAuditLogger();
        const logs = await AIAuditLogger.getAuditLogs(req.organizationId!, {
            projectId,
            userId,
            actionType,
            limit: limit || 50,
            offset: offset || 0
        });
        res.json(logs);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
}));

router.get('/audit/stats', verifyToken, validateQuery(GetAuditLogsQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { projectId } = req.query as { projectId?: string };
    try {
        const AIAuditLogger = getAIAuditLogger();
        const stats = await AIAuditLogger.getAuditStats(req.organizationId!, projectId);
        res.json(stats);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
}));

router.post('/audit/:id/decision', verifyToken, validateParams(AuditIdParamSchema), validateBody(RecordAuditDecisionRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { decision, feedback } = req.body;
    try {
        const AIAuditLogger = getAIAuditLogger();
        const result = await AIAuditLogger.recordUserDecision(req.params.id, decision, feedback);
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
}));

// ==================== EXPLANATIONS ====================

router.get('/explanations/:projectId', verifyToken, validateParams(ProjectIdParamSchema), validateQuery(GetExplanationsQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('view_audit_logs')) {
        res.status(403).json({ error: 'Permission denied' });
        return;
    }

    const { limit, offset } = req.query as { limit: number; offset: number };

    try {
        const AIAuditLogger = getAIAuditLogger();
        const logs = await AIAuditLogger.getAuditLogs(req.organizationId!, {
            projectId: req.params.projectId,
            limit: limit || 50,
            offset: offset || 0,
            includeExplanation: true
        });

        const explanations = (Array.isArray(logs) ? logs : []).map((log: Record<string, unknown>) => ({
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
        res.status(500).json({ error: (err as Error).message });
    }
}));

router.get('/explanations/export', verifyToken, validateQuery(ExportExplanationsQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.can || !req.can('view_audit_logs')) {
        res.status(403).json({ error: 'Permission denied' });
        return;
    }

    const { projectId, startDate, endDate } = req.query as {
        projectId?: string;
        startDate?: string;
        endDate?: string;
    };

    try {
        const AIAuditLogger = getAIAuditLogger();
        const logs = await AIAuditLogger.getAuditLogs(req.organizationId!, {
            projectId: projectId || null,
            limit: 1000,
            offset: 0,
            includeExplanation: true
        });

        let filteredLogs = Array.isArray(logs) ? logs : [];
        if (startDate) {
            const start = new Date(startDate);
            filteredLogs = filteredLogs.filter((log: Record<string, unknown>) => new Date(log.created_at as string) >= start);
        }
        if (endDate) {
            const end = new Date(endDate);
            filteredLogs = filteredLogs.filter((log: Record<string, unknown>) => new Date(log.created_at as string) <= end);
        }

        const exportData = {
            exportedAt: new Date().toISOString(),
            organizationId: req.organizationId,
            projectId: projectId || 'ALL',
            totalRecords: filteredLogs.length,
            dateRange: {
                start: startDate || 'N/A',
                end: endDate || 'N/A'
            },
            records: filteredLogs.map((log: Record<string, unknown>) => ({
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

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="ai_explanations_${new Date().toISOString().split('T')[0]}.json"`);
        res.json(exportData);
    } catch (err) {
        res.status(500).json({ error: (err as Error).message });
    }
}));

// ==================== HEALTH MONITORING ====================

router.get('/health', asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { healthMonitor } = require('../../services/ai/healthMonitor');
        const status = healthMonitor.getStatus();

        res.json({
            status: (status.lastCheck as { overall?: string })?.overall || 'unknown',
            isRunning: status.isRunning,
            lastCheck: (status.lastCheck as { timestamp?: string })?.timestamp,
            consecutiveFailures: status.consecutiveFailures,
            providers: status.providers,
            checks: (status.lastCheck as { checks?: unknown[] })?.checks || []
        });
    } catch (err) {
        res.status(500).json({
            status: 'error',
            error: (err as Error).message
        });
    }
}));

router.post('/health/diagnose', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { healthMonitor } = require('../../services/ai/healthMonitor');
        const results = await healthMonitor.runDiagnostics();
        res.json(results);
    } catch (err) {
        res.status(500).json({
            status: 'error',
            error: (err as Error).message
        });
    }
}));

// ==================== SMART SUGGESTIONS ====================

router.get('/suggestions', verifyToken, validateQuery(GetSuggestionsQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.query as { projectId?: string };
        const smartSuggestions = require('../../services/ai/smartSuggestions');

        const suggestions = await smartSuggestions.getCachedSuggestions(
            req.userId!,
            projectId,
            {}
        );

        res.json({ suggestions });
    } catch (err) {
        console.error('[AI] Suggestions error:', err);
        res.status(500).json({
            error: (err as Error).message,
            suggestions: []
        });
    }
}));

router.post('/suggestions', verifyToken, validateBody(PostSuggestionsRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { projectId, conversationContext } = req.body;
        const smartSuggestions = require('../../services/ai/smartSuggestions');

        const suggestions = await smartSuggestions.getSuggestions(
            req.userId!,
            projectId,
            conversationContext || {}
        );

        res.json({ suggestions });
    } catch (err) {
        console.error('[AI] Suggestions error:', err);
        res.status(500).json({
            error: (err as Error).message,
            suggestions: []
        });
    }
}));

// ==================== APPROVAL PATTERNS ====================

const ApprovalPatternService = require('../../services/approvalPatternService');

router.get('/patterns', verifyToken, validateQuery(GetPatternsQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { actionType } = req.query as { actionType?: string };
        const patterns = await ApprovalPatternService.getUserPatterns(req.userId!, actionType);
        res.json({ success: true, patterns });
    } catch (err) {
        console.error('[AI] Get patterns error:', err);
        res.status(500).json({ success: false, error: (err as Error).message });
    }
}));

router.get('/patterns/stats', verifyToken, asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const stats = await ApprovalPatternService.getPatternStats(req.userId!);
        res.json(stats);
    } catch (err) {
        console.error('[AI] Pattern stats error:', err);
        res.status(500).json({ error: (err as Error).message });
    }
}));

router.patch('/patterns/:patternId/auto-apply', verifyToken, validateParams(PatternIdParamSchema), validateBody(ToggleAutoApplyRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { enabled } = req.body;
        const result = await ApprovalPatternService.setAutoApply(
            req.params.patternId,
            enabled,
            req.userId!
        );
        res.json(result);
    } catch (err) {
        console.error('[AI] Toggle auto-apply error:', err);
        res.status(500).json({ success: false, error: (err as Error).message });
    }
}));

router.delete('/patterns/:patternId', verifyToken, validateParams(PatternIdParamSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const result = await ApprovalPatternService.deletePattern(
            req.params.patternId,
            req.userId!
        );
        res.json(result);
    } catch (err) {
        console.error('[AI] Delete pattern error:', err);
        res.status(500).json({ success: false, error: (err as Error).message });
    }
}));

router.post('/actions/:actionId/approve', verifyToken, validateParams(z.object({ actionId: z.string().uuid() })), validateBody(ApproveActionRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { alwaysApprove } = req.body;
        const AIActionExecutor = getAIActionExecutor();
        const result = await AIActionExecutor.approveAction(
            (req.params as { actionId: string }).actionId,
            req.userId!,
            { alwaysApprove }
        );
        res.json(result);
    } catch (err) {
        console.error('[AI] Approve action error:', err);
        res.status(500).json({ success: false, error: (err as Error).message });
    }
}));

router.post('/actions/:actionId/reject', verifyToken, validateParams(z.object({ actionId: z.string().uuid() })), validateBody(RejectActionRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { reason, alwaysReject } = req.body;
        const AIActionExecutor = getAIActionExecutor();
        const result = await AIActionExecutor.rejectAction(
            (req.params as { actionId: string }).actionId,
            req.userId!,
            reason,
            { alwaysReject }
        );
        res.json(result);
    } catch (err) {
        console.error('[AI] Reject action error:', err);
        res.status(500).json({ success: false, error: (err as Error).message });
    }
}));

router.get('/actions/pending', verifyToken, validateQuery(GetPendingActionsQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { projectId } = req.query as { projectId?: string };
        const AIActionExecutor = getAIActionExecutor();
        const actions = await AIActionExecutor.getPendingActions(
            req.userId!,
            projectId,
            req.organizationId!
        );

        const actionsWithPatterns = await Promise.all(
            (Array.isArray(actions) ? actions : []).map(async (action: Record<string, unknown>) => {
                const patternInfo = await AIActionExecutor.getPatternInfo(
                    req.userId!,
                    action.action_type as string,
                    (action.payload as Record<string, unknown>) || {}
                );
                return { ...action, patternInfo };
            })
        );

        res.json({ success: true, actions: actionsWithPatterns });
    } catch (err) {
        console.error('[AI] Get pending actions error:', err);
        res.status(500).json({ success: false, error: (err as Error).message, actions: [] });
    }
}));

// ==================== FEEDBACK & REPORTING ====================

router.post('/feedback', verifyToken, validateBody(RecordFeedbackRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { messageId, rating } = req.body;
    const userId = req.userId!;

    try {
        console.log(`[AI Feedback] User ${userId} rated message ${messageId} as ${rating}`);
        
        try {
            const aiLogger = require('../../services/ai/logger');
            await aiLogger.log('feedback', {
                userId,
                messageId,
                rating,
                timestamp: new Date().toISOString()
            });
        } catch (logErr) {
            console.warn('[AI] Could not log feedback:', (logErr as Error).message);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[AI] Feedback error:', err);
        res.status(500).json({ success: false, error: (err as Error).message });
    }
}));

router.post('/report', verifyToken, validateBody(ReportMessageRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    const { messageId, reason } = req.body;
    const userId = req.userId!;

    try {
        console.error(`[AI REPORT] 🚨 User ${userId} reported message ${messageId}: ${reason}`);
        
        try {
            const aiLogger = require('../../services/ai/logger');
            await aiLogger.log('report', {
                userId,
                messageId,
                reason,
                timestamp: new Date().toISOString(),
                severity: reason === 'harmful' ? 'critical' : 'warning'
            });
        } catch (logErr) {
            console.warn('[AI] Could not log report:', (logErr as Error).message);
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[AI] Report error:', err);
        res.status(500).json({ success: false, error: (err as Error).message });
    }
}));

// ==================== MEMORY METRICS ====================

router.get('/memory/metrics', verifyToken, validateQuery(GetMemoryMetricsQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const AIMemoryMetricsService = require('../../services/ai/aiMemoryMetricsService');
        const { period } = req.query as { period: number };
        
        const metrics = await AIMemoryMetricsService.getDashboardMetrics(
            req.organizationId!,
            period
        );
        
        res.json({ success: true, ...metrics });
    } catch (err) {
        console.error('[AI] Memory metrics error:', err);
        res.status(500).json({ success: false, error: (err as Error).message });
    }
}));

router.get('/memory/current', verifyToken, validateQuery(GetCurrentMemoryQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const AIMemoryMetricsService = require('../../services/ai/aiMemoryMetricsService');
        const { projectId } = req.query as { projectId?: string };
        
        const state = await AIMemoryMetricsService.getCurrentMemoryState(
            projectId,
            req.organizationId!
        );
        
        res.json({ success: true, ...state });
    } catch (err) {
        console.error('[AI] Current memory state error:', err);
        res.status(500).json({ success: false, error: (err as Error).message });
    }
}));

router.get('/memory/latency', verifyToken, validateQuery(GetMemoryLatencyQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const AIMemoryMetricsService = require('../../services/ai/aiMemoryMetricsService');
        const { hours } = req.query as { hours: number };
        
        const latency = await AIMemoryMetricsService.getLatencyPercentiles(
            req.organizationId!,
            hours
        );
        
        res.json({ success: true, ...latency });
    } catch (err) {
        console.error('[AI] Latency metrics error:', err);
        res.status(500).json({ success: false, error: (err as Error).message });
    }
}));

// ==================== PROACTIVE SUGGESTIONS ====================

const ProactiveSuggestionsService = require('../../services/ai/proactiveSuggestionsService');
const ResponseQualityService = require('../../services/ai/responseQualityService');

router.get('/suggestions', verifyToken, validateQuery(GetSuggestionsQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { projectId, screenContext } = req.query as { projectId?: string; screenContext?: string };
        
        const suggestions = await ProactiveSuggestionsService.generateSuggestions({
            userId: req.userId!,
            organizationId: req.organizationId!,
            projectId: projectId || null,
            screenContext: screenContext ? JSON.parse(screenContext) : null,
            recentActions: []
        });

        res.json({ success: true, suggestions });
    } catch (err) {
        console.error('[AI] Proactive suggestions error:', err);
        res.status(500).json({ success: false, error: (err as Error).message });
    }
}));

router.post('/suggestions/action', verifyToken, validateBody(RecordSuggestionActionRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { suggestionId, action, feedback } = req.body;
        
        await ProactiveSuggestionsService.recordSuggestionAction(
            suggestionId,
            req.userId!,
            action,
            feedback
        );

        res.json({ success: true });
    } catch (err) {
        console.error('[AI] Suggestion action error:', err);
        res.status(500).json({ success: false, error: (err as Error).message });
    }
}));

router.get('/suggestions/metrics', verifyToken, validateQuery(GetSuggestionMetricsQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { days } = req.query as { days: number };
        
        const metrics = await ProactiveSuggestionsService.getSuggestionMetrics(
            req.organizationId!,
            days
        );

        res.json({ success: true, metrics });
    } catch (err) {
        console.error('[AI] Suggestion metrics error:', err);
        res.status(500).json({ success: false, error: (err as Error).message });
    }
}));

// ==================== RESPONSE QUALITY ====================

router.post('/quality/calculate', verifyToken, validateBody(CalculateQualityRequestSchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { query, response, context, sources } = req.body;
        
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
        res.status(500).json({ success: false, error: (err as Error).message });
    }
}));

router.get('/quality/aggregate', verifyToken, validateQuery(GetAggregateQualityQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { days } = req.query as { days: number };
        
        const metrics = await ResponseQualityService.getAggregateMetrics(
            req.organizationId!,
            days
        );

        res.json({ success: true, metrics });
    } catch (err) {
        console.error('[AI] Aggregate quality metrics error:', err);
        res.status(500).json({ success: false, error: (err as Error).message });
    }
}));

router.get('/quality/trends', verifyToken, validateQuery(GetQualityTrendsQuerySchema), asyncHandler(async (req: AuthRequest, res: Response) => {
    try {
        const { days } = req.query as { days: number };
        
        const trends = await ResponseQualityService.getQualityTrends(
            req.organizationId!,
            days
        );

        res.json({ success: true, trends });
    } catch (err) {
        console.error('[AI] Quality trends error:', err);
        res.status(500).json({ success: false, error: (err as Error).message });
    }
}));

export default router;

