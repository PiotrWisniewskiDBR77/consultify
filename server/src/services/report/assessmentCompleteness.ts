export type AssessmentResponseScore = {
  actual?: unknown;
  current?: unknown;
  achievedLevel?: unknown;
};

/** A methodology target is not an assessment response. */
export const hasAssessmentResponse = (score: AssessmentResponseScore | null | undefined): boolean =>
  Boolean(
    score &&
      (Number(score.actual ?? 0) > 0 ||
        Number(score.current ?? 0) > 0 ||
        Number(score.achievedLevel ?? 0) > 0)
  );
