/**
 * P09 Final V8 — Survey collection lane canon.
 *
 * §2.3.1 Submission status grammar (canonical)
 * §2.3.2 Operator workflow posture
 * §2.3.3 Branching / skip posture
 * §2.3.4 Handoff payload to P10 (Wnioski w Interview)
 * §2.3.5 Anti-duplicate posture
 * §2.3.6 Degraded modes / errors
 * §2.3.7 Acceptance checklist (5+ points)
 *
 * Primary doctrine: Ankiety is a COLLECTION LANE that produces governed
 * submissions and a handoff payload into Wnioski w Interview (P10).
 * It does NOT compute, rank, or narrate "insights".
 */

export const P09_COLLECTION_LANE_CONTRACT = 'survey_collection_lane_v1';

// ────────────────────────────────────────────────────────────────
// §2.3.1 — Submission status grammar (canonical)
// ────────────────────────────────────────────────────────────────

export const P09_SUBMISSION_STATUSES = [
  'draft',
  'submitted',
  'under_review',
  'accepted',
  'rejected',
  'locked',
] as const;

export type P09SubmissionStatus = (typeof P09_SUBMISSION_STATUSES)[number];

export const P09_SUBMISSION_NEXT_ACTIONS: Record<
  P09SubmissionStatus,
  { operatorAction: string; notes: string }
> = {
  draft: {
    operatorAction: 'wait / remind respondent / monitor progress',
    notes: 'Submission started but not yet confirmed complete',
  },
  submitted: {
    operatorAction: 'review / validate / move to under_review',
    notes: 'Respondent finished; payload structurally valid',
  },
  under_review: {
    operatorAction: 'accept / reject / request clarification',
    notes: 'Operator actively reviewing submission content',
  },
  accepted: {
    operatorAction: 'lock when collection closes / export / handoff to P10',
    notes: 'Submission passed review; eligible for downstream processing',
  },
  rejected: {
    operatorAction: 'mark rejection reason / allow resubmission if policy permits',
    notes: 'Submission failed review; must carry rejection reason',
  },
  locked: {
    operatorAction: 'none (read / export / handoff only)',
    notes: 'Read-only truth after collection close; no edits to answers, only annotations',
  },
} as const;

export const P09_STATUS_TRANSITIONS: Record<P09SubmissionStatus, P09SubmissionStatus[]> = {
  draft: ['submitted'],
  submitted: ['under_review', 'rejected'],
  under_review: ['accepted', 'rejected'],
  accepted: ['locked'],
  rejected: [],
  locked: [],
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.2 — Survey lifecycle (operator workflow)
// ────────────────────────────────────────────────────────────────

export const P09_SURVEY_LIFECYCLE = [
  'draft',
  'published',
  'collecting',
  'review_queue',
  'closed',
  'archived',
] as const;

export type P09SurveyLifecycleState = (typeof P09_SURVEY_LIFECYCLE)[number];

// ────────────────────────────────────────────────────────────────
// §2.3.3 — Branching / skip posture (scope-frozen)
// ────────────────────────────────────────────────────────────────

export const P09_BRANCHING_POSTURE = {
  supported: [
    'skip_logic',
    'conditional_display',
  ] as const,
  non_goal: [
    'complex_scripting',
    'quotas',
    'randomized_blocks',
    'complex_scoring',
    'loops',
    'multi_language_orchestration',
  ] as const,
  validation_expectation:
    'Before publish, the system must detect and block obvious dead-ends / unreachable required questions, or explicitly downgrade to warning + publish-with-known-limits',
  preview_requirement:
    'Operator can preview the pathing before publish (single-pass, acyclic)',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.4 — Handoff payload to P10 (Wnioski w Interview)
// ────────────────────────────────────────────────────────────────

export interface P09HandoffToP10Payload {
  surveyId: string;
  submissionId: string;
  respondentId?: string | null;
  externalReference?: string | null;
  timestamps: {
    started: string;
    submitted: string;
    locked?: string | null;
  };
  governance: {
    submissionStatus: P09SubmissionStatus;
    validationSummary: string;
    operatorResolutionNotes?: string | null;
  };
  content: {
    normalizedAnswers: Array<{
      questionId: string;
      questionText: string;
      answerValue: unknown;
      answerType: string;
    }>;
    attachmentRefs: string[];
    consentFlags?: Record<string, boolean>;
  };
  provenance: {
    exportArtifactRef?: string | null;
    auditTrailPointers: string[];
    surveyVersionAtSubmission: string;
  };
  idempotencyKey: string;
}

export const P09_HANDOFF_TO_P10 = {
  required_fields: [
    'surveyId',
    'submissionId',
    'timestamps.started',
    'timestamps.submitted',
    'governance.submissionStatus',
    'governance.validationSummary',
    'content.normalizedAnswers',
    'provenance.surveyVersionAtSubmission',
    'idempotencyKey',
  ] as const,
  optional_fields: [
    'respondentId',
    'externalReference',
    'timestamps.locked',
    'governance.operatorResolutionNotes',
    'content.attachmentRefs',
    'content.consentFlags',
    'provenance.exportArtifactRef',
    'provenance.auditTrailPointers',
  ] as const,
  delivery_semantics:
    'Handoff must be idempotent: same submissionId cannot create multiple P10 items',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.5 — Anti-duplicate posture
// ────────────────────────────────────────────────────────────────

export const P09_ANTI_DUPLICATE_RULES = {
  at_least_once_delivery:
    'Upstream delivery can be at-least-once (retries/re-delivery); design for idempotency',
  idempotency_key:
    'Duplicates detected via stable idempotency key (submissionId preferred; otherwise composite key policy must be declared)',
  no_double_counting:
    'Duplicate handling must produce one governed outcome: no double-counting, handoff remains single truth',
  no_collection_engine:
    'Survey is a collection lane, not an insight engine; source of truth for input remains upstream',
} as const;

// ────────────────────────────────────────────────────────────────
// §2.3.6 — Degraded modes / errors (8+ scenarios)
// ────────────────────────────────────────────────────────────────

export const P09_DEGRADED_SCENARIOS: ReadonlyArray<{
  id: number;
  scenario: string;
  degradedReason: string;
  userVisibleState: string;
  nextAction: string;
}> = [
  {
    id: 1,
    scenario: 'Network / save failure during submission',
    degradedReason: 'network_save_failure',
    userVisibleState: 'Partial capture preserved; submission not lost',
    nextAction: 'Allow partial capture; retry save; never silently drop',
  },
  {
    id: 2,
    scenario: 'Validation failure on submission',
    degradedReason: 'validation_failure',
    userVisibleState: 'Submission marked invalid with reason code',
    nextAction: 'Force invalid status with reason; allow operator review',
  },
  {
    id: 3,
    scenario: 'Handoff to P10 failure',
    degradedReason: 'handoff_failure',
    userVisibleState: 'Locked submission preserved; handoff pending retry',
    nextAction: 'Preserve retryable job state; surface operator-visible failure; do not lose locked submission',
  },
  {
    id: 4,
    scenario: 'Export failure',
    degradedReason: 'export_failure',
    userVisibleState: 'Export error with retry available',
    nextAction: 'Explicit error state with retry; export artifact references must be consistent with locked truth',
  },
  {
    id: 5,
    scenario: 'Duplicate submission detected',
    degradedReason: 'duplicate_detected',
    userVisibleState: 'Duplicate flagged; single truth preserved',
    nextAction: 'Merge/ignore/resolve per policy; no double-counted handoff',
  },
  {
    id: 6,
    scenario: 'Branching dead-end detected pre-publish',
    degradedReason: 'branching_dead_end',
    userVisibleState: 'Publish blocked or warning issued',
    nextAction: 'Block publish with dead-end details; or downgrade to warning + publish-with-known-limits',
  },
  {
    id: 7,
    scenario: 'Permission denied on operator action',
    degradedReason: 'permission_denied',
    userVisibleState: 'Action blocked; read-only mode',
    nextAction: 'Show which role/state blocks action; suggest escalation path',
  },
  {
    id: 8,
    scenario: 'Survey version mismatch (respondent started on old version)',
    degradedReason: 'version_mismatch',
    userVisibleState: 'Submission flagged with version drift warning',
    nextAction: 'Preserve submission with version metadata; operator decides accept/reject',
  },
  {
    id: 9,
    scenario: 'Partial submission timeout',
    degradedReason: 'partial_timeout',
    userVisibleState: 'Submission marked partial after timeout threshold',
    nextAction: 'Preserve captured data; allow operator to request completion or mark invalid',
  },
  {
    id: 10,
    scenario: 'Concurrent edit conflict on submission review',
    degradedReason: 'concurrent_edit_conflict',
    userVisibleState: 'Review action blocked; stale state detected',
    nextAction: 'Refresh and retry; do not silently overwrite concurrent review decision',
  },
] as const;

// ────────────────────────────────────────────────────────────────
// §2.3.7 — Acceptance checklist (5+ items)
// ────────────────────────────────────────────────────────────────

export const P09_ACCEPTANCE_CHECKLIST = [
  {
    id: 1,
    requirement: 'Ankiety is explicitly framed as collection lane, not insight engine (non-goal is explicit)',
    section: '§2.3',
  },
  {
    id: 2,
    requirement: 'Canonical submission statuses are defined and mapped to operator next actions',
    section: '§2.3.1',
  },
  {
    id: 3,
    requirement: 'Branching posture is explicit: what is supported vs not promised, and validation/preview expectation is stated',
    section: '§2.3.3',
  },
  {
    id: 4,
    requirement: 'Handoff payload to P10 is explicit (identity + governance + content + provenance + idempotency)',
    section: '§2.3.4',
  },
  {
    id: 5,
    requirement: 'Anti-duplicate and degraded/error posture is explicit and does not create double truth',
    section: '§2.3.5–§2.3.6',
  },
  {
    id: 6,
    requirement: 'Survey lifecycle states are defined (draft → published → collecting → review_queue → closed → archived)',
    section: '§2.3.2',
  },
  {
    id: 7,
    requirement: 'Status transitions are explicit and locked/rejected are terminal states',
    section: '§2.3.1',
  },
] as const;

// ────────────────────────────────────────────────────────────────
// Non-goals (explicit)
// ────────────────────────────────────────────────────────────────

export const P09_NON_GOALS = [
  'Full assessment orchestration',
  'Full reporting/analytics suite',
  'Insight computation, ranking, or narration',
  'Complex scripting / loops / multi-language orchestration',
  'Quotas / randomized blocks / complex scoring',
  'BI-suite parity or dashboard builder',
] as const;

/**
 * Validate a status transition is allowed by the canon.
 */
export function isValidP09StatusTransition(
  from: P09SubmissionStatus,
  to: P09SubmissionStatus
): boolean {
  return P09_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

/**
 * Build a minimal handoff payload skeleton for P10.
 * Caller must fill in content and provenance details.
 */
export function buildP09HandoffPayloadSkeleton(params: {
  surveyId: string;
  submissionId: string;
  submissionStatus: P09SubmissionStatus;
  validationSummary: string;
  surveyVersion: string;
  startedAt: string;
  submittedAt: string;
}): P09HandoffToP10Payload {
  return {
    surveyId: params.surveyId,
    submissionId: params.submissionId,
    timestamps: {
      started: params.startedAt,
      submitted: params.submittedAt,
    },
    governance: {
      submissionStatus: params.submissionStatus,
      validationSummary: params.validationSummary,
    },
    content: {
      normalizedAnswers: [],
      attachmentRefs: [],
    },
    provenance: {
      auditTrailPointers: [],
      surveyVersionAtSubmission: params.surveyVersion,
    },
    idempotencyKey: params.submissionId,
  };
}
