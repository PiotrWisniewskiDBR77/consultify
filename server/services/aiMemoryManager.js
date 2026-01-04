// AI Memory Manager - Handles 4-layer memory system
// AI Core Layer — Enterprise PMO Brain

// Dependency injection container
let deps = {
    db: null,
    uuidv4: null
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (deps.db && deps.uuidv4) return;

    const [dbModule, uuidModule] = await Promise.all([
        import('../src/database/index.js'),
        import('uuid')
    ]);
    const { getDatabase } = dbModule;
    deps.db = getDatabase();
    deps.uuidv4 = uuidModule.v4;
}

export const MEMORY_TYPES = {
    DECISION: 'DECISION',
    PHASE_TRANSITION: 'PHASE_TRANSITION',
    RECOMMENDATION: 'RECOMMENDATION',
    PATTERN: 'PATTERN'
};

// Token limits per model (conservative estimates)
export const MODEL_TOKEN_LIMITS = {
    'gpt-4': 8192,
    'gpt-4-turbo': 128000,
    'gpt-4o': 128000,
    'gpt-4o-mini': 128000,
    'gpt-3.5-turbo': 16385,
    'claude-3-opus': 200000,
    'claude-3-sonnet': 200000,
    'claude-3-haiku': 200000,
    'default': 8192
};

export const AIMemoryManager = {
    MEMORY_TYPES,

    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        deps = { ...deps, ...newDeps };
    },

    // ==================== SESSION MEMORY ====================
    // (Handled in-memory, not persisted to DB)

    createSession: async () => {
        await initDeps();
        return {
            conversationId: deps.uuidv4(),
            messages: [],
            currentScreen: null,
            startedAt: new Date().toISOString()
        };
    },

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
        await initDeps();
        const id = deps.uuidv4();

        return new Promise((resolve, reject) => {
            deps.db.run(`INSERT INTO ai_project_memory (id, project_id, memory_type, content, recorded_by)
                    VALUES (?, ?, ?, ?, ?)`,
                [id, projectId, memoryType, JSON.stringify(content), userId], function (err) {
                    if (err) return reject(err);

                    // GAP-08: Log memory write to activity table for audit
                    // First get organization_id from project (required by NOT NULL constraint)
                    deps.db.get(`SELECT organization_id FROM projects WHERE id = ?`, [projectId], (err, project) => {
                        if (err) {
                            // If we can't get organization_id, skip logging but don't fail
                            console.warn('[AIMemoryManager] Failed to get organization_id for activity log:', err.message);
                            return resolve({ id, projectId, memoryType });
                        }

                        if (!project || !project.organization_id) {
                            // Project not found or no organization_id, skip logging
                            return resolve({ id, projectId, memoryType });
                        }

                        const contentSnippet = typeof content === 'string'
                            ? content.substring(0, 100)
                            : JSON.stringify(content).substring(0, 100);

                        deps.db.run(`INSERT INTO activity_logs (id, organization_id, user_id, action, entity_type, entity_id, new_value, created_at)
                                VALUES (?, ?, ?, 'ai_memory_write', 'ai_memory', ?, ?, CURRENT_TIMESTAMP)`,
                            [deps.uuidv4(), project.organization_id, userId, id, JSON.stringify({ memoryType, snippet: contentSnippet })],
                            (logErr) => {
                                // Log errors but don't fail the main operation
                                if (logErr) {
                                    console.warn('[AIMemoryManager] Failed to log activity:', logErr.message);
                                }
                            }
                        );

                        resolve({ id, projectId, memoryType });
                    });
                });
        });
    },

    /**
     * Record a decision with rationale
     */
    recordDecision: async (projectId, decisionId, title, outcome, rationale, userId) => {
        await initDeps();
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
        await initDeps();
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
        await initDeps();
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
        await initDeps();
        return new Promise((resolve, reject) => {
            let sql = `SELECT * FROM ai_project_memory WHERE project_id = ?`;
            const params = [projectId];

            if (memoryType) {
                sql += ` AND memory_type = ?`;
                params.push(memoryType);
            }

            sql += ` ORDER BY created_at DESC LIMIT ?`;
            params.push(limit);

            deps.db.all(sql, params, (err, rows) => {
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
        await initDeps();
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

    // ==================== RELEVANCE FILTERING ====================

    /**
     * Calculate relevance score between query and content
     * Uses TF-IDF-like approach with keyword matching
     * @param {string} content - Content to score
     * @param {string} query - Query to match against
     * @returns {number} Relevance score (0-1)
     */
    calculateRelevance: (content, query) => {
        if (!content || !query) return 0;

        // Normalize both strings
        const normalizedContent = (typeof content === 'string' ? content : JSON.stringify(content)).toLowerCase();
        const normalizedQuery = query.toLowerCase();

        // Extract keywords from query (ignore common words)
        const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been',
            'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
            'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'to', 'of', 'in',
            'for', 'on', 'with', 'at', 'by', 'from', 'as', 'or', 'and', 'but', 'if',
            'then', 'than', 'so', 'that', 'this', 'these', 'those', 'what', 'which',
            'who', 'whom', 'whose', 'when', 'where', 'why', 'how', 'all', 'each',
            'every', 'both', 'few', 'more', 'most', 'other', 'some', 'such', 'no',
            'not', 'only', 'same', 'just', 'also', 'very', 'it', 'its', 'my', 'your']);

        const queryWords = normalizedQuery
            .split(/\s+/)
            .filter(word => word.length > 2 && !stopWords.has(word));

        if (queryWords.length === 0) return 0.5; // Default score for empty query

        // Calculate matches
        let exactMatches = 0;
        let partialMatches = 0;

        queryWords.forEach(word => {
            // Exact word match (bounded by word boundaries or special characters)
            const exactRegex = new RegExp(`\\b${word}\\b`, 'gi');
            if (exactRegex.test(normalizedContent)) {
                exactMatches++;
            } else {
                // Partial match (substring)
                if (normalizedContent.includes(word)) {
                    partialMatches++;
                }
            }
        });

        // Calculate score
        const exactScore = exactMatches / queryWords.length;
        const partialScore = partialMatches / queryWords.length;

        // Weight: exact matches are worth more
        const score = (exactScore * 0.7) + (partialScore * 0.3);

        // Boost for phrase match
        if (normalizedContent.includes(normalizedQuery)) {
            return Math.min(1, score + 0.3);
        }

        return score;
    },

    /**
     * Get relevant memory based on query
     * Filters and ranks memory by relevance score
     * @param {string} projectId - Project ID
     * @param {string} query - Query to match against
     * @param {number} limit - Maximum items to return (default: 10)
     * @param {number} minRelevance - Minimum relevance score (0-1, default: 0.1)
     * @returns {Array} Relevance-sorted memory items
     */
    getRelevantMemory: async (projectId, query, limit = 10, minRelevance = 0.1) => {
        await initDeps();
        // Fetch more items than needed for filtering
        const fetchLimit = Math.max(limit * 3, 50);
        const allMemory = await AIMemoryManager.getProjectMemory(projectId, null, fetchLimit);

        if (!allMemory || allMemory.length === 0) {
            return [];
        }

        // Calculate relevance for each item
        const scoredMemory = allMemory.map(item => {
            const contentString = typeof item.content === 'string'
                ? item.content
                : JSON.stringify(item.content);

            const relevanceScore = AIMemoryManager.calculateRelevance(contentString, query);

            // Type weight: decisions are generally more important
            let typeWeight = 1.0;
            if (item.memory_type === MEMORY_TYPES.DECISION) typeWeight = 1.2;
            else if (item.memory_type === MEMORY_TYPES.PHASE_TRANSITION) typeWeight = 1.1;

            // Recency weight: more recent items get slight boost
            const ageInDays = (Date.now() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24);
            const recencyWeight = Math.max(0.8, 1 - (ageInDays / 365)); // Decay over 1 year

            return {
                ...item,
                relevanceScore,
                weightedScore: relevanceScore * typeWeight * recencyWeight
            };
        });

        // Filter by minimum relevance and sort by weighted score
        const relevantMemory = scoredMemory
            .filter(item => item.relevanceScore >= minRelevance)
            .sort((a, b) => b.weightedScore - a.weightedScore)
            .slice(0, limit);

        return relevantMemory;
    },

    /**
     * Build relevance-aware project memory summary
     * Enhanced version that filters by query relevance
     * @param {string} projectId - Project ID
     * @param {string} query - Current user query for relevance filtering
     * @returns {object} Memory summary with relevance info
     */
    buildRelevantMemorySummary: async (projectId, query) => {
        await initDeps();
        if (!query) {
            // Fallback to standard summary if no query
            return AIMemoryManager.buildProjectMemorySummary(projectId);
        }

        const relevantMemory = await AIMemoryManager.getRelevantMemory(projectId, query, 15, 0.1);

        // Group by type
        const decisions = relevantMemory
            .filter(m => m.memory_type === MEMORY_TYPES.DECISION)
            .slice(0, 5);
        const transitions = relevantMemory
            .filter(m => m.memory_type === MEMORY_TYPES.PHASE_TRANSITION)
            .slice(0, 3);
        const recommendations = relevantMemory
            .filter(m => m.memory_type === MEMORY_TYPES.RECOMMENDATION)
            .slice(0, 5);

        return {
            projectId,
            majorDecisions: decisions.map(d => ({
                ...d.content,
                _relevance: d.relevanceScore
            })),
            phaseTransitions: transitions.map(t => ({
                ...t.content,
                _relevance: t.relevanceScore
            })),
            aiRecommendations: recommendations.map(r => ({
                ...r.content,
                _relevance: r.relevanceScore
            })),
            memoryCount: decisions.length + transitions.length + recommendations.length,
            _relevanceFiltered: true,
            _query: query.substring(0, 50) + (query.length > 50 ? '...' : '')
        };
    },

    // ==================== ORGANIZATION MEMORY ====================

    /**
     * Get or create organization memory
     */
    getOrganizationMemory: async (organizationId) => {
        await initDeps();
        return new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM ai_organization_memory WHERE organization_id = ?`,
                [organizationId], (err, row) => {
                    if (err) return reject(err);

                    if (row) {
                        try {
                            row.recurringPatterns = JSON.parse(row.recurring_patterns || '[]');
                        } catch { row.recurringPatterns = []; }
                        resolve(row);
                    } else {
                        // Create default
                        deps.db.run(`INSERT INTO ai_organization_memory (organization_id) VALUES (?)`,
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
        await initDeps();
        const { governanceStyle, aiStrictness, pmoMaturity, patterns } = updates;

        return new Promise((resolve, reject) => {
            deps.db.run(`UPDATE ai_organization_memory SET
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
        await initDeps();
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
        await initDeps();
        return new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM ai_user_preferences WHERE user_id = ?`, [userId], (err, row) => {
                if (err) return reject(err);

                if (row) {
                    resolve(row);
                } else {
                    // Create default
                    deps.db.run(`INSERT INTO ai_user_preferences (user_id) VALUES (?)`, [userId], function (err2) {
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
        await initDeps();
        const { preferredTone, educationMode, proactiveNotifications, preferredLanguage } = updates;

        return new Promise((resolve, reject) => {
            deps.db.run(`INSERT INTO ai_user_preferences (user_id, preferred_tone, education_mode, proactive_notifications, preferred_language)
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
        await initDeps();
        return new Promise((resolve, reject) => {
            deps.db.run(`DELETE FROM ai_project_memory WHERE project_id = ?`, [projectId], function (err) {
                if (err) return reject(err);
                resolve({ deleted: this.changes });
            });
        });
    },

    /**
     * Clear organization memory
     */
    clearOrganizationMemory: async (organizationId) => {
        await initDeps();
        return new Promise((resolve, reject) => {
            deps.db.run(`DELETE FROM ai_organization_memory WHERE organization_id = ?`,
                [organizationId], function (err) {
                    if (err) return reject(err);
                    resolve({ deleted: this.changes });
                });
        });
    },

    // ==================== MEMORY CLEANUP ====================

    /**
     * Cleanup old project memory entries
     * Removes entries older than maxAgeDays to prevent DB bloat
     * @param {string} projectId - Project ID (null for all projects)
     * @param {number} maxAgeDays - Maximum age in days (default: 90)
     * @returns {object} Cleanup result
     */
    cleanupOldMemory: async (projectId = null, maxAgeDays = 90) => {
        await initDeps();
        return new Promise((resolve, reject) => {
            let sql = `DELETE FROM ai_project_memory WHERE created_at < datetime('now', '-' || ? || ' days')`;
            const params = [maxAgeDays];

            if (projectId) {
                sql += ` AND project_id = ?`;
                params.push(projectId);
            }

            deps.db.run(sql, params, function (err) {
                if (err) return reject(err);

                console.log(`[AIMemoryManager] Cleaned up ${this.changes} old memory entries (older than ${maxAgeDays} days)`);
                resolve({
                    deleted: this.changes,
                    maxAgeDays,
                    projectId: projectId || 'all'
                });
            });
        });
    },

    /**
     * Cleanup old partial responses (streaming resilience)
     * @param {number} maxAgeHours - Maximum age in hours (default: 1)
     * @returns {object} Cleanup result
     */
    cleanupPartialResponses: async (maxAgeHours = 1) => {
        await initDeps();
        return new Promise((resolve, reject) => {
            deps.db.run(
                `DELETE FROM ai_partial_responses WHERE updated_at < datetime('now', '-' || ? || ' hours')`,
                [maxAgeHours],
                function (err) {
                    if (err) {
                        // Table might not exist yet - that's OK
                        if (err.message.includes('no such table')) {
                            return resolve({ deleted: 0, skipped: true });
                        }
                        return reject(err);
                    }

                    if (this.changes > 0) {
                        console.log(`[AIMemoryManager] Cleaned up ${this.changes} old partial responses`);
                    }
                    resolve({ deleted: this.changes, maxAgeHours });
                }
            );
        });
    },

    /**
     * Cleanup old feedback entries
     * @param {number} maxAgeDays - Maximum age in days (default: 365)
     * @returns {object} Cleanup result
     */
    cleanupOldFeedback: async (maxAgeDays = 365) => {
        await initDeps();
        return new Promise((resolve, reject) => {
            deps.db.run(
                `DELETE FROM ai_feedback WHERE created_at < datetime('now', '-' || ? || ' days')`,
                [maxAgeDays],
                function (err) {
                    if (err) {
                        if (err.message.includes('no such table')) {
                            return resolve({ deleted: 0, skipped: true });
                        }
                        return reject(err);
                    }

                    if (this.changes > 0) {
                        console.log(`[AIMemoryManager] Cleaned up ${this.changes} old feedback entries`);
                    }
                    resolve({ deleted: this.changes, maxAgeDays });
                }
            );
        });
    },

    /**
     * Get memory statistics for monitoring
     * @returns {object} Memory statistics
     */
    getMemoryStats: async () => {
        await initDeps();
        return new Promise((resolve, reject) => {
            const stats = {};

            // Get project memory count
            deps.db.get(`SELECT COUNT(*) as count FROM ai_project_memory`, [], (err, row) => {
                stats.projectMemoryCount = row?.count || 0;

                // Get organization memory count
                deps.db.get(`SELECT COUNT(*) as count FROM ai_organization_memory`, [], (err, row) => {
                    stats.orgMemoryCount = row?.count || 0;

                    // Get user preferences count
                    deps.db.get(`SELECT COUNT(*) as count FROM ai_user_preferences`, [], (err, row) => {
                        stats.userPreferencesCount = row?.count || 0;

                        // Get oldest memory entry
                        deps.db.get(`SELECT MIN(created_at) as oldest FROM ai_project_memory`, [], (err, row) => {
                            stats.oldestMemoryEntry = row?.oldest || null;

                            // Get memory by type
                            deps.db.all(`SELECT memory_type, COUNT(*) as count FROM ai_project_memory GROUP BY memory_type`, [], (err, rows) => {
                                stats.memoryByType = {};
                                (rows || []).forEach(r => {
                                    stats.memoryByType[r.memory_type] = r.count;
                                });

                                resolve(stats);
                            });
                        });
                    });
                });
            });
        });
    },

    /**
     * Run full cleanup cycle
     * Called by cron job
     * @returns {object} Combined cleanup results
     */
    runCleanupCycle: async () => {
        await initDeps();
        const startTime = Date.now();
        const results = {
            timestamp: new Date().toISOString(),
            projectMemory: null,
            partialResponses: null,
            feedback: null,
            stats: null,
            duration: 0
        };

        try {
            // 1. Cleanup old project memory (90 days)
            results.projectMemory = await AIMemoryManager.cleanupOldMemory(null, 90);

            // 2. Cleanup partial responses (1 hour)
            results.partialResponses = await AIMemoryManager.cleanupPartialResponses(1);

            // 3. Cleanup old feedback (365 days)
            results.feedback = await AIMemoryManager.cleanupOldFeedback(365);

            // 4. Get current stats
            results.stats = await AIMemoryManager.getMemoryStats();

            results.duration = Date.now() - startTime;

            console.log('[AIMemoryManager] Cleanup cycle complete:', {
                projectMemoryDeleted: results.projectMemory.deleted,
                partialResponsesDeleted: results.partialResponses.deleted,
                feedbackDeleted: results.feedback.deleted,
                duration: `${results.duration}ms`
            });

            return results;
        } catch (error) {
            console.error('[AIMemoryManager] Cleanup cycle failed:', error);
            results.error = error.message;
            results.duration = Date.now() - startTime;
            return results;
        }
    },

    // ==================== TOKEN MANAGEMENT ====================

    /**
     * Estimate token count for a text string
     * Uses ~4 characters per token approximation (GPT standard)
     * More accurate than simple word count
     * @param {string} text - Text to estimate tokens for
     * @returns {number} Estimated token count
     */
    estimateTokens: (text) => {
        if (!text || typeof text !== 'string') return 0;

        // GPT tokenization approximation:
        // - Average ~4 characters per token for English
        // - ~3.5 characters per token for code/technical content
        // - Add 10% buffer for special tokens and formatting
        const charCount = text.length;
        const baseEstimate = Math.ceil(charCount / 3.8); // Slightly conservative
        return Math.ceil(baseEstimate * 1.1); // Add 10% safety buffer
    },

    /**
     * Get token limit for a specific model
     * @param {string} modelName - Model name
     * @returns {number} Token limit
     */
    getModelTokenLimit: (modelName) => {
        if (!modelName) return MODEL_TOKEN_LIMITS.default;

        // Normalize model name for lookup
        const normalizedName = modelName.toLowerCase();

        for (const [key, limit] of Object.entries(MODEL_TOKEN_LIMITS)) {
            if (normalizedName.includes(key)) {
                return limit;
            }
        }

        return MODEL_TOKEN_LIMITS.default;
    },

    /**
     * Trim memory to fit within token budget
     * Prioritizes keeping most important items (decisions, recent items)
     * @param {object} memory - Project memory summary object
     * @param {number} maxTokens - Maximum tokens allowed for memory
     * @returns {object} Trimmed memory object
     */
    trimMemory: (memory, maxTokens) => {
        if (!memory || maxTokens <= 0) return memory;

        const estimateTokens = AIMemoryManager.estimateTokens;
        let currentTokens = estimateTokens(JSON.stringify(memory));

        // If already under budget, return as-is
        if (currentTokens <= maxTokens) {
            return memory;
        }

        const trimmedMemory = { ...memory };

        // Priority order: decisions > phaseTransitions > recommendations
        // Trim recommendations first (lowest priority)
        if (trimmedMemory.aiRecommendations && trimmedMemory.aiRecommendations.length > 0) {
            while (currentTokens > maxTokens && trimmedMemory.aiRecommendations.length > 1) {
                trimmedMemory.aiRecommendations.pop();
                currentTokens = estimateTokens(JSON.stringify(trimmedMemory));
            }
            if (currentTokens > maxTokens && trimmedMemory.aiRecommendations.length > 0) {
                trimmedMemory.aiRecommendations = [];
                currentTokens = estimateTokens(JSON.stringify(trimmedMemory));
            }
        }

        // Trim phase transitions (medium priority)
        if (trimmedMemory.phaseTransitions && trimmedMemory.phaseTransitions.length > 0) {
            while (currentTokens > maxTokens && trimmedMemory.phaseTransitions.length > 1) {
                trimmedMemory.phaseTransitions.pop();
                currentTokens = estimateTokens(JSON.stringify(trimmedMemory));
            }
            if (currentTokens > maxTokens && trimmedMemory.phaseTransitions.length > 0) {
                trimmedMemory.phaseTransitions = [];
                currentTokens = estimateTokens(JSON.stringify(trimmedMemory));
            }
        }

        // Trim decisions last (highest priority)
        if (trimmedMemory.majorDecisions && trimmedMemory.majorDecisions.length > 0) {
            while (currentTokens > maxTokens && trimmedMemory.majorDecisions.length > 1) {
                trimmedMemory.majorDecisions.pop();
                currentTokens = estimateTokens(JSON.stringify(trimmedMemory));
            }
            if (currentTokens > maxTokens) {
                // Keep only most recent decision with truncated content
                if (trimmedMemory.majorDecisions[0]) {
                    const decision = trimmedMemory.majorDecisions[0];
                    trimmedMemory.majorDecisions = [{
                        ...decision,
                        rationale: decision.rationale ? decision.rationale.substring(0, 200) + '...' : '',
                        _truncated: true
                    }];
                }
            }
        }

        // Update memory count
        trimmedMemory.memoryCount =
            (trimmedMemory.majorDecisions?.length || 0) +
            (trimmedMemory.phaseTransitions?.length || 0) +
            (trimmedMemory.aiRecommendations?.length || 0);

        trimmedMemory._trimmed = true;
        trimmedMemory._originalTokens = estimateTokens(JSON.stringify(memory));
        trimmedMemory._trimmedTokens = estimateTokens(JSON.stringify(trimmedMemory));

        return trimmedMemory;
    },

    /**
     * Trim conversation history to fit within token budget
     * Keeps system messages and most recent user/assistant exchanges
     * @param {Array} history - Array of message objects {role, content}
     * @param {number} maxTokens - Maximum tokens allowed for history
     * @returns {Array} Trimmed history array
     */
    trimHistory: (history, maxTokens) => {
        if (!history || !Array.isArray(history) || maxTokens <= 0) return history;

        const estimateTokens = AIMemoryManager.estimateTokens;
        let currentTokens = history.reduce((sum, msg) => sum + estimateTokens(msg.content || ''), 0);

        // If already under budget, return as-is
        if (currentTokens <= maxTokens) {
            return history;
        }

        // Separate system messages from conversation
        const systemMessages = history.filter(m => m.role === 'system');
        const conversationMessages = history.filter(m => m.role !== 'system');

        // Calculate tokens for system messages (always kept)
        const systemTokens = systemMessages.reduce((sum, msg) => sum + estimateTokens(msg.content || ''), 0);
        const availableForConversation = maxTokens - systemTokens;

        if (availableForConversation <= 0) {
            // Only room for system messages, return just those
            return systemMessages;
        }

        // Keep most recent messages, removing from the beginning
        const trimmedConversation = [];
        let conversationTokens = 0;

        // Work backwards from most recent
        for (let i = conversationMessages.length - 1; i >= 0; i--) {
            const msg = conversationMessages[i];
            const msgTokens = estimateTokens(msg.content || '');

            if (conversationTokens + msgTokens <= availableForConversation) {
                trimmedConversation.unshift(msg);
                conversationTokens += msgTokens;
            } else {
                // Try to include a truncated version of the message
                const availableTokens = availableForConversation - conversationTokens;
                if (availableTokens > 50) { // Only if we have meaningful space
                    const truncatedContent = msg.content.substring(0, availableTokens * 3) + '... [truncated]';
                    trimmedConversation.unshift({
                        ...msg,
                        content: truncatedContent,
                        _truncated: true
                    });
                }
                break; // Stop processing older messages
            }
        }

        // Add marker if history was trimmed
        if (trimmedConversation.length < conversationMessages.length) {
            trimmedConversation.unshift({
                role: 'system',
                content: `[Note: Earlier conversation history (${conversationMessages.length - trimmedConversation.length} messages) was trimmed to fit context window]`,
                _trimMarker: true
            });
        }

        return [...systemMessages, ...trimmedConversation];
    },

    /**
     * Calculate total context size and check if within limits
     * @param {string} systemPrompt - System prompt
     * @param {string} userMessage - User message
     * @param {Array} history - Conversation history
     * @param {object} memory - Project memory
     * @param {string} modelName - Model name for limit lookup
     * @returns {object} Token analysis result
     */
    analyzeContextTokens: (systemPrompt, userMessage, history, memory, modelName = 'gpt-4') => {
        const estimateTokens = AIMemoryManager.estimateTokens;
        const modelLimit = AIMemoryManager.getModelTokenLimit(modelName);

        const systemTokens = estimateTokens(systemPrompt || '');
        const userTokens = estimateTokens(userMessage || '');
        const historyTokens = (history || []).reduce((sum, msg) => sum + estimateTokens(msg.content || ''), 0);
        const memoryTokens = estimateTokens(JSON.stringify(memory || {}));

        const totalTokens = systemTokens + userTokens + historyTokens + memoryTokens;
        const responseBuffer = Math.floor(modelLimit * 0.2); // Reserve 20% for response
        const availableForContext = modelLimit - responseBuffer;

        return {
            breakdown: {
                system: systemTokens,
                user: userTokens,
                history: historyTokens,
                memory: memoryTokens,
                total: totalTokens
            },
            limits: {
                model: modelName,
                modelLimit,
                responseBuffer,
                availableForContext
            },
            status: {
                withinLimits: totalTokens <= availableForContext,
                utilizationPercent: Math.round((totalTokens / availableForContext) * 100),
                overBy: Math.max(0, totalTokens - availableForContext),
                headroom: Math.max(0, availableForContext - totalTokens)
            },
            recommendations: totalTokens > availableForContext ? {
                trimMemoryBy: Math.min(memoryTokens, totalTokens - availableForContext),
                trimHistoryBy: Math.max(0, totalTokens - availableForContext - memoryTokens)
            } : null
        };
    },

    /**
     * Auto-trim context to fit within model limits
     * @param {object} params - Parameters
     * @param {string} params.systemPrompt - System prompt
     * @param {string} params.userMessage - User message
     * @param {Array} params.history - Conversation history
     * @param {object} params.memory - Project memory
     * @param {string} params.modelName - Model name
     * @returns {object} Trimmed context
     */
    autoTrimContext: ({ systemPrompt, userMessage, history, memory, modelName = 'gpt-4' }) => {
        const analysis = AIMemoryManager.analyzeContextTokens(systemPrompt, userMessage, history, memory, modelName);

        if (analysis.status.withinLimits) {
            return {
                history,
                memory,
                trimmed: false,
                analysis
            };
        }

        // Calculate budget allocations (system prompt and user message are fixed)
        const fixedTokens = analysis.breakdown.system + analysis.breakdown.user;
        const availableForDynamic = analysis.limits.availableForContext - fixedTokens;

        // Allocate: 60% history, 40% memory (history is usually more immediately relevant)
        const historyBudget = Math.floor(availableForDynamic * 0.6);
        const memoryBudget = Math.floor(availableForDynamic * 0.4);

        const trimmedHistory = AIMemoryManager.trimHistory(history, historyBudget);
        const trimmedMemory = AIMemoryManager.trimMemory(memory, memoryBudget);

        // Re-analyze after trimming
        const newAnalysis = AIMemoryManager.analyzeContextTokens(systemPrompt, userMessage, trimmedHistory, trimmedMemory, modelName);

        return {
            history: trimmedHistory,
            memory: trimmedMemory,
            trimmed: true,
            originalAnalysis: analysis,
            newAnalysis
        };
    },

    // ========================================================================
    // PERSONALIZATION ENGINE (Phase 4.2 - UX Excellence)
    // ========================================================================

    /**
     * Default personalization settings
     */
    DEFAULT_PERSONALIZATION: {
        responseLength: 'balanced',    // 'concise' | 'balanced' | 'detailed'
        technicalDepth: 'adaptive',    // 'beginner' | 'intermediate' | 'advanced' | 'adaptive'
        communicationStyle: 'professional', // 'casual' | 'professional' | 'formal' | 'friendly'
        preferredLanguage: 'en',
        includeExamples: true,
        includeCodeSnippets: true,
        formatPreference: 'markdown',  // 'plain' | 'markdown' | 'structured'
        educationMode: false,          // Extra explanations
        actionOrientation: 'balanced'  // 'advisory' | 'balanced' | 'action-oriented'
    },

    /**
     * Get or create personalization profile for a user
     * @param {string} userId - User ID
     * @returns {Promise<object>} User's personalization profile
     */
    getPersonalizationProfile: async (userId) => {
        await initDeps();
        if (!userId) {
            return { ...AIMemoryManager.DEFAULT_PERSONALIZATION };
        }

        return new Promise((resolve) => {
            deps.db.get(
                `SELECT preferences FROM user_ai_preferences WHERE user_id = ?`,
                [userId],
                (err, row) => {
                    if (err || !row) {
                        // Return defaults if no profile exists
                        return resolve({ ...AIMemoryManager.DEFAULT_PERSONALIZATION });
                    }

                    try {
                        const prefs = JSON.parse(row.preferences || '{}');
                        resolve({
                            ...AIMemoryManager.DEFAULT_PERSONALIZATION,
                            ...prefs
                        });
                    } catch (e) {
                        resolve({ ...AIMemoryManager.DEFAULT_PERSONALIZATION });
                    }
                }
            );
        });
    },

    /**
     * Update user's personalization preferences
     * @param {string} userId - User ID
     * @param {object} preferences - Preferences to update
     */
    updatePersonalizationProfile: async (userId, preferences) => {
        await initDeps();
        if (!userId) return { success: false, error: 'User ID required' };

        const id = deps.uuidv4();
        const now = new Date().toISOString();

        // Get existing preferences
        const current = await AIMemoryManager.getPersonalizationProfile(userId);
        const merged = { ...current, ...preferences };

        return new Promise((resolve, reject) => {
            deps.db.run(`
                INSERT INTO user_ai_preferences (id, user_id, preferences, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    preferences = excluded.preferences,
                    updated_at = excluded.updated_at
            `, [id, userId, JSON.stringify(merged), now], function (err) {
                if (err) {
                    return reject(err);
                }
                resolve({ success: true, preferences: merged });
            });
        });
    },

    /**
     * Learn from user interaction patterns to update personalization
     * @param {string} userId - User ID
     * @param {object} interaction - Interaction data { messageLength, feedback, responseTime }
     */
    learnFromInteraction: async (userId, interaction) => {
        await initDeps();
        if (!userId) return;

        const { messageLength, feedback, responseTime, usedCodeSnippets } = interaction;
        const profile = await AIMemoryManager.getPersonalizationProfile(userId);
        const updates = {};

        // Learn response length preference
        if (feedback?.tooLong) {
            if (profile.responseLength === 'detailed') updates.responseLength = 'balanced';
            else if (profile.responseLength === 'balanced') updates.responseLength = 'concise';
        } else if (feedback?.tooShort) {
            if (profile.responseLength === 'concise') updates.responseLength = 'balanced';
            else if (profile.responseLength === 'balanced') updates.responseLength = 'detailed';
        }

        // Learn technical depth from message complexity
        if (messageLength > 500 && profile.technicalDepth !== 'advanced') {
            // Long detailed questions suggest advanced user
            updates.technicalDepth = 'advanced';
        }

        // Learn code preference
        if (usedCodeSnippets !== undefined) {
            updates.includeCodeSnippets = usedCodeSnippets;
        }

        // Only update if there are changes
        if (Object.keys(updates).length > 0) {
            await AIMemoryManager.updatePersonalizationProfile(userId, updates);
        }
    },

    /**
     * Build personalized system prompt additions based on user profile
     * @param {string} userId - User ID
     * @returns {Promise<string>} Personalization prompt additions
     */
    buildPersonalizedPrompt: async (userId) => {
        await initDeps();
        const profile = await AIMemoryManager.getPersonalizationProfile(userId);
        const parts = [];

        // Response length guidance
        switch (profile.responseLength) {
            case 'concise':
                parts.push('Keep responses brief and to the point. Use bullet points when possible.');
                break;
            case 'detailed':
                parts.push('Provide comprehensive responses with thorough explanations and context.');
                break;
            default:
                parts.push('Provide balanced responses - detailed where necessary, concise otherwise.');
        }

        // Technical depth guidance
        switch (profile.technicalDepth) {
            case 'beginner':
                parts.push('Explain concepts in simple terms. Avoid jargon. Include basic explanations.');
                break;
            case 'advanced':
                parts.push('Use technical terminology freely. Assume familiarity with advanced concepts.');
                break;
            case 'adaptive':
                parts.push('Match technical depth to the complexity of the question.');
                break;
            default:
                parts.push('Use moderate technical language with brief explanations of complex terms.');
        }

        // Communication style
        switch (profile.communicationStyle) {
            case 'casual':
                parts.push('Use a casual, conversational tone.');
                break;
            case 'formal':
                parts.push('Use formal, business language.');
                break;
            case 'friendly':
                parts.push('Be warm and encouraging in responses.');
                break;
            default:
                parts.push('Use professional but approachable language.');
        }

        // Format preferences
        if (profile.formatPreference === 'structured') {
            parts.push('Use clear structure with headers, numbered lists, and sections.');
        }

        // Code snippets
        if (!profile.includeCodeSnippets) {
            parts.push('Minimize code examples unless specifically requested.');
        }

        // Education mode
        if (profile.educationMode) {
            parts.push('Include educational context and explain reasoning behind suggestions.');
        }

        // Action orientation
        switch (profile.actionOrientation) {
            case 'advisory':
                parts.push('Focus on analysis and recommendations rather than direct actions.');
                break;
            case 'action-oriented':
                parts.push('Prioritize actionable steps and concrete next actions.');
                break;
        }

        return parts.length > 0
            ? `\n\nUSER PREFERENCES:\n${parts.map(p => `- ${p}`).join('\n')}\n`
            : '';
    },

    /**
     * Get personalization analytics for user
     * @param {string} userId - User ID
     */
    getPersonalizationAnalytics: async (userId) => {
        await initDeps();
        const profile = await AIMemoryManager.getPersonalizationProfile(userId);

        return new Promise((resolve) => {
            deps.db.get(`
                SELECT 
                    COUNT(*) as totalInteractions,
                    AVG(CASE WHEN json_extract(metadata, '$.rating') = 'positive' THEN 1 ELSE 0 END) as positiveRate
                FROM ai_feedback
                WHERE user_id = ?
                AND created_at >= datetime('now', '-30 days')
            `, [userId], (err, stats) => {
                resolve({
                    profile,
                    analytics: {
                        totalInteractions: stats?.totalInteractions || 0,
                        satisfactionRate: Math.round((stats?.positiveRate || 0) * 100),
                        isPersonalized: profile !== AIMemoryManager.DEFAULT_PERSONALIZATION
                    }
                });
            });
        });
    }
};

export default AIMemoryManager;
