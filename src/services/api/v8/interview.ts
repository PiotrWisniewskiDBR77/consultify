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
  themes?: Array<{ title: string; description: string; evidence_refs: string[]; strength: string }>;
  issues?: Array<{ title: string; description: string; severity: string; evidence_refs: string[] }>;
  opportunities?: Array<{ title: string; description: string; impact: string; evidence_refs: string[] }>;
  status: string;
  exportedToTools?: boolean;
  exportedToAssessment?: boolean;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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

export const V8InterviewApi = {
  getSessions: (status?: string) =>
    v8Get<{ sessions: V8InterviewSession[] }>(
      '/interview/sessions',
      status ? { status } : undefined
    ),

  getAcceptedSessions: () =>
    v8Get<{ sessions: V8InterviewSession[] }>('/interview/sessions/accepted'),

  getSession: (id: string) =>
    v8Get<{ session: V8InterviewSession }>(`/interview/sessions/${encodeURIComponent(id)}`),

  getSessionSummary: (id: string) =>
    v8Get<{ facts: string[]; gaps: string[]; constraints: string[]; painPoints: string[] }>(
      `/interview/sessions/${encodeURIComponent(id)}/summary`
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

  aiPreReviewAssignment: (id: string) =>
    v8Post<{
      review: {
        overallScore: number;
        readyToSubmit: boolean;
        summary: string;
        issues: Array<{ questionIndex: number; severity: 'high' | 'medium' | 'low'; suggestion: string }>;
        strengths: string[];
      } | null;
      stats: { total: number; answered: number; unansweredRequired: number };
      fallback?: boolean;
    }>(`/interview/assignments/${encodeURIComponent(id)}/ai-pre-review`, {}),

  submitAssignment: (id: string) =>
    v8Post<{
      assignment: V8InterviewAssignment;
      session: V8InterviewSession;
      completenessPercent: number;
      entersContext: boolean;
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
    }>(`/interview/assignments/${encodeURIComponent(id)}/approve`, {}),

  // --- Insights ---

  listInsights: (params?: { limit?: number; offset?: number }) => {
    const query: Record<string, string> = {};
    if (params?.limit !== undefined) query.limit = String(params.limit);
    if (params?.offset !== undefined) query.offset = String(params.offset);
    return v8Get<{ insights: V8InterviewInsight[] }>('/interview/insights', Object.keys(query).length ? query : undefined);
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
    v8Post<{ insight: V8InterviewInsight }>(`/interview/insights/${encodeURIComponent(id)}/regenerate`, {}),

  updateInsight: (id: string, payload: { title?: string; status?: string; exportedToTools?: boolean; exportedToAssessment?: boolean }) =>
    v8Patch<{ success: boolean }>(`/interview/insights/${encodeURIComponent(id)}`, payload),

  exportInsight: (id: string, payload: { target: 'tools' | 'assessment' }) =>
    v8Post<{ success: boolean; target: string; targetId: string; assessmentType?: string }>(
      `/interview/insights/${encodeURIComponent(id)}/export`, payload
    ),

  getInsightActivity: (id: string) =>
    v8Get<{ activity: V8InsightActivity[] }>(`/interview/insights/${encodeURIComponent(id)}/activity`),

  getInsightComments: (id: string) =>
    v8Get<{ comments: V8InsightComment[] }>(`/interview/insights/${encodeURIComponent(id)}/comments`),

  createInsightComment: (id: string, payload: { content: string; priority?: string }) =>
    v8Post<V8InsightComment>(`/interview/insights/${encodeURIComponent(id)}/comments`, payload),

  deleteInsightComment: (id: string, commentId: string) =>
    v8Delete<{ success: boolean }>(`/interview/insights/${encodeURIComponent(id)}/comments/${encodeURIComponent(commentId)}`),

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

  listFindings: (insightId: string) =>
    v8Get<{ data: { findings: Array<Record<string, unknown>>; insightId: string } }>(
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
    v8Post<{ data: { finding: Record<string, unknown> } }>(
      `/interview/insights/${encodeURIComponent(insightId)}/findings`,
      payload
    ),

  updateFinding: (
    insightId: string,
    findingId: string,
    payload: Record<string, unknown>
  ) =>
    v8Patch<{ data: { finding: Record<string, unknown> } }>(
      `/interview/insights/${encodeURIComponent(insightId)}/findings/${encodeURIComponent(findingId)}`,
      payload
    ),

  handoffFinding: (
    insightId: string,
    findingId: string,
    payload?: { target_initiative_id?: string }
  ) =>
    v8Post<{
      data: {
        handoff_payload: Record<string, unknown>;
        initiative: { id: string; type: 'linked' | 'handoff_request' };
        findingId: string;
        insightId: string;
      };
    }>(
      `/interview/insights/${encodeURIComponent(insightId)}/findings/${encodeURIComponent(findingId)}/handoff`,
      payload ?? {}
    ),
};
