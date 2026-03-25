import { v8Get } from './client';

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
}

export const V8InterviewApi = {
  getSessions: (status?: string) =>
    v8Get<{ sessions: V8InterviewSession[] }>(
      '/interview/sessions',
      status ? { status } : undefined
    ),

  getSession: (id: string) =>
    v8Get<{ session: V8InterviewSession }>(`/interview/sessions/${encodeURIComponent(id)}`),
};
