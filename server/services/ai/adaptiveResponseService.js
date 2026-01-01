/**
 * Adaptive Response Service
 * 
 * Dynamically adjusts AI response length and style based on:
 * - User preferences (Quick/Standard/Deep Study modes)
 * - Auto-detected intent from user message
 * - Learning from feedback patterns
 * 
 * Part of the AI Response Personalization System
 * 
 * @version 1.0.0
 */

const db = require('../../database');
const { v4: uuidv4 } = require('uuid');

// Token limits per response mode and length setting
const RESPONSE_LENGTH_TOKENS = {
    quick: {
        ultra_short: { min: 30, max: 80, target: 50 },
        short: { min: 80, max: 200, target: 150 },
        medium: { min: 200, max: 400, target: 300 }
    },
    standard: {
        short: { min: 150, max: 350, target: 250 },
        medium: { min: 350, max: 700, target: 500 },
        long: { min: 700, max: 1200, target: 900 }
    },
    deepStudy: {
        medium: { min: 500, max: 1200, target: 800 },
        long: { min: 1200, max: 2500, target: 1800 },
        comprehensive: { min: 2500, max: 5000, target: 3500 }
    }
};

// Intent detection keywords
const INTENT_SIGNALS = {
    quick: {
        en: [
            'quick', 'brief', 'short', 'fast', 'tldr', 'summary', 'key points',
            'just tell me', 'in short', 'quickly', 'one sentence', 'yes or no'
        ],
        pl: [
            'szybko', 'krótko', 'w skrócie', 'główne punkty', 'podsumuj',
            'tylko powiedz', 'jednym zdaniem', 'tak czy nie', 'w telegrafie'
        ]
    },
    deepStudy: {
        en: [
            'explain', 'detail', 'comprehensive', 'deep dive', 'thorough', 'analyze',
            'full analysis', 'in depth', 'complete', 'elaborate', 'everything about',
            'step by step', 'walk me through', 'help me understand'
        ],
        pl: [
            'wyjaśnij', 'szczegółowo', 'dokładnie', 'analiza', 'kompleksowo',
            'pełna analiza', 'dogłębnie', 'wszystko o', 'krok po kroku',
            'przeprowadź mnie', 'pomóż zrozumieć', 'rozwiń'
        ]
    }
};

// Question complexity indicators
const COMPLEXITY_INDICATORS = {
    simple: ['what is', 'how do i', 'can you', 'is it', 'co to', 'jak', 'czy'],
    complex: ['why does', 'compare', 'analyze', 'evaluate', 'dlaczego', 'porównaj', 'oceń']
};

class AdaptiveResponseService {
    constructor() {
        this.userPreferencesCache = new Map();
        this.feedbackBuffer = [];
    }

    /**
     * Determine the response mode based on user preferences and message intent
     * 
     * @param {string} userId - User ID
     * @param {string} userMessage - The user's message
     * @param {Object} preferences - User's AI preferences
     * @returns {Object} Response mode configuration
     */
    async determineResponseMode(userId, userMessage, preferences = {}) {
        // 1. Get default mode from preferences
        const defaultMode = preferences?.contextualBehavior?.chatMode || 'standard';
        
        // 2. Check if auto-detect is enabled
        const autoDetect = preferences?.contextualBehavior?.autoDetectIntent !== false;
        
        let detectedMode = null;
        let confidence = 0;
        
        if (autoDetect) {
            // 3. Detect intent from message
            const intentResult = this.detectIntent(userMessage);
            detectedMode = intentResult.mode;
            confidence = intentResult.confidence;
        }
        
        // 4. If no strong signal, try to learn from past feedback
        if (!detectedMode || confidence < 0.6) {
            const learnedMode = await this.getLearnedPreference(userId, userMessage);
            if (learnedMode) {
                detectedMode = learnedMode;
                confidence = 0.5;
            }
        }
        
        // 5. Determine final mode
        const finalMode = (detectedMode && confidence >= 0.5) ? detectedMode : defaultMode;
        
        // 6. Get length settings for the mode
        const lengthSetting = this.getLengthSetting(finalMode, preferences);
        const tokenLimits = RESPONSE_LENGTH_TOKENS[finalMode][lengthSetting];
        
        return {
            mode: finalMode,
            lengthSetting,
            tokenLimits,
            confidence,
            wasAutoDetected: detectedMode !== null && confidence >= 0.5,
            defaultMode
        };
    }

    /**
     * Detect intent from user message
     */
    detectIntent(message) {
        if (!message) return { mode: null, confidence: 0 };
        
        const lowerMessage = message.toLowerCase();
        
        // Check for quick intent signals
        const quickSignals = [...INTENT_SIGNALS.quick.en, ...INTENT_SIGNALS.quick.pl];
        const quickMatches = quickSignals.filter(signal => lowerMessage.includes(signal));
        
        // Check for deep study intent signals
        const deepSignals = [...INTENT_SIGNALS.deepStudy.en, ...INTENT_SIGNALS.deepStudy.pl];
        const deepMatches = deepSignals.filter(signal => lowerMessage.includes(signal));
        
        // Calculate confidence based on matches
        if (quickMatches.length > deepMatches.length && quickMatches.length > 0) {
            return {
                mode: 'quick',
                confidence: Math.min(0.5 + (quickMatches.length * 0.15), 0.95),
                signals: quickMatches
            };
        }
        
        if (deepMatches.length > quickMatches.length && deepMatches.length > 0) {
            return {
                mode: 'deepStudy',
                confidence: Math.min(0.5 + (deepMatches.length * 0.15), 0.95),
                signals: deepMatches
            };
        }
        
        // Analyze message structure
        const wordCount = message.split(/\s+/).length;
        const questionMarks = (message.match(/\?/g) || []).length;
        const hasMultipleParts = message.includes(',') || message.includes(' i ') || message.includes(' and ');
        
        // Very short messages likely want quick responses
        if (wordCount < 8 && questionMarks <= 1 && !hasMultipleParts) {
            return { mode: 'quick', confidence: 0.4 };
        }
        
        // Long, complex messages might want detailed responses
        if (wordCount > 40 || questionMarks > 2 || hasMultipleParts) {
            return { mode: 'deepStudy', confidence: 0.4 };
        }
        
        return { mode: null, confidence: 0 };
    }

    /**
     * Get learned preference based on past feedback
     */
    async getLearnedPreference(userId, message) {
        return new Promise((resolve) => {
            // Get recent feedback patterns
            db.all(`
                SELECT wanted_mode, COUNT(*) as count
                FROM ai_response_feedback
                WHERE user_id = ? 
                  AND wanted_mode IS NOT NULL
                  AND created_at > datetime('now', '-30 days')
                GROUP BY wanted_mode
                ORDER BY count DESC
                LIMIT 1
            `, [userId], (err, rows) => {
                if (err || !rows || rows.length === 0) {
                    return resolve(null);
                }
                
                // Return most common wanted mode if it's significant
                const topMode = rows[0];
                if (topMode.count >= 3) {
                    return resolve(topMode.wanted_mode);
                }
                
                resolve(null);
            });
        });
    }

    /**
     * Get length setting for a mode from preferences
     */
    getLengthSetting(mode, preferences) {
        const responseLength = preferences?.responseLength || {};
        
        const defaults = {
            quick: 'short',
            standard: 'medium',
            deepStudy: 'long'
        };
        
        return responseLength[mode] || defaults[mode];
    }

    /**
     * Build the response mode prompt modifier
     */
    buildResponseModePrompt(modeConfig, preferences = {}) {
        const { mode, tokenLimits, lengthSetting } = modeConfig;
        const formatting = preferences?.formatting || {};
        
        const modePrompts = {
            quick: `
RESPONSE MODE: QUICK (${lengthSetting})
Response Guidelines:
- Be extremely concise and direct
- Target: ${tokenLimits.target} tokens (max: ${tokenLimits.max})
- Use bullet points for multiple items
- Skip introductions and elaborate conclusions
- Focus only on the most essential information
- No elaboration unless absolutely necessary
- If asked yes/no, start with the answer
${formatting.preferBulletPoints ? '- Prefer bullet point lists' : ''}`,

            standard: `
RESPONSE MODE: STANDARD (${lengthSetting})
Response Guidelines:
- Provide balanced, informative responses
- Target: ${tokenLimits.target} tokens (max: ${tokenLimits.max})
- Include brief explanations where helpful
- Use structure (headers, bullets) for clarity
- Include 1-2 examples if relevant
- Be thorough but not exhaustive
${formatting.preferTables ? '- Use tables when comparing items' : ''}
${formatting.includeActionItems ? '- Include actionable next steps when relevant' : ''}`,

            deepStudy: `
RESPONSE MODE: DEEP STUDY (${lengthSetting})
Response Guidelines:
- Provide comprehensive, detailed analysis
- Target: ${tokenLimits.target} tokens (max: ${tokenLimits.max})
- Include thorough explanations and context
- Use clear structure with headers and sections
- Provide multiple examples with explanations
- Include related considerations and implications
- Add actionable recommendations
- Consider edge cases and alternatives
${formatting.preferTables ? '- Use tables for comparisons and data' : ''}
${formatting.includeExamples === 'detailed' ? '- Include detailed real-world examples' : ''}
${formatting.includeActionItems ? '- Provide comprehensive action items' : ''}`
        };

        return modePrompts[mode] || modePrompts.standard;
    }

    /**
     * Process user feedback and learn from it
     */
    async processFeedback(userId, messageId, conversationId, feedback, context = {}) {
        const feedbackId = uuidv4();
        
        return new Promise((resolve, reject) => {
            db.run(`
                INSERT INTO ai_response_feedback 
                (id, user_id, message_id, conversation_id, rating, length_feedback, 
                 detail_feedback, format_feedback, wanted_mode, custom_feedback,
                 response_mode_used, response_length_actual, capability_used, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            `, [
                feedbackId,
                userId,
                messageId,
                conversationId,
                feedback.rating,
                feedback.lengthFeedback || null,
                feedback.detailFeedback || null,
                feedback.formatFeedback || null,
                feedback.wantedMode || null,
                feedback.customFeedback || null,
                context.responseMode || null,
                context.responseLength || null,
                context.capability || null
            ], async (err) => {
                if (err) {
                    console.error('[AdaptiveResponse] Error storing feedback:', err);
                    return reject(err);
                }
                
                // Trigger learning adjustments
                await this.triggerLearningAdjustments(userId, feedback);
                
                resolve({ feedbackId, processed: true });
            });
        });
    }

    /**
     * Trigger learning adjustments based on accumulated feedback
     */
    async triggerLearningAdjustments(userId, latestFeedback) {
        // Get recent feedback patterns
        return new Promise((resolve) => {
            db.all(`
                SELECT 
                    length_feedback,
                    wanted_mode,
                    COUNT(*) as count
                FROM ai_response_feedback
                WHERE user_id = ?
                  AND created_at > datetime('now', '-7 days')
                GROUP BY length_feedback, wanted_mode
            `, [userId], (err, rows) => {
                if (err || !rows) return resolve();
                
                // Check for consistent "too long" feedback
                const tooLongCount = rows.find(r => r.length_feedback === 'too_long')?.count || 0;
                const tooShortCount = rows.find(r => r.length_feedback === 'too_short')?.count || 0;
                
                if (tooLongCount >= 3) {
                    this.adjustLengthPreference(userId, 'shorter');
                } else if (tooShortCount >= 3) {
                    this.adjustLengthPreference(userId, 'longer');
                }
                
                // Check for consistent mode preference
                const modePreferences = rows.filter(r => r.wanted_mode);
                if (modePreferences.length > 0) {
                    const topMode = modePreferences.sort((a, b) => b.count - a.count)[0];
                    if (topMode.count >= 5) {
                        this.updateUserModePreference(userId, topMode.wanted_mode);
                    }
                }
                
                resolve();
            });
        });
    }

    /**
     * Adjust user's length preference
     */
    async adjustLengthPreference(userId, direction) {
        const lengthOrder = {
            quick: ['ultra_short', 'short', 'medium'],
            standard: ['short', 'medium', 'long'],
            deepStudy: ['medium', 'long', 'comprehensive']
        };
        
        return new Promise((resolve) => {
            db.get('SELECT * FROM user_ai_profiles WHERE user_id = ?', [userId], (err, profile) => {
                if (err || !profile) return resolve();
                
                const modes = ['quick', 'standard', 'deep_study'];
                const updates = [];
                
                modes.forEach(mode => {
                    const key = `${mode}_length_preference`;
                    const currentValue = profile[key];
                    const orderKey = mode === 'deep_study' ? 'deepStudy' : mode;
                    const order = lengthOrder[orderKey];
                    const currentIndex = order.indexOf(currentValue);
                    
                    if (currentIndex === -1) return;
                    
                    let newIndex;
                    if (direction === 'shorter') {
                        newIndex = Math.max(0, currentIndex - 1);
                    } else {
                        newIndex = Math.min(order.length - 1, currentIndex + 1);
                    }
                    
                    if (newIndex !== currentIndex) {
                        updates.push({ key, value: order[newIndex] });
                    }
                });
                
                if (updates.length === 0) return resolve();
                
                const setClause = updates.map(u => `${u.key} = ?`).join(', ');
                const values = updates.map(u => u.value);
                
                db.run(
                    `UPDATE user_ai_profiles SET ${setClause} WHERE user_id = ?`,
                    [...values, userId],
                    (err) => {
                        if (err) console.error('[AdaptiveResponse] Error adjusting length:', err);
                        resolve();
                    }
                );
            });
        });
    }

    /**
     * Update user's default mode preference
     */
    async updateUserModePreference(userId, mode) {
        return new Promise((resolve) => {
            db.run(
                'UPDATE user_ai_profiles SET response_mode_preference = ? WHERE user_id = ?',
                [mode, userId],
                (err) => {
                    if (err) console.error('[AdaptiveResponse] Error updating mode:', err);
                    resolve();
                }
            );
        });
    }

    /**
     * Get user's feedback statistics
     */
    async getUserFeedbackStats(userId) {
        return new Promise((resolve) => {
            db.get(`
                SELECT * FROM v_user_satisfaction WHERE user_id = ?
            `, [userId], (err, stats) => {
                if (err) {
                    console.error('[AdaptiveResponse] Error getting stats:', err);
                    return resolve(null);
                }
                resolve(stats);
            });
        });
    }

    /**
     * Get recommended mode based on historical data
     */
    async getRecommendedMode(userId) {
        return new Promise((resolve) => {
            db.get(`
                SELECT response_mode_preference, satisfaction_score
                FROM user_ai_profiles
                WHERE user_id = ?
            `, [userId], (err, profile) => {
                if (err || !profile) return resolve('standard');
                resolve(profile.response_mode_preference || 'standard');
            });
        });
    }
}

// Export singleton
const adaptiveResponseService = new AdaptiveResponseService();

module.exports = {
    AdaptiveResponseService,
    adaptiveResponseService,
    RESPONSE_LENGTH_TOKENS,
    INTENT_SIGNALS
};

