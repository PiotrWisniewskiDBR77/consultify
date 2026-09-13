/**
 * @vitest-environment jsdom
 *
 * Mounted Hub lifecycle test: a canonical card response updates the existing
 * assignment row without refetch or inference from a session status.
 * Heavy service dependencies and the child card are mocked at their boundary.
 */

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import enTranslation from '../../../../public/locales/en/translation.json';
import type { V8InterviewApi, V8InterviewAssignment } from '@/services/api/v8/interview';

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

const {
  apiGet,
  apiPost,
  getSessions,
  listInsights,
  getProjects,
  createProject,
  setCurrentProjectId,
  setInterviewBreadcrumbs,
  getMyAssignments,
  getSession,
  appStoreState,
} = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  getSessions: vi.fn(),
  listInsights: vi.fn(),
  getProjects: vi.fn(),
  createProject: vi.fn(),
  setCurrentProjectId: vi.fn(),
  setInterviewBreadcrumbs: vi.fn(),
  getMyAssignments: vi.fn<typeof V8InterviewApi.getMyAssignments>(),
  getSession: vi.fn(async () => null),
  appStoreState: { currentProjectId: 'proj-1' as string | null, scopedReviewer: false },
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: apiGet,
    post: apiPost,
    patch: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    postMultipart: vi.fn(async () => ({})),
    getProjects,
    createProject,
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
  },
}));

vi.mock('@/hooks/useInterviewPermissions', () => ({
  useInterviewPermissions: () => ({
    canAssign: true,
    canViewManaged: !appStoreState.scopedReviewer,
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
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentProjectId: appStoreState.currentProjectId,
    setCurrentProjectId,
    currentOrganization: { id: 'org-1', name: 'Acme' },
    currentUser: { id: 'user-1', firstName: 'Test', lastName: 'User', email: 't@e.com' },
    setInterviewBreadcrumbs,
  }),
}));

vi.mock('@/contexts/HelpContext', () => ({
  useHelpSidePanel: () => ({
    setOpen: vi.fn(),
    setActiveTab: vi.fn(),
    setKnowledgeModuleIdOverride: vi.fn(),
  }),
}));

vi.mock('../InterviewWorkspace', () => ({
  InterviewWorkspace: (props: any) => (
    <div>
      <button
        onClick={() => {
          props.onAssignmentChange?.({
            id: 'sync-assignment',
            status: 'approved',
            sentBackReason: null,
          });
          props.onClose();
        }}
      >
        accept canonical assignment
      </button>
    </div>
  ),
}));

import { InterviewHub } from '../InterviewHub';

const renderTab = (tab: string) =>
  render(
    <MemoryRouter initialEntries={[`/interview?tab=${tab}`]}>
      <InterviewHub />
    </MemoryRouter>
  );

beforeEach(() => {
  sessionStorage.clear();
  apiGet.mockReset();
  apiPost.mockReset();
  // Default: every data fetch resolves to an empty collection.
  apiGet.mockResolvedValue([]);
  apiPost.mockResolvedValue({});
  getSessions.mockReset();
  getSessions.mockResolvedValue({ sessions: [] });
  listInsights.mockReset();
  listInsights.mockResolvedValue({ insights: [] });
  getProjects.mockReset();
  getProjects.mockResolvedValue([{ id: 'proj-1', name: 'Project One' }]);
  createProject.mockReset();
  createProject.mockImplementation(async ({ name }: { name: string }) => ({
    id: 'proj-new',
    name,
  }));
  setCurrentProjectId.mockReset();
  appStoreState.currentProjectId = 'proj-1';
  appStoreState.scopedReviewer = false;
  getMyAssignments.mockReset();
  getMyAssignments.mockResolvedValue({ assignments: [] });
  getSession.mockReset();
  getSession.mockResolvedValue(null);
  setInterviewBreadcrumbs.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Interview Hub assignment lifecycle readback', () => {
  it('updates the Inbox row from the card response without refetch or a session status inference', async () => {
    const session = {
      id: 'sync-session',
      name: 'Workflow sync assignment',
      status: 'submitted',
      ownerId: 'user-1',
      assignmentId: 'sync-assignment',
      totalQuestions: 1,
      answeredQuestions: 1,
      completenessPercent: 100,
    };
    const assignment: V8InterviewAssignment = {
      id: 'sync-assignment',
      organizationId: 'org-1',
      projectId: 'proj-1',
      assigneeUserId: 'user-1',
      templateId: 'sync-template',
      templateVersion: 1,
      status: 'submitted',
      sessionId: 'sync-session',
      priority: 'medium',
      isTeamAssignment: false,
      createdBy: 'manager',
      createdAt: '2026-09-12T00:00:00Z',
      updatedAt: '2026-09-12T00:00:00Z',
      template: { id: 'sync-template', name: 'Workflow sync assignment', category: 'strategy' },
      session,
      assignee: { id: 'user-1', name: 'Test User', email: 'user-1@example.test' },
    };
    getMyAssignments.mockResolvedValue({ assignments: [assignment] });
    getSession.mockResolvedValue({ session } as any);
    renderTab('my_assignments');
    const names = await screen.findAllByText('Workflow sync assignment');
    fireEvent.doubleClick(names.at(-1)!);
    const action = await screen.findByRole('button', { name: 'accept canonical assignment' });
    const before = getMyAssignments.mock.calls.length;
    fireEvent.click(action);
    await waitFor(() =>
      expect(
        screen
          .getAllByText('Approved', { exact: true })
          .some((el) => el.closest('tr')?.textContent?.includes('Workflow sync assignment'))
      ).toBe(true)
    );
    expect(getMyAssignments.mock.calls.length).toBe(before);
  });
});

describe('Interview notification record read without list membership', () => {
  it('opens the explicit assignment through its protected detail when lists are empty', async () => {
    appStoreState.scopedReviewer = true;
    const session = {
      id: 'scoped-session',
      name: 'Scoped record',
      status: 'submitted',
      assignmentId: 'scoped-assignment',
    };
    apiGet.mockImplementation(async (url: string) =>
      url === '/interview/assignments/scoped-assignment'
        ? { id: 'scoped-assignment', status: 'submitted', sessionId: session.id, session }
        : []
    );
    getSession.mockResolvedValue({ session } as any);
    render(
      <MemoryRouter initialEntries={['/interview?assignmentId=scoped-assignment&scope=managed']}>
        <InterviewHub />
      </MemoryRouter>
    );
    expect(await screen.findByRole('button', { name: 'accept canonical assignment' })).toBeTruthy();
    expect(apiGet).toHaveBeenCalledWith('/interview/assignments/scoped-assignment');
  });
  it('denied explicit detail never opens an assignment card', async () => {
    apiGet.mockImplementation(async (url: string) => {
      if (url === '/interview/assignments/foreign-assignment')
        throw Object.assign(Error('Forbidden'), { status: 403 });
      return [];
    });
    render(
      <MemoryRouter initialEntries={['/interview?assignmentId=foreign-assignment&scope=managed']}>
        <InterviewHub />
      </MemoryRouter>
    );
    await waitFor(() =>
      expect(apiGet).toHaveBeenCalledWith('/interview/assignments/foreign-assignment')
    );
    expect(screen.queryByRole('button', { name: 'accept canonical assignment' })).toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });
});
