const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const AnalyticsService = {
    /**
     * Logs an AI interaction for analytics.
     * @param {string} userId - User ID (or null for anon)
     * @param {string} action - 'diagnose', 'chat', 'recommend'
     * @param {string} model - 'gemini-pro', 'gpt-4', etc.
     * @param {number} inputTokens - estimated
     * @param {number} outputTokens - estimated
     * @param {number} latencyMs - execution time
     */
    logUsage: async (userId, action, model, inputTokens, outputTokens, latencyMs, topic = '') => {
        const stmt = db.prepare(`INSERT INTO ai_logs (id, user_id, action, model, input_tokens, output_tokens, latency_ms, topic) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
        stmt.run(uuidv4(), userId, action, model, inputTokens, outputTokens, latencyMs, topic);
        stmt.finalize();
    },

    /**
     * Aggregates stats for the Admin Dashboard.
     */
    getStats: async (period = '7d') => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT 
                    COUNT(*) as total_calls,
                    AVG(latency_ms) as avg_latency,
                    SUM(input_tokens + output_tokens) as total_tokens,
                    model
                FROM ai_logs
                WHERE created_at > datetime('now', '-7 days')
                GROUP BY model
            `;
            db.all(sql, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    /**
     * Gets top topics
     */
    getTopTopics: async () => {
        return new Promise((resolve, reject) => {
            const sql = `
                SELECT topic, COUNT(*) as count
                FROM ai_logs
                WHERE topic IS NOT NULL AND topic != ''
                GROUP BY topic
                ORDER BY count DESC
                LIMIT 5
            `;
            db.all(sql, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },

    /**
     * Saves a maturity score for benchmarking
     */
    saveMaturityScore: async (organizationId, axis, score, industry = 'General') => {
        const stmt = db.prepare(`INSERT INTO maturity_scores (id, organization_id, axis, score, industry) VALUES (?, ?, ?, ?, ?)`);
        stmt.run(uuidv4(), organizationId, axis, score, industry, (err) => {
            if (err) console.error("Failed to save maturity score", err);
        });
        stmt.finalize();
    },

    /**
     * Aggregates industry benchmarks
     */
    getIndustryBenchmarks: async (industry = null) => {
        return new Promise((resolve, reject) => {
            let sql = `
                SELECT axis, AVG(score) as avg_score, COUNT(*) as sample_size
                FROM maturity_scores
            `;
            const params = [];

            if (industry && industry !== 'All') {
                sql += ` WHERE industry = ?`;
                params.push(industry);
            }

            sql += ` GROUP BY axis`;

            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }
};

module.exports = AnalyticsService;
