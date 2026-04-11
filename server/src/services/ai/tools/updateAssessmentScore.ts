/**
 * Update Assessment Score Tool Handler
 * MUTATION - Requires user approval before execution.
 */

import * as DbPromise from '../../../utils/DbPromise.js';

type UpdateAssessmentScoreParams = {
  assessmentId: string;
  axisId: string;
  score: number;
};

type ToolContext = {
  userId?: string;
};

export async function updateAssessmentScore(
  params: UpdateAssessmentScoreParams,
  context: ToolContext = {}
): Promise<Record<string, unknown>> {
  const { assessmentId, axisId, score } = params;
  const { userId } = context;

  try {
    const assessment = await DbPromise.get(
      `SELECT p28_workbench_v1 FROM assessments WHERE id = ? LIMIT 1`,
      [assessmentId],
      { fallback: false }
    );
    if ((assessment as { p28_workbench_v1?: string | null } | null)?.p28_workbench_v1) {
      return {
        success: false,
        code: 'P28_NO_SILENT_SCORING',
        message: 'P28 assessment scores must be proposed and reviewed in the workbench',
      };
    }

    const result = await DbPromise.run(
      `UPDATE assessment_scores 
             SET score = ?, updated_by = ?, updated_at = datetime('now')
             WHERE assessment_id = ? AND axis_id = ?`,
      [score, userId || null, assessmentId, axisId],
      { fallback: false }
    );

    const changes = result.changes || 0;
    return {
      success: changes > 0,
      message:
        changes > 0
          ? `Score updated to ${score} for axis ${axisId}`
          : 'No matching assessment found',
    };
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message.includes('no such table') || err.message.includes('no such column')) {
      return {
        success: true,
        message: `Score for axis ${axisId} would be updated to ${score} (simulated)`,
      };
    }
    throw err;
  }
}

export default { updateAssessmentScore };
