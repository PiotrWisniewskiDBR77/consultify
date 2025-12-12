const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../database');
const RagService = require('./ragService');
const FinancialService = require('./financialService');
const WebSearchService = require('./webSearchService');
const AnalyticsService = require('./analyticsService');
const FeedbackService = require('./feedbackService');
const TokenBillingService = require('./tokenBillingService');
const KnowledgeService = require('./knowledgeService');
const aiQueue = require('../queues/aiQueue');
const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');
const PromptService = require('./promptService');
const ModelRouter = require('./modelRouter');

// DEPENDENCY INJECTION CONTAINER
const deps = {
    db,
    TokenBillingService,
    AnalyticsService,
    GoogleGenerativeAI,
    RagService,
    FinancialService,
    WebSearchService,
    FeedbackService,
    KnowledgeService,
    ModelRouter, // Add Router to deps
    OpenAI: null // Allow injection of OpenAI for testing
};



// Role Definitions (Fallback)
const FALLBACK_ROLES = {
    ANALYST: "You are an Expert Digital Analyst. Your tone is objective, data-driven, and analytical. You focus on interpreting facts, KPIs, and current state assessments without fluff.",
    CONSULTANT: "You are a Senior Digital Transformation Consultant. Your tone is professional, solution-oriented, and convincing. You bridge the gap between analysis and strategy, recommending concrete initiatives.",
    STRATEGIST: "You are a Strategic Advisor to the CEO. You think in 3-5 year horizons. You focus on competitive advantage, business models, and high-level roadmap architecture. You prioritize culture and leadership.",
    FINANCE: "You are a Financial Expert / CFO Advisor. You speak in terms of ROI, CAPEX, OPEX, payback periods, and net present value. You justify every initiative with economic logic.",
    MENTOR: "You are a Leadership Coach and Mentor. Your tone is supportive, encouraging, and psychological. You focus on mindset, change management, and overcoming resistance.",
    IMPLEMENTER: "You are an Implementation Coach / Project Manager. You are tactical, organized, and deadline-driven. You focus on workstreams, dependencies, risks, and resource allocation.",
    SME: "You are a Subject Matter Expert. You have deep technical knowledge in specific domains (e.g. Cybersecurity, Data Architecture, IoT, AI). You explain complex concepts simply and accurately."
};

// Helper: Get System Prompt from DB or Fallback
const getSystemPrompt = async (roleKey) => {
    return new Promise((resolve) => {
        deps.db.get("SELECT content FROM system_prompts WHERE key = ?", [roleKey], (err, row) => {
            if (row && row.content) resolve(row.content);
            else resolve(FALLBACK_ROLES[roleKey] || FALLBACK_ROLES.CONSULTANT);
        });
    });
};

const AiService = {
    // For Testing: Allow overriding dependencies
    setDependencies: (newDeps) => {
        Object.assign(deps, newDeps);
    },

    // --- ASYNC QUEUE SUPPORT ---
    queueTask: async (taskType, payload, userId) => {
        // Enqueue job to BullMQ
        const job = await aiQueue.add(taskType, {
            taskType,
            payload,
            userId
        });
        return { jobId: job.id, status: 'queued' };
    },

    getJobStatus: async (jobId) => {
        const job = await aiQueue.getJob(jobId);
        if (!job) return null;

        const state = await job.getState();
        const result = job.returnvalue;
        const error = job.failedReason;
        const progress = job.progress;

        return { id: job.id, state, result, error, progress };
    },

    // --- CORE LLM INTERACTION ---
    callLLM: async (prompt, systemInstruction = "", history = [], providerId = null, userId = null, action = 'chat', images = []) => {
        const startTime = Date.now();
        let modelUsed = 'unknown';

        try {
            // 1. ROUTE REQUEST
            let routingResult;

            // Determine Intent
            const intent = (images && images.length > 0) ? 'vision' : (action === 'deep_diagnose' ? 'analysis' : 'chat');

            if (providerId) {
                const getManual = () => new Promise(res => deps.db.get("SELECT * FROM llm_providers WHERE id = ?", [providerId], (e, r) => res(r)));
                const pConfig = await getManual();
                routingResult = { providerConfig: pConfig, orgId: null, sourceType: 'platform', model: pConfig?.model_id };
            } else {
                routingResult = await deps.ModelRouter.route(userId, intent);
            }

            const { providerConfig, orgId, sourceType } = routingResult || {};

            // STRICT BLOCKING: Check Balance
            const multiplier = providerConfig?.markup_multiplier || 1.0;

            if (sourceType === 'platform') {
                const minTokens = Math.ceil(100 * multiplier);
                const hasBalance = await deps.TokenBillingService.hasSufficientBalance(userId, minTokens);
                if (!hasBalance) {
                    throw new Error("Insufficient token balance. Please top up.");
                }
            }

            let responseText = '';

            // Helper to format OpenAI Vision Content
            const formatOpenAIVisionInfo = (txt, imgs) => {
                if (!imgs || imgs.length === 0) return txt;
                return [
                    { type: "text", text: txt },
                    ...imgs.map(img => ({
                        type: "image_url",
                        image_url: { url: img.startsWith('http') ? img : `data:image/jpeg;base64,${img}` }
                    }))
                ];
            };

            // Helper to format Gemini Vision Content
            const formatGeminiVisionParts = (txt, imgs) => {
                const parts = [{ text: txt }];
                if (imgs && imgs.length > 0) {
                    imgs.forEach(img => {
                        // Assuming img is base64 for Gemini if not http
                        // If http, Gemini might need fetch? usually expects base64 or storage uri
                        // For this implemented, we assume base64 data without prefix or clean it
                        const b64 = img.replace(/^data:image\/\w+;base64,/, "");
                        parts.push({
                            inlineData: {
                                mimeType: "image/jpeg",
                                data: b64
                            }
                        });
                    });
                }
                return parts;
            };


            if (!providerConfig) {
                // Fallback: GeminiEnv
                const fallbackKey = process.env.GEMINI_API_KEY;
                if (!fallbackKey) throw new Error("AI Provider not configured.");

                modelUsed = 'gemini-pro-vision (fallback)';
                const genAI = new deps.GoogleGenerativeAI(fallbackKey);
                // Switch model if vision
                const modelName = (images.length > 0) ? "gemini-1.5-flash" : "gemini-pro";
                const model = genAI.getGenerativeModel({ model: modelName });

                // Gemini Vision is often single-turn in older SDKs, but 1.5 supports chat.
                // We'll use generateContent for vision to be safe if history not supported perfectly
                if (images.length > 0) {
                    const parts = formatGeminiVisionParts(prompt, images);
                    if (systemInstruction) parts.unshift({ text: `System: ${systemInstruction}` }); // Hack for single turn
                    const result = await model.generateContent(parts);
                    responseText = result.response.text();
                } else {
                    // Standard Text Chat
                    const chatSession = model.startChat({
                        history: history.map(h => ({
                            role: h.role === 'user' ? 'user' : 'model',
                            parts: [{ text: h.text || h.content || '' }]
                        })),
                        systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined
                    });
                    const result = await chatSession.sendMessage(prompt);
                    responseText = (await result.response).text();
                }

            } else {
                const { provider, api_key, model_id, endpoint } = providerConfig;
                modelUsed = `${provider}:${model_id}`;

                if (provider === 'ollama') {
                    // DISABLED PER USER REQUEST
                    throw new Error("Ollama connection is disabled by system configuration.");
                }
                else if (provider === 'openai' || ['qwen', 'deepseek', 'mistral', 'groq', 'nvidia_nim', 'z_ai', 'together'].includes(provider)) {
                    const messages = history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'assistant',
                        content: h.text || h.content || ''
                    }));
                    if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });

                    // Add User Message (Text or Multi-modal)
                    const userContent = formatOpenAIVisionInfo(prompt, images);
                    messages.push({ role: 'user', content: userContent });

                    const response = await fetch(endpoint || 'https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
                        body: JSON.stringify({ model: model_id, messages })
                    });
                    if (!response.ok) throw new Error(`Provider ${provider} error: ${response.statusText}`);
                    const data = await response.json();
                    responseText = data.choices[0]?.message?.content || '';
                }
                else if (provider === 'anthropic') {
                    const messages = history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'assistant',
                        content: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || ''
                    }));
                    messages.push({ role: 'user', content: prompt });

                    const response = await fetch(endpoint || 'https://api.anthropic.com/v1/messages', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-api-key': api_key, 'anthropic-version': '2023-06-01' },
                        body: JSON.stringify({
                            model: model_id || 'claude-3-sonnet-20240229',
                            max_tokens: 1024,
                            system: systemInstruction,
                            messages
                        })
                    });
                    if (!response.ok) throw new Error(`Anthropic error: ${response.statusText}`);
                    const data = await response.json();
                    responseText = data.content[0]?.text || '';
                }
                else if (provider === 'ernie') {
                    // Baidu ERNIE - Uses access_token auth
                    const ernieEndpoint = endpoint || 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro';
                    const messages = history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'assistant',
                        content: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || ''
                    }));
                    messages.push({ role: 'user', content: prompt });

                    const response = await fetch(`${ernieEndpoint}?access_token=${api_key}`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ messages, system: systemInstruction || '' })
                    });
                    if (!response.ok) throw new Error(`ERNIE error: ${response.statusText}`);
                    const data = await response.json();
                    responseText = data.result || '';
                }
                else if (provider === 'gemini') {
                    const genAI = new deps.GoogleGenerativeAI(api_key);
                    const model = genAI.getGenerativeModel({ model: model_id });

                    if (images.length > 0) {
                        // Vision turn
                        const parts = formatGeminiVisionParts(prompt, images);
                        if (systemInstruction) parts.unshift({ text: `System Guide: ${systemInstruction}` });
                        const result = await model.generateContent(parts);
                        responseText = result.response.text();
                    } else {
                        const chatSession = model.startChat({
                            history: history.map(h => ({
                                role: h.role === 'user' ? 'user' : 'model',
                                parts: [{ text: h.text || h.content || '' }]
                            })),
                            systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined
                        });
                        const result = await chatSession.sendMessage(prompt);
                        responseText = (await result.response).text();
                    }
                }
                else {
                    // Fallback for others not supporting vision explicitly in this code
                    if (images.length > 0) throw new Error("Vision not supported for this provider yet.");
                    throw new Error("Provider not fully implemented in this block.");
                }
            }

            // Analytics & Billing (Deduct)
            const latency = Date.now() - startTime;
            const inputTokens = (prompt.length + systemInstruction.length + (images.length * 255)) / 4;
            const outputTokens = responseText.length / 4;
            const totalTokens = Math.round(inputTokens) + Math.round(outputTokens);

            deps.AnalyticsService.logUsage(userId, action, modelUsed, Math.round(inputTokens), Math.round(outputTokens), latency).catch(e => { });

            deps.TokenBillingService.deductTokens(userId, totalTokens, sourceType, {
                organizationId: orgId,
                llmProvider: providerConfig?.provider || 'gemini',
                modelUsed: modelUsed,
                multiplier: providerConfig?.markup_multiplier || 1.0
            }).catch(e => console.error("Billing Error", e));

            return responseText;
        } catch (error) {
            console.error("LLM Call Error", error);
            throw error;
        }
    },

    // --- STREAMING SUPPORT ---
    streamLLM: async function* (prompt, systemInstruction = "", history = [], providerId = null, userId = null, action = 'chat', images = []) {
        const startTime = Date.now();
        let modelUsed = 'unknown';
        let fullResponse = '';

        try {
            // 1. ROUTE REQUEST
            const intent = (images && images.length > 0) ? 'vision' : (action === 'deep_diagnose' ? 'analysis' : 'chat');

            let routingResult;
            if (providerId) {
                const getManual = () => new Promise(res => deps.db.get("SELECT * FROM llm_providers WHERE id = ?", [providerId], (e, r) => res(r)));
                const pConfig = await getManual();
                routingResult = { providerConfig: pConfig, orgId: null, sourceType: 'platform', model: pConfig?.model_id };
            } else {
                routingResult = await deps.ModelRouter.route(userId, intent);
            }

            const { providerConfig, orgId, sourceType } = routingResult || {};
            const multiplier = providerConfig?.markup_multiplier || 1.0;

            if (sourceType === 'platform') {
                const minTokens = Math.ceil(100 * multiplier);
                const hasBalance = await deps.TokenBillingService.hasSufficientBalance(userId, minTokens);
                if (!hasBalance) {
                    throw new Error("Insufficient token balance.");
                }
            }

            // Helper Helpers (duplicated for closure)
            const formatOpenAIVisionInfo = (txt, imgs) => {
                if (!imgs || imgs.length === 0) return txt;
                return [
                    { type: "text", text: txt },
                    ...imgs.map(img => ({
                        type: "image_url",
                        image_url: { url: img.startsWith('http') ? img : `data:image/jpeg;base64,${img}` }
                    }))
                ];
            };
            const formatGeminiVisionParts = (txt, imgs) => {
                const parts = [{ text: txt }];
                if (imgs && imgs.length > 0) {
                    imgs.forEach(img => {
                        const b64 = img.replace(/^data:image\/\w+;base64,/, "");
                        parts.push({ inlineData: { mimeType: "image/jpeg", data: b64 } });
                    });
                }
                return parts;
            };

            if (!providerConfig) {
                const fallbackKey = process.env.GEMINI_API_KEY;
                if (!fallbackKey) throw new Error("AI Provider not configured.");
                modelUsed = 'gemini-1.5-flash (fallback)';
                const genAI = new deps.GoogleGenerativeAI(fallbackKey);
                const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); // 1.5 Flash is good for vision

                if (images.length > 0) {
                    const parts = formatGeminiVisionParts(prompt, images);
                    if (systemInstruction) parts.unshift({ text: `System: ${systemInstruction}` });
                    const result = await model.generateContentStream(parts);
                    for await (const chunk of result.stream) {
                        const chunkText = chunk.text();
                        fullResponse += chunkText;
                        yield chunkText;
                    }
                } else {
                    const chatSession = model.startChat({
                        history: history.map(h => ({
                            role: h.role === 'user' ? 'user' : 'model',
                            parts: [{ text: h.text || h.content || '' }]
                        })),
                        systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined
                    });
                    const result = await chatSession.sendMessageStream(prompt);
                    for await (const chunk of result.stream) {
                        const chunkText = chunk.text();
                        fullResponse += chunkText;
                        yield chunkText;
                    }
                }

            } else {
                const { provider, api_key, model_id, endpoint } = providerConfig;
                modelUsed = `${provider}:${model_id}`;

                if (provider === 'gemini') {
                    const genAI = new deps.GoogleGenerativeAI(api_key);
                    const model = genAI.getGenerativeModel({ model: model_id });
                    if (images.length > 0) {
                        const parts = formatGeminiVisionParts(prompt, images);
                        if (systemInstruction) parts.unshift({ text: `System: ${systemInstruction}` });
                        const result = await model.generateContentStream(parts);
                        for await (const chunk of result.stream) {
                            const chunkText = chunk.text();
                            fullResponse += chunkText;
                            yield chunkText;
                        }
                    } else {
                        const chatSession = model.startChat({
                            history: history.map(h => ({
                                role: h.role === 'user' ? 'user' : 'model',
                                parts: [{ text: h.text || h.content || '' }]
                            })),
                            systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined
                        });
                        const result = await chatSession.sendMessageStream(prompt);
                        for await (const chunk of result.stream) {
                            const chunkText = chunk.text();
                            fullResponse += chunkText;
                            yield chunkText;
                        }
                    }
                }
                else if (['openai', 'qwen', 'deepseek', 'mistral', 'groq', 'together', 'nvidia_nim', 'z_ai'].includes(provider)) {
                    const messages = history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'assistant',
                        content: h.text || h.content || ''
                    }));
                    if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });

                    const userContent = formatOpenAIVisionInfo(prompt, images);
                    messages.push({ role: 'user', content: userContent });

                    const response = await fetch(endpoint || 'https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
                        body: JSON.stringify({ model: model_id, messages, stream: true })
                    });

                    if (!response.ok) throw new Error(`Provider stream error: ${response.statusText}`);

                    const reader = response.body.getReader();
                    const decoder = new TextDecoder();
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;
                        const chunk = decoder.decode(value);
                        const lines = chunk.split('\n');
                        for (const line of lines) {
                            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                                try {
                                    const data = JSON.parse(line.substring(6));
                                    const content = data.choices && data.choices[0]?.delta?.content;
                                    if (content) {
                                        fullResponse += content;
                                        yield content;
                                    }
                                } catch (e) { /* ignore parse errors in stream */ }
                            }
                        }
                    }
                }
                else {
                    // Fallback for non-streaming / other providers
                    const fullText = await AiService.callLLM(prompt, systemInstruction, history, providerId, userId, action, images);
                    fullResponse = fullText;
                    yield fullText;
                }
            }

            // Analytics & Billing (Deduct)
            const latency = Date.now() - startTime;
            const inputTokens = (prompt.length + systemInstruction.length + (images.length * 255)) / 4;
            const outputTokens = fullResponse.length / 4;
            const totalTokens = Math.round(inputTokens) + Math.round(outputTokens);

            deps.AnalyticsService.logUsage(userId, action, modelUsed, Math.round(inputTokens), Math.round(outputTokens), latency).catch(e => { });

            deps.TokenBillingService.deductTokens(userId, totalTokens, sourceType, {
                organizationId: orgId,
                llmProvider: providerConfig?.provider || 'gemini',
                modelUsed: modelUsed,
                multiplier: providerConfig?.markup_multiplier || 1.0
            }).catch(e => console.error("Billing Error", e));

        } catch (error) {
            console.error("Stream LLM Error", error);
            yield " [Error generating response]";
        }
    },

    // --- HELPER: ENHANCE PROMPT WITH LEARNING ---
    enhancePrompt: async (roleKey, contextType, organizationId = null) => {
        let systemPrompt = await getSystemPrompt(roleKey);

        // 1. Inject "Learned Best Practices" (Feedback)
        const examples = await deps.FeedbackService.getLearningExamples(contextType);
        if (examples && examples.length > 50) {
            systemPrompt += `\n\n### LEARNED BEST PRACTICES (FROM FEEDBACK):\n${examples}\n### END LEARNED PRACTICES\n`;
        }

        // 2. Inject "Global Strategic Directions" (Admin Overrides)
        // We fetch active strategies from DB
        const getStrategies = () => new Promise((resolve) => {
            deps.db.all("SELECT title, description FROM global_strategies WHERE is_active = 1", (err, rows) => resolve(rows || []));
        });
        const strategies = await getStrategies();
        if (strategies.length > 0) {
            systemPrompt += `\n\n### GLOBAL STRATEGIC PRIORITIES (YOU MUST ALIGN WITH THESE):\n`;
            strategies.forEach(s => systemPrompt += `- ${s.title}: ${s.description}\n`);
            systemPrompt += `### END STRATEGIES\n`;
        }

        // 3. Inject "Client Context" (Memory)
        // 3. Inject "Client Context" (Memory)
        if (organizationId) {
            // A. Hard Facts (Name, Facilities)
            const getOrgDetails = () => new Promise((resolve) => {
                db.get("SELECT name, industry FROM organizations WHERE id = ?", [organizationId], (err, row) => resolve(row));
            });
            const getFacilities = () => new Promise((resolve) => {
                db.all("SELECT name, headcount, location, activity_profile FROM organization_facilities WHERE organization_id = ?", [organizationId], (err, rows) => resolve(rows || []));
            });
            const getContext = () => new Promise((resolve) => {
                deps.db.all("SELECT key, value FROM client_context WHERE organization_id = ? AND confidence > 0.6", [organizationId], (err, rows) => resolve(rows || []));
            });

            const [orgDetails, facilities, clientContext] = await Promise.all([
                getOrgDetails(),
                getFacilities(),
                getContext()
            ]);

            if (orgDetails) {
                systemPrompt += `\n\n### CLIENT PROFILE:\nName: ${orgDetails.name}\nIndustry: ${orgDetails.industry || 'General'}\n`;
            }

            if (facilities.length > 0) {
                systemPrompt += `\n### FACILITIES / SITES:\n`;
                facilities.forEach(f => {
                    systemPrompt += `- ${f.name} (${f.location}): ${f.headcount} employees. Profile: ${f.activity_profile}\n`;
                });
            }

            if (clientContext.length > 0) {
                systemPrompt += `\n### CLIENT SPECIFIC CONTEXT (SOFT FACTS):\n`;
                clientContext.forEach(c => systemPrompt += `- ${c.key}: ${c.value}\n`);
                systemPrompt += `### END CLIENT CONTEXT\n`;
            }
        }

        return systemPrompt;
    },

    // --- LAYER 1: DIAGNOSIS (UPDATED TO DEEP REASONING) ---
    diagnose: async (axis, textInput, userId) => {
        // Find organizationId for userId logic could go here, for now pass null
        // In a real app we'd fetch the user's org.
        return await AiService.deepDiagnose(axis, textInput, userId, null);
    },

    // --- LAYER 2: RECOMMENDATIONS ---
    generateInitiatives: async (diagnosisReport, userId) => {
        const baseRole = await AiService.enhancePrompt('CONSULTANT', 'recommendation');
        const systemPrompt = baseRole + `
        Generate 5-8 initiatives based on maturity gaps.
        Rules: Culture First, Data-Driven, Security Foundation.
        Return JSON List: [{ "title": "...", "description": "...", "axis": "...", "bundle": "...", "complexity": "...", "priority": "...", "rationale": "..." }]`;

        try {
            const jsonStr = await AiService.callLLM(`Report: ${JSON.stringify(diagnosisReport)}`, systemPrompt, [], null, userId, 'recommend');
            return JSON.parse(jsonStr.replace(/```json/g, '').replace(/```/g, ''));
        } catch (e) {
            return [];
        }
    },

    // --- LAYER 3: ROADMAP ---
    buildRoadmap: async (initiatives, userId) => {
        const baseRole = await AiService.enhancePrompt('STRATEGIST', 'roadmap');
        const systemPrompt = baseRole + `
        Sequence initiatives into 3-Year Roadmap (Year 1/2/3, Q1-Q4).
        Return JSON: { "year1": { "q1": [], ... }, "year2": {}, "year3": {} }`;

        try {
            const jsonStr = await AiService.callLLM(`Initiatives: ${JSON.stringify(initiatives)}`, systemPrompt, [], null, userId, 'roadmap');
            return JSON.parse(jsonStr.replace(/```json/g, '').replace(/```/g, ''));
        } catch (e) {
            return {};
        }
    },

    // --- LAYER 4: SIMULATION ---
    simulateEconomics: async (initiatives, revenueBase = 10000000, userId) => {
        const simulation = deps.FinancialService.simulatePortfolio(initiatives, revenueBase);
        const baseRole = await AiService.enhancePrompt('FINANCE', 'simulation');
        const systemPrompt = baseRole + `
        Provide CFO Commentary on: ${JSON.stringify(simulation)}
        Return JSON: { "commentary": "string", "riskAssessment": "string" }`;

        try {
            const jsonStr = await AiService.callLLM("Analyze case", systemPrompt, [], null, userId, 'simulate');
            return { ...simulation, ...JSON.parse(jsonStr.replace(/```json/g, '').replace(/```/g, '')) };
        } catch (e) {
            return simulation;
        }
    },

    // --- TASK SUGGESTION (DRD) ---
    suggestTasks: async (initiativeContext, userId) => {
        const baseRole = await AiService.enhancePrompt('IMPLEMENTER', 'task_generation');
        const systemPrompt = baseRole + `
        You are an expert Project Manager implementation a Digital Reality Design (DRD) initiative.
        Initiative: "${initiativeContext.name}"
        Summary: "${initiativeContext.summary}"
        Hypothesis: "${initiativeContext.hypothesis}"

        TASK: Break this initiative into specific executable tasks across 3 PHASES:
        1. DESIGN (analysis, blueprint, specifications)
        2. PILOT (MVP, small scale test, feedback)
        3. ROLLOUT (full scale implementation, training, scaling)

        For EACH task, you MUST provide:
        - title: Clear action name
        - description: Executive summary of what needs to be done
        - why: The strategic justification (Why do this?)
        - stepPhase: 'design', 'pilot', or 'rollout'
        - priority: 'low', 'medium', 'high', 'urgent'
        - acceptanceCriteria: A definition of done string
        - estimatedHours: number

        Return JSON List: [{ "title": "...", "description": "...", "why": "...", "stepPhase": "...", "priority": "...", "acceptanceCriteria": "...", "estimatedHours": 0 }]`;

        try {
            const jsonStr = await AiService.callLLM("Generate DRD Implementation Plan", systemPrompt, [], null, userId, 'suggest_tasks');
            const result = JSON.parse(jsonStr.replace(/```json/g, '').replace(/```/g, ''));
            // Ensure result is array
            return Array.isArray(result) ? result : (result.tasks || []);
        } catch (e) {
            console.error("Task Gen Error", e);
            return [];
        }
    },

    // --- VALIDATION ---
    validateInitiative: async (initiativeContext, userId) => {
        const baseRole = await AiService.enhancePrompt('ANALYST', 'validation');
        const systemPrompt = baseRole + `
        Validate initiative ${initiativeContext.name} ($${initiativeContext.costCapex}).
        Return JSON: { "confidenceScore": number, "risks": [], "recommendations": [] }`;

        try {
            const jsonStr = await AiService.callLLM("Validate", systemPrompt, [], null, userId, 'validate');
            return JSON.parse(jsonStr.replace(/```json/g, '').replace(/```/g, ''));
        } catch (e) {
            return { confidenceScore: 0, risks: [], recommendations: [] };
        }
    },
    // --- AI OBSERVATIONS (Global Brain) ---
    generateObservations: async (userId) => {
        // 1. Fetch recent feedback/interactions for analysis
        const getFeedback = () => new Promise((resolve) => {
            deps.db.all(`
                SELECT context, prompt, response, rating, comment, correction, created_at 
                FROM ai_feedback 
                ORDER BY created_at DESC 
                LIMIT 50
            `, [], (err, rows) => resolve(rows || []));
        });

        const feedback = await getFeedback();

        if (feedback.length === 0) {
            return {
                app_improvements: [],
                content_gaps: []
            };
        }

        // 2. prompt for the Analyst
        const systemPrompt = `
        You are the "Global Brain" of the system. Your job is to analyze user interactions and feedback to improve the platform.
        
        Analyze the provided USER FEEDBACK LOGS and generate a summary report in JSON format with two specific categories:

        1. "app_improvements": Observations that suggest functional improvements, UI/UX fixes, bugs, or new feature requests.
        2. "content_gaps": Observations where the AI lacked knowledge, gave poor answers, or where the user moved the conversation to topics we don't cover well yet.

        For each observation, provide:
        - "description": Concise summary of the insight.
        - "severity": "low", "medium", "high"
        - "action_item": What should be done?
        
        Return JSON: { "app_improvements": [ ... ], "content_gaps": [ ... ] }
        `;

        const feedbackText = feedback.map(f => `[${f.context}] Rate:${f.rating}/5 Comment:${f.comment || 'None'} Prompt:${f.prompt.substring(0, 50)}...`).join('\n');

        try {
            const jsonStr = await AiService.callLLM(`ANALYZE THESE LOGS:\n${feedbackText}`, systemPrompt, [], null, userId, 'observations');
            const result = JSON.parse(jsonStr.replace(/```json/g, '').replace(/```/g, ''));
            return {
                app_improvements: result.app_improvements || [],
                content_gaps: result.content_gaps || []
            };
        } catch (e) {
            console.error("Observation Gen Error", e);
            return { app_improvements: [], content_gaps: [] };
        }
    },

    // --- VERIFICATION (Web) ---
    verifyWithWeb: async (query, userId) => {
        const result = await deps.WebSearchService.verifyFact(query);
        // AnalyticsService.logUsage(userId, 'verify', 'web-search', 0, 0, 800, query).catch(e => { });
        return result;
    },

    testProviderConnection: async (config) => {
        try {
            const { provider, api_key, model_id, endpoint } = config;

            if (!provider || (!api_key && provider !== 'ollama')) throw new Error("Missing provider or API key");
            console.log('[AiService] Testing connection for:', provider);

            let result = '';

            // 1. ANTHROPIC
            if (provider === 'anthropic') {
                const response = await fetch(endpoint || 'https://api.anthropic.com/v1/messages', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': api_key, 'anthropic-version': '2023-06-01' },
                    body: JSON.stringify({
                        model: model_id || 'claude-3-sonnet-20240229',
                        max_tokens: 10,
                        messages: [{ role: 'user', content: 'Say OK' }]
                    })
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Anthropic Error: ${response.status} ${errorText}`);
                }
                const data = await response.json();
                result = data.content[0]?.text || 'OK';
            }
            // 2. OPENAI
            else if (provider === 'openai') {
                const OpenAIClass = deps.OpenAI || require('openai');
                const openai = new OpenAIClass({ apiKey: api_key });
                const completion = await openai.chat.completions.create({
                    messages: [{ role: "user", content: "Say OK" }],
                    model: model_id || "gpt-3.5-turbo",
                    max_tokens: 5
                });
                result = completion.choices[0].message.content;
            }
            // 3. GOOGLE GEMINI
            else if (provider === 'google' || provider === 'gemini') {
                const GoogleGenerativeAI = deps.GoogleGenerativeAI;
                const genAI = new GoogleGenerativeAI(api_key);
                const model = genAI.getGenerativeModel({ model: model_id || "gemini-pro" });
                const resultGen = await model.generateContent("Say OK");
                result = resultGen.response.text();
            }
            // 4. OPENAI COMPATIBLE (DeepSeek, Mistral, etc.)
            else if (['deepseek', 'mistral', 'groq', 'together', 'nvidia_nim', 'qwen', 'ernie', 'zhipu', 'z_ai'].includes(provider)) {
                // Define Endpoints
                let baseURL = endpoint;
                if (!baseURL) {
                    if (provider === 'deepseek') baseURL = 'https://api.deepseek.com';
                    else if (provider === 'mistral') baseURL = 'https://api.mistral.ai/v1';
                    else if (provider === 'groq') baseURL = 'https://api.groq.com/openai/v1';
                    else if (provider === 'nvidia_nim') baseURL = 'https://integrate.api.nvidia.com/v1';
                    else if (provider === 'z_ai') baseURL = 'https://api.z.ai/api/paas/v4';
                }

                // Use fetch for manual control if OpenAI SDK fails or for simplicity with various endpoints
                const response = await fetch(`${baseURL}/chat/completions`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
                    body: JSON.stringify({
                        model: model_id || 'gpt-3.5-turbo', // Fallback model name if needed
                        messages: [{ role: "user", content: "Say OK" }],
                        max_tokens: 5
                    })
                });

                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`${provider} Error: ${response.status} ${errText}`);
                }
                const data = await response.json();
                result = data.choices[0]?.message?.content || 'OK';
            }
            // 5. OLLAMA
            else if (provider === 'ollama') {
                const res = await fetch(`${endpoint || 'http://localhost:11434'}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: model_id || 'llama2',
                        messages: [{ role: 'user', content: 'Say OK' }],
                        stream: false
                    })
                });
                if (!res.ok) throw new Error(`Ollama Error: ${res.statusText}`);
                const data = await res.json();
                result = data.message.content;
            }
            else {
                // Try Generic Fallback?
                throw new Error(`Provider ${provider} testing not implemented yet.`);
            }

            return { success: true, message: "Connection successful!", response: result };

        } catch (error) {
            console.error("Test connection failed:", error);
            // Return error in a way the frontend expects
            return { success: false, message: error.message };
        }
    },

    // --- ENRICHMENT (Legacy/Web) ---
    enrichInitiative: async (initiativeContext) => {
        const query = `Market trends and case studies for: ${initiativeContext.name} - ${initiativeContext.summary}`;
        try {
            // Try Web Search first
            const searchResult = await deps.WebSearchService.verifyFact(query);
            return searchResult;
        } catch (e) {
            console.error("Web Search failed, using LLM knowledge", e);
            // Fallback to LLM knowledge
            const prompt = `Provide market context and 2 real-world examples for this initiative:
            Name: ${initiativeContext.name}
            Summary: ${initiativeContext.summary}
            `;
            return await AiService.callLLM(prompt, "You are a Market Researcher.");
        }
    },

    chat: async (message, history, roleName = 'CONSULTANT', userId, organizationId = null) => {
        const context = await deps.RagService.getContext(message);
        // Pass organizationId to enhancePrompt if available
        const baseRole = await AiService.enhancePrompt(roleName.toUpperCase(), 'chat', organizationId);
        let systemInstruction = baseRole;
        if (context) systemInstruction += `\n\nCONTEXT:\n${context}`;

        // Save the chat response
        return AiService.callLLM(message, systemInstruction, history, null, userId, 'chat');
    },

    chatStream: async function* (message, history, roleName = 'CONSULTANT', userId, organizationId = null, extraContext = null) {
        // #region agent log
        const fs = require('fs');
        const logPath = '/Users/piotrwisniewski/Documents/Antygracity/DRD/consultify/.cursor/debug.log';
        fs.appendFileSync(logPath, JSON.stringify({ location: 'aiService.js:chatStream:entry', message: 'ChatStream started', data: { userId, organizationId, roleName, hasExtraContext: !!extraContext, extraContextScreenId: extraContext?.screenId, messageLength: message?.length || 0 }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'B,E' }) + '\n');
        // #endregion
        // 1. Resolve Org/User if needed
        let user;
        let orgId = organizationId;

        if (userId && !user) {
            user = await new Promise(resolve => deps.db.get("SELECT * FROM users WHERE id = ?", [userId], (err, row) => resolve(row)));
            if (user && !orgId) orgId = user.organization_id;
        }
        // #region agent log
        fs.appendFileSync(logPath, JSON.stringify({ location: 'aiService.js:chatStream:userResolved', message: 'User and org resolved', data: { hasUser: !!user, orgId, userOrgId: user?.organization_id }, timestamp: Date.now(), sessionId: 'debug-session', hypothesisId: 'B,E' }) + '\n');
        // #endregion

        // 2. Fetch Knowledge Base (RAG) - Always useful
        const ragContext = await deps.RagService.getContext(message);

        // 3. Determine System Instruction
        let systemInstruction = "";

        // If we have screen context (OR just generally want rich context), use PromptService
        // Ideally we transition to PromptService for ALL chats, but let's do it if screen is present for now to be safe.
        // Actually, user requested "AI chat in whole app". 
        // Let's use PromptService if extraContext is passed, or if we just want consistent behavior.
        // But extraContext comes from frontend.

        if (extraContext && (extraContext.screenId || extraContext.title)) {
            // Fetch Company & Strategies
            const company = await new Promise(resolve => {
                if (!orgId) return resolve({});
                deps.db.get("SELECT * FROM organizations WHERE id = ?", [orgId], (err, row) => resolve(row || {}));
            });

            const strategies = await new Promise(resolve => {
                deps.db.all("SELECT title, description FROM global_strategies WHERE is_active = 1", [], (err, rows) => resolve(rows || []));
            });

            systemInstruction = PromptService.buildSystemPrompt({
                user,
                company,
                screen: extraContext,
                strategies,
                knowledge: ragContext,
                baseInstruction: roleName // Pass the incoming roleName/instruction as base
            });
        } else {
            // Fallback / Legacy (but inject RAG)
            const baseRole = await AiService.enhancePrompt(roleName.toUpperCase(), 'chat', orgId);
            systemInstruction = baseRole;
            if (ragContext) systemInstruction += `\n\nCONTEXT:\n${ragContext}`;
        }

        const generator = AiService.streamLLM(message, systemInstruction, history, null, userId, 'chat');
        for await (const chunk of generator) {
            yield chunk;
        }
    },

    // --- DEEP REASONING ENGINE (Chain of Thought) ---
    // Executes a multi-step conceptual pipeline
    runChainOfThought: async (task, steps, context = '', userId, organizationId) => {
        let currentContext = context;
        let finalOutput = '';

        for (const step of steps) {
            const stepPrompt = `
                ${currentContext}
                
                CURRENT STEP: ${step.name}
                INSTRUCTION: ${step.instruction}
                
                Perform this step and provide the output.
                `;

            // Call LLM with a specific persona if needed, or generic 'Reasoning Engine'
            const response = await AiService.callLLM(stepPrompt, "You are a Deep Reasoning engine. Think step-by-step.", [], null, userId, `CoT_${step.name}`);

            // Accumulate context for next steps
            currentContext += `\n\n[Output of ${step.name}]:\n${response}`;
            finalOutput = response; // The last step is usually the result, or we can look for specific marker
        }
        return finalOutput;
    },

    // --- UPGRADED DIAGNOSIS (Deep) ---
    deepDiagnose: async (axis, input, userId, organizationId = null) => {
        // 1. Fetch Definition & Maturity Levels (RAG)
        const axisDefinition = await deps.RagService.getAxisDefinitions(axis);

        // 2. Define CoT Steps
        const steps = [
            {
                name: "Analyze_Evidence",
                instruction: `Analyze the user input against the default maturity levels for ${axis}. List observations.`
            },
            {
                name: "Identify_Gaps",
                instruction: "Identify critical gaps between the user's current state and 'Level 5 (Bleeding Edge)' state."
            },
            {
                name: "Draft_Diagnosis",
                instruction: "Synthesize the analysis into a JSON Object with fields: { score (1-5), summary, gaps (array of strings), recommendations (array of strings) }. Return ONLY JSON."
            }
        ];

        // 3. Run Pipeline
        const context = `AXIS DEFINITION:\n${axisDefinition}\n\nUSER INPUT:\n${input}`;
        const rawResult = await AiService.runChainOfThought("Diagnose Maturity", steps, context, userId, organizationId);

        try {
            // 4. Parse Result
            const result = JSON.parse(rawResult.replace(/```json/g, '').replace(/```/g, ''));

            // 5. Save to Analytics (Benchmark)
            if (userId) {
                let orgId = organizationId;
                if (!orgId) {
                    // Resolve Org from User
                    orgId = await new Promise(resolve => {
                        deps.db.get("SELECT organization_id, (SELECT industry FROM organizations WHERE id = users.organization_id) as industry FROM users WHERE id = ?", [userId], (err, row) => {
                            resolve(row ? row.organization_id : null);
                        });
                    });
                }

                if (orgId && result.score) {
                    // We need to fetch industry if not available, but for now defaulting 'General' or fetching in separate query is fine.
                    // Doing a quick lookup
                    deps.db.get("SELECT industry FROM organizations WHERE id = ?", [orgId], (err, row) => {
                        const industry = row ? row.industry : 'General';
                        deps.AnalyticsService.saveMaturityScore(orgId, axis, result.score, industry);
                    });
                }
            }

            return result;
        } catch (e) {
            console.error("Diagnosis Parse Error", e);
            // Fallback to simple format if JSON fails
            return { score: 1, summary: rawResult, gaps: [], recommendations: [] };
        }
    },

    // --- LEARNING LOOP: INSIGHT & CONTEXT EXTRACTION ---
    extractInsights: async (text, source = 'chat', userId, organizationId = null) => {
        const prompt = `
        Analyze the following consulting interaction/text for TWO things:
        1. NOVEL IDEAS (General): Reusable methodologies or patterns.
        2. CLIENT CONTEXT (Specific): Facts about this specific client (e.g., industry, revenue, specific pain points, risk appetite).
        
        TEXT:
        "${text.substring(0, 4000)}"

        Return JSON:
        { 
            "idea": { "found": true/false, "content": "...", "reasoning": "...", "topic": "..." },
            "context": { "found": true/false, "key": "e.g., risk_appetite", "value": "...", "confidence": 0.0-1.0 }
        }
        `;

        try {
            const raw = await AiService.callLLM(prompt, "You are a Knowledge Manager.", [], null, userId, 'extract_insight');
            const json = JSON.parse(raw.replace(/```json/g, '').replace(/```/g, ''));

            if (json.idea && json.idea.found) {
                await deps.KnowledgeService.addCandidate(json.idea.content, json.idea.reasoning, source, json.idea.topic, text.substring(0, 200));
            }

            if (json.context && json.context.found && organizationId) {
                await deps.KnowledgeService.setClientContext(organizationId, json.context.key, json.context.value, 'inferred', json.context.confidence);
            }
            return json;
        } catch (e) {
            console.error("Insight Extraction Failed", e);
            return null;
        }
    },

    // --- STRATEGIC IDEAS BOARD ---
    getStrategicIdeas: async () => {
        return new Promise((resolve, reject) => {
            deps.db.all("SELECT * FROM ai_ideas ORDER BY created_at DESC", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    addStrategicIdea: async (idea) => {
        const id = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            deps.db.run(
                "INSERT INTO ai_ideas (id, title, description, status, priority) VALUES (?, ?, ?, ?, ?)",
                [id, idea.title, idea.description, idea.status || 'new', idea.priority || 'medium'],
                (err) => {
                    if (err) reject(err);
                    else resolve({ id, ...idea });
                }
            );
        });
    },

    updateStrategicIdea: async (id, updates) => {
        return new Promise((resolve, reject) => {
            deps.db.run(
                "UPDATE ai_ideas SET title = COALESCE(?, title), description = COALESCE(?, description), status = COALESCE(?, status), priority = COALESCE(?, priority) WHERE id = ?",
                [updates.title, updates.description, updates.status, updates.priority, id],
                (err) => {
                    if (err) reject(err);
                    else resolve({ id, ...updates });
                }
            );
        });
    },

    deleteStrategicIdea: async (id) => {
        return new Promise((resolve, reject) => {
            deps.db.run("DELETE FROM ai_ideas WHERE id = ?", [id], (err) => {
                if (err) reject(err);
                else resolve({ success: true });
            });
        });
    },

    // --- OBSERVATIONS ---
    getObservations: async () => {
        return new Promise((resolve, reject) => {
            deps.db.all("SELECT * FROM ai_observations ORDER BY created_at DESC LIMIT 50", [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
            });
        });
    },

    addObservation: async (observation) => {
        const id = crypto.randomUUID();
        return new Promise((resolve, reject) => {
            deps.db.run(
                "INSERT INTO ai_observations (id, content, category, confidence_score) VALUES (?, ?, ?, ?)",
                [id, observation.content, observation.category || 'system', observation.confidence_score || 1.0],
                (err) => {
                    if (err) reject(err);
                    else resolve({ id, ...observation });
                }
            );
        });
    },

    // --- DEEP REPORTING ---
    getDeepPerformanceReport: async () => {
        // combine standard stats with more deep analysis
        const stats = await deps.AnalyticsService.getStats();
        // In a real implementation, we would run complex SQL to find failure clusters
        // For now, we mock the "Deep" part with simulated data or simple extensions
        return {
            ...stats,
            successRate: 0.92, // Mocked for now
            topFailureModes: [
                { reason: "Context Length Exceeded", count: 12 },
                { reason: "API Timeout", count: 5 }
            ],
            sentimentScore: 4.2 // Mocked average sentiment
        };
    }
};

module.exports = AiService;
