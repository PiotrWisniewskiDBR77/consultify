export const createAssessmentWorkflow = ({ deps, initDeps, getAssessment, getAssessmentStatus }) => ({
    canEditAssessment: async (projectId, userId) => {
        try {
            const status = await getAssessmentStatus(projectId);
            return status === 'IN_PROGRESS';
        } catch (error) {
            console.error('Error checking edit permission:', error);
            return false;
        }
    },

    finalizeAssessment: async (projectId, userId) => {
        await initDeps();
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
                                getAssessment(projectId)
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
});
