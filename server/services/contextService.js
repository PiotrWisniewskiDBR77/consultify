const db = require('../database');

const ContextService = {
    /**
     * Get project context
     * @param {string} projectId
     * @returns {Promise<Object>}
     */
    getContext: (projectId) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT context_data FROM projects WHERE id = ?`, [projectId], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);
                try {
                    resolve(row.context_data ? JSON.parse(row.context_data) : {});
                } catch (e) {
                    resolve({});
                }
            });
        });
    },

    /**
     * Save project context
     * @param {string} projectId
     * @param {Object} contextData
     */
    saveContext: (projectId, contextData) => {
        return new Promise((resolve, reject) => {
            const sql = `UPDATE projects SET context_data = ? WHERE id = ?`;
            db.run(sql, [JSON.stringify(contextData), projectId], function (err) {
                if (err) return reject(err);
                resolve({ projectId, success: true });
            });
        });
    },

    /**
     * Calculate Context Readiness Score
     * Simple heuristic: % of required fields filled
     * @param {Object} context
     * @returns {Object} { score, gaps, isComplete }
     */
    calculateReadiness: (context) => {
        const requiredFields = [
            { key: 'strategicGoals', label: 'Strategic Goals' },
            { key: 'challenges', label: 'Challenges' },
            { key: 'constraints', label: 'Constraints' },
            { key: 'businessModel', label: 'Business Model' },
            { key: 'transformationHorizon', label: 'Transformation Horizon' }
        ];

        const gaps = [];
        let filled = 0;

        requiredFields.forEach(field => {
            const value = context[field.key];
            if (value && (Array.isArray(value) ? value.length > 0 : true)) {
                filled++;
            } else {
                gaps.push(field.label);
            }
        });

        const score = Math.round((filled / requiredFields.length) * 100);
        return {
            score,
            gaps,
            isComplete: score >= 80
        };
    }
};

module.exports = ContextService;
