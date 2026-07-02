// @ts-nocheck
/**
 * AI Orchestrator - Core logic for AI responses
 * AI Core Layer — Enterprise PMO Brain
 */

import { v4 as uuidv4 } from 'uuid';

import logger from '../utils/Logger.js';
import { DEMO_TRIAL_EVENT_TYPES, recordDemoTrialEvent } from './demoTrialTelemetryService.js';
import { appCache } from './redis/CacheService.js';

// ==========================================
// TYPES & CONSTANTS
// ==========================================

export const AIRole = {
  ADVISOR: 'ADVISOR',
  PMO_MANAGER: 'PMO_MANAGER',
  EXECUTOR: 'EXECUTOR',
  EDUCATOR: 'EDUCATOR',
} as const;

export type AIRole = (typeof AIRole)[keyof typeof AIRole];

export const AI_ROLES = {
  ADVISOR: AIRole.ADVISOR,
  PMO_MANAGER: AIRole.PMO_MANAGER,
  EXECUTOR: AIRole.EXECUTOR,
  EDUCATOR: AIRole.EDUCATOR,
};

export const ChatMode = {
  EXPLAIN: 'EXPLAIN',
  GUIDE: 'GUIDE',
  ANALYZE: 'ANALYZE',
  DO: 'DO',
  TEACH: 'TEACH',
} as const;

export type ChatMode = (typeof ChatMode)[keyof typeof ChatMode];

export const CHAT_MODES = {
  EXPLAIN: ChatMode.EXPLAIN,
  GUIDE: ChatMode.GUIDE,
  ANALYZE: ChatMode.ANALYZE,
  DO: ChatMode.DO,
  TEACH: ChatMode.TEACH,
};

export interface AIResponseContext {
  id: string;
  role: AIRole;
  intent: ChatMode;
  context: any;
  policy: any;
  preferences: any;
  projectMemory: any;
  dataSources: string[];
  confidenceLevel: string | null;
  explanation: any;
  aiGovernance: {
    activeRole: string;
    capabilities: string[];
    roleDescription: string;
  };
  accessContext: {
    organizationType: string;
    isDemo: boolean;
    isTrial: boolean;
    isPaid: boolean;
    aiResponseBadge: string;
    dailyAIUsage: any;
  };
  _tokenAnalysis?: any;
}

// ==========================================
// DEPENDENCIES (Lazy Loading)
// ==========================================

let _AIContextBuilder: any = null;
let _AIPolicyEngine: any = null;
let _AIMemoryManager: any = null;
let _AIRoleGuard: any = null;
let _RegulatoryModeGuard: any = null;
let _AIExplainabilityService: any = null;
let _AccessPolicyService: any = null;
let _TokenBillingService: any = null;
let _AIResponsePostProcessor: any = null;
let _AIAgents: any = null;

async function initDeps() {
  if (_AIContextBuilder) return;

  const [
    aiCtx,
    aiPol,
    aiMem,
    aiRoleMod,
    regGuardMod,
    aiExpMod,
    accPolMod,
    tokBillMod,
    postProcMod,
    agentsMod,
  ] = (await Promise.all([
    import('./aiContextBuilder.js'),
    import('./aiPolicyEngine.js'),
    import('./aiMemoryManager.js'),
    import('./aiRoleGuard.js'),
    import('./regulatoryModeGuard.js'),
    import('./aiExplainabilityService.js'),
    import('./accessPolicyService.js'),
    import('./tokenBillingService.js'),
    import('./aiResponsePostProcessor.js'),
    import('./ai/agents/index.js'),
  ])) as any[];

  _AIContextBuilder = aiCtx.default || aiCtx;
  _AIPolicyEngine = aiPol.default || aiPol;
  _AIMemoryManager = aiMem.default || aiMem;
  _AIRoleGuard = aiRoleMod.default || aiRoleMod.AIRoleGuard || aiRoleMod.aiRoleGuard || aiRoleMod;
  _RegulatoryModeGuard =
    regGuardMod.default ||
    regGuardMod.RegulatoryModeGuard ||
    regGuardMod.regulatoryModeGuard ||
    regGuardMod;
  _AIExplainabilityService =
    aiExpMod.default ||
    aiExpMod.AIExplainabilityService ||
    aiExpMod.aiExplainabilityService ||
    aiExpMod;
  _AccessPolicyService =
    accPolMod.default ||
    accPolMod.AccessPolicyService ||
    accPolMod.accessPolicyService ||
    accPolMod;
  _TokenBillingService =
    tokBillMod.default ||
    tokBillMod.TokenBillingService ||
    tokBillMod.tokenBillingService ||
    tokBillMod;
  _AIResponsePostProcessor =
    postProcMod.aiResponsePostProcessor || postProcMod.default || postProcMod;
  _AIAgents = agentsMod.default || agentsMod;
}

// ==========================================
// SERVICE IMPLEMENTATION
// ==========================================

export const AIOrchestrator = {
  AI_ROLES,
  CHAT_MODES,

  _setDependencies: (deps: any) => {
    if (deps.aiContextBuilder) _AIContextBuilder = deps.aiContextBuilder;
    if (deps.aiPolicyEngine) _AIPolicyEngine = deps.aiPolicyEngine;
    if (deps.aiMemoryManager) _AIMemoryManager = deps.aiMemoryManager;
    if (deps.aiRoleGuard) _AIRoleGuard = deps.aiRoleGuard;
    if (deps.regulatoryModeGuard) _RegulatoryModeGuard = deps.regulatoryModeGuard;
    if (deps.aiExplainabilityService) _AIExplainabilityService = deps.aiExplainabilityService;
    if (deps.accessPolicyService) _AccessPolicyService = deps.accessPolicyService;
    if (deps.tokenBillingService) _TokenBillingService = deps.tokenBillingService;
    if (deps.aiResponsePostProcessor) _AIResponsePostProcessor = deps.aiResponsePostProcessor;
    if (deps.aiAgents) _AIAgents = deps.aiAgents;
  },

  /**
   * Process a chat message
   */
  processMessage: async (
    message: string,
    userId: string,
    organizationId: string,
    projectId: string | null = null,
    options: any = {}
  ) => {
    await initDeps();

    // 0. Check Demo/Trial access policy
    const accessContext = await _AccessPolicyService.getAIAccessContext(organizationId);

    // Block if trial expired
    if (accessContext.trialStatus?.expired && !accessContext.isPaid) {
      return {
        blocked: true,
        errorCode: 'TRIAL_EXPIRED',
        message: 'Your trial has expired. Please upgrade to continue using AI features.',
        role: AIRole.ADVISOR,
        intent: ChatMode.EXPLAIN,
      };
    }

    // Check daily AI limit
    if (accessContext.dailyAIUsage.remaining <= 0 && !accessContext.isPaid) {
      if (accessContext.isDemo) {
        void recordDemoTrialEvent({
          eventType: DEMO_TRIAL_EVENT_TYPES.DEMO_AI_LIMIT_REACHED,
          organizationId,
          userId,
          source: 'ai_orchestrator',
          metadata: {
            limit: accessContext.dailyAIUsage.limit,
          },
        });
      }
      return {
        blocked: true,
        errorCode: 'AI_LIMIT_REACHED',
        message: `You've reached your daily AI call limit (${accessContext.dailyAIUsage.limit}). Upgrade for unlimited AI access.`,
        role: AIRole.ADVISOR,
        intent: ChatMode.EXPLAIN,
      };
    }

    // HARD TOKEN ENFORCEMENT
    try {
      let tokenBalance = 0;
      const cacheKey = `token_balance:${organizationId}`;

      try {
        const cached = await appCache.get<number>(cacheKey);
        if (cached !== null) {
          tokenBalance = cached;
        } else {
          const orgBalance = await _TokenBillingService.getOrgBalance(organizationId);
          tokenBalance = orgBalance?.balance || 0;
          // Cache for 1 minute to reduce DB load
          await appCache.set(cacheKey, tokenBalance, 60);
        }
      } catch (ignore) {
        // Fallback to direct DB call on cache error
        const orgBalance = await _TokenBillingService.getOrgBalance(organizationId);
        tokenBalance = orgBalance?.balance || 0;
      }

      const minTokensRequired = 100;

      if (tokenBalance < minTokensRequired) {
        return {
          blocked: true,
          errorCode: 'INSUFFICIENT_TOKENS',
          message:
            "You don't have enough tokens to use AI features. Please purchase tokens to continue.",
          role: AIRole.ADVISOR,
          intent: ChatMode.EXPLAIN,
          tokenBalance,
          minRequired: minTokensRequired,
          buyTokensUrl: '/settings/billing',
        };
      }
    } catch (err: any) {
      logger.error('[AIOrchestrator] Token balance check failed:', err.message);
    }

    // 1. Build context
    const context = await _AIContextBuilder.buildContext(
      userId,
      organizationId,
      projectId,
      options
    );

    // 2. Get policy
    const policy = await _AIPolicyEngine.getEffectivePolicy(organizationId, projectId, userId);

    // 3. Get user preferences
    const preferences = await _AIMemoryManager.getUserPreferences(userId);

    // 4. Determine intent and role
    const intent = AIOrchestrator._detectIntent(message);
    let role = AIOrchestrator._selectRole(intent, policy);

    // 4.1 Demo/Trial AI Role Restrictions
    if (!accessContext.isPaid && !accessContext.allowedAIRoles.includes(role)) {
      role = AIRole.ADVISOR;
    }

    // 4.2 Block "DO" actions in Demo mode
    if (accessContext.isDemo && intent === ChatMode.DO) {
      return {
        blocked: true,
        errorCode: 'DEMO_READ_ONLY',
        message:
          'Demo mode does not support creating or modifying data. Start a free trial to create your own projects.',
        role: AIRole.ADVISOR,
        intent: ChatMode.EXPLAIN,
      };
    }

    // 5. Get project memory for context
    let projectMemory = null;
    if (projectId) {
      projectMemory = await _AIMemoryManager.buildProjectMemorySummary(projectId);
    }

    // 6. Get AI Role configuration for the project
    let roleConfig = null;
    if (projectId) {
      roleConfig = await _AIRoleGuard.getRoleConfig(projectId);
    }

    // 7. Build response context
    const responseContext: AIResponseContext = {
      id: uuidv4(),
      role,
      intent,
      context,
      policy,
      preferences,
      projectMemory,
      dataSources: AIOrchestrator._identifyDataSources(context),
      confidenceLevel: null,
      explanation: null,
      aiGovernance: {
        activeRole: roleConfig?.activeRole || 'ADVISOR',
        capabilities: roleConfig?.capabilities || _AIRoleGuard.getRoleCapabilities('ADVISOR'),
        roleDescription: roleConfig?.roleDescription || _AIRoleGuard.getRoleDescription('ADVISOR'),
      },
      accessContext: {
        organizationType: accessContext.organizationType,
        isDemo: accessContext.isDemo,
        isTrial: accessContext.isTrial,
        isPaid: accessContext.isPaid,
        aiResponseBadge: accessContext.aiResponseBadge,
        dailyAIUsage: accessContext.dailyAIUsage,
      },
    };

    // 8. Generate AI Explanation
    responseContext.explanation = _AIExplainabilityService.buildAIExplanation(responseContext);
    responseContext.confidenceLevel = responseContext.explanation.confidenceLevel;

    // 9. Generate response prompt
    const prompt = AIOrchestrator._buildPrompt(message, responseContext);

    // 10. Increment daily AI usage counter
    _AccessPolicyService.incrementUsage(organizationId, 'ai_calls', 1).catch((err: any) => {
      logger.error('[AIOrchestrator] Failed to increment AI usage counter:', err);
    });

    return {
      responseContext,
      prompt,
      policyAllows: true,
      role,
      intent,
      contextSummary: AIOrchestrator._summarizeContext(context),
      explanation: responseContext.explanation,
      accessContext: responseContext.accessContext,
    };
  },

  /**
   * Detect user intent from message
   */
  _detectIntent: (message: string): ChatMode => {
    const lower = message.toLowerCase();

    if (
      lower.includes('wyjaśnij') ||
      lower.includes('explain') ||
      lower.includes('what is') ||
      lower.includes('co to') ||
      lower.includes('čo je')
    ) {
      return ChatMode.EXPLAIN;
    }
    if (
      lower.includes('co powinienem') ||
      lower.includes('what should') ||
      lower.includes('next step') ||
      lower.includes('następny krok') ||
      lower.includes('guide')
    ) {
      return ChatMode.GUIDE;
    }
    if (
      lower.includes('ryzyko') ||
      lower.includes('risk') ||
      lower.includes('analyze') ||
      lower.includes('analiz') ||
      lower.includes('problem')
    ) {
      return ChatMode.ANALYZE;
    }
    if (
      lower.includes('przygotuj') ||
      lower.includes('create') ||
      lower.includes('draft') ||
      lower.includes('stwórz') ||
      lower.includes('zrób')
    ) {
      return ChatMode.DO;
    }
    if (
      lower.includes('dlaczego') ||
      lower.includes('why') ||
      lower.includes('teach') ||
      lower.includes('naucz') ||
      lower.includes('explain why')
    ) {
      return ChatMode.TEACH;
    }

    return ChatMode.EXPLAIN;
  },

  /**
   * Select appropriate AI role based on intent and policy
   */
  _selectRole: (intent: ChatMode, policy: any): AIRole => {
    if (policy.regulatoryModeEnabled) {
      return AIRole.ADVISOR;
    }

    const roleMap: Record<string, AIRole> = {
      [ChatMode.EXPLAIN]: AIRole.ADVISOR,
      [ChatMode.GUIDE]: AIRole.PMO_MANAGER,
      [ChatMode.ANALYZE]: AIRole.PMO_MANAGER,
      [ChatMode.DO]: AIRole.EXECUTOR,
      [ChatMode.TEACH]: AIRole.EDUCATOR,
    };

    const selectedRole = roleMap[intent] || AIRole.ADVISOR;

    if (!policy.activeRoles.includes(selectedRole)) {
      return AIRole.ADVISOR;
    }

    return selectedRole;
  },

  /**
   * Build prompt for LLM with automatic token management
   */
  _buildPrompt: (userMessage: string, responseContext: AIResponseContext, options: any = {}) => {
    const { role, context, policy, preferences } = responseContext;
    let { projectMemory } = responseContext;

    const modelName = options.modelName || policy?.preferredModel || 'gpt-4';
    const conversationHistory = options.conversationHistory || [];

    if (projectMemory || conversationHistory.length > 0) {
      const trimResult = _AIMemoryManager.autoTrimContext({
        systemPrompt: '',
        userMessage,
        history: conversationHistory,
        memory: projectMemory,
        modelName,
      });

      if (trimResult.trimmed) {
        projectMemory = trimResult.memory;
        logger.info('[AIOrchestrator] Context trimmed:', {
          model: modelName,
          originalTokens: trimResult.originalAnalysis?.breakdown?.total,
          newTokens: trimResult.newAnalysis?.breakdown?.total,
          utilizationPercent: trimResult.newAnalysis?.status?.utilizationPercent,
        });
      }
    }

    let regulatoryPrefix = '';
    if (policy?.regulatoryModeEnabled && _RegulatoryModeGuard) {
      regulatoryPrefix = _RegulatoryModeGuard.getRegulatoryPrompt() + '\n\n';
    }

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

    if (context.currentScreen || context.selectedObjectId || context.selectedObjectType) {
      systemPrompt += `

CURRENT WORKSPACE:
- User is viewing: ${context.currentScreen || 'general dashboard'}`;

      if (context.selectedObjectId) {
        systemPrompt += `
- Selected object: ${context.selectedObjectType || 'unknown'} (ID: ${context.selectedObjectId})`;
      }

      const screenContextHints: Record<string, string> = {
        initiatives: 'Focus on initiative management, status updates, and deliverables.',
        roadmap: 'Focus on timeline, dependencies, and scheduling.',
        assessment: 'Focus on maturity levels, gaps, and recommendations.',
        tasks: 'Focus on task execution, assignments, and deadlines.',
        risks: 'Focus on risk assessment, mitigation strategies, and monitoring.',
        decisions: 'Focus on decision rationale, options analysis, and outcomes.',
        stakeholders: 'Focus on communication, engagement, and influence.',
        reports: 'Focus on metrics, KPIs, and executive summaries.',
        settings: 'Focus on configuration, preferences, and system management.',
        projects: 'Focus on project overview, health, and portfolio view.',
      };

      const screenKey = Object.keys(screenContextHints).find((key) =>
        (context.currentScreen || '').toLowerCase().includes(key)
      );

      if (screenKey) {
        systemPrompt += `
- Context hint: ${screenContextHints[screenKey]}`;
      }

      systemPrompt += `
- IMPORTANT: Reference this workspace context in your response when relevant.`;
    }

    if (projectMemory && projectMemory.memoryCount > 0) {
      systemPrompt += `

PROJECT HISTORY:
- ${projectMemory.majorDecisions?.length || 0} major decision(s) recorded
- ${projectMemory.phaseTransitions?.length || 0} phase transition(s)`;
    }

    const roleInstructions: Record<string, string> = {
      [AIRole.ADVISOR]: 'Provide clear explanations and context. Be helpful but factual.',
      [AIRole.PMO_MANAGER]:
        'Monitor execution, identify risks, suggest next steps. Be proactive but respectful.',
      [AIRole.EXECUTOR]:
        'Prepare drafts and actionable content. Always mark outputs as drafts requiring approval.',
      [AIRole.EDUCATOR]:
        'Explain concepts and best practices. Help user understand WHY, not just WHAT.',
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
5. State "Based on: ..." before significant statements

IDEA GENERATION:
When you spot an opportunity for innovation, improvement, or a creative approach during conversation, include an idea hint using this exact format on its own line:
💡 IDEA_HINT: <short catchy title> | <1-sentence description of the opportunity>
This helps users capture creative sparks. Do this naturally, at most once per response, and only when genuinely relevant.`;

    const aiGovernanceRole = responseContext.aiGovernance?.activeRole || 'ADVISOR';
    const roleConstraints: Record<string, string> = {
      ADVISOR: `

AI GOVERNANCE - ADVISOR MODE:
⚠️ STRICT CONSTRAINTS:
- You MAY: explain, summarize, suggest, warn, analyze
- You MAY NOT: create, modify, delete, or change any data
- Output style: descriptive, educational, neutral
- Never propose action execution, only explain options
- If user asks to create/modify something, explain how they can do it themselves`,

      MANAGER: `

AI GOVERNANCE - MANAGER MODE:
⚠️ STRICT CONSTRAINTS:
- You MAY: do everything an Advisor can, plus prepare drafts
- You MAY: propose tasks, initiatives, decisions as drafts
- You MAY NOT: execute any action without explicit user approval
- All actions must be returned as "📋 PROPOSED ACTION:" sections
- User must confirm each action before execution
- Always include: "This is a draft proposal. Approve to proceed."`,

      OPERATOR: `

AI GOVERNANCE - OPERATOR MODE:
✅ EXECUTION ENABLED (within governance):
- You MAY: execute previously approved actions
- You MAY: update task status, assign owners, modify data
- You MUST: operate within project governance rules
- You MUST: log every action with "✅ ACTION EXECUTED:" prefix
- Only execute actions marked as AI-executable
- Always confirm what was done and what changed`,
    };

    systemPrompt += roleConstraints[aiGovernanceRole] || roleConstraints['ADVISOR'];

    if (context.external && context.external.internetEnabled) {
      systemPrompt += `
6. If using external/internet sources, prefix response with: 🌐 [External sources used]`;
    }

    if (projectMemory && projectMemory.memoryCount > 0) {
      systemPrompt += `
7. Since you have project memory, prefix response with: 📚 [Using project memory: ${projectMemory.memoryCount} items]`;
    }

    systemPrompt += `

USER MESSAGE: ${userMessage}`;

    const finalPrompt = regulatoryPrefix + systemPrompt;

    const tokenAnalysis = _AIMemoryManager.analyzeContextTokens(
      finalPrompt,
      userMessage,
      conversationHistory,
      projectMemory,
      modelName
    );

    if (tokenAnalysis.status.utilizationPercent > 80) {
      logger.warn('[AIOrchestrator] High token utilization:', {
        model: modelName,
        utilization: `${tokenAnalysis.status.utilizationPercent}%`,
        total: tokenAnalysis.breakdown.total,
        limit: tokenAnalysis.limits.availableForContext,
      });
    }

    if (responseContext) {
      responseContext._tokenAnalysis = {
        total: tokenAnalysis.breakdown.total,
        utilization: tokenAnalysis.status.utilizationPercent,
        model: modelName,
        trimmed: projectMemory?._trimmed || false,
      };
    }

    return finalPrompt;
  },

  /**
   * Identify data sources used in context
   */
  _identifyDataSources: (context: any) => {
    // DEFENSIVE: context sub-objects (execution/knowledge/external) can be partially
    // built when an enrichment query degrades (e.g. schema drift leaves a field
    // undefined). Optional-chain every access so a missing field never crashes the
    // whole chat turn (2026-06-28: `knowledge.previousDecisions` was undefined →
    // TypeError reading 'length' → Teresa returned no output).
    const sources = ['Platform Configuration', 'Organization Data'];

    if (context?.project) {
      sources.push('Project Data');
      sources.push(`Phase: ${context.project.currentPhase}`);
    }

    if ((context?.execution?.userTasks?.length ?? 0) > 0) {
      sources.push('User Tasks');
    }

    if ((context?.execution?.pendingDecisions?.length ?? 0) > 0) {
      sources.push('Pending Decisions');
    }

    if ((context?.knowledge?.previousDecisions?.length ?? 0) > 0) {
      sources.push('Decision History');
    }

    if (context?.external?.internetEnabled) {
      sources.push('External Knowledge (if used)');
    }

    return sources;
  },

  /**
   * Summarize context for display
   */
  _summarizeContext: (context: any) => {
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
  getRoleDescription: (role: AIRole) => {
    const descriptions: Record<string, string> = {
      [AIRole.ADVISOR]: 'Explains and answers questions',
      [AIRole.PMO_MANAGER]: 'Monitors execution, detects risks, suggests next steps',
      [AIRole.EXECUTOR]: 'Creates drafts (requires approval)',
      [AIRole.EDUCATOR]: 'Teaches change management concepts',
    };
    return descriptions[role] || 'AI Assistant';
  },

  /**
   * Post-process AI response for deterministic labeling
   */
  postProcessResponse: async (responseText: string, responseContext: any) => {
    await initDeps();

    const context = {
      projectMemory: responseContext?.projectMemory,
      pmo: { healthSnapshot: responseContext?.context?.pmo?.healthSnapshot },
      knowledge: responseContext?.context?.knowledge,
      external: responseContext?.context?.external,
      execution: responseContext?.context?.execution,
    };

    let processedResponse = _AIResponsePostProcessor(responseText, context);

    if (responseContext?.explanation) {
      const footer = _AIExplainabilityService.buildExplainabilityFooter(
        responseContext.explanation
      );
      if (footer) {
        processedResponse = `${processedResponse.trim()}\n\n${footer}`;
      }
    }

    return processedResponse;
  },

  // ============================================================
  // MULTI-AGENT ARCHITECTURE
  // ============================================================

  /**
   * Process message using Multi-Agent Architecture
   */
  processMessageWithAgents: async (
    message: string,
    userId: string,
    organizationId: string,
    projectId: string | null = null,
    options: any = {}
  ) => {
    await initDeps();

    const accessContext = await _AccessPolicyService.getAIAccessContext(organizationId);

    if (accessContext.trialStatus?.expired && !accessContext.isPaid) {
      return {
        blocked: true,
        errorCode: 'TRIAL_EXPIRED',
        message: 'Your trial has expired. Please upgrade to continue using AI features.',
      };
    }

    if (accessContext.dailyAIUsage.remaining <= 0 && !accessContext.isPaid) {
      if (accessContext.isDemo) {
        void recordDemoTrialEvent({
          eventType: DEMO_TRIAL_EVENT_TYPES.DEMO_AI_LIMIT_REACHED,
          organizationId,
          userId,
          source: 'ai_orchestrator',
          metadata: {
            limit: accessContext.dailyAIUsage.limit,
          },
        });
      }
      return {
        blocked: true,
        errorCode: 'AI_LIMIT_REACHED',
        message: `You've reached your daily AI call limit.`,
      };
    }

    const context = await _AIContextBuilder.buildContext(
      userId,
      organizationId,
      projectId,
      options
    );
    const policy = await _AIPolicyEngine.getEffectivePolicy(organizationId, projectId, userId);
    const preferences = await _AIMemoryManager.getUserPreferences(userId);

    const agentContext = {
      ...context,
      organization: {
        id: organizationId,
        name: context.organization?.organizationName,
        industry: context.organization?.industry,
        employeeCount: context.organization?.employeeCount,
      },
      project: context.project
        ? {
            id: projectId,
            name: context.project.projectName,
            phase: context.project.currentPhase,
            status: context.project.status,
            progress: context.project.progressPercent,
          }
        : null,
      initiatives: context.project?.initiatives || [],
      assessment: context.project?.assessment,
      economics: context.project?.economics,
      goals: context.project?.goals,
      risks: context.project?.risks,
      stakeholders: context.project?.stakeholders,
      resources: context.project?.resources,
      milestones: context.project?.milestones,
      dependencies: context.project?.dependencies,
      preferences,
      preferredModel: policy.preferredModel,
    };

    const coordinator = _AIAgents.getCoordinator({
      minAgentsForDebate: options.enableDebate !== false ? 2 : 99,
      maxAgentsPerQuery: options.maxAgents || 3,
    });

    const result = await coordinator.processQuery(message, agentContext, {
      skipDebate: options.skipDebate,
    });

    _AccessPolicyService.incrementUsage(organizationId, 'ai_calls', 1).catch((err: any) => {
      logger.error('[AIOrchestrator] Failed to increment AI usage counter:', err);
    });

    return {
      ...result,
      accessContext: {
        organizationType: accessContext.organizationType,
        isDemo: accessContext.isDemo,
        isTrial: accessContext.isTrial,
        isPaid: accessContext.isPaid,
      },
    };
  },

  /**
   * Query a specific specialist agent directly
   */
  querySpecialistAgent: async (
    domain: string,
    message: string,
    userId: string,
    organizationId: string,
    projectId: string | null = null
  ) => {
    await initDeps();

    const context = await _AIContextBuilder.buildContext(userId, organizationId, projectId);

    const agentContext = {
      organization: { id: organizationId },
      project: projectId ? { id: projectId } : null,
      ...context,
    };

    const coordinator = _AIAgents.getCoordinator();
    return await coordinator.queryAgent(domain, message, agentContext);
  },

  /**
   * Get recommendations from all relevant agents
   */
  getMultiAgentRecommendations: async (
    topic: string,
    userId: string,
    organizationId: string,
    projectId: string | null = null
  ) => {
    await initDeps();

    const context = await _AIContextBuilder.buildContext(userId, organizationId, projectId);
    const coordinator = _AIAgents.getCoordinator();

    return await coordinator.getSpecialistRecommendations(topic, context);
  },

  /**
   * Get available agent domains and their metadata
   */
  getAvailableAgents: async () => {
    await initDeps();
    return _AIAgents.getAllAgentMetadata();
  },

  /**
   * Get agent coordinator metrics
   */
  getAgentMetrics: async () => {
    await initDeps();
    return _AIAgents.getCoordinator().getMetrics();
  },
};

export default AIOrchestrator;
