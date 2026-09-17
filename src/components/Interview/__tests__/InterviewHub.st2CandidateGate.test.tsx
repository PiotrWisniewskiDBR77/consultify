/**
 * @vitest-environment jsdom
 *
 * ST-2 (DEC-540 / U-09) rollout-gate integration test for InterviewHub.
 *
 * Wpis 75 P2: the five `if (st2CandidateCardEnabled) { … return; }` guards in
 * InterviewHub.tsx must actually change behaviour. CTO measured that deleting
 * ALL of them left the existing suite green (35/35) — this test is the missing
 * net. It drives a REAL jump action (double-click an Initiatives-tab row) and
 * asserts:
 *   - flag ON  → `navigate` is NOT called and the in-module
 *                `InterviewCandidateInbox` is mounted (row stays in Interview);
 *   - flag OFF → `navigate` IS called with the exact same path as today
 *                (`/initiatives?open=<id>&mode=doc`).
 * Removing any guard on this jump turns the ON case red.
 */

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { V8InterviewApi } from '@/services/api/v8/interview';

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
  navigateSpy,
  flagState,
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
  navigateSpy: vi.fn(),
  // Toggled per-test: drives the mocked isSt2CandidateCardEnabled().
  flagState: { enabled: false },
}));

// The gate under test. InterviewHub reads the flag exclusively through this
// helper, so overriding it here is the single switch for ON/OFF.
vi.mock('@/utils/st2CandidateCardFlag', () => ({
  isSt2CandidateCardEnabled: () => flagState.enabled,
}));

// Capture navigate() calls while keeping the real router primitives
// (MemoryRouter / useSearchParams) that InterviewHub depends on.
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

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

// InterviewHub calls useAppStore() (no selector); InterviewCandidateInbox calls
// useAppStore((s) => s.currentUser). Support both shapes.
const APP_STORE_STATE = {
  currentProjectId: 'proj-1' as string | null,
  setCurrentProjectId,
  currentOrganization: { id: 'org-1', name: 'Acme' },
  currentUser: { id: 'user-1', firstName: 'Test', lastName: 'User', email: 't@e.com', role: 'ADMIN' },
  setInterviewBreadcrumbs,
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

// A single interview-sourced initiative so the Initiatives tab renders one row
// whose double-click is the gated jump action.
const INITIATIVE_ROW = {
  id: 'init-gate-1',
  // Lowercase kebab token, not English prose: the J0 ratchet (K4obj) counts
  // `title`/`name` literals in staged files too, and treats this shape as a
  // technical value — the row only has to be findable, not readable.
  title: 'st2-gate-row',
  name: 'st2-gate-row',
  status: 'DRAFT',
  source: 'interview_insight',
  createdAt: '2026-09-01T00:00:00.000Z',
  updatedAt: '2026-09-02T00:00:00.000Z',
};

const renderHub = () =>
  render(
    <MemoryRouter initialEntries={['/interview?tab=my_assignments']}>
      <InterviewHub />
    </MemoryRouter>
  );

/** Click the Initiatives tab and wait for the seeded row to appear. */
const openInitiativesTabWithRow = async () => {
  const initiativesTab = await screen.findByRole('tab', { name: /Initiatives/i });
  fireEvent.click(initiativesTab);
  await waitFor(() => expect(initiativesTab).toHaveAttribute('aria-selected', 'true'));
  // The title can render in both the table cell and the preview pane; the row
  // cell is the double-click target, so take the first match deterministically.
  const matches = await screen.findAllByText('st2-gate-row');
  return matches[0];
};

beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockImplementation(async (path: string) =>
    typeof path === 'string' && path.startsWith('/initiatives?') ? [INITIATIVE_ROW] : []
  );
  apiPost.mockReset();
  apiPost.mockResolvedValue({});
  getSessions.mockReset();
  getSessions.mockResolvedValue({ sessions: [] });
  listInsights.mockReset();
  listInsights.mockResolvedValue({ insights: [] });
  getProjects.mockReset();
  getProjects.mockResolvedValue([{ id: 'proj-1', name: 'Project One' }]);
  createProject.mockReset();
  setCurrentProjectId.mockReset();
  getMyAssignments.mockReset();
  getMyAssignments.mockResolvedValue({ assignments: [] });
  getSession.mockReset();
  getSession.mockResolvedValue(null);
  setInterviewBreadcrumbs.mockReset();
  navigateSpy.mockReset();
  flagState.enabled = false;
  // The inbox (mounted only when the flag is ON) fetches the candidate list via
  // global fetch; resolve it to an empty inbox so it renders deterministically.
  globalThis.fetch = vi.fn(async () =>
    ({ ok: true, status: 200, json: async () => ({ candidates: [] }) }) as unknown as Response
  );
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('InterviewHub — ST-2 candidate-card rollout gate (DEC-540)', () => {
  it('flag ON: a row jump stays in-module — navigate NOT called and the candidate inbox is mounted', async () => {
    flagState.enabled = true;
    renderHub();

    const rowTitle = await openInitiativesTabWithRow();

    // The inbox is the in-module surface that replaces the jump; it must mount.
    expect(await screen.findByTestId('interview-candidate-inbox')).toBeInTheDocument();

    fireEvent.doubleClick(rowTitle);

    await waitFor(() => expect(rowTitle).toBeInTheDocument());
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('flag OFF: the same row jump navigates to the Initiatives module exactly as today', async () => {
    flagState.enabled = false;
    renderHub();

    // Open the Initiatives tab first (the inbox would render inside it), then
    // assert the flag keeps it unmounted and the row still jumps to the module.
    const rowTitle = await openInitiativesTabWithRow();
    expect(screen.queryByTestId('interview-candidate-inbox')).not.toBeInTheDocument();

    fireEvent.doubleClick(rowTitle);

    await waitFor(() =>
      expect(navigateSpy).toHaveBeenCalledWith(
        `/initiatives?open=${encodeURIComponent(INITIATIVE_ROW.id)}&mode=doc`
      )
    );
  });
});
