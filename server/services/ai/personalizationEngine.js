/**
 * Personalization Engine
 * 
 * Adapts AI behavior based on user preferences, communication style,
 * expertise level, and past interactions.
 * 
 * Part of the Harvard-Level Co-Thinker AI System
 */

const db = require('../../database');
const { aiLogger } = require('./logger');
import { v4 as uuidv4 } from 'uuid';

// Default user profile template
const DEFAULT_PROFILE = {
    communicationStyle: 'balanced',      // concise | balanced | detailed
    expertise: 'intermediate',           // novice | intermediate | expert | executive
    language: 'en',                       // en | pl
    preferredGreeting: 'professional',   // casual | professional | formal
    prefersTables: false,                 // Visual preference
    prefersCharts: false,
    prefersActionItems: true,
    preferredExamples: 'industry',       // generic | industry | company_specific
    decisionMakingStyle: 'collaborative', // decisive | collaborative | analytical
    riskTolerance: 'moderate',           // conservative | moderate | aggressive
    preferredPace: 'medium',             // fast | medium | thorough
    timeZone: 'Europe/Warsaw',
    workHours: { start: 9, end: 18 },
    focusAreas: [],                       // e.g., ['processes', 'digital_products']
    avoidTopics: [],                      // Topics user doesn't want discussed
    successfulPatterns: [],              // What worked well
    unsuccessfulPatterns: []             // What didn't work
};

// Communication style templates
const COMMUNICATION_STYLES = {
    concise: {
        maxLength: 300,
        useHeaders: false,
        bulletPoints: true,
        includeExplanations: false,
        exampleCount: 1,
        tone: 'direct'
    },
    balanced: {
        maxLength: 600,
        useHeaders: true,
        bulletPoints: true,
        includeExplanations: true,
        exampleCount: 2,
        tone: 'professional'
    },
    detailed: {
        maxLength: 1200,
        useHeaders: true,
        bulletPoints: true,
        includeExplanations: true,
        exampleCount: 3,
        tone: 'thorough'
    }
};

// Expertise-based language adjustments
const EXPERTISE_ADJUSTMENTS = {
    novice: {
        avoidJargon: true,
        defineTerms: true,
        useAnalogies: true,
        stepByStep: true,
        assumeKnowledge: false
    },
    intermediate: {
        avoidJargon: false,
        defineTerms: false,
        useAnalogies: true,
        stepByStep: false,
        assumeKnowledge: true
    },
    expert: {
        avoidJargon: false,
        defineTerms: false,
        useAnalogies: false,
        stepByStep: false,
        assumeKnowledge: true,
        includeAdvanced: true
    },
    executive: {
        avoidJargon: true,
        defineTerms: false,
        useAnalogies: false,
        stepByStep: false,
        assumeKnowledge: true,
        focusOnImpact: true,
        timeConstrained: true
    }
};

// Learning signals from interactions
const LEARNING_SIGNALS = {
    positive: [
        { pattern: 'thanks', weight: 0.3 },
        { pattern: 'helpful', weight: 0.5 },
        { pattern: 'perfect', weight: 0.7 },
        { pattern: 'exactly', weight: 0.6 },
        { pattern: 'great', weight: 0.4 },
        { pattern: 'świetnie', weight: 0.5 },
        { pattern: 'super', weight: 0.4 },
        { pattern: 'dobrze', weight: 0.3 }
    ],
    negative: [
        { pattern: 'too long', weight: -0.4 },
        { pattern: 'simpler', weight: -0.3 },
        { pattern: 'shorter', weight: -0.4 },
        { pattern: 'confused', weight: -0.5 },
        { pattern: "don't understand", weight: -0.5 },
        { pattern: 'za długie', weight: -0.4 },
        { pattern: 'prościej', weight: -0.3 },
        { pattern: 'nie rozumiem', weight: -0.5 }
    ],
    style_hints: [
        { pattern: 'bullet', weight: 1, field: 'bulletPoints' },
        { pattern: 'table', weight: 1, field: 'prefersTables' },
        { pattern: 'chart', weight: 1, field: 'prefersCharts' },
        { pattern: 'example', weight: 1, field: 'examples' },
        { pattern: 'działania', weight: 1, field: 'prefersActionItems' }
    ]
};

class PersonalizationEngine {
    constructor() {
        this.profileCache = new Map();
        this.interactionBuffer = new Map(); // Buffer for batch learning
    }

    /**
     * Get or create user profile
     * @param {string} userId 
     * @returns {Object} User profile
     */
    async getProfile(userId) {
        // Check cache first
        if (this.profileCache.has(userId)) {
            return this.profileCache.get(userId);
        }

        return new Promise((resolve, reject) => {
            db.get(
                'SELECT * FROM user_ai_profiles WHERE user_id = ?',
                [userId],
                (err, row) => {
                    if (err) {
                        aiLogger.error('PersonalizationEngine', `Error getting profile: ${err.message}`);
                        resolve({ ...DEFAULT_PROFILE, userId });
                        return;
                    }

                    if (row) {
                        const profile = {
                            ...DEFAULT_PROFILE,
                            ...JSON.parse(row.preferences || '{}'),
                            userId,
                            id: row.id
                        };
                        this.profileCache.set(userId, profile);
                        resolve(profile);
                    } else {
                        // Create new profile
                        this.createProfile(userId).then(resolve).catch(() => {
                            resolve({ ...DEFAULT_PROFILE, userId });
                        });
                    }
                }
            );
        });
    }

    /**
     * Create a new user profile
     */
    async createProfile(userId) {
        const id = uuidv4();
        const now = new Date().toISOString();
        const preferences = JSON.stringify(DEFAULT_PROFILE);

        return new Promise((resolve, reject) => {
            db.run(
                `INSERT INTO user_ai_profiles (id, user_id, preferences, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?)`,
                [id, userId, preferences, now, now],
                function(err) {
                    if (err) {
                        // Table might not exist
                        if (err.message.includes('no such table')) {
                            resolve({ ...DEFAULT_PROFILE, userId });
                        } else {
                            reject(err);
                        }
                        return;
                    }

                    const profile = { ...DEFAULT_PROFILE, userId, id };
                    resolve(profile);
                }
            );
        });
    }

    /**
     * Update user profile
     */
    async updateProfile(userId, updates) {
        const profile = await this.getProfile(userId);
        const updatedProfile = { ...profile, ...updates };
        const now = new Date().toISOString();

        return new Promise((resolve, reject) => {
            db.run(
                `UPDATE user_ai_profiles 
                 SET preferences = ?, updated_at = ?
                 WHERE user_id = ?`,
                [JSON.stringify(updatedProfile), now, userId],
                (err) => {
                    if (err) {
                        reject(err);
                        return;
                    }

                    this.profileCache.set(userId, updatedProfile);
                    resolve(updatedProfile);
                }
            );
        });
    }

    /**
     * Get personalized response guidelines
     * @param {string} userId 
     * @param {Object} context - Current conversation context
     * @returns {Object} Response guidelines
     */
    async getResponseGuidelines(userId, context = {}) {
        const profile = await this.getProfile(userId);
        const styleConfig = COMMUNICATION_STYLES[profile.communicationStyle] || COMMUNICATION_STYLES.balanced;
        const expertiseConfig = EXPERTISE_ADJUSTMENTS[profile.expertise] || EXPERTISE_ADJUSTMENTS.intermediate;

        // Time-based adjustments
        const timeAdjustments = this.getTimeBasedAdjustments(profile);

        // Context-based adjustments
        const contextAdjustments = this.getContextAdjustments(context, profile);

        return {
            // Core style
            maxResponseLength: styleConfig.maxLength * contextAdjustments.lengthMultiplier,
            tone: styleConfig.tone,
            useHeaders: styleConfig.useHeaders,
            useBulletPoints: styleConfig.bulletPoints,
            includeExplanations: styleConfig.includeExplanations,
            
            // Expertise-based
            avoidJargon: expertiseConfig.avoidJargon,
            defineTerms: expertiseConfig.defineTerms,
            useAnalogies: expertiseConfig.useAnalogies,
            stepByStep: expertiseConfig.stepByStep,
            
            // User preferences
            prefersTables: profile.prefersTables,
            prefersCharts: profile.prefersCharts,
            prefersActionItems: profile.prefersActionItems,
            exampleType: profile.preferredExamples,
            exampleCount: styleConfig.exampleCount,
            
            // Language
            language: profile.language,
            
            // Focus
            focusAreas: profile.focusAreas,
            avoidTopics: profile.avoidTopics,
            
            // Time-based
            ...timeAdjustments,
            
            // Context-based
            urgency: contextAdjustments.urgency,
            depth: contextAdjustments.depth
        };
    }

    /**
     * Get time-based adjustments
     */
    getTimeBasedAdjustments(profile) {
        const now = new Date();
        const userHour = now.getHours(); // Simplified - would use timezone conversion
        const { start, end } = profile.workHours || { start: 9, end: 18 };

        const isWorkHours = userHour >= start && userHour < end;
        const isEarlyMorning = userHour < 9;
        const isLateEvening = userHour >= 20;

        return {
            isWorkHours,
            greetingStyle: isEarlyMorning ? 'morning' : (isLateEvening ? 'evening' : 'day'),
            suggestBreaks: !isWorkHours,
            moreConcisel: !isWorkHours // Be more concise outside work hours
        };
    }

    /**
     * Get context-based adjustments
     */
    getContextAdjustments(context, profile) {
        const { urgency = 'normal', topic, conversationLength = 0 } = context;

        let lengthMultiplier = 1;
        let depth = 'medium';

        // Adjust for urgency
        if (urgency === 'high') {
            lengthMultiplier = 0.7;
            depth = 'surface';
        }

        // Adjust for long conversations (fatigue)
        if (conversationLength > 10) {
            lengthMultiplier *= 0.85;
        }

        // Adjust for topic expertise
        if (profile.focusAreas && profile.focusAreas.includes(topic)) {
            depth = 'deep';
        }

        return {
            lengthMultiplier,
            depth,
            urgency
        };
    }

    /**
     * Get personalized greeting
     */
    async getGreeting(userId, context = {}) {
        const profile = await this.getProfile(userId);
        const { userName = 'there', timeOfDay = 'day' } = context;

        const greetings = {
            casual: {
                morning: `Hey ${userName}! 👋`,
                day: `Hi ${userName}!`,
                evening: `Hi ${userName}! Working late?`
            },
            professional: {
                morning: `Good morning, ${userName}.`,
                day: `Hello, ${userName}.`,
                evening: `Good evening, ${userName}.`
            },
            formal: {
                morning: `Good morning. How may I assist you today?`,
                day: `Hello. How may I be of service?`,
                evening: `Good evening. How may I help you?`
            }
        };

        const style = profile.preferredGreeting || 'professional';
        const time = timeOfDay || 'day';
        
        return greetings[style]?.[time] || greetings.professional.day;
    }

    /**
     * Learn from user interaction
     * @param {string} userId 
     * @param {Object} interaction - The interaction details
     */
    async learnFromInteraction(userId, interaction) {
        const { userMessage, aiResponse, feedback, followUp } = interaction;

        // Buffer interactions for batch processing
        if (!this.interactionBuffer.has(userId)) {
            this.interactionBuffer.set(userId, []);
        }
        this.interactionBuffer.get(userId).push(interaction);

        // Process batch if buffer is large enough
        if (this.interactionBuffer.get(userId).length >= 5) {
            await this.processBatch(userId);
        }

        // Immediate learning from explicit feedback
        if (feedback) {
            await this.processExplicitFeedback(userId, feedback);
        }

        // Learn from implicit signals
        if (userMessage) {
            await this.processImplicitSignals(userId, userMessage, aiResponse);
        }
    }

    /**
     * Process explicit feedback
     */
    async processExplicitFeedback(userId, feedback) {
        const profile = await this.getProfile(userId);
        const updates = {};

        if (feedback.tooLong) {
            // User indicated response was too long
            if (profile.communicationStyle === 'detailed') {
                updates.communicationStyle = 'balanced';
            } else if (profile.communicationStyle === 'balanced') {
                updates.communicationStyle = 'concise';
            }
        }

        if (feedback.tooShort) {
            if (profile.communicationStyle === 'concise') {
                updates.communicationStyle = 'balanced';
            } else if (profile.communicationStyle === 'balanced') {
                updates.communicationStyle = 'detailed';
            }
        }

        if (feedback.tooTechnical) {
            if (profile.expertise === 'expert') {
                updates.expertise = 'intermediate';
            } else if (profile.expertise === 'intermediate') {
                updates.expertise = 'novice';
            }
        }

        if (feedback.tooSimple) {
            if (profile.expertise === 'novice') {
                updates.expertise = 'intermediate';
            } else if (profile.expertise === 'intermediate') {
                updates.expertise = 'expert';
            }
        }

        if (feedback.preferredFormat) {
            if (feedback.preferredFormat === 'tables') {
                updates.prefersTables = true;
            } else if (feedback.preferredFormat === 'bullets') {
                updates.prefersTables = false;
            }
        }

        if (Object.keys(updates).length > 0) {
            await this.updateProfile(userId, updates);
            aiLogger.info('PersonalizationEngine', `Updated profile from feedback`, { userId, updates });
        }
    }

    /**
     * Process implicit signals from user messages
     */
    async processImplicitSignals(userId, userMessage, aiResponse) {
        const lowerMessage = userMessage.toLowerCase();

        // Check for positive signals
        for (const signal of LEARNING_SIGNALS.positive) {
            if (lowerMessage.includes(signal.pattern)) {
                await this.recordSuccessPattern(userId, aiResponse, signal.weight);
            }
        }

        // Check for negative signals
        for (const signal of LEARNING_SIGNALS.negative) {
            if (lowerMessage.includes(signal.pattern)) {
                await this.recordUnsuccessPattern(userId, aiResponse, signal.weight);
            }
        }

        // Check for style hints
        for (const hint of LEARNING_SIGNALS.style_hints) {
            if (lowerMessage.includes(hint.pattern)) {
                const profile = await this.getProfile(userId);
                await this.updateProfile(userId, { [hint.field]: true });
            }
        }
    }

    /**
     * Record successful pattern
     */
    async recordSuccessPattern(userId, response, weight) {
        const profile = await this.getProfile(userId);
        const pattern = {
            timestamp: new Date().toISOString(),
            responseLength: response?.length || 0,
            weight
        };

        const patterns = profile.successfulPatterns || [];
        patterns.push(pattern);

        // Keep only recent patterns
        const recentPatterns = patterns.slice(-50);

        await this.updateProfile(userId, { successfulPatterns: recentPatterns });
    }

    /**
     * Record unsuccessful pattern
     */
    async recordUnsuccessPattern(userId, response, weight) {
        const profile = await this.getProfile(userId);
        const pattern = {
            timestamp: new Date().toISOString(),
            responseLength: response?.length || 0,
            weight
        };

        const patterns = profile.unsuccessfulPatterns || [];
        patterns.push(pattern);

        const recentPatterns = patterns.slice(-50);

        await this.updateProfile(userId, { unsuccessfulPatterns: recentPatterns });
    }

    /**
     * Process batch of interactions
     */
    async processBatch(userId) {
        const interactions = this.interactionBuffer.get(userId) || [];
        if (interactions.length === 0) return;

        // Analyze patterns in batch
        const avgResponseLength = interactions
            .map(i => i.aiResponse?.length || 0)
            .reduce((a, b) => a + b, 0) / interactions.length;

        const positiveCount = interactions.filter(i => 
            LEARNING_SIGNALS.positive.some(s => 
                (i.followUp || '').toLowerCase().includes(s.pattern)
            )
        ).length;

        const profile = await this.getProfile(userId);

        // If mostly positive feedback with longer responses, user might prefer detailed
        if (positiveCount >= interactions.length * 0.7 && avgResponseLength > 500) {
            if (profile.communicationStyle === 'concise') {
                await this.updateProfile(userId, { communicationStyle: 'balanced' });
            }
        }

        // Clear buffer
        this.interactionBuffer.set(userId, []);
    }

    /**
     * Get personalization summary for prompts
     */
    async getPromptPersonalization(userId) {
        const profile = await this.getProfile(userId);
        const guidelines = await this.getResponseGuidelines(userId);

        return {
            instructions: this.buildPersonalizationInstructions(profile, guidelines),
            constraints: this.buildConstraints(guidelines),
            preferences: profile
        };
    }

    /**
     * Build personalization instructions for prompts
     */
    buildPersonalizationInstructions(profile, guidelines) {
        const instructions = [];

        // Communication style
        if (guidelines.tone === 'direct') {
            instructions.push('Be direct and concise. Skip unnecessary context.');
        } else if (guidelines.tone === 'thorough') {
            instructions.push('Provide comprehensive explanations with context.');
        }

        // Expertise level
        if (profile.expertise === 'novice') {
            instructions.push('Explain concepts simply. Avoid technical jargon. Use analogies.');
        } else if (profile.expertise === 'executive') {
            instructions.push('Focus on business impact. Be time-efficient. Lead with conclusions.');
        } else if (profile.expertise === 'expert') {
            instructions.push('Assume technical knowledge. Include advanced considerations.');
        }

        // Format preferences
        if (profile.prefersTables) {
            instructions.push('Use tables for comparisons and structured data.');
        }
        if (profile.prefersActionItems) {
            instructions.push('Include clear action items when relevant.');
        }

        // Language
        if (profile.language === 'pl') {
            instructions.push('Respond in Polish (język polski).');
        }

        return instructions.join(' ');
    }

    /**
     * Build constraints for response generation
     */
    buildConstraints(guidelines) {
        return {
            maxLength: guidelines.maxResponseLength,
            includeHeaders: guidelines.useHeaders,
            includeBullets: guidelines.useBulletPoints,
            maxExamples: guidelines.exampleCount
        };
    }

    /**
     * Clear profile cache
     */
    clearCache(userId = null) {
        if (userId) {
            this.profileCache.delete(userId);
        } else {
            this.profileCache.clear();
        }
    }
}

// Singleton instance
const personalizationEngine = new PersonalizationEngine();

export default {
    PersonalizationEngine,
    personalizationEngine,
    DEFAULT_PROFILE,
    COMMUNICATION_STYLES,
    EXPERTISE_ADJUSTMENTS,
    LEARNING_SIGNALS
};

