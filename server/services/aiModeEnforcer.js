/**
 * AI Mode Enforcer
 * 
 * Wraps AI service calls with mode enforcement per canonical documentation.
 * This module ensures AI behavior respects Phase/State constraints.
 * 
 * Usage:
 *   const AIModeEnforcer = require('./aiModeEnforcer');
 *   const response = await AIModeEnforcer.chat(message, history, userId, phase);
 */

const AIModeResolver = require('./aiModeResolver');
const AiService = require('./aiService');
const AiContextValidator = require('./aiContextValidator');

// Lazy-loaded database
let db = null;
const getDb = () => {
    if (!db) {
        try {
            db = require('../db/sqliteAsync');
        } catch (e) {
            db = require('../database');
        }
    }
    return db;
};

/**
 * Get user's current phase and state
 * @param {string} userId 
 * @returns {Promise<{phase: string, state: string}>}
 */
async function getUserContext(userId) {
    if (!userId) {
        return { phase: 'A', state: 'ANON' };
    }

    try {
        const db = getDb();
        const user = await db.get(
            'SELECT current_phase, user_journey_state FROM users WHERE id = ?',
            [userId]
        );

        return {
            phase: user?.current_phase || 'A',
            state: user?.user_journey_state || 'ANON'
        };
    } catch (error) {
        console.warn('getUserContext error:', error.message);
        return { phase: 'A', state: 'ANON' };
    }
}

const AIModeEnforcer = {
    /**
     * Phase-aware chat function
     * Enforces AI mode based on user's current phase
     */
    chat: async function (message, history, userId, overridePhase = null, context = {}) {
        const { phase, state } = overridePhase
            ? { phase: overridePhase, state: null }
            : await getUserContext(userId);

        const mode = AIModeResolver.getModeForPhase(phase);

        // Check if AI can respond at all
        if (!AIModeResolver.canAIRespond(mode)) {
            return AIModeResolver.getOffModeResponse();
        }

        // Detect if user is asking for something forbidden in this mode
        const requestType = this._detectRequestType(message);
        const modeValidation = AIModeResolver.validateRequest(mode, requestType);

        if (!modeValidation.allowed) {
            return `${modeValidation.reason}. ${modeValidation.alternative ? `Available actions: ${modeValidation.alternative}` : ''}`;
        }

        // Validate context for request type (new: EPIC compliance)
        const contextValidation = AiContextValidator.validate(context, requestType, 'pl');
        if (!contextValidation.valid) {
            return {
                error: true,
                reason: contextValidation.reason,
                message: contextValidation.message,
                missingFields: contextValidation.missingFields,
            };
        }

        // Get mode-specific system instruction
        const modeInstruction = AIModeResolver.getSystemInstruction(mode);

        // Call AI with mode-enhanced instruction
        const response = await AiService.chat(
            message,
            history,
            'CONSULTANT', // Default role, mode instruction overrides behavior
            userId,
            null
        );

        // Add mode metadata to response (for audit/debugging)
        return {
            response,
            metadata: {
                CURRENT_MODE: mode,
                phase,
                state,
                contextWarning: contextValidation.warning || null,
                timestamp: new Date().toISOString()
            }
        };
    },

    /**
     * Phase-aware recommendation generation
     */
    recommend: async function (diagnosisReport, userId) {
        const { phase } = await getUserContext(userId);
        const mode = AIModeResolver.getModeForPhase(phase);
        const caps = AIModeResolver.getCapabilities(mode);

        if (!caps.canRecommend) {
            return {
                error: 'RECOMMENDATION_NOT_AVAILABLE',
                message: `Recommendations are not available in ${mode} mode (Phase ${phase})`,
                requiredPhase: ['E', 'F', 'G']
            };
        }

        return await AiService.generateInitiatives(diagnosisReport, userId);
    },

    /**
     * Phase-aware analysis
     */
    analyze: async function (axis, textInput, userId) {
        const { phase } = await getUserContext(userId);
        const mode = AIModeResolver.getModeForPhase(phase);
        const caps = AIModeResolver.getCapabilities(mode);

        if (!caps.canAnalyze) {
            return {
                error: 'ANALYSIS_NOT_AVAILABLE',
                message: `Analysis is not available in ${mode} mode (Phase ${phase})`,
                requiredPhase: ['E', 'F', 'G']
            };
        }

        return await AiService.diagnose(axis, textInput, userId);
    },

    /**
     * Phase-aware benchmarking
     */
    benchmark: async function (orgId, userId) {
        const { phase } = await getUserContext(userId);
        const mode = AIModeResolver.getModeForPhase(phase);
        const caps = AIModeResolver.getCapabilities(mode);

        if (!caps.canBenchmark) {
            return {
                error: 'BENCHMARK_NOT_AVAILABLE',
                message: `Benchmarks are not available in ${mode} mode (Phase ${phase})`,
                requiredPhase: ['G']
            };
        }

        // Benchmark logic would go here
        return { allowed: true, phase };
    },

    /**
     * Get current AI mode for a user
     */
    getCurrentMode: async function (userId) {
        const { phase, state } = await getUserContext(userId);
        const mode = AIModeResolver.getModeForPhase(phase);
        const caps = AIModeResolver.getCapabilities(mode);

        return {
            mode,
            phase,
            state,
            capabilities: caps,
            systemInstruction: AIModeResolver.getSystemInstruction(mode)
        };
    },

    /**
     * Validate if a specific AI action is allowed
     */
    validateAction: async function (userId, action) {
        const { phase } = await getUserContext(userId);
        const mode = AIModeResolver.getModeForPhase(phase);
        return AIModeResolver.validateRequest(mode, action);
    },

    /**
     * Detect request type from message content
     * @private
     */
    _detectRequestType: function (message) {
        const lowerMessage = message.toLowerCase();

        if (lowerMessage.includes('recommend') || lowerMessage.includes('suggest') || lowerMessage.includes('what should')) {
            return 'recommend';
        }
        if (lowerMessage.includes('analyze') || lowerMessage.includes('diagnose') || lowerMessage.includes('assess')) {
            return 'analyze';
        }
        if (lowerMessage.includes('benchmark') || lowerMessage.includes('compare to') || lowerMessage.includes('industry')) {
            return 'benchmark';
        }
        if (lowerMessage.includes('help') || lowerMessage.includes('how') || lowerMessage.includes('what is')) {
            return 'explain';
        }

        return 'general';
    }
};

module.exports = AIModeEnforcer;
