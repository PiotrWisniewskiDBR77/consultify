/**
 * @vitest-environment jsdom
 */

vi.unmock('react-router-dom');

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';

const { mutationFetch, getInitiatives, initiatives, executionCases } = vi.hoisted(() => ({
  mutationFetch: vi.fn(),
  getInitiatives: vi.fn(),
  initiatives: [
    {
      id: 'initiative-a',
      name: 'Alpha',
      description: 'Forecast case',
      status: 'IN_EXECUTION',
      projectId: 'project-one',
      priority: 'High',
      progress: null,
      baselineStartDate: '2028-01-10',
      baselineEndDate: '2028-02-10',
      plannedStartDate: '2028-01-20',
      plannedEndDate: '2028-03-20',
      actualEndDate: null,
      updatedAt: '2028-01-20T10:00:00Z',
    },
    {
      id: 'initiative-b',
      name: 'Beta',
      description: 'Unknown schedule',
      status: 'IN_EXECUTION',
      projectId: null,
      priority: 'Medium',
      progress: null,
      baselineEndDate: null,
      plannedEndDate: 'not-a-date',
      actualEndDate: null,
      updatedAt: '2028-01-19T10:00:00Z',
    },
    {
      id: 'initiative-c',
      name: 'Gamma',
      description: 'Closed case',
      status: 'CLOSED',
      projectId: 'project-two',
      priority: 'Low',
      progress: 100,
      baselineStartDate: '2028-02-01',
      baselineEndDate: '2028-02-28',
      plannedStartDate: '2028-02-01',
      plannedEndDate: '2028-03-10',
      actualStartDate: '2028-02-02',
      actualEndDate: '2028-02-29',
      updatedAt: '2028-01-18T10:00:00Z',
    },
    {
      id: 'initiative-d',
      name: 'Delta',
      description: 'Initiative without a case',
      status: 'APPROVED',
      projectId: 'project-one',
      priority: 'Medium',
      progress: null,
      baselineEndDate: null,
      plannedEndDate: null,
      actualEndDate: null,
      updatedAt: '2028-01-17T10:00:00Z',
    },
  ],
  executionCases: [
    {
      executionCaseId: 'case-a',
      initiativeId: 'initiative-a',
      projectId: 'project-one',
      projectTitle: 'North plant',
      version: 4,
      state: 'ACTIVE',
      executionManagerId: 'owner-one',
      executionPhase: 'DELIVERY',
      deliveryProfile: 'STANDARD',
      forecastStartDate: '2028-01-25',
      forecastEndDate: '2028-03-01',
      forecastObservedAt: '2028-01-15T12:00:00Z',
      forecastSource: 'execution-case',
    },
    {
      executionCaseId: 'case-b',
      initiativeId: 'initiative-b',
      version: 2,
      state: 'ACTIVE',
      executionManagerId: 'owner-two',
    },
    {
      executionCaseId: 'case-c',
      initiativeId: 'initiative-c',
      projectId: 'project-two',
      projectTitle: 'South plant',
      version: 7,
      state: 'CLOSED',
      executionManagerId: 'owner-one',
    },
  ],
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
  isExecutionFlagEnabled: (flag: string) => flag === 'fourButtons',
}));
vi.mock('@/store/useAppStore', () => {
  const state = {
    currentProjectId: null,
    fullSessionData: null,
    currentUser: { id: 'user-1', role: 'ADMIN', name: 'Test User' },
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
  useOrganizationMemberNames: () => (id: string) =>
    ({ 'owner-one': 'Marek Nowak', 'owner-two': 'Anna Kowalska' } as Record<string, string>)[id] ??
    null,
  memberNameOrUnknown: (resolver: ((id: string) => string) | undefined, id: string) =>
    resolver?.(id) ?? 'Unknown user',
}));
vi.mock('@/components/shared/PreviewPane/useJedenPanel', () => ({
  useJedenPanel: () => ({
    zamkniety: false,
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
    post: mutationFetch,
    put: mutationFetch,
    delete: mutationFetch,
  },
}));
vi.mock('@/services/api/v8/execution-control', () => ({
  shouldFallbackToLegacyExecutionControl: () => false,
  V8ExecutionControlApi: {
    getRiskSignals: vi.fn(async () => ({ signals: [] })),
    getDelaySignals: vi.fn(async () => ({ signals: [] })),
    getOverspendSignals: vi.fn(async () => ({ signals: [] })),
    getManagerProblems: vi.fn(async () => ({ data: { problems: [] } })),
    getTimelineWarnings: vi.fn(async () => ({ warnings: [], total: 0 })),
    getCapacityLevelingAlerts: vi.fn(async () => ({ alerts: [] })),
    getCapacityTimeline: vi.fn(async () => ({ weeks: [] })),
  },
}));
vi.mock('@/services/execution/resourcePlanApi', () => ({
  readExecutionResourcePlan: vi.fn(async () => ({ summary: null })),
}));
vi.mock('@/services/initiatives-execution/runtimeApi', () => ({
  listExecutionCases: vi.fn(async () => ({ cases: executionCases })),
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

const visibleInitiativeIds = (renderer: 'table' | 'kanban' | 'calendar' | 'gantt') =>
  screen
    .getAllByTestId(new RegExp(`^execution-bank-${renderer}-item-`))
    .map((node) => node.getAttribute('data-initiative-id'));

const expectSameInitiatives = (
  renderer: 'table' | 'kanban' | 'calendar' | 'gantt',
  expected: string[]
) => {
  expect(visibleInitiativeIds(renderer).sort()).toEqual(expected.sort());
};

const LocationProbe = () => {
  const location = useLocation();
  return (
    <output data-testid="e1b-location">{`${location.pathname}${location.search}${location.hash}`}</output>
  );
};

const HistoryControls = () => {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>
        ←
      </button>
      <button type="button" onClick={() => navigate(1)}>
        →
      </button>
    </>
  );
};

describe('E1b Execution Bank views', () => {
  beforeEach(() => {
    mutationFetch.mockClear();
    getInitiatives.mockReset().mockResolvedValue(initiatives);
    localStorage.clear();
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 }))
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('E1b Bank renders one ordered Initiative set across table, kanban, calendar and gantt without writes', async () => {
    render(
      <MemoryRouter initialEntries={['/execution?tab=list&view=table&asOf=2028-01-31']}>
        <ExecutionHub />
      </MemoryRouter>
    );

    await screen.findByText('Alpha');
    fireEvent.click(screen.getByRole('radio', { name: 'All' }));
    const expected = ['initiative-a', 'initiative-c', 'initiative-b', 'initiative-d'];
    expect(visibleInitiativeIds('table')).toEqual(expected);

    fireEvent.click(screen.getByTestId('view-mode-kanban'));
    await waitFor(() => expectSameInitiatives('kanban', expected));
    fireEvent.click(screen.getByTestId('standard-kanban-card-initiative-b'));
    const preview = screen.getByTestId('execution-bank-preview');
    expect(preview).toHaveAttribute('data-initiative-id', 'initiative-b');
    expect(preview).not.toHaveAttribute('data-execution-case-id');
    expect(
      screen.queryByText(/Execution Case linked|No Execution Case linked/)
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('execution-bank-progress')).toHaveTextContent(
      'Progress not reported'
    );
    expect(screen.queryByText(/PROGRESS_MISSING/)).not.toBeInTheDocument();
    expect(screen.queryByText(/2028-01-31T00:00:00\.000Z/)).not.toBeInTheDocument();
    expect(within(preview).queryByText(/^UNKNOWN$/)).not.toBeInTheDocument();
    expect(within(preview).queryByText(/^—$/)).not.toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Owner')).toBeInTheDocument();
    expect(screen.getByText('Execution phase')).toBeInTheDocument();
    expect(document.querySelector('[data-preview-block="relations"]')).toBeNull();

    fireEvent.click(screen.getByTestId('view-mode-calendar'));
    await waitFor(() => expectSameInitiatives('calendar', expected));
    expect(screen.getByTestId('execution-bank-unscheduled')).toHaveTextContent('Beta');

    fireEvent.click(screen.getByTestId('view-mode-timeline'));
    await waitFor(() => expectSameInitiatives('gantt', expected));
    expect(screen.getByTestId('execution-bank-gantt-axis')).toHaveAttribute(
      'data-window-end',
      '2028-04-01'
    );
    expect(screen.getByTestId('execution-bank-gantt-bar-forecast-initiative-a')).toHaveAttribute(
      'data-end',
      '2028-03-01'
    );
    expect(screen.getByTestId('execution-bank-gantt-bar-actual-initiative-c')).toHaveAttribute(
      'data-end',
      '2028-02-29'
    );
    expect(screen.getByTestId('execution-bank-variance-initiative-a')).toHaveTextContent('20 days');
    expect(screen.getByTestId('execution-bank-variance-initiative-a')).toHaveTextContent(
      'forecast'
    );
    expect(screen.getByTestId('execution-bank-variance-initiative-c')).toHaveTextContent('1 day');
    expect(screen.getByTestId('execution-bank-variance-initiative-c')).toHaveTextContent('actual');
    expect(mutationFetch).not.toHaveBeenCalled();
  });

  it('wires five reachable Bank filters to the same set used by every view, including no-project', async () => {
    render(
      <MemoryRouter initialEntries={['/execution?tab=list&view=table&asOf=2028-01-31']}>
        <ExecutionHub />
      </MemoryRouter>
    );

    await screen.findByText('Alpha');
    fireEvent.click(screen.getByRole('radio', { name: 'All' }));
    const project = screen.getByRole('button', { name: 'Bank project filter' });
    const status = screen.getByRole('button', { name: 'Bank status filter' });
    const owner = screen.getByRole('button', { name: 'Bank owner filter' });
    const priority = screen.getByRole('button', { name: 'Bank priority filter' });
    const time = screen.getByRole('button', { name: 'Bank time filter' });
    expect(screen.getByTestId('execution-bank-filter-controls').querySelector('select')).toBeNull();

    fireEvent.click(project);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'No project' }));
    await waitFor(() => expect(visibleInitiativeIds('table')).toEqual(['initiative-b']));
    fireEvent.click(screen.getByTestId('view-mode-kanban'));
    await waitFor(() => expect(visibleInitiativeIds('kanban')).toEqual(['initiative-b']));

    fireEvent.click(project);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'All projects' }));
    fireEvent.click(status);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Closed' }));
    await waitFor(() => expect(visibleInitiativeIds('kanban')).toEqual(['initiative-c']));

    fireEvent.click(status);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'All statuses' }));
    fireEvent.click(owner);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Marek Nowak' }));
    await waitFor(() =>
      expect(visibleInitiativeIds('kanban').sort()).toEqual(['initiative-a', 'initiative-c'])
    );

    fireEvent.click(owner);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'All owners' }));
    fireEvent.click(priority);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'High' }));
    await waitFor(() => expect(visibleInitiativeIds('kanban')).toEqual(['initiative-a']));

    fireEvent.click(priority);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'All priorities' }));
    fireEvent.click(time);
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Next 30 days' }));
    await waitFor(() => expect(visibleInitiativeIds('kanban')).toEqual(['initiative-c']));
    expect(mutationFetch).not.toHaveBeenCalled();
  });

  it('hydrates the requested Bank view and native selection from a cold query and keeps selection when the view changes', async () => {
    render(
      <MemoryRouter
        initialEntries={['/execution?tab=list&view=calendar&selection=case-b&asOf=2028-01-31']}
      >
        <ExecutionHub />
      </MemoryRouter>
    );

    expect(await screen.findByTestId('execution-bank-view-calendar')).toBeInTheDocument();
    expect(await screen.findByTestId('execution-bank-preview')).toHaveAttribute(
      'data-initiative-id',
      'initiative-b'
    );
    expect(screen.getByTestId('execution-bank-preview')).not.toHaveAttribute(
      'data-execution-case-id'
    );
    expect(screen.getByTestId('execution-bank-unscheduled')).toHaveTextContent('Beta');
    fireEvent.click(screen.getByTestId('view-mode-timeline'));
    expect(await screen.findByTestId('execution-bank-view-gantt')).toBeInTheDocument();
    expect(screen.getByTestId('execution-bank-preview')).toHaveAttribute(
      'data-initiative-id',
      'initiative-b'
    );
    expect(mutationFetch).not.toHaveBeenCalled();
  });

  it('selects an Initiative without a Case and restores that native selection after a view switch and reload', async () => {
    const firstMount = render(
      <MemoryRouter initialEntries={['/execution?tab=list&view=table&asOf=2028-01-31#bank']}>
        <ExecutionHub />
        <LocationProbe />
      </MemoryRouter>
    );

    await screen.findByText('Alpha');
    fireEvent.click(screen.getByRole('radio', { name: 'All' }));
    fireEvent.click(await screen.findByText('Delta'));
    expect(await screen.findByTestId('execution-bank-preview')).toHaveAttribute(
      'data-initiative-id',
      'initiative-d'
    );
    expect(screen.getByTestId('execution-bank-preview')).not.toHaveAttribute(
      'data-execution-case-id'
    );
    await waitFor(() => {
      const query = screen.getByTestId('e1b-location').textContent ?? '';
      expect(new URLSearchParams(query.split('?')[1]?.split('#')[0] ?? '').get('selection')).toBe(
        'initiative-d'
      );
    });

    fireEvent.click(screen.getByTestId('view-mode-kanban'));
    expect(await screen.findByTestId('execution-bank-view-kanban')).toBeInTheDocument();
    expect(screen.getByTestId('execution-bank-preview')).toHaveAttribute(
      'data-initiative-id',
      'initiative-d'
    );
    await waitFor(() =>
      expect(screen.getByTestId('e1b-location')).toHaveTextContent('view=kanban')
    );
    const reloadUrl = screen.getByTestId('e1b-location').textContent ?? '';

    firstMount.unmount();
    render(
      <MemoryRouter initialEntries={[reloadUrl]}>
        <ExecutionHub />
      </MemoryRouter>
    );
    expect(await screen.findByTestId('execution-bank-view-kanban')).toBeInTheDocument();
    expect(await screen.findByTestId('execution-bank-preview')).toHaveAttribute(
      'data-initiative-id',
      'initiative-d'
    );
    expect(screen.getByTestId('execution-bank-preview')).not.toHaveAttribute(
      'data-execution-case-id'
    );
    expect(mutationFetch).not.toHaveBeenCalled();
  });

  it('refetches the same Initiative evidence at controlled asOf on browser Back and Forward', async () => {
    getInitiatives.mockImplementation(async (_projectId, options) => {
      const asOf = String(options?.asOf);
      const forecastEnd = asOf.startsWith('2028-01-31') ? '2028-03-01' : '2028-03-10';
      return initiatives.map((initiative) =>
        initiative.id === 'initiative-a'
          ? {
              ...initiative,
              progressEvidence: {
                value: 42,
                observedAt: '2028-01-15T12:00:00.000Z',
                asOf,
                source: {
                  system: 'initiative_history',
                  recordId: 'progress-42',
                  formulaId: null,
                  formulaVersion: null,
                },
                completeness: 'KNOWN',
                staleness: 'UNKNOWN',
                reason: 'FRESHNESS_POLICY_MISSING',
              },
              forecastEndEvidence: {
                value: forecastEnd,
                observedAt: '2028-01-15T12:00:00.000Z',
                asOf,
                source: {
                  system: 'initiative_history',
                  recordId: `forecast-${forecastEnd}`,
                  formulaId: null,
                  formulaVersion: null,
                },
                completeness: 'KNOWN',
                staleness: 'UNKNOWN',
                reason: 'FRESHNESS_POLICY_MISSING',
              },
            }
          : initiative
      );
    });

    render(
      <MemoryRouter
        initialEntries={[
          '/execution',
          '/execution?tab=list&view=table&asOf=2028-01-31',
          '/execution?tab=list&view=table&asOf=2028-03-31',
        ]}
        initialIndex={2}
      >
        <ExecutionHub />
        <HistoryControls />
      </MemoryRouter>
    );

    await screen.findByText('Alpha');
    await waitFor(() =>
      expect(getInitiatives).toHaveBeenCalledWith(undefined, {
        asOf: '2028-03-31T00:00:00.000Z',
        includeExecutionEvidence: true,
      })
    );
    expect(screen.getByTestId('execution-bank-variance-initiative-a')).toHaveTextContent('29 days');

    fireEvent.click(screen.getByRole('button', { name: '←' }));
    await waitFor(() =>
      expect(getInitiatives).toHaveBeenCalledWith(undefined, {
        asOf: '2028-01-31T00:00:00.000Z',
        includeExecutionEvidence: true,
      })
    );
    await waitFor(() =>
      expect(screen.getByTestId('execution-bank-variance-initiative-a')).toHaveTextContent(
        '20 days'
      )
    );

    fireEvent.click(screen.getByRole('button', { name: '←' }));
    await waitFor(() => {
      const currentRead = getInitiatives.mock.calls.find(
        ([, options]) =>
          options?.asOf !== '2028-01-31T00:00:00.000Z' &&
          options?.asOf !== '2028-03-31T00:00:00.000Z'
      );
      expect(currentRead?.[1]?.includeExecutionEvidence).toBe(true);
      expect(Date.parse(String(currentRead?.[1]?.asOf))).toBeLessThanOrEqual(Date.now());
    });

    fireEvent.click(screen.getByRole('button', { name: '→' }));
    await waitFor(() =>
      expect(screen.getByTestId('execution-bank-variance-initiative-a')).toHaveTextContent(
        '20 days'
      )
    );
    fireEvent.click(screen.getByRole('button', { name: '→' }));
    await waitFor(() =>
      expect(screen.getByTestId('execution-bank-variance-initiative-a')).toHaveTextContent(
        '29 days'
      )
    );
  });
});
