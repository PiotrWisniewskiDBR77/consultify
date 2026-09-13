export const INTERVIEW_ANSWER_APPROVAL_MODES = ['ai', 'manager', 'two_stage'] as const;

export type InterviewAnswerApprovalMode = (typeof INTERVIEW_ANSWER_APPROVAL_MODES)[number];
export type InterviewAnswerApprovalStage = 'ai' | 'manager';
export type InterviewAnswerApprovalDecision = 'approved' | 'rejected';

export const DEFAULT_INTERVIEW_ANSWER_APPROVAL_MODE: InterviewAnswerApprovalMode = 'manager';

export interface ResolvedInterviewAnswerApprovalPolicy {
  mode: InterviewAnswerApprovalMode;
  stages: readonly InterviewAnswerApprovalStage[];
  source: 'organization_policy' | 'default';
}

export interface InterviewAnswerApprovalStageDecision {
  stage: InterviewAnswerApprovalStage;
  decision: InterviewAnswerApprovalDecision;
}

export interface InterviewAnswerApprovalProgress {
  status: 'pending' | 'stages_complete' | 'rejected';
  nextStage: InterviewAnswerApprovalStage | null;
}

type JsonObject = Record<string, unknown>;

function objectOrNull(value: unknown): JsonObject | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as JsonObject)
    : null;
}

function parseObject(value: unknown): JsonObject | null {
  if (typeof value !== 'string') return objectOrNull(value);
  try {
    return objectOrNull(JSON.parse(value));
  } catch {
    return null;
  }
}

function stagesFor(mode: InterviewAnswerApprovalMode): readonly InterviewAnswerApprovalStage[] {
  if (mode === 'ai') return ['ai'];
  if (mode === 'two_stage') return ['ai', 'manager'];
  return ['manager'];
}

/**
 * Reads the additive organization policy key:
 * `organization_ai_policy.policy.interview.answerApproval.mode`.
 *
 * Existing organizations and malformed/unrecognized values fail closed to the
 * human-manager path. The caller may pass either the JSON policy itself or the
 * database/API row containing a `policy` field.
 */
export function resolveInterviewAnswerApprovalPolicy(
  raw: unknown
): ResolvedInterviewAnswerApprovalPolicy {
  const input = parseObject(raw);
  const policy = parseObject(input && 'policy' in input ? input.policy : input);
  const interview = objectOrNull(policy?.interview);
  const answerApproval = objectOrNull(interview?.answerApproval);
  const candidate = answerApproval?.mode;
  const mode = INTERVIEW_ANSWER_APPROVAL_MODES.includes(candidate as InterviewAnswerApprovalMode)
    ? (candidate as InterviewAnswerApprovalMode)
    : DEFAULT_INTERVIEW_ANSWER_APPROVAL_MODE;

  return {
    mode,
    stages: stagesFor(mode),
    source:
      candidate === mode && INTERVIEW_ANSWER_APPROVAL_MODES.includes(mode)
        ? 'organization_policy'
        : 'default',
  };
}

/** Preserves every unrelated organization AI policy key. */
export function withInterviewAnswerApprovalMode(
  rawPolicy: unknown,
  mode: InterviewAnswerApprovalMode
): JsonObject {
  const policy = parseObject(rawPolicy) ?? {};
  const interview = objectOrNull(policy.interview) ?? {};
  const answerApproval = objectOrNull(interview.answerApproval) ?? {};
  return {
    ...policy,
    interview: {
      ...interview,
      answerApproval: {
        ...answerApproval,
        version: 1,
        mode,
      },
    },
  };
}

/**
 * Pure stage-order rule for policy presentation and future orchestration.
 * Decisions must already be scoped to one exact answer submission/revision.
 * `stages_complete` deliberately does not mean final approval: this safe slice
 * neither makes nor persists the final Interview acceptance decision.
 */
export function deriveInterviewAnswerApprovalProgress(
  policy: ResolvedInterviewAnswerApprovalPolicy,
  decisions: readonly InterviewAnswerApprovalStageDecision[]
): InterviewAnswerApprovalProgress {
  let previousStageDecisionIndex = -1;
  for (const stage of policy.stages) {
    let latestIndex = -1;
    let latestDecision: InterviewAnswerApprovalDecision | null = null;
    for (let index = previousStageDecisionIndex + 1; index < decisions.length; index += 1) {
      if (decisions[index]?.stage !== stage) continue;
      latestIndex = index;
      latestDecision = decisions[index]?.decision ?? null;
    }
    if (latestDecision === 'rejected') return { status: 'rejected', nextStage: stage };
    if (latestDecision !== 'approved') return { status: 'pending', nextStage: stage };
    previousStageDecisionIndex = latestIndex;
  }
  return { status: 'stages_complete', nextStage: null };
}
