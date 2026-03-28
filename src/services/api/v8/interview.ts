import { v8Get, v8Post } from './client';

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
};
