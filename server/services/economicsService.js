// Economics Service - Value hypotheses and financial assumptions
// Step 6: Stabilization, Reporting & Economics

// Dependency injection container (for deterministic unit tests)
const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4
};

const VALUE_TYPES = {
    COST_REDUCTION: 'COST_REDUCTION',
    REVENUE_INCREASE: 'REVENUE_INCREASE',
    RISK_REDUCTION: 'RISK_REDUCTION',
    EFFICIENCY: 'EFFICIENCY',
    STRATEGIC_OPTION: 'STRATEGIC_OPTION'
};

const EconomicsService = {
    VALUE_TYPES,

    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },

    /**
     * Create a value hypothesis
     */
    createValueHypothesis: async (hypothesis) => {
        const {
            initiativeId, projectId, description, type,
            confidenceLevel, ownerId, relatedInitiativeIds
        } = hypothesis;

        const id = deps.uuidv4();

        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO value_hypotheses 
                (id, initiative_id, project_id, description, type, confidence_level, owner_id, related_initiative_ids)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

            deps.db.run(sql, [
                id, initiativeId, projectId, description, type,
                confidenceLevel || 'MEDIUM', ownerId,
                JSON.stringify(relatedInitiativeIds || [])
            ], function (err) {
                if (err) return reject(err);
                resolve({ id, initiativeId, type, description });
            });
        });
    },

    /**
     * Get value hypotheses for a project
     */
    getValueHypotheses: async (projectId, initiativeId = null) => {
        return new Promise((resolve, reject) => {
            let sql = `SELECT vh.*, u.first_name, u.last_name, i.name as initiative_name
                       FROM value_hypotheses vh
                       LEFT JOIN users u ON vh.owner_id = u.id
                       LEFT JOIN initiatives i ON vh.initiative_id = i.id
                       WHERE vh.project_id = ?`;
            const params = [projectId];

            if (initiativeId) {
                sql += ` AND vh.initiative_id = ?`;
                params.push(initiativeId);
            }

            sql += ` ORDER BY vh.created_at DESC`;

            deps.db.all(sql, params, (err, rows) => {
                if (err) return reject(err);

                const result = (rows || []).map(row => {
                    try {
                        row.relatedInitiativeIds = JSON.parse(row.related_initiative_ids || '[]');
                    } catch { row.relatedInitiativeIds = []; }
                    return row;
                });

                resolve(result);
            });
        });
    },

    /**
     * Validate a value hypothesis
     */
    validateHypothesis: async (hypothesisId, userId) => {
        return new Promise((resolve, reject) => {
            deps.db.run(`UPDATE value_hypotheses 
                    SET is_validated = 1, validated_at = CURRENT_TIMESTAMP, validated_by = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?`, [userId, hypothesisId], function (err) {
                if (err) return reject(err);
                resolve({ updated: this.changes > 0, hypothesisId });
            });
        });
    },

    /**
     * Add financial assumption to a hypothesis
     */
    addFinancialAssumption: async (assumption) => {
        const {
            valueHypothesisId, lowEstimate, expectedEstimate,
            highEstimate, currency, timeframe, notes
        } = assumption;

        const id = deps.uuidv4();

        return new Promise((resolve, reject) => {
            const sql = `INSERT INTO financial_assumptions 
                (id, value_hypothesis_id, low_estimate, expected_estimate, high_estimate, currency, timeframe, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

            deps.db.run(sql, [
                id, valueHypothesisId, lowEstimate, expectedEstimate,
                highEstimate, currency || 'USD', timeframe || 'per year', notes
            ], function (err) {
                if (err) return reject(err);
                resolve({ id, valueHypothesisId });
            });
        });
    },

    /**
     * Detect initiatives without value hypotheses
     */
    detectMissingValueHypotheses: async (projectId) => {
        return new Promise((resolve, reject) => {
            deps.db.all(`SELECT i.id, i.name FROM initiatives i
                    LEFT JOIN value_hypotheses vh ON i.id = vh.initiative_id
                    WHERE i.project_id = ? AND vh.id IS NULL AND i.status NOT IN ('CANCELLED', 'DRAFT')`,
                [projectId], (err, rows) => {
                    if (err) return reject(err);
                    resolve({
                        projectId,
                        initiativesWithoutValue: rows || [],
                        count: (rows || []).length,
                        hasIssues: (rows || []).length > 0
                    });
                });
        });
    },

    /**
     * Generate value summary for project
     */
    getValueSummary: async (projectId) => {
        // Get hypotheses by type
        const byType = await new Promise((resolve, reject) => {
            deps.db.all(`SELECT type, COUNT(*) as count, 
                    SUM(CASE WHEN is_validated = 1 THEN 1 ELSE 0 END) as validated
                    FROM value_hypotheses WHERE project_id = ? GROUP BY type`,
                [projectId], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows || []);
                });
        });

        // Get financial totals
        const financials = await new Promise((resolve, reject) => {
            deps.db.get(`SELECT 
                    SUM(fa.low_estimate) as total_low,
                    SUM(fa.expected_estimate) as total_expected,
                    SUM(fa.high_estimate) as total_high
                    FROM financial_assumptions fa
                    JOIN value_hypotheses vh ON fa.value_hypothesis_id = vh.id
                    WHERE vh.project_id = ?`,
                [projectId], (err, row) => {
                    if (err) reject(err);
                    else resolve(row || {});
                });
        });

        const missingValue = await EconomicsService.detectMissingValueHypotheses(projectId);

        return {
            projectId,
            hypothesesByType: byType,
            financialRange: {
                low: financials.total_low || 0,
                expected: financials.total_expected || 0,
                high: financials.total_high || 0
            },
            initiativesWithoutValue: missingValue.count,
            generatedAt: new Date().toISOString()
        };
    }
};

module.exports = EconomicsService;
