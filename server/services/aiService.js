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
    callLLM: async (prompt, systemInstruction = "", history = [], providerId = null, userId = null, action = 'chat') => {
        const startTime = Date.now();
        let modelUsed = 'unknown';

        try {
            // 1. Get Provider & Organization Context
            // 1. Get Provider & Organization Context
            const getContext = () => new Promise((resolve) => {
                if (providerId) {
                    deps.db.get("SELECT * FROM llm_providers WHERE id = ?", [providerId], (err, row) => resolve({ providerConfig: row, orgId: null }));
                    return;
                }

                if (userId) {
                    deps.db.get("SELECT organization_id, ai_config FROM users WHERE id = ?", [userId], (err, user) => {
                        const orgId = user ? user.organization_id : null;

                        // A. Check User Preference (selectedModelId)
                        let userPrefId = null;
                        if (user && user.ai_config) {
                            try {
                                const cfg = JSON.parse(user.ai_config);
                                if (cfg.selectedModelId) userPrefId = cfg.selectedModelId;
                            } catch (e) { }
                        }

                        if (userPrefId) {
                            deps.db.get("SELECT * FROM llm_providers WHERE id = ? AND is_active = 1", [userPrefId], (err, prefRow) => {
                                if (prefRow) {
                                    resolve({ providerConfig: prefRow, orgId });
                                    return;
                                }
                                // If not found (e.g. invalid ID or inactive), fall through to Org Default
                                checkOrgDefault(orgId, resolve);
                            });
                        } else {
                            checkOrgDefault(orgId, resolve);
                        }
                    });
                } else {
                    checkOrgDefault(null, resolve);
                }

                function checkOrgDefault(orgId, resolve) {
                    if (orgId) {
                        deps.db.get(`
                            SELECT p.* 
                            FROM organizations o 
                            JOIN llm_providers p ON o.active_llm_provider_id = p.id 
                            WHERE o.id = ? AND p.is_active = 1
                         `, [orgId], (err, row) => {
                            if (row) resolve({ providerConfig: row, orgId });
                            else checkSystemDefault(orgId, resolve);
                        });
                    } else {
                        checkSystemDefault(null, resolve);
                    }
                }

                function checkSystemDefault(orgId, resolve) {
                    deps.db.get("SELECT * FROM llm_providers WHERE is_active = 1 AND is_default = 1 LIMIT 1", [], (err, row) => {
                        // If no default marked, just get any active one
                        if (!row) {
                            deps.db.get("SELECT * FROM llm_providers WHERE is_active = 1 ORDER BY name ASC LIMIT 1", [], (err, anyRow) => {
                                resolve({ providerConfig: anyRow || null, orgId });
                            });
                        } else {
                            resolve({ providerConfig: row, orgId });
                        }
                    });
                }
            });

            const { providerConfig, orgId } = await getContext();

            // STRICT BLOCKING: Check Balance
            const multiplier = providerConfig?.markup_multiplier || 1.0;
            const sourceType = providerConfig ? (providerConfig.provider === 'ollama' ? 'local' : 'platform') : 'platform';

            // Allow small buffer (100 tokens) to start request
            if (sourceType === 'platform') {
                const minTokens = Math.ceil(100 * multiplier);
                const hasBalance = await deps.TokenBillingService.hasSufficientBalance(userId, minTokens);
                if (!hasBalance) {
                    // Log failed attempt?
                    console.warn(`[AiService] Blocked user ${userId} due to insufficient balance.`);
                    throw new Error("Insufficient token balance. Please top up your wallet to continue using AI features.");
                }
            }

            let responseText = '';

            if (!providerConfig) {
                // Fallback: GeminiEnv
                const fallbackKey = process.env.GEMINI_API_KEY;

                if (!fallbackKey || fallbackKey === 'YOUR_GEMINI_API_KEY_HERE') throw new Error("AI Provider not configured.");

                modelUsed = 'gemini-pro (fallback)';
                const genAI = new deps.GoogleGenerativeAI(fallbackKey);
                const model = genAI.getGenerativeModel({ model: "gemini-pro" });

                // Proper System Instruction for Gemini
                const chatSession = model.startChat({
                    history: history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'model',
                        parts: [{ text: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || '' }]
                    })),
                    systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined
                });

                const result = await chatSession.sendMessage(prompt);
                responseText = (await result.response).text();
            } else {
                const { provider, api_key, model_id, endpoint } = providerConfig;
                modelUsed = `${provider}:${model_id}`;

                if (provider === 'ollama') {
                    const ollamaEndpoint = endpoint || 'http://localhost:11434';
                    const messages = history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'assistant',
                        content: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || ''
                    }));
                    if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });
                    messages.push({ role: 'user', content: prompt });

                    const response = await fetch(`${ollamaEndpoint}/api/chat`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ model: model_id || 'llama2', messages, stream: false })
                    });
                    if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
                    const data = await response.json();
                    responseText = data.message?.content || data.response || '';
                }
                else if (provider === 'openai') {
                    const messages = history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'assistant',
                        content: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || ''
                    }));
                    if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });
                    messages.push({ role: 'user', content: prompt });

                    const response = await fetch(endpoint || 'https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
                        body: JSON.stringify({ model: model_id || 'gpt-4', messages })
                    });
                    if (!response.ok) throw new Error(`OpenAI error: ${response.statusText}`);
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
                else if (provider === 'nvidia_nim') {
                    // NVIDIA NIM uses OpenAI-compatible API
                    const nimEndpoint = endpoint || 'https://integrate.api.nvidia.com/v1/chat/completions';
                    const messages = history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'assistant',
                        content: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || ''
                    }));
                    if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });
                    messages.push({ role: 'user', content: prompt });

                    const response = await fetch(nimEndpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${api_key}`
                        },
                        body: JSON.stringify({
                            model: model_id || 'meta/llama-3.1-405b-instruct',
                            messages,
                            max_tokens: 1024,
                            temperature: 0.7
                        })
                    });
                    if (!response.ok) throw new Error(`NVIDIA NIM error: ${response.statusText}`);
                    const data = await response.json();
                    responseText = data.choices[0]?.message?.content || '';
                }
                else if (provider === 'deepseek') {
                    // DeepSeek - OpenAI compatible
                    const deepseekEndpoint = endpoint || 'https://api.deepseek.com/v1/chat/completions';
                    const messages = history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'assistant',
                        content: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || ''
                    }));
                    if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });
                    messages.push({ role: 'user', content: prompt });

                    const response = await fetch(deepseekEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
                        body: JSON.stringify({ model: model_id || 'deepseek-chat', messages, max_tokens: 1024 })
                    });
                    if (!response.ok) throw new Error(`DeepSeek error: ${response.statusText}`);
                    const data = await response.json();
                    responseText = data.choices[0]?.message?.content || '';
                }
                else if (provider === 'qwen') {
                    // Alibaba Qwen (DashScope) - OpenAI compatible
                    const qwenEndpoint = endpoint || 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
                    const messages = history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'assistant',
                        content: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || ''
                    }));
                    if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });
                    messages.push({ role: 'user', content: prompt });

                    const response = await fetch(qwenEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
                        body: JSON.stringify({ model: model_id || 'qwen-max', messages, max_tokens: 1024 })
                    });
                    if (!response.ok) throw new Error(`Qwen error: ${response.statusText}`);
                    const data = await response.json();
                    responseText = data.choices[0]?.message?.content || '';
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
                else if (provider === 'zhipu') {
                    // Zhipu AI (ChatGLM) - OpenAI compatible
                    const zhipuEndpoint = endpoint || 'https://open.bigmodel.cn/api/paas/v4/chat/completions';
                    const messages = history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'assistant',
                        content: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || ''
                    }));
                    if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });
                    messages.push({ role: 'user', content: prompt });

                    const response = await fetch(zhipuEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
                        body: JSON.stringify({ model: model_id || 'glm-4', messages, max_tokens: 1024 })
                    });
                    if (!response.ok) throw new Error(`Zhipu error: ${response.statusText}`);
                    const data = await response.json();
                    responseText = data.choices[0]?.message?.content || '';
                }
                else if (provider === 'mistral') {
                    // Mistral AI - OpenAI compatible
                    const mistralEndpoint = endpoint || 'https://api.mistral.ai/v1/chat/completions';
                    const messages = history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'assistant',
                        content: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || ''
                    }));
                    if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });
                    messages.push({ role: 'user', content: prompt });

                    const response = await fetch(mistralEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
                        body: JSON.stringify({ model: model_id || 'mistral-large-latest', messages, max_tokens: 1024 })
                    });
                    if (!response.ok) throw new Error(`Mistral error: ${response.statusText}`);
                    const data = await response.json();
                    responseText = data.choices[0]?.message?.content || '';
                }
                else if (provider === 'cohere') {
                    // Cohere - Different API format
                    const cohereEndpoint = endpoint || 'https://api.cohere.ai/v1/chat';
                    const chatHistory = history.map(h => ({
                        role: h.role === 'user' ? 'USER' : 'CHATBOT',
                        message: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || ''
                    }));

                    const response = await fetch(cohereEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
                        body: JSON.stringify({
                            model: model_id || 'command-r-plus',
                            message: prompt,
                            chat_history: chatHistory,
                            preamble: systemInstruction || ''
                        })
                    });
                    if (!response.ok) throw new Error(`Cohere error: ${response.statusText}`);
                    const data = await response.json();
                    responseText = data.text || '';
                }
                else if (provider === 'groq') {
                    // Groq - OpenAI compatible (ultra fast)
                    const groqEndpoint = endpoint || 'https://api.groq.com/openai/v1/chat/completions';
                    const messages = history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'assistant',
                        content: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || ''
                    }));
                    if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });
                    messages.push({ role: 'user', content: prompt });

                    const response = await fetch(groqEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
                        body: JSON.stringify({ model: model_id || 'llama-3.1-70b-versatile', messages, max_tokens: 1024 })
                    });
                    if (!response.ok) throw new Error(`Groq error: ${response.statusText}`);
                    const data = await response.json();
                    responseText = data.choices[0]?.message?.content || '';
                }
                else if (provider === 'together') {
                    // Together AI - OpenAI compatible
                    const togetherEndpoint = endpoint || 'https://api.together.xyz/v1/chat/completions';
                    const messages = history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'assistant',
                        content: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || ''
                    }));
                    if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });
                    messages.push({ role: 'user', content: prompt });

                    const response = await fetch(togetherEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
                        body: JSON.stringify({ model: model_id || 'meta-llama/Llama-3-70b-chat-hf', messages, max_tokens: 1024 })
                    });
                    if (!response.ok) throw new Error(`Together error: ${response.statusText}`);
                    const data = await response.json();
                    responseText = data.choices[0]?.message?.content || '';
                }
                else if (provider === 'z_ai') {
                    // Z.ai - Uses standard Bearer Auth (verified via docs)
                    const zaiEndpoint = endpoint || 'https://api.z.ai/api/paas/v4/chat/completions';

                    const messages = history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'assistant',
                        content: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || ''
                    }));
                    if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });
                    messages.push({ role: 'user', content: prompt });

                    const response = await fetch(zaiEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
                        body: JSON.stringify({ model: model_id || 'glm-4.6', messages, stream: false })
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`Z.ai error: ${response.status} ${response.statusText} - ${errorText}`);
                    }

                    const data = await response.json();
                    responseText = data.choices[0]?.message?.content || '';
                }
                else if (provider === 'nvidia') {
                    // NVIDIA NIM - OpenAI compatible
                    const nvidiaEndpoint = endpoint || 'https://integrate.api.nvidia.com/v1/chat/completions';
                    const messages = history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'assistant',
                        content: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || ''
                    }));
                    if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });
                    messages.push({ role: 'user', content: prompt });

                    const response = await fetch(nvidiaEndpoint, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
                        body: JSON.stringify({ model: model_id || 'meta/llama3-70b-instruct', messages, stream: false })
                    });

                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`NVIDIA error: ${response.status} ${response.statusText} - ${errorText}`);
                    }

                    const data = await response.json();
                    responseText = data.choices[0]?.message?.content || '';
                }
                else {
                    // Google Gemini (Configured) - Default
                    const genAI = new deps.GoogleGenerativeAI(api_key);
                    const model = genAI.getGenerativeModel({ model: model_id || "gemini-pro" });

                    const chatSession = model.startChat({
                        history: history.map(h => ({
                            role: h.role === 'user' ? 'user' : 'model',
                            parts: [{ text: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || '' }]
                        })),
                        systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined
                    });

                    const result = await chatSession.sendMessage(prompt);
                    responseText = (await result.response).text();
                }
            }

            // Analytics Log
            // Analytics Log
            const latency = Date.now() - startTime;
            const inputTokens = (prompt.length + systemInstruction.length) / 4;
            const outputTokens = responseText.length / 4;
            const totalTokens = Math.round(inputTokens) + Math.round(outputTokens);
            deps.AnalyticsService.logUsage(userId, action, modelUsed, Math.round(inputTokens), Math.round(outputTokens), latency)
                .catch(err => console.error("Analytics Log Error", err));

            // Token Billing - Track usage
            const sourceTypeFinal = providerConfig ? (providerConfig.provider === 'ollama' ? 'local' : 'platform') : 'platform';
            deps.TokenBillingService.deductTokens(userId, totalTokens, sourceTypeFinal, {
                organizationId: orgId,
                llmProvider: providerConfig?.provider || 'gemini',
                modelUsed: modelUsed,
                multiplier: providerConfig?.markup_multiplier || 1.0
            }).catch(err => console.error("Token Billing Error", err));

            return responseText;
        } catch (error) {
            console.error("LLM Call Error", error);
            throw error;
        }
    },

    // --- STREAMING SUPPORT ---
    streamLLM: async function* (prompt, systemInstruction = "", history = [], providerId = null, userId = null, action = 'chat') {
        const startTime = Date.now();
        let modelUsed = 'unknown';
        let fullResponse = '';

        try {
            // 1. Get Provider (Reusing logic - ideally refactor into helper but duplicating for safety in this edit)
            // 1. Get Provider & Organization Context (Duplicated for safety in generator)
            // 1. Get Provider & Organization Context
            const getContext = () => new Promise((resolve) => {
                if (providerId) {
                    deps.db.get("SELECT * FROM llm_providers WHERE id = ?", [providerId], (err, row) => resolve({ providerConfig: row, orgId: null }));
                    return;
                }

                if (userId) {
                    deps.db.get("SELECT organization_id, ai_config FROM users WHERE id = ?", [userId], (err, user) => {
                        const orgId = user ? user.organization_id : null;

                        // A. Check User Preference (selectedModelId)
                        let userPrefId = null;
                        if (user && user.ai_config) {
                            try {
                                const cfg = JSON.parse(user.ai_config);
                                if (cfg.selectedModelId) userPrefId = cfg.selectedModelId;
                            } catch (e) { }
                        }

                        if (userPrefId) {
                            deps.db.get("SELECT * FROM llm_providers WHERE id = ?", [userPrefId], (err, prefRow) => {
                                if (prefRow) {
                                    resolve({ providerConfig: prefRow, orgId });
                                    return;
                                }
                                checkOrgDefault(orgId, resolve);
                            });
                        } else {
                            checkOrgDefault(orgId, resolve);
                        }
                    });
                } else {
                    checkOrgDefault(null, resolve);
                }

                function checkOrgDefault(orgId, resolve) {
                    if (orgId) {
                        deps.db.get(`
                            SELECT p.* 
                            FROM organizations o 
                            JOIN llm_providers p ON o.active_llm_provider_id = p.id 
                            WHERE o.id = ? AND p.is_active = 1
                         `, [orgId], (err, row) => {
                            if (row) resolve({ providerConfig: row, orgId });
                            else checkSystemDefault(orgId, resolve);
                        });
                    } else {
                        checkSystemDefault(null, resolve);
                    }
                }

                function checkSystemDefault(orgId, resolve) {
                    deps.db.get("SELECT * FROM llm_providers WHERE is_active = 1 AND is_default = 1 LIMIT 1", [], (err, row) => {
                        if (!row) {
                            deps.db.get("SELECT * FROM llm_providers WHERE is_active = 1 ORDER BY name ASC LIMIT 1", [], (err, anyRow) => {
                                resolve({ providerConfig: anyRow || null, orgId });
                            });
                        } else {
                            resolve({ providerConfig: row, orgId });
                        }
                    });
                }
            });

            const { providerConfig, orgId } = await getContext();

            // STRICT BLOCKING: Check Balance
            const multiplier = providerConfig?.markup_multiplier || 1.0;
            const sourceType = providerConfig ? (providerConfig.provider === 'ollama' ? 'local' : 'platform') : 'platform';

            if (sourceType === 'platform') {
                const minTokens = Math.ceil(100 * multiplier);
                const hasBalance = await deps.TokenBillingService.hasSufficientBalance(userId, minTokens);
                if (!hasBalance) {
                    throw new Error("Insufficient token balance. Please top up.");
                }
            }

            if (!providerConfig) {
                // Fallback: GeminiEnv
                const fallbackKey = process.env.GEMINI_API_KEY;
                if (!fallbackKey || fallbackKey === 'YOUR_GEMINI_API_KEY_HERE') throw new Error("AI Provider not configured.");

                modelUsed = 'gemini-pro (fallback)';
                const genAI = new deps.GoogleGenerativeAI(fallbackKey);
                const model = genAI.getGenerativeModel({ model: "gemini-pro" });

                const chatSession = model.startChat({
                    history: history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'model',
                        parts: [{ text: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || '' }]
                    })),
                    systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined
                });

                const result = await chatSession.sendMessageStream(prompt);
                for await (const chunk of result.stream) {
                    const chunkText = chunk.text();
                    fullResponse += chunkText;
                    yield chunkText;
                }

            } else {
                const { provider, api_key, model_id, endpoint } = providerConfig;
                modelUsed = `${provider}:${model_id}`;

                if (provider === 'openai' || ['qwen', 'deepseek', 'mistral', 'groq', 'together', 'nvidia_nim', 'z_ai'].includes(provider)) {
                    // ... (OpenAI Streaming logic remains same as it uses fetch)
                    // OpenAI Streaming
                    const messages = history.map(h => ({
                        role: h.role === 'user' ? 'user' : 'assistant',
                        content: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || ''
                    }));
                    if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });
                    messages.push({ role: 'user', content: prompt });

                    const response = await fetch(endpoint || 'https://api.openai.com/v1/chat/completions', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${api_key}` },
                        body: JSON.stringify({ model: model_id || 'gpt-4', messages, stream: true })
                    });

                    if (!response.ok) throw new Error(`OpenAI stream error: ${response.statusText}`);

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
                                    const content = data.choices[0]?.delta?.content;
                                    if (content) {
                                        fullResponse += content;
                                        yield content;
                                    }
                                } catch (e) { /* ignore parse errors in stream */ }
                            }
                        }
                    }
                }
                else if (provider === 'gemini' || !provider) { // Default to gemini if provider set but matches gemini logic
                    const genAI = new deps.GoogleGenerativeAI(api_key);
                    const model = genAI.getGenerativeModel({ model: model_id || "gemini-pro" });
                    const chatSession = model.startChat({
                        history: history.map(h => ({
                            role: h.role === 'user' ? 'user' : 'model',
                            parts: [{ text: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || '' }]
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
                else if (provider === 'gemini') {
                    // Google Gemini Streaming
                    const genAI = new deps.GoogleGenerativeAI(api_key);
                    const model = genAI.getGenerativeModel({ model: modelId || "gemini-pro" });

                    const chatSession = model.startChat({
                        history: history.map(h => ({
                            role: h.role === 'user' ? 'user' : 'model',
                            parts: [{ text: h.text || h.content || (h.parts && h.parts[0] && h.parts[0].text) || '' }]
                        })),
                        systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined
                    });

                    const result = await chatSession.sendMessageStream(prompt);
                    for await (const chunk of result.stream) {
                        const chunkText = chunk.text();
                        fullResponse += chunkText;
                        yield chunkText;
                    }
                } else {
                    // Fallback for others (non-streaming simulation)
                    const fullText = await AiService.callLLM(prompt, systemInstruction, history, providerConfig.id, userId, action);
                    fullResponse = fullText;
                    yield fullText;
                }
            }

            // Log Analytics after stream
            const latency = Date.now() - startTime;
            const inputTokens = (prompt.length + systemInstruction.length) / 4;
            const outputTokens = fullResponse.length / 4;
            const totalTokens = Math.round(inputTokens) + Math.round(outputTokens);

            deps.AnalyticsService.logUsage(userId, action, modelUsed, Math.round(inputTokens), Math.round(outputTokens), latency).catch(e => { });

            // Token Billing - Track usage
            const sourceTypeFinal = providerConfig ? (providerConfig.provider === 'ollama' ? 'local' : 'platform') : 'platform';
            deps.TokenBillingService.deductTokens(userId, totalTokens, sourceTypeFinal, {
                organizationId: orgId,
                llmProvider: providerConfig?.provider || 'gemini',
                modelUsed: modelUsed,
                multiplier: providerConfig?.markup_multiplier || 1.0
            }).catch(err => console.error("Token Billing Error", err));

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
        if (organizationId) {
            const getContext = () => new Promise((resolve) => {
                deps.db.all("SELECT key, value FROM client_context WHERE organization_id = ? AND confidence > 0.6", [organizationId], (err, rows) => resolve(rows || []));
            });
            const clientContext = await getContext();
            if (clientContext.length > 0) {
                systemPrompt += `\n\n### CLIENT SPECIFIC CONTEXT (MEMORY):\n`;
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
        fs.appendFileSync(logPath, JSON.stringify({location:'aiService.js:chatStream:entry',message:'ChatStream started',data:{userId,organizationId,roleName,hasExtraContext:!!extraContext,extraContextScreenId:extraContext?.screenId,messageLength:message?.length||0},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,E'})+'\n');
        // #endregion
        // 1. Resolve Org/User if needed
        let user;
        let orgId = organizationId;

        if (userId && !user) {
            user = await new Promise(resolve => deps.db.get("SELECT * FROM users WHERE id = ?", [userId], (err, row) => resolve(row)));
            if (user && !orgId) orgId = user.organization_id;
        }
        // #region agent log
        fs.appendFileSync(logPath, JSON.stringify({location:'aiService.js:chatStream:userResolved',message:'User and org resolved',data:{hasUser:!!user,orgId,userOrgId:user?.organization_id},timestamp:Date.now(),sessionId:'debug-session',hypothesisId:'B,E'})+'\n');
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

        if (extraContext && extraContext.screenId) {
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
                knowledge: ragContext
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
