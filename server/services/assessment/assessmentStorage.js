export const createAssessmentStorage = ({ deps, initDeps }) => ({
    getAssessment: async (projectId) => {
        await initDeps();
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

    saveAssessment: async (projectId, assessmentData) => {
        await initDeps();
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

    getAssessmentStatus: async (projectId) => {
        await initDeps();
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
    }
});
