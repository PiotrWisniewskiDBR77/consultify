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
  /** #48A — soft depth nudge for the respondent, e.g. "This answer could be deeper: Depth". */
  depthHint?: string;
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
  /** D18-A — anonymous survey mode. When true, the manager's aiReview above is
   * already redacted server-side (score/rubric numbers only, no per-answer
   * feedback/justification text). */
  isAnonymous?: boolean;
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

export interface V8InterviewManageAssignmentPayload {
  assigneeUserId: string;
  templateId: string;
  dueAt?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string | null;
  mode: 'update' | 'restart' | 'assign_again';
  reason?: string;
}

export interface V8InterviewManageAssignmentResponse {
  action: 'updated' | 'restarted' | 'assigned_again' | string;
  assignment?: V8InterviewAssignment;
  newAssignment?: V8InterviewAssignment;
}

export interface V8InterviewCreateAssignmentPayload {
  assigneeUserId?: string;
  assigneeUserIds?: string[];
  templateId: string;
  dueAt?: string | null;
  processRef?: string;
  projectId?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  escalateTo?: string;
  notes?: string | null;
  teamLeadId?: string;
  isAnonymous?: boolean;
}

export interface V8InterviewUpdateAssignmentPayload {
  dueAt?: string | null;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  notes?: string | null;
  assigneeUserId?: string;
}

export interface V8InterviewInsight {
  id: string;
  organizationId: string;
  title: string;
  promptType: string;
  sourceSessionIds: string[];
  analysisScope?: V8InsightAnalysisScope;
  materialQuality?: V8InsightMaterialQuality | null;
  contextMode?: V8InsightContextMode;
  analysisMode?: V8InsightAnalysisMode;
  topicFocus?: string[];
  generationContext?: Record<string, unknown>;
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
  archivedAt?: string | null;
  /** Mark Complete per sekcja — sygnał dla AI, nigdy blokada pola. */
  sectionCompletions?: Record<string, boolean> | null;
  /**
   * Ręczna redakcja treści sekcji (n-Type §6.2). Klucz = render-id sekcji
   * z `INSIGHT_SECTIONS`. Leży OBOK treści AI — regeneracja jej nie kasuje.
   */
  sectionOverrides?: Record<
    string,
    { content: string; updatedAt: string; updatedBy?: string | null }
  > | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type V8InsightAnalysisMode =
  | 'general_consulting_synthesis'
  | 'focused_topic_synthesis'
  | 'contradiction_scan'
  | 'initiative_opportunity_scan'
  | 'material_quality_scan'
  | 'hypothesis_validation'
  | 'between_the_lines';

export type V8InsightContextMode =
  | 'selected_interview_material_only'
  | 'selected_material_plus_approved_org_knowledge';

export interface V8InsightAnalysisScope {
  source_session_ids: string[];
  source_scope_status: 'approved_only';
  respondent_filters: string[];
  role_filters: string[];
  department_filters: string[];
  template_filters: string[];
  date_range?: { from?: string; to?: string };
  topic_focus: string[];
  analysis_mode: V8InsightAnalysisMode;
  context_mode: V8InsightContextMode;
  consultant_note?: string | null;
  leading_question?: string | null;
}

export type V8ContextDocumentStatus =
  | 'uploaded'
  | 'processing'
  | 'ready'
  | 'ocr_required'
  | 'unreadable'
  | 'failed';

export interface V8ContextDocument {
  id: string;
  filename: string;
  mimeType: string;
  fileSize: number;
  status: V8ContextDocumentStatus;
  scope: 'project' | 'user';
  projectId?: string | null;
  ownerId: string;
  sourceUpload?: string;
  processingError?: string | null;
  chunkCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface V8InsightMaterialQuality {
  overall_material_score: number;
  answer_quality_posture: 'strong' | 'usable' | 'thin' | 'poor';
  coverage_posture:
    | 'single_perspective'
    | 'partial_coverage'
    | 'good_coverage'
    | 'strong_cross_function_coverage';
  approved_session_count: number;
  respondent_count: number;
  role_coverage: string[];
  department_coverage: string[];
  thin_answer_count: number;
  missing_voices: string[];
  evidence_gap_count: number;
  contradiction_count: number;
  limitations: string[];
  recommended_followups: string[];
}

export type V8InterviewReportWorksheetStatus = 'generated' | 'partial' | 'empty' | 'degraded';

export interface V8InterviewReportWorksheet {
  key: string;
  title: string;
  required: boolean;
  status: V8InterviewReportWorksheetStatus;
  completenessScore: number;
  warnings: string[];
  rows: Array<Record<string, unknown>>;
  markdown?: string;
}

export interface V8InterviewReportPack {
  id: string;
  insightId: string;
  title: string;
  status: 'draft' | 'in_review' | 'published';
  worksheets: V8InterviewReportWorksheet[];
  completenessScore: number;
  degraded: boolean;
  degradedReasons: string[];
}

export interface V8InterviewReportReadinessIssue {
  worksheetKey?: string;
  severity: 'blocker' | 'warning';
  message: string;
}

export interface V8InterviewReportReadiness {
  reportPackId: string;
  insightId: string;
  status: 'blocked' | 'ready_with_warnings' | 'ready_for_review';
  completenessScore: number;
  blockers: V8InterviewReportReadinessIssue[];
  warnings: V8InterviewReportReadinessIssue[];
  worksheetBreakdown: Array<{
    key: string;
    title: string;
    status: V8InterviewReportWorksheetStatus;
    completenessScore: number;
    ready: boolean;
  }>;
}

export interface V8InterviewReportReviewSubmitResult {
  reportPack: V8InterviewReportPack;
  readiness: V8InterviewReportReadiness;
  submitted: boolean;
  blocked: boolean;
  alreadyInReview: boolean;
}

export interface V8InterviewReportPublishResult {
  reportPack: V8InterviewReportPack;
  readiness: V8InterviewReportReadiness;
  published: boolean;
  blocked: boolean;
  alreadyPublished: boolean;
}

export interface V8InterviewReportExportManifest {
  reportPackId: string;
  insightId: string;
  title: string;
  status: 'published';
  exportedAt: string;
  manifestHash: string;
  completenessScore: number;
  degraded: boolean;
  degradedReasons: string[];
  readiness: V8InterviewReportReadiness;
  worksheetCount: number;
  worksheets: V8InterviewReportWorksheet[];
}

export interface V8InterviewReportMarkdownExport {
  reportPackId: string;
  insightId: string;
  title: string;
  status: 'published';
  exportedAt: string;
  format: 'markdown';
  filename: string;
  markdown: string;
  sourceManifestHash: string;
  exportHash: string;
  worksheetCount: number;
}

export interface V8InterviewReportRevision {
  id: string;
  reportPackId: string;
  insightId: string;
  version: number;
  manifestHash: string;
  createdAt: string;
}

export interface V8InterviewReportRevisionResult {
  reportPack: V8InterviewReportPack;
  revision: V8InterviewReportRevision;
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
  readback_status:
    | 'draft_interpretation'
    | 'shared_for_readback'
    | 'confirmed_by_client'
    | 'partially_confirmed'
    | 'challenged_by_client'
    | 'needs_more_evidence';
  readback_summary?: string | null;
  readback_updated_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface V8InsightSourcePackEntry {
  answerId: string;
  questionText: string;
  answerSnippet: string;
  respondentLabel?: string | null;
  respondentRole?: string | null;
  department?: string | null;
  sourceSessionId?: string | null;
  linkedThemes: string[];
  linkedIssues: string[];
  linkedOpportunities: string[];
  capturedPointers: V8InsightEvidencePointer[];
  degradedReason?: 'missing_pointer' | 'source_unavailable';
}

export interface V8InsightSourcePack {
  insightId: string;
  sourceSessionIds: string[];
  entries: V8InsightSourcePackEntry[];
  degraded: boolean;
  degradedReasons: string[];
  activePointerCount: number;
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

  createAssignment: (payload: V8InterviewCreateAssignmentPayload) =>
    v8Post<V8InterviewAssignment>('/interview/assignments', payload),

  getAssignment: (id: string) =>
    v8Get<V8InterviewAssignment>(`/interview/assignments/${encodeURIComponent(id)}`),

  updateAssignment: (id: string, payload: V8InterviewUpdateAssignmentPayload) =>
    v8Patch<V8InterviewAssignment>(
      `/interview/assignments/${encodeURIComponent(id)}`,
      payload
    ),

  revokeAssignment: (id: string) =>
    v8Delete<{ success?: boolean }>(`/interview/assignments/${encodeURIComponent(id)}`),

  archiveAssignment: (id: string) =>
    v8Post<V8InterviewAssignment>(
      `/interview/assignments/${encodeURIComponent(id)}/archive`,
      {}
    ),

  restoreAssignment: (id: string) =>
    v8Post<V8InterviewAssignment>(
      `/interview/assignments/${encodeURIComponent(id)}/restore`,
      {}
    ),

  manageAssignment: (id: string, payload: V8InterviewManageAssignmentPayload) =>
    v8Patch<V8InterviewManageAssignmentResponse>(
      `/interview/assignments/${encodeURIComponent(id)}/manage`,
      payload
    ),

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

  listInsights: (params?: {
    limit?: number;
    offset?: number;
    scope?: 'active' | 'archived' | 'all';
  }) => {
    const query: Record<string, string> = {};
    if (params?.limit !== undefined) query.limit = String(params.limit);
    if (params?.offset !== undefined) query.offset = String(params.offset);
    if (params?.scope !== undefined) query.scope = params.scope;
    return v8Get<{ insights: V8InterviewInsight[] }>(
      '/interview/insights',
      Object.keys(query).length ? query : undefined
    );
  },

  getInsight: (id: string) =>
    v8Get<{ insight: V8InterviewInsight }>(`/interview/insights/${encodeURIComponent(id)}`),

  getInsightReportPack: (id: string) =>
    v8Get<{ reportPack: V8InterviewReportPack }>(
      `/interview/insights/${encodeURIComponent(id)}/report-pack`
    ),

  getInsightReportReadiness: (id: string) =>
    v8Get<{ readiness: V8InterviewReportReadiness }>(
      `/interview/insights/${encodeURIComponent(id)}/report-pack/readiness`
    ),

  submitInsightReportForReview: (id: string) =>
    v8Post<{ result: V8InterviewReportReviewSubmitResult }>(
      `/interview/insights/${encodeURIComponent(id)}/report-pack/submit-review`,
      {}
    ),

  publishInsightReportPack: (id: string) =>
    v8Post<{ result: V8InterviewReportPublishResult }>(
      `/interview/insights/${encodeURIComponent(id)}/report-pack/publish`,
      {}
    ),

  getInsightReportExportManifest: (id: string) =>
    v8Get<{ exportManifest: V8InterviewReportExportManifest }>(
      `/interview/insights/${encodeURIComponent(id)}/report-pack/export-manifest`
    ),

  getInsightReportMarkdownExport: (id: string) =>
    v8Get<{ markdownExport: V8InterviewReportMarkdownExport }>(
      `/interview/insights/${encodeURIComponent(id)}/report-pack/export-markdown`
    ),

  createInsightReportRevision: (id: string) =>
    v8Post<{ result: V8InterviewReportRevisionResult }>(
      `/interview/insights/${encodeURIComponent(id)}/report-pack/revisions`,
      {}
    ),

  updateInsightReportWorksheet: (
    id: string,
    worksheetKey: string,
    payload: {
      status?: V8InterviewReportWorksheetStatus;
      completenessScore?: number;
      warnings?: string[];
      rows?: Array<Record<string, unknown>>;
      markdown?: string | null;
    }
  ) =>
    v8Patch<{ reportPack: V8InterviewReportPack }>(
      `/interview/insights/${encodeURIComponent(id)}/report-pack/worksheets/${encodeURIComponent(
        worksheetKey
      )}`,
      payload
    ),

  createInsight: (payload: {
    title?: string;
    sessionIds?: string[];
    sessionId?: string;
    promptType?: string;
    filters?: Record<string, unknown>;
    analysisScope?: Partial<V8InsightAnalysisScope>;
    analysisMode?: V8InsightAnalysisMode;
    contextMode?: V8InsightContextMode;
    topicFocus?: string[];
    consultantNote?: string;
    leadingQuestion?: string;
    customPrompt?: string;
    selectedContextDocumentIds?: string[];
  }) => v8Post<{ insight: V8InterviewInsight }>('/interview/insights', payload),

  // #28e — Server-backed insight duplicate/similarity check (mirrors
  // POST /initiatives/similarity-check). Informational only; never blocks.
  checkInsightSimilarity: (payload: { title: string; summary?: string; themes?: string[] }) =>
    v8Post<{
      verdict: 'duplicate' | 'similar' | 'related' | 'new';
      topScore: number;
      matches: Array<{
        id: string;
        title: string;
        score: number;
        verdict: 'duplicate' | 'similar' | 'related' | 'new';
      }>;
      method: 'embeddings' | 'token-overlap';
      comparedCount: number;
      truncated: boolean;
    }>('/interview/insights/similarity-check', payload),

  listContextDocuments: (params?: { scope?: 'project' | 'user' | 'all'; projectId?: string }) =>
    v8Get<{ documents: V8ContextDocument[] }>('/interview/context-documents', params),

  uploadContextDocument: (payload: {
    file: File;
    scope?: 'project' | 'user';
    projectId?: string;
  }) => {
    const form = new FormData();
    form.append('file', payload.file);
    form.append('scope', payload.scope || 'user');
    if (payload.projectId) form.append('projectId', payload.projectId);
    return v8Post<{ document: V8ContextDocument }>('/interview/context-documents/upload', form);
  },

  regenerateInsight: (id: string) =>
    v8Post<{ insight: V8InterviewInsight }>(
      `/interview/insights/${encodeURIComponent(id)}/regenerate`,
      {}
    ),

  /**
   * Fork an insight into a new, independent copy (Phase A4).
   * Backend returns `{ data: { insight: <newInsight with new id> } }`; the
   * v8 client unwraps `.data`, so we resolve to the new insight object.
   */
  forkInsight: (id: string) =>
    v8Post<{ insight: V8InterviewInsight }>(
      `/interview/insights/${encodeURIComponent(id)}/fork`,
      {}
    ).then((res) => res.insight),

  updateInsight: (
    id: string,
    payload: {
      title?: string;
      status?: string;
      exportedToTools?: boolean;
      exportedToAssessment?: boolean;
      archived?: boolean;
      /** Mark Complete signal — AI only. { sectionId: boolean, ... } */
      sectionCompletions?: Record<string, boolean>;
      /**
       * Ręczna redakcja treści sekcji (standard n-Type §6.2; decyzja właściciela
       * 2026-07-23). Mapa CZĘŚCIOWA — serwer scala z tym, co już zapisane:
       *  · `{ themes: 'tekst' }` → ustawia/aktualizuje sekcję `themes`,
       *  · `{ themes: null }`    → usuwa nadpisanie (sekcja wraca do treści AI),
       *  · klucz nieobecny       → NIETKNIĘTY (dwie osoby mogą redagować różne
       *                            sekcje bez kasowania sobie zmian).
       * `updatedAt`/`updatedBy` wyprowadza SERWER — klient ich nie wysyła.
       */
      sectionOverrides?: Record<string, string | null>;
    }
  ) => v8Patch<{ success: boolean }>(`/interview/insights/${encodeURIComponent(id)}`, payload),

  exportInsight: (id: string, payload: { target: 'tools' | 'assessment'; sectionIds?: string[] }) =>
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

  getSourcePack: (insightId: string) =>
    v8Get<{ sourcePack: V8InsightSourcePack; insightId: string }>(
      `/interview/insights/${encodeURIComponent(insightId)}/source-pack`
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

  updateFindingReadback: (
    insightId: string,
    findingId: string,
    payload: {
      readback_status:
        | 'draft_interpretation'
        | 'shared_for_readback'
        | 'confirmed_by_client'
        | 'partially_confirmed'
        | 'challenged_by_client'
        | 'needs_more_evidence';
      readback_summary?: string | null;
    }
  ) =>
    v8Patch<{ finding: V8InsightFinding; insightId: string; findingId: string }>(
      `/interview/insights/${encodeURIComponent(insightId)}/findings/${encodeURIComponent(findingId)}/readback`,
      payload
    ),

  handoffFinding: (
    insightId: string,
    findingId: string,
    // D5 — when no target_initiative_id is given the backend now CREATES a
    // real canonical entity (initiative | decision | task) from the finding
    // instead of an orphan placeholder. target_type selects which; project_id
    // optionally scopes it.
    payload?: {
      target_initiative_id?: string;
      target_type?: 'initiative' | 'decision' | 'task';
      project_id?: string;
    }
  ) =>
    v8Post<{
      handoff_payload: Record<string, unknown>;
      initiative: {
        id: string;
        type: 'linked' | 'created';
        targetType?: 'initiative' | 'decision' | 'task';
        url?: string;
      };
      findingId: string;
      insightId: string;
      // #59 — informational duplicate/similar warning against the live
      // initiative portfolio; null when nothing similar was found.
      duplicateWarning?: {
        verdict: 'duplicate' | 'similar';
        topMatch: { id: string; title: string; status: string; score: number } | null;
      } | null;
    }>(
      `/interview/insights/${encodeURIComponent(insightId)}/findings/${encodeURIComponent(findingId)}/handoff`,
      payload ?? {}
    ),
};
