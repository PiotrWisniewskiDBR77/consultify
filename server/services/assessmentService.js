// Dependency injection container (for deterministic unit tests)
const deps = {
    db: require('../database'),
    uuidv4: require('uuid').v4
};

const AssessmentService = {
    // For testing: allow overriding dependencies
    setDependencies: (newDeps = {}) => {
        Object.assign(deps, newDeps);
    },
    /**
     * Get or create assessment for a project
     * @param {string} projectId
     */
    getAssessment: (projectId) => {
        return new Promise((resolve, reject) => {
            deps.db.get(`SELECT * FROM maturity_assessments WHERE project_id = ?`, [projectId], (err, row) => {
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

            deps.db.run(sql, [
                projectId, deps.uuidv4(),
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
    },

    /**
     * Get Assessment Status
     * @param {string} projectId
     * @returns {Promise<string>} 'IN_PROGRESS' | 'FINALIZED'
     */
    getAssessmentStatus: (projectId) => {
        return new Promise((resolve, reject) => {
            deps.db.get(
                `SELECT assessment_status FROM maturity_assessments WHERE project_id = ?`,
                [projectId],
                (err, row) => {
                    if (err) return reject(err);
                    // Default to IN_PROGRESS for backward compatibility
                    resolve(row?.assessment_status || 'IN_PROGRESS');
                }
            );
        });
    },

    /**
     * Check if assessment can be edited
     * @param {string} projectId
     * @param {string} userId
     * @returns {Promise<boolean>}
     */
    canEditAssessment: async (projectId, userId) => {
        try {
            const status = await AssessmentService.getAssessmentStatus(projectId);
            return status === 'IN_PROGRESS';
        } catch (error) {
            console.error('Error checking edit permission:', error);
            return false;
        }
    },

    /**
     * Finalize Assessment
     * Changes status to FINALIZED and triggers report generation
     * @param {string} projectId
     * @param {string} userId
     * @returns {Promise<Object>} Updated assessment with reportId
     */
    finalizeAssessment: (projectId, userId) => {
        return new Promise((resolve, reject) => {
            // First, validate that all axes are completed
            deps.db.get(
                `SELECT axis_scores, completed_axes FROM maturity_assessments WHERE project_id = ?`,
                [projectId],
                (err, row) => {
                    if (err) return reject(err);
                    if (!row) return reject(new Error('Assessment not found'));

                    try {
                        const axisScores = row.axis_scores ? JSON.parse(row.axis_scores) : [];
                        const completedAxes = row.completed_axes ? JSON.parse(row.completed_axes) : [];

                        // Validate: all 7 axes must have both actual and target
                        if (axisScores.length < 7) {
                            return reject(new Error('All 7 axes must be completed before finalizing'));
                        }

                        const allComplete = axisScores.every(s => s.asIs > 0 && s.toBe > 0);
                        if (!allComplete) {
                            return reject(new Error('All axes must have both actual and target levels'));
                        }

                        // Update status to FINALIZED
                        const finalizedAt = new Date().toISOString();
                        deps.db.run(
                            `UPDATE maturity_assessments 
                             SET assessment_status = 'FINALIZED', 
                                 finalized_at = ?,
                                 updated_at = CURRENT_TIMESTAMP
                             WHERE project_id = ?`,
                            [finalizedAt, projectId],
                            function (updateErr) {
                                if (updateErr) return reject(updateErr);

                                // Return updated assessment
                                AssessmentService.getAssessment(projectId)
                                    .then(assessment => {
                                        resolve({
                                            ...assessment,
                                            status: 'FINALIZED',
                                            finalizedAt
                                        });
                                    })
                                    .catch(reject);
                            }
                        );
                    } catch (parseErr) {
                        reject(new Error('Invalid assessment data format'));
                    }
                }
            );
        });
    }
};

module.exports = AssessmentService;
