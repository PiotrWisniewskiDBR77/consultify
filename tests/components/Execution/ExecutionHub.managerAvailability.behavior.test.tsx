/**
 * @vitest-environment jsdom
 */

import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => vi.fn() };
});

const { getManagerProblems, getInitiatives } = vi.hoisted(() => ({
  getManagerProblems: vi.fn(),
  getInitiatives: vi.fn(async () => []),
}));

vi.mock('react-i18next', () => {
  const t = (_key: string, fallback?: string) => fallback ?? _key;
  return {
    initReactI18next: { type: '3rdParty', init: () => undefined },
    useTranslation: () => ({ t, i18n: { language: 'en' } }),
  };
});
vi.mock('@/i18n', () => ({ default: {} }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/components/Execution/executionFeatureFlags', () => ({
  isExecutionFlagEnabled: () => false,
}));
vi.mock('@/store/useAppStore', () => {
  const state = {
    currentProjectId: null,
    fullSessionData: null,
    currentOrganization: { id: 'org-a', name: 'Org A' },
    currentUser: { id: 'admin-a', role: 'ADMIN', name: 'Test Admin' },
    toggleChatCollapse: vi.fn(),
    isChatCollapsed: false,
  };
  return {
    useAppStore: (selector?: (value: any) => unknown) => (selector ? selector(state) : state),
  };
});
vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector: (state: any) => unknown) => selector({ addMessage: vi.fn() }),
}));
vi.mock('@/store/useInitiativeRefreshStore', () => ({
  useInitiativeRefreshStore: (selector: (state: any) => unknown) => selector({ version: 0 }),
}));
vi.mock('@/hooks/useOpenChatWithContext', () => ({ useOpenChatWithContext: () => vi.fn() }));
vi.mock('@/hooks/useOrganizationMemberNames', () => ({
  useOrganizationMemberNames: () => (id: string) => id,
}));
vi.mock('@/components/shared/PreviewPane/useJedenPanel', () => ({
  useJedenPanel: () => ({
    zamkniety: true,
    dokOtwarty: false,
    otworz: vi.fn(),
    pokazPanel: vi.fn(),
  }),
}));
vi.mock('@/components/shared/PreviewPane/JedenPrawyPanel', () => ({
  JedenPrawyPanel: ({ rekord }: { rekord?: React.ReactNode }) => <>{rekord}</>,
}));
vi.mock('@/components/shared/PreviewPane/PreviewPaneAside', () => ({
  PreviewPaneAside: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/shared/embeddedModuleChatHost', () => ({
  useEmbeddedModuleChatHost: () => false,
  registerEmbeddedModuleChatHost: () => () => undefined,
}));
vi.mock('@/components/standard/StandardTable', async () => {
  const actual = await vi.importActual<any>('@/components/standard/StandardTable');
  return {
    ...actual,
    StandardTable: ({ data }: { data: Array<Record<string, unknown>> }) => (
      <div data-testid="manager-table-rows">{JSON.stringify(data)}</div>
    ),
  };
});

vi.mock('@/services/api', () => ({
  API_URL: 'http://example.test/api',
  clearGlobalTransportFailure: vi.fn(),
  getHeaders: () => ({}),
  resetAuthLoopGuard: vi.fn(),
  shouldAllowDemoData: () => false,
  Api: {
    getInitiatives,
    getTasks: vi.fn(async () => []),
    raidList: vi.fn(async () => []),
    get: vi.fn(async () => []),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));
vi.mock('@/services/api/v8/execution-control', () => ({
  shouldFallbackToLegacyExecutionControl: () => false,
  V8ExecutionControlApi: {
    getRiskSignals: vi.fn(async () => ({ signals: [] })),
    getDelaySignals: vi.fn(async () => ({ signals: [] })),
    getOverspendSignals: vi.fn(async () => ({ signals: [] })),
    getManagerProblems,
    getTimelineWarnings: vi.fn(async () => ({ warnings: [], total: 0 })),
    getCapacityLevelingAlerts: vi.fn(async () => ({ alerts: [] })),
    getCapacityTimeline: vi.fn(async () => ({ weeks: [] })),
  },
}));
vi.mock('@/services/execution/resourcePlanApi', () => ({
  readExecutionResourcePlan: vi.fn(async () => ({ summary: null })),
}));
vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listExecutionCases: vi.fn(async () => ({ cases: [] })),
}));
vi.mock('@/services/executionWriteTruth', () => ({ refreshExecutionWriteTruth: vi.fn() }));
vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));
vi.mock('@/components/Execution/ExecutionActionCards', () => ({
  ExecutionActionCards: () => null,
}));
vi.mock('@/components/Execution/ExecutionWorkSurface', () => ({
  ExecutionWorkSurface: () => null,
}));
vi.mock('@/components/Execution/ExecutionResourcesSurface', () => ({
  ExecutionResourcesSurface: () => null,
}));
vi.mock('@/components/Execution/ExecutionControlSurface', () => ({
  ExecutionControlSurface: () => null,
}));
vi.mock('@/components/Execution/ExecutionReportsSurface', () => ({
  ExecutionReportsSurface: () => null,
}));
vi.mock('@/components/Execution/ExecutionSummaryOneLook', () => ({ default: () => null }));
vi.mock('@/components/Execution/RolloutTab', () => ({ RolloutTab: () => null }));
vi.mock('@/components/Initiatives/InitiativeDocumentView', () => ({
  InitiativeDocumentView: () => null,
}));
vi.mock('@/components/Initiatives/InitiativeCompactPanel', () => ({
  InitiativeCompactPanel: () => null,
}));
vi.mock('@/components/Reports/Wizard', () => ({ ReportGeneratorWizard: () => null }));

import { ExecutionHub } from '@/components/Execution/ExecutionHub';

const renderHub = (initialTab: 'list' | 'people_change') =>
  render(
    <MemoryRouter initialEntries={['/execution']}>
      <ExecutionHub initialTab={initialTab as never} />
    </MemoryRouter>
  );

describe('ExecutionHub protected manager lane availability', () => {
  beforeEach(() => {
    getManagerProblems.mockReset().mockResolvedValue({ data: { problems: [] } });
    getInitiatives.mockClear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }))
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('does not request any protected manager lane while Execution Bank is active', async () => {
    renderHub('list');
    await waitFor(() => expect(getInitiatives).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getManagerProblems).not.toHaveBeenCalled();
  });

  it('shows loading and then unavailable for denied manager lanes instead of factual zero', async () => {
    const rejectReads: Array<(reason: unknown) => void> = [];
    getManagerProblems.mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          rejectReads.push(reject);
        })
    );

    renderHub('people_change');
    expect(await screen.findByTestId('manager-lane-action-queue-total')).toHaveTextContent(
      'Loading'
    );
    rejectReads.forEach((reject) => reject(Object.assign(new Error('Forbidden'), { status: 403 })));

    await waitFor(() =>
      expect(screen.getByTestId('manager-lane-action-queue-total')).toHaveTextContent('Unavailable')
    );
    expect(screen.getByTestId('manager-lane-action-queue-total')).not.toHaveTextContent('0');
    expect(getManagerProblems).toHaveBeenCalledTimes(6);
  });

  it('renders factual zero only after all six manager reads prove an empty result', async () => {
    renderHub('people_change');

    await waitFor(() => expect(getManagerProblems).toHaveBeenCalledTimes(6));
    await waitFor(() =>
      expect(screen.getByTestId('manager-lane-action-queue-total')).toHaveTextContent('0')
    );
    expect(screen.getByTestId('manager-lane-action-queue-total')).not.toHaveTextContent(
      'Unavailable'
    );
  });

  it('marks a malformed successful manager payload unavailable instead of zero or loading forever', async () => {
    getManagerProblems.mockImplementation(async (laneId: string) => ({
      data: { problems: laneId === 'action-queue' ? [null] : [] },
    }));

    renderHub('people_change');

    await waitFor(() =>
      expect(screen.getByTestId('manager-lane-action-queue-total')).toHaveTextContent('Unavailable')
    );
    expect(screen.getByTestId('manager-lane-action-queue-total')).not.toHaveTextContent('0');
  });
});
