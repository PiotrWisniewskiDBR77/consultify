import { v8Delete, v8Get, v8Patch, v8Post } from './client';

export interface V8InterviewSession {
  id: string;
  organizationId: string;
  projectId?: string;
  name: string;
  ownerId: string;
  status: string;
  templateId?: string;
  templateVersion?: string;
  assignmentId?: string;
  progress?: Record<string, unknown>;
  totalQuestions: number;
  answeredQuestions: number;
  summaryFacts?: string[];
  summaryGaps?: string[];
  summaryConstraints?: string[];
  summaryPainPoints?: string[];
  runtimeModeDefault?: 'task_list' | 'single_question';
  startedAt: string;
  completedAt?: string;
  lastActivityAt?: string;
  templateName?: string;
  templateCategory?: string;
  respondentId?: string;
  respondentName?: string;
  assignmentStatus?: string;
  sessionRuntimeStatus?: string;
  assignmentPriority?: string;
  assignmentCreatedBy?: string;
  assigneeId?: string;
  assigneeName?: string;
  assigneeEmail?: string;
  dueAt?: string;
  submittedAt?: string;
  sentBackAt?: string;
  sentBackReason?: string;
}

export type V8InterviewAiFixType =
  | 'clarify'
  | 'add_evidence'
  | 'expand_answer'
  | 'make_specific'
  | 'complete_required_fields'
  | 'correct_meaning';

export interface V8InterviewWeakAnswerItem {
  key: string;
  label: string;
  questionId?: string;
  sectionId?: string;
  score: number;
  verdict: 'sufficient' | 'needs_improvement' | 'insufficient' | 'unanswered';
  feedback: string;
  fixType: V8InterviewAiFixType;
  isRequired: boolean;
}

export interface V8InterviewReviewDecisionMemoryEntry {
  id: string;
  action: 'approve' | 'send_back';
  actorId: string;
  actorRole?: string;
  createdAt: string;
  aiOverallVerdict: 'ready_for_approval' | 'needs_improvement' | 'insufficient' | 'empty';
  aiOverallScore: number | null;
  aiWeakAnswerCount: number;
  alignment:
    | 'aligned'
    | 'manager_stricter_than_ai'
    | 'manager_overrode_ai_warning'
    | 'no_ai_signal';
  reason?: string;
  missingItems?: Array<{ key: string; label: string; questionId?: string; sectionId?: string }>;
}

export interface V8InterviewAssignment {
  id: string;
  organizationId: string;
  projectId?: string;
  assigneeUserId: string;
  templateId: string;
  templateVersion: number;
  status: 'assigned' | 'in_progress' | 'submitted' | 'sent_back' | 'approved' | 'completed';
  sessionId?: string;
  dueAt?: string;
  startedAt?: string;
  submittedAt?: string;
  sentBackAt?: string;
  sentBackReason?: string;
  aiReview?: V8InterviewSessionEvaluation | null;
  aiReviewedAt?: string;
  reviewDecisionMemory?: V8InterviewReviewDecisionMemoryEntry[];
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isTeamAssignment: boolean;
  notes?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  template?: {
    id: string;
    name: string;
    description?: string;
    category?: string;
  };
  assignee?: {
    id: string;
    name: string;
    email: string;
  };
  session?: {
    id: string;
    status: string;
    answeredQuestions: number;
    totalQuestions: number;
    completenessPercent: number;
  };
}

export interface V8InterviewInsight {
  id: string;
  organizationId: string;
  title: string;
  promptType: string;
  sourceSessionIds: string[];
  content?: string;
  executiveSummary?: string;
  themes?: Array<{
    title: string;
    description: string;
    evidence_refs: string[];
    strength: string;
    crossSessionPattern?: boolean;
    perspective_labels?: string[];
    divergence_note?: string;
  }>;
  issues?: Array<{
    title: string;
    description: string;
    severity: string;
    evidence_refs: string[];
    crossSessionPattern?: boolean;
    perspective_labels?: string[];
    divergence_note?: string;
  }>;
  opportunities?: Array<{
    title: string;
    description: string;
    impact: string;
    evidence_refs: string[];
    crossSessionPattern?: boolean;
    perspective_labels?: string[];
    divergence_note?: string;
  }>;
  status: string;
  reviewStatus?: 'draft' | 'in_review' | 'published';
  publishedAt?: string;
  reviewedBy?: string;
  exportedToTools?: boolean;
  exportedToAssessment?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface V8InsightEvidencePointer {
  pointerId: string;
  type: string;
  sourceRef: string;
  capturedAt: string;
  sourceFingerprint: string;
  capturedExcerpt?: string | null;
  removalReason?: string | null;
  isTombstone: boolean;
}

export interface V8InsightFinding {
  id: string;
  insightId: string;
  organizationId: string;
  finding_statement: string;
  confidence_level: 'high' | 'medium' | 'low' | 'insufficient' | 'contradicted';
  limits: string;
  next_action: string;
  evidence_pointers: V8InsightEvidencePointer[];
  source_section_type: string;
  source_section_index?: number | null;
  source_key?: string | null;
  review_status?: 'draft' | 'in_review' | 'published';
  created_at: string;
  updated_at: string;
}

export interface V8InsightAnalysisLens {
  id: string;
  kind: 'session' | 'stakeholder';
  label: string;
  sessionIds: string[];
  respondentName?: string;
  role?: string;
  department?: string;
  supportedTopicIds: string[];
  supportedFindingIds: string[];
  localSummary: string;
}

export interface V8InsightAnalysisTopic {
  id: string;
  sourceKey: string;
  kind: 'theme' | 'issue' | 'opportunity';
  label: string;
  description: string;
  findingId?: string;
  confidenceLevel: 'high' | 'medium' | 'low' | 'insufficient' | 'contradicted';
  reviewStatus?: 'draft' | 'in_review' | 'published';
  limits: string;
  nextAction: string;
  evidenceCount: number;
  supportingSessionIds: string[];
  supportingStakeholderLabels: string[];
  crossSessionPattern: boolean;
  isContradicted: boolean;
  perspectiveLabels: string[];
  divergenceNote?: string;
}

export interface V8InsightAnalysisMatrixCell {
  topicId: string;
  lensId: string;
  state: 'supported' | 'contradicted' | 'local_only' | 'not_observed';
  supportingSessionIds: string[];
  evidenceCount: number;
}

export interface V8InsightAnalysis {
  insightId: string;
  insightTitle: string;
  scope: {
    sourceSessionIds: string[];
    sourceSessionCount: number;
    distinctStakeholderCount: number;
    stakeholderLabels: string[];
    departments: string[];
    roles: string[];
    posture: 'single_perspective' | 'cross_perspective' | 'organization_synthesis';
  };
  people: {
    sessionLenses: V8InsightAnalysisLens[];
    stakeholderLenses: V8InsightAnalysisLens[];
  };
  topics: V8InsightAnalysisTopic[];
  matrix: {
    rows: Array<{
      id: string;
      label: string;
      kind: 'theme' | 'issue' | 'opportunity';
      confidenceLevel: 'high' | 'medium' | 'low' | 'insufficient' | 'contradicted';
    }>;
    sessionColumns: Array<{ id: string; label: string }>;
    stakeholderColumns: Array<{ id: string; label: string }>;
    sessionCells: V8InsightAnalysisMatrixCell[];
    stakeholderCells: V8InsightAnalysisMatrixCell[];
  };
  synthesis: {
    consensusTopicIds: string[];
    localOnlyTopicIds: string[];
    contradictedTopicIds: string[];
    coverageGaps: string[];
  };
}

export interface V8InsightCandidate {
  id: string;
  insightId: string;
  organizationId: string;
  source_section_type: 'theme' | 'issue' | 'opportunity' | 'manual';
  source_section_index?: number | null;
  source_key?: string | null;
  candidate_statement: string;
  rationale: string;
  confidence_hint: 'high' | 'medium' | 'low' | 'insufficient' | 'contradicted';
  triage_status:
    | 'candidate'
    | 'needs_split'
    | 'needs_evidence'
    | 'ready_for_review'
    | 'rejected'
    | 'promoted';
  followup_type:
    | 'investigate'
    | 'validate'
    | 'split'
    | 'collect_evidence'
    | 'publish'
    | 'reinterview';
  followup_recommendation: string;
  linked_finding_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface V8InsightComment {
  id: string;
  authorName?: string;
  content: string;
  createdAt: string;
  priority: string;
}

export interface V8InsightActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
  userName?: string;
}

export interface V8InterviewAnswerEvaluation {
  questionId: string;
  score: number;
  verdict: 'sufficient' | 'needs_improvement' | 'insufficient' | 'unanswered';
  feedback: string;
  fixType?: V8InterviewAiFixType;
}

export interface V8InterviewSessionEvaluation {
  overallScore: number;
  overallVerdict: 'ready_for_approval' | 'needs_improvement' | 'insufficient' | 'empty';
  questionEvaluations: V8InterviewAnswerEvaluation[];
  recommendations: string[];
  weakAnswerMap: V8InterviewWeakAnswerItem[];
}

export const V8InterviewApi = {
  getSessions: (status?: string) =>
    v8Get<{ sessions: V8InterviewSession[] }>(
      '/interview/sessions',
      status ? { status } : undefined
    ),

  getAcceptedSessions: () =>
    v8Get<{ sessions: V8InterviewSession[] }>('/interview/sessions/accepted'),

  getManagedSessions: () =>
    v8Get<{ sessions: V8InterviewSession[] }>('/interview/sessions/managed'),

  getSession: (id: string) =>
    v8Get<{ session: V8InterviewSession }>(`/interview/sessions/${encodeURIComponent(id)}`),

  getSessionSummary: (id: string) =>
    v8Get<{ facts: string[]; gaps: string[]; constraints: string[]; painPoints: string[] }>(
      `/interview/sessions/${encodeURIComponent(id)}/summary`
    ),

  evaluateSessionAnswers: (id: string, payload?: { language?: string }) =>
    v8Post<V8InterviewSessionEvaluation>(
      `/interview/sessions/${encodeURIComponent(id)}/evaluate-answers`,
      payload ?? {}
    ),

  getMyAssignments: () =>
    v8Get<{ assignments: V8InterviewAssignment[] }>('/interview/assignments/my'),

  getManagedAssignments: () =>
    v8Get<{ assignments: V8InterviewAssignment[] }>('/interview/assignments/managed'),

  getOverdueAssignments: () =>
    v8Get<{ assignments: V8InterviewAssignment[] }>('/interview/assignments/overdue'),

  startAssignment: (id: string, payload?: { projectId?: string; name?: string }) =>
    v8Post<{ assignmentId: string; session: V8InterviewSession }>(
      `/interview/assignments/${encodeURIComponent(id)}/start`,
      payload ?? {}
    ),

  submitAssignment: (id: string) =>
    v8Post<{
      assignment: V8InterviewAssignment;
      session: V8InterviewSession;
      completenessPercent: number;
      entersContext: boolean;
      aiReview?: V8InterviewSessionEvaluation | null;
    }>(`/interview/assignments/${encodeURIComponent(id)}/submit`, {}),

  remindAssignment: (id: string) =>
    v8Post(`/interview/assignments/${encodeURIComponent(id)}/remind`, {}),

  sendBackAssignment: (
    id: string,
    payload: { reason: string; missingItems?: Array<string | Record<string, unknown>> }
  ) => v8Post(`/interview/assignments/${encodeURIComponent(id)}/send-back`, payload),

  approveAssignment: (id: string) =>
    v8Post<{
      assignment: V8InterviewAssignment;
      session: V8InterviewSession;
      completenessPercent: number;
      entersContext: boolean;
      aiReview?: V8InterviewSessionEvaluation | null;
    }>(`/interview/assignments/${encodeURIComponent(id)}/approve`, {}),

  // --- Insights ---

  listInsights: (params?: { limit?: number; offset?: number }) => {
    const query: Record<string, string> = {};
    if (params?.limit !== undefined) query.limit = String(params.limit);
    if (params?.offset !== undefined) query.offset = String(params.offset);
    return v8Get<{ insights: V8InterviewInsight[] }>(
      '/interview/insights',
      Object.keys(query).length ? query : undefined
    );
  },

  getInsight: (id: string) =>
    v8Get<{ insight: V8InterviewInsight }>(`/interview/insights/${encodeURIComponent(id)}`),

  createInsight: (payload: {
    title?: string;
    sessionIds?: string[];
    sessionId?: string;
    promptType?: string;
    filters?: Record<string, unknown>;
    customPrompt?: string;
  }) => v8Post<{ insight: V8InterviewInsight }>('/interview/insights', payload),

  regenerateInsight: (id: string) =>
    v8Post<{ insight: V8InterviewInsight }>(
      `/interview/insights/${encodeURIComponent(id)}/regenerate`,
      {}
    ),

  updateInsight: (
    id: string,
    payload: {
      title?: string;
      status?: string;
      exportedToTools?: boolean;
      exportedToAssessment?: boolean;
    }
  ) => v8Patch<{ success: boolean }>(`/interview/insights/${encodeURIComponent(id)}`, payload),

  exportInsight: (id: string, payload: { target: 'tools' | 'assessment' }) =>
    v8Post<{ success: boolean; target: string; targetId: string; assessmentType?: string }>(
      `/interview/insights/${encodeURIComponent(id)}/export`,
      payload
    ),

  getInsightActivity: (id: string) =>
    v8Get<{ activity: V8InsightActivity[] }>(
      `/interview/insights/${encodeURIComponent(id)}/activity`
    ),

  getInsightComments: (id: string) =>
    v8Get<{ comments: V8InsightComment[] }>(
      `/interview/insights/${encodeURIComponent(id)}/comments`
    ),

  createInsightComment: (id: string, payload: { content: string; priority?: string }) =>
    v8Post<V8InsightComment>(`/interview/insights/${encodeURIComponent(id)}/comments`, payload),

  deleteInsightComment: (id: string, commentId: string) =>
    v8Delete<{ success: boolean }>(
      `/interview/insights/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`
    ),

  deleteInsight: (id: string) =>
    v8Delete<{ success: boolean }>(`/interview/insights/${encodeURIComponent(id)}`),

  // --- P10 Lifecycle + Findings + Handoff ---

  lifecycleTransition: (insightId: string, action: string) =>
    v8Post<{
      data: {
        insightId: string;
        previousStatus: string;
        newStatus: string;
        action: string;
        updatedAt: string;
      };
    }>(`/interview/insights/${encodeURIComponent(insightId)}/lifecycle`, { action }),

  listCandidates: (insightId: string) =>
    v8Get<{ candidates: V8InsightCandidate[]; insightId: string }>(
      `/interview/insights/${encodeURIComponent(insightId)}/candidates`
    ),

  triageCandidate: (
    insightId: string,
    candidateId: string,
    payload: {
      action:
        | 'mark_candidate'
        | 'mark_needs_split'
        | 'mark_needs_evidence'
        | 'mark_ready_for_review'
        | 'reject'
        | 'promote_to_finding';
      candidate_statement?: string;
      rationale?: string;
      followup_recommendation?: string;
      confidence_level?: 'high' | 'medium' | 'low' | 'insufficient' | 'contradicted';
      limits?: string;
      next_action?: string;
    }
  ) =>
    v8Post<{
      candidate: V8InsightCandidate;
      finding?: V8InsightFinding;
      insightId: string;
      candidateId: string;
    }>(
      `/interview/insights/${encodeURIComponent(insightId)}/candidates/${encodeURIComponent(candidateId)}/triage`,
      payload
    ),

  getAnalysis: (insightId: string) =>
    v8Get<{ analysis: V8InsightAnalysis; insightId: string }>(
      `/interview/insights/${encodeURIComponent(insightId)}/analysis`
    ),

  listFindings: (insightId: string) =>
    v8Get<{ findings: V8InsightFinding[]; insightId: string }>(
      `/interview/insights/${encodeURIComponent(insightId)}/findings`
    ),

  createFinding: (
    insightId: string,
    payload: {
      finding_statement: string;
      confidence_level: string;
      limits: string;
      next_action: string;
      evidence_pointers?: Array<{
        type: string;
        sourceRef: string;
        sourceFingerprint: string;
        capturedExcerpt?: string | null;
      }>;
    }
  ) =>
    v8Post<{ finding: V8InsightFinding }>(
      `/interview/insights/${encodeURIComponent(insightId)}/findings`,
      payload
    ),

  updateFinding: (insightId: string, findingId: string, payload: Record<string, unknown>) =>
    v8Patch<{ finding: V8InsightFinding; pointer_warnings?: string[] }>(
      `/interview/insights/${encodeURIComponent(insightId)}/findings/${encodeURIComponent(findingId)}`,
      payload
    ),

  handoffFinding: (
    insightId: string,
    findingId: string,
    payload?: { target_initiative_id?: string }
  ) =>
    v8Post<{
      handoff_payload: Record<string, unknown>;
      initiative: { id: string; type: 'linked' | 'handoff_request' };
      findingId: string;
      insightId: string;
    }>(
      `/interview/insights/${encodeURIComponent(insightId)}/findings/${encodeURIComponent(findingId)}/handoff`,
      payload ?? {}
    ),
};
