import jwt from 'jsonwebtoken';

export const createAILLMService = ({ deps, AccessPolicyService }) => ({
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
                // const hasBalance = await deps.TokenBillingService.hasSufficientBalance(userId, minTokens);
                // if (!hasBalance) {
                //    throw new Error("Insufficient token balance. Please top up.");
                // }
            }

            // CHECK ACCESS POLICY (TRIAL LIMITS)
            if (orgId) {
                const APS = deps.AccessPolicyService || AccessPolicyService;
                const accessCheck = await APS.checkAccess(orgId, 'ai_call');
                if (!accessCheck.allowed) {
                    throw new Error(accessCheck.reason || "AI Access Denied");
                }

                // AI BUDGET CHECK (Phase 8: Prestige)
                const budgetStatus = await deps.AICostControlService.checkBudget(orgId, null, 0.01);
                if (!budgetStatus.allowed) {
                    const err = new Error(budgetStatus.reason || "AI Budget Exhausted");
                    err.isBudgetError = true;
                    err.budgetStatus = budgetStatus;
                    throw err;
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


            // 2. EXECUTE LLM (Phase 8: Circuit Breaker Protection)
            const breakerName = providerConfig ? `llm-${providerConfig.provider}` : 'llm-fallback';

            const llmResult = await deps.CircuitBreakerService.execute(breakerName, async () => {
                let innerResponseText = '';
                let innerModelUsed = '';

                if (!providerConfig) {
                    // Fallback: Check OpenAI Env First (Higher Quality)
                    const openAIKey = process.env.OPENAI_API_KEY;
                    const geminiKey = process.env.GEMINI_API_KEY;

                    if (openAIKey) {
                        // Fallback: OpenAI Env
                        innerModelUsed = 'gpt-4o (env)';
                        const messages = history.map(h => ({
                            role: h.role === 'user' ? 'user' : 'assistant',
                            content: h.text || h.content || ''
                        }));
                        if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });
                        const userContent = formatOpenAIVisionInfo(prompt, images);
                        messages.push({ role: 'user', content: userContent });

                        const response = await fetch('https://api.openai.com/v1/chat/completions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAIKey}` },
                            body: JSON.stringify({ model: 'gpt-4o', messages })
                        });
                        if (!response.ok) throw new Error(`OpenAI Env Fallback error: ${response.statusText}`);
                        const data = await response.json();
                        innerResponseText = data.choices[0]?.message?.content || '';

                    } else if (geminiKey) {
                        // Fallback: GeminiEnv
                        innerModelUsed = 'gemini-pro-vision (fallback)';
                        const genAI = new deps.GoogleGenerativeAI(geminiKey);
                        const modelName = (images.length > 0) ? "gemini-1.5-flash" : "gemini-pro";
                        const model = genAI.getGenerativeModel({ model: modelName });

                        if (images.length > 0) {
                            const parts = formatGeminiVisionParts(prompt, images);
                            if (systemInstruction) parts.unshift({ text: `System: ${systemInstruction}` });
                            const result = await model.generateContent(parts);
                            innerResponseText = result.response.text();
                        } else {
                            const chatSession = model.startChat({
                                history: history.map(h => ({
                                    role: h.role === 'user' ? 'user' : 'model',
                                    parts: [{ text: h.text || h.content || '' }]
                                })),
                                systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined
                            });
                            const result = await chatSession.sendMessage(prompt);
                            innerResponseText = (await result.response).text();
                        }
                    } else {
                        throw new Error("AI Provider not configured (No DB config, no Env keys).");
                    }

                } else {
                    const { provider, api_key, model_id, endpoint } = providerConfig;
                    innerModelUsed = `${provider}:${model_id}`;

                    if (provider === 'ollama') {
                        const response = await fetch(`${endpoint || 'http://localhost:11434'}/api/chat`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                model: model_id || 'llama2',
                                messages: history.concat([{ role: 'user', content: prompt }]),
                                stream: false
                            })
                        });
                        if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
                        const data = await response.json();
                        innerResponseText = data.message?.content || '';
                    }
                    else if (provider === 'openai' || ['qwen', 'deepseek', 'mistral', 'groq', 'nvidia_nim', 'z_ai', 'together', 'siliconflow'].includes(provider)) {
                        const messages = history.map(h => ({
                            role: h.role === 'user' ? 'user' : 'assistant',
                            content: h.text || h.content || ''
                        }));
                        if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });
                        const userContent = formatOpenAIVisionInfo(prompt, images);
                        messages.push({ role: 'user', content: userContent });

                        let authHeader = `Bearer ${api_key}`;
                        if (provider === 'z_ai') {
                            const [id, secret] = api_key.split('.');
                            const now = Date.now();
                            const payload = { api_key: id, exp: now + 3600 * 1000, timestamp: now };
                            authHeader = 'Bearer ' + jwt.sign(payload, secret, { algorithm: 'HS256', header: { alg: 'HS256', sign_type: 'SIGN' } });
                        }

                        const response = await fetch(endpoint || 'https://api.openai.com/v1/chat/completions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
                            body: JSON.stringify({ model: model_id, messages })
                        });
                        if (!response.ok) throw new Error(`Provider ${provider} error: ${response.statusText}`);
                        const data = await response.json();
                        innerResponseText = data.choices[0]?.message?.content || '';
                    }
                    else if (provider === 'anthropic') {
                        const messages = history.map(h => ({
                            role: h.role === 'user' ? 'user' : 'assistant',
                            content: h.text || h.content || ''
                        }));
                        messages.push({ role: 'user', content: prompt });

                        const response = await fetch(endpoint || 'https://api.anthropic.com/v1/messages', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'x-api-key': api_key, 'anthropic-version': '2023-06-01' },
                            body: JSON.stringify({ model: model_id, max_tokens: 1024, system: systemInstruction, messages })
                        });
                        if (!response.ok) throw new Error(`Anthropic error: ${response.statusText}`);
                        const data = await response.json();
                        innerResponseText = data.content[0]?.text || '';
                    }
                    else if (provider === 'gemini' || provider === 'google') {
                        const genAI = new deps.GoogleGenerativeAI(api_key);
                        const model = genAI.getGenerativeModel({ model: model_id });
                        if (images.length > 0) {
                            const parts = formatGeminiVisionParts(prompt, images);
                            if (systemInstruction) parts.unshift({ text: `System Guide: ${systemInstruction}` });
                            const result = await model.generateContent(parts);
                            innerResponseText = result.response.text();
                        } else {
                            const chatSession = model.startChat({
                                history: history.map(h => ({
                                    role: h.role === 'user' ? 'user' : 'model',
                                    parts: [{ text: h.text || h.content || '' }]
                                })),
                                systemInstruction: systemInstruction ? { role: "system", parts: [{ text: systemInstruction }] } : undefined
                            });
                            const result = await chatSession.sendMessage(prompt);
                            innerResponseText = (await result.response).text();
                        }
                    }
                    else {
                        throw new Error(`Provider ${provider} not fully implemented for circuit breaker.`);
                    }
                }
                return { text: innerResponseText, model: innerModelUsed };
            }, { failureThreshold: 3, resetTimeout: 30000 });

            responseText = llmResult.text;
            modelUsed = llmResult.model;


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

            // TRACK TRIAL USAGE
            if (orgId) {
                AccessPolicyService.trackTokenUsage(orgId, totalTokens).catch(e => console.error("Trial Tracking Error", e));
            }

            return responseText;
        } catch (error) {
            console.error("LLM Call Error", error);
            throw error;
        }
    },

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

            // CHECK ACCESS POLICY (TRIAL LIMITS & BUDGET)
            if (orgId) {
                const APS = deps.AccessPolicyService || AccessPolicyService;
                const accessCheck = await APS.checkAccess(orgId, 'ai_call');
                if (!accessCheck.allowed) {
                    throw new Error(accessCheck.reason || "AI Access Denied");
                }

                const budgetStatus = await deps.AICostControlService.checkBudget(orgId, null, 0.01);
                if (!budgetStatus.allowed) {
                    const err = new Error(budgetStatus.reason || "AI Budget Exhausted");
                    err.isBudgetError = true;
                    err.budgetStatus = budgetStatus;
                    throw err;
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

            // 2. EXECUTE STREAMING LLM (Phase 8: Circuit Breaker Protection)
            const breakerName = providerConfig ? `llm-${providerConfig.provider}` : 'llm-fallback';
            const breaker = deps.CircuitBreakerService.getBreaker(breakerName, { failureThreshold: 3 });

            // Check if circuit is open
            if (breaker.state === 'OPEN') {
                if (Date.now() < breaker.nextAttemptTime) {
                    throw new Error(`Circuit breaker [${breakerName}] is OPEN. Failing fast.`);
                }
                breaker.state = 'HALF_OPEN';
            }

            try {
                if (!providerConfig) {
                    // Fallback: Check OpenAI Env First
                    const openAIKey = process.env.OPENAI_API_KEY;
                    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
                    const zaiKey = process.env.ZAI_API_KEY;
                    const deepseekKey = process.env.DEEPSEEK_API_KEY;

                    if (openAIKey) {
                        // Fallback: OpenAI Env Streaming
                        modelUsed = 'gpt-4o (env-stream)';
                        const messages = history.map(h => ({
                            role: h.role === 'user' ? 'user' : 'assistant',
                            content: h.text || h.content || ''
                        }));
                        if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });
                        const userContent = formatOpenAIVisionInfo(prompt, images);
                        messages.push({ role: 'user', content: userContent });

                        const response = await fetch('https://api.openai.com/v1/chat/completions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${openAIKey}` },
                            body: JSON.stringify({ model: 'gpt-4o', messages, stream: true })
                        });

                        if (!response.ok) throw new Error(`OpenAI Env Stream error: ${response.statusText}`);

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
                                    } catch (e) { }
                                }
                            }
                        }

                    } else if (geminiKey) {
                        // Fallback: GeminiEnv
                        // const fallbackKey = process.env.GEMINI_API_KEY; // Already defined
                        // if (!fallbackKey) throw new Error("AI Provider not configured."); // Handled in else
                        modelUsed = 'gemini-1.5-pro-latest (fallback)';
                        const genAI = new deps.GoogleGenerativeAI(geminiKey);
                        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-latest" });

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
                    } else if (zaiKey || deepseekKey) {
                        const provider = zaiKey ? 'z_ai' : 'deepseek';
                        const apiKey = zaiKey || deepseekKey;
                        const modelId = zaiKey ? 'glm-4-plus' : 'deepseek-chat';
                        const endpoint = zaiKey ? 'https://open.bigmodel.cn/api/paas/v4/chat/completions' : 'https://api.deepseek.com/v1/chat/completions';
                        modelUsed = `${provider}:${modelId} (fallback)`;

                        const messages = history.map(h => ({
                            role: h.role === 'user' ? 'user' : 'assistant',
                            content: h.text || h.content || ''
                        }));
                        if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });
                        const userContent = formatOpenAIVisionInfo(prompt, images);
                        messages.push({ role: 'user', content: userContent });

                        let authHeader = `Bearer ${apiKey}`;
                        if (provider === 'z_ai') {
                            const [id, secret] = apiKey.split('.');
                            const now = Date.now();
                            const payload = { api_key: id, exp: now + 3600 * 1000, timestamp: now };
                            authHeader = 'Bearer ' + jwt.sign(payload, secret, { algorithm: 'HS256', header: { alg: 'HS256', sign_type: 'SIGN' } });
                        }

                        const response = await fetch(endpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
                            body: JSON.stringify({ model: modelId, messages, stream: true })
                        });

                        if (!response.ok) throw new Error(`Provider ${provider} Stream error: ${response.statusText}`);

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
                                    } catch (e) { }
                                }
                            }
                        }
                    } else {
                        throw new Error("AI Provider not configured (No DB config, no Env keys).");
                    }

                } else {
                    const { provider, api_key, model_id, endpoint } = providerConfig;
                    modelUsed = `${provider}:${model_id}`;

                    if (provider === 'ollama') {
                        const response = await fetch(`${endpoint || 'http://localhost:11434'}/api/chat`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                model: model_id || 'llama2',
                                messages: history.concat([{ role: 'user', content: prompt }]),
                                stream: true
                            })
                        });
                        if (!response.ok) throw new Error(`Ollama error: ${response.statusText}`);
                        const reader = response.body.getReader();
                        const decoder = new TextDecoder();
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            const chunk = decoder.decode(value);
                            const lines = chunk.split('\n');
                            for (const line of lines) {
                                if (!line.trim()) continue;
                                try {
                                    const data = JSON.parse(line);
                                    const content = data.message?.content;
                                    if (content) {
                                        fullResponse += content;
                                        yield content;
                                    }
                                } catch (e) { }
                            }
                        }
                    }
                    else if (provider === 'openai' || ['qwen', 'deepseek', 'mistral', 'groq', 'nvidia_nim', 'z_ai', 'together', 'siliconflow'].includes(provider)) {
                        const messages = history.map(h => ({
                            role: h.role === 'user' ? 'user' : 'assistant',
                            content: h.text || h.content || ''
                        }));
                        if (systemInstruction) messages.unshift({ role: 'system', content: systemInstruction });
                        const userContent = formatOpenAIVisionInfo(prompt, images);
                        messages.push({ role: 'user', content: userContent });

                        let authHeader = `Bearer ${api_key}`;
                        if (provider === 'z_ai') {
                            const [id, secret] = api_key.split('.');
                            const now = Date.now();
                            const payload = { api_key: id, exp: now + 3600 * 1000, timestamp: now };
                            authHeader = 'Bearer ' + jwt.sign(payload, secret, { algorithm: 'HS256', header: { alg: 'HS256', sign_type: 'SIGN' } });
                        }

                        const response = await fetch(endpoint || 'https://api.openai.com/v1/chat/completions', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
                            body: JSON.stringify({ model: model_id, messages, stream: true })
                        });

                        if (!response.ok) throw new Error(`Provider ${provider} Stream error: ${response.statusText}`);
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
                                    } catch (e) { }
                                }
                            }
                        }
                    }
                    else if (provider === 'anthropic') {
                        const messages = history.map(h => ({
                            role: h.role === 'user' ? 'user' : 'assistant',
                            content: h.text || h.content || ''
                        }));
                        messages.push({ role: 'user', content: prompt });

                        const response = await fetch(endpoint || 'https://api.anthropic.com/v1/messages', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', 'x-api-key': api_key, 'anthropic-version': '2023-06-01' },
                            body: JSON.stringify({ model: model_id, max_tokens: 1024, system: systemInstruction, messages, stream: true })
                        });
                        if (!response.ok) throw new Error(`Anthropic error: ${response.statusText}`);
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
                                        const content = data.delta?.text;
                                        if (content) {
                                            fullResponse += content;
                                            yield content;
                                        }
                                    } catch (e) { }
                                }
                            }
                        }
                    }
                    else if (provider === 'gemini' || provider === 'google') {
                        const genAI = new deps.GoogleGenerativeAI(api_key);
                        const model = genAI.getGenerativeModel({ model: model_id });
                        if (images.length > 0) {
                            const parts = formatGeminiVisionParts(prompt, images);
                            if (systemInstruction) parts.unshift({ text: `System Guide: ${systemInstruction}` });
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
                    else {
                        throw new Error(`Provider ${provider} not fully implemented for circuit breaker.`);
                    }
                }
            } catch (error) {
                // Circuit breaker should handle failure count and state changes
                deps.CircuitBreakerService.handleFailure(breakerName);
                throw error;
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

            // TRACK TRIAL USAGE
            if (orgId) {
                AccessPolicyService.trackTokenUsage(orgId, totalTokens).catch(e => console.error("Trial Tracking Error", e));
            }
        } catch (error) {
            console.error("LLM Stream Error", error);
            throw error;
        }
    },

    testProviderConnection: async (config) => {
        try {
            let { provider, api_key, model_id, endpoint } = config;

            // If provider is 'system', fetch credentials from database
            if (provider === 'system' && model_id) {
                const providerRow = await new Promise((resolve, reject) => {
                    deps.db.get(
                        "SELECT provider, api_key, model_id, endpoint FROM llm_providers WHERE id = ? AND is_active = 1",
                        [model_id],
                        (err, row) => {
                            if (err) reject(err);
                            else resolve(row);
                        }
                    );
                });

                if (!providerRow) {
                    return { success: false, message: `System provider ${model_id} not found or inactive.` };
                }

                // Override config with database values
                provider = providerRow.provider;
                api_key = providerRow.api_key;
                model_id = providerRow.model_id;
                endpoint = providerRow.endpoint || endpoint;
            }

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
                    throw new Error(`Anthropic Error: ${response.status} ${errorText} `);
                }
                const data = await response.json();
                result = data.content?.[0]?.text || '';
            }
            // 2. OPENAI / OPENAI-LIKE
            else if (provider === 'openai' || ['qwen', 'deepseek', 'mistral', 'groq', 'nvidia_nim', 'z_ai', 'together', 'siliconflow'].includes(provider)) {
                let authHeader = `Bearer ${api_key}`;
                if (provider === 'z_ai') {
                    const [id, secret] = api_key.split('.');
                    const now = Date.now();
                    const payload = { api_key: id, exp: now + 3600 * 1000, timestamp: now };
                    authHeader = 'Bearer ' + jwt.sign(payload, secret, { algorithm: 'HS256', header: { alg: 'HS256', sign_type: 'SIGN' } });
                }

                const response = await fetch(endpoint || 'https://api.openai.com/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader },
                    body: JSON.stringify({
                        model: model_id || 'gpt-4o',
                        messages: [{ role: 'user', content: 'Say OK' }]
                    })
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`OpenAI Error: ${response.status} ${errorText} `);
                }
                const data = await response.json();
                result = data.choices?.[0]?.message?.content || '';
            }
            // 3. GEMINI
            else if (provider === 'gemini' || provider === 'google') {
                const genAI = new deps.GoogleGenerativeAI(api_key);
                const model = genAI.getGenerativeModel({ model: model_id || 'gemini-pro' });
                const response = await model.generateContent("Say OK");
                result = response?.response?.text() || '';
            }
            // 4. OLLAMA
            else if (provider === 'ollama') {
                const response = await fetch(`${endpoint || 'http://localhost:11434'}/api/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: model_id || 'llama2',
                        messages: [{ role: 'user', content: 'Say OK' }],
                        stream: false
                    })
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Ollama Error: ${response.status} ${errorText} `);
                }
                const data = await response.json();
                result = data.message?.content || '';
            }
            else {
                throw new Error(`Provider ${provider} not supported.`);
            }

            return { success: true, result };
        } catch (err) {
            console.error("[AiService] Provider test error:", err);
            return { success: false, message: err.message || 'Connection failed' };
        }
    }
});
