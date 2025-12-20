const db = require('../database');
const { v4: uuidv4 } = require('uuid');

const AssessmentService = {
    /**
     * Get or create assessment for a project
     * @param {string} projectId
     */
    getAssessment: (projectId) => {
        return new Promise((resolve, reject) => {
            db.get(`SELECT * FROM maturity_assessments WHERE project_id = ?`, [projectId], (err, row) => {
                if (err) return reject(err);
                if (!row) return resolve(null);
                try {
                    resolve({
                        ...row,
                        axisScores: row.axis_scores ? JSON.parse(row.axis_scores) : [],
                        completedAxes: row.completed_axes ? JSON.parse(row.completed_axes) : []
                    });
                } catch (e) {
                    resolve({ ...row, axisScores: [], completedAxes: [] });
                }
            });
        });
    },

    /**
     * Save assessment
     * @param {string} projectId
     * @param {Object} assessmentData
     */
    saveAssessment: (projectId, assessmentData) => {
        return new Promise((resolve, reject) => {
            const { axisScores, completedAxes } = assessmentData;

            // Calculate overall scores
            let totalAsIs = 0, totalToBe = 0, count = 0;
            (axisScores || []).forEach(s => {
                totalAsIs += s.asIs || 0;
                totalToBe += s.toBe || 0;
                count++;
            });
            const overallAsIs = count > 0 ? (totalAsIs / count).toFixed(2) : 0;
            const overallToBe = count > 0 ? (totalToBe / count).toFixed(2) : 0;
            const overallGap = (overallToBe - overallAsIs).toFixed(2);

            const isComplete = (completedAxes || []).length >= 7; // All 7 axes

            // Upsert
            const sql = `INSERT OR REPLACE INTO maturity_assessments 
                (id, project_id, axis_scores, completed_axes, overall_as_is, overall_to_be, overall_gap, is_complete, updated_at)
                VALUES (
                    COALESCE((SELECT id FROM maturity_assessments WHERE project_id = ?), ?),
                    ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
                )`;

            db.run(sql, [
                projectId, uuidv4(),
                projectId,
                JSON.stringify(axisScores || []),
                JSON.stringify(completedAxes || []),
                overallAsIs, overallToBe, overallGap,
                isComplete ? 1 : 0
            ], function (err) {
                if (err) return reject(err);
                resolve({
                    projectId,
                    overallAsIs: parseFloat(overallAsIs),
                    overallToBe: parseFloat(overallToBe),
                    overallGap: parseFloat(overallGap),
                    isComplete
                });
            });
        });
    },

    /**
     * Generate Gap Analysis Summary (Simple Version)
     * @param {Object} assessment
     */
    generateGapSummary: (assessment) => {
        const gaps = (assessment.axisScores || [])
            .map(s => ({ axis: s.axis, gap: s.toBe - s.asIs }))
            .sort((a, b) => b.gap - a.gap);

        const prioritized = gaps.filter(g => g.gap > 2).map(g => g.axis);

        return {
            prioritizedGaps: prioritized,
            gapAnalysisSummary: prioritized.length > 0
                ? `Focus areas with significant gaps: ${prioritized.join(', ')}`
                : 'No critical gaps detected. Proceed to initiative planning.'
        };
    }
};

module.exports = AssessmentService;
