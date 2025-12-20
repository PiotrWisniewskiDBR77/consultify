// AI Orchestrator - Core logic for AI responses
// AI Core Layer — Enterprise PMO Brain

const AIContextBuilder = require('./aiContextBuilder');
const AIPolicyEngine = require('./aiPolicyEngine');
const AIMemoryManager = require('./aiMemoryManager');
const { v4: uuidv4 } = require('uuid');

const AI_ROLES = {
    ADVISOR: 'ADVISOR',
    PMO_MANAGER: 'PMO_MANAGER',
    EXECUTOR: 'EXECUTOR',
    EDUCATOR: 'EDUCATOR'
};

const CHAT_MODES = {
    EXPLAIN: 'EXPLAIN',
    GUIDE: 'GUIDE',
    ANALYZE: 'ANALYZE',
    DO: 'DO',
    TEACH: 'TEACH'
};

const AIOrchestrator = {
    AI_ROLES,
    CHAT_MODES,

    /**
     * Process a chat message
     */
    processMessage: async (message, userId, organizationId, projectId = null, options = {}) => {
        // 1. Build context
        const context = await AIContextBuilder.buildContext(userId, organizationId, projectId, options);

        // 2. Get policy
        const policy = await AIPolicyEngine.getEffectivePolicy(organizationId, projectId, userId);

        // 3. Get user preferences
        const preferences = await AIMemoryManager.getUserPreferences(userId);

        // 4. Determine intent and role
        const intent = AIOrchestrator._detectIntent(message);
        const role = AIOrchestrator._selectRole(intent, policy);

        // 5. Get project memory for context
        let projectMemory = null;
        if (projectId) {
            projectMemory = await AIMemoryManager.buildProjectMemorySummary(projectId);
        }

        // 6. Build response context
        const responseContext = {
            id: uuidv4(),
            role,
            intent,
            context,
            policy,
            preferences,
            projectMemory,
            dataSources: AIOrchestrator._identifyDataSources(context),
            confidenceLevel: null // Will be set by actual AI response
        };

        // 7. Generate response prompt (for LLM)
        const prompt = AIOrchestrator._buildPrompt(message, responseContext);

        return {
            responseContext,
            prompt,
            policyAllows: true,
            role,
            intent,
            contextSummary: AIOrchestrator._summarizeContext(context)
        };
    },

    /**
     * Detect user intent from message
     */
    _detectIntent: (message) => {
        const lower = message.toLowerCase();

        if (lower.includes('wyjaśnij') || lower.includes('explain') || lower.includes('what is') ||
            lower.includes('co to') || lower.includes('čo je')) {
            return CHAT_MODES.EXPLAIN;
        }
        if (lower.includes('co powinienem') || lower.includes('what should') || lower.includes('next step') ||
            lower.includes('następny krok') || lower.includes('guide')) {
            return CHAT_MODES.GUIDE;
        }
        if (lower.includes('ryzyko') || lower.includes('risk') || lower.includes('analyze') ||
            lower.includes('analiz') || lower.includes('problem')) {
            return CHAT_MODES.ANALYZE;
        }
        if (lower.includes('przygotuj') || lower.includes('create') || lower.includes('draft') ||
            lower.includes('stwórz') || lower.includes('zrób')) {
            return CHAT_MODES.DO;
        }
        if (lower.includes('dlaczego') || lower.includes('why') || lower.includes('teach') ||
            lower.includes('naucz') || lower.includes('explain why')) {
            return CHAT_MODES.TEACH;
        }

        return CHAT_MODES.EXPLAIN; // Default
    },

    /**
     * Select appropriate AI role based on intent and policy
     */
    _selectRole: (intent, policy) => {
        const roleMap = {
            [CHAT_MODES.EXPLAIN]: AI_ROLES.ADVISOR,
            [CHAT_MODES.GUIDE]: AI_ROLES.PMO_MANAGER,
            [CHAT_MODES.ANALYZE]: AI_ROLES.PMO_MANAGER,
            [CHAT_MODES.DO]: AI_ROLES.EXECUTOR,
            [CHAT_MODES.TEACH]: AI_ROLES.EDUCATOR
        };

        const selectedRole = roleMap[intent] || AI_ROLES.ADVISOR;

        // Check if role is active in policy
        if (!policy.activeRoles.includes(selectedRole)) {
            return AI_ROLES.ADVISOR; // Fallback to advisor
        }

        return selectedRole;
    },

    /**
     * Build prompt for LLM
     */
    _buildPrompt: (userMessage, responseContext) => {
        const { role, context, projectMemory, preferences } = responseContext;

        let systemPrompt = `You are an AI ${role} for an Enterprise Strategic Change Management System (SCMS).

CURRENT CONTEXT:
- User Role: ${context.platform.role}
- Organization: ${context.organization.organizationName}
- Active Projects: ${context.organization.activeProjectCount}`;

        if (context.project) {
            systemPrompt += `
- Current Project: ${context.project.projectName}
- Current Phase: ${context.project.currentPhase} (Phase ${context.project.phaseNumber}/6)
- Initiatives: ${context.project.completedInitiatives}/${context.project.initiativeCount} completed`;
        }

        if (context.execution.userTasks.length > 0) {
            systemPrompt += `
- User has ${context.execution.userTasks.length} active task(s)`;
        }

        if (context.execution.pendingDecisions.length > 0) {
            systemPrompt += `
- ${context.execution.pendingDecisions.length} decision(s) awaiting user`;
        }

        if (context.execution.blockers.length > 0) {
            systemPrompt += `
- ${context.execution.blockers.length} blocker(s) detected`;
        }

        if (projectMemory && projectMemory.memoryCount > 0) {
            systemPrompt += `

PROJECT HISTORY:
- ${projectMemory.majorDecisions.length} major decision(s) recorded
- ${projectMemory.phaseTransitions.length} phase transition(s)`;
        }

        // Role-specific instructions
        const roleInstructions = {
            [AI_ROLES.ADVISOR]: 'Provide clear explanations and context. Be helpful but factual.',
            [AI_ROLES.PMO_MANAGER]: 'Monitor execution, identify risks, suggest next steps. Be proactive but respectful.',
            [AI_ROLES.EXECUTOR]: 'Prepare drafts and actionable content. Always mark outputs as drafts requiring approval.',
            [AI_ROLES.EDUCATOR]: 'Explain concepts and best practices. Help user understand WHY, not just WHAT.'
        };

        systemPrompt += `

YOUR ROLE: ${role}
${roleInstructions[role]}

COMMUNICATION STYLE: ${preferences.preferred_tone || 'EXPERT'}
${preferences.education_mode ? 'Education mode is ON - provide learning context.' : ''}

RULES:
1. Always reference the context you're using
2. Never invent data - only use provided context
3. Be transparent about uncertainty
4. Respect governance boundaries
5. State "Based on: ..." before significant statements`;

        // MED-03: External source labeling instruction
        if (context.external && context.external.internetEnabled) {
            systemPrompt += `
6. If using external/internet sources, prefix response with: 🌐 [External sources used]`;
        }

        // MED-02: Memory usage indicator instruction
        if (projectMemory && projectMemory.memoryCount > 0) {
            systemPrompt += `
7. Since you have project memory, prefix response with: 📚 [Using project memory: ${projectMemory.memoryCount} items]`;
        }

        systemPrompt += `

USER MESSAGE: ${userMessage}`;

        return systemPrompt;
    },

    /**
     * Identify data sources used in context
     */
    _identifyDataSources: (context) => {
        const sources = ['Platform Configuration', 'Organization Data'];

        if (context.project) {
            sources.push('Project Data');
            sources.push(`Phase: ${context.project.currentPhase}`);
        }

        if (context.execution.userTasks.length > 0) {
            sources.push('User Tasks');
        }

        if (context.execution.pendingDecisions.length > 0) {
            sources.push('Pending Decisions');
        }

        if (context.knowledge.previousDecisions.length > 0) {
            sources.push('Decision History');
        }

        if (context.external.internetEnabled) {
            sources.push('External Knowledge (if used)');
        }

        return sources;
    },

    /**
     * Summarize context for display
     */
    _summarizeContext: (context) => {
        const parts = [];

        parts.push(`Role: ${context.platform.role}`);
        parts.push(`Org: ${context.organization.organizationName}`);

        if (context.project) {
            parts.push(`Project: ${context.project.projectName} (${context.project.currentPhase})`);
        }

        parts.push(`Tasks: ${context.execution.userTasks.length}`);
        parts.push(`Decisions: ${context.execution.pendingDecisions.length}`);

        return parts.join(' | ');
    },

    /**
     * Get role description
     */
    getRoleDescription: (role) => {
        const descriptions = {
            [AI_ROLES.ADVISOR]: 'Explains and answers questions',
            [AI_ROLES.PMO_MANAGER]: 'Monitors execution, detects risks, suggests next steps',
            [AI_ROLES.EXECUTOR]: 'Creates drafts (requires approval)',
            [AI_ROLES.EDUCATOR]: 'Teaches change management concepts'
        };
        return descriptions[role] || 'AI Assistant';
    }
};

module.exports = AIOrchestrator;
