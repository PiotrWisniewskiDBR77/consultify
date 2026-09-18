/**
 * dev-render host — AIR-1a (Wpis 119/120, DEC-566/569): the REAL production
 * <InterviewHub /> on its Managed tab with assignments carrying aiReview data.
 *
 * Nothing is re-implemented: the hub, its rail/tabs, the AI score column and
 * the session preview AI review block are the production components. The flag
 * VITE_INTERVIEW_AI_SCORE=true is read at transform time, so the harness server
 * must be started with that env var set.
 *
 * Start:
 *   VITE_INTERVIEW_AI_SCORE=true npx vite --config dev-render/vite.config.ts --port 5414
 *
 * URL: ?screen=air1a-managed-ai-score &lang=en|pl &theme=light|dark
 */
import React from 'react';
import { MemoryRouter } from 'react-router-dom';

import { InterviewHub } from '../../src/components/Interview/InterviewHub';
import { FeatureFlagsProvider } from '../../src/contexts/FeatureFlagsContext';
import { Api } from '../../src/services/api';
import { useAppStore } from '../../src/store/useAppStore';

useAppStore.setState({
  currentUser: {
    id: 'user-piotr-1',
    firstName: 'Piotr',
    lastName: 'Wiśniewski',
    email: 'piotr@dbr77.com',
    role: 'SUPERADMIN',
    status: 'active',
    isAuthenticated: true,
    accessLevel: 'full',
    organizationId: 'org-northwind',
    permissions: ['INTERVIEW_INSIGHTS_VIEW'],
  } as any,
  currentOrganization: {
    id: 'org-northwind',
    name: 'Northwind',
  } as any,
});

const NOW = Date.now();
const daysAgo = (n: number) => new Date(NOW - n * 86400000).toISOString();

// Sessions mirror the managed assignments below (assignmentId link) so the
// Sessions-tab preview resolves aiReview via getManagedAssignmentForSession.
const SESSIONS = [
  {
    id: 'sess-blocked-1',
    organizationId: 'org-northwind',
    name: 'Strategic Alignment Review — Ewa Dąbrowska',
    ownerId: 'user-ewa-1',
    status: 'submitted',
    assignmentId: 'asgn-blocked-1',
    totalQuestions: 15,
    answeredQuestions: 8,
    startedAt: daysAgo(3),
    lastActivityAt: daysAgo(0),
    templateName: 'Strategic Alignment Review',
    templateCategory: 'strategy',
    assigneeName: 'Ewa Dąbrowska',
    assignmentStatus: 'submitted',
    submittedAt: daysAgo(0),
    dueAt: daysAgo(-1),
  },
  {
    id: 'sess-needs-1',
    organizationId: 'org-northwind',
    name: 'Operational Deep-Dive — Marek Zieliński',
    ownerId: 'user-marek-1',
    status: 'submitted',
    assignmentId: 'asgn-needs-1',
    totalQuestions: 12,
    answeredQuestions: 10,
    startedAt: daysAgo(4),
    lastActivityAt: daysAgo(1),
    templateName: 'Operational Deep-Dive',
    templateCategory: 'operations',
    assigneeName: 'Marek Zieliński',
    assignmentStatus: 'submitted',
    submittedAt: daysAgo(1),
    dueAt: daysAgo(-2),
  },
  {
    id: 'sess-good-1',
    organizationId: 'org-northwind',
    name: 'Operational Deep-Dive — Anna Nowak',
    ownerId: 'user-anna-1',
    status: 'submitted',
    assignmentId: 'asgn-good-1',
    totalQuestions: 12,
    answeredQuestions: 12,
    startedAt: daysAgo(5),
    lastActivityAt: daysAgo(1),
    templateName: 'Operational Deep-Dive',
    templateCategory: 'operations',
    assigneeName: 'Anna Nowak',
    assignmentStatus: 'submitted',
    submittedAt: daysAgo(1),
    dueAt: daysAgo(-3),
  },
  {
    id: 'sess-empty-1',
    organizationId: 'org-northwind',
    name: 'Operational Deep-Dive — Paweł Kaczmarek',
    ownerId: 'user-pawel-1',
    status: 'in_progress',
    assignmentId: 'asgn-empty-1',
    totalQuestions: 12,
    answeredQuestions: 3,
    startedAt: daysAgo(2),
    lastActivityAt: daysAgo(2),
    templateName: 'Operational Deep-Dive',
    templateCategory: 'operations',
    assigneeName: 'Paweł Kaczmarek',
    assignmentStatus: 'in_progress',
    dueAt: daysAgo(-5),
  },
];

const MANAGED_ASSIGNMENTS = [
  {
    id: 'asgn-good-1',
    organizationId: 'org-northwind',
    assigneeUserId: 'user-anna-1',
    templateId: 'tpl-operational',
    templateVersion: 3,
    status: 'submitted',
    sessionId: 'sess-good-1',
    dueAt: daysAgo(-3),
    startedAt: daysAgo(5),
    submittedAt: daysAgo(1),
    priority: 'high',
    isTeamAssignment: false,
    createdBy: 'user-piotr-1',
    createdAt: daysAgo(7),
    updatedAt: daysAgo(1),
    template: { id: 'tpl-operational', name: 'Operational Deep-Dive', category: 'operations' },
    assignee: { id: 'user-anna-1', name: 'Anna Nowak', email: 'anna@northwind.com' },
    session: { id: 'sess-good-1', status: 'submitted', answeredQuestions: 12, totalQuestions: 12, completenessPercent: 100 },
    aiReview: {
      overallScore: 4.6,
      overallVerdict: 'ready_for_approval',
      recommendations: [],
      weakAnswerMap: [],
      questionEvaluations: [],
    },
    aiReviewedAt: daysAgo(1),
  },
  {
    id: 'asgn-needs-1',
    organizationId: 'org-northwind',
    assigneeUserId: 'user-marek-1',
    templateId: 'tpl-operational',
    templateVersion: 3,
    status: 'submitted',
    sessionId: 'sess-needs-1',
    dueAt: daysAgo(-2),
    startedAt: daysAgo(4),
    submittedAt: daysAgo(1),
    priority: 'medium',
    isTeamAssignment: false,
    createdBy: 'user-piotr-1',
    createdAt: daysAgo(6),
    updatedAt: daysAgo(1),
    template: { id: 'tpl-operational', name: 'Operational Deep-Dive', category: 'operations' },
    assignee: { id: 'user-marek-1', name: 'Marek Zieliński', email: 'marek@northwind.com' },
    session: { id: 'sess-needs-1', status: 'submitted', answeredQuestions: 10, totalQuestions: 12, completenessPercent: 83 },
    aiReview: {
      overallScore: 3.2,
      overallVerdict: 'needs_improvement',
      recommendations: ['Expand the logistics bottleneck answer with root-cause detail.'],
      weakAnswerMap: [
        { key: 'q7', label: 'Logistics bottleneck', score: 2, verdict: 'needs_improvement', feedback: 'Answer lacks root-cause analysis.', fixType: 'expand_answer', isRequired: true },
        { key: 'q9', label: 'Vendor SLA gaps', score: 2, verdict: 'needs_improvement', feedback: 'No evidence cited.', fixType: 'add_evidence', isRequired: false },
      ],
      questionEvaluations: [],
    },
    aiReviewedAt: daysAgo(1),
  },
  {
    id: 'asgn-blocked-1',
    organizationId: 'org-northwind',
    assigneeUserId: 'user-ewa-1',
    templateId: 'tpl-strategic',
    templateVersion: 1,
    status: 'submitted',
    sessionId: 'sess-blocked-1',
    dueAt: daysAgo(-1),
    startedAt: daysAgo(3),
    submittedAt: daysAgo(0),
    priority: 'urgent',
    isTeamAssignment: false,
    createdBy: 'user-piotr-1',
    createdAt: daysAgo(5),
    updatedAt: daysAgo(0),
    template: { id: 'tpl-strategic', name: 'Strategic Alignment Review', category: 'strategy' },
    assignee: { id: 'user-ewa-1', name: 'Ewa Dąbrowska', email: 'ewa@northwind.com' },
    session: { id: 'sess-blocked-1', status: 'submitted', answeredQuestions: 8, totalQuestions: 15, completenessPercent: 53 },
    aiReview: {
      overallScore: 1.4,
      overallVerdict: 'insufficient',
      recommendations: ['Complete all required fields before resubmission.'],
      weakAnswerMap: [
        { key: 'q1', label: 'Market positioning', score: 1, verdict: 'insufficient', feedback: 'Answer is a placeholder.', fixType: 'make_specific', isRequired: true },
        { key: 'q3', label: 'Revenue model', score: 1, verdict: 'unanswered', feedback: 'Not answered.', fixType: 'complete_required_fields', isRequired: true },
        { key: 'q5', label: 'Competitive moat', score: 2, verdict: 'needs_improvement', feedback: 'Too vague.', fixType: 'clarify', isRequired: true },
      ],
      questionEvaluations: [],
    },
    aiReviewedAt: daysAgo(0),
  },
  {
    id: 'asgn-empty-1',
    organizationId: 'org-northwind',
    assigneeUserId: 'user-pawel-1',
    templateId: 'tpl-operational',
    templateVersion: 3,
    status: 'in_progress',
    sessionId: 'sess-empty-1',
    dueAt: daysAgo(-5),
    startedAt: daysAgo(2),
    priority: 'low',
    isTeamAssignment: false,
    createdBy: 'user-piotr-1',
    createdAt: daysAgo(4),
    updatedAt: daysAgo(2),
    template: { id: 'tpl-operational', name: 'Operational Deep-Dive', category: 'operations' },
    assignee: { id: 'user-pawel-1', name: 'Paweł Kaczmarek', email: 'pawel@northwind.com' },
    session: { id: 'sess-empty-1', status: 'in_progress', answeredQuestions: 3, totalQuestions: 12, completenessPercent: 25 },
    aiReview: null,
    aiReviewedAt: undefined,
  },
];

const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

Object.assign(Api, {
  get: async (path: string) => {
    if (path === '/interview/sessions') return SESSIONS;
    if (path === '/pmo/projects/my-memberships') return { memberships: [] };
    if (path === '/access/effective') return { effectiveAccess: { capabilities: ['*'] } };
    if (path.startsWith('/interview/')) return [];
    return {};
  },
  post: async () => ({}),
  put: async () => ({}),
  patch: async () => ({}),
  delete: async () => ({}),
});

(globalThis as any).fetch = async (input: any, init?: any) => {
  const url = String(input);
  if (url.includes('/api/v8/interview/assignments/managed')) {
    return jsonResponse({ data: { assignments: MANAGED_ASSIGNMENTS } });
  }
  if (url.includes('/api/v8/interview/assignments/my')) {
    return jsonResponse({ data: { assignments: [] } });
  }
  if (url.includes('/api/v8/interview/assignments/overdue')) {
    return jsonResponse({ data: { assignments: [] } });
  }
  if (url.includes('/api/v8/interview/insights')) {
    return jsonResponse({ data: { insights: [] } });
  }
  if (url.includes('/api/v8/')) {
    return jsonResponse({ data: { assignments: [], insights: [], sessions: [], documents: [], items: [], data: [] } });
  }
  if (url.includes('/initiatives/candidates')) {
    return jsonResponse({ candidates: [], total: 0 });
  }
  return jsonResponse({});
};

export default function Air1aManagedAiScoreScreen() {
  const hubTab =
    new URLSearchParams(window.location.search).get('hubTab') || 'managed';
  return (
    <FeatureFlagsProvider config={{ enableLocalOverrides: true }} showDevTools={false}>
      <MemoryRouter initialEntries={[`/interview?tab=${hubTab}`]}>
        <div className="h-screen w-screen overflow-auto bg-c-surface">
          <InterviewHub />
        </div>
      </MemoryRouter>
    </FeatureFlagsProvider>
  );
}
