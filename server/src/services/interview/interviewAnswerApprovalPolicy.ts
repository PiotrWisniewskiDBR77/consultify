export const INTERVIEW_ANSWER_APPROVAL_MODES = ['ai', 'manager', 'two_stage'] as const;

export type InterviewAnswerApprovalMode = (typeof INTERVIEW_ANSWER_APPROVAL_MODES)[number];
export type InterviewAnswerApprovalStage = 'ai' | 'manager';
export type InterviewAnswerApprovalDecision = 'approved' | 'sent_back';

export const DEFAULT_INTERVIEW_ANSWER_APPROVAL_MODE: InterviewAnswerApprovalMode = 'manager';
export const INTERVIEW_ANSWER_APPROVAL_POLICY_VERSION = 1;

export type InterviewAnswerApprovalPolicyCompatibility =
  | 'supported'
  | 'default_missing'
  | 'invalid_version'
  | 'unsupported_future_version'
  | 'invalid_mode';

export interface ResolvedInterviewAnswerApprovalPolicy {
  mode: InterviewAnswerApprovalMode;
  stages: readonly InterviewAnswerApprovalStage[];
  source: 'organization_policy' | 'default';
  compatibility: InterviewAnswerApprovalPolicyCompatibility;
  configuredVersion: number | null;
}

export interface InterviewAnswerApprovalStageDecision {
  receiptId: string;
  ordinal: number;
  stage: InterviewAnswerApprovalStage;
  decision: InterviewAnswerApprovalDecision;
}

export interface InterviewAnswerApprovalProgress {
  status: 'pending' | 'stages_complete' | 'sent_back';
  nextStage: InterviewAnswerApprovalStage | null;
}

export type InterviewAnswerApprovalPolicyUpdateResult =
  | { ok: true; policy: JsonObject }
  | {
      ok: false;
      code:
        | 'INTERVIEW_ANSWER_APPROVAL_POLICY_VERSION_INVALID'
        | 'INTERVIEW_ANSWER_APPROVAL_POLICY_VERSION_UNSUPPORTED';
      configuredVersion: unknown;
    };

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
  if (!answerApproval) {
    return {
      mode: DEFAULT_INTERVIEW_ANSWER_APPROVAL_MODE,
      stages: stagesFor(DEFAULT_INTERVIEW_ANSWER_APPROVAL_MODE),
      source: 'default',
      compatibility: 'default_missing',
      configuredVersion: null,
    };
  }

  const configuredVersion = answerApproval.version;
  if (!Number.isInteger(configuredVersion) || (configuredVersion as number) < 1) {
    return {
      mode: DEFAULT_INTERVIEW_ANSWER_APPROVAL_MODE,
      stages: stagesFor(DEFAULT_INTERVIEW_ANSWER_APPROVAL_MODE),
      source: 'default',
      compatibility: 'invalid_version',
      configuredVersion: null,
    };
  }
  if ((configuredVersion as number) > INTERVIEW_ANSWER_APPROVAL_POLICY_VERSION) {
    return {
      mode: DEFAULT_INTERVIEW_ANSWER_APPROVAL_MODE,
      stages: stagesFor(DEFAULT_INTERVIEW_ANSWER_APPROVAL_MODE),
      source: 'default',
      compatibility: 'unsupported_future_version',
      configuredVersion: configuredVersion as number,
    };
  }

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
    compatibility: candidate === mode ? 'supported' : 'invalid_mode',
    configuredVersion: configuredVersion as number,
  };
}

/**
 * Preserves every unrelated organization AI policy key. A present policy with
 * an invalid or future version is never rewritten or downgraded by this v1
 * helper; a future writer must return the refusal to its caller.
 */
export function withInterviewAnswerApprovalMode(
  rawPolicy: unknown,
  mode: InterviewAnswerApprovalMode
): InterviewAnswerApprovalPolicyUpdateResult {
  const policy = parseObject(rawPolicy) ?? {};
  const interview = objectOrNull(policy.interview) ?? {};
  const answerApproval = objectOrNull(interview.answerApproval);
  if (answerApproval) {
    const configuredVersion = answerApproval.version;
    if (!Number.isInteger(configuredVersion) || (configuredVersion as number) < 1) {
      return {
        ok: false,
        code: 'INTERVIEW_ANSWER_APPROVAL_POLICY_VERSION_INVALID',
        configuredVersion,
      };
    }
    if ((configuredVersion as number) > INTERVIEW_ANSWER_APPROVAL_POLICY_VERSION) {
      return {
        ok: false,
        code: 'INTERVIEW_ANSWER_APPROVAL_POLICY_VERSION_UNSUPPORTED',
        configuredVersion,
      };
    }
  }
  return {
    ok: true,
    policy: {
      ...policy,
      interview: {
        ...interview,
        answerApproval: {
          ...(answerApproval ?? {}),
          version: INTERVIEW_ANSWER_APPROVAL_POLICY_VERSION,
          mode,
        },
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
  const orderedDecisions = [...decisions]
    .filter(
      (decision) =>
        Number.isInteger(decision.ordinal) && decision.ordinal > 0 && decision.receiptId.length > 0
    )
    .sort((left, right) => {
      if (left.ordinal !== right.ordinal) return left.ordinal - right.ordinal;
      if (left.receiptId < right.receiptId) return -1;
      if (left.receiptId > right.receiptId) return 1;
      return 0;
    });
  let previousStageDecisionIndex = -1;
  for (const stage of policy.stages) {
    let latestIndex = -1;
    let latestDecision: InterviewAnswerApprovalDecision | null = null;
    for (let index = previousStageDecisionIndex + 1; index < orderedDecisions.length; index += 1) {
      if (orderedDecisions[index]?.stage !== stage) continue;
      latestIndex = index;
      latestDecision = orderedDecisions[index]?.decision ?? null;
    }
    if (latestDecision === 'sent_back') return { status: 'sent_back', nextStage: stage };
    if (latestDecision !== 'approved') return { status: 'pending', nextStage: stage };
    previousStageDecisionIndex = latestIndex;
  }
  return { status: 'stages_complete', nextStage: null };
}
