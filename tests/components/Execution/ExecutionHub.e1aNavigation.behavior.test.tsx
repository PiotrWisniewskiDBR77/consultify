/**
 * @vitest-environment jsdom
 */

// This suite requires real navigation, including the hook mocked globally by tests/setup.ts.
vi.unmock('react-router-dom');

import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  MemoryRouter,
  useLocation,
  useNavigate,
} from 'react-router-dom';

vi.mock('react-i18next', () => {
  const t = (_key: string, fallback?: string) => fallback ?? _key;
  const i18n = { language: 'en' };
  return {
    initReactI18next: { type: '3rdParty', init: () => undefined },
    useTranslation: () => ({ t, i18n }),
  };
});

vi.mock('@/i18n', () => ({ default: {} }));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

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
  return {
    useAppStore: (selector?: (value: any) => unknown) => (selector ? selector(state) : state),
  };
});

vi.mock('@/store/useConversationStore', () => ({
  useConversationStore: (selector: (state: any) => unknown) =>
    selector({ addMessage: vi.fn() }),
}));

vi.mock('@/store/useInitiativeRefreshStore', () => ({
  useInitiativeRefreshStore: (selector: (state: any) => unknown) => selector({ version: 0 }),
}));

vi.mock('@/hooks/useOpenChatWithContext', () => {
  const openChat = vi.fn();
  return { useOpenChatWithContext: () => openChat };
});
vi.mock('@/hooks/useOrganizationMemberNames', () => {
  const resolveName = (id: string) => id;
  return { useOrganizationMemberNames: () => resolveName };
});

vi.mock('@/components/shared/PreviewPane/useJedenPanel', () => ({
  useJedenPanel: () => ({
    zamkniety: true,
    dokOtwarty: false,
    otworz: vi.fn(),
    pokazPanel: vi.fn(),
  }),
}));
vi.mock('@/components/shared/PreviewPane/JedenPrawyPanel', () => ({
  JedenPrawyPanel: () => null,
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
    getInitiatives: vi.fn(async () => []),
    getTasks: vi.fn(async () => []),
    raidList: vi.fn(async () => []),
    get: vi.fn(async () => []),
    post: vi.fn(async () => ({})),
    put: vi.fn(async () => ({})),
    delete: vi.fn(async () => ({})),
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
  listExecutionCases: vi.fn(async () => ({ cases: [] })),
}));
vi.mock('@/services/executionWriteTruth', () => ({
  refreshExecutionWriteTruth: vi.fn(async () => undefined),
}));
vi.mock('@/services/funnelAnalytics', () => ({ trackFunnelEvent: vi.fn() }));

vi.mock('@/components/Execution/ExecutionActionCards', () => ({
  ExecutionActionCards: () => null,
}));
vi.mock('@/components/Execution/ExecutionWorkSurface', () => ({
  ExecutionWorkSurface: ({ documentId }: { documentId?: string }) => (
    <div data-testid="work-surface" data-document-id={documentId ?? ''}>
      Work surface
    </div>
  ),
}));
vi.mock('@/components/Execution/ExecutionResourcesSurface', () => ({
  ExecutionResourcesSurface: () => <div data-testid="resources-surface">Resources surface</div>,
}));
vi.mock('@/components/Execution/ExecutionControlSurface', () => ({
  ExecutionControlSurface: () => <div data-testid="control-surface">Control surface</div>,
}));
vi.mock('@/components/Execution/ExecutionReportsSurface', () => ({
  ExecutionReportsSurface: () => <div data-testid="reports-surface">Reports surface</div>,
}));
vi.mock('@/components/Execution/ExecutionSummaryOneLook', () => ({
  default: () => <div data-testid="summary-surface">Summary surface</div>,
}));
vi.mock('@/components/Execution/RolloutTab', () => ({
  RolloutTab: () => <div data-testid="rollout-surface">Rollout surface</div>,
}));
vi.mock('@/components/Initiatives/InitiativeDocumentView', () => ({
  InitiativeDocumentView: ({ initiativeId }: { initiativeId: string }) => (
    <div data-testid="initiative-surface" data-initiative-id={initiativeId}>
      Initiative surface
    </div>
  ),
}));
vi.mock('@/components/Initiatives/InitiativeCompactPanel', () => ({
  InitiativeCompactPanel: () => null,
}));
vi.mock('@/components/Reports/Wizard', () => ({ ReportGeneratorWizard: () => null }));

import { ExecutionHub } from '@/components/Execution/ExecutionHub';

const LocationProbe = () => {
  const location = useLocation();
  const navigate = useNavigate();
  React.useEffect(() => {
    observedLocations.push(`${location.pathname}${location.search}${location.hash}`);
  }, [location]);
  return (
    <div>
      <output data-testid="location">
        {location.pathname}
        {location.search}
        {location.hash}
      </output>
      <button type="button" onClick={() => navigate(-1)}>
        ←
      </button>
      <button type="button" onClick={() => navigate(1)}>
        →
      </button>
    </div>
  );
};

const observedLocations: string[] = [];

const mountHub = (entry: string) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <ExecutionHub />
    </MemoryRouter>
  );

const activeMenu2 = () =>
  screen.getAllByRole('tab').filter((tab) => tab.getAttribute('aria-selected') === 'true');

const locationParams = () => {
  const value = screen.getByTestId('location').textContent || '';
  return new URL(value, 'http://example.test');
};

describe('E1a actual ExecutionHub mounted navigation', () => {
  beforeEach(() => {
    observedLocations.length = 0;
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

  it('opens a cold initiative identity in the actual hub', async () => {
    mountHub(
      '/execution?tab=work&initiativeId=initiative-44&executionCaseId=case-3&returnContext=portfolio#row-44'
    );

    const card = await screen.findByTestId('initiative-surface');
    expect(card).toHaveAttribute('data-initiative-id', 'initiative-44');
    expect(activeMenu2()).toHaveLength(1);
    expect(activeMenu2()[0]).toHaveTextContent('Work');
    expect(locationParams().hash).toBe('#row-44');
    expect(locationParams().searchParams.get('executionCaseId')).toBe('case-3');
    expect(locationParams().searchParams.get('returnContext')).toBe('portfolio');
  });

  it('keeps a typed work identity out of the initiative-card path', async () => {
    mountHub(
      '/execution?tab=work&documentKind=work&documentId=work%3Acase-7%3Atask-2&executionCaseId=case-7#task-2'
    );

    const work = await screen.findByTestId('work-surface');
    expect(work).toHaveAttribute('data-document-id', 'task-2');
    expect(screen.queryByTestId('initiative-surface')).not.toBeInTheDocument();
    expect(locationParams().searchParams.get('initiativeId')).toBeNull();
    expect(locationParams().searchParams.get('documentKind')).toBe('work');
    expect(locationParams().searchParams.get('documentId')).toBe('work:case-7:task-2');
  });

  it.each([
    ['resources', 'resources', 'Work', 'resources-surface'],
    ['rollout', 'rollout', 'Reports', 'rollout-surface'],
  ])(
    'mounts the %s subview under its owning Menu 2 function',
    async (tab, subview, owner, surfaceTestId) => {
      mountHub(`/execution?tab=${tab}&subview=${subview}#saved-row`);

      expect(await screen.findByTestId(surfaceTestId)).toBeInTheDocument();
      expect(activeMenu2()).toHaveLength(1);
      expect(activeMenu2()[0]).toHaveTextContent(owner);
      expect(locationParams().hash).toBe('#saved-row');
    }
  );

  it('routes a disabled summary honestly to Reports', async () => {
    mountHub('/execution?tab=summary&subview=summary&preset=ryzyka#summary-row');

    expect(await screen.findByTestId('reports-surface')).toBeInTheDocument();
    expect(screen.queryByTestId('summary-surface')).not.toBeInTheDocument();
    expect(await screen.findByText('Dashboard unavailable')).toBeInTheDocument();
    expect(activeMenu2()).toHaveLength(1);
    expect(activeMenu2()[0]).toHaveTextContent('Reports');
    expect(locationParams().hash).toBe('#summary-row');
  });

  it('uses actual Menu 2 clicks and browser history while preserving context and hash', async () => {
    mountHub(
      '/execution?tab=resources&subview=resources&view=kanban&preset=capacity&filters=red&selection=i-8&returnContext=portfolio#row-i-8'
    );

    expect(await screen.findByTestId('resources-surface')).toBeInTheDocument();
    await waitFor(() => {
      expect(activeMenu2()).toHaveLength(1);
      expect(activeMenu2()[0]).toHaveTextContent('Work');
    });
    fireEvent.click(screen.getByRole('tab', { name: 'Reports' }));

    await screen.findByTestId('reports-surface');
    await waitFor(() => expect(locationParams().searchParams.get('tab')).toBe('reports'));
    expect(locationParams().searchParams.get('filters')).toBe('red');
    expect(locationParams().searchParams.get('selection')).toBe('i-8');
    expect(locationParams().searchParams.get('returnContext')).toBe('portfolio');
    expect(locationParams().hash).toBe('#row-i-8');

    fireEvent.click(screen.getByRole('button', { name: '←' }));
    await screen.findByTestId('resources-surface');
    await waitFor(() => expect(locationParams().searchParams.get('tab')).toBe('work'));
    expect(locationParams().searchParams.get('subview')).toBe('resources');
    expect(locationParams().searchParams.get('filters')).toBe('red');
    expect(locationParams().searchParams.get('selection')).toBe('i-8');
    expect(locationParams().searchParams.get('returnContext')).toBe('portfolio');
    expect(locationParams().hash).toBe('#row-i-8');

    fireEvent.click(screen.getByRole('button', { name: '→' }));
    await screen.findByTestId('reports-surface');
    await waitFor(() => expect(locationParams().searchParams.get('tab')).toBe('reports'));
    expect(locationParams().searchParams.get('filters')).toBe('red');
    expect(locationParams().searchParams.get('selection')).toBe('i-8');
    expect(locationParams().searchParams.get('returnContext')).toBe('portfolio');
    expect(locationParams().hash).toBe('#row-i-8');
  });
});
