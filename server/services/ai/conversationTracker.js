/**
 * Conversation Tracker
 * 
 * Tracks multi-turn conversation context for improved AI responses.
 * Detects intent patterns, topic shifts, and conversation flow.
 */

/**
 * Conversation state object
 */
class ConversationState {
    constructor(conversationId) {
        this.conversationId = conversationId;
        this.currentIntent = null;           // assessment, initiative, roadmap, general
        this.intentHistory = [];             // Track intent changes
        this.topics = new Set();             // Detected topics
        this.clarificationsNeeded = [];      // Questions to ask user
        this.completedSteps = [];            // Steps user has completed
        this.nextSuggestedStep = null;       // Recommended next action
        this.userPreferences = {
            detailLevel: 'medium',           // brief, medium, detailed
            responseFormat: 'structured',    // conversational, structured, bullet
            educationMode: false             // Include explanations
        };
        this.keyEntities = {                 // Referenced entities
            assessmentId: null,
            initiativeIds: [],
            roadmapId: null,
            projectId: null
        };
        this.messageCount = 0;
        this.lastActivityAt = new Date();
        this.createdAt = new Date();
    }
}

// In-memory conversation state cache (use Redis in production)
const conversationStates = new Map();

/**
 * Intent detection patterns
 */
const INTENT_PATTERNS = {
    assessment: [
        /assess/i, /maturity/i, /score/i, /drd/i, /siri/i, /adma/i,
        /gap\s*analysis/i, /evaluation/i, /dimension/i, /capability/i
    ],
    initiative: [
        /initiative/i, /improve/i, /project/i, /implement/i, /action\s*item/i,
        /recommendation/i, /suggestion/i, /generate/i, /propose/i
    ],
    roadmap: [
        /roadmap/i, /timeline/i, /schedule/i, /phase/i, /milestone/i,
        /quarter/i, /wave/i, /planning/i, /sequence/i
    ],
    roi: [
        /roi/i, /return\s*on\s*investment/i, /cost/i, /benefit/i, /payback/i,
        /business\s*case/i, /economic/i, /value/i, /savings/i
    ],
    report: [
        /report/i, /summary/i, /executive/i, /document/i, /export/i,
        /presentation/i, /findings/i, /analysis/i
    ]
};

/**
 * Topic detection based on keywords
 */
const TOPIC_KEYWORDS = {
    data: ['data', 'database', 'analytics', 'bi', 'reporting', 'data quality'],
    automation: ['automation', 'automate', 'robot', 'rpa', 'workflow'],
    integration: ['integration', 'api', 'connect', 'sync', 'interoperability'],
    security: ['security', 'cyber', 'compliance', 'gdpr', 'audit'],
    cloud: ['cloud', 'migration', 'saas', 'infrastructure', 'hosting'],
    ai: ['ai', 'machine learning', 'ml', 'artificial intelligence', 'predictive'],
    process: ['process', 'lean', 'efficiency', 'optimization', 'workflow'],
    culture: ['culture', 'change management', 'training', 'adoption', 'people']
};

const ConversationTracker = {
    /**
     * Get or create conversation state
     */
    getState(conversationId) {
        if (!conversationStates.has(conversationId)) {
            conversationStates.set(conversationId, new ConversationState(conversationId));
        }
        return conversationStates.get(conversationId);
    },

    /**
     * Update conversation state based on new message
     * @param {string} conversationId 
     * @param {object} message - { role, content }
     * @returns {ConversationState}
     */
    processMessage(conversationId, message) {
        const state = this.getState(conversationId);
        state.messageCount++;
        state.lastActivityAt = new Date();

        if (message.role === 'user') {
            // Detect intent
            const newIntent = this._detectIntent(message.content);
            if (newIntent && newIntent !== state.currentIntent) {
                state.intentHistory.push({
                    intent: newIntent,
                    at: new Date(),
                    messageIndex: state.messageCount
                });
                state.currentIntent = newIntent;
            }

            // Detect topics
            const detectedTopics = this._detectTopics(message.content);
            detectedTopics.forEach(topic => state.topics.add(topic));

            // Detect entity references
            this._detectEntities(message.content, state);

            // Detect preference signals
            this._detectPreferences(message.content, state);
        }

        return state;
    },

    /**
     * Detect primary intent from message
     */
    _detectIntent(content) {
        const lowerContent = content.toLowerCase();
        
        for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
            const matchCount = patterns.filter(p => p.test(lowerContent)).length;
            if (matchCount >= 2) {
                return intent;
            }
        }

        // Check for single strong matches
        for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
            if (patterns.some(p => p.test(lowerContent))) {
                return intent;
            }
        }

        return 'general';
    },

    /**
     * Detect topics from message
     */
    _detectTopics(content) {
        const topics = [];
        const lowerContent = content.toLowerCase();

        for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
            if (keywords.some(kw => lowerContent.includes(kw))) {
                topics.push(topic);
            }
        }

        return topics;
    },

    /**
     * Detect entity references (IDs, names)
     */
    _detectEntities(content, state) {
        // UUID pattern
        const uuidMatch = content.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
        if (uuidMatch) {
            // Try to determine entity type from context
            const lowerContent = content.toLowerCase();
            if (lowerContent.includes('assessment')) {
                state.keyEntities.assessmentId = uuidMatch[0];
            } else if (lowerContent.includes('initiative')) {
                state.keyEntities.initiativeIds.push(...uuidMatch);
            }
        }
    },

    /**
     * Detect user preference signals
     */
    _detectPreferences(content, state) {
        const lowerContent = content.toLowerCase();

        // Detail level
        if (lowerContent.includes('briefly') || lowerContent.includes('quick') || lowerContent.includes('tldr')) {
            state.userPreferences.detailLevel = 'brief';
        } else if (lowerContent.includes('detail') || lowerContent.includes('comprehensive') || lowerContent.includes('thorough')) {
            state.userPreferences.detailLevel = 'detailed';
        }

        // Response format
        if (lowerContent.includes('bullet') || lowerContent.includes('list')) {
            state.userPreferences.responseFormat = 'bullet';
        } else if (lowerContent.includes('conversational') || lowerContent.includes('casual')) {
            state.userPreferences.responseFormat = 'conversational';
        }

        // Education mode
        if (lowerContent.includes('explain') || lowerContent.includes('why') || lowerContent.includes('teach')) {
            state.userPreferences.educationMode = true;
        }
    },

    /**
     * Get context summary for AI prompt enhancement
     */
    getContextSummary(conversationId) {
        const state = this.getState(conversationId);

        return {
            currentIntent: state.currentIntent,
            topics: Array.from(state.topics),
            messageCount: state.messageCount,
            preferences: state.userPreferences,
            keyEntities: state.keyEntities,
            recentIntentChanges: state.intentHistory.slice(-3),
            idleMinutes: Math.floor((new Date() - state.lastActivityAt) / 60000)
        };
    },

    /**
     * Generate context prompt injection for AI
     */
    getContextPrompt(conversationId) {
        const summary = this.getContextSummary(conversationId);
        let prompt = '';

        if (summary.currentIntent) {
            prompt += `\nCONVERSATION CONTEXT:\n- Current focus: ${summary.currentIntent}`;
        }

        if (summary.topics.length > 0) {
            prompt += `\n- Topics discussed: ${summary.topics.join(', ')}`;
        }

        if (summary.messageCount > 5) {
            prompt += `\n- This is a longer conversation (${summary.messageCount} exchanges)`;
        }

        if (summary.preferences.detailLevel !== 'medium') {
            prompt += `\n- User prefers ${summary.preferences.detailLevel} responses`;
        }

        if (summary.preferences.educationMode) {
            prompt += `\n- User wants explanations of concepts`;
        }

        if (summary.keyEntities.assessmentId) {
            prompt += `\n- Referenced assessment: ${summary.keyEntities.assessmentId}`;
        }

        if (summary.keyEntities.initiativeIds.length > 0) {
            prompt += `\n- Referenced initiatives: ${summary.keyEntities.initiativeIds.length}`;
        }

        return prompt;
    },

    /**
     * Mark a step as completed
     */
    markStepCompleted(conversationId, step) {
        const state = this.getState(conversationId);
        if (!state.completedSteps.includes(step)) {
            state.completedSteps.push(step);
        }
    },

    /**
     * Set suggested next step
     */
    setSuggestedStep(conversationId, step) {
        const state = this.getState(conversationId);
        state.nextSuggestedStep = step;
    },

    /**
     * Clear conversation state (on new conversation)
     */
    clearState(conversationId) {
        conversationStates.delete(conversationId);
    },

    /**
     * Cleanup old states (call periodically)
     */
    cleanup(maxAgeHours = 24) {
        const maxAge = maxAgeHours * 60 * 60 * 1000;
        const now = new Date();

        for (const [id, state] of conversationStates.entries()) {
            if (now - state.lastActivityAt > maxAge) {
                conversationStates.delete(id);
            }
        }
    }
};

module.exports = ConversationTracker;


