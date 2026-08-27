/**
 * dev-render host — Interview "Sesje" table, session-status column.
 *
 * Mounts the REAL production <InterviewHub /> (Sesje tab) — nothing here is
 * re-implemented. Verifies the UI-latki-20260828 patch #2 fix: a session
 * whose normalized status is 'assigned' (created, not yet started — 0%
 * progress) must show a Polish "Przydzielony" badge in neutral/gray tone,
 * not the English "In Progress" fallback the missing config/i18n entry
 * previously produced.
 *
 * The mock session list below covers all 5 values
 * `normalizeInterviewAssignmentStatus` can return (assigned, in_progress,
 * submitted, approved, completed) so every row is visible side by side.
 *
 * URL: ?screen=interview-sessions-status  &lang=pl|en  &theme=light|dark
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
const daysAgo = (n: number) => new Date(NOW - n * 86400000).toISOString();

// One row per value `normalizeInterviewAssignmentStatus` can actually
// return (InterviewHub.tsx `normalizeInterviewAssignmentStatus`) — the
// mianownik from the DEC-215 audit. 'assigned' (row 1) is the row this
// patch fixes: before the fix it rendered "In Progress" (English, blue)
// instead of "Przydzielony" (Polish, neutral gray).
const sessions = [
  {
    id: 'sess-assigned-1',
    name: 'Wywiad — Dział zakupów (nierozpoczęty)',
    assignmentStatus: 'assigned',
    status: 'assigned',
    answeredQuestions: 0,
    totalQuestions: 8,
    startedAt: daysAgo(1),
    assigneeName: 'Marek Zieliński',
    templateName: 'Wywiad operacyjny',
  },
  {
    id: 'sess-in-progress-1',
    name: 'Wywiad — Dział sprzedaży',
    assignmentStatus: 'in_progress',
    status: 'in_progress',
    answeredQuestions: 3,
    totalQuestions: 8,
    startedAt: daysAgo(2),
    assigneeName: 'Anna Nowak',
    templateName: 'Wywiad operacyjny',
  },
  {
    id: 'sess-submitted-1',
    name: 'Wywiad — Dział logistyki',
    assignmentStatus: 'submitted',
    status: 'submitted',
    answeredQuestions: 8,
    totalQuestions: 8,
    startedAt: daysAgo(4),
    assigneeName: 'Katarzyna Wójcik',
    templateName: 'Wywiad operacyjny',
  },
  {
    id: 'sess-approved-1',
    name: 'Wywiad — Dział finansów',
    assignmentStatus: 'approved',
    status: 'approved',
    answeredQuestions: 8,
    totalQuestions: 8,
    startedAt: daysAgo(6),
    assigneeName: 'Paweł Kaczmarek',
    templateName: 'Wywiad operacyjny',
  },
  {
    id: 'sess-completed-1',
    name: 'Wywiad — Dział HR',
    assignmentStatus: 'completed',
    status: 'completed',
    answeredQuestions: 8,
    totalQuestions: 8,
    startedAt: daysAgo(8),
    assigneeName: 'Ewa Dąbrowska',
    templateName: 'Wywiad operacyjny',
  },
];

Object.assign(Api, {
  get: async (path: string) => {
    if (path === '/interview/sessions') return sessions;
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

export default function InterviewSessionsStatusScreen() {
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
