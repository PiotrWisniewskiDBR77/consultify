/**
 * @vitest-environment jsdom
 */

vi.unmock('react-router-dom');

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';

const { mutationFetch, initiatives, executionCases } = vi.hoisted(() => ({
  mutationFetch: vi.fn(),
  initiatives: [
    {
      id: 'initiative-a', name: 'Alpha', description: 'Forecast case', status: 'IN_EXECUTION',
      priority: 'High', progress: null, baselineEndDate: '2028-02-10',
      plannedEndDate: '2028-03-20', actualEndDate: null, updatedAt: '2028-01-20T10:00:00Z',
    },
    {
      id: 'initiative-b', name: 'Beta', description: 'Unknown schedule', status: 'IN_EXECUTION',
      priority: 'Medium', progress: null, baselineEndDate: null,
      plannedEndDate: 'not-a-date', actualEndDate: null, updatedAt: '2028-01-19T10:00:00Z',
    },
    {
      id: 'initiative-c', name: 'Gamma', description: 'Closed case', status: 'CLOSED',
      priority: 'Low', progress: 100, baselineEndDate: '2028-02-28',
      plannedEndDate: '2028-03-10', actualEndDate: '2028-02-29', updatedAt: '2028-01-18T10:00:00Z',
    },
  ],
  executionCases: [
    {
      executionCaseId: 'case-a', initiativeId: 'initiative-a', version: 4, state: 'ACTIVE',
      executionPhase: 'DELIVERY', deliveryProfile: 'STANDARD', forecastEndDate: '2028-03-01',
      forecastObservedAt: '2028-01-15T12:00:00Z', forecastSource: 'execution-case',
    },
    { executionCaseId: 'case-b', initiativeId: 'initiative-b', version: 2, state: 'ACTIVE' },
    { executionCaseId: 'case-c', initiativeId: 'initiative-c', version: 7, state: 'CLOSED' },
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
  isExecutionFlagEnabled: () => false,
}));
vi.mock('@/store/useAppStore', () => {
  const state = {
    currentProjectId: null,
    fullSessionData: null,
    currentUser: { id: 'user-1', role: 'ADMIN', name: 'Test User' },
    toggleChatCollapse: vi.fn(),
    isChatCollapsed: false,
  };
  return { useAppStore: (selector?: (value: any) => unknown) => (selector ? selector(state) : state) };
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
  useJedenPanel: () => ({ zamkniety: true, dokOtwarty: false, otworz: vi.fn(), pokazPanel: vi.fn() }),
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
  clearGlobalTransportFailure: vi.fn(), getHeaders: () => ({}), resetAuthLoopGuard: vi.fn(),
  shouldAllowDemoData: () => false,
  Api: {
    getInitiatives: vi.fn(async () => initiatives), getTasks: vi.fn(async () => []),
    raidList: vi.fn(async () => []), get: vi.fn(async () => []),
    post: mutationFetch, put: mutationFetch, delete: mutationFetch,
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
vi.mock('@/components/Execution/ExecutionActionCards', () => ({ ExecutionActionCards: () => null }));
vi.mock('@/components/Execution/ExecutionWorkSurface', () => ({ ExecutionWorkSurface: () => null }));
vi.mock('@/components/Execution/ExecutionResourcesSurface', () => ({ ExecutionResourcesSurface: () => null }));
vi.mock('@/components/Execution/ExecutionControlSurface', () => ({ ExecutionControlSurface: () => null }));
vi.mock('@/components/Execution/ExecutionReportsSurface', () => ({ ExecutionReportsSurface: () => null }));
vi.mock('@/components/Execution/ExecutionSummaryOneLook', () => ({ default: () => null }));
vi.mock('@/components/Execution/RolloutTab', () => ({ RolloutTab: () => null }));
vi.mock('@/components/Initiatives/InitiativeDocumentView', () => ({ InitiativeDocumentView: () => null }));
vi.mock('@/components/Initiatives/InitiativeCompactPanel', () => ({ InitiativeCompactPanel: () => null }));
vi.mock('@/components/Reports/Wizard', () => ({ ReportGeneratorWizard: () => null }));

import { ExecutionHub } from '@/components/Execution/ExecutionHub';

const visiblePairNodes = (renderer: 'table' | 'kanban' | 'calendar' | 'gantt') =>
  screen.getAllByTestId(new RegExp(`^execution-bank-${renderer}-item-`));

const pairFromNode = (node: HTMLElement) => [
      node.getAttribute('data-initiative-id'),
      node.getAttribute('data-execution-case-id'),
    ];

const visiblePairOrder = (renderer: 'table' | 'kanban' | 'calendar' | 'gantt') =>
  visiblePairNodes(renderer).map(pairFromNode);

const pairOrder = () => visiblePairOrder('table');


const LocationProbe = () => {
  const location = useLocation();
  return <output data-testid="reviewer-location">{`${location.pathname}${location.search}${location.hash}`}</output>;
};

const HistoryControls = () => {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate(-1)}>reviewer-back</button>
      <button type="button" onClick={() => navigate(1)}>reviewer-forward</button>
    </>
  );
};

describe('E1b independent reviewer gaps', () => {
  beforeEach(() => {
    mutationFetch.mockClear();
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('keeps a canonical Initiative without an Execution Case visible without fabricating a case identity', async () => {
    initiatives.push({
      id: 'initiative-without-case', name: 'No native case', description: 'Handoff is optional',
      status: 'APPROVED', priority: 'Medium', progress: null, baselineEndDate: null,
      plannedEndDate: null, actualEndDate: null, updatedAt: '2028-01-21T10:00:00Z',
    });
    try {
      render(<MemoryRouter initialEntries={['/execution?tab=list&view=table&asOf=2028-01-31']}><ExecutionHub /></MemoryRouter>);
      await screen.findByText('Alpha');
      fireEvent.click(screen.getByRole('radio', { name: 'All' }));
      await waitFor(() => {
        expect(pairOrder()).toContainEqual(['initiative-without-case', null]);
      });
      expect(screen.getByText('No native case')).toBeInTheDocument();
    } finally {
      initiatives.pop();
    }
  });

  it('writes a user-selected native case to query so reload can restore it', async () => {
    render(
      <MemoryRouter initialEntries={['/execution?tab=list&view=table&asOf=2028-01-31#bank']}>
        <ExecutionHub />
        <LocationProbe />
      </MemoryRouter>
    );
    await screen.findByText('Alpha');
    fireEvent.click(screen.getByText('Alpha'));
    await waitFor(() => {
      const location = screen.getByTestId('reviewer-location').textContent ?? '';
      expect(new URLSearchParams(location.split('?')[1]?.split('#')[0] ?? '').get('selection')).toBe('case-a');
      expect(location.endsWith('#bank')).toBe(true);
    });
  });

  it('selects and restores a canonical Initiative without inventing an Execution Case identity', async () => {
    initiatives.push({
      id: 'initiative-without-case-action', name: 'Selectable without case',
      description: 'Native Initiative-only row', status: 'IN_EXECUTION', priority: 'Medium',
      progress: null, baselineEndDate: null, plannedEndDate: null, actualEndDate: null,
      updatedAt: '2028-01-21T10:00:00Z',
    });
    try {
      const mounted = render(
        <MemoryRouter initialEntries={['/execution?tab=list&view=table&asOf=2028-01-31#bank']}>
          <ExecutionHub />
          <LocationProbe />
        </MemoryRouter>
      );
      await screen.findByText('Alpha');
      fireEvent.click(screen.getByRole('radio', { name: 'All' }));
      const tableItem = await screen.findByTestId(
        'execution-bank-table-item-initiative:initiative-without-case-action'
      );
      fireEvent.click(tableItem);
      expect(tableItem.closest('tr')).toHaveAttribute('aria-selected', 'true');
      expect(await screen.findByTestId('execution-bank-preview')).toHaveAttribute(
        'data-initiative-id',
        'initiative-without-case-action'
      );
      expect(screen.getByTestId('execution-bank-preview')).not.toHaveAttribute(
        'data-execution-case-id'
      );
      fireEvent.click(screen.getByTestId('view-mode-kanban'));
      expect(await screen.findByTestId('execution-bank-view-kanban')).toBeInTheDocument();
      expect(screen.getByTestId('execution-bank-preview')).toHaveAttribute(
        'data-initiative-id',
        'initiative-without-case-action'
      );
      const location = screen.getByTestId('reviewer-location').textContent ?? '';
      expect(new URLSearchParams(location.split('?')[1]?.split('#')[0] ?? '').get('selection')).toBe(
        'initiative:initiative-without-case-action'
      );
      expect(location.endsWith('#bank')).toBe(true);

      mounted.unmount();
      render(
        <MemoryRouter initialEntries={[location]}>
          <ExecutionHub />
        </MemoryRouter>
      );
      expect(await screen.findByTestId('execution-bank-preview')).toHaveAttribute(
        'data-initiative-id',
        'initiative-without-case-action'
      );
      expect(screen.getByTestId('execution-bank-preview')).not.toHaveAttribute(
        'data-execution-case-id'
      );
      expect(mutationFetch).not.toHaveBeenCalled();
    } finally {
      initiatives.pop();
    }
  });

  it('rehydrates controlled asOf when browser history changes the query', async () => {
    render(
      <MemoryRouter
        initialEntries={[
          '/execution?tab=list&view=table&asOf=2028-01-31#january',
          '/execution?tab=list&view=table&asOf=2028-03-31#march',
        ]}
        initialIndex={1}
      >
        <ExecutionHub />
        <HistoryControls />
        <LocationProbe />
      </MemoryRouter>
    );
    expect(await screen.findByTestId('execution-bank-view-table')).toHaveAttribute(
      'data-as-of',
      '2028-03-31T00:00:00.000Z'
    );
    fireEvent.click(screen.getByRole('button', { name: 'reviewer-back' }));
    await waitFor(() => expect(screen.getByTestId('reviewer-location')).toHaveTextContent('#january'));
    await waitFor(() =>
      expect(screen.getByTestId('execution-bank-view-table')).toHaveAttribute(
        'data-as-of',
        '2028-01-31T00:00:00.000Z'
      )
    );
    fireEvent.click(screen.getByRole('button', { name: 'reviewer-forward' }));
    await waitFor(() => expect(screen.getByTestId('reviewer-location')).toHaveTextContent('#march'));
    await waitFor(() =>
      expect(screen.getByTestId('execution-bank-view-table')).toHaveAttribute(
        'data-as-of',
        '2028-03-31T00:00:00.000Z'
      )
    );
  });

  it('preserves one native pair multiset and the shared sort inside semantic groups', async () => {
    render(
      <MemoryRouter initialEntries={['/execution?tab=list&view=table&asOf=2028-01-31']}>
        <ExecutionHub />
      </MemoryRouter>
    );
    await screen.findByText('Alpha');
    fireEvent.click(screen.getByRole('radio', { name: 'All' }));
    const expected = visiblePairOrder('table').map((pair) => pair.join('/'));
    const expectedSet = [...expected].sort();
    expect(new Set(expected).size).toBe(expected.length);

    fireEvent.click(screen.getByTestId('view-mode-kanban'));
    await screen.findByTestId('execution-bank-view-kanban');
    const kanban = visiblePairOrder('kanban').map((pair) => pair.join('/'));
    expect([...kanban].sort()).toEqual(expectedSet);
    expect(new Set(kanban).size).toBe(expected.length);
    for (const state of ['ACTIVE', 'CLOSED']) {
      const column = screen.getByTestId(`standard-kanban-column-${state}`);
      const indexes = within(column)
        .queryAllByTestId(/^execution-bank-kanban-item-/)
        .map(pairFromNode)
        .map((pair) => expected.indexOf(pair.join('/')));
      expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    }

    fireEvent.click(screen.getByTestId('view-mode-calendar'));
    await screen.findByTestId('execution-bank-view-calendar');
    const calendarNodes = visiblePairNodes('calendar');
    const calendar = calendarNodes.map(pairFromNode).map((pair) => pair.join('/'));
    expect([...calendar].sort()).toEqual(expectedSet);
    expect(new Set(calendar).size).toBe(expected.length);
    for (const section of new Set(calendarNodes.map((node) => node.closest('section')))) {
      if (!section) continue;
      const indexes = within(section as HTMLElement)
        .queryAllByTestId(/^execution-bank-calendar-item-/)
        .map(pairFromNode)
        .map((pair) => expected.indexOf(pair.join('/')));
      expect(indexes).toEqual([...indexes].sort((a, b) => a - b));
    }

    fireEvent.click(screen.getByTestId('view-mode-timeline'));
    await screen.findByTestId('execution-bank-view-gantt');
    expect(visiblePairOrder('gantt').map((pair) => pair.join('/'))).toEqual(expected);
  });
});
