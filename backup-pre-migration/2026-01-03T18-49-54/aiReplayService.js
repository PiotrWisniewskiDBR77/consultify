/**
 * AI Replay Service
 * 
 * Replay historical AI calls for debugging and testing.
 * 
 * Features:
 * - Replay with original inputs
 * - Compare outputs
 * - Batch replay for regression testing
 * - Support for prompt version testing
 */

const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const AIService = require('./aiService');

// Database helpers
function dbGet(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
}

function dbRun(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) reject(err);
            else resolve({ lastID: this.lastID, changes: this.changes });
        });
    });
}

function dbAll(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
        });
    });
}

const AIReplayService = {
    /**
     * Get a historical AI call by audit log ID
     * @param {string} auditLogId 
     */
    async getCall(auditLogId) {
        const call = await dbGet(
            `SELECT * FROM ai_audit_log WHERE id = ?`,
            [auditLogId]
        );

        if (!call) {
            throw new Error('AI audit log not found');
        }

        return {
            id: call.id,
            action: call.action,
            model: call.model_id,
            prompt: call.prompt_snapshot,
            systemInstruction: call.system_instruction,
            response: call.response_snapshot,
            tokensUsed: call.tokens_used,
            latencyMs: call.latency_ms,
            createdAt: call.created_at,
            userId: call.user_id,
            organizationId: call.organization_id,
            correlationId: call.correlation_id,
        };
    },

    /**
     * Replay an AI call with same inputs
     * @param {string} auditLogId 
     * @param {Object} options 
     */
    async replayCall(auditLogId, options = {}) {
        const {
            promptVersionId = null, // Use specific prompt version for testing
            modelOverride = null, // Use different model
            saveResult = true, // Save replay result
        } = options;

        // Get original call
        const original = await this.getCall(auditLogId);

        console.log(`[AIReplay] Replaying call ${auditLogId} (action: ${original.action})`);

        const startTime = Date.now();
        const replayId = uuidv4();

        try {
            // Get prompt (possibly overridden)
            let systemInstruction = original.systemInstruction;
            let promptVersion = null;

            if (promptVersionId) {
                const PromptVersionService = require('./promptVersionService');
                const version = await dbGet(
                    `SELECT content, version FROM prompt_versions WHERE id = ?`,
                    [promptVersionId]
                );
                if (version) {
                    systemInstruction = version.content;
                    promptVersion = version.version;
                }
            }

            // Execute AI call
            const response = await AIService.callLLM(
                original.prompt,
                systemInstruction,
                [], // No history for replay
                modelOverride || original.model,
                null, // No user context for replay
                original.action
            );

            const latencyMs = Date.now() - startTime;

            const result = {
                replayId,
                originalId: auditLogId,
                success: true,
                originalResponse: original.response,
                replayResponse: response,
                latencyMs,
                model: modelOverride || original.model,
                promptVersionId,
                promptVersion,
                comparison: this._compareResponses(original.response, response),
            };

            // Save replay result
            if (saveResult) {
                await this._saveReplayResult(result);
            }

            return result;

        } catch (error) {
            const result = {
                replayId,
                originalId: auditLogId,
                success: false,
                error: error.message,
                latencyMs: Date.now() - startTime,
            };

            if (saveResult) {
                await this._saveReplayResult(result);
            }

            return result;
        }
    },

    /**
     * Batch replay for regression testing
     * @param {Object} filter - Filter criteria
     * @param {Object} options 
     */
    async batchReplay(filter = {}, options = {}) {
        const {
            action = null,
            startDate = null,
            endDate = null,
            limit = 100,
            promptVersionId = null,
        } = filter;

        const { saveResults = true, parallelism = 5 } = options;

        // Build query
        let query = `SELECT id FROM ai_audit_log WHERE 1=1`;
        const params = [];

        if (action) {
            query += ` AND action = ?`;
            params.push(action);
        }
        if (startDate) {
            query += ` AND created_at >= ?`;
            params.push(startDate);
        }
        if (endDate) {
            query += ` AND created_at <= ?`;
            params.push(endDate);
        }

        query += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);

        const calls = await dbAll(query, params);

        console.log(`[AIReplay] Starting batch replay of ${calls.length} calls`);

        const results = {
            total: calls.length,
            successful: 0,
            failed: 0,
            mismatches: 0,
            details: [],
        };

        // Process in batches for parallelism
        for (let i = 0; i < calls.length; i += parallelism) {
            const batch = calls.slice(i, i + parallelism);

            const batchResults = await Promise.all(
                batch.map(call =>
                    this.replayCall(call.id, { promptVersionId, saveResult: saveResults })
                        .catch(error => ({ success: false, error: error.message }))
                )
            );

            for (const result of batchResults) {
                if (result.success) {
                    results.successful++;
                    if (result.comparison && !result.comparison.similar) {
                        results.mismatches++;
                    }
                } else {
                    results.failed++;
                }
                results.details.push(result);
            }
        }

        console.log(`[AIReplay] Batch complete: ${results.successful} successful, ${results.failed} failed, ${results.mismatches} mismatches`);

        return results;
    },

    /**
     * Compare original and replay outputs
     * @param {string} originalId 
     * @param {string} replayId 
     */
    async compareOutputs(originalId, replayId) {
        const [original, replay] = await Promise.all([
            this.getCall(originalId),
            dbGet(`SELECT * FROM ai_replay_results WHERE id = ?`, [replayId]),
        ]);

        if (!original || !replay) {
            throw new Error('Original or replay not found');
        }

        return {
            original: {
                id: original.id,
                response: original.response,
                latencyMs: original.latencyMs,
            },
            replay: {
                id: replay.id,
                response: replay.replay_response,
                latencyMs: replay.latency_ms,
            },
            comparison: this._compareResponses(original.response, replay.replay_response),
        };
    },

    /**
     * Get replay history
     * @param {Object} filter 
     */
    async getReplayHistory(filter = {}) {
        const { originalId, limit = 50 } = filter;

        let query = `SELECT * FROM ai_replay_results WHERE 1=1`;
        const params = [];

        if (originalId) {
            query += ` AND original_id = ?`;
            params.push(originalId);
        }

        query += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);

        return dbAll(query, params);
    },

    // ==========================================
    // PRIVATE METHODS
    // ==========================================

    _compareResponses(original, replay) {
        if (!original || !replay) {
            return { similar: false, reason: 'Missing response' };
        }

        // Simple comparison
        const originalText = typeof original === 'string' ? original : JSON.stringify(original);
        const replayText = typeof replay === 'string' ? replay : JSON.stringify(replay);

        // Exact match
        if (originalText === replayText) {
            return { similar: true, similarity: 100, reason: 'Exact match' };
        }

        // Calculate similarity (basic Jaccard)
        const originalWords = new Set(originalText.toLowerCase().split(/\s+/));
        const replayWords = new Set(replayText.toLowerCase().split(/\s+/));

        const intersection = new Set([...originalWords].filter(w => replayWords.has(w)));
        const union = new Set([...originalWords, ...replayWords]);

        const similarity = (intersection.size / union.size) * 100;

        return {
            similar: similarity > 80,
            similarity: Math.round(similarity),
            reason: similarity > 80 ? 'High similarity' : 'Significant differences',
            originalLength: originalText.length,
            replayLength: replayText.length,
            lengthDiff: Math.abs(originalText.length - replayText.length),
        };
    },

    async _saveReplayResult(result) {
        await dbRun(
            `INSERT INTO ai_replay_results 
             (id, original_id, success, original_response, replay_response, 
              latency_ms, model, prompt_version_id, comparison, error, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            [
                result.replayId,
                result.originalId,
                result.success ? 1 : 0,
                result.originalResponse ? JSON.stringify(result.originalResponse) : null,
                result.replayResponse ? JSON.stringify(result.replayResponse) : null,
                result.latencyMs,
                result.model,
                result.promptVersionId,
                result.comparison ? JSON.stringify(result.comparison) : null,
                result.error || null,
            ]
        );
    },
};

// Create replay results table if it doesn't exist
db.run(`
    CREATE TABLE IF NOT EXISTS ai_replay_results (
        id TEXT PRIMARY KEY,
        original_id TEXT NOT NULL,
        success INTEGER DEFAULT 1,
        original_response TEXT,
        replay_response TEXT,
        latency_ms INTEGER,
        model TEXT,
        prompt_version_id TEXT,
        comparison TEXT,
        error TEXT,
        created_at TEXT DEFAULT (datetime('now'))
    )
`);

module.exports = AIReplayService;
