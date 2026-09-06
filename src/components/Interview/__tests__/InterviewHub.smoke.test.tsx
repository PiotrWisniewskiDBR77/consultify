/**
 * @vitest-environment jsdom
 *
 * Smoke tests for InterviewHub — asserts each of the tabs renders without
 * throwing. Heavy data/service dependencies are mocked so the tests exercise
 * the tab-render branches deterministically and offline.
 */

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import React from 'react';
import toast from 'react-hot-toast';
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
  getMyAssignments: vi.fn(async () => []),
  getSession: vi.fn(async () => null),
  appStoreState: { currentProjectId: 'proj-1' as string | null },
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
  getMyAssignments.mockReset();
  getMyAssignments.mockResolvedValue([]);
  getSession.mockReset();
  getSession.mockResolvedValue(null);
  setInterviewBreadcrumbs.mockReset();
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

  it('keeps legacy authoring available while a V8 insight failure is visible and never hidden by legacy fallback', async () => {
    listInsights.mockRejectedValue({ status: 503 });

    renderTab('insights');

    expect(await screen.findByRole('alert')).toHaveTextContent(/Failed to load insights/i);
    expect(apiGet).toHaveBeenCalledWith('/interview/sessions');
    expect(getSessions).not.toHaveBeenCalled();
    expect(apiGet).not.toHaveBeenCalledWith('/interview/insights');
  });

  it('karta-interview: falls back to the assignment\'s embedded session summary when both session-fetch endpoints 404, instead of erroring (dyżur 05.09)', async () => {
    // Reproduces the exact staging record measured live (ia_91d9fbca…,
    // template lib-tpl-digital-001 "Ocena Dojrzałości Cyfrowej"): the
    // assignment carries both `sessionId` and an embedded `session` summary,
    // but the dedicated session-fetch endpoints 404 for that id (orphaned/
    // stale session row on the backend — data this dyżur cannot touch).
    const assignment = {
      id: 'ia_91d9fbca-5463-48a4-8760-202afece725d',
      organizationId: 'org-1',
      projectId: 'proj-1',
      assigneeUserId: 'user-1',
      templateId: 'lib-tpl-digital-001',
      templateVersion: 1,
      status: 'in_progress',
      sessionId: 'f7847468-f35c-4552-b2f3-36e60f003d7b',
      dueAt: '2026-07-18T23:59:59.000Z',
      priority: 'medium',
      isTeamAssignment: false,
      createdBy: 'user-1',
      createdAt: '2026-04-30T18:17:04.091Z',
      updatedAt: '2026-08-09T07:00:01.893Z',
      template: {
        id: 'lib-tpl-digital-001',
        name: 'Ocena Dojrzałości Cyfrowej',
        description: 'Kompleksowy szablon do oceny poziomu dojrzałości cyfrowej organizacji.',
        category: 'digital',
      },
      session: {
        id: 'f7847468-f35c-4552-b2f3-36e60f003d7b',
        status: null,
        answeredQuestions: 0,
        totalQuestions: 0,
        completenessPercent: 0,
      },
      assignee: { id: 'user-1', name: 'Test User', email: 't@e.com' },
    };
    getMyAssignments.mockResolvedValue({ assignments: [assignment] });
    // Both dedicated session-fetch paths reject, exactly like the live 404s.
    getSession.mockRejectedValue(new Error('404'));
    apiGet.mockImplementation(async (path: string) =>
      path === `/interview/sessions/${assignment.sessionId}`
        ? Promise.reject(new Error('404'))
        : []
    );

    renderTab('my_assignments');
    const matches = await screen.findAllByText('Ocena Dojrzałości Cyfrowej');
    // TYP and NAZWA columns both show the template name — either instance
    // sits inside the same clickable row, so double-clicking the last one
    // (NAZWA cell) triggers the same onRowDoubleClick handler.
    fireEvent.doubleClick(matches[matches.length - 1]);

    await waitFor(() => {
      expect(getSession).toHaveBeenCalledWith(assignment.sessionId);
      expect(apiGet).toHaveBeenCalledWith(`/interview/sessions/${assignment.sessionId}`);
    });

    // The fix: fall back to the embedded `assignment.session` instead of
    // throwing. Proof of the fallback taking effect — the breadcrumb effect
    // fires with the opened document's derived name (no `name` on the
    // embedded session, so it uses the generic default), and no error toast
    // is ever raised for this flow.
    await waitFor(() => {
      expect(setInterviewBreadcrumbs).toHaveBeenCalledWith(
        expect.arrayContaining([expect.stringContaining('Interview Session')])
      );
    });
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('reaches the interview-creator-shell wizard from the Insights tab "New insight" button (DEC-2026-08-25-67, DEC-350)', async () => {
    renderTab('my_assignments');
    const insightsTab = await screen.findByRole('tab', { name: /Insights/i });
    fireEvent.click(insightsTab);
    await waitFor(() => expect(insightsTab).toHaveAttribute('aria-selected', 'true'));

    const newInsightButton = await screen.findByRole('button', { name: 'New insight' });
    expect(newInsightButton).toBeEnabled();
    fireEvent.click(newInsightButton);

    // Both the stepped shell and the legacy fallback share the WizardStepper
    // labels, so "Define" alone would pass either way. The "What will be
    // created" scope band is exclusive to the WizardModal (creatorShellEnabled)
    // branch — its presence is the actual proof we reached the approved
    // interview-creator-shell screen, not the pre-03.09 legacy dialog.
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('AI Insight Creator');
    expect(within(dialog).getByText('Define')).toBeInTheDocument();
    expect(within(dialog).getByText(/What will be created/i)).toBeInTheDocument();
  });

  it('exposes the shared project create control in the new-session modal for a zero-project tenant', async () => {
    appStoreState.currentProjectId = null;
    getProjects.mockResolvedValue([]);

    renderTab('sessions');
    fireEvent.click(await screen.findByRole('button', { name: 'New session' }));

    // 05.09.2026: podział na projekty = fala 2 (decyzja właściciela) — project
    // is optional here now (label lost the asterisk, `RequiredProjectPicker`
    // gets `optional`), and the Create button is no longer gated on it: a
    // name is pre-filled when the modal opens, so Create is enabled even for
    // a zero-project tenant. `handleConfirmNewSession` still calls
    // `ensureProjectId()` and gracefully toasts if no project can be
    // resolved at all — that safety net is covered separately below.
    expect(await screen.findByLabelText('Project')).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'New project name' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create project' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create' })).not.toBeDisabled();

    fireEvent.change(screen.getByRole('textbox', { name: 'New project name' }), {
      target: { value: 'Shared project' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create project' }));
    await waitFor(() => expect(createProject).toHaveBeenCalledWith({ name: 'Shared project' }));
    expect(setCurrentProjectId).toHaveBeenCalledWith('proj-new');
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
    apiGet.mockImplementation(async (path: string) =>
      path === '/interview/sessions' ? [created] : []
    );
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
      expect(apiGet).toHaveBeenCalledWith('/interview/sessions');
      expect(
        screen.queryByRole('heading', { name: 'New interview session' })
      ).not.toBeInTheDocument();
    });
  });

  it('Znalezisko 1.1-Z1: Wnioski TYP chip shows the real analysis-mode label, not a silent "Executive Summary" fallback', async () => {
    // Regression for a bug measured live on /interview?tab=insights: insights
    // whose promptType comes from `InsightAnalysisMode` (contradiction_scan,
    // material_quality_scan, …) had no entry in InterviewHub's
    // `getInsightTypeConfig` configs map, so `configs[type] || configs.summary`
    // silently fell back to the "Executive Summary" config for an unrelated
    // insight — same misrender whether the UI language was en or pl (the pl
    // case additionally showed English text, since the inline `t()` fallback
    // was hardcoded to `.en`). Fixed by adding the missing config entries and
    // by making the `t()` fallback language-aware.
    listInsights.mockResolvedValue({
      insights: [
        {
          id: 'seed_ri_insight_material_quality',
          title: 'Material quality scan: evidence completeness',
          promptType: 'material_quality_scan',
          status: 'completed',
          createdAt: '2026-08-23T00:00:00.000Z',
        },
        {
          id: 'seed_ri_insight_generating',
          title: 'Generating state sample: contradiction scan',
          promptType: 'contradiction_scan',
          status: 'generating',
          createdAt: '2026-08-25T00:00:00.000Z',
        },
      ],
    });

    renderTab('my_assignments');
    const insightsTab = await screen.findByRole('tab', { name: /Insights/i });
    fireEvent.click(insightsTab);
    await waitFor(() => expect(insightsTab).toHaveAttribute('aria-selected', 'true'));

    expect(await screen.findByText('Material quality scan')).toBeInTheDocument();
    expect(await screen.findByText('Contradiction scan')).toBeInTheDocument();
    // The defect this guards against: both used to render as this instead.
    expect(screen.queryByText('Executive Summary')).not.toBeInTheDocument();
  });
});
