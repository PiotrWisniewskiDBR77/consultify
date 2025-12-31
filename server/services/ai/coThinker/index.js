/**
 * Harvard-Level Co-Thinker AI System
 * 
 * Central export for all Co-Thinker components.
 * This is the complete system for AI-driven strategic consulting.
 * 
 * Architecture:
 * - Consulting Brain Core: Intent Engine, Conversation State, Consulting Flow
 * - Deep Knowledge Layer: Context Builder, Knowledge Indexer, Web Research
 * - Action Layer: Action Executor, Form Filling, Navigation
 * - Interaction Layer: Socratic Engine, Personalization, Voice
 * - Integration: Harvard Prompts, Co-Thinker Orchestration
 */

// Consulting Brain Core
const { IntentEngine, intentEngine, INTENT_TAXONOMY, URGENCY_INDICATORS, EMOTIONAL_INDICATORS } = require('../intentEngine');
const { ConversationStateMachine, conversationStateMachine, CONVERSATION_PHASES, DATA_REQUIREMENTS } = require('../conversationStateMachine');
const { ConsultingFlowEngine, consultingFlowEngine, TRANSFORMATION_METHODOLOGY, AXIS_QUESTION_BANK } = require('../consultingFlowEngine');

// Deep Knowledge Layer
const { EnhancedContextBuilder, enhancedContextBuilder, PHASE_CONTEXT_PRIORITIES, MAX_TOKENS_PER_LAYER } = require('../enhancedContextBuilder');
const { KnowledgeIndexer, knowledgeIndexer } = require('../knowledgeIndexer');
const { IntelligentResearch, intelligentResearch, QUERY_TEMPLATES, CONTEXT_RESEARCH_MAP } = require('../intelligentResearch');

// Action Layer
const { ActionExecutor, actionExecutor, ACTION_TYPES, VIEW_MAPPINGS } = require('../actionExecutor');

// Interaction Layer
const { SocraticEngine, socraticEngine, SOCRATIC_PATTERNS, QUESTION_SELECTION_RULES } = require('../socraticEngine');
const { PersonalizationEngine, personalizationEngine, DEFAULT_PROFILE, COMMUNICATION_STYLES, EXPERTISE_ADJUSTMENTS, LEARNING_SIGNALS } = require('../personalizationEngine');

// Harvard Consultant Prompts
const { 
    HARVARD_CONSULTANT_PROMPT,
    PHASE_SPECIFIC_EXPERTISE,
    VOICE_RESPONSE_INSTRUCTIONS,
    CONTEXT_ENHANCEMENTS,
    getFullSystemPrompt,
    getTimeGreeting,
    getFollowUpSuggestions: harvardFollowUpSuggestions
} = require('../harvardConsultantPrompts');

// Existing services for integration
const { coThinkerPrompt, getEnhancedPrompt, getTimeGreeting, getQuickActionPrompt, getFollowUpSuggestions } = require('../coThinkerPrompts');

/**
 * Co-Thinker Orchestrator
 * 
 * Main entry point for the Co-Thinker system.
 * Coordinates all components to deliver Harvard-level consulting experience.
 */
class CoThinkerOrchestrator {
    constructor() {
        this.intentEngine = intentEngine;
        this.conversationState = conversationStateMachine;
        this.consultingFlow = consultingFlowEngine;
        this.contextBuilder = enhancedContextBuilder;
        this.knowledgeIndexer = knowledgeIndexer;
        this.research = intelligentResearch;
        this.actionExecutor = actionExecutor;
        this.socratic = socraticEngine;
        this.personalization = personalizationEngine;
    }

    /**
     * Process a user message through the full Co-Thinker pipeline
     */
    async processMessage(message, conversationId, context = {}) {
        const { userId, projectId, organizationId } = context;

        // 1. Get or create conversation state
        let state = this.conversationState.getState(conversationId);
        if (!state) {
            state = this.conversationState.initializeState(conversationId, {
                projectId,
                organizationId,
                userId
            });
        }

        // 2. Analyze intent
        const intent = await this.intentEngine.analyze({
            message,
            conversationHistory: state.conversationHistory,
            pmoContext: context.pmoContext
        });

        // 3. Update conversation state with new message
        state = this.conversationState.processMessage(conversationId, {
            content: message,
            intent: intent.primaryIntent,
            timestamp: new Date().toISOString()
        });

        // 4. Get personalization guidelines
        const personalization = await this.personalization.getResponseGuidelines(userId, {
            urgency: intent.urgency,
            topic: intent.primaryIntent,
            conversationLength: state.conversationHistory?.length || 0
        });

        // 5. Build comprehensive context
        const fullContext = await this.contextBuilder.build({
            userId,
            projectId,
            organizationId,
            conversationId,
            currentMessage: message,
            phase: state.currentPhase,
            intent: intent.primaryIntent,
            topic: intent.topic,
            includeResearch: intent.urgency !== 'immediate'
        });

        // 6. Get consulting flow guidance
        const flowGuidance = this.consultingFlow.getRecommendedAction(state);

        // 7. Generate Socratic question if appropriate
        let socraticQuestion = null;
        if (flowGuidance.type === 'ask_question' || intent.needsClarification) {
            socraticQuestion = this.socratic.generateQuestion({
                topic: intent.topic,
                userStatement: message,
                conversationPhase: state.currentPhase,
                emotionalState: intent.emotionalState,
                language: personalization.language
            });
        }

        // 8. Build system prompt
        const systemPrompt = getFullSystemPrompt({
            phase: state.currentPhase,
            userName: context.userName,
            organizationName: context.organizationName,
            projectName: context.projectName,
            userRole: context.userRole,
            language: personalization.language,
            voiceMode: context.voiceMode
        });

        // 9. Return processed data for AI response generation
        return {
            conversationId,
            state,
            intent,
            personalization,
            context: fullContext,
            flowGuidance,
            socraticQuestion,
            systemPrompt,
            metadata: {
                phase: state.currentPhase,
                progress: state.phaseProgress,
                collecteedData: state.collectedData,
                pendingQuestions: state.pendingQuestions
            }
        };
    }

    /**
     * Process AI response for potential actions
     */
    async processResponse(response, conversationId, context = {}) {
        // Check for action commands in response
        const actionMatch = response.match(/ACTION:\s*({[\s\S]*?})/);
        
        if (actionMatch) {
            try {
                const actionData = JSON.parse(actionMatch[1]);
                const result = await this.actionExecutor.execute(actionData, context);
                return {
                    hasAction: true,
                    action: actionData,
                    result,
                    cleanResponse: response.replace(/ACTION:\s*{[\s\S]*?}/, '').trim()
                };
            } catch (e) {
                console.error('[CoThinker] Action parsing/execution failed:', e);
            }
        }

        // Check for memory commands
        const memoryMatch = response.match(/REMEMBER:\s*(\w+):\s*(.+)/);
        if (memoryMatch) {
            // Store in personalization
            await this.personalization.updateProfile(context.userId, {
                [`custom_${memoryMatch[1]}`]: memoryMatch[2].trim()
            });
        }

        // Update conversation state
        this.conversationState.processMessage(conversationId, {
            content: response,
            role: 'assistant',
            timestamp: new Date().toISOString()
        });

        return {
            hasAction: false,
            cleanResponse: response
        };
    }

    /**
     * Get phase summary for UI display
     */
    getPhaseSummary(conversationId) {
        const state = this.conversationState.getState(conversationId);
        if (!state) return null;

        return this.consultingFlow.getPhaseSummary(state.currentPhase, state);
    }

    /**
     * Manually advance to next phase
     */
    advancePhase(conversationId) {
        const state = this.conversationState.getState(conversationId);
        if (!state) return null;

        const canTransition = this.consultingFlow.canTransition(state.currentPhase, state);
        if (!canTransition.canTransition) {
            return {
                success: false,
                reason: canTransition.reason
            };
        }

        const nextPhase = this.consultingFlow.getNextPhase(state.currentPhase);
        if (!nextPhase) {
            return {
                success: false,
                reason: 'No next phase available'
            };
        }

        this.conversationState.transitionPhase(conversationId, nextPhase.id);
        
        return {
            success: true,
            newPhase: nextPhase.id,
            phaseName: nextPhase.name
        };
    }

    /**
     * Reset conversation state
     */
    resetConversation(conversationId, context = {}) {
        this.conversationState.clearState(conversationId);
        this.socratic.reset();
        
        // Re-initialize
        return this.conversationState.initializeState(conversationId, context);
    }

    /**
     * Get system status
     */
    getStatus() {
        return {
            components: {
                intentEngine: 'active',
                conversationState: 'active',
                consultingFlow: 'active',
                contextBuilder: 'active',
                knowledgeIndexer: 'active',
                research: 'active',
                actionExecutor: 'active',
                socratic: 'active',
                personalization: 'active'
            },
            phases: this.consultingFlow.getAllPhases().map(p => ({
                id: p.id,
                name: p.name
            })),
            actionTypes: Object.keys(ACTION_TYPES),
            version: '1.0.0'
        };
    }
}

// Singleton instance
const coThinkerOrchestrator = new CoThinkerOrchestrator();

module.exports = {
    // Main orchestrator
    CoThinkerOrchestrator,
    coThinkerOrchestrator,
    
    // Consulting Brain Core
    IntentEngine,
    intentEngine,
    INTENT_TAXONOMY,
    URGENCY_INDICATORS,
    EMOTIONAL_INDICATORS,
    
    ConversationStateMachine,
    conversationStateMachine,
    CONVERSATION_PHASES,
    DATA_REQUIREMENTS,
    
    ConsultingFlowEngine,
    consultingFlowEngine,
    TRANSFORMATION_METHODOLOGY,
    AXIS_QUESTION_BANK,
    
    // Deep Knowledge Layer
    EnhancedContextBuilder,
    enhancedContextBuilder,
    PHASE_CONTEXT_PRIORITIES,
    MAX_TOKENS_PER_LAYER,
    
    KnowledgeIndexer,
    knowledgeIndexer,
    
    IntelligentResearch,
    intelligentResearch,
    QUERY_TEMPLATES,
    CONTEXT_RESEARCH_MAP,
    
    // Action Layer
    ActionExecutor,
    actionExecutor,
    ACTION_TYPES,
    VIEW_MAPPINGS,
    
    // Interaction Layer
    SocraticEngine,
    socraticEngine,
    SOCRATIC_PATTERNS,
    QUESTION_SELECTION_RULES,
    
    PersonalizationEngine,
    personalizationEngine,
    DEFAULT_PROFILE,
    COMMUNICATION_STYLES,
    EXPERTISE_ADJUSTMENTS,
    LEARNING_SIGNALS,
    
    // Harvard Prompts
    HARVARD_CONSULTANT_PROMPT,
    PHASE_SPECIFIC_EXPERTISE,
    VOICE_RESPONSE_INSTRUCTIONS,
    CONTEXT_ENHANCEMENTS,
    getFullSystemPrompt,
    getTimeGreeting,
    
    // Legacy Co-Thinker (for backwards compatibility)
    coThinkerPrompt,
    getEnhancedPrompt,
    getTimeGreeting,
    getQuickActionPrompt,
    getFollowUpSuggestions
};

