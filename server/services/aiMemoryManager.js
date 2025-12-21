// AI Memory Manager - Handles 4-layer memory system
// AI Core Layer — Enterprise PMO Brain

const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const MEMORY_TYPES = {
    DECISION: 'DECISION',
    PHASE_TRANSITION: 'PHASE_TRANSITION',
    RECOMMENDATION: 'RECOMMENDATION',
    PATTERN: 'PATTERN'
};

const AIMemoryManager = {
    MEMORY_TYPES,

    // ==================== SESSION MEMORY ====================
    // (Handled in-memory, not persisted to DB)

    createSession: () => ({
        conversationId: uuidv4(),
        messages: [],
        currentScreen: null,
        startedAt: new Date().toISOString()
    }),

    addMessage: (session, role, content) => {
        session.messages.push({
            role,
            content,
            timestamp: new Date().toISOString()
        });
        return session;
    },

    // ==================== PROJECT MEMORY ====================

    /**
     * Record significant project event
     * GAP-08: Added audit logging
     */
    recordProjectMemory: async (projectId, memoryType, content, userId) => {
        const id = uuidv4();

        return new Promise((resolve, reject) => {
            db.run(`INSERT INTO ai_project_memory (id, project_id, memory_type, content, recorded_by)
                    VALUES (?, ?, ?, ?, ?)`,
                [id, projectId, memoryType, JSON.stringify(content), userId], function (err) {
                    if (err) return reject(err);

                    // GAP-08: Log memory write to activity table for audit
                    const contentSnippet = typeof content === 'string'
                        ? content.substring(0, 100)
                        : JSON.stringify(content).substring(0, 100);

                    db.run(`INSERT INTO activity_logs (id, user_id, action, entity_type, entity_id, new_value, created_at)
                            VALUES (?, ?, 'ai_memory_write', 'ai_memory', ?, ?, CURRENT_TIMESTAMP)`,
                        [uuidv4(), userId, id, JSON.stringify({ memoryType, snippet: contentSnippet })]
                    );

                    resolve({ id, projectId, memoryType });
                });
        });
    },

    /**
     * Record a decision with rationale
     */
    recordDecision: async (projectId, decisionId, title, outcome, rationale, userId) => {
        return AIMemoryManager.recordProjectMemory(projectId, MEMORY_TYPES.DECISION, {
            decisionId,
            title,
            outcome,
            rationale,
            recordedAt: new Date().toISOString()
        }, userId);
    },

    /**
     * Record phase transition
     */
    recordPhaseTransition: async (projectId, fromPhase, toPhase, reason, userId) => {
        return AIMemoryManager.recordProjectMemory(projectId, MEMORY_TYPES.PHASE_TRANSITION, {
            from: fromPhase,
            to: toPhase,
            reason,
            transitionedAt: new Date().toISOString()
        }, userId);
    },

    /**
     * Record AI recommendation and user response
     */
    recordRecommendation: async (projectId, recommendation, accepted, userFeedback, userId) => {
        return AIMemoryManager.recordProjectMemory(projectId, MEMORY_TYPES.RECOMMENDATION, {
            recommendation,
            accepted,
            userFeedback,
            recordedAt: new Date().toISOString()
        }, userId);
    },

    /**
     * Get project memory
     */
    getProjectMemory: async (projectId, memoryType = null, limit = 20) => {
        return new Promise((resolve, reject) => {
            let sql = `SELECT * FROM ai_project_memory WHERE project_id = ?`;
            const params = [projectId];

            if (memoryType) {
                sql += ` AND memory_type = ?`;
                params.push(memoryType);
            }

            sql += ` ORDER BY created_at DESC LIMIT ?`;
            params.push(limit);

            db.all(sql, params, (err, rows) => {
                if (err) return reject(err);

                const result = (rows || []).map(row => {
                    try {
                        row.content = JSON.parse(row.content);
                    } catch { }
                    return row;
                });

                resolve(result);
            });
        });
    },

    /**
     * Build project memory summary for AI context
     */
    buildProjectMemorySummary: async (projectId) => {
        const decisions = await AIMemoryManager.getProjectMemory(projectId, MEMORY_TYPES.DECISION, 5);
        const transitions = await AIMemoryManager.getProjectMemory(projectId, MEMORY_TYPES.PHASE_TRANSITION, 3);
        const recommendations = await AIMemoryManager.getProjectMemory(projectId, MEMORY_TYPES.RECOMMENDATION, 5);

        return {
            projectId,
            majorDecisions: decisions.map(d => d.content),
            phaseTransitions: transitions.map(t => t.content),
            aiRecommendations: recommendations.map(r => r.content),
            memoryCount: decisions.length + transitions.length + recommendations.length
        };
    },

    // ==================== ORGANIZATION MEMORY ====================

    /**
     * Get or create organization memory
     */
    getOrganizationMemory: async (organizationId) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM ai_organization_memory WHERE organization_id = ?`,
                [organizationId], (err, row) => {
                    if (err) return reject(err);

                    if (row) {
                        try {
                            row.recurringPatterns = JSON.parse(row.recurring_patterns || '[]');
                        } catch { row.recurringPatterns = []; }
                        resolve(row);
                    } else {
                        // Create default
                        db.run(`INSERT INTO ai_organization_memory (organization_id) VALUES (?)`,
                            [organizationId], function (err2) {
                                if (err2) return reject(err2);
                                resolve({
                                    organization_id: organizationId,
                                    governance_style: 'BALANCED',
                                    ai_strictness: 'STANDARD',
                                    recurringPatterns: [],
                                    pmo_maturity: 'BASIC'
                                });
                            });
                    }
                });
        });
    },

    /**
     * Update organization memory
     */
    updateOrganizationMemory: async (organizationId, updates) => {
        const { governanceStyle, aiStrictness, pmoMaturity, patterns } = updates;

        return new Promise((resolve, reject) => {
            db.run(`UPDATE ai_organization_memory SET
                    governance_style = COALESCE(?, governance_style),
                    ai_strictness = COALESCE(?, ai_strictness),
                    pmo_maturity = COALESCE(?, pmo_maturity),
                    recurring_patterns = COALESCE(?, recurring_patterns),
                    updated_at = CURRENT_TIMESTAMP
                    WHERE organization_id = ?`,
                [governanceStyle, aiStrictness, pmoMaturity,
                    patterns ? JSON.stringify(patterns) : null, organizationId], function (err) {
                        if (err) return reject(err);
                        resolve({ updated: this.changes > 0 });
                    });
        });
    },

    /**
     * Add recurring pattern
     */
    addRecurringPattern: async (organizationId, pattern) => {
        const memory = await AIMemoryManager.getOrganizationMemory(organizationId);
        const patterns = memory.recurringPatterns || [];
        patterns.push(pattern);

        return AIMemoryManager.updateOrganizationMemory(organizationId, { patterns });
    },

    // ==================== USER PREFERENCES ====================

    /**
     * Get or create user preferences
     */
    getUserPreferences: async (userId) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM ai_user_preferences WHERE user_id = ?`, [userId], (err, row) => {
                if (err) return reject(err);

                if (row) {
                    resolve(row);
                } else {
                    // Create default
                    db.run(`INSERT INTO ai_user_preferences (user_id) VALUES (?)`, [userId], function (err2) {
                        if (err2) return reject(err2);
                        resolve({
                            user_id: userId,
                            preferred_tone: 'EXPERT',
                            education_mode: 0,
                            proactive_notifications: 1,
                            preferred_language: 'en'
                        });
                    });
                }
            });
        });
    },

    /**
     * Update user preferences
     */
    updateUserPreferences: async (userId, updates) => {
        const { preferredTone, educationMode, proactiveNotifications, preferredLanguage } = updates;

        return new Promise((resolve, reject) => {
            db.run(`INSERT INTO ai_user_preferences (user_id, preferred_tone, education_mode, proactive_notifications, preferred_language)
                    VALUES (?, ?, ?, ?, ?)
                    ON CONFLICT(user_id) DO UPDATE SET
                    preferred_tone = COALESCE(?, preferred_tone),
                    education_mode = COALESCE(?, education_mode),
                    proactive_notifications = COALESCE(?, proactive_notifications),
                    preferred_language = COALESCE(?, preferred_language),
                    updated_at = CURRENT_TIMESTAMP`,
                [
                    userId, preferredTone, educationMode ? 1 : 0,
                    proactiveNotifications !== false ? 1 : 0, preferredLanguage || 'en',
                    preferredTone, educationMode !== undefined ? (educationMode ? 1 : 0) : null,
                    proactiveNotifications !== undefined ? (proactiveNotifications ? 1 : 0) : null,
                    preferredLanguage
                ], function (err) {
                    if (err) return reject(err);
                    resolve({ updated: true, userId });
                });
        });
    },

    // ==================== CLEAR MEMORY (Admin) ====================

    /**
     * Clear project memory
     */
    clearProjectMemory: async (projectId) => {
        return new Promise((resolve, reject) => {
            db.run(`DELETE FROM ai_project_memory WHERE project_id = ?`, [projectId], function (err) {
                if (err) return reject(err);
                resolve({ deleted: this.changes });
            });
        });
    },

    /**
     * Clear organization memory
     */
    clearOrganizationMemory: async (organizationId) => {
        return new Promise((resolve, reject) => {
            db.run(`DELETE FROM ai_organization_memory WHERE organization_id = ?`,
                [organizationId], function (err) {
                    if (err) return reject(err);
                    resolve({ deleted: this.changes });
                });
        });
    }
};

module.exports = AIMemoryManager;
