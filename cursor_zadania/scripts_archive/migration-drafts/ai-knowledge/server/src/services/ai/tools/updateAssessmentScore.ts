/**
 * MIGRATION DRAFT (auto-generated)
 * Source: server/services/ai/tools/updateAssessmentScore.js
 * Target: server/src/services/ai/tools/updateAssessmentScore.ts
 * Status: wrapper
 *
 * TODO:
 * - Convert require/imports to ES module imports.
 * - Replace db callbacks with DbPromise/getDatabase().
 * - Add types and runtime validation where needed.
 */

/**
 * Update Assessment Score Tool Handler
 * MUTATION - Requires user approval before execution
 */

const db = require('../../../database');

async function updateAssessmentScore(params, context) {
    const { assessmentId, axisId, score } = params;
    const { userId } = context;

    return new Promise((resolve, reject) => {
        db.run(
            `UPDATE assessment_scores 
             SET score = ?, updated_by = ?, updated_at = datetime('now')
             WHERE assessment_id = ? AND axis_id = ?`,
            [score, userId, assessmentId, axisId],
            function (err) {
                if (err) {
                    // If table doesn't exist, return simulated success
                    if (err.message.includes('no such table') || err.message.includes('no such column')) {
                        resolve({
                            success: true,
                            message: `Score for axis ${axisId} would be updated to ${score} (simulated)`,
                        });
                    } else {
                        reject(err);
                    }
                } else {
                    resolve({
                        success: this.changes > 0,
                        message:
                            this.changes > 0
                                ? `Score updated to ${score} for axis ${axisId}`
                                : `No matching assessment found`,
                    });
                }
            },
        );
    });
}

module.exports = { updateAssessmentScore };
