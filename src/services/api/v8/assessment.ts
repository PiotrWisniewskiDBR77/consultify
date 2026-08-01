import { v8Delete, v8Get, v8Post, v8Put } from './client';

export interface V8AssessmentListItem {
  id: string;
  name: string;
  status: string;
  backendStatus?: string;
  assessment_type?: string;
  project_id?: string | null;
  updated_at?: string;
  created_at?: string;
  answers?: Record<string, unknown>;
  scoreSummary?: Record<string, unknown>;
  assessmentDefinitionId?: string | null;
  assessmentDefinitionVersion?: string | null;
}

export interface V8AssessmentDetail extends V8AssessmentListItem {
  contextSnapshot?: Record<string, unknown>;
  navigation?: Record<string, unknown> | null;
}

export interface V8AssessmentUserRole {
  role: string;
  permissions: {
    canView: boolean;
    canEdit: boolean;
    canManage: boolean;
    canManageTeam: boolean;
    canChangeStatus: boolean;
    canApprove: boolean;
    canDelete: boolean;
    canGenerateReport: boolean;
    canGenerateInitiatives: boolean;
    canRequestAccess: boolean;
  };
  assignedAreas: string[] | null;
  isOwner: boolean;
}

export interface V8AssessmentUserState {
  assessmentId: string;
  userId: string;
  navigation: Record<string, unknown> | null;
  updatedAt: string | null;
}

export interface V8AssessmentAssignment {
  id: string;
  assessment_id: string;
  area_id: string;
  assigned_user_id: string;
  assigned_by: string;
  assigned_at: string;
  due_at?: string | null;
  status: string;
}

export interface V8AssessmentListResponse {
  items: V8AssessmentListItem[];
  assessments: V8AssessmentListItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface V8AssessmentCreatePayload {
  assessmentType: string;
  name: string;
  projectId?: string | null;
  /**
   * ASM-001A: optional binding to a published `assessment_definitions` row
   * (Library tab). Backend-optional/backward-compatible — omitting both
   * fields keeps today's behavior (no definition binding). When provided,
   * the server validates the definition is `published` before accepting the
   * create, returning 400/422 `DEFINITION_NOT_PUBLISHED` /
   * `DEFINITION_NOT_FOUND` otherwise (see AssessmentLibraryTab).
   */
  definitionId?: string;
  definitionVersion?: string;
}

export interface V8AssessmentUpdatePayload {
  name?: string;
  answers?: Record<string, unknown>;
  completionPercent?: number;
  confidenceAvg?: number;
  contextSnapshot?: Record<string, unknown>;
  scoreSummary?: Record<string, unknown>;
  currentSectionId?: string | null;
  navigation?: Record<string, unknown>;
}

export interface V8AssessmentUserStatePayload {
  navigation?: {
    axisId: number;
    areaId: string;
    level: number;
  };
}

export interface V8AssessmentAssignmentPayload {
  areaId: string;
  assignedUserId: string;
  dueAt?: string | null;
  status?: string;
}

export type V8AssessmentRunState =
  | 'draft'
  | 'running'
  | 'awaiting_evidence'
  | 'score_proposed'
  | 'score_reviewed'
  | 'interpretation_proposed'
  | 'interpretation_reviewed'
  | 'completed'
  | 'failed';

export interface V8AssessmentWorkbench {
  contractVersion: string;
  assessmentDefinitionRef: {
    definitionId: string;
    methodologyId: string;
    version: string;
    status: 'published';
    readOnly: true;
    publishedAt?: string | null;
  };
  assessmentRunId: string;
  orgId: string;
  runState: V8AssessmentRunState;
  startedBy: string;
  startedAt: string;
  evidencePointers: Array<{
    id: string;
    kind: string;
    ref: string;
    label?: string;
    availability?: 'ok' | 'unavailable';
  }>;
  requiredEvidenceKinds?: string[];
  scoreProposal: null | {
    id: string;
    status: 'proposal';
    scoreValues: Record<string, number>;
    scoringRationale: string;
    evidencePointerIds: string[];
    assumptions: string[];
    confidence: number;
    proposedAt: string;
    proposedBy: string;
  };
  scoreReview: null | {
    status: 'pending' | 'accepted' | 'rejected' | 'overridden';
    decidedAt?: string;
    decidedBy?: string;
    reason?: string;
    overrideScoreValues?: Record<string, number>;
  };
  interpretationProposal: null | {
    id: string;
    status: 'proposal';
    summary: string;
    keyFindings: string[];
    limits: string;
    nextActions: string[];
    linksToScoreProposalId: string;
    proposedAt: string;
    proposedBy: string;
  };
  interpretationReview: null | {
    status: 'pending' | 'accepted' | 'rejected' | 'overridden';
    decidedAt?: string;
    decidedBy?: string;
    reason?: string;
    overrideSummary?: string;
  };
  promotionTraces: Array<{
    id: string;
    fromAssessmentRunId: string;
    targetKind: 'outputs_artifact' | 'interview_insight';
    targetRef: string;
    createdAt: string;
    actorId: string;
    payloadSummary?: string;
  }>;
  degraded?: {
    code: string;
    message: string;
    missingEvidenceKinds?: string[];
    acceptedForCompletion?: boolean;
  };
  pendingPromotion?: {
    targetKind: 'outputs_artifact' | 'interview_insight';
    targetRef: string;
    payload: Record<string, unknown>;
    failedAt: string;
    error: string;
  } | null;
  completedAt?: string;
}

export interface V8AssessmentDefinitionRecord {
  id: string;
  methodologyId: string;
  version: string;
  title: string;
  status: 'draft' | 'published' | 'deprecated';
  isReadOnly: boolean;
  definition: Record<string, unknown>;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  publishedAt?: string | null;
}

// --- ASM-005/006/007: evidence/scoring, quality review, immutable output ---

export interface V8AssessmentEvidence {
  id: string;
  organizationId: string;
  assessmentId: string;
  axisId: string;
  areaId: string;
  evidenceType: 'note' | 'link' | 'document' | 'reference';
  title: string;
  description: string | null;
  url: string | null;
  createdBy: string;
  createdAt: string;
}

export interface V8AssessmentEvidencePayload {
  axisId: string;
  areaId: string;
  evidenceType: 'note' | 'link' | 'document' | 'reference';
  title: string;
  description?: string | null;
  url?: string | null;
}

export interface V8AssessmentAxisScoring {
  axisId: string;
  axisName: string;
  areaCount: number;
  answeredAreas: number;
  avgAchievedLevel: number;
  avgTargetLevel: number;
  gap: number;
  evidenceCount: number;
  hasEvidence: boolean;
}

export interface V8AssessmentDerivedScoring {
  completionPercent: number;
  overallAvgAchievedLevel: number;
  evidenceCoverage: number;
  axesMissingEvidence: string[];
  axes: V8AssessmentAxisScoring[];
}

export type V8AssessmentReviewAction = 'accept' | 'return';

export interface V8AssessmentReviewPayload {
  action: V8AssessmentReviewAction;
  rationale: string;
}

export interface V8AssessmentReviewRecord {
  id: string;
  organizationId: string;
  assessmentId: string;
  action: V8AssessmentReviewAction;
  actorId: string;
  actorRole: string | null;
  rationale: string;
  previousStatus: string | null;
  newStatus: string | null;
  createdAt: string;
}

export interface V8AssessmentAcceptedSnapshot {
  id: string;
  organizationId: string;
  assessmentId: string;
  reviewId: string;
  snapshot: unknown;
  provenance: unknown;
  acceptedBy: string;
  acceptedAt: string;
  isCurrent: boolean;
}

export interface V8AssessmentAcceptedReport {
  assessmentId: string;
  snapshot: unknown;
  provenance: unknown;
  acceptedBy: string;
  acceptedAt: string;
  isCurrent: boolean;
}

export const V8AssessmentApi = {
  listAssessments(params?: {
    projectId?: string;
    status?: string;
    assessmentType?: string;
    limit?: number;
    offset?: number;
  }) {
    const query: Record<string, string> = {};
    if (params?.projectId) query.projectId = params.projectId;
    if (params?.status) query.status = params.status;
    if (params?.assessmentType) query.assessmentType = params.assessmentType;
    if (params?.limit !== undefined) query.limit = String(params.limit);
    if (params?.offset !== undefined) query.offset = String(params.offset);
    return v8Get<V8AssessmentListResponse>('/assessment', query);
  },

  getAssessment(assessmentId: string) {
    return v8Get<{ assessment: V8AssessmentDetail }>(`/assessment/${assessmentId}`);
  },

  createAssessment(payload: V8AssessmentCreatePayload) {
    return v8Post<{ id: string; assessment: V8AssessmentDetail }>('/assessment', payload);
  },

  updateAssessment(assessmentId: string, payload: V8AssessmentUpdatePayload) {
    // ASM-001A: `completionPercent` is optional/forward-compatible — the DRD
    // lane will start receiving a server-derived value here (instead of the
    // legacy `{id, updatedAt}`-only response) once the backend recomputes it
    // instead of trusting the client; other frameworks are unaffected.
    return v8Put<{ id: string; updatedAt: string; completionPercent?: number }>(
      `/assessment/${assessmentId}`,
      payload
    );
  },

  /**
   * ASM-001A: list every definition version (draft/published/deprecated) for
   * a methodology. The Library tab filters to `status === 'published'` and
   * picks the newest version client-side — there is deliberately no
   * server-side "published only" filter endpoint yet (MVP scope decision,
   * see AssessmentLibraryTab).
   */
  getDefinitions(methodologyId: string) {
    return v8Get<{ methodologyId: string; versions: V8AssessmentDefinitionRecord[] }>(
      `/assessment/definitions/${encodeURIComponent(methodologyId)}`
    );
  },

  getWorkbench(assessmentId: string) {
    return v8Get<{ workbench: V8AssessmentWorkbench; whatNext: string[] }>(
      `/assessment/${assessmentId}/workbench`
    );
  },

  getWorkbenchDefinition(assessmentId: string) {
    return v8Get<{
      definitionRef: V8AssessmentWorkbench['assessmentDefinitionRef'];
      definition: V8AssessmentDefinitionRecord | null;
    }>(`/assessment/${assessmentId}/workbench/definition`);
  },

  applyWorkbenchPreset(assessmentId: string, preset: string) {
    return v8Post<{ workbench: V8AssessmentWorkbench; whatNext: string[] }>(
      `/assessment/${assessmentId}/workbench/methodology-preset`,
      { preset }
    );
  },

  transitionWorkbench(
    assessmentId: string,
    payload: { toState: 'running' | 'awaiting_evidence' | 'completed' | 'failed'; reason?: string }
  ) {
    return v8Post<{ workbench: V8AssessmentWorkbench }>(
      `/assessment/${assessmentId}/workbench/transition`,
      payload
    );
  },

  addWorkbenchEvidence(
    assessmentId: string,
    pointers: Array<{
      kind: string;
      ref: string;
      label?: string;
      availability?: 'ok' | 'unavailable';
    }>
  ) {
    return v8Post<{ workbench: V8AssessmentWorkbench }>(
      `/assessment/${assessmentId}/workbench/evidence`,
      {
        pointers,
      }
    );
  },

  setRequiredEvidenceKinds(assessmentId: string, kinds: string[]) {
    return v8Post<{ workbench: V8AssessmentWorkbench }>(
      `/assessment/${assessmentId}/workbench/required-evidence`,
      {
        kinds,
      }
    );
  },

  proposeWorkbenchScore(
    assessmentId: string,
    payload: {
      scoreValues: Record<string, number>;
      scoringRationale: string;
      evidencePointerIds: string[];
      assumptions?: string[];
      confidence?: number;
    }
  ) {
    return v8Post<{ workbench: V8AssessmentWorkbench }>(
      `/assessment/${assessmentId}/workbench/score-proposal`,
      payload
    );
  },

  reviewWorkbenchScore(
    assessmentId: string,
    payload: {
      action: 'accept' | 'reject' | 'override';
      reason?: string;
      overrideScoreValues?: Record<string, number>;
    }
  ) {
    return v8Post<{ workbench: V8AssessmentWorkbench }>(
      `/assessment/${assessmentId}/workbench/score-review`,
      payload
    );
  },

  proposeWorkbenchInterpretation(
    assessmentId: string,
    payload: { summary: string; keyFindings: string[]; limits: string; nextActions: string[] }
  ) {
    return v8Post<{ workbench: V8AssessmentWorkbench }>(
      `/assessment/${assessmentId}/workbench/interpretation-proposal`,
      payload
    );
  },

  reviewWorkbenchInterpretation(
    assessmentId: string,
    payload: { action: 'accept' | 'reject' | 'override'; reason?: string; overrideSummary?: string }
  ) {
    return v8Post<{ workbench: V8AssessmentWorkbench }>(
      `/assessment/${assessmentId}/workbench/interpretation-review`,
      payload
    );
  },

  getWorkbenchPromotionPayload(assessmentId: string) {
    return v8Get<{
      valid: boolean;
      validationErrors: string[];
      payload: Record<string, unknown>;
      supportedHandoffs?: Array<{
        targetKind: 'outputs_artifact' | 'interview_insight';
        targetRefOwner: string;
        bounded: boolean;
        purpose: string;
      }>;
      downstreamContract?: {
        initiatives?: Record<string, unknown>;
        execution?: Record<string, unknown>;
        kpi?: Record<string, unknown>;
      };
    }>(`/assessment/${assessmentId}/workbench/promotion-payload`);
  },

  promoteWorkbench(
    assessmentId: string,
    payload: {
      targetKind: 'outputs_artifact' | 'interview_insight';
      targetRef?: string;
      payloadSummary?: string;
    }
  ) {
    return v8Post<{ workbench: V8AssessmentWorkbench }>(
      `/assessment/${assessmentId}/workbench/promotion`,
      payload
    );
  },

  getMyRole(assessmentId: string) {
    return v8Get<V8AssessmentUserRole>(`/assessment/${assessmentId}/my-role`);
  },

  getUserState(assessmentId: string) {
    return v8Get<V8AssessmentUserState>(`/assessment/${assessmentId}/user-state`);
  },

  updateUserState(assessmentId: string, payload: V8AssessmentUserStatePayload) {
    return v8Put<{ assessmentId: string; userId: string; updatedAt: string }>(
      `/assessment/${assessmentId}/user-state`,
      payload
    );
  },

  listAssignments(assessmentId: string) {
    return v8Get<{ assessmentId: string; assignments: V8AssessmentAssignment[] }>(
      `/assessment/${assessmentId}/assignments`
    );
  },

  upsertAssignment(assessmentId: string, payload: V8AssessmentAssignmentPayload) {
    return v8Put<{
      assessmentId: string;
      areaId: string;
      assignedUserId: string;
      dueAt?: string | null;
      status: string;
      updatedAt: string;
    }>(`/assessment/${assessmentId}/assignments`, payload);
  },

  deleteAssignment(assessmentId: string, assignmentId: string) {
    return v8Delete<{ assessmentId: string; assignmentId: string; deleted: boolean }>(
      `/assessment/${assessmentId}/assignments/${assignmentId}`
    );
  },

  // --- ASM-005/006/007: evidence/scoring, quality review, immutable output ---

  listEvidence(assessmentId: string) {
    return v8Get<{ evidence: V8AssessmentEvidence[]; scoring: V8AssessmentDerivedScoring | null }>(
      `/assessment/${assessmentId}/evidence`
    );
  },

  addEvidence(assessmentId: string, payload: V8AssessmentEvidencePayload) {
    return v8Post<{ evidence: V8AssessmentEvidence }>(
      `/assessment/${assessmentId}/evidence`,
      payload
    );
  },

  submitReview(assessmentId: string, payload: V8AssessmentReviewPayload) {
    return v8Post<{ review: V8AssessmentReviewRecord; snapshot?: V8AssessmentAcceptedSnapshot }>(
      `/assessment/${assessmentId}/review`,
      payload
    );
  },

  listReviewHistory(assessmentId: string) {
    return v8Get<{ reviews: V8AssessmentReviewRecord[] }>(
      `/assessment/${assessmentId}/review-history`
    );
  },

  getAcceptedReport(assessmentId: string) {
    return v8Get<V8AssessmentAcceptedReport>(`/assessment/${assessmentId}/report`);
  },
};
