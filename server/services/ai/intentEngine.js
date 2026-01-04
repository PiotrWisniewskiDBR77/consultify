/**
 * Intent Engine - Understanding What User Wants
 * 
 * Enhanced intent recognition that goes beyond simple classification to understand:
 * - Primary Goal (what they want to achieve)
 * - Urgency (timeline pressure)
 * - Depth (surface-level or deep dive)
 * - Emotional State (frustrated, excited, uncertain)
 * - Expertise Level (novice, intermediate, expert)
 * 
 * Part of the Harvard-Level Co-Thinker AI System
 */

import { aiLogger } from './logger.js';

// Intent categories mapped to consulting workflow
const INTENT_TAXONOMY = {
    // Discovery Phase
    'START_PROJECT': { 
        phase: 'discovery', 
        action: 'create_project',
        priority: 'high',
        patterns: ['start project', 'new project', 'create project', 'begin assessment', 'nowy projekt', 'zacznij projekt', 'rozpocznij']
    },
    'UNDERSTAND_SITUATION': { 
        phase: 'discovery', 
        action: 'gather_context',
        priority: 'high',
        patterns: ['tell me about', 'what is the situation', 'explain', 'describe', 'opowiedz', 'wyjaśnij', 'jaka jest sytuacja']
    },
    'SET_GOALS': { 
        phase: 'discovery', 
        action: 'define_objectives',
        priority: 'high',
        patterns: ['set goals', 'objectives', 'targets', 'what do you want to achieve', 'cele', 'zamierzenia', 'co chcesz osiągnąć']
    },
    
    // Assessment Phase  
    'START_ASSESSMENT': { 
        phase: 'assessment', 
        action: 'begin_assessment',
        priority: 'high',
        patterns: ['start assessment', 'assess', 'evaluate maturity', 'check level', 'oceń', 'assessment', 'dojrzałość']
    },
    'EVALUATE_AXIS': { 
        phase: 'assessment', 
        action: 'assess_dimension',
        priority: 'medium',
        patterns: ['evaluate', 'rate', 'score', 'level for', 'ocenianie', 'poziom', 'oś', 'wymiar']
    },
    'COMPARE_BENCHMARKS': { 
        phase: 'assessment', 
        action: 'show_benchmarks',
        priority: 'medium',
        patterns: ['benchmark', 'compare', 'industry average', 'best in class', 'porównaj', 'benchmark', 'średnia branżowa']
    },
    
    // Initiatives Phase
    'GENERATE_IDEAS': { 
        phase: 'initiatives', 
        action: 'brainstorm',
        priority: 'high',
        patterns: ['generate', 'suggest', 'ideas', 'initiatives', 'recommendations', 'wygeneruj', 'zaproponuj', 'inicjatywy', 'pomysły']
    },
    'PRIORITIZE': { 
        phase: 'initiatives', 
        action: 'rank_initiatives',
        priority: 'high',
        patterns: ['prioritize', 'rank', 'order', 'most important', 'first', 'priorytetyzuj', 'ranking', 'kolejność', 'najpierw']
    },
    'DETAIL_INITIATIVE': { 
        phase: 'initiatives', 
        action: 'expand_initiative',
        priority: 'medium',
        patterns: ['detail', 'expand', 'elaborate', 'more about', 'tell me more', 'szczegóły', 'rozwiń', 'więcej o']
    },
    
    // Roadmap Phase
    'BUILD_TIMELINE': { 
        phase: 'roadmap', 
        action: 'create_roadmap',
        priority: 'high',
        patterns: ['roadmap', 'timeline', 'schedule', 'plan', 'when', 'harmonogram', 'roadmapa', 'kiedy', 'plan czasowy']
    },
    'OPTIMIZE_RESOURCES': { 
        phase: 'roadmap', 
        action: 'balance_workload',
        priority: 'medium',
        patterns: ['optimize', 'balance', 'resources', 'capacity', 'team', 'optymalizuj', 'zasoby', 'zespół', 'obciążenie']
    },
    'IDENTIFY_DEPENDENCIES': { 
        phase: 'roadmap', 
        action: 'map_dependencies',
        priority: 'medium',
        patterns: ['dependencies', 'sequence', 'order', 'prerequisite', 'before', 'zależności', 'kolejność', 'przed']
    },
    
    // Execution Phase
    'TRACK_PROGRESS': { 
        phase: 'execution', 
        action: 'show_status',
        priority: 'medium',
        patterns: ['progress', 'status', 'how are we doing', 'update', 'postęp', 'status', 'jak idzie', 'aktualizacja']
    },
    'RESOLVE_BLOCKER': { 
        phase: 'execution', 
        action: 'troubleshoot',
        priority: 'high',
        patterns: ['problem', 'issue', 'blocker', 'stuck', 'help', 'problem', 'blokada', 'utknąłem', 'pomoc']
    },
    'ADJUST_PLAN': { 
        phase: 'execution', 
        action: 'replan',
        priority: 'medium',
        patterns: ['change', 'adjust', 'modify', 'update plan', 'reschedule', 'zmień', 'dostosuj', 'modyfikuj', 'przeplanuj']
    },
    
    // Analysis & Reporting
    'ANALYZE_DATA': {
        phase: 'analysis',
        action: 'deep_analysis',
        priority: 'medium',
        patterns: ['analyze', 'analysis', 'insights', 'patterns', 'trends', 'analizuj', 'analiza', 'wnioski', 'trendy']
    },
    'GENERATE_REPORT': {
        phase: 'reporting',
        action: 'create_report',
        priority: 'high',
        patterns: ['report', 'summary', 'presentation', 'board', 'executive', 'raport', 'podsumowanie', 'prezentacja', 'zarząd']
    },
    
    // General Conversation
    'ASK_QUESTION': {
        phase: 'any',
        action: 'answer_question',
        priority: 'medium',
        patterns: ['what is', 'how does', 'why', 'explain', 'tell me', 'co to', 'jak', 'dlaczego', 'wyjaśnij']
    },
    'CLARIFY': {
        phase: 'any',
        action: 'clarify',
        priority: 'low',
        patterns: ['what do you mean', 'clarify', 'not sure', 'confused', 'nie rozumiem', 'wyjaśnij', 'co masz na myśli']
    },
    'GREETING': {
        phase: 'any',
        action: 'greet',
        priority: 'low',
        patterns: ['hello', 'hi', 'good morning', 'hey', 'cześć', 'dzień dobry', 'hej', 'witaj']
    }
};

// Urgency indicators
const URGENCY_PATTERNS = {
    high: ['urgent', 'asap', 'immediately', 'now', 'deadline', 'critical', 'pilne', 'natychmiast', 'teraz', 'deadline', 'krytyczne'],
    medium: ['soon', 'this week', 'next few days', 'important', 'wkrótce', 'ten tydzień', 'ważne'],
    low: ['when you can', 'no rush', 'eventually', 'sometime', 'kiedy możesz', 'bez pośpiechu', 'kiedyś']
};

// Emotional state indicators
const EMOTIONAL_PATTERNS = {
    frustrated: ['frustrated', 'annoyed', 'stuck', 'not working', 'failing', 'sfrustrowany', 'zdenerwowany', 'nie działa', 'utknąłem'],
    excited: ['excited', 'great', 'awesome', 'love', 'amazing', 'podekscytowany', 'świetnie', 'super', 'niesamowite'],
    uncertain: ['not sure', 'maybe', 'confused', 'don\'t know', 'unclear', 'nie wiem', 'może', 'zdezorientowany', 'niejasne'],
    confident: ['certain', 'sure', 'definitely', 'clearly', 'pewny', 'na pewno', 'zdecydowanie', 'jasne']
};

// Expertise level indicators
const EXPERTISE_PATTERNS = {
    novice: ['new to', 'beginner', 'first time', 'what is', 'explain basic', 'nowy w', 'początkujący', 'po raz pierwszy', 'co to jest'],
    intermediate: ['some experience', 'familiar with', 'understand basics', 'znam podstawy', 'mam doświadczenie'],
    expert: ['deep dive', 'technical details', 'advanced', 'specific', 'szczegóły techniczne', 'zaawansowane', 'specyficzne']
};

// Depth preference indicators
const DEPTH_PATTERNS = {
    surface: ['quick', 'brief', 'summary', 'overview', 'high level', 'szybko', 'krótko', 'przegląd', 'ogólnie'],
    moderate: ['explain', 'tell me about', 'understand', 'wyjaśnij', 'opowiedz', 'zrozumieć'],
    deep: ['detailed', 'comprehensive', 'thorough', 'all aspects', 'deep dive', 'szczegółowo', 'kompleksowo', 'dokładnie', 'wszystkie aspekty']
};

class IntentEngine {
    constructor() {
        this.taxonomy = INTENT_TAXONOMY;
        this.lastIntent = null;
        this.intentHistory = [];
    }

    /**
     * Analyze user input to understand intent, context, and emotional state
     * @param {string} input - User's message
     * @param {Object} context - Additional context (conversation history, current phase, etc.)
     * @returns {Object} Intent analysis result
     */
    async analyze(input, context = {}) {
        const startTime = Date.now();
        const normalizedInput = input.toLowerCase().trim();

        // Detect primary intent
        const primaryIntent = this.detectPrimaryIntent(normalizedInput);
        
        // Detect secondary signals
        const urgency = this.detectUrgency(normalizedInput);
        const emotionalState = this.detectEmotionalState(normalizedInput);
        const expertiseLevel = this.detectExpertiseLevel(normalizedInput, context);
        const depthPreference = this.detectDepthPreference(normalizedInput);
        
        // Extract entities (project names, axis names, numbers, etc.)
        const entities = this.extractEntities(normalizedInput, context);
        
        // Determine if this is a follow-up to previous intent
        const isFollowUp = this.isFollowUpIntent(primaryIntent, context);
        
        // Calculate confidence
        const confidence = this.calculateConfidence(primaryIntent, entities, context);

        const result = {
            // Primary classification
            intent: primaryIntent.intent,
            phase: primaryIntent.phase,
            action: primaryIntent.action,
            confidence: confidence,
            
            // Contextual signals
            urgency: urgency,
            emotionalState: emotionalState,
            expertiseLevel: expertiseLevel,
            depthPreference: depthPreference,
            
            // Extracted data
            entities: entities,
            
            // Meta
            isFollowUp: isFollowUp,
            previousIntent: this.lastIntent,
            rawInput: input,
            processingTimeMs: Date.now() - startTime
        };

        // Update history
        this.intentHistory.push({
            timestamp: new Date().toISOString(),
            intent: result.intent,
            confidence: result.confidence
        });
        this.lastIntent = result;

        aiLogger.debug('IntentEngine', `Analyzed intent: ${result.intent} (${result.confidence.toFixed(2)})`, {
            phase: result.phase,
            urgency: result.urgency,
            emotional: result.emotionalState
        });

        return result;
    }

    /**
     * Detect primary intent from user input
     */
    detectPrimaryIntent(input) {
        let bestMatch = {
            intent: 'ASK_QUESTION',
            phase: 'any',
            action: 'answer_question',
            score: 0
        };

        for (const [intentKey, intentConfig] of Object.entries(this.taxonomy)) {
            const patterns = intentConfig.patterns || [];
            let matchScore = 0;
            
            for (const pattern of patterns) {
                if (input.includes(pattern.toLowerCase())) {
                    // Exact phrase match gets higher score
                    matchScore += pattern.split(' ').length * 2;
                } else {
                    // Check individual words
                    const words = pattern.toLowerCase().split(' ');
                    for (const word of words) {
                        if (word.length > 2 && input.includes(word)) {
                            matchScore += 1;
                        }
                    }
                }
            }

            // Apply priority bonus
            if (intentConfig.priority === 'high') matchScore *= 1.2;
            if (intentConfig.priority === 'medium') matchScore *= 1.0;
            if (intentConfig.priority === 'low') matchScore *= 0.8;

            if (matchScore > bestMatch.score) {
                bestMatch = {
                    intent: intentKey,
                    phase: intentConfig.phase,
                    action: intentConfig.action,
                    score: matchScore
                };
            }
        }

        return bestMatch;
    }

    /**
     * Detect urgency level from input
     */
    detectUrgency(input) {
        for (const [level, patterns] of Object.entries(URGENCY_PATTERNS)) {
            for (const pattern of patterns) {
                if (input.includes(pattern.toLowerCase())) {
                    return level;
                }
            }
        }
        return 'normal';
    }

    /**
     * Detect emotional state from input
     */
    detectEmotionalState(input) {
        const states = [];
        for (const [state, patterns] of Object.entries(EMOTIONAL_PATTERNS)) {
            for (const pattern of patterns) {
                if (input.includes(pattern.toLowerCase())) {
                    states.push(state);
                    break;
                }
            }
        }
        return states.length > 0 ? states[0] : 'neutral';
    }

    /**
     * Detect expertise level from input and context
     */
    detectExpertiseLevel(input, context) {
        // Check input patterns
        for (const [level, patterns] of Object.entries(EXPERTISE_PATTERNS)) {
            for (const pattern of patterns) {
                if (input.includes(pattern.toLowerCase())) {
                    return level;
                }
            }
        }
        
        // Use context if available
        if (context.userExpertise) {
            return context.userExpertise;
        }
        
        // Default based on conversation history
        if (context.conversationCount > 10) {
            return 'intermediate';
        }
        
        return 'unknown';
    }

    /**
     * Detect preferred depth of response
     */
    detectDepthPreference(input) {
        for (const [depth, patterns] of Object.entries(DEPTH_PATTERNS)) {
            for (const pattern of patterns) {
                if (input.includes(pattern.toLowerCase())) {
                    return depth;
                }
            }
        }
        return 'moderate';
    }

    /**
     * Extract entities from input (project names, axis names, numbers, etc.)
     */
    extractEntities(input, context) {
        const entities = {
            projectName: null,
            axisName: null,
            initiativeName: null,
            numbers: [],
            dates: [],
            mentions: []
        };

        // Extract numbers
        const numberMatches = input.match(/\d+(\.\d+)?/g);
        if (numberMatches) {
            entities.numbers = numberMatches.map(n => parseFloat(n));
        }

        // Extract percentages
        const percentMatches = input.match(/\d+\s*%/g);
        if (percentMatches) {
            entities.percentages = percentMatches.map(p => parseFloat(p));
        }

        // Extract axis references
        const axisPatterns = [
            { pattern: /procesy|processes/i, axis: 'processes' },
            { pattern: /produkty|products/i, axis: 'digitalProducts' },
            { pattern: /modele biznesowe|business models/i, axis: 'businessModels' },
            { pattern: /dane|data|big data/i, axis: 'dataManagement' },
            { pattern: /kultura|culture/i, axis: 'culture' },
            { pattern: /cyber|bezpiecze|security/i, axis: 'cybersecurity' },
            { pattern: /ai|sztuczn|artificial/i, axis: 'aiMaturity' }
        ];

        for (const { pattern, axis } of axisPatterns) {
            if (pattern.test(input)) {
                entities.axisName = axis;
                break;
            }
        }

        // Extract time references
        const timePatterns = [
            { pattern: /kwartał|quarter|q[1-4]/i, type: 'quarter' },
            { pattern: /rok|year|annual/i, type: 'year' },
            { pattern: /miesi[aą]c|month/i, type: 'month' },
            { pattern: /tydzień|week/i, type: 'week' }
        ];

        for (const { pattern, type } of timePatterns) {
            const match = input.match(pattern);
            if (match) {
                entities.timeframe = type;
                break;
            }
        }

        // If context has active project, check for references
        if (context.activeProject) {
            entities.projectId = context.activeProject.id;
            entities.projectName = context.activeProject.name;
        }

        return entities;
    }

    /**
     * Determine if current intent is a follow-up to previous conversation
     */
    isFollowUpIntent(currentIntent, context) {
        if (!this.lastIntent) return false;
        
        // Same phase usually indicates continuation
        if (currentIntent.phase === this.lastIntent.phase) {
            return true;
        }

        // Check for explicit follow-up markers
        const followUpMarkers = ['also', 'and', 'next', 'then', 'również', 'i', 'następnie', 'potem'];
        const input = context.rawInput?.toLowerCase() || '';
        
        return followUpMarkers.some(marker => input.startsWith(marker));
    }

    /**
     * Calculate confidence score for the detected intent
     */
    calculateConfidence(primaryIntent, entities, context) {
        let confidence = 0.5; // Base confidence

        // Higher score means higher confidence
        if (primaryIntent.score > 5) confidence += 0.3;
        else if (primaryIntent.score > 2) confidence += 0.2;
        else if (primaryIntent.score > 0) confidence += 0.1;

        // Entities boost confidence
        if (entities.axisName) confidence += 0.1;
        if (entities.projectId) confidence += 0.1;
        if (entities.numbers.length > 0) confidence += 0.05;

        // Context alignment boosts confidence
        if (context.currentPhase === primaryIntent.phase) {
            confidence += 0.1;
        }

        return Math.min(confidence, 1.0);
    }

    /**
     * Get suggested next actions based on intent
     */
    getSuggestedActions(intent) {
        const suggestions = {
            'START_PROJECT': ['Create new project', 'Import existing data', 'Use template'],
            'START_ASSESSMENT': ['Quick assessment', 'Full assessment', 'Review previous'],
            'GENERATE_IDEAS': ['Auto-generate initiatives', 'Use templates', 'Brainstorm together'],
            'BUILD_TIMELINE': ['Auto-generate roadmap', 'Manual planning', 'Import dates'],
            'GENERATE_REPORT': ['Executive summary', 'Full report', 'Custom sections']
        };

        return suggestions[intent] || ['Continue conversation', 'Show options', 'Get help'];
    }

    /**
     * Get the conversation phase recommendation based on current state
     */
    recommendPhase(context) {
        // If no project, start with discovery
        if (!context.activeProject) {
            return {
                recommended: 'discovery',
                reason: 'No active project - should start with project definition'
            };
        }

        // If assessment incomplete, continue assessment
        if (context.assessmentProgress < 0.8) {
            return {
                recommended: 'assessment',
                reason: `Assessment is ${Math.round(context.assessmentProgress * 100)}% complete`
            };
        }

        // If no initiatives, go to initiatives phase
        if (!context.initiativeCount || context.initiativeCount === 0) {
            return {
                recommended: 'initiatives',
                reason: 'Assessment complete, ready to generate initiatives'
            };
        }

        // If no roadmap, build roadmap
        if (!context.hasRoadmap) {
            return {
                recommended: 'roadmap',
                reason: 'Initiatives defined, ready to build roadmap'
            };
        }

        // Default to execution
        return {
            recommended: 'execution',
            reason: 'Roadmap defined, focus on execution'
        };
    }

    /**
     * Reset intent history (e.g., on new conversation)
     */
    resetHistory() {
        this.lastIntent = null;
        this.intentHistory = [];
    }

    /**
     * Get intent history for analysis
     */
    getHistory() {
        return this.intentHistory;
    }
}

// Singleton instance
const intentEngine = new IntentEngine();

export {
IntentEngine,
    intentEngine,
    INTENT_TAXONOMY,
    URGENCY_PATTERNS,
    EMOTIONAL_PATTERNS,
    EXPERTISE_PATTERNS,
    DEPTH_PATTERNS
};

export default {
    IntentEngine,
    intentEngine,
    INTENT_TAXONOMY,
    URGENCY_PATTERNS,
    EMOTIONAL_PATTERNS,
    EXPERTISE_PATTERNS,
    DEPTH_PATTERNS
};

