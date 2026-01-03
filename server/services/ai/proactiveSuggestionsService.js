/**
 * Proactive Suggestions Service
 * 
 * AI proactively suggests actions and improvements based on:
 * - Current workspace context
 * - Project state analysis
 * - User behavior patterns
 * - "Did you mean?" functionality
 * 
 * Part of UX Excellence - Phase 4.3
 * 
 * @module proactiveSuggestionsService
 */

// Dependency injection for testing
const deps = {
    _db: null,
    _aiLogger: null,
    _uuidv4: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get aiLogger() { return this._aiLogger; },
    set aiLogger(val) { this._aiLogger = val; },

    get uuidv4() { return this._uuidv4; },
    set uuidv4(val) { this._uuidv4 = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: db } = await import('../../database.js');
        deps._db = db;
    }
    if (!deps._aiLogger) {
        const { aiLogger } = await import('./logger.js');
        deps._aiLogger = aiLogger;
    }
    if (!deps._uuidv4) {
        const { v4 } = await import('uuid');
        deps._uuidv4 = v4;
    }
}

/**
 * Set dependencies (for testing)
 */
function setDependencies(newDeps = {}) {
    if (newDeps.db) deps.db = newDeps.db;
    if (newDeps.aiLogger) deps.aiLogger = newDeps.aiLogger;
    if (newDeps.uuidv4) deps.uuidv4 = newDeps.uuidv4;
}

// Suggestion types
const SUGGESTION_TYPES = {
    QUICK_ACTION: 'quick_action',        // Quick actionable suggestions
    DID_YOU_MEAN: 'did_you_mean',        // Query clarification
    NEXT_STEP: 'next_step',              // Suggested next steps
    INSIGHT: 'insight',                   // Proactive insights
    WARNING: 'warning',                   // Risk/issue warnings
    OPTIMIZATION: 'optimization',         // Efficiency suggestions
    LEARNING: 'learning'                  // Educational suggestions
};

// Context triggers for suggestions
const CONTEXT_TRIGGERS = {
    NEW_PROJECT: 'new_project',
    PHASE_CHANGE: 'phase_change',
    DEADLINE_APPROACHING: 'deadline_approaching',
    RISK_DETECTED: 'risk_detected',
    PATTERN_DETECTED: 'pattern_detected',
    USER_IDLE: 'user_idle',
    REPEATED_QUERY: 'repeated_query'
};

const ProactiveSuggestionsService = {
    SUGGESTION_TYPES,
    CONTEXT_TRIGGERS,

    /**
     * Generate proactive suggestions based on current context
     * @param {object} context - { userId, organizationId, projectId, screenContext, recentActions }
     * @returns {Promise<Array>} Array of suggestions
     */
    generateSuggestions: async (context) => {
        const {
            userId,
            organizationId,
            projectId,
            screenContext,
            recentActions = [],
            query = null
        } = context;

        const suggestions = [];

        try {
            // 1. Screen-based suggestions
            if (screenContext) {
                const screenSuggestions = await ProactiveSuggestionsService._getScreenBasedSuggestions(
                    screenContext,
                    projectId
                );
                suggestions.push(...screenSuggestions);
            }

            // 2. Project state suggestions
            if (projectId) {
                const projectSuggestions = await ProactiveSuggestionsService._getProjectStateSuggestions(
                    projectId,
                    organizationId
                );
                suggestions.push(...projectSuggestions);
            }

            // 3. Query-based suggestions ("Did you mean?")
            if (query) {
                const querySuggestions = await ProactiveSuggestionsService._getQuerySuggestions(
                    query,
                    userId,
                    projectId
                );
                suggestions.push(...querySuggestions);
            }

            // 4. Pattern-based suggestions from user history
            const patternSuggestions = await ProactiveSuggestionsService._getPatternBasedSuggestions(
                userId,
                organizationId,
                recentActions
            );
            suggestions.push(...patternSuggestions);

            // 5. Time-based suggestions (deadlines, etc.)
            const timeSuggestions = await ProactiveSuggestionsService._getTimeBasedSuggestions(
                projectId,
                organizationId
            );
            suggestions.push(...timeSuggestions);

            // Sort by priority and relevance
            suggestions.sort((a, b) => (b.priority || 0) - (a.priority || 0));

            // Limit to top suggestions
            return suggestions.slice(0, 5);

        } catch (error) {
            await initDeps();
            deps.aiLogger.error('ProactiveSuggestions', `Failed to generate suggestions: ${error.message}`);
            return [];
        }
    },

    /**
     * Get suggestions based on current screen/view
     */
    _getScreenBasedSuggestions: async (screenContext, projectId) => {
        const suggestions = [];
        const { screenId, data } = screenContext;

        // Suggestions based on screen type
        const screenSuggestions = {
            'dashboard': [
                {
                    type: SUGGESTION_TYPES.QUICK_ACTION,
                    title: 'Review pending tasks',
                    description: 'You have tasks awaiting your attention',
                    action: { type: 'navigate', target: '/my-work/tasks' },
                    priority: 7
                }
            ],
            'assessment': [
                {
                    type: SUGGESTION_TYPES.NEXT_STEP,
                    title: 'Complete maturity assessment',
                    description: 'Continue your assessment to unlock insights',
                    action: { type: 'continue_assessment' },
                    priority: 8
                }
            ],
            'project': [
                {
                    type: SUGGESTION_TYPES.INSIGHT,
                    title: 'Project health check',
                    description: 'Would you like me to analyze the current project status?',
                    action: { type: 'ai_query', prompt: 'Analyze current project health and status' },
                    priority: 6
                }
            ],
            'roadmap': [
                {
                    type: SUGGESTION_TYPES.OPTIMIZATION,
                    title: 'Optimize timeline',
                    description: 'I can suggest timeline improvements based on dependencies',
                    action: { type: 'ai_query', prompt: 'Analyze roadmap and suggest timeline optimizations' },
                    priority: 7
                }
            ]
        };

        // Add screen-specific suggestions
        const screenType = screenId?.split('_')[0] || 'dashboard';
        if (screenSuggestions[screenType]) {
            suggestions.push(...screenSuggestions[screenType]);
        }

        // Add context-aware suggestions based on data
        if (data?.isEmpty) {
            suggestions.push({
                type: SUGGESTION_TYPES.NEXT_STEP,
                title: 'Get started',
                description: 'Let me help you set up this section',
                action: { type: 'ai_query', prompt: `Help me get started with ${screenType}` },
                priority: 9
            });
        }

        return suggestions;
    },

    /**
     * Get suggestions based on project state
     */
    _getProjectStateSuggestions: async (projectId, organizationId) => {
        await initDeps();
        const suggestions = [];

        return new Promise((resolve) => {
            deps.db.get(`
                SELECT 
                    p.name, p.status, p.phase,
                    (SELECT COUNT(*) FROM tasks WHERE project_id = p.id AND status = 'overdue') as overdue_tasks,
                    (SELECT COUNT(*) FROM risks WHERE project_id = p.id AND status = 'open' AND impact = 'high') as high_risks,
                    (SELECT COUNT(*) FROM decisions WHERE project_id = p.id AND status = 'pending') as pending_decisions
                FROM projects p
                WHERE p.id = ?
            `, [projectId], (err, project) => {
                if (err || !project) {
                    return resolve(suggestions);
                }

                // Overdue tasks warning
                if (project.overdue_tasks > 0) {
                    suggestions.push({
                        type: SUGGESTION_TYPES.WARNING,
                        title: `${project.overdue_tasks} overdue task(s)`,
                        description: 'Some tasks need immediate attention',
                        action: { type: 'navigate', target: `/projects/${projectId}/tasks?filter=overdue` },
                        priority: 9,
                        trigger: CONTEXT_TRIGGERS.DEADLINE_APPROACHING
                    });
                }

                // High risks warning
                if (project.high_risks > 0) {
                    suggestions.push({
                        type: SUGGESTION_TYPES.WARNING,
                        title: `${project.high_risks} high-impact risk(s)`,
                        description: 'Review and mitigate high-priority risks',
                        action: { type: 'navigate', target: `/projects/${projectId}/risks?impact=high` },
                        priority: 8,
                        trigger: CONTEXT_TRIGGERS.RISK_DETECTED
                    });
                }

                // Pending decisions
                if (project.pending_decisions > 0) {
                    suggestions.push({
                        type: SUGGESTION_TYPES.QUICK_ACTION,
                        title: `${project.pending_decisions} pending decision(s)`,
                        description: 'Decisions are waiting for your input',
                        action: { type: 'navigate', target: `/projects/${projectId}/decisions` },
                        priority: 7
                    });
                }

                // Phase-specific suggestions
                if (project.phase === 'planning') {
                    suggestions.push({
                        type: SUGGESTION_TYPES.NEXT_STEP,
                        title: 'Complete planning phase',
                        description: 'Would you like help finalizing the project plan?',
                        action: { type: 'ai_query', prompt: 'Help me complete the planning phase' },
                        priority: 6
                    });
                }

                resolve(suggestions);
            });
        });
    },

    /**
     * Get "Did you mean?" and query clarification suggestions
     */
    _getQuerySuggestions: async (query, userId, projectId) => {
        const suggestions = [];
        const queryLower = query.toLowerCase();

        // Common query patterns and clarifications
        const clarifications = [
            {
                patterns: ['status', 'progress', 'update'],
                suggestion: {
                    type: SUGGESTION_TYPES.DID_YOU_MEAN,
                    title: 'Did you mean to ask about project status?',
                    description: 'I can provide a comprehensive status report',
                    action: { type: 'ai_query', prompt: 'Give me a detailed project status update' },
                    priority: 5
                }
            },
            {
                patterns: ['risk', 'issue', 'problem'],
                suggestion: {
                    type: SUGGESTION_TYPES.DID_YOU_MEAN,
                    title: 'Would you like a risk analysis?',
                    description: 'I can analyze current risks and suggest mitigations',
                    action: { type: 'ai_query', prompt: 'Analyze project risks and suggest mitigation strategies' },
                    priority: 5
                }
            },
            {
                patterns: ['report', 'summary', 'overview'],
                suggestion: {
                    type: SUGGESTION_TYPES.DID_YOU_MEAN,
                    title: 'Generate a report?',
                    description: 'I can create a detailed report for stakeholders',
                    action: { type: 'ai_query', prompt: 'Generate a comprehensive project report' },
                    priority: 5
                }
            }
        ];

        // Check for pattern matches
        for (const { patterns, suggestion } of clarifications) {
            if (patterns.some(p => queryLower.includes(p))) {
                suggestions.push(suggestion);
            }
        }

        // Check for similar past queries
        const similarQueries = await ProactiveSuggestionsService._findSimilarPastQueries(
            query,
            userId,
            projectId
        );

        if (similarQueries.length > 0) {
            suggestions.push({
                type: SUGGESTION_TYPES.DID_YOU_MEAN,
                title: 'Related to a previous question?',
                description: `You asked about "${similarQueries[0].snippet}" before`,
                action: { type: 'ai_query', prompt: similarQueries[0].fullQuery },
                priority: 4
            });
        }

        return suggestions;
    },

    /**
     * Get suggestions based on user behavior patterns
     */
    _getPatternBasedSuggestions: async (userId, organizationId, recentActions) => {
        const suggestions = [];

        // Detect repeated actions
        const actionCounts = {};
        recentActions.forEach(action => {
            actionCounts[action.type] = (actionCounts[action.type] || 0) + 1;
        });

        // If user repeatedly does something, suggest automation
        for (const [actionType, count] of Object.entries(actionCounts)) {
            if (count >= 3) {
                suggestions.push({
                    type: SUGGESTION_TYPES.OPTIMIZATION,
                    title: `Automate ${actionType.replace(/_/g, ' ')}?`,
                    description: "I noticed you do this often. Would you like me to help automate it?",
                    action: { type: 'ai_query', prompt: `Help me automate ${actionType.replace(/_/g, ' ')}` },
                    priority: 6,
                    trigger: CONTEXT_TRIGGERS.PATTERN_DETECTED
                });
            }
        }

        return suggestions;
    },

    /**
     * Get time-based suggestions (deadlines, reminders)
     */
    _getTimeBasedSuggestions: async (projectId, organizationId) => {
        await initDeps();
        const suggestions = [];
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

        return new Promise((resolve) => {
            deps.db.all(`
                SELECT title, due_date, priority
                FROM tasks
                WHERE (project_id = ? OR organization_id = ?)
                  AND status NOT IN ('completed', 'cancelled')
                  AND due_date BETWEEN ? AND ?
                ORDER BY due_date ASC
                LIMIT 5
            `, [projectId, organizationId, now.toISOString(), nextWeek.toISOString()], (err, tasks) => {
                if (err || !tasks || tasks.length === 0) {
                    return resolve(suggestions);
                }

                // Tasks due tomorrow
                const dueTomorrow = tasks.filter(t => new Date(t.due_date) <= tomorrow);
                if (dueTomorrow.length > 0) {
                    suggestions.push({
                        type: SUGGESTION_TYPES.WARNING,
                        title: `${dueTomorrow.length} task(s) due tomorrow`,
                        description: dueTomorrow.map(t => t.title).slice(0, 2).join(', '),
                        action: { type: 'navigate', target: '/my-work/focus' },
                        priority: 9,
                        trigger: CONTEXT_TRIGGERS.DEADLINE_APPROACHING
                    });
                }

                // Tasks due this week
                const dueThisWeek = tasks.filter(t => new Date(t.due_date) > tomorrow);
                if (dueThisWeek.length > 0) {
                    suggestions.push({
                        type: SUGGESTION_TYPES.INSIGHT,
                        title: `${dueThisWeek.length} task(s) due this week`,
                        description: 'Plan your week effectively',
                        action: { type: 'ai_query', prompt: 'Help me plan my week based on upcoming tasks' },
                        priority: 6
                    });
                }

                resolve(suggestions);
            });
        });
    },

    /**
     * Find similar past queries
     */
    _findSimilarPastQueries: async (query, userId, projectId) => {
        await initDeps();
        return new Promise((resolve) => {
            deps.db.all(`
                SELECT prompt as fullQuery, substr(prompt, 1, 50) as snippet
                FROM ai_interactions
                WHERE user_id = ?
                  AND (project_id = ? OR project_id IS NULL)
                  AND prompt LIKE ?
                  AND created_at >= datetime('now', '-30 days')
                ORDER BY created_at DESC
                LIMIT 3
            `, [userId, projectId, `%${query.split(' ')[0]}%`], (err, rows) => {
                if (err) return resolve([]);
                resolve(rows || []);
            });
        });
    },

    /**
     * Record when a suggestion is shown
     */
    recordSuggestionShown: async (suggestionId, userId, context) => {
        await initDeps();
        const id = deps.uuidv4();
        return new Promise((resolve) => {
            deps.db.run(`
                INSERT INTO ai_suggestion_events (id, suggestion_id, user_id, event_type, context, created_at)
                VALUES (?, ?, ?, 'shown', ?, ?)
            `, [id, suggestionId, userId, JSON.stringify(context), new Date().toISOString()], (err) => {
                resolve({ success: !err });
            });
        });
    },

    /**
     * Record when a suggestion is accepted/dismissed
     */
    recordSuggestionAction: async (suggestionId, userId, action, feedback = null) => {
        await initDeps();
        const id = deps.uuidv4();
        return new Promise((resolve) => {
            deps.db.run(`
                INSERT INTO ai_suggestion_events (id, suggestion_id, user_id, event_type, context, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [id, suggestionId, userId, action, JSON.stringify({ feedback }), new Date().toISOString()], (err) => {
                resolve({ success: !err });
            });
        });
    },

    /**
     * Get suggestion effectiveness metrics
     */
    getSuggestionMetrics: async (organizationId, days = 30) => {
        await initDeps();
        return new Promise((resolve) => {
            deps.db.all(`
                SELECT 
                    event_type,
                    COUNT(*) as count
                FROM ai_suggestion_events
                WHERE created_at >= datetime('now', '-' || ? || ' days')
                GROUP BY event_type
            `, [days], (err, rows) => {
                if (err) return resolve({ shown: 0, accepted: 0, dismissed: 0, acceptanceRate: 0 });

                const metrics = { shown: 0, accepted: 0, dismissed: 0 };
                (rows || []).forEach(row => {
                    if (row.event_type === 'shown') metrics.shown = row.count;
                    if (row.event_type === 'accepted') metrics.accepted = row.count;
                    if (row.event_type === 'dismissed') metrics.dismissed = row.count;
                });

                metrics.acceptanceRate = metrics.shown > 0 
                    ? Math.round((metrics.accepted / metrics.shown) * 100) 
                    : 0;

                resolve(metrics);
            });
        });
    },

    /**
     * Set dependencies (for testing)
     */
    setDependencies
};

export default ProactiveSuggestionsService;


