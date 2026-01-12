/**
 * AI Routes
 * Complete AI API - Enterprise PMO Brain
 */

import { Response, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { z } from 'zod';

import { type AuthRequest, verifyToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validation.middleware.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { get as dbGet, run as dbRun } from '../utils/DbPromise.js';
import {
    ActionIdParamSchema,
    ActionTypeParamSchema,
    AIContextQuerySchema,
    ApproveActionRequestSchema,
    AuditIdParamSchema,
    CalculateQualityRequestSchema,
    CanPerformActionQuerySchema,
    ChatRequestSchema,
    ChatStreamRequestSchema,
    CreateDraftRequestSchema,
    ExportExplanationsQuerySchema,
    GenerateProposalsQuerySchema,
    GetAggregateQualityQuerySchema,
    GetAuditLogsQuerySchema,
    GetCurrentMemoryQuerySchema,
    GetExplanationsQuerySchema,
    GetMemoryLatencyQuerySchema,
    GetMemoryMetricsQuerySchema,
    GetPatternsQuerySchema,
    GetPendingActionsQuerySchema,
    GetQualityTrendsQuerySchema,
    GetSuggestionMetricsQuerySchema,
    GetSuggestionsQuerySchema,
    PatternIdParamSchema,
    PostSuggestionsRequestSchema,
    ProjectIdParamSchema,
    RecommendRequestSchema,
    RecordAuditDecisionRequestSchema,
    RecordDecisionRequestSchema,
    RecordFeedbackRequestSchema,
    RecordSuggestionActionRequestSchema,
    RejectActionRequestSchema,
    ReportMessageRequestSchema,
    RoadmapRequestSchema,
    SessionIdParamSchema,
    ToggleAutoApplyRequestSchema,
    UpdatePolicyRequestSchema,
    UpdateUserPreferencesRequestSchema,
} from '../validators/ai.validators.js';

const router = Router();

// Lazy load services to avoid circular dependencies

const getAIContextBuilder = async () => {
    const module = await import('../services/aiContextBuilder.js');
    return (module as any).default || (module as any).aiContextBuilder || module;
};
const getAIPolicyEngine = async () =>
    await import('../services/aiPolicyEngine.js').then((m) => (m as any).default || m);
const getAIMemoryManager = async () =>
    await import('../services/aiMemoryManager.js').then((m) => (m as any).default || m);
const getAIOrchestrator = async () =>
    await import('../services/aiOrchestrator.js').then((m) => (m as any).default || m);
const getAIActionExecutor = async () =>
    await import('../services/aiActionExecutor.js').then((m) => (m as any).default || m);
const getAIAuditLogger = async () => await import('../services/aiAuditLogger.js').then((m) => (m as any).default || m);
const getAIPipeline = async () => {
    const { AIPipeline } = await import('../../services/ai/aiPipeline.js');
    return new AIPipeline();
};

// ==================== CONTEXT ====================

router.get(
    '/context',
    verifyToken,
    validateQuery(AIContextQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const AIContextBuilder = await getAIContextBuilder();
            const context = await (AIContextBuilder as any).buildContext(
                req.userId as string,
                req.organizationId as string,
                null,
                { currentScreen: (req.query as any).screen as string | undefined },
            );
            res.json(context);
        } catch (err: unknown) {
            const error = err as Error;
            return res.status(500).json({ error: error.message });
        }
    }),
);

router.get(
    '/context/:projectId',
    verifyToken,
    validateParams(ProjectIdParamSchema),
    validateQuery(AIContextQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const AIContextBuilder = await getAIContextBuilder();
            const context = await (AIContextBuilder as any).buildContext(
                req.userId as string,
                req.organizationId as string,
                req.params.projectId,
                { currentScreen: (req.query as any).screen as string | undefined },
            );
            res.json(context);
        } catch (err: unknown) {
            const error = err as Error;
            return res.status(500).json({ error: error.message });
        }
    }),
);

// ==================== CHAT ====================

router.post(
    '/chat/stream',
    verifyToken,
    validateBody(ChatStreamRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
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

        const { message, history, systemInstruction, context, roleName, language, conversationId, resumeFromPartial } =
            body;

        const streamSessionId = conversationId || `stream-${req.userId}-${Date.now()}`;
        let accumulatedContent = '';
        let lastSaveTime = Date.now();
        let isClientConnected = true;
        let streamAborted = false;

        const languageMap: Record<string, string> = {
            pl: 'Polish (Polski)',
            en: 'English',
            de: 'German (Deutsch)',
            es: 'Spanish (Español)',
            ja: 'Japanese (日本語)',
            ar: 'Arabic (العربية)',
        };
        const langName = languageMap[language || 'pl'] || languageMap['pl'];
        const languageInstruction = `\n\n[LANGUAGE INSTRUCTION: Always respond in ${langName}. This is critical - the user's interface is set to ${langName}, so ALL your responses MUST be in ${langName}.]\n`;

        const enhancedSystemInstruction = (systemInstruction || '') + languageInstruction;
        const aiPipeline = await getAIPipeline();

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
                savePartialResponse(streamSessionId, accumulatedContent, req.userId!, req.organizationId!).catch(
                    (err: Error | null) => console.error('[Stream] Failed to save partial:', err),
                );
            }
        };

        req.socket?.on('close', connectionCleanup);
        req.socket?.on('error', connectionCleanup);
        res.on('close', connectionCleanup);

        const savePartialResponse = async (
            sessionId: string,
            content: string,
            userId: string,
            orgId: string,
        ): Promise<void> => {
            await dbRun(
                `
            INSERT INTO ai_partial_responses (id, session_id, user_id, organization_id, content, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(session_id) DO UPDATE SET
                content = excluded.content,
                updated_at = CURRENT_TIMESTAMP
        `,
                [uuidv4(), sessionId, userId, orgId, content],
            );
        };

        try {
            if (resumeFromPartial && conversationId) {
                const row = (await dbGet(
                    `SELECT content FROM ai_partial_responses WHERE session_id = ? AND user_id = ?`,
                    [conversationId, req.userId],
                )) as { content: string } | null;
                const partial = row?.content || null;

                if (partial) {
                    accumulatedContent = partial;
                    res.write(
                        `data: ${JSON.stringify({
                            type: 'resume',
                            text: partial,
                            sessionId: streamSessionId,
                        })}\n\n`,
                    );
                }

                // Partial resume logic handled by sending previous content to client
            }

            const pipelineRequest = {
                type: 'chat',
                userId: req.userId,
                organizationId: req.organizationId,
                prompt: message,
                messages: (history || []).map((m) => ({
                    role: m.role === 'model' ? 'assistant' : m.role,
                    content: (m as { parts?: Array<{ text: string }> }).parts?.[0]?.text || m.content || '',
                })),
                capability: 'chat',
                screenContext:
                    (context as { screenContext?: unknown })?.screenContext ||
                    (req.body as { screenContext?: unknown }).screenContext,
                stream: true,
                options: {
                    role: roleName,
                    systemInstruction: enhancedSystemInstruction,
                },
            };

            const response = await (aiPipeline as any).process(pipelineRequest, (progress: Record<string, unknown>) => {
                if (!isClientConnected || res.destroyed) return;

                res.write(
                    `data: ${JSON.stringify({
                        type: 'thought',
                        ...progress,
                    })}\n\n`,
                );
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
                            savePartialResponse(
                                streamSessionId,
                                accumulatedContent,
                                req.userId!,
                                req.organizationId!,
                            ).catch((err: Error | null) => console.warn('[Stream] Partial save failed:', (err as Error).message));
                            lastSaveTime = Date.now();
                        }
                    }
                }

                if (isClientConnected && !streamAborted) {
                    res.write('data: [DONE]\n\n');

                    await dbRun(`DELETE FROM ai_partial_responses WHERE session_id = ?`, [streamSessionId]);
                }
                res.end();
            } else {
                if (isClientConnected && !res.destroyed) {
                    res.write(
                        `data: ${JSON.stringify({ text: (response as { content?: string }).content || '' })}\n\n`,
                    );
                    res.write('data: [DONE]\n\n');
                }
                res.end();
            }
        } catch (err: unknown) {
            console.error('Stream Error:', err);

            if (accumulatedContent.length > 0) {
                savePartialResponse(streamSessionId, accumulatedContent, req.userId!, req.organizationId!).catch((e) =>
                    console.warn('[Stream] Failed to save partial on error:', (e as Error).message),
                );
            }

            if (isClientConnected && !res.destroyed) {
                res.write(
                    `data: ${JSON.stringify({
                        error: (err as Error).message,
                        sessionId: streamSessionId,
                        canResume: accumulatedContent.length > 0,
                    })}\n\n`,
                );
                res.end();
            }
        } finally {
            req.socket?.removeListener('close', connectionCleanup);
            req.socket?.removeListener('error', connectionCleanup);
            res.removeListener('close', connectionCleanup);
        }
    }),
);

router.get(
    '/stream/partial/:sessionId',
    verifyToken,
    validateParams(SessionIdParamSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const row = (await dbGet(
                `
            SELECT content, updated_at 
            FROM ai_partial_responses 
            WHERE session_id = ? AND user_id = ?
        `,
                [req.params.sessionId, req.userId],
            )) as { content: string; updated_at: string } | null;

            if (!row) {
                res.status(404).json({ error: 'No partial response found' });
                return;
            }

            res.json({
                sessionId: req.params.sessionId,
                content: row.content,
                updatedAt: row.updated_at,
                canResume: true,
            });
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

router.post(
    '/chat',
    verifyToken,
    validateBody(ChatRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { message, projectId, currentScreen, selectedObjectId, selectedObjectType } = req.body;

        try {
            const AIOrchestrator = await getAIOrchestrator();
            const AIAuditLogger = await getAIAuditLogger();

            const result = await AIOrchestrator.processMessage(message, req.userId!, req.organizationId!, projectId, {
                currentScreen,
                selectedObjectId,
                selectedObjectType,
            });

            await AIAuditLogger.logSuggestion(
                req.userId!,
                req.organizationId!,
                projectId,
                result.role,
                result.prompt,
                result.contextSummary,
            );

            res.json({
                role: result.role,
                roleDescription: AIOrchestrator.getRoleDescription(result.role),
                intent: result.intent,
                contextSummary: result.contextSummary,
                dataSources: (result.responseContext as { dataSources?: unknown[] })?.dataSources || [],
                prompt: result.prompt,
                policyLevel:
                    (result.responseContext as { policy?: { policyLevel?: string } })?.policy?.policyLevel ||
                    'ADVISORY',
            });
        } catch (err: unknown) {
            console.error('Chat Error:', err);
            const error = err as Error & { isBudgetError?: boolean; budgetStatus?: unknown };
            if (error.isBudgetError) {
                res.status(403).json({
                    error: error.message,
                    code: 'AI_BUDGET_EXHAUSTED',
                    budgetStatus: error.budgetStatus,
                });
                return;
            }
            res.status(500).json({ error: error.message });
        }
    }),
);

// ==================== POLICY ====================

router.get(
    '/policy',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const AIPolicyEngine = await getAIPolicyEngine();
            const info = await (AIPolicyEngine as any).getPolicySummary(req.organizationId as string);
            res.json(info);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

router.patch(
    '/policy',
    verifyToken,
    validateBody(UpdatePolicyRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!req.can || !req.can('edit_organization_settings')) {
            res.status(403).json({ error: 'Admin required' });
            return;
        }

        try {
            const AIPolicyEngine = await getAIPolicyEngine();
            const result = await AIPolicyEngine.updatePolicy(req.organizationId!, req.body);
            res.json(result);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

router.get(
    '/policy/can-perform/:actionType',
    verifyToken,
    validateParams(ActionTypeParamSchema),
    validateQuery(CanPerformActionQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { projectId } = req.query as { projectId?: string };
        try {
            const AIPolicyEngine = await getAIPolicyEngine();
            const result = await AIPolicyEngine.canPerformAction(
                req.params.actionType,
                req.organizationId as string,
                projectId as string | undefined,
                req.userId as string,
            );
            res.json(result);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

// ==================== MEMORY ====================

router.get(
    '/memory/project/:projectId',
    verifyToken,
    validateParams(ProjectIdParamSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const AIMemoryManager = await getAIMemoryManager();
            const memory = await AIMemoryManager.buildProjectMemorySummary(req.params.projectId);
            res.json(memory);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

router.post(
    '/memory/project/:projectId/decision',
    verifyToken,
    validateParams(ProjectIdParamSchema),
    validateBody(RecordDecisionRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { decisionId, title, outcome, rationale } = req.body;

        try {
            const AIMemoryManager = await getAIMemoryManager();
            const result = await AIMemoryManager.recordDecision(
                req.params.projectId,
                decisionId,
                title,
                outcome,
                rationale,
                req.userId!,
            );
            res.json(result);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

router.get(
    '/memory/user',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const AIMemoryManager = await getAIMemoryManager();
            const preferences = await AIMemoryManager.getUserPreferences(req.userId!);
            res.json(preferences);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

router.patch(
    '/memory/user',
    verifyToken,
    validateBody(UpdateUserPreferencesRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const AIMemoryManager = await getAIMemoryManager();
            const result = await AIMemoryManager.updateUserPreferences(req.userId!, req.body);
            res.json(result);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

router.delete(
    '/memory/project/:projectId',
    verifyToken,
    validateParams(ProjectIdParamSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!req.can || !req.can('edit_project_settings')) {
            res.status(403).json({ error: 'Permission denied' });
            return;
        }

        try {
            const AIMemoryManager = await getAIMemoryManager();
            const result = await AIMemoryManager.clearProjectMemory(req.params.projectId);
            res.json(result);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

// ==================== ACTIONS ====================

router.post(
    '/actions/draft',
    verifyToken,
    validateBody(CreateDraftRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { draftType, content, projectId } = req.body;

        try {
            const AIActionExecutor = await getAIActionExecutor();
            const result = await AIActionExecutor.createDraft(
                draftType,
                content,
                req.userId!,
                req.organizationId!,
                projectId,
            );
            res.json(result);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

router.get(
    '/actions/pending',
    verifyToken,
    validateQuery(GetPendingActionsQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { projectId } = req.query as { projectId?: string };
        try {
            const AIActionExecutor = await getAIActionExecutor();
            const actions = await AIActionExecutor.getPendingActions(
                req.userId as string,
                projectId as string | undefined,
                req.organizationId as string,
            );
            res.json(actions);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

router.patch(
    '/actions/:id/approve',
    verifyToken,
    validateParams(ActionIdParamSchema),
    validateBody(ApproveActionRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const AIActionExecutor = await getAIActionExecutor();
            const result = await AIActionExecutor.approveAction(req.params.id, req.userId!);
            res.json(result);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

router.patch(
    '/actions/:id/reject',
    verifyToken,
    validateParams(ActionIdParamSchema),
    validateBody(RejectActionRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { reason } = req.body;
        try {
            const AIActionExecutor = await getAIActionExecutor();
            const result = await AIActionExecutor.rejectAction(req.params.id, req.userId!, reason);
            res.json(result);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

router.post(
    '/actions/:id/execute',
    verifyToken,
    validateParams(ActionIdParamSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const AIActionExecutor = await getAIActionExecutor();
            const result = await AIActionExecutor.executeAction(req.params.id, req.userId!);
            res.json(result);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

router.get(
    '/actions/proposals',
    verifyToken,
    validateQuery(GenerateProposalsQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (req.userRole !== 'administrator' && req.userRole !== 'owner') {
            const logger = (await import('../utils/Logger.js')).default;
            logger.warn('Unauthorized proposal access attempt', { userId: req.userId, role: req.userRole });
            res.status(403).json({ error: 'Permission denied. ADMIN or SUPERADMIN required.' });
            return;
        }

        const { organizationId: queryOrgId } = req.query as { organizationId?: string };
        const organizationId = req.userRole === 'owner' && queryOrgId ? queryOrgId : req.organizationId;

        if (!organizationId) {
            res.status(400).json({ error: 'organizationId required' });
            return;
        }

        try {
            const { getRequestContext } = await import('../utils/requestContext.js');
            const logger = (await import('../utils/Logger.js')).default;

            logger.info('Generating action proposals', {
                ...getRequestContext(req),
                targetOrgId: organizationId as string,
            });

            const AIContextBuilder = await getAIContextBuilder();
            const ActionProposalEngine = await import('../../ai/actionProposalEngine.js').then(
                (m) => (m as any).default || m,
            );

            const context = await AIContextBuilder.buildContext(undefined as any, organizationId);
            const proposals = ActionProposalEngine.generateProposals(context);

            res.json(proposals);
        } catch (err: unknown) {
            console.error('[AI Proposals] Error:', err);
            const error = err as Error & { isBudgetError?: boolean; budgetStatus?: unknown };
            if (error.isBudgetError) {
                res.status(403).json({
                    error: error.message,
                    code: 'AI_BUDGET_EXHAUSTED',
                    budgetStatus: error.budgetStatus,
                });
                return;
            }
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

// LAYER 2: RECOMMEND
router.post(
    '/recommend',
    verifyToken,
    validateBody(RecommendRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { diagnosisReport } = req.body;

        const generateFallbackInitiatives = (
            assessment: Record<string, unknown>,
            goals: string[],
            industry: string,
        ) => {
            const axes = [
                'processes',
                'digitalProducts',
                'businessModels',
                'dataManagement',
                'culture',
                'cybersecurity',
                'aiMaturity',
            ];

            const templates: Record<string, { name: string; priority: string; roi: number; budget: number }> = {
                processes: { name: 'Process Automation Initiative', priority: 'HIGH', roi: 2.0, budget: 200000 },
                digitalProducts: { name: 'Digital Product Development', priority: 'MEDIUM', roi: 2.5, budget: 300000 },
                businessModels: { name: 'Business Model Innovation', priority: 'MEDIUM', roi: 3.0, budget: 250000 },
                dataManagement: { name: 'Data Governance Implementation', priority: 'HIGH', roi: 1.8, budget: 150000 },
                culture: { name: 'Digital Culture Transformation', priority: 'MEDIUM', roi: 1.5, budget: 100000 },
                cybersecurity: {
                    name: 'Cybersecurity Enhancement Program',
                    priority: 'HIGH',
                    roi: 1.5,
                    budget: 180000,
                },
                aiMaturity: { name: 'AI Adoption Roadmap', priority: 'MEDIUM', roi: 2.2, budget: 220000 },
            };

            const initiativesToGenerate =
                Object.keys(assessment).length > 0
                    ? axes.filter((axis) => {
                          const axisData = assessment[axis] as { current?: number; target?: number } | undefined;
                          return (
                              axisData &&
                              axisData.current !== undefined &&
                              axisData.target !== undefined &&
                              axisData.current < axisData.target
                          );
                      })
                    : axes.slice(0, 5);

            return initiativesToGenerate.map((axis) => {
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
                    wave: 'Wave 1',
                };
            });
        };

        try {
            const aiPipeline = await getAIPipeline();

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
                stream: false,
            });

            let initiatives: unknown[] = [];
            try {
                const text =
                    (response as { text?: string; content?: string }).text ||
                    (response as { content?: string }).content ||
                    '';
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

            const processedInitiatives = (Array.isArray(initiatives) ? initiatives : []).map(
                (init: Record<string, unknown>, idx: number) => ({
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
                    wave: 'Wave 1',
                }),
            );

            res.json(processedInitiatives);
        } catch (err: unknown) {
            console.error('[AI Recommend] Error:', err);
            const fallbackInitiatives = generateFallbackInitiatives(
                diagnosisReport.assessment || {},
                diagnosisReport.goals || ['Digital Transformation'],
                diagnosisReport.industry || 'General',
            );
            res.json(fallbackInitiatives);
        }
    }),
);

// LAYER 3: ROADMAP
router.post(
    '/roadmap',
    verifyToken,
    validateBody(RoadmapRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { initiatives } = req.body;

        try {
            const aiPipeline = await getAIPipeline();

            const initiativesSummary = initiatives
                .map(
                    (init: any, idx: number) =>
                        `${idx + 1}. "${init.name}" - Priority: ${init.priority || 'Medium'}, Complexity: ${init.complexity || 'Medium'}, ROI: ${init.expectedRoi || init.roi || 'Unknown'}`,
                )
                .join('\n');

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
                stream: false,
            });

            const roadmapData = (response as { object?: unknown }).object || response;

            if (!(roadmapData as { year1?: unknown }).year1) {
                console.warn('[AI Roadmap] Invalid response structure, using fallback');
                const fallback: Record<string, Record<string, string[]>> = {
                    year1: { q1: [], q2: [], q3: [], q4: [] },
                    year2: { q1: [], q2: [], q3: [], q4: [] },
                    reasoning: 'Fallback distribution due to AI response error',
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
        } catch (err: unknown) {
            console.error('[AI Roadmap] Error:', err);
            const fallback: Record<string, Record<string, string[]>> = {
                year1: { q1: [], q2: [], q3: [], q4: [] },
                year2: { q1: [], q2: [], q3: [], q4: [] },
                reasoning: 'Fallback distribution due to error: ' + (err as Error).message,
            } as unknown as Record<string, Record<string, string[]>>;

            initiatives.forEach((init: Record<string, unknown>, idx: number) => {
                const quarter = idx % 4;
                const year = idx < 8 ? 'year1' : 'year2';
                const qKey = `q${quarter + 1}`;
                (fallback[year][qKey] as string[]).push(init.name as string);
            });

            res.json(fallback);
        }
    }),
);

// ==================== AUDIT ====================

router.get(
    '/audit',
    verifyToken,
    validateQuery(GetAuditLogsQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!req.can || !req.can('view_audit_logs')) {
            res.status(403).json({ error: 'Permission denied' });
            return;
        }

        const { projectId, userId, actionType, limit, offset } = req.query as any;
        // The original instruction had an extra closing brace here, which is removed for syntactical correctness.
        // The instruction was: `const { projectId, userId, actionType, limit, offset } = req.query as any; };`
        // Corrected to: `const { projectId, userId, actionType, limit, offset } = req.query as any;`

        try {
            const AIAuditLogger = await getAIAuditLogger();
            const logs = await AIAuditLogger.getAuditLogs(req.organizationId!, {
                projectId: projectId as string | undefined,
                userId: userId as string | undefined,
                actionType: actionType as string | undefined,
                limit: Number(limit) || 50,
                offset: Number(offset) || 0,
            });
            res.json(logs);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

router.get(
    '/audit/stats',
    verifyToken,
    validateQuery(GetAuditLogsQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { projectId } = req.query as { projectId?: string };
        try {
            const AIAuditLogger = await getAIAuditLogger();
            const stats = await AIAuditLogger.getAuditStats(req.organizationId!, projectId as string | undefined);
            res.json(stats);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

router.post(
    '/audit/:id/decision',
    verifyToken,
    validateParams(AuditIdParamSchema),
    validateBody(RecordAuditDecisionRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { decision, feedback } = req.body;
        try {
            const AIAuditLogger = await getAIAuditLogger();
            const result = await AIAuditLogger.recordUserDecision(req.params.id, decision, feedback);
            res.json(result);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

// ==================== EXPLANATIONS ====================

router.get(
    '/explanations/:projectId',
    verifyToken,
    validateParams(ProjectIdParamSchema),
    validateQuery(GetExplanationsQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        if (!req.can || !req.can('view_audit_logs')) {
            res.status(403).json({ error: 'Permission denied' });
            return;
        }

        const { limit, offset } = req.query as any;

        try {
            const AIAuditLogger = await getAIAuditLogger();
            const logs = await AIAuditLogger.getAuditLogs(req.organizationId!, {
                projectId: req.params.projectId,
                limit: Number(limit) || 50,
                offset: Number(offset) || 0,
                includeExplanation: true,
            });

            const explanations = (Array.isArray(logs) ? logs : []).map((log: Record<string, unknown>) => ({
                id: log.id,
                timestamp: log.created_at,
                explanation: log.explanation,
                aiResponse: log.ai_suggestion,
                userDecision: log.user_decision,
            }));

            res.json({
                projectId: req.params.projectId,
                total: explanations.length,
                explanations,
            });
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

router.get(
    '/explanations/export',
    verifyToken,
    validateQuery(ExportExplanationsQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
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
            const AIAuditLogger = await getAIAuditLogger();
            const logs = await AIAuditLogger.getAuditLogs(req.organizationId!, {
                projectId: projectId || null,
                limit: 1000,
                offset: 0,
                includeExplanation: true,
            });

            let filteredLogs = Array.isArray(logs) ? logs : [];
            if (startDate) {
                const start = new Date(startDate);
                filteredLogs = filteredLogs.filter(
                    (log: Record<string, unknown>) => new Date(log.created_at as string) >= start,
                );
            }
            if (endDate) {
                const end = new Date(endDate);
                filteredLogs = filteredLogs.filter(
                    (log: Record<string, unknown>) => new Date(log.created_at as string) <= end,
                );
            }

            const exportData = {
                exportedAt: new Date().toISOString(),
                organizationId: req.organizationId,
                projectId: projectId || 'ALL',
                totalRecords: filteredLogs.length,
                dateRange: {
                    start: startDate || 'N/A',
                    end: endDate || 'N/A',
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
                    userFeedback: log.user_feedback,
                })),
            };

            res.setHeader('Content-Type', 'application/json');
            res.setHeader(
                'Content-Disposition',
                `attachment; filename="ai_explanations_${new Date().toISOString().split('T')[0]}.json"`,
            );
            res.json(exportData);
        } catch (err: unknown) {
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

// ==================== HEALTH MONITORING ====================

router.get(
    '/health',
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const { healthMonitor } = await import('../../services/ai/healthMonitor.js').then((m) => m);
            const status = healthMonitor.getStatus();

            res.json({
                status: (status.lastCheck as { overall?: string })?.overall || 'unknown',
                isRunning: status.isRunning,
                lastCheck: (status.lastCheck as { timestamp?: string })?.timestamp,
                consecutiveFailures: status.consecutiveFailures,
                providers: status.providers,
                checks: (status.lastCheck as { checks?: unknown[] })?.checks || [],
            });
        } catch (err: unknown) {
            res.status(500).json({
                status: 'error',
                error: (err as Error).message,
            });
        }
    }),
);

router.post(
    '/health/diagnose',
    verifyToken,
    asyncHandler(async (_req: AuthRequest, res: Response) => {
        try {
            const { healthMonitor } = await import('../../services/ai/healthMonitor.js').then((m) => m);
            const results = await healthMonitor.runDiagnostics();
            res.json(results);
        } catch (err: unknown) {
            res.status(500).json({
                status: 'error',
                error: (err as Error).message,
            });
        }
    }),
);

// ==================== SMART SUGGESTIONS ====================

router.get(
    '/suggestions',
    verifyToken,
    validateQuery(GetSuggestionsQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const { projectId } = req.query as { projectId?: string };
            const smartSuggestions = await import('../../services/ai/smartSuggestions.js').then(
                (m) => (m as any).default || m,
            );

            const suggestions = await smartSuggestions.getCachedSuggestions(req.userId!, projectId, {});

            res.json({ suggestions });
        } catch (err: unknown) {
            console.error('[AI] Suggestions error:', err);
            res.status(500).json({
                error: (err as Error).message,
                suggestions: [],
            });
        }
    }),
);

router.post(
    '/suggestions',
    verifyToken,
    validateBody(PostSuggestionsRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const { projectId, conversationContext } = req.body;
            const smartSuggestions = await import('../../services/ai/smartSuggestions.js').then(
                (m) => (m as any).default || m,
            );

            const suggestions = await smartSuggestions.getSuggestions(
                req.userId!,
                projectId,
                conversationContext || {},
            );

            res.json({ suggestions });
        } catch (err: unknown) {
            console.error('[AI] Suggestions error:', err);
            res.status(500).json({
                error: (err as Error).message,
                suggestions: [],
            });
        }
    }),
);

// ==================== APPROVAL PATTERNS ====================

const ApprovalPatternService = await import('../../services/approvalPatternService.js').then(
    (m) => (m as any).default || m,
);

router.get(
    '/patterns',
    verifyToken,
    validateQuery(GetPatternsQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const { actionType } = req.query as { actionType?: string };
            const patterns = await ApprovalPatternService.getUserPatterns(req.userId!, actionType);
            res.json({ success: true, patterns });
        } catch (err: unknown) {
            console.error('[AI] Get patterns error:', err);
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }),
);

router.get(
    '/patterns/stats',
    verifyToken,
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const stats = await ApprovalPatternService.getPatternStats(req.userId!);
            res.json(stats);
        } catch (err: unknown) {
            console.error('[AI] Pattern stats error:', err);
            res.status(500).json({ error: (err as Error).message });
        }
    }),
);

router.patch(
    '/patterns/:patternId/auto-apply',
    verifyToken,
    validateParams(PatternIdParamSchema),
    validateBody(ToggleAutoApplyRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const { enabled } = req.body;
            const result = await ApprovalPatternService.setAutoApply(req.params.patternId, enabled, req.userId!);
            res.json(result);
        } catch (err: unknown) {
            console.error('[AI] Toggle auto-apply error:', err);
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }),
);

router.delete(
    '/patterns/:patternId',
    verifyToken,
    validateParams(PatternIdParamSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const result = await ApprovalPatternService.deletePattern(req.params.patternId, req.userId!);
            res.json(result);
        } catch (err: unknown) {
            console.error('[AI] Delete pattern error:', err);
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }),
);

router.post(
    '/actions/:actionId/approve',
    verifyToken,
    validateParams(z.object({ actionId: z.string().uuid() })),
    validateBody(ApproveActionRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const alwaysApprove = (req.body as any).alwaysApprove;
            const AIActionExecutor = await getAIActionExecutor();
            const result = await AIActionExecutor.approveAction((req.params as any).actionId, req.userId as string, {
                alwaysApprove,
            });
            res.json(result);
        } catch (err: unknown) {
            console.error('[AI] Approve action error:', err);
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }),
);

router.post(
    '/actions/:actionId/reject',
    verifyToken,
    validateParams(z.object({ actionId: z.string().uuid() })),
    validateBody(RejectActionRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const { reason, alwaysReject } = req.body as any;
            const AIActionExecutor = await getAIActionExecutor();
            const result = await AIActionExecutor.rejectAction(
                (req.params as any).actionId,
                req.userId as string,
                reason,
                { alwaysReject },
            );
            res.json(result);
        } catch (err: unknown) {
            console.error('[AI] Reject action error:', err);
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }),
);

router.get(
    '/actions/pending',
    verifyToken,
    validateQuery(GetPendingActionsQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const { projectId } = req.query as { projectId?: string };
            const AIActionExecutor = await getAIActionExecutor();
            const actions = await AIActionExecutor.getPendingActions(
                req.userId as string,
                projectId || null,
                req.organizationId as string,
            );

            const actionsWithPatterns = await Promise.all(
                (Array.isArray(actions) ? actions : []).map(async (action: Record<string, unknown>) => {
                    const patternInfo = await (AIActionExecutor as any).getPatternInfo(
                        req.userId as string,
                        action.action_type as string,
                        (action.payload as Record<string, unknown>) || {},
                    );
                    return { ...action, patternInfo };
                }),
            );

            res.json({ success: true, actions: actionsWithPatterns });
        } catch (err: unknown) {
            console.error('[AI] Get pending actions error:', err);
            res.status(500).json({ success: false, error: (err as Error).message, actions: [] });
        }
    }),
);

// ==================== FEEDBACK & REPORTING ====================

router.post(
    '/feedback',
    verifyToken,
    validateBody(RecordFeedbackRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { messageId, rating } = req.body;
        const userId = req.userId!;

        try {
            console.log(`[AI Feedback] User ${userId} rated message ${messageId} as ${rating}`);

            try {
                const aiLogger = await import('../../services/ai/logger.js').then((m) => (m as any).default || m);
                await aiLogger.log('feedback', {
                    userId,
                    messageId,
                    rating,
                    timestamp: new Date().toISOString(),
                });
            } catch (logErr) {
                console.warn('[AI] Could not log feedback:', (logErr as Error).message);
            }

            res.json({ success: true });
        } catch (err: unknown) {
            console.error('[AI] Feedback error:', err);
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }),
);

router.post(
    '/report',
    verifyToken,
    validateBody(ReportMessageRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        const { messageId, reason } = req.body;
        const userId = req.userId!;

        try {
            console.error(`[AI REPORT] 🚨 User ${userId} reported message ${messageId}: ${reason}`);

            try {
                const aiLogger = await import('../../services/ai/logger.js').then((m) => (m as any).default || m);
                await aiLogger.log('report', {
                    userId,
                    messageId,
                    reason,
                    timestamp: new Date().toISOString(),
                    severity: reason === 'harmful' ? 'critical' : 'warning',
                });
            } catch (logErr) {
                console.warn('[AI] Could not log report:', (logErr as Error).message);
            }

            res.json({ success: true });
        } catch (err: unknown) {
            console.error('[AI] Report error:', err);
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }),
);

// ==================== MEMORY METRICS ====================

router.get(
    '/memory/metrics',
    verifyToken,
    validateQuery(GetMemoryMetricsQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const AIMemoryMetricsService = await import('../../services/ai/aiMemoryMetricsService.js').then(
                (m) => (m as any).default || m,
            );
            const { period } = req.query as any;

            const metrics = await AIMemoryMetricsService.getDashboardMetrics(req.organizationId!, period);

            res.json({ success: true, ...metrics });
        } catch (err: unknown) {
            console.error('[AI] Memory metrics error:', err);
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }),
);

router.get(
    '/memory/current',
    verifyToken,
    validateQuery(GetCurrentMemoryQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const AIMemoryMetricsService = await import('../../services/ai/aiMemoryMetricsService.js').then(
                (m) => (m as any).default || m,
            );
            const { projectId } = req.query as any;

            const state = await AIMemoryMetricsService.getCurrentMemoryState(projectId, req.organizationId!);

            res.json({ success: true, ...state });
        } catch (err: unknown) {
            console.error('[AI] Current memory state error:', err);
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }),
);

router.get(
    '/memory/latency',
    verifyToken,
    validateQuery(GetMemoryLatencyQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const AIMemoryMetricsService = await import('../../services/ai/aiMemoryMetricsService.js').then(
                (m) => (m as any).default || m,
            );
            const { hours } = req.query as any;

            const latency = await AIMemoryMetricsService.getLatencyPercentiles(req.organizationId!, hours);

            res.json({ success: true, ...latency });
        } catch (err: unknown) {
            console.error('[AI] Latency metrics error:', err);
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }),
);

// ==================== PROACTIVE SUGGESTIONS ====================

const ProactiveSuggestionsService = await import('../../services/ai/proactiveSuggestionsService.js').then(
    (m) => m.default || m,
);
const ResponseQualityService = await import('../../services/ai/responseQualityService.js').then((m) => m.default || m);

router.get(
    '/suggestions',
    verifyToken,
    validateQuery(GetSuggestionsQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const { projectId, screenContext } = req.query as any;

            const suggestions = await (ProactiveSuggestionsService as any).generateSuggestions({
                userId: req.userId!,
                organizationId: req.organizationId!,
                projectId: projectId || null,
                screenContext: screenContext ? JSON.parse(screenContext) : null,
                recentActions: [],
            });

            res.json({ success: true, suggestions });
        } catch (err: unknown) {
            console.error('[AI] Proactive suggestions error:', err);
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }),
);

router.post(
    '/suggestions/action',
    verifyToken,
    validateBody(RecordSuggestionActionRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const { suggestionId, action, feedback } = req.body;

            await (ProactiveSuggestionsService as any).recordSuggestionAction(suggestionId, req.userId!, action, feedback);

            res.json({ success: true });
        } catch (err: unknown) {
            console.error('[AI] Suggestion action error:', err);
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }),
);

router.get(
    '/suggestions/metrics',
    verifyToken,
    validateQuery(GetSuggestionMetricsQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const { days } = req.query as any;

            const metrics = await (ProactiveSuggestionsService as any).getSuggestionMetrics(req.organizationId!, days);

            res.json({ success: true, metrics });
        } catch (err: unknown) {
            console.error('[AI] Suggestion metrics error:', err);
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }),
);

// ==================== RESPONSE QUALITY ====================

router.post(
    '/quality/calculate',
    verifyToken,
    validateBody(CalculateQualityRequestSchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const { query, response, context, sources } = req.body;

            const metrics = await (ResponseQualityService as any).calculateQuality({
                query,
                response,
                context: {
                    ...context,
                    organizationId: req.organizationId,
                },
                sources: sources || [],
            });

            res.json({ success: true, metrics });
        } catch (err: unknown) {
            console.error('[AI] Quality calculation error:', err);
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }),
);

router.get(
    '/quality/aggregate',
    verifyToken,
    validateQuery(GetAggregateQualityQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const { days } = req.query as any;

            const metrics = await (ResponseQualityService as any).getAggregateMetrics(req.organizationId!, days);

            res.json({ success: true, metrics });
        } catch (err: unknown) {
            console.error('[AI] Aggregate quality metrics error:', err);
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }),
);

router.get(
    '/quality/trends',
    verifyToken,
    validateQuery(GetQualityTrendsQuerySchema),
    asyncHandler(async (req: AuthRequest, res: Response) => {
        try {
            const { days } = req.query as any;

            const trends = await (ResponseQualityService as any).getQualityTrends(req.organizationId!, days);

            res.json({ success: true, trends });
        } catch (err: unknown) {
            console.error('[AI] Quality trends error:', err);
            res.status(500).json({ success: false, error: (err as Error).message });
        }
    }),
);

export default router;
