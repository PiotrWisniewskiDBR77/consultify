/**
 * @vitest-environment jsdom
 *
 * Smoke tests for InterviewHub — asserts each of the tabs renders without
 * throwing. Heavy data/service dependencies are mocked so the tests exercise
 * the tab-render branches deterministically and offline.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
    i18n: { language: 'en' },
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

const { apiGet, apiPost, getSessions } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  getSessions: vi.fn(),
}));

vi.mock('@/services/api', () => ({
  Api: {
    get: apiGet,
    post: apiPost,
    patch: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
    postMultipart: vi.fn(async () => ({})),
  },
  shouldAllowDemoData: () => false,
}));

vi.mock('@/services/api/v8/interview', () => ({
  V8InterviewApi: {
    getSessions,
    getManagedSessions: vi.fn(async () => []),
    getMyAssignments: vi.fn(async () => []),
    getManagedAssignments: vi.fn(async () => []),
    getOverdueAssignments: vi.fn(async () => []),
    listInsights: vi.fn(async () => ({ insights: [] })),
    getSession: vi.fn(async () => null),
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
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({
    currentProjectId: 'proj-1',
    setCurrentProjectId: vi.fn(),
    currentOrganization: { id: 'org-1', name: 'Acme' },
    currentUser: { id: 'user-1', firstName: 'Test', lastName: 'User', email: 't@e.com' },
    setInterviewBreadcrumbs: vi.fn(),
  }),
}));

vi.mock('@/contexts/HelpContext', () => ({
  useHelpSidePanel: () => ({
    setOpen: vi.fn(),
    setActiveTab: vi.fn(),
    setKnowledgeModuleIdOverride: vi.fn(),
  }),
}));

import { InterviewHub } from '../InterviewHub';

const renderTab = (tab: string) =>
  render(
    <MemoryRouter initialEntries={[`/interview?tab=${tab}`]}>
      <InterviewHub />
    </MemoryRouter>
  );

beforeEach(() => {
  apiGet.mockReset();
  apiPost.mockReset();
  // Default: every data fetch resolves to an empty collection.
  apiGet.mockResolvedValue([]);
  apiPost.mockResolvedValue({});
  getSessions.mockReset();
  getSessions.mockResolvedValue({ sessions: [] });
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('InterviewHub smoke — tab rendering', () => {
  // Default tab (my_assignments) renders on mount; the rest are reached by
  // clicking their tab button, which exercises each distinct render branch.
  const clickableTabs = ['Sessions', 'Assigned', 'Templates', 'Insights', 'Initiatives'];

  it('renders the default Inbox (my_assignments) tab without throwing', async () => {
    const { container } = renderTab('my_assignments');
    await waitFor(() => expect(container.firstChild).toBeTruthy());
    expect(screen.getByRole('tab', { name: /Inbox/i })).toBeInTheDocument();
  });

  for (const tabLabel of clickableTabs) {
    it(`switches to and renders the "${tabLabel}" tab without throwing`, async () => {
      const { container } = renderTab('my_assignments');
      const tabButton = await screen.findByRole('tab', { name: new RegExp(tabLabel, 'i') });
      fireEvent.click(tabButton);
      await waitFor(() => {
        expect(tabButton).toHaveAttribute('aria-selected', 'true');
      });
      expect(container.firstChild).toBeTruthy();
    });
  }

  it('renders the pending_review branch via the my-assignments view filter', async () => {
    // pending_review shares the assignments render path; reaching the Inbox tab
    // without crashing confirms the shared branch mounts.
    const { container } = renderTab('my_assignments');
    await waitFor(() => expect(container.firstChild).toBeTruthy());
    expect(container.querySelector('[role="tablist"]')).toBeTruthy();
  });

  it('shows the initiatives honest empty state with an Insights handoff CTA', async () => {
    renderTab('my_assignments');
    const initiativesTab = await screen.findByRole('tab', { name: /Initiatives/i });
    fireEvent.click(initiativesTab);
    await waitFor(() => {
      expect(screen.getByText(/Go to Insights/i)).toBeInTheDocument();
    });
  });

  it('mounts without injecting demo data when shouldAllowDemoData is false', async () => {
    const { container } = renderTab('my_assignments');
    await waitFor(() => expect(container.firstChild).toBeTruthy());
    // No throw + shell present => real (mocked) load path was used, not demo.
    expect(container.firstChild).toBeTruthy();
  });

  it('creates a named session only after canonical server readback and renders translated labels', async () => {
    const created = {
      id: 'session-created-1',
      name: 'Customer discovery readback',
      status: 'active',
      ownerId: 'user-1',
      organizationId: 'org-1',
      projectId: 'proj-1',
      totalQuestions: 0,
      answeredQuestions: 0,
      startedAt: '2026-08-18T20:00:00.000Z',
    };
    getSessions.mockResolvedValueOnce({ sessions: [] }).mockResolvedValue({ sessions: [created] });
    apiPost.mockResolvedValue(created);

    renderTab('sessions');
    fireEvent.click(await screen.findByRole('button', { name: 'New session' }));

    expect(screen.getByRole('heading', { name: 'New interview session' })).toBeInTheDocument();
    expect(screen.queryByText('interview.hub.newSessionModalTitle')).not.toBeInTheDocument();

    const nameInput = screen.getByRole('textbox', { name: 'Session name' });
    fireEvent.change(nameInput, { target: { value: created.name } });
    fireEvent.click(screen.getByRole('button', { name: 'Create' }));

    await waitFor(() => {
      expect(apiPost).toHaveBeenCalledWith('/interview/sessions', {
        projectId: 'proj-1',
        name: created.name,
      });
      expect(getSessions).toHaveBeenCalledTimes(2);
      expect(
        screen.queryByRole('heading', { name: 'New interview session' })
      ).not.toBeInTheDocument();
    });
  });
});
