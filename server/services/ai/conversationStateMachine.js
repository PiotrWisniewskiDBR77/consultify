/**
 * Conversation State Machine
 * 
 * Tracks the full conversation context including:
 * - Current phase in transformation journey
 * - Collected data points
 * - Pending questions
 * - User decisions made
 * - Active entities (project, assessment, initiatives)
 * 
 * Part of the Harvard-Level Co-Thinker AI System
 */

import { v4 as uuidv4 } from 'uuid';
import { aiLogger } from './logger.js';

// Memory types for conversation context
const MEMORY_TYPES = {
    FACT: 'fact',           // Stated facts about organization/project
    DECISION: 'decision',   // Decisions made during conversation
    PREFERENCE: 'preference', // User preferences discovered
    GOAL: 'goal',           // Stated goals and objectives
    CONSTRAINT: 'constraint', // Identified constraints
    QUESTION_ANSWERED: 'question_answered',
    CLARIFICATION: 'clarification'
};

// Consulting modes
const CONSULTING_MODES = {
    ADVISORY: 'advisory',       // Give advice when asked
    ASSISTED: 'assisted',       // Help fill in forms, suggest answers
    PROACTIVE: 'proactive',     // Actively drive the conversation
    AUTOPILOT: 'autopilot'      // Full automation with confirmation
};

// Response styles
const RESPONSE_STYLES = {
    CONCISE: 'concise',
    DETAILED: 'detailed',
    SOCRATIC: 'socratic'        // Ask questions to guide thinking
};

// Transformation phases
const PHASES = {
    DISCOVERY: 'discovery',
    ASSESSMENT: 'assessment',
    INITIATIVES: 'initiatives',
    ROADMAP: 'roadmap',
    EXECUTION: 'execution'
};

class ConversationStateMachine {
    constructor() {
        this.sessions = new Map();
        this.cleanupInterval = setInterval(() => this.cleanupExpiredSessions(), 30 * 60 * 1000);
    }

    /**
     * Get or create session state
     */
    getSession(sessionId) {
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, this.createInitialState(sessionId));
        }
        return this.sessions.get(sessionId);
    }

    /**
     * Create initial state for a new session
     */
    createInitialState(sessionId) {
        return {
            // Session identity
            sessionId: sessionId,
            userId: null,
            organizationId: null,
            projectId: null,
            
            // Journey position
            currentPhase: PHASES.DISCOVERY,
            currentActivity: 'initial_greeting',
            phaseProgress: {
                discovery: 0,
                assessment: 0,
                initiatives: 0,
                roadmap: 0,
                execution: 0
            },
            
            // Collected intelligence
            collectedData: {
                projectGoals: [],
                constraints: [],
                stakeholders: [],
                assessmentAnswers: {},
                decisions: [],
                preferences: {},
                facts: []
            },
            
            // Conversation flow
            pendingQuestions: [],
            askedQuestions: [],
            clarificationsNeeded: [],
            lastQuestion: null,
            
            // AI behavior
            consultingMode: CONSULTING_MODES.PROACTIVE,
            responseStyle: RESPONSE_STYLES.DETAILED,
            userExpertise: 'unknown',
            
            // Active entities
            activeEntities: {
                project: null,
                assessment: null,
                initiatives: [],
                roadmap: null
            },
            
            // Conversation memory
            shortTermMemory: [],  // Last 10 exchanges
            keyMoments: [],       // Important points to remember
            
            // Metadata
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messageCount: 0,
            lastActivityAt: new Date().toISOString()
        };
    }

    /**
     * Initialize session with user context
     */
    initializeSession(sessionId, context) {
        const state = this.getSession(sessionId);
        
        state.userId = context.userId;
        state.organizationId = context.organizationId;
        state.projectId = context.projectId;
        
        if (context.project) {
            state.activeEntities.project = context.project;
        }
        
        if (context.assessment) {
            state.activeEntities.assessment = context.assessment;
            state.currentPhase = PHASES.ASSESSMENT;
        }
        
        if (context.initiatives && context.initiatives.length > 0) {
            state.activeEntities.initiatives = context.initiatives;
            state.currentPhase = PHASES.INITIATIVES;
        }
        
        if (context.roadmap) {
            state.activeEntities.roadmap = context.roadmap;
            state.currentPhase = PHASES.ROADMAP;
        }
        
        state.updatedAt = new Date().toISOString();
        
        aiLogger.debug('ConversationState', `Session ${sessionId} initialized`, {
            phase: state.currentPhase,
            hasProject: !!state.activeEntities.project
        });
        
        return state;
    }

    /**
     * Record a user message and update state
     */
    recordUserMessage(sessionId, message, intent) {
        const state = this.getSession(sessionId);
        
        // Add to short-term memory
        state.shortTermMemory.push({
            role: 'user',
            content: message,
            intent: intent?.intent,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 20 exchanges
        if (state.shortTermMemory.length > 20) {
            state.shortTermMemory = state.shortTermMemory.slice(-20);
        }
        
        // Update phase if intent suggests transition
        if (intent?.phase && intent.phase !== 'any') {
            this.updatePhase(sessionId, intent.phase);
        }
        
        state.messageCount++;
        state.lastActivityAt = new Date().toISOString();
        state.updatedAt = new Date().toISOString();
        
        return state;
    }

    /**
     * Record AI response
     */
    recordAIResponse(sessionId, response, metadata = {}) {
        const state = this.getSession(sessionId);
        
        state.shortTermMemory.push({
            role: 'assistant',
            content: response,
            metadata: metadata,
            timestamp: new Date().toISOString()
        });
        
        if (state.shortTermMemory.length > 20) {
            state.shortTermMemory = state.shortTermMemory.slice(-20);
        }
        
        // Track if we asked a question
        if (metadata.askedQuestion) {
            state.lastQuestion = {
                question: metadata.askedQuestion,
                type: metadata.questionType || 'general',
                timestamp: new Date().toISOString()
            };
            state.askedQuestions.push(metadata.askedQuestion);
        }
        
        state.updatedAt = new Date().toISOString();
        
        return state;
    }

    /**
     * Record a collected piece of information
     */
    recordCollectedData(sessionId, type, data) {
        const state = this.getSession(sessionId);
        
        switch (type) {
            case MEMORY_TYPES.FACT:
                state.collectedData.facts.push({
                    ...data,
                    collectedAt: new Date().toISOString()
                });
                break;
                
            case MEMORY_TYPES.GOAL:
                if (!state.collectedData.projectGoals.includes(data.goal)) {
                    state.collectedData.projectGoals.push(data.goal);
                }
                break;
                
            case MEMORY_TYPES.CONSTRAINT:
                if (!state.collectedData.constraints.includes(data.constraint)) {
                    state.collectedData.constraints.push(data.constraint);
                }
                break;
                
            case MEMORY_TYPES.DECISION:
                state.collectedData.decisions.push({
                    ...data,
                    decidedAt: new Date().toISOString()
                });
                // Also mark as key moment
                state.keyMoments.push({
                    type: 'decision',
                    summary: data.summary || data.decision,
                    timestamp: new Date().toISOString()
                });
                break;
                
            case MEMORY_TYPES.PREFERENCE:
                state.collectedData.preferences = {
                    ...state.collectedData.preferences,
                    ...data
                };
                break;
                
            case MEMORY_TYPES.QUESTION_ANSWERED:
                state.askedQuestions.push(data.question);
                if (data.answer) {
                    state.collectedData.assessmentAnswers[data.questionId] = data.answer;
                }
                break;
        }
        
        state.updatedAt = new Date().toISOString();
        
        aiLogger.debug('ConversationState', `Collected ${type}`, { sessionId, data });
        
        return state;
    }

    /**
     * Update current phase
     */
    updatePhase(sessionId, newPhase) {
        const state = this.getSession(sessionId);
        const oldPhase = state.currentPhase;
        
        if (oldPhase !== newPhase) {
            state.currentPhase = newPhase;
            
            // Record phase transition as key moment
            state.keyMoments.push({
                type: 'phase_transition',
                from: oldPhase,
                to: newPhase,
                timestamp: new Date().toISOString()
            });
            
            aiLogger.info('ConversationState', `Phase transition: ${oldPhase} -> ${newPhase}`, { sessionId });
        }
        
        state.updatedAt = new Date().toISOString();
        return state;
    }

    /**
     * Update phase progress
     */
    updatePhaseProgress(sessionId, phase, progress) {
        const state = this.getSession(sessionId);
        state.phaseProgress[phase] = Math.min(1, Math.max(0, progress));
        state.updatedAt = new Date().toISOString();
        return state;
    }

    /**
     * Set active entity
     */
    setActiveEntity(sessionId, entityType, entity) {
        const state = this.getSession(sessionId);
        
        if (entityType === 'initiative') {
            // Initiatives are an array
            const existing = state.activeEntities.initiatives.find(i => i.id === entity.id);
            if (!existing) {
                state.activeEntities.initiatives.push(entity);
            }
        } else {
            state.activeEntities[entityType] = entity;
        }
        
        state.updatedAt = new Date().toISOString();
        return state;
    }

    /**
     * Add a pending question that needs to be asked
     */
    addPendingQuestion(sessionId, question) {
        const state = this.getSession(sessionId);
        
        // Avoid duplicates
        const exists = state.pendingQuestions.find(q => q.id === question.id);
        if (!exists) {
            state.pendingQuestions.push({
                id: question.id || uuidv4(),
                question: question.question,
                type: question.type || 'general',
                priority: question.priority || 'medium',
                phase: question.phase || state.currentPhase,
                addedAt: new Date().toISOString()
            });
        }
        
        state.updatedAt = new Date().toISOString();
        return state;
    }

    /**
     * Get next pending question
     */
    getNextPendingQuestion(sessionId) {
        const state = this.getSession(sessionId);
        
        // Sort by priority and phase relevance
        const sorted = [...state.pendingQuestions].sort((a, b) => {
            // Current phase questions first
            if (a.phase === state.currentPhase && b.phase !== state.currentPhase) return -1;
            if (b.phase === state.currentPhase && a.phase !== state.currentPhase) return 1;
            
            // Then by priority
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
        });
        
        return sorted[0] || null;
    }

    /**
     * Mark a pending question as answered and remove from queue
     */
    markQuestionAnswered(sessionId, questionId, answer) {
        const state = this.getSession(sessionId);
        
        state.pendingQuestions = state.pendingQuestions.filter(q => q.id !== questionId);
        
        this.recordCollectedData(sessionId, MEMORY_TYPES.QUESTION_ANSWERED, {
            questionId,
            answer
        });
        
        return state;
    }

    /**
     * Set consulting mode
     */
    setConsultingMode(sessionId, mode) {
        const state = this.getSession(sessionId);
        state.consultingMode = mode;
        state.updatedAt = new Date().toISOString();
        return state;
    }

    /**
     * Set response style
     */
    setResponseStyle(sessionId, style) {
        const state = this.getSession(sessionId);
        state.responseStyle = style;
        state.updatedAt = new Date().toISOString();
        return state;
    }

    /**
     * Set user expertise level
     */
    setUserExpertise(sessionId, expertise) {
        const state = this.getSession(sessionId);
        state.userExpertise = expertise;
        state.updatedAt = new Date().toISOString();
        return state;
    }

    /**
     * Get conversation summary for context injection
     */
    getConversationSummary(sessionId) {
        const state = this.getSession(sessionId);
        
        return {
            phase: state.currentPhase,
            phaseProgress: state.phaseProgress,
            
            // Collected intelligence
            goalsCount: state.collectedData.projectGoals.length,
            goals: state.collectedData.projectGoals.slice(0, 3),
            constraintsCount: state.collectedData.constraints.length,
            constraints: state.collectedData.constraints.slice(0, 3),
            decisionsCount: state.collectedData.decisions.length,
            recentDecisions: state.collectedData.decisions.slice(-3),
            
            // Active entities
            hasProject: !!state.activeEntities.project,
            projectName: state.activeEntities.project?.name,
            hasAssessment: !!state.activeEntities.assessment,
            initiativeCount: state.activeEntities.initiatives.length,
            hasRoadmap: !!state.activeEntities.roadmap,
            
            // Conversation state
            messageCount: state.messageCount,
            pendingQuestions: state.pendingQuestions.length,
            lastQuestion: state.lastQuestion?.question,
            
            // User profile
            expertise: state.userExpertise,
            consultingMode: state.consultingMode,
            responseStyle: state.responseStyle,
            
            // Key moments
            keyMomentsCount: state.keyMoments.length,
            recentKeyMoments: state.keyMoments.slice(-5)
        };
    }

    /**
     * Get recent conversation context for prompt building
     */
    getRecentContext(sessionId, maxMessages = 10) {
        const state = this.getSession(sessionId);
        
        return state.shortTermMemory.slice(-maxMessages).map(m => ({
            role: m.role,
            content: m.content
        }));
    }

    /**
     * Get collected data summary for prompt building
     */
    getCollectedDataSummary(sessionId) {
        const state = this.getSession(sessionId);
        const data = state.collectedData;
        
        let summary = '';
        
        if (data.projectGoals.length > 0) {
            summary += `\nUser's Goals: ${data.projectGoals.join('; ')}`;
        }
        
        if (data.constraints.length > 0) {
            summary += `\nConstraints: ${data.constraints.join('; ')}`;
        }
        
        if (data.decisions.length > 0) {
            const recentDecisions = data.decisions.slice(-3);
            summary += `\nRecent Decisions: ${recentDecisions.map(d => d.summary || d.decision).join('; ')}`;
        }
        
        if (Object.keys(data.preferences).length > 0) {
            summary += `\nUser Preferences: ${JSON.stringify(data.preferences)}`;
        }
        
        return summary.trim();
    }

    /**
     * Clear session
     */
    clearSession(sessionId) {
        this.sessions.delete(sessionId);
        aiLogger.debug('ConversationState', `Session ${sessionId} cleared`);
    }

    /**
     * Cleanup expired sessions (older than 4 hours)
     */
    cleanupExpiredSessions() {
        const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();
        
        for (const [sessionId, state] of this.sessions) {
            if (state.lastActivityAt < fourHoursAgo) {
                this.sessions.delete(sessionId);
                aiLogger.debug('ConversationState', `Expired session ${sessionId} cleaned up`);
            }
        }
    }

    /**
     * Export session state for persistence
     */
    exportSession(sessionId) {
        const state = this.getSession(sessionId);
        return JSON.parse(JSON.stringify(state));
    }

    /**
     * Import session state from persistence
     */
    importSession(sessionId, savedState) {
        this.sessions.set(sessionId, {
            ...savedState,
            updatedAt: new Date().toISOString()
        });
        return this.getSession(sessionId);
    }

    /**
     * Get all active sessions (for debugging)
     */
    getActiveSessions() {
        return Array.from(this.sessions.keys());
    }
}

// Singleton instance
const conversationStateMachine = new ConversationStateMachine();

export {
ConversationStateMachine,
    conversationStateMachine,
    MEMORY_TYPES,
    CONSULTING_MODES,
    RESPONSE_STYLES,
    PHASES
};

export default {
    ConversationStateMachine,
    conversationStateMachine,
    MEMORY_TYPES,
    CONSULTING_MODES,
    RESPONSE_STYLES,
    PHASES
};

