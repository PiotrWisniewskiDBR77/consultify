/**
 * @vitest-environment jsdom
 *
 * IS-2b (U-05 / DEC-535, Wpis 121 poz. 2) — WPIĘCIE test for the active
 * sessions list. IS-2a made the server (`loadInterviewSessionsForOrganization`,
 * behind INTERVIEW_SESSIONS_FULL_COLUMNS) return template / respondent /
 * assignee / due / submitted per row. This proves the REAL InterviewHub sessions
 * table is WIRED to those server fields: the TEMPLATE / ASSIGNEE / DUE /
 * SUBMITTED cells render the server-provided values, and a row WITHOUT them
 * falls back to "—"/"Unassigned".
 *
 * No front production change is needed — the columns already read these fields;
 * they rendered "—" only because the active endpoint never sent them. The
 * mutations (column reads a different field) turn the matching assertion RED,
 * which is what makes this a wiring test and not a mirror of the component.
 */

import { render, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { V8InterviewApi } from '@/services/api/v8/interview';
import { formatListDate } from '@/utils/listDateFormat';

import enTranslation from '../../../../public/locales/en/translation.json';

const resolveEnKey = (key: string): string | undefined => {
  const value = key
    .split('.')
    .reduce<unknown>(
      (node, part) =>
        node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined,
      enTranslation as unknown
    );
  return typeof value === 'string' ? value : undefined;
};

const tEn = (key: string, opt?: unknown): string => {
  const resolved = resolveEnKey(key);
  if (resolved !== undefined) return resolved;
  if (typeof opt === 'string') return opt;
  if (opt && typeof opt === 'object' && 'defaultValue' in (opt as Record<string, unknown>)) {
    return String((opt as { defaultValue: unknown }).defaultValue);
  }
  return key;
};

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: tEn,
    i18n: { language: 'en', getFixedT: () => tEn },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
  I18nextProvider: ({ children }: { children: React.ReactNode }) => children,
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

vi.mock('react-hot-toast', () => {
  const fn = vi.fn();
  return {
    default: Object.assign(fn, { success: vi.fn(), error: vi.fn(), loading: vi.fn() }),
  };
});

const { apiGet, apiPost, getSessions, listInsights, getProjects, getMyAssignments, getSession } =
  vi.hoisted(() => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    getSessions: vi.fn(),
    listInsights: vi.fn(),
    getProjects: vi.fn(),
    getMyAssignments: vi.fn<typeof V8InterviewApi.getMyAssignments>(),
    getSession: vi.fn(async () => null),
  }));

vi.mock('@/services/api', () => ({
  Api: {
    get: apiGet,
    post: apiPost,
    patch: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    postMultipart: vi.fn(async () => ({})),
    getProjects,
    createProject: vi.fn(),
  },
  shouldAllowDemoData: () => false,
}));

vi.mock('@/services/api/v8/interview', () => ({
  V8InterviewApi: {
    getSessions,
    getManagedSessions: vi.fn(async () => []),
    getMyAssignments,
    getManagedAssignments: vi.fn(async () => []),
    getOverdueAssignments: vi.fn(async () => []),
    listInsights,
    getSession,
    remindAssignment: vi.fn(async () => ({})),
    startAssignment: vi.fn(async () => ({})),
    approveAssignment: vi.fn(async () => ({})),
    sendBackAssignment: vi.fn(async () => ({})),
    createInsight: vi.fn(async () => ({})),
    deleteInsight: vi.fn(async () => ({})),
    exportInsight: vi.fn(async () => ({})),
    listContextDocuments: vi.fn(async () => ({ documents: [] })),
  },
}));

vi.mock('@/hooks/useInterviewPermissions', () => ({
  useInterviewPermissions: () => ({
    canAssign: true,
    canViewManaged: true,
    canViewOverdue: true,
    canSendReminder: true,
    canViewInsights: true,
    canCreateInsights: true,
    canReviewInsights: true,
    canPublishInsights: true,
    canHandoffInsights: true,
    assignmentScope: 'all',
    projectMemberships: [],
    isLoading: false,
    canAssignToUser: () => true,
    getAssignableProjects: () => [],
  }),
  useInterviewReviewAccess: () => ({
    canReview: false,
    isLoading: false,
    refresh: vi.fn(),
  }),
}));

const APP_STORE_STATE = {
  currentProjectId: 'proj-1' as string | null,
  setCurrentProjectId: vi.fn(),
  currentOrganization: { id: 'org-1', name: 'Acme' },
  currentUser: {
    id: 'user-1',
    firstName: 'Test',
    lastName: 'User',
    email: 't@e.com',
    role: 'ADMIN',
  },
  setInterviewBreadcrumbs: vi.fn(),
};
vi.mock('@/store/useAppStore', () => ({
  useAppStore: (selector?: (s: typeof APP_STORE_STATE) => unknown) =>
    selector ? selector(APP_STORE_STATE) : APP_STORE_STATE,
}));

vi.mock('@/contexts/HelpContext', () => ({
  useHelpSidePanel: () => ({
    setOpen: vi.fn(),
    setActiveTab: vi.fn(),
    setKnowledgeModuleIdOverride: vi.fn(),
  }),
}));

import { InterviewHub } from '../InterviewHub';

// Technical kebab tokens (not English prose) so the J0 language ratchet treats
// them as values; the cells only have to be findable, not readable.
const ENRICHED_SESSION = {
  id: 'is2b-sess-enriched',
  organizationId: 'org-1',
  projectId: 'proj-1',
  name: 'is2b-session-enriched',
  ownerId: 'user-owner',
  status: 'in_progress',
  totalQuestions: 5,
  answeredQuestions: 3,
  startedAt: '2026-09-17T00:00:00.000Z',
  // The fields IS-2a added to the active endpoint:
  assignmentStatus: 'submitted',
  templateName: 'is2b-template-discovery',
  templateCategory: 'is2b-cat-strategy',
  respondentId: 'user-owner',
  respondentName: 'is2b-respondent-jane',
  assigneeId: 'user-assignee',
  assigneeName: 'is2b-assignee-sam',
  assigneeEmail: 'is2b-assignee@example.invalid',
  dueAt: '2026-09-20T00:00:00.000Z',
  submittedAt: '2026-09-18T09:00:00.000Z',
};

// A row the active endpoint returns WITHOUT the enriched fields (legacy shape) —
// the columns must fall back to "—"/"Unassigned", proving they read the server
// value rather than a hardcoded label.
const BARE_SESSION = {
  id: 'is2b-sess-bare',
  organizationId: 'org-1',
  projectId: 'proj-1',
  name: 'is2b-session-bare',
  ownerId: 'user-owner',
  status: 'in_progress',
  totalQuestions: 0,
  answeredQuestions: 0,
  startedAt: '2026-09-16T00:00:00.000Z',
};

const renderSessionsTab = () =>
  render(
    <MemoryRouter initialEntries={['/interview?tab=sessions']}>
      <InterviewHub />
    </MemoryRouter>
  );

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockImplementation(async (path: string) => {
    if (path === '/interview/sessions') return [ENRICHED_SESSION, BARE_SESSION];
    return [];
  });
  apiPost.mockReset();
  apiPost.mockResolvedValue({});
  getSessions.mockReset();
  getSessions.mockResolvedValue({ sessions: [] });
  listInsights.mockReset();
  listInsights.mockResolvedValue({ insights: [] });
  getProjects.mockReset();
  getProjects.mockResolvedValue([{ id: 'proj-1', name: 'Project One' }]);
  getMyAssignments.mockReset();
  getMyAssignments.mockResolvedValue({ assignments: [] });
  getSession.mockReset();
  getSession.mockResolvedValue(null);
  globalThis.fetch = vi.fn(async () =>
    ({ ok: true, status: 200, json: async () => ({ candidates: [] }) }) as unknown as Response
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('InterviewHub — IS-2b active sessions list renders the server-enriched columns', () => {
  it('TEMPLATE / ASSIGNEE / DUE / SUBMITTED cells render the values the active endpoint now sends', async () => {
    renderSessionsTab();

    // TEMPLATE column reads row.templateName.
    expect(await screen.findByText('is2b-template-discovery')).toBeInTheDocument();
    // ASSIGNEE column reads row.assigneeName (AssigneeCell renders the name text).
    expect(await screen.findByText('is2b-assignee-sam')).toBeInTheDocument();
    // SUBMITTED column reads row.submittedAt → formatListDate.
    expect(
      await screen.findByText(formatListDate(ENRICHED_SESSION.submittedAt))
    ).toBeInTheDocument();
    // DUE column reads row.dueAt → formatListDate, carried on the chip title
    // (always the date label, independent of the overdue/resolved branch).
    expect(
      await screen.findByTitle(formatListDate(ENRICHED_SESSION.dueAt))
    ).toBeInTheDocument();
  });

  it('a row without the enriched fields falls back to Unassigned, not a fabricated value', async () => {
    renderSessionsTab();

    // The bare row's ASSIGNEE cell shows the unassigned label.
    expect(await screen.findByText(tEn('interview.hub.unassigned'))).toBeInTheDocument();
    // The enriched row still shows its real assignee alongside it.
    expect(screen.getByText('is2b-assignee-sam')).toBeInTheDocument();
  });
});
