import type { V8InterviewSessionEvaluation } from '@/services/api/v8/interview';

export interface AiReviewSignal {
  label: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface AiReviewSummary {
  score0to100: number | null;
  verdict: 'good' | 'needs_attention' | 'blocked' | 'empty' | 'timeout';
  reviewedAt: string | null;
  sourceModule: 'interview' | 'assessment' | 'materials';
  sourceId: string;
  rubricVersion?: string;
  signals: AiReviewSignal[];
}

export const AI_SCORE_THRESHOLD_GOOD = 80;
export const AI_SCORE_THRESHOLD_NEEDS_ATTENTION = 50;

export function mapRubricScoreTo100(overallScore: number | null | undefined): number | null {
  if (typeof overallScore !== 'number' || !Number.isFinite(overallScore)) return null;
  return Math.round(Math.max(0, Math.min(1, (overallScore - 1) / 4)) * 100);
}

export function verdictFromScore(score0to100: number | null): AiReviewSummary['verdict'] {
  if (score0to100 === null) return 'empty';
  if (score0to100 >= AI_SCORE_THRESHOLD_GOOD) return 'good';
  if (score0to100 >= AI_SCORE_THRESHOLD_NEEDS_ATTENTION) return 'needs_attention';
  return 'blocked';
}

export function fromScoreAiReview(input: {
  score0to100: number | null | undefined;
  reviewedAt?: string | null;
  sourceModule: AiReviewSummary['sourceModule'];
  sourceId: string;
  rubricVersion?: string;
  signals?: AiReviewSignal[];
}): AiReviewSummary {
  const rawScore = input.score0to100;
  const score0to100 =
    typeof rawScore === 'number' && Number.isFinite(rawScore)
      ? Math.round(Math.max(0, Math.min(100, rawScore)))
      : null;

  return {
    score0to100,
    verdict: verdictFromScore(score0to100),
    reviewedAt: input.reviewedAt ?? null,
    sourceModule: input.sourceModule,
    sourceId: input.sourceId,
    rubricVersion: input.rubricVersion,
    signals: input.signals || [],
  };
}

export function fromAssessmentAiReview(input: {
  overallScore?: number | null;
  scale?: '0-100' | '1-5';
  reviewedAt?: string | null;
  sourceId: string;
  signals?: AiReviewSignal[];
}): AiReviewSummary {
  const score0to100 =
    input.scale === '1-5'
      ? mapRubricScoreTo100(input.overallScore)
      : typeof input.overallScore === 'number'
        ? input.overallScore
        : null;
  return fromScoreAiReview({
    score0to100,
    reviewedAt: input.reviewedAt,
    sourceModule: 'assessment',
    sourceId: input.sourceId,
    signals: input.signals,
  });
}

export function fromMaterialsAiReview(input: {
  qualityScore?: number | null;
  reviewedAt?: string | null;
  sourceId: string;
  signals?: AiReviewSignal[];
}): AiReviewSummary {
  return fromScoreAiReview({
    score0to100: input.qualityScore,
    reviewedAt: input.reviewedAt,
    sourceModule: 'materials',
    sourceId: input.sourceId,
    signals: input.signals,
  });
}

function severityFromWeakVerdict(
  v: string | undefined
): AiReviewSignal['severity'] {
  if (v === 'insufficient' || v === 'unanswered') return 'critical';
  if (v === 'needs_improvement') return 'warning';
  return 'info';
}

export function fromInterviewAiReview(
  aiReview: V8InterviewSessionEvaluation | null | undefined,
  aiReviewedAt: string | null | undefined,
  sourceId: string
): AiReviewSummary {
  if (!aiReview) {
    return {
      score0to100: null,
      verdict: 'empty',
      reviewedAt: aiReviewedAt ?? null,
      sourceModule: 'interview',
      sourceId,
      signals: [],
    };
  }

  const score0to100 = mapRubricScoreTo100(aiReview.overallScore);
  const signals: AiReviewSignal[] = (aiReview.weakAnswerMap || []).map((w) => ({
    label: w.label || w.key,
    severity: severityFromWeakVerdict(w.verdict),
    message: w.feedback || '',
  }));

  return {
    score0to100,
    verdict: verdictFromScore(score0to100),
    reviewedAt: aiReviewedAt ?? null,
    sourceModule: 'interview',
    sourceId,
    rubricVersion: (aiReview as { rubricVersion?: string }).rubricVersion,
    signals,
  };
}
