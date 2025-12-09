const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../database');
const RagService = require('./ragService');

// Role Definitions (System Prompts)
const ROLES = {
    ANALYST: "You are an Expert Digital Analyst. Your tone is objective, data-driven, and analytical. You focus on interpreting facts, KPIs, and current state assessments without fluff.",
    CONSULTANT: "You are a Senior Digital Transformation Consultant. Your tone is professional, solution-oriented, and convincing. You bridge the gap between analysis and strategy, recommending concrete initiatives.",
    STRATEGIST: "You are a Strategic Advisor to the CEO. You think in 3-5 year horizons. You focus on competitive advantage, business models, and high-level roadmap architecture. You prioritize culture and leadership.",
    FINANCE: "You are a Financial Expert / CFO Advisor. You speak in terms of ROI, CAPEX, OPEX, payback periods, and net present value. You justify every initiative with economic logic.",
    MENTOR: "You are a Leadership Coach and Mentor. Your tone is supportive, encouraging, and psychological. You focus on mindset, change management, and overcoming resistance.",
    IMPLEMENTER: "You are an Implementation Coach / Project Manager. You are tactical, organized, and deadline-driven. You focus on workstreams, dependencies, risks, and resource allocation.",
    SME: "You are a Subject Matter Expert. You have deep technical knowledge in specific domains (e.g. Cybersecurity, Data Architecture, IoT, AI). You explain complex concepts simply and accurately."
};

const AiService = {
    // --- CORE LLM INTERACTION ---

    /**
     * Generic wrapper to call LLM (Gemini, OpenAI, Anthropic, or Ollama)
     * @param {string} prompt - The user message
     * @param {string} systemInstruction - System prompt
     * @param {Array} history - Chat history
     * @param {string|null} providerId - Optional specific provider ID to use
     */
    callLLM: async (prompt, systemInstruction = "", history = [], providerId = null) => {
        // 1. Get Provider (specific or active)
        const getProvider = () => new Promise((resolve) => {
            const query = providerId
                ? "SELECT * FROM llm_providers WHERE id = ?"
                : "SELECT * FROM llm_providers WHERE is_active = 1 LIMIT 1";
            const params = providerId ? [providerId] : [];
            db.get(query, params, (err, row) => {
                resolve(row);
            });
        });

        const providerConfig = await getProvider();

        if (!providerConfig) {
            // Fallback to environment variable for Gemini
            const fallbackKey = process.env.GEMINI_API_KEY;
            if (!fallbackKey || fallbackKey === 'YOUR_GEMINI_API_KEY_HERE') {
                throw new Error("AI Provider not configured.");
            }
            // Use fallback Gemini
            const genAI = new GoogleGenerativeAI(fallbackKey);
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });
            const chatSession = model.startChat({
                history: history.map(h => ({
                    role: h.role === 'user' ? 'user' : 'model',
                    parts: [{ text: h.text }]
                }))
            });
            const fullMessage = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;
            const result = await chatSession.sendMessage(fullMessage);
            return (await result.response).text();
        }

        const { provider, api_key, model_id, endpoint } = providerConfig;

        // --- OLLAMA (Local) ---
        if (provider === 'ollama') {
            const ollamaEndpoint = endpoint || 'http://localhost:11434';
            const ollamaModel = model_id || 'llama2';

            const messages = [];
            if (systemInstruction) {
                messages.push({ role: 'system', content: systemInstruction });
            }
            history.forEach(h => {
                messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text });
            });
            messages.push({ role: 'user', content: prompt });

            const response = await fetch(`${ollamaEndpoint}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: ollamaModel,
                    messages: messages,
                    stream: false
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama error: ${response.statusText}`);
            }

            const data = await response.json();
            return data.message?.content || data.response || '';
        }

        // --- OPENAI ---
        if (provider === 'openai') {
            const messages = [];
            if (systemInstruction) {
                messages.push({ role: 'system', content: systemInstruction });
            }
            history.forEach(h => {
                messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text });
            });
            messages.push({ role: 'user', content: prompt });

            const openaiEndpoint = endpoint || 'https://api.openai.com/v1/chat/completions';
            const response = await fetch(openaiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${api_key}`
                },
                body: JSON.stringify({
                    model: model_id || 'gpt-4',
                    messages: messages
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(`OpenAI error: ${err.error?.message || response.statusText}`);
            }

            const data = await response.json();
            return data.choices[0]?.message?.content || '';
        }

        // --- ANTHROPIC ---
        if (provider === 'anthropic') {
            const messages = [];
            history.forEach(h => {
                messages.push({ role: h.role === 'user' ? 'user' : 'assistant', content: h.text });
            });
            messages.push({ role: 'user', content: prompt });

            const anthropicEndpoint = endpoint || 'https://api.anthropic.com/v1/messages';
            const response = await fetch(anthropicEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': api_key,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: model_id || 'claude-3-sonnet-20240229',
                    max_tokens: 1024,
                    system: systemInstruction || undefined,
                    messages: messages
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(`Anthropic error: ${err.error?.message || response.statusText}`);
            }

            const data = await response.json();
            return data.content[0]?.text || '';
        }

        // --- GOOGLE GEMINI (default) ---
        const genAI = new GoogleGenerativeAI(api_key);
        const model = genAI.getGenerativeModel({ model: model_id || "gemini-pro" });

        const chatSession = model.startChat({
            history: history.map(h => ({
                role: h.role === 'user' ? 'user' : 'model',
                parts: [{ text: h.text }]
            }))
        });

        const fullMessage = systemInstruction ? `${systemInstruction}\n\n${prompt}` : prompt;

        const result = await chatSession.sendMessage(fullMessage);
        const response = await result.response;
        return response.text();
    },

    // --- LAYER 1: DIAGNOSIS ENGINE ---

    diagnose: async (axis, textInput) => {
        // 1. Retrieve definitions for this axis
        const definitions = await RagService.getAxisDefinitions(axis);

        // 2. Build Diagnosis Prompt
        const systemPrompt = ROLES.ANALYST + `
        You are diagnosing the "${axis}" maturity of a company based on the "Digital Pathfinder" methodology (Levels 1 to 5).
        
        Reference Definitions:
        ${definitions}
        
        Task:
        Analyze the user's input. precise Determine the maturity Level (1-5).
        Return purely JSON in the following format:
        {
            "level": number,
            "justification": "string explaining why match to definition",
            "gaps": ["gap 1", "gap 2"]
        }
        `;

        const userPrompt = `User Input for ${axis}: "${textInput}"`;

        try {
            const jsonStr = await AiService.callLLM(userPrompt, systemPrompt);
            // Cleanup JSON if LLM adds markdown blocks
            const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '');
            return JSON.parse(cleanJson);
        } catch (e) {
            console.error("Diagnosis Error", e);
            return { level: 1, justification: "Error in diagnosis, defaulting to 1", gaps: [] };
        }
    },

    // --- LAYER 2: CONSULTING ENGINE (Recommendations) ---

    generateInitiatives: async (diagnosisReport) => {
        // diagnosisReport is an object with levels for axes. e.g. { processes: 2, culture: 1 ... }

        const systemPrompt = ROLES.CONSULTANT + `
        You are designing a transformation portfolio. 
        Rules:
        1. Culture and Skills (Axis 5) must precede advanced Tech.
        2. Data Foundations (Axis 4) must precede AI.
        3. Cybersecurity (Axis 6) must be foundational.
        
        Task:
        Generate specific initiatives to move the company to the next level in each area.
        Group them into logical "Bundles" (e.g. "Digital Foundation", "Process Automation").
        
        Return JSON:
        [
            {
                "title": "Initiative Name",
                "description": "What to do",
                "axis": "Related Axis",
                "horizon": "Short-term" | "Medium-term" | "Long-term",
                "bundle": "Bundle Name",
                "estimatedCost": "Low" | "Medium" | "High",
                "impact": "High"
            }
        ]
        `;

        const userPrompt = `Current Maturity State: ${JSON.stringify(diagnosisReport)}`;

        try {
            const jsonStr = await AiService.callLLM(userPrompt, systemPrompt);
            const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '');
            return JSON.parse(cleanJson);
        } catch (e) {
            return [];
        }
    },

    // --- LAYER 3: STRATEGIC ADVISOR (Roadmap) ---

    buildRoadmap: async (initiatives) => {
        const systemPrompt = ROLES.STRATEGIST + `
        You are architecting a 3-year Digital Roadmap.
        Sequence the provided initiatives into Quarters (Q1-Q4 Year 1, etc.).
        
        Rules:
        - Balance quick wins with long-term goals.
        - Ensure resources aren't overwhelmed (max 3 major initiatives per quarter).
        - Logical dependencies (Foundation -> Pilot -> Scale).
        
        Return JSON structure:
        {
            "year1": { "q1": [], "q2": [], "q3": [], "q4": [] },
            "year2": { ... },
            "year3": { ... }
        }
        `;

        const userPrompt = `Initiatives List: ${JSON.stringify(initiatives)}`;

        try {
            const jsonStr = await AiService.callLLM(userPrompt, systemPrompt);
            const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '');
            return JSON.parse(cleanJson);
        } catch (e) {
            return {};
        }
    },

    // --- LAYER 4: SIMULATION (Financials) ---

    simulateEconomics: async (initiatives, revenueBase = 10000000) => {
        const systemPrompt = ROLES.FINANCE + `
         Estimate the ROI, CAPEX, and OPEX for this transformation portfolio.
         Assume a base revenue of ${revenueBase} EUR.
         
         Output JSON:
         {
            "totalCapex": number,
            "annualOpex": number,
            "efficiencyGains": number (percentage),
            "revenueUplift": number (percentage),
            "roi": number (percentage),
            "paybackPeriodMonths": number
         }
         `;

        const userPrompt = `Initiatives: ${JSON.stringify(initiatives.map(i => i.title))}`;

        try {
            const jsonStr = await AiService.callLLM(userPrompt, systemPrompt);
            const cleanJson = jsonStr.replace(/```json/g, '').replace(/```/g, '');
            return JSON.parse(cleanJson);
        } catch (e) {
            return {};
        }
    },

    // --- GENERAL CHAT WITH PERSONA ---

    chat: async (message, history, roleName = 'CONSULTANT') => {
        // 1. Get Context
        const context = await RagService.getContext(message);

        // 2. Select Role
        const rolePrompt = ROLES[roleName.toUpperCase()] || ROLES.CONSULTANT;

        // 3. System Instruction
        let systemInstruction = rolePrompt;
        if (context) {
            systemInstruction += `\n\nUse the following "Digital Pathfinder" knowledge base if relevant:\n${context}`;
        }

        // 4. Call LLM (Stream handling handled by frontend usually, but here we do blocking for MVP API)
        return AiService.callLLM(message, systemInstruction, history);
    }
};

module.exports = AiService;
