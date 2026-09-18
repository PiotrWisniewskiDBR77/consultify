/**
 * dev-render host — Interview "Sessions" tab with the IS-2a enriched columns.
 *
 * Mounts the REAL production <InterviewHub /> (Sessions tab) — nothing here is
 * re-implemented. Purpose: screenshot the active-sessions list AFTER IS-2a made
 * `/interview/sessions` return the full column set (template, assignee, due,
 * submitted) behind INTERVIEW_SESSIONS_FULL_COLUMNS. Before IS-2a the server
 * sent none of those fields, so every one of these cells rendered "—"; the mock
 * list below is shaped exactly like the enriched server payload so the columns
 * show real values.
 *
 * Rows cover the states the columns can take:
 *   1 submitted   → due resolved (neutral), submitted date present
 *   2 in_progress → due in the past, unresolved → OVERDUE danger signal
 *   3 anonymous   → respondent masked server-side ("Anonymous respondent"),
 *                   assignee still shown, due soon
 *   4 completed   → due in the past but resolved → neutral, submitted present
 *   5 bare/legacy → none of the enriched fields → graceful "—"/"Unassigned"
 *
 * URL: ?screen=interview-sessions-full-columns  &lang=en|pl  &theme=light|dark
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
    organizationId: 'org-dbr77',
  } as any,
  currentOrganization: {
    id: 'org-dbr77',
    name: 'DBR77',
  } as any,
});

const NOW = Date.now();
const dayOffset = (n: number) => new Date(NOW + n * 86400000).toISOString();

// Shaped like the IS-2a enriched `/interview/sessions` payload (the columns the
// active endpoint did not used to send). Dates are relative to NOW so the
// overdue / due-soon / resolved states stay correct whenever this is captured.
const sessions = [
  {
    id: 'sess-is2b-submitted',
    organizationId: 'org-dbr77',
    ownerId: 'user-jane-1',
    name: 'Procurement deep-dive',
    status: 'submitted',
    assignmentStatus: 'submitted',
    assignmentPriority: 'high',
    templateName: 'Discovery interview',
    templateCategory: 'strategy',
    respondentId: 'user-jane-1',
    respondentName: 'Jane Respondent',
    assigneeName: 'Sam Manager',
    assigneeEmail: 'sam.manager@dbr77.com',
    dueAt: dayOffset(5),
    submittedAt: dayOffset(-1),
    startedAt: dayOffset(-6),
    totalQuestions: 8,
    answeredQuestions: 8,
  },
  {
    id: 'sess-is2b-overdue',
    organizationId: 'org-dbr77',
    ownerId: 'user-maria-1',
    name: 'Sales team baseline',
    status: 'in_progress',
    assignmentStatus: 'in_progress',
    assignmentPriority: 'urgent',
    templateName: 'Operational interview',
    templateCategory: 'operations',
    respondentId: 'user-maria-1',
    respondentName: 'Maria Nowak',
    assigneeName: 'Alex Rivera',
    assigneeEmail: 'alex.rivera@dbr77.com',
    dueAt: dayOffset(-2),
    startedAt: dayOffset(-4),
    totalQuestions: 8,
    answeredQuestions: 3,
  },
  {
    id: 'sess-is2b-anon',
    organizationId: 'org-dbr77',
    ownerId: 'user-sam-1',
    name: 'Leadership pulse (anonymous)',
    status: 'in_progress',
    assignmentStatus: 'in_progress',
    assignmentPriority: 'normal',
    templateName: 'Discovery interview',
    templateCategory: 'strategy',
    // Server already masked the respondent (D18-A anonymity wall); the assignee
    // is NOT the respondent and stays visible.
    respondentName: 'Anonymous respondent',
    assigneeName: 'Sam Manager',
    assigneeEmail: 'sam.manager@dbr77.com',
    dueAt: dayOffset(1),
    startedAt: dayOffset(-1),
    totalQuestions: 6,
    answeredQuestions: 2,
  },
  {
    id: 'sess-is2b-completed',
    organizationId: 'org-dbr77',
    ownerId: 'user-eva-1',
    name: 'Finance close-out',
    status: 'completed',
    assignmentStatus: 'completed',
    assignmentPriority: 'low',
    templateName: 'Operational interview',
    templateCategory: 'finance',
    respondentId: 'user-eva-1',
    respondentName: 'Eva Dabrowska',
    assigneeName: 'Paul Kaczmarek',
    assigneeEmail: 'paul.kaczmarek@dbr77.com',
    dueAt: dayOffset(-10),
    submittedAt: dayOffset(-9),
    startedAt: dayOffset(-12),
    completedAt: dayOffset(-9),
    totalQuestions: 8,
    answeredQuestions: 8,
  },
  {
    id: 'sess-is2b-bare',
    organizationId: 'org-dbr77',
    ownerId: 'user-legacy-1',
    name: 'Legacy session (pre-enrichment)',
    status: 'assigned',
    assignmentStatus: 'assigned',
    startedAt: dayOffset(-1),
    totalQuestions: 5,
    answeredQuestions: 0,
  },
];

Object.assign(Api, {
  get: async (path: string) => {
    if (path === '/interview/sessions') return sessions;
    if (path === '/pmo/projects/my-memberships') return { memberships: [] };
    if (path === '/access/effective') return { effectiveAccess: { capabilities: ['*'] } };
    if (path.startsWith('/interview/')) return [];
    if (path.startsWith('/my-work/')) return [];
    return {};
  },
  post: async () => ({}),
  put: async () => ({}),
  patch: async () => ({}),
  delete: async () => ({}),
});

// InterviewHub also fires V8 capability reads (assignments / insights / managed)
// through raw fetch. The harness has no backend, so those would 404 and log
// console errors. Return a permissive empty shape so no load path throws
// (bledyKonsoli=0). The Sessions table is unaffected — it is fed by Api.get above.
const jsonResponse = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

(globalThis as any).fetch = async (input: any) => {
  const url = String(input);
  if (url.includes('/api/v8/')) {
    return jsonResponse({
      assignments: [],
      insights: [],
      sessions: [],
      documents: [],
      items: [],
      data: [],
    });
  }
  return jsonResponse({});
};

export default function InterviewSessionsFullColumnsScreen() {
  return (
    <FeatureFlagsProvider config={{ enableLocalOverrides: true }} showDevTools={false}>
      <MemoryRouter initialEntries={['/interview?tab=sessions']}>
        <div className="h-screen w-screen overflow-auto bg-c-surface">
          <InterviewHub />
        </div>
      </MemoryRouter>
    </FeatureFlagsProvider>
  );
}
