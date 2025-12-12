// server/models/megatrend.js
// Provides data access for Megatrend Scanner module
// Uses the existing SQLite/Postgres db abstraction (db.get, db.all, db.run)

const db = require('../database');

// Helper to map DB rows to JS objects
function mapMegatrendRow(row) {
    return {
        id: row.id,
        industry: row.industry,
        type: row.type, // Technology / Business / Societal
        label: row.label,
        description: row.description,
        baseImpactScore: row.base_impact_score,
        initialRing: row.initial_ring, // Now / Watch / Horizon
    };
}

/**
 * Get default megatrends for a given industry.
 * If no industry is provided, returns all baseline trends.
 */
function getBaselineTrends(industry) {
    return new Promise((resolve, reject) => {
        let sql = `SELECT * FROM megatrends`;
        const params = [];
        if (industry) {
            sql += ` WHERE industry = ?`;
            params.push(industry);
        }
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows.map(mapMegatrendRow));
        });
    });
}

/**
 * Get data for the radar chart.
 * Returns an array of { label, type, ring, impact } for the selected industry.
 */
function getRadarData(industry) {
    return new Promise((resolve, reject) => {
        let sql = `SELECT label, type, initial_ring as ring, base_impact_score as impact FROM megatrends`;
        const params = [];
        if (industry) {
            sql += ` WHERE industry = ?`;
            params.push(industry);
        }
        db.all(sql, params, (err, rows) => {
            if (err) return reject(err);
            resolve(rows.map(r => ({
                label: r.label,
                type: r.type,
                ring: r.ring,
                impact: r.impact,
            })));
        });
    });
}

/**
 * Get full detail for a specific megatrend (including AI insights).
 */
function getTrendDetail(id) {
    return new Promise((resolve, reject) => {
        const sql = `SELECT * FROM megatrends WHERE id = ?`;
        db.get(sql, [id], (err, row) => {
            if (err) return reject(err);
            if (!row) return resolve(null);
            // Placeholder AI insights; can be extended later.
            const insight = {
                suggestedRing: row.initial_ring,
                risks: [],
                opportunities: [],
                recommendedActions: []
            };
            resolve({ ...mapMegatrendRow(row), aiInsight: insight });
        });
    });
}

/**
 * Create a custom/company‑specific trend.
 * payload: { industry, type, label, description, ring }
 */
function createCustomTrend(payload, companyId) {
    return new Promise((resolve, reject) => {
        const { industry, type, label, description, ring } = payload;
        const id = require('uuid').v4();
        const sql = `INSERT INTO custom_trends (id, company_id, industry, type, label, description, ring)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [id, companyId, industry, type, label, description, ring], function (err) {
            if (err) return reject(err);
            resolve({ id, ...payload, ring });
        });
    });
}

/**
 * Update an existing custom trend.
 */
function updateCustomTrend(id, payload, companyId) {
    return new Promise((resolve, reject) => {
        const fields = [];
        const params = [];
        if (payload.industry) { fields.push('industry = ?'); params.push(payload.industry); }
        if (payload.type) { fields.push('type = ?'); params.push(payload.type); }
        if (payload.label) { fields.push('label = ?'); params.push(payload.label); }
        if (payload.description) { fields.push('description = ?'); params.push(payload.description); }
        if (payload.ring) { fields.push('ring = ?'); params.push(payload.ring); }
        if (fields.length === 0) return resolve(null);
        const sql = `UPDATE custom_trends SET ${fields.join(', ')} WHERE id = ? AND company_id = ?`;
        params.push(id, companyId);
        db.run(sql, params, function (err) {
            if (err) return reject(err);
            resolve({ id, ...payload });
        });
    });
}

module.exports = {
    getBaselineTrends,
    getRadarData,
    getTrendDetail,
    createCustomTrend,
    updateCustomTrend,
};
