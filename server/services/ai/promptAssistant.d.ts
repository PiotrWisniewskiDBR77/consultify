export class PromptAssistantService {
    conversationHistory: Map<any, any>;
    analysisCache: Map<any, any>;
    /**
     * Process a message from the user about prompt engineering
     */
    processMessage(message: any, userId: any, options?: {}): Promise<{
        message: any;
        conversationId: any;
        suggestions: {
            title: string;
            description: string;
        }[];
        codeBlocks: {
            language: string;
            content: string;
        }[];
    }>;
    /**
     * Build context for the assistant based on current editing state
     */
    buildAssistantContext(options: any): Promise<string>;
    /**
     * Analyze a prompt for issues and improvements
     */
    analyzePrompt(promptContent: any, options?: {}): Promise<any>;
    /**
     * Get AI-generated suggestions for prompt improvement
     */
    getAISuggestions(promptContent: any, currentAnalysis: any): Promise<any>;
    /**
     * Suggest blocks for a specific need/capability
     */
    suggestBlocks(requirement: any, options?: {}): Promise<{
        code: string;
        name: any;
        category: any;
        score: number;
        reason: string;
    }[]>;
    /**
     * Test a prompt template with sample input in multiple languages
     */
    testPrompt(templateCode: any, sampleInput: any, languages?: string[]): Promise<{
        templateCode: any;
        sampleInput: any;
        results: ({
            language: string;
            success: boolean;
            expectedLanguage: string;
            detectedLanguage: string;
            languageMatch: boolean;
            response: any;
            tokenCount: number;
            assemblyTime: number;
            error?: undefined;
        } | {
            language: string;
            success: boolean;
            error: any;
            expectedLanguage?: undefined;
            detectedLanguage?: undefined;
            languageMatch?: undefined;
            response?: undefined;
            tokenCount?: undefined;
            assemblyTime?: undefined;
        })[];
        summary: {
            tested: number;
            passed: number;
            languageAccuracy: number;
        };
    }>;
    /**
     * Simple language detection for response validation
     */
    detectResponseLanguage(text: any): string;
    /**
     * Generate an improved version of a prompt
     */
    improvePrompt(promptContent: any, focusArea?: string): Promise<{
        original: any;
        improved: any;
        analysis: any;
        focusArea: string;
    }>;
    /**
     * Extract suggestions from assistant message
     */
    extractSuggestions(message: any): {
        title: string;
        description: string;
    }[];
    /**
     * Extract code blocks from assistant message
     */
    extractCodeBlocks(message: any): {
        language: string;
        content: string;
    }[];
    /**
     * Record feedback for prompt improvement
     */
    recordFeedback(templateId: any, feedback: any): Promise<any>;
    /**
     * Clear conversation history for a user
     */
    clearHistory(userId: any, conversationId: any): void;
}
export const promptAssistant: PromptAssistantService;
export const PROMPT_ENGINEERING_KNOWLEDGE: "\n# PROMPT ENGINEERING BEST PRACTICES\n\n## 1. Structure Principles\n- ROLE: Define clear persona with expertise level\n- CONTEXT: Provide relevant background information\n- TASK: Specify exactly what AI should do\n- FORMAT: Define expected output structure\n- CONSTRAINTS: Set boundaries and rules\n\n## 2. Language Independence\n- NEVER hardcode language names (Polish, English, etc.)\n- USE {{user.language}} or {{user.detected_language}} variables\n- SEMANTIC instructions over linguistic (\"be professional\" not \"write formally in Polish\")\n- CULTURAL adaptation via language detection\n\n## 3. Variable Best Practices\n- DECLARE all used variables in variableSchema\n- USE descriptive variable names (context.project.name not pn)\n- PROVIDE defaults for optional variables\n- VALIDATE required variables are available in context\n\n## 4. Block Composition\n- COMBINE blocks from different categories for complete prompts\n- ORDER: ROLE \u2192 BEHAVIOR \u2192 CONTEXT \u2192 TASK \u2192 OUTPUT \u2192 CONSTRAINT\n- MINIMUM: One ROLE + One OUTPUT + LANGUAGE_ADAPTIVE behavior\n- AVOID redundant blocks that say the same thing\n\n## 5. Anti-Patterns to Avoid\n- Hardcoded language names or translations\n- Overly long instructions (aim for concise)\n- Conflicting behaviors (e.g., CONCISE + DETAILED)\n- Missing language adaptation block\n- Undefined variables in templates\n- Too many constraints that limit usefulness\n\n## 6. Testing Checklist\n- Test in all 6 supported languages\n- Verify variable resolution\n- Check token count (aim for <1000 tokens system prompt)\n- Validate output format compliance\n- Ensure tone consistency\n";
export const ASSISTANT_SYSTEM_PROMPT: "\n# ROLE: Prompt Engineering Expert\n\nYou are a Prompt Engineering Expert for the Consultify platform - a PMO/Digital Transformation tool.\nYour job is to help SuperAdmins create effective, language-independent AI instructions.\n\n## YOUR KNOWLEDGE:\n1. Consultify Application Architecture\n   - 6 supported languages: EN, PL, DE, ES, JA, AR\n   - PMO/Digital Transformation domain\n   - Executive user personas (CEO, CTO, PMO leads)\n   - Key capabilities: Assessment, Initiatives, Roadmap, Reports\n\n2. Prompt Engineering Principles\n   - Semantic instructions over linguistic\n   - Variable-driven templates with {{variable}} syntax\n   - Block composition from reusable components\n   - A/B testing insights and continuous improvement\n\n3. Platform Capabilities\n   Available block categories:\n   - ROLE: AI personas (STRATEGIC_CONSULTANT, DATA_ANALYST, PMO_ARCHITECT, MENTOR)\n   - BEHAVIOR: Communication styles (LANGUAGE_ADAPTIVE, PROFESSIONAL, CHALLENGING, DATA_DRIVEN)\n   - OUTPUT: Response formats (EXECUTIVE_SUMMARY, DETAILED_ANALYSIS, QUICK_ANSWER, ACTION_PLAN)\n   - CONSTRAINT: Rules (NO_HALLUCINATION, CONTEXT_ONLY, GOVERNANCE_COMPLIANT)\n   - CONTEXT: Data injection (PROJECT_DATA, USER_PROFILE, SCREEN_STATE)\n\n## YOUR TASKS:\n1. ANALYZE prompts for effectiveness and issues\n2. SUGGEST language-agnostic improvements\n3. RECOMMEND appropriate blocks for specific needs\n4. TEST prompts mentally and predict outcomes\n5. WARN about anti-patterns and bad practices\n\n## RULES:\n- NEVER suggest hardcoded language in prompts\n- ALWAYS recommend {{user.language}} or BEHAVIOR.LANGUAGE_ADAPTIVE for language handling\n- PREFER semantic instructions over linguistic ones\n- CONSIDER all 6+ languages when reviewing\n- BE SPECIFIC with suggestions - show exact code/text changes\n- EXPLAIN reasoning behind recommendations\n\n\n# PROMPT ENGINEERING BEST PRACTICES\n\n## 1. Structure Principles\n- ROLE: Define clear persona with expertise level\n- CONTEXT: Provide relevant background information\n- TASK: Specify exactly what AI should do\n- FORMAT: Define expected output structure\n- CONSTRAINTS: Set boundaries and rules\n\n## 2. Language Independence\n- NEVER hardcode language names (Polish, English, etc.)\n- USE {{user.language}} or {{user.detected_language}} variables\n- SEMANTIC instructions over linguistic (\"be professional\" not \"write formally in Polish\")\n- CULTURAL adaptation via language detection\n\n## 3. Variable Best Practices\n- DECLARE all used variables in variableSchema\n- USE descriptive variable names (context.project.name not pn)\n- PROVIDE defaults for optional variables\n- VALIDATE required variables are available in context\n\n## 4. Block Composition\n- COMBINE blocks from different categories for complete prompts\n- ORDER: ROLE → BEHAVIOR → CONTEXT → TASK → OUTPUT → CONSTRAINT\n- MINIMUM: One ROLE + One OUTPUT + LANGUAGE_ADAPTIVE behavior\n- AVOID redundant blocks that say the same thing\n\n## 5. Anti-Patterns to Avoid\n- Hardcoded language names or translations\n- Overly long instructions (aim for concise)\n- Conflicting behaviors (e.g., CONCISE + DETAILED)\n- Missing language adaptation block\n- Undefined variables in templates\n- Too many constraints that limit usefulness\n\n## 6. Testing Checklist\n- Test in all 6 supported languages\n- Verify variable resolution\n- Check token count (aim for <1000 tokens system prompt)\n- Validate output format compliance\n- Ensure tone consistency\n\n";
//# sourceMappingURL=promptAssistant.d.ts.map