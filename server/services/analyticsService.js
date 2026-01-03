// Dependency injection for testing
let deps = {
    db: null,
    uuidv4: null
};

/**
 * Initialize dependencies lazily
 */
async function initDeps() {
    if (!deps.db) {
        const dbModule = await import('../database.js');
        deps.db = dbModule.default || dbModule;
    }

    if (!deps.uuidv4) {
        const uuidModule = await import('uuid');
        deps.uuidv4 = uuidModule.v4;
    }
}

/**
 * Set dependencies for testing
 */
function setDependencies(newDeps) {
    deps = { ...deps, ...newDeps };
}


const logUsage = async (userId, action, model, inputTokens, outputTokens, latencyMs, topic = '') => {
    await initDeps();
    const stmt = deps.db.prepare(`INSERT INTO ai_logs (id, user_id, action, model, input_tokens, output_tokens, latency_ms, topic) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
    stmt.run(deps.uuidv4(), userId, action, model, inputTokens, outputTokens, latencyMs, topic);
    stmt.finalize();
};

const getStats = async (period = '7d') => {
    await initDeps();
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
        deps.db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const getTopTopics = async () => {
    await initDeps();
    return new Promise((resolve, reject) => {
        const sql = `
            SELECT topic, COUNT(*) as count
            FROM ai_logs
            WHERE topic IS NOT NULL AND topic != ''
            GROUP BY topic
            ORDER BY count DESC
            LIMIT 5
        `;
        deps.db.all(sql, [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

const saveMaturityScore = async (organizationId, axis, score, industry = 'General') => {
    await initDeps();
    const stmt = deps.db.prepare(`INSERT INTO maturity_scores (id, organization_id, axis, score, industry) VALUES (?, ?, ?, ?, ?)`);
    stmt.run(deps.uuidv4(), organizationId, axis, score, industry, (err) => {
        if (err) console.error("Failed to save maturity score", err);
    });
    stmt.finalize();
};

const getIndustryBenchmarks = async (industry = null) => {
    await initDeps();
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

        deps.db.all(sql, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

export default {
    logUsage,
    getStats,
    getTopTopics,
    saveMaturityScore,
    getIndustryBenchmarks,
    setDependencies
};
