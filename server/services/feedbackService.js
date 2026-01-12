const deps = {
    _db: null,
    _uuidv4: null,

    get db() { return this._db; },
    set db(val) { this._db = val; },

    get uuidv4() { return this._uuidv4; },
    set uuidv4(val) { this._uuidv4 = val; }
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps._db) {
        const { default: db } = await import('../src/database/index.js');
        deps._db = db;
    }
    if (!deps._uuidv4) {
        const { v4 } = await import('uuid');
        deps._uuidv4 = v4;
    }
}

const FeedbackService = {
    /**
     * Dependency injection for testing
     * @param {Object} newDeps - Mock dependencies
     */
    setDependencies(newDeps) {
        Object.assign(deps, newDeps);
    },

    /**
     * Saves user feedback for an AI response (The "Learning" Step).
     */
    saveFeedback: async (userId, context, prompt, response, rating, correction = '') => {
        await initDeps();
        const stmt = deps.db.prepare(`INSERT INTO ai_feedback (id, user_id, context, prompt, response, rating, correction) VALUES (?, ?, ?, ?, ?, ?, ?)`);
        stmt.run(deps.uuidv4(), userId, context, prompt, response, rating, correction);
        stmt.finalize();
    },

    /**
     * Retrieves "Good Examples" (Rating >= 4) to inject into prompt context.
     * "Few-Shot Learning" from own memory.
     * @param {string} contextType - e.g. 'diagnose', 'roadmap'
     */
    getLearningExamples: async (contextType) => {
        await initDeps();
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT prompt, response, correction
                FROM ai_feedback
                WHERE context = ? AND rating >= 4
                ORDER BY created_at DESC
                LIMIT 3
            `;
            deps.db.all(sql, [contextType], (err, rows) => {
                if (err) resolve([]); // Don't fail if DB error, just return empty learning
                else {
                    // Format as string for prompt injection
                    const examples = rows.map(r => `
Example Input: ${r.prompt.substring(0, 100)}...
Good Response: ${r.response.substring(0, 200)}...
${r.correction ? `Correction to apply: ${r.correction}` : ''}
---`).join('\n');
                    resolve(examples);
                }
            });
        });
    },

    /**
     * PERIODIC: Analyzes feedback to generate Global Strategies.
     * This closes the loop: User Feedback -> AI Analysis -> Global Strategy -> Better Future Prompts.
     */
    consolidateLearning: async () => {
        await initDeps();
        const { default: AiService } = await import('./aiService.js');

        console.log("[GlobalLearning] Starting consolidation...");

        // 1. Get contexts with enough feedback
        const getContexts = () => new Promise(resolve => {
            deps.db.all("SELECT context, COUNT(*) as count FROM ai_feedback GROUP BY context HAVING count >= 3", (err, rows) => resolve(rows || []));
        });

        const contexts = await getContexts();

        for (const ctx of contexts) {
            const contextType = ctx.context;
            console.log(`[GlobalLearning] Analyzing context: ${contextType}`);

            // 2. Fetch feedback rows
            const getFeedback = () => new Promise(resolve => {
                deps.db.all("SELECT prompt, response, rating, comment, correction FROM ai_feedback WHERE context = ? ORDER BY created_at DESC LIMIT 20", [contextType], (err, rows) => resolve(rows || []));
            });
            const feedback = await getFeedback();

            // 3. Ask AI to synthesize a strategy
            const feedbackText = feedback.map(f => `[Rating: ${f.rating}/5] User Comment: "${f.comment || ''}"`).join('\n');
            const systemPrompt = `
                You are a Process Optimization Expert. 
                Analyze the following feedback logs for the task "${contextType}".
                Identify ONE key strategic rule or best practice that would improve future performance.
                Focus on user pain points (low ratings) or what they praised (high ratings).
                
                Return JSON: { "title": "Short Rule Name", "description": "One sentence instruction for the AI." }
            `;

            try {
                const jsonStr = await AiService.deps.callLLM(
                    `Feedback Logs:\n${feedbackText}`,
                    systemPrompt,
                    [],
                    null,
                    'system', // userId
                    'analysis'
                );

                const strategy = JSON.parse(jsonStr.replace(/```json/g, '').replace(/```/g, ''));

                if (strategy && strategy.title) {
                    // 4. Save to Global Strategies
                    const stmt = deps.db.prepare(`INSERT INTO global_strategies (id, title, description, is_active, created_by) VALUES (?, ?, ?, ?, ?)`);
                    stmt.run(deps.uuidv4(), `${contextType.toUpperCase()}: ${strategy.title}`, strategy.description, 1, 'AI_LEARNING');
                    stmt.finalize();
                    console.log(`[GlobalLearning] Learned new strategy: ${strategy.title}`);
                }
            } catch (e) {
                console.error("[GlobalLearning] Error processing context:", contextType, e);
            }
        }
        return { status: 'completed', contextsAnalyzed: contexts.length };
    },

    /**
     * Enhanced Feedback System - Feedback Items
     */

    /**
     * Get feedback items with filters
     */
    getFeedbackItems: async (filters = {}) => {
        await initDeps();
        return new Promise((resolve, reject) => {
            let query = `SELECT f.*, 
                        u.email as user_email, u.first_name, u.last_name,
                        o.name as organization_name
                        FROM feedback_items f
                        LEFT JOIN users u ON f.user_id = u.id
                        LEFT JOIN organizations o ON f.organization_id = o.id
                        WHERE 1=1`;
            const params = [];

            if (filters.organizationId) {
                query += ' AND f.organization_id = ?';
                params.push(filters.organizationId);
            }
            if (filters.userId) {
                query += ' AND f.user_id = ?';
                params.push(filters.userId);
            }
            if (filters.feedbackType) {
                query += ' AND f.feedback_type = ?';
                params.push(filters.feedbackType);
            }
            if (filters.status) {
                query += ' AND f.status = ?';
                params.push(filters.status);
            }

            query += ' ORDER BY f.created_at DESC LIMIT ?';
            params.push(filters.limit || 50);

            deps.db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Create feedback item
     */
    createFeedbackItem: async (feedbackData) => {
        await initDeps();
        return new Promise((resolve, reject) => {
            const id = deps.uuidv4();
            deps.db.run(
                `INSERT INTO feedback_items 
                 (id, organization_id, user_id, feedback_type, category, title, description,
                  priority, screenshots_json, attachments_json, metadata_json)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    id,
                    feedbackData.organizationId || null,
                    feedbackData.userId,
                    feedbackData.feedbackType,
                    feedbackData.category || null,
                    feedbackData.title,
                    feedbackData.description,
                    feedbackData.priority || 'medium',
                    JSON.stringify(feedbackData.screenshots || []),
                    JSON.stringify(feedbackData.attachments || []),
                    JSON.stringify(feedbackData.metadata || {})
                ],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id, ...feedbackData });
                }
            );
        });
    },

    /**
     * Vote on feedback
     */
    voteFeedback: async (feedbackId, userId, voteType = 'upvote') => {
        await initDeps();
        return new Promise((resolve, reject) => {
            const id = deps.uuidv4();
            deps.db.run(
                `INSERT INTO feedback_votes (id, feedback_id, user_id, vote_type)
                 VALUES (?, ?, ?, ?)`,
                [id, feedbackId, userId, voteType],
                function (err) {
                    if (err) {
                        if (err.message.includes('UNIQUE constraint')) {
                            return reject(new Error('User already voted'));
                        }
                        return reject(err);
                    }

                    // Update votes count
                    deps.db.run(
                        `UPDATE feedback_items SET votes_count = votes_count + 1 WHERE id = ?`,
                        [feedbackId]
                    );

                    resolve({ id, feedbackId, userId, voteType });
                }
            );
        });
    },

    /**
     * Add comment to feedback
     */
    addFeedbackComment: async (feedbackId, userId, commentText, isInternal = false) => {
        await initDeps();
        return new Promise((resolve, reject) => {
            const id = deps.uuidv4();
            deps.db.run(
                `INSERT INTO feedback_comments (id, feedback_id, user_id, comment_text, is_internal)
                 VALUES (?, ?, ?, ?, ?)`,
                [id, feedbackId, userId, commentText, isInternal ? 1 : 0],
                function (err) {
                    if (err) return reject(err);
                    resolve({ id, feedbackId, userId, commentText, isInternal });
                }
            );
        });
    },

    /**
     * Get feature roadmap
     */
    getFeatureRoadmap: async (status = null) => {
        await initDeps();
        return new Promise((resolve, reject) => {
            let query = 'SELECT * FROM feature_roadmap WHERE 1=1';
            const params = [];

            if (status) {
                query += ' AND status = ?';
                params.push(status);
            }

            query += ' ORDER BY priority DESC, votes_count DESC, created_at DESC';

            deps.db.all(query, params, (err, rows) => {
                if (err) return reject(err);
                resolve(rows || []);
            });
        });
    },

    /**
     * Update feature roadmap item
     */
    updateFeatureRoadmap: async (itemId, updates) => {
        await initDeps();
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];

            if (updates.status) {
                fields.push('status = ?');
                values.push(updates.status);
            }
            if (updates.priority) {
                fields.push('priority = ?');
                values.push(updates.priority);
            }
            if (updates.targetReleaseDate !== undefined) {
                fields.push('target_release_date = ?');
                values.push(updates.targetReleaseDate);
            }
            if (updates.relatedFeedbackIds) {
                fields.push('related_feedback_ids_json = ?');
                values.push(JSON.stringify(updates.relatedFeedbackIds));
            }

            if (fields.length === 0) {
                return resolve({ updated: false });
            }

            fields.push('updated_at = datetime("now")');
            values.push(itemId);

            deps.db.run(
                `UPDATE feature_roadmap SET ${fields.join(', ')} WHERE id = ?`,
                values,
                function (err) {
                    if (err) return reject(err);
                    resolve({ updated: this.changes > 0 });
                }
            );
        });
    }
};

export default FeedbackService;
