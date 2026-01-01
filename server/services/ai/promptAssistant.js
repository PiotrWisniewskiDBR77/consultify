/**
 * Prompt Assistant Service
 * 
 * AI-powered assistant for helping SuperAdmins create and optimize
 * language-independent prompt templates.
 * 
 * Features:
 * - Analyze existing prompts for effectiveness
 * - Suggest improvements and best practices
 * - Test prompts across multiple languages
 * - Recommend appropriate blocks
 * - Provide prompt engineering guidance
 */

const db = require('../../database');
const { v4: uuidv4 } = require('uuid');
const { llmService } = require('./llmService');
const { promptTemplateService } = require('./promptTemplateService');
const { promptBlockLibrary, BLOCK_CATEGORIES } = require('./promptBlockLibrary');
const { variableResolver } = require('./variableResolver');

// ============================================================================
// Prompt Engineering Knowledge Base
// ============================================================================

const PROMPT_ENGINEERING_KNOWLEDGE = `
# PROMPT ENGINEERING BEST PRACTICES

## 1. Structure Principles
- ROLE: Define clear persona with expertise level
- CONTEXT: Provide relevant background information
- TASK: Specify exactly what AI should do
- FORMAT: Define expected output structure
- CONSTRAINTS: Set boundaries and rules

## 2. Language Independence
- NEVER hardcode language names (Polish, English, etc.)
- USE {{user.language}} or {{user.detected_language}} variables
- SEMANTIC instructions over linguistic ("be professional" not "write formally in Polish")
- CULTURAL adaptation via language detection

## 3. Variable Best Practices
- DECLARE all used variables in variableSchema
- USE descriptive variable names (context.project.name not pn)
- PROVIDE defaults for optional variables
- VALIDATE required variables are available in context

## 4. Block Composition
- COMBINE blocks from different categories for complete prompts
- ORDER: ROLE → BEHAVIOR → CONTEXT → TASK → OUTPUT → CONSTRAINT
- MINIMUM: One ROLE + One OUTPUT + LANGUAGE_ADAPTIVE behavior
- AVOID redundant blocks that say the same thing

## 5. Anti-Patterns to Avoid
- Hardcoded language names or translations
- Overly long instructions (aim for concise)
- Conflicting behaviors (e.g., CONCISE + DETAILED)
- Missing language adaptation block
- Undefined variables in templates
- Too many constraints that limit usefulness

## 6. Testing Checklist
- Test in all 6 supported languages
- Verify variable resolution
- Check token count (aim for <1000 tokens system prompt)
- Validate output format compliance
- Ensure tone consistency
`;

const ASSISTANT_SYSTEM_PROMPT = `
# ROLE: Prompt Engineering Expert

You are a Prompt Engineering Expert for the Consultify platform - a PMO/Digital Transformation tool.
Your job is to help SuperAdmins create effective, language-independent AI instructions.

## YOUR KNOWLEDGE:
1. Consultify Application Architecture
   - 6 supported languages: EN, PL, DE, ES, JA, AR
   - PMO/Digital Transformation domain
   - Executive user personas (CEO, CTO, PMO leads)
   - Key capabilities: Assessment, Initiatives, Roadmap, Reports

2. Prompt Engineering Principles
   - Semantic instructions over linguistic
   - Variable-driven templates with {{variable}} syntax
   - Block composition from reusable components
   - A/B testing insights and continuous improvement

3. Platform Capabilities
   Available block categories:
   - ROLE: AI personas (STRATEGIC_CONSULTANT, DATA_ANALYST, PMO_ARCHITECT, MENTOR)
   - BEHAVIOR: Communication styles (LANGUAGE_ADAPTIVE, PROFESSIONAL, CHALLENGING, DATA_DRIVEN)
   - OUTPUT: Response formats (EXECUTIVE_SUMMARY, DETAILED_ANALYSIS, QUICK_ANSWER, ACTION_PLAN)
   - CONSTRAINT: Rules (NO_HALLUCINATION, CONTEXT_ONLY, GOVERNANCE_COMPLIANT)
   - CONTEXT: Data injection (PROJECT_DATA, USER_PROFILE, SCREEN_STATE)

## YOUR TASKS:
1. ANALYZE prompts for effectiveness and issues
2. SUGGEST language-agnostic improvements
3. RECOMMEND appropriate blocks for specific needs
4. TEST prompts mentally and predict outcomes
5. WARN about anti-patterns and bad practices

## RULES:
- NEVER suggest hardcoded language in prompts
- ALWAYS recommend {{user.language}} or BEHAVIOR.LANGUAGE_ADAPTIVE for language handling
- PREFER semantic instructions over linguistic ones
- CONSIDER all 6+ languages when reviewing
- BE SPECIFIC with suggestions - show exact code/text changes
- EXPLAIN reasoning behind recommendations

${PROMPT_ENGINEERING_KNOWLEDGE}
`;

// ============================================================================
// Prompt Assistant Service Class
// ============================================================================

class PromptAssistantService {
    constructor() {
        this.conversationHistory = new Map(); // userId -> messages[]
        this.analysisCache = new Map();
    }

    /**
     * Process a message from the user about prompt engineering
     */
    async processMessage(message, userId, options = {}) {
        const { promptId, promptContent, templateCode, conversationId } = options;

        // Build context for the assistant
        const context = await this.buildAssistantContext(options);

        // Get conversation history
        const historyKey = conversationId || `${userId}_default`;
        const history = this.conversationHistory.get(historyKey) || [];

        // Build messages for LLM
        const messages = [
            { role: 'system', content: ASSISTANT_SYSTEM_PROMPT + '\n\n' + context },
            ...history,
            { role: 'user', content: message }
        ];

        try {
            // Call LLM
            const response = await llmService.chat({
                messages,
                temperature: 0.7,
                maxTokens: 2000
            });

            const assistantMessage = response.content || response.message?.content || '';

            // Update history
            history.push({ role: 'user', content: message });
            history.push({ role: 'assistant', content: assistantMessage });
            
            // Keep last 10 exchanges
            if (history.length > 20) {
                history.splice(0, history.length - 20);
            }
            this.conversationHistory.set(historyKey, history);

            return {
                message: assistantMessage,
                conversationId: historyKey,
                suggestions: this.extractSuggestions(assistantMessage),
                codeBlocks: this.extractCodeBlocks(assistantMessage)
            };
        } catch (error) {
            console.error('[PromptAssistant] Error processing message:', error);
            throw error;
        }
    }

    /**
     * Build context for the assistant based on current editing state
     */
    async buildAssistantContext(options) {
        const { promptId, promptContent, templateCode } = options;
        const contextParts = [];

        // Add current prompt content if editing
        if (promptContent) {
            contextParts.push(`
## CURRENT PROMPT BEING EDITED:
\`\`\`
${promptContent}
\`\`\`
`);
        }

        // Add template info if working with a template
        if (templateCode) {
            try {
                const template = await promptTemplateService.getTemplate(templateCode);
                if (template) {
                    contextParts.push(`
## CURRENT TEMPLATE: ${templateCode}
Name: ${template.name}
Category: ${template.category}
Blocks: ${template.blocks.join(', ')}
`);
                }
            } catch (e) {
                console.warn('[PromptAssistant] Could not load template:', e.message);
            }
        }

        // Add available blocks summary
        const allBlocks = await promptBlockLibrary.getAllBlocks();
        const blockSummary = Object.entries(allBlocks)
            .map(([code, b]) => `- ${code}: ${b.name}`)
            .join('\n');
        
        contextParts.push(`
## AVAILABLE BLOCKS:
${blockSummary}
`);

        // Add available variables summary
        const variables = await variableResolver.getAvailableVariables();
        const varSummary = variables
            .slice(0, 20)
            .map(v => `- {{${v.code}}}: ${v.description || 'No description'}`)
            .join('\n');
        
        contextParts.push(`
## AVAILABLE VARIABLES (sample):
${varSummary}
`);

        return contextParts.join('\n');
    }

    /**
     * Analyze a prompt for issues and improvements
     */
    async analyzePrompt(promptContent, options = {}) {
        const { capability, templateCode } = options;

        // Check cache
        const cacheKey = `analysis_${Buffer.from(promptContent).toString('base64').slice(0, 32)}`;
        const cached = this.analysisCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < 60000) {
            return cached.data;
        }

        const analysis = {
            issues: [],
            suggestions: [],
            score: 100,
            languageIndependence: true,
            variableUsage: { used: [], missing: [], undefined: [] },
            blockCoverage: { present: [], missing: [] }
        };

        // 1. Check for hardcoded language references
        const languagePatterns = [
            { pattern: /\b(polish|english|german|spanish|japanese|arabic)\b/gi, issue: 'Hardcoded language name' },
            { pattern: /\b(po polsku|in english|auf deutsch|en español)\b/gi, issue: 'Hardcoded language instruction' },
            { pattern: /\b(answer|respond|reply|write)\s+in\s+(polish|english|german)/gi, issue: 'Hardcoded language directive' },
            { pattern: /\b(polski|angielski|niemiecki|hiszpański)\b/gi, issue: 'Non-English language name' }
        ];

        for (const { pattern, issue } of languagePatterns) {
            const matches = promptContent.match(pattern);
            if (matches) {
                analysis.issues.push({
                    severity: 'error',
                    type: 'language_hardcoded',
                    message: `${issue} found: "${matches[0]}"`,
                    suggestion: 'Use {{user.language}} variable or BEHAVIOR.LANGUAGE_ADAPTIVE block instead'
                });
                analysis.languageIndependence = false;
                analysis.score -= 20;
            }
        }

        // 2. Check variable usage
        const variablePattern = /\{\{([^}]+)\}\}/g;
        const usedVariables = [];
        let match;
        while ((match = variablePattern.exec(promptContent)) !== null) {
            usedVariables.push(match[1].trim());
        }
        analysis.variableUsage.used = usedVariables;

        // Check if variables are defined
        for (const varCode of usedVariables) {
            const varDef = await variableResolver.getVariableDefinition(varCode);
            if (!varDef) {
                analysis.variableUsage.undefined.push(varCode);
                analysis.issues.push({
                    severity: 'warning',
                    type: 'undefined_variable',
                    message: `Variable {{${varCode}}} is not defined in the system`,
                    suggestion: 'Register this variable or use an existing one'
                });
                analysis.score -= 5;
            }
        }

        // 3. Check prompt length
        if (promptContent.length > 3000) {
            analysis.issues.push({
                severity: 'warning',
                type: 'too_long',
                message: `Prompt is ${promptContent.length} characters (recommended: <3000)`,
                suggestion: 'Consider breaking into smaller blocks or removing redundant instructions'
            });
            analysis.score -= 10;
        }

        // 4. Check for recommended sections
        const sections = ['ROLE', 'PERSONA', 'BEHAVIOR', 'OUTPUT', 'FORMAT', 'CONSTRAINT', 'RULE'];
        const foundSections = sections.filter(s => 
            promptContent.toUpperCase().includes(s)
        );
        
        if (foundSections.length < 3) {
            analysis.suggestions.push({
                type: 'structure',
                message: 'Consider adding more structured sections (ROLE, BEHAVIOR, OUTPUT, CONSTRAINT)',
                priority: 'medium'
            });
        }

        // 5. Check for language adaptation
        const hasLanguageAdaptation = 
            promptContent.includes('{{user.language}}') ||
            promptContent.includes('{{user.detected_language}}') ||
            promptContent.includes('LANGUAGE_ADAPTIVE') ||
            promptContent.toLowerCase().includes('detect') && promptContent.toLowerCase().includes('language');
        
        if (!hasLanguageAdaptation) {
            analysis.issues.push({
                severity: 'warning',
                type: 'no_language_handling',
                message: 'No language adaptation mechanism found',
                suggestion: 'Add BEHAVIOR.LANGUAGE_ADAPTIVE block or {{user.detected_language}} variable'
            });
            analysis.score -= 15;
        }

        // 6. Generate improvement suggestions using AI
        if (analysis.score < 80 || analysis.issues.length > 0) {
            try {
                const aiSuggestions = await this.getAISuggestions(promptContent, analysis);
                analysis.suggestions.push(...aiSuggestions);
            } catch (e) {
                console.warn('[PromptAssistant] Could not generate AI suggestions:', e.message);
            }
        }

        // Cache result
        this.analysisCache.set(cacheKey, { data: analysis, timestamp: Date.now() });

        return analysis;
    }

    /**
     * Get AI-generated suggestions for prompt improvement
     */
    async getAISuggestions(promptContent, currentAnalysis) {
        const prompt = `Analyze this prompt and provide 2-3 specific improvement suggestions:

PROMPT:
${promptContent}

CURRENT ISSUES:
${currentAnalysis.issues.map(i => `- ${i.message}`).join('\n')}

Provide suggestions in JSON format:
[{"type": "...", "message": "...", "priority": "high|medium|low", "example": "..."}]`;

        try {
            const response = await llmService.chat({
                messages: [
                    { role: 'system', content: 'You are a prompt engineering expert. Respond only with valid JSON array.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.5,
                maxTokens: 500
            });

            const content = response.content || response.message?.content || '[]';
            const jsonMatch = content.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }
        } catch (e) {
            console.warn('[PromptAssistant] AI suggestion error:', e.message);
        }

        return [];
    }

    /**
     * Suggest blocks for a specific need/capability
     */
    async suggestBlocks(requirement, options = {}) {
        const { category, currentBlocks = [] } = options;

        const allBlocks = await promptBlockLibrary.getAllBlocks();
        const suggestions = [];

        // Filter by category if specified
        let candidateBlocks = Object.entries(allBlocks);
        if (category) {
            candidateBlocks = candidateBlocks.filter(([_, b]) => b.category === category);
        }

        // Score blocks based on requirement match
        const requirementLower = requirement.toLowerCase();
        const keywords = requirementLower.split(/\s+/);

        for (const [code, block] of candidateBlocks) {
            if (currentBlocks.includes(code)) continue; // Skip already used

            let score = 0;
            const blockText = `${block.name} ${block.semantic}`.toLowerCase();

            for (const keyword of keywords) {
                if (blockText.includes(keyword)) {
                    score += 10;
                }
            }

            // Boost commonly used blocks
            score += (block.usageCount || 0) / 10;

            if (score > 5) {
                suggestions.push({
                    code,
                    name: block.name,
                    category: block.category,
                    score,
                    reason: `Matches keywords: ${keywords.filter(k => blockText.includes(k)).join(', ')}`
                });
            }
        }

        // Sort by score and limit
        suggestions.sort((a, b) => b.score - a.score);
        return suggestions.slice(0, 5);
    }

    /**
     * Test a prompt template with sample input in multiple languages
     */
    async testPrompt(templateCode, sampleInput, languages = ['en', 'pl', 'de']) {
        const results = [];

        for (const lang of languages) {
            const testContext = {
                user: { firstName: 'Test', role: 'admin', language: lang },
                organization: { name: 'Test Corp' },
                project: { name: 'Test Project', phase: 'assessment' },
                lastUserMessage: sampleInput
            };

            try {
                // Assemble prompt
                const assembled = await promptTemplateService.assemblePrompt(templateCode, testContext);

                // Generate response
                const response = await llmService.chat({
                    messages: [
                        { role: 'system', content: assembled.prompt },
                        { role: 'user', content: sampleInput }
                    ],
                    temperature: 0.7,
                    maxTokens: 500
                });

                const responseText = response.content || response.message?.content || '';

                // Detect response language
                const detectedLang = this.detectResponseLanguage(responseText);

                results.push({
                    language: lang,
                    success: true,
                    expectedLanguage: lang,
                    detectedLanguage: detectedLang,
                    languageMatch: detectedLang === lang,
                    response: responseText.slice(0, 500),
                    tokenCount: assembled.metadata.characterCount / 4, // Rough estimate
                    assemblyTime: 0
                });
            } catch (error) {
                results.push({
                    language: lang,
                    success: false,
                    error: error.message
                });
            }
        }

        return {
            templateCode,
            sampleInput,
            results,
            summary: {
                tested: results.length,
                passed: results.filter(r => r.success && r.languageMatch).length,
                languageAccuracy: results.filter(r => r.languageMatch).length / results.length
            }
        };
    }

    /**
     * Simple language detection for response validation
     */
    detectResponseLanguage(text) {
        if (!text) return 'unknown';

        const patterns = {
            ja: /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/,
            ar: /[\u0600-\u06FF]/,
            pl: /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/,
            de: /[äöüßÄÖÜ]|\b(und|der|die|das|ist)\b/,
            es: /[áéíóúñ¿¡]|\b(el|la|los|las|es|que)\b/
        };

        for (const [lang, pattern] of Object.entries(patterns)) {
            if (pattern.test(text)) {
                return lang;
            }
        }

        return 'en'; // Default to English
    }

    /**
     * Generate an improved version of a prompt
     */
    async improvePrompt(promptContent, focusArea = 'general') {
        const analysis = await this.analyzePrompt(promptContent);

        const focusInstructions = {
            general: 'Improve overall quality and effectiveness',
            language: 'Focus on making the prompt language-independent',
            structure: 'Focus on improving organization and clarity',
            brevity: 'Focus on making the prompt more concise',
            specificity: 'Focus on making instructions more specific'
        };

        const prompt = `
Improve this prompt based on the analysis.
Focus: ${focusInstructions[focusArea] || focusInstructions.general}

ORIGINAL PROMPT:
${promptContent}

ANALYSIS ISSUES:
${analysis.issues.map(i => `- ${i.severity}: ${i.message}`).join('\n')}

REQUIREMENTS:
1. Make it language-independent (use {{user.language}} or {{user.detected_language}})
2. Keep semantic instructions, not linguistic ones
3. Maintain the original intent
4. Use proper section headers

Return ONLY the improved prompt, no explanations.
`;

        try {
            const response = await llmService.chat({
                messages: [
                    { role: 'system', content: 'You are a prompt engineering expert. Return only the improved prompt.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.5,
                maxTokens: 2000
            });

            const improved = response.content || response.message?.content || '';

            return {
                original: promptContent,
                improved: improved.trim(),
                analysis,
                focusArea
            };
        } catch (error) {
            console.error('[PromptAssistant] Error improving prompt:', error);
            throw error;
        }
    }

    /**
     * Extract suggestions from assistant message
     */
    extractSuggestions(message) {
        const suggestions = [];
        
        // Look for numbered suggestions
        const numberedPattern = /\d+\.\s*\*\*([^*]+)\*\*:?\s*([^\n]+)/g;
        let match;
        while ((match = numberedPattern.exec(message)) !== null) {
            suggestions.push({
                title: match[1].trim(),
                description: match[2].trim()
            });
        }

        // Look for bullet suggestions
        const bulletPattern = /[-•]\s*\*\*([^*]+)\*\*:?\s*([^\n]+)/g;
        while ((match = bulletPattern.exec(message)) !== null) {
            suggestions.push({
                title: match[1].trim(),
                description: match[2].trim()
            });
        }

        return suggestions;
    }

    /**
     * Extract code blocks from assistant message
     */
    extractCodeBlocks(message) {
        const codeBlocks = [];
        const codePattern = /```(\w+)?\n([\s\S]*?)```/g;
        let match;

        while ((match = codePattern.exec(message)) !== null) {
            codeBlocks.push({
                language: match[1] || 'text',
                content: match[2].trim()
            });
        }

        return codeBlocks;
    }

    /**
     * Record feedback for prompt improvement
     */
    async recordFeedback(templateId, feedback) {
        const { rating, feedbackType, feedbackText, inputSample, outputSample, userLanguage } = feedback;

        return new Promise((resolve, reject) => {
            if (!db || !db.run) {
                resolve({ success: true, stored: false });
                return;
            }

            db.run(
                `INSERT INTO ai_prompt_feedback 
                 (id, template_id, rating, feedback_type, feedback_text, input_sample, output_sample, user_language, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
                [uuidv4(), templateId, rating, feedbackType, feedbackText, inputSample, outputSample, userLanguage],
                (err) => {
                    if (err) {
                        console.error('[PromptAssistant] Error recording feedback:', err);
                        reject(err);
                    } else {
                        resolve({ success: true, stored: true });
                    }
                }
            );
        });
    }

    /**
     * Clear conversation history for a user
     */
    clearHistory(userId, conversationId) {
        const key = conversationId || `${userId}_default`;
        this.conversationHistory.delete(key);
    }
}

// Singleton instance
const promptAssistant = new PromptAssistantService();

module.exports = {
    PromptAssistantService,
    promptAssistant,
    PROMPT_ENGINEERING_KNOWLEDGE,
    ASSISTANT_SYSTEM_PROMPT
};

