/**
 * Consulting Flow Engine
 * 
 * Implements the consulting methodology that guides conversations through
 * the digital transformation journey: Discovery -> Assessment -> Initiatives -> Roadmap -> Execution
 * 
 * Part of the Harvard-Level Co-Thinker AI System
 */

import { aiLogger } from './logger.js';
import { v4 as uuidv4 } from 'uuid';

// Transformation methodology definition
const TRANSFORMATION_METHODOLOGY = {
    phases: [
        {
            id: 'discovery',
            name: 'Discovery',
            namePl: 'Odkrywanie',
            description: 'Understanding the organization, goals, and constraints',
            duration: '1-2 sessions',
            order: 1,
            activities: [
                {
                    id: 'project_definition',
                    name: 'Project Definition',
                    required: true,
                    questions: [
                        { id: 'project_name', type: 'text', question: 'What should we call this transformation project?' },
                        { id: 'project_sponsor', type: 'text', question: 'Who is the executive sponsor for this initiative?' },
                        { id: 'project_trigger', type: 'text', question: 'What triggered this transformation initiative? What happened that made this a priority now?' }
                    ],
                    outputs: ['Project']
                },
                {
                    id: 'stakeholder_mapping',
                    name: 'Stakeholder Mapping',
                    required: true,
                    questions: [
                        { id: 'key_stakeholders', type: 'list', question: 'Who are the key stakeholders who will be affected by this transformation?' },
                        { id: 'decision_makers', type: 'text', question: 'Who has the authority to make decisions about budget and scope?' },
                        { id: 'potential_resistors', type: 'text', question: 'Who might resist this change, and why?' }
                    ],
                    outputs: ['Stakeholders']
                },
                {
                    id: 'goal_setting',
                    name: 'Goal Setting',
                    required: true,
                    questions: [
                        { id: 'primary_goal', type: 'text', question: 'In 12 months, what does success look like? Be specific.' },
                        { id: 'measurable_kpi', type: 'text', question: 'What specific KPI or metric will tell us we\'ve succeeded?' },
                        { id: 'business_impact', type: 'text', question: 'What\'s the expected business impact - in revenue, cost, or efficiency terms?' },
                        { id: 'timeline_constraint', type: 'text', question: 'Are there any hard deadlines we need to consider?' }
                    ],
                    outputs: ['Goals']
                },
                {
                    id: 'constraint_identification',
                    name: 'Constraint Identification',
                    required: false,
                    questions: [
                        { id: 'budget_range', type: 'choice', question: 'What\'s the approximate budget envelope for this transformation?', options: ['<100K EUR', '100K-500K EUR', '500K-2M EUR', '>2M EUR'] },
                        { id: 'team_capacity', type: 'text', question: 'How many FTEs can be dedicated to this initiative?' },
                        { id: 'technical_constraints', type: 'text', question: 'Are there any technical or legacy system constraints we should know about?' }
                    ],
                    outputs: ['Constraints']
                }
            ],
            outputs: ['Project', 'Goals', 'Stakeholders', 'Constraints'],
            transitionCriteria: {
                minCompleteness: 0.7,
                requiredOutputs: ['Project', 'Goals']
            },
            nextPhase: 'assessment'
        },
        {
            id: 'assessment',
            name: 'Assessment',
            namePl: 'Assessment Dojrzałości',
            description: 'Evaluating current digital maturity across key dimensions',
            duration: '2-3 sessions',
            order: 2,
            activities: [
                {
                    id: 'axis_evaluation',
                    name: 'Axis-by-Axis Evaluation',
                    required: true,
                    adaptive: true,
                    questions: 'per_axis', // Dynamic based on assessment framework
                    outputs: ['AxisScores']
                },
                {
                    id: 'evidence_collection',
                    name: 'Evidence Collection',
                    required: false,
                    questions: [
                        { id: 'evidence_request', type: 'text', question: 'For each score, can you provide a specific example or evidence?' }
                    ],
                    outputs: ['Evidence']
                },
                {
                    id: 'gap_analysis',
                    name: 'Gap Analysis',
                    required: true,
                    automated: true,
                    questions: [],
                    outputs: ['Gaps', 'QuickWins']
                }
            ],
            outputs: ['MaturityScores', 'Gaps', 'QuickWins'],
            transitionCriteria: {
                minAxesCompleted: 5,
                requiredOutputs: ['MaturityScores', 'Gaps']
            },
            nextPhase: 'initiatives'
        },
        {
            id: 'initiatives',
            name: 'Initiatives',
            namePl: 'Inicjatywy',
            description: 'Generating and prioritizing transformation initiatives',
            duration: '2-3 sessions',
            order: 3,
            activities: [
                {
                    id: 'initiative_generation',
                    name: 'Initiative Generation',
                    required: true,
                    questions: [
                        { id: 'generation_preference', type: 'choice', question: 'Would you like me to auto-generate initiatives based on your gaps, or brainstorm together?', options: ['Auto-generate', 'Brainstorm together', 'Both'] }
                    ],
                    outputs: ['InitiativeList']
                },
                {
                    id: 'initiative_prioritization',
                    name: 'Initiative Prioritization',
                    required: true,
                    questions: [
                        { id: 'prioritization_criteria', type: 'choice', question: 'What\'s most important for prioritization?', options: ['Impact first', 'Quick wins first', 'Cost efficiency', 'Strategic alignment'] }
                    ],
                    outputs: ['PrioritizedList']
                },
                {
                    id: 'initiative_detailing',
                    name: 'Initiative Detailing',
                    required: false,
                    questions: [
                        { id: 'detail_level', type: 'choice', question: 'How detailed should the initiative charters be?', options: ['High-level overview', 'Detailed charter', 'Full business case'] }
                    ],
                    outputs: ['InitiativeCharters']
                }
            ],
            outputs: ['Initiatives', 'PrioritizedList'],
            transitionCriteria: {
                minInitiatives: 5,
                requiredOutputs: ['Initiatives']
            },
            nextPhase: 'roadmap'
        },
        {
            id: 'roadmap',
            name: 'Roadmap',
            namePl: 'Roadmapa',
            description: 'Building the transformation timeline and resource plan',
            duration: '1-2 sessions',
            order: 4,
            activities: [
                {
                    id: 'timeline_building',
                    name: 'Timeline Building',
                    required: true,
                    questions: [
                        { id: 'timeline_horizon', type: 'choice', question: 'What timeframe should the roadmap cover?', options: ['6 months', '12 months', '18 months', '24 months'] },
                        { id: 'quarter_capacity', type: 'text', question: 'How many initiatives can your organization realistically execute per quarter?' }
                    ],
                    outputs: ['Timeline']
                },
                {
                    id: 'dependency_mapping',
                    name: 'Dependency Mapping',
                    required: true,
                    automated: true,
                    questions: [],
                    outputs: ['Dependencies']
                },
                {
                    id: 'resource_allocation',
                    name: 'Resource Allocation',
                    required: false,
                    questions: [
                        { id: 'resource_constraints', type: 'text', question: 'Are there specific resource bottlenecks we should plan around?' }
                    ],
                    outputs: ['ResourcePlan']
                }
            ],
            outputs: ['Roadmap', 'Timeline', 'Dependencies'],
            transitionCriteria: {
                requiredOutputs: ['Roadmap']
            },
            nextPhase: 'execution'
        },
        {
            id: 'execution',
            name: 'Execution',
            namePl: 'Realizacja',
            description: 'Tracking progress and adapting the plan',
            duration: 'Ongoing',
            order: 5,
            activities: [
                {
                    id: 'progress_tracking',
                    name: 'Progress Tracking',
                    required: true,
                    recurring: true,
                    questions: [
                        { id: 'status_update', type: 'text', question: 'What progress has been made since our last check-in?' },
                        { id: 'blockers', type: 'text', question: 'Are there any blockers or risks that need attention?' }
                    ],
                    outputs: ['StatusUpdate']
                },
                {
                    id: 'course_correction',
                    name: 'Course Correction',
                    required: false,
                    questions: [
                        { id: 'adjustment_needed', type: 'choice', question: 'Do we need to adjust the roadmap?', options: ['Yes, significant changes', 'Yes, minor adjustments', 'No, staying on track'] }
                    ],
                    outputs: ['AdjustedPlan']
                },
                {
                    id: 'benefits_realization',
                    name: 'Benefits Realization',
                    required: false,
                    questions: [
                        { id: 'benefits_realized', type: 'text', question: 'What benefits have been realized so far?' }
                    ],
                    outputs: ['BenefitsReport']
                }
            ],
            outputs: ['StatusUpdate', 'BenefitsReport'],
            transitionCriteria: {
                // Execution doesn't transition - it's the final phase
            },
            nextPhase: null
        }
    ]
};

// Question bank for axis evaluation
const AXIS_QUESTION_BANK = {
    processes: {
        name: 'Digital Processes',
        namePl: 'Procesy Cyfrowe',
        questions: [
            { id: 'proc_1', question: 'How would you describe the current level of process automation in your organization?' },
            { id: 'proc_2', question: 'Do you have documented, standardized processes across the organization?' },
            { id: 'proc_3', question: 'Are your key processes monitored with real-time KPIs?' },
            { id: 'proc_4', question: 'How do you handle process exceptions and escalations?' }
        ]
    },
    digitalProducts: {
        name: 'Digital Products',
        namePl: 'Produkty Cyfrowe',
        questions: [
            { id: 'prod_1', question: 'What percentage of your products/services have digital components?' },
            { id: 'prod_2', question: 'Do you collect and analyze usage data from your digital products?' },
            { id: 'prod_3', question: 'How quickly can you release new digital features or products?' }
        ]
    },
    businessModels: {
        name: 'Digital Business Models',
        namePl: 'Modele Biznesowe',
        questions: [
            { id: 'bm_1', question: 'What percentage of revenue comes from digital channels or products?' },
            { id: 'bm_2', question: 'Have you explored subscription or platform-based models?' },
            { id: 'bm_3', question: 'How are you using digital to create new revenue streams?' }
        ]
    },
    dataManagement: {
        name: 'Data Management',
        namePl: 'Zarządzanie Danymi',
        questions: [
            { id: 'data_1', question: 'Do you have a single source of truth for key business data?' },
            { id: 'data_2', question: 'How mature is your data governance framework?' },
            { id: 'data_3', question: 'Are business decisions regularly informed by data analytics?' },
            { id: 'data_4', question: 'What\'s your approach to data quality management?' }
        ]
    },
    culture: {
        name: 'Digital Culture',
        namePl: 'Kultura Cyfrowa',
        questions: [
            { id: 'cult_1', question: 'How would you describe leadership\'s commitment to digital transformation?' },
            { id: 'cult_2', question: 'Is there a culture of experimentation and learning from failure?' },
            { id: 'cult_3', question: 'How well do cross-functional teams collaborate on digital initiatives?' }
        ]
    },
    cybersecurity: {
        name: 'Cybersecurity',
        namePl: 'Cyberbezpieczeństwo',
        questions: [
            { id: 'sec_1', question: 'What\'s your current cybersecurity maturity level (if assessed)?' },
            { id: 'sec_2', question: 'Do you have an incident response plan tested within the last year?' },
            { id: 'sec_3', question: 'How is security integrated into your development lifecycle?' }
        ]
    },
    aiMaturity: {
        name: 'AI & Analytics',
        namePl: 'AI i Analityka',
        questions: [
            { id: 'ai_1', question: 'Are you currently using AI/ML in any production systems?' },
            { id: 'ai_2', question: 'What\'s your organization\'s AI strategy?' },
            { id: 'ai_3', question: 'Do you have the data infrastructure to support AI initiatives?' }
        ]
    }
};

class ConsultingFlowEngine {
    constructor() {
        this.methodology = TRANSFORMATION_METHODOLOGY;
        this.axisQuestions = AXIS_QUESTION_BANK;
    }

    /**
     * Get the current phase configuration
     */
    getPhase(phaseId) {
        return this.methodology.phases.find(p => p.id === phaseId);
    }

    /**
     * Get all phases in order
     */
    getAllPhases() {
        return this.methodology.phases.sort((a, b) => a.order - b.order);
    }

    /**
     * Get next phase based on current phase
     */
    getNextPhase(currentPhaseId) {
        const currentPhase = this.getPhase(currentPhaseId);
        if (!currentPhase || !currentPhase.nextPhase) return null;
        return this.getPhase(currentPhase.nextPhase);
    }

    /**
     * Check if phase can transition to next
     */
    canTransition(phaseId, state) {
        const phase = this.getPhase(phaseId);
        if (!phase || !phase.transitionCriteria) return true;

        const criteria = phase.transitionCriteria;
        const phaseProgress = state.phaseProgress || {};
        const outputs = state.outputs || [];

        // Check minimum completeness
        if (criteria.minCompleteness && (phaseProgress[phaseId] || 0) < criteria.minCompleteness) {
            return {
                canTransition: false,
                reason: `Phase is only ${Math.round((phaseProgress[phaseId] || 0) * 100)}% complete. Need ${criteria.minCompleteness * 100}%.`
            };
        }

        // Check required outputs
        if (criteria.requiredOutputs) {
            const missingOutputs = criteria.requiredOutputs.filter(o => !outputs.includes(o));
            if (missingOutputs.length > 0) {
                return {
                    canTransition: false,
                    reason: `Missing required outputs: ${missingOutputs.join(', ')}`
                };
            }
        }

        // Check minimum initiatives (for initiatives phase)
        if (criteria.minInitiatives && (state.initiativeCount || 0) < criteria.minInitiatives) {
            return {
                canTransition: false,
                reason: `Need at least ${criteria.minInitiatives} initiatives. Currently have ${state.initiativeCount || 0}.`
            };
        }

        // Check minimum axes (for assessment phase)
        if (criteria.minAxesCompleted && (state.axesCompleted || 0) < criteria.minAxesCompleted) {
            return {
                canTransition: false,
                reason: `Need to complete at least ${criteria.minAxesCompleted} axes. Currently have ${state.axesCompleted || 0}.`
            };
        }

        return { canTransition: true };
    }

    /**
     * Get next question to ask based on current state
     */
    getNextQuestion(state) {
        const phase = this.getPhase(state.currentPhase);
        if (!phase) return null;

        // Check pending questions first
        if (state.pendingQuestions && state.pendingQuestions.length > 0) {
            return state.pendingQuestions[0];
        }

        // Get current activity
        const currentActivity = this.getCurrentActivity(state);
        if (!currentActivity) return null;

        // For axis evaluation, return axis-specific questions
        if (currentActivity.id === 'axis_evaluation') {
            return this.getNextAxisQuestion(state);
        }

        // Get unanswered questions from current activity
        const answeredQuestions = state.askedQuestions || [];
        const unansweredQuestions = (currentActivity.questions || [])
            .filter(q => !answeredQuestions.includes(q.id));

        if (unansweredQuestions.length > 0) {
            return unansweredQuestions[0];
        }

        // Move to next activity
        const nextActivity = this.getNextActivity(state);
        if (nextActivity && nextActivity.questions && nextActivity.questions.length > 0) {
            return nextActivity.questions[0];
        }

        return null;
    }

    /**
     * Get current activity based on state
     */
    getCurrentActivity(state) {
        const phase = this.getPhase(state.currentPhase);
        if (!phase) return null;

        const activityId = state.currentActivity;
        if (activityId) {
            return phase.activities.find(a => a.id === activityId);
        }

        // Return first activity if none specified
        return phase.activities[0];
    }

    /**
     * Get next activity in the current phase
     */
    getNextActivity(state) {
        const phase = this.getPhase(state.currentPhase);
        if (!phase) return null;

        const currentIndex = phase.activities.findIndex(a => a.id === state.currentActivity);
        if (currentIndex === -1 || currentIndex >= phase.activities.length - 1) {
            return null;
        }

        return phase.activities[currentIndex + 1];
    }

    /**
     * Get next axis question for assessment phase
     */
    getNextAxisQuestion(state) {
        const assessmentAnswers = state.collectedData?.assessmentAnswers || {};
        const askedQuestions = state.askedQuestions || [];

        for (const [axisId, axisConfig] of Object.entries(this.axisQuestions)) {
            // Skip if axis is already scored
            if (assessmentAnswers[axisId]?.score !== undefined) continue;

            // Find unanswered question for this axis
            for (const question of axisConfig.questions) {
                if (!askedQuestions.includes(question.id)) {
                    return {
                        ...question,
                        axis: axisId,
                        axisName: axisConfig.name,
                        axisNamePl: axisConfig.namePl
                    };
                }
            }
        }

        return null;
    }

    /**
     * Calculate phase progress
     */
    calculatePhaseProgress(phaseId, state) {
        const phase = this.getPhase(phaseId);
        if (!phase) return 0;

        let totalWeight = 0;
        let completedWeight = 0;

        for (const activity of phase.activities) {
            const weight = activity.required ? 2 : 1;
            totalWeight += weight;

            if (this.isActivityComplete(activity, state)) {
                completedWeight += weight;
            } else if (this.isActivityPartial(activity, state)) {
                completedWeight += weight * this.getActivityProgress(activity, state);
            }
        }

        return totalWeight > 0 ? completedWeight / totalWeight : 0;
    }

    /**
     * Check if activity is complete
     */
    isActivityComplete(activity, state) {
        if (activity.automated) return true;

        const answeredQuestions = state.askedQuestions || [];
        
        if (activity.questions === 'per_axis') {
            // Check if all axes are scored
            const assessmentAnswers = state.collectedData?.assessmentAnswers || {};
            const axisCount = Object.keys(this.axisQuestions).length;
            const scoredAxes = Object.keys(assessmentAnswers).filter(k => 
                assessmentAnswers[k]?.score !== undefined
            ).length;
            return scoredAxes >= axisCount;
        }

        if (Array.isArray(activity.questions)) {
            return activity.questions.every(q => answeredQuestions.includes(q.id));
        }

        return true;
    }

    /**
     * Check if activity is partially complete
     */
    isActivityPartial(activity, state) {
        const answeredQuestions = state.askedQuestions || [];
        
        if (Array.isArray(activity.questions)) {
            return activity.questions.some(q => answeredQuestions.includes(q.id));
        }

        return false;
    }

    /**
     * Get activity progress (0-1)
     */
    getActivityProgress(activity, state) {
        if (activity.automated) return 1;

        const answeredQuestions = state.askedQuestions || [];
        
        if (activity.questions === 'per_axis') {
            const assessmentAnswers = state.collectedData?.assessmentAnswers || {};
            const axisCount = Object.keys(this.axisQuestions).length;
            const scoredAxes = Object.keys(assessmentAnswers).filter(k => 
                assessmentAnswers[k]?.score !== undefined
            ).length;
            return axisCount > 0 ? scoredAxes / axisCount : 0;
        }

        if (Array.isArray(activity.questions)) {
            const answered = activity.questions.filter(q => answeredQuestions.includes(q.id)).length;
            return activity.questions.length > 0 ? answered / activity.questions.length : 1;
        }

        return 1;
    }

    /**
     * Get recommended action based on current state
     */
    getRecommendedAction(state) {
        const phaseProgress = this.calculatePhaseProgress(state.currentPhase, state);
        const canTransitionResult = this.canTransition(state.currentPhase, {
            ...state,
            phaseProgress: { [state.currentPhase]: phaseProgress }
        });

        // If phase is complete, recommend transition
        if (canTransitionResult.canTransition && phaseProgress >= 0.9) {
            const nextPhase = this.getNextPhase(state.currentPhase);
            if (nextPhase) {
                return {
                    type: 'phase_transition',
                    action: `transition_to_${nextPhase.id}`,
                    message: `Great progress! You're ready to move to the ${nextPhase.name} phase.`,
                    priority: 'high'
                };
            }
        }

        // Get next question
        const nextQuestion = this.getNextQuestion(state);
        if (nextQuestion) {
            return {
                type: 'ask_question',
                action: 'ask',
                question: nextQuestion,
                priority: 'medium'
            };
        }

        // If blocked on transition
        if (!canTransitionResult.canTransition) {
            return {
                type: 'complete_requirements',
                action: 'gather_more',
                message: canTransitionResult.reason,
                priority: 'high'
            };
        }

        return {
            type: 'continue_conversation',
            action: 'engage',
            priority: 'low'
        };
    }

    /**
     * Get phase summary for display
     */
    getPhaseSummary(phaseId, state) {
        const phase = this.getPhase(phaseId);
        if (!phase) return null;

        const progress = this.calculatePhaseProgress(phaseId, state);
        const canTransitionResult = this.canTransition(phaseId, state);

        return {
            id: phase.id,
            name: phase.name,
            namePl: phase.namePl,
            description: phase.description,
            progress: progress,
            progressPercent: Math.round(progress * 100),
            canTransition: canTransitionResult.canTransition,
            transitionBlocker: canTransitionResult.reason,
            activities: phase.activities.map(a => ({
                id: a.id,
                name: a.name,
                required: a.required,
                complete: this.isActivityComplete(a, state),
                progress: this.getActivityProgress(a, state)
            })),
            outputs: phase.outputs,
            nextPhase: phase.nextPhase
        };
    }

    /**
     * Get all axis configurations
     */
    getAxisConfigurations() {
        return Object.entries(this.axisQuestions).map(([id, config]) => ({
            id,
            name: config.name,
            namePl: config.namePl,
            questionCount: config.questions.length
        }));
    }

    /**
     * Get questions for a specific axis
     */
    getAxisQuestions(axisId) {
        return this.axisQuestions[axisId] || null;
    }
}

// Singleton instance
const consultingFlowEngine = new ConsultingFlowEngine();

export {
ConsultingFlowEngine,
    consultingFlowEngine,
    TRANSFORMATION_METHODOLOGY,
    AXIS_QUESTION_BANK
};

export default {
    ConsultingFlowEngine,
    consultingFlowEngine,
    TRANSFORMATION_METHODOLOGY,
    AXIS_QUESTION_BANK
};

