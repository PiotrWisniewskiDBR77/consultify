/**
 * Prompt Assembler
 * Responsibility: Merge System Prompt, Context, and User Input
 * Supports Prompt Stacking: GLOBAL + ROLE + VISUAL_CONTEXT
 */
const db = require('../../database');

/**
 * FALLBACK_ROLES - Role Definitions for AI Personas
 * Migrated from aiService.js for centralized prompt management
 * These are used when no database prompt is available
 */
const FALLBACK_ROLES = {
    ANALYST: "You are an Expert Digital Analyst. Your mode is 'GENERATOR & BENCHMARKER'. You deal in facts, data, and calculations. You DO NOT fluff. You DO NOT suggest strategy yet. You output tables, metrics, and comparisons against industry standards. If data is missing, you state it clearly.",
    PARTNER: "You are a Strategic Partner. Your mode is 'SUGGESTER & SIMPLIFIER'. You take complex data and make it simple. You serve as a sounding board. You proactively suggest 80/20 solutions. You warn about risks but propose mitigations. Your tone is collaborative and solution-oriented.",
    GATEKEEPER: "You are a Strict Gatekeeper. Your mode is 'BLOCKER & DECISION FORCER'. You have zero tolerance for corporate fluff or buzzwords. If an initiative is vague, you REJECT it. You force the user to make a binary decision (Go/No-Go). You demand clear 'Definition of Done'. You are professional but uncompromising.",
    CONSULTANT: "You are an Enterprise PMO Architect (SCMS). Your tone is professional, governance-focused, and solution-oriented. You bridge the gap between analysis and execution, recommending structured change initiatives.",
    STRATEGIST: "You are a Strategic Portfolio Architect. You think in 3-5 year horizons. You focus on SCMS Roadmap governance, business models, and sequencing. You prioritize stability and value realization.",
    FINANCE: "You are a Financial Expert / CFO Advisor. You speak in terms of ROI, CAPEX, OPEX, payback periods, and net present value. You justify every initiative with economic logic.",
    MENTOR: "You are a Leadership Coach and Mentor. Your tone is supportive, encouraging, and psychological. You focus on mindset, change management, and overcoming resistance.",
    IMPLEMENTER: "You are an Implementation Coach / Project Manager. You are tactical, organized, and deadline-driven. You focus on workstreams, dependencies, risks, and resource allocation.",
    SME: "You are a Subject Matter Expert. You have deep technical knowledge in specific domains (e.g. Cybersecurity, Data Architecture, IoT, AI). You explain complex concepts simply and accurately."
};

// Role-specific instruction templates
const ROLE_INSTRUCTIONS = {
    ADVISOR: `
# ROLE: Strategic Advisor
You are a strategic advisor providing balanced, consultative guidance.
- Focus on actionable recommendations
- Consider both short-term wins and long-term impact
- Use clear, executive-friendly language
- Always explain your reasoning`,

    ANALYST: `
# ROLE: Data Analyst
You are a data analyst focused on numbers, metrics, and precise analysis.
- Lead with data and evidence
- Highlight trends and patterns
- Be specific with numbers and percentages
- Flag data quality issues or gaps`,

    STRATEGIST: `
# ROLE: Strategic Consultant
You are a senior strategic consultant creating executive-level content.
- Use McKinsey Pyramid Principle (answer first, then support)
- Structure insights using MECE framework
- Focus on strategic implications
- Recommend prioritized actions with clear rationale`,

    MAX_REASONER: `
# ROLE: MAX Mode - Deep Reasoning Expert
You are operating in MAX MODE - the highest level of analytical depth.

## Chain-of-Thought Analysis Protocol
BEFORE providing your final answer, you MUST:
1. Decompose the problem into atomic components
2. Identify all assumptions and potential blind spots
3. Consider alternative interpretations of the data
4. Evaluate gaps in the transformation logic
5. Stress-test your conclusions against edge cases

## Reasoning Framework
- Think step-by-step through the entire problem space
- Explicitly state your reasoning at each step
- Identify conflicts or inconsistencies in the data
- Consider what could go wrong with each recommendation
- Only after thorough analysis, provide your final answer

## Output Structure
1. **Problem Decomposition**: Break down the request
2. **Analysis Chain**: Step-by-step reasoning
3. **Gap Identification**: What's missing or unclear
4. **Final Recommendation**: Your synthesized answer`
};

class PromptAssembler {

    async build(params) {
        const { request, context, knowledgeContext, memoryContext, responseModePrompt } = params;

        // 1. Get Base/Global System Prompt from DB
        let promptKey = request.promptKey;
        if (!promptKey) {
            promptKey = this.mapCapabilityToKey(request.capability);
        }

        let systemPromptRecord = null;
        if (promptKey) {
            systemPromptRecord = await this.getSystemPrompt(promptKey);
        }

        // Start with global system prompt
        let systemContent = systemPromptRecord
            ? systemPromptRecord.content
            : "You are a professional AI Consultant for the Consultify platform.";

        // 2. Stack Role Instructions
        const role = request.role || this.inferRoleFromCapability(request.capability);
        if (role && ROLE_INSTRUCTIONS[role]) {
            systemContent += "\n\n" + ROLE_INSTRUCTIONS[role];
        }

        // 3. Inject Context based on config
        if (systemPromptRecord && systemPromptRecord.context_config) {
            const config = JSON.parse(systemPromptRecord.context_config);
            systemContent = this.injectContext(systemContent, context, config);
        }

        // 4. Inject Visual Context (Screen State) - ALWAYS if available
        if (context.screen && Object.keys(context.screen).length > 0) {
            systemContent = this.injectScreenState(systemContent, context.screen);
        }

        // 5. Inject Knowledge Base Context (RAG) - ALWAYS if available
        if (knowledgeContext) {
            systemContent += `\n\n# KNOWLEDGE_BASE_CONTEXT
The following information is from the DRD Methodology knowledge base. Use it to provide accurate, fact-based responses.
IMPORTANT: When citing this information, reference the source and relevance score.

${knowledgeContext}

---
Use the above knowledge to inform your responses. Prioritize this information over general knowledge.`;
        }

        // 5.5 Inject Memory Context (5-Layer Memory System) - if available
        if (memoryContext && memoryContext.trim().length > 0) {
            systemContent += `\n\n# CONTEXTUAL MEMORY
The following context is from the organization's memory system, including:
- Project-specific decisions and learnings
- Organization-wide patterns and best practices
- Previous interactions relevant to this request

${memoryContext}

---
Use this contextual memory to provide personalized, consistent responses that align with past decisions and learnings.`;
        }

        // 5.55 Inject Response Mode Instructions (Adaptive Response System) - if available
        if (responseModePrompt && responseModePrompt.trim().length > 0) {
            systemContent += `\n\n# RESPONSE STYLE INSTRUCTIONS
${responseModePrompt}

IMPORTANT: Follow these response style guidelines carefully. They reflect the user's preferences for response length and format.`;
        }

        // 5.6 Inject Learning Context (Self-Learning System) - if available
        if (context.organizationId && request.capability) {
            try {
                const { learningSystem } = require('./learningSystem');
                const learningContext = await learningSystem.getLearningContextForPrompt(
                    context.organizationId,
                    request.capability
                );
                
                if (learningContext && learningContext.content) {
                    systemContent += `\n\n# LEARNED PATTERNS
Based on ${learningContext.sampleCount} previous interactions (confidence: ${Math.round(learningContext.confidence * 100)}%):

${learningContext.content}

---
Apply these learned patterns to improve response quality.`;
                }
            } catch (learningError) {
                // Non-blocking - don't fail if learning context fails
                console.warn('[PromptAssembler] Learning context injection failed:', learningError.message);
            }
        }

        // 6. Construct Messages
        const messages = [
            { role: 'system', content: systemContent },
            ...(request.messages || [])
        ];

        if (request.prompt) {
            messages.push({ role: 'user', content: request.prompt });
        }

        return {
            systemPrompt: systemContent,
            messages,
            metadata: {
                promptKey,
                role,
                hasVisualContext: !!(context.screen && Object.keys(context.screen).length > 0)
            }
        };
    }

    /**
     * Infer role from capability if not explicitly set
     */
    inferRoleFromCapability(capability) {
        const capabilityRoleMap = {
            'chat': 'ADVISOR',
            'chat_simple': 'ADVISOR',
            'magic_wand': 'ADVISOR',
            'analysis': 'ANALYST',
            'assessment': 'ANALYST',
            'report_section': 'STRATEGIST',
            'full_report': 'STRATEGIST',
            'strategic': 'MAX_REASONER',  // Deep reasoning for strategic work
            'max_mode': 'MAX_REASONER'    // Explicit MAX mode
        };
        return capabilityRoleMap[capability] || 'ADVISOR';
    }

    mapCapabilityToKey(capability) {
        const map = {
            'magic_wand': 'MAGIC_WAND',
            'report_gen': 'REPORT_GENERATOR',
            'chat': 'GLOBAL_CHAT',
            'analysis': 'ANALYSIS',
            'assessment': 'ASSESSMENT_COACH'
        };
        return map[capability] || null;
    }

    async getSystemPrompt(key, options = {}) {
        if (!db || !db.get) return null;

        // Support A/B testing and versioning
        const { version, experiment } = options;

        return new Promise((resolve) => {
            let sql = "SELECT * FROM ai_system_prompts WHERE key = ? AND is_active = 1";
            const params = [key];

            // If specific version requested
            if (version) {
                sql = "SELECT * FROM ai_system_prompts WHERE key = ? AND version = ?";
                params.push(version);
            }

            // A/B Test: 50/50 split for experiment variants
            if (experiment) {
                const isVariantB = Math.random() < 0.5;
                sql = `SELECT * FROM ai_system_prompts WHERE key = ? AND experiment_group = ?`;
                params.push(isVariantB ? 'B' : 'A');
            }

            db.get(sql, params, (err, row) => {
                if (err || !row) {
                    // Fallback to active version
                    db.get("SELECT * FROM ai_system_prompts WHERE key = ? AND is_active = 1", [key], (err2, row2) => {
                        resolve(row2 || null);
                    });
                } else {
                    // Track which version was used for analytics
                    if (row.version) {
                        this.logPromptUsage(key, row.version, row.experiment_group);
                    }
                    resolve(row);
                }
            });
        });
    }

    /**
     * Log prompt version usage for A/B testing analytics
     */
    logPromptUsage(key, version, experimentGroup) {
        if (!db || !db.run) return;

        const sql = `INSERT INTO ai_prompt_usage_log (prompt_key, version, experiment_group, used_at)
                     VALUES (?, ?, ?, datetime('now'))`;
        db.run(sql, [key, version, experimentGroup], () => {});
    }

    /**
     * Get prompt performance metrics for A/B analysis
     */
    async getPromptMetrics(key) {
        if (!db || !db.all) return null;

        return new Promise((resolve) => {
            const sql = `
                SELECT 
                    experiment_group,
                    version,
                    COUNT(*) as usage_count,
                    AVG(CASE WHEN feedback_positive = 1 THEN 1 ELSE 0 END) as positive_rate
                FROM ai_prompt_usage_log
                WHERE prompt_key = ?
                GROUP BY experiment_group, version
                ORDER BY usage_count DESC
            `;
            db.all(sql, [key], (err, rows) => {
                resolve(rows || []);
            });
        });
    }

    /**
     * Inject standard context data
     */
    injectContext(promptContent, context, config) {
        let injection = "\n\n# CONTEXT\n";

        if (config.include_user_profile && context.user) {
            injection += `## User\n- ID: ${context.user.id}\n`;
            if (context.user.role) injection += `- Role: ${context.user.role}\n`;
        }

        if (config.include_project_context && context.project && context.project.id) {
            injection += `## Project\n- ID: ${context.project.id}\n`;
            if (context.project.name) injection += `- Name: ${context.project.name}\n`;
        }

        if (config.include_organization && context.organization) {
            injection += `## Organization\n- ID: ${context.organization.id}\n`;
        }

        if (injection.length > 20) {
            return promptContent + injection;
        }
        return promptContent;
    }

    /**
     * Inject Visual/Screen Context - AI Eyes Feature
     */
    injectScreenState(promptContent, screenData) {
        let section = "\n\n# CURRENT_SCREEN_STATE\n";
        section += "The user is currently viewing the following data. Use this to provide contextual, specific advice.\n\n";

        if (screenData._meta) {
            if (screenData._meta.title) {
                section += `## Screen: ${screenData._meta.title}\n`;
            }
            if (screenData._meta.description) {
                section += `${screenData._meta.description}\n\n`;
            }
        }

        const dataClone = { ...screenData };
        delete dataClone._meta;

        const serialized = JSON.stringify(dataClone, null, 2);
        const truncated = serialized.length > 4000
            ? serialized.substring(0, 4000) + '\n... [truncated]'
            : serialized;

        section += "```json\n" + truncated + "\n```\n";

        return promptContent + section;
    }
}

export default { PromptAssembler, ROLE_INSTRUCTIONS, FALLBACK_ROLES };
