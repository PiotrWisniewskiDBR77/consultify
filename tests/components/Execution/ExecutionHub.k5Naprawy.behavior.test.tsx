/**
 * @vitest-environment jsdom
 */

vi.unmock('react-router-dom');

import React from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const { mutationFetch, getInitiatives, initiatives, executionCases } = vi.hoisted(() => ({
  mutationFetch: vi.fn(),
  getInitiatives: vi.fn(),
  initiatives: [
    {
      id: 'initiative-wip', name: 'Automatyzacja magazynu WIP', description: 'W realizacji, bez handoffu',
      status: 'IN_EXECUTION', priority: 'Medium', progress: null,
      ownerBusiness: { id: 'user-marek', firstName: 'Marek', lastName: 'Nowak' },
      updatedAt: '2026-09-10T10:00:00Z',
    },
    {
      id: 'initiative-devops', name: 'Transformacja DevOps', description: 'W realizacji, bez handoffu',
      status: 'IN_EXECUTION', priority: 'Medium', progress: null, updatedAt: '2026-09-09T10:00:00Z',
    },
    {
      id: 'initiative-approved', name: 'Wdrozenie RPA', description: 'Zatwierdzona, nie w toku',
      status: 'APPROVED', priority: 'Medium', progress: null, updatedAt: '2026-09-08T10:00:00Z',
    },
  ],
  executionCases: [
    {
      executionCaseId: 'demo-story-20260826-execution-oee',
      initiativeId: 'demo-story-20260826-initiative-oee',
      initiativeTitle: 'Program poprawy OEE linii montazowej',
      version: 1, state: 'ACTIVE',
      executionManagerId: 'd2b6a316-08c5-47cf-9bf7-4ba50311d5a2',
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
vi.mock('@/hooks/useOrganizationMemberNames', async () => {
  const real = await vi.importActual<typeof import('@/hooks/useOrganizationMemberNames')>(
    '@/hooks/useOrganizationMemberNames'
  );
  return { ...real, useOrganizationMemberNames: () => () => null };
});
vi.mock('@/components/shared/PreviewPane/useJedenPanel', () => ({
  useJedenPanel: () => ({
    zamkniety: false, dokOtwarty: false, otworz: vi.fn(), zamknij: vi.fn(), pokazPanel: vi.fn(),
  }),
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
    getInitiatives, getTasks: vi.fn(async () => []),
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

describe('K5-R2 — zakres „Active" widzi realizacje ORAZ inicjatywy w toku bez handoffu', () => {
  beforeEach(() => {
    mutationFetch.mockClear();
    getInitiatives.mockReset().mockResolvedValue(initiatives);
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('pokazuje inicjatywy IN_EXECUTION bez realizacji, a nie tylko wiersze z realizacją', async () => {
    render(
      <MemoryRouter initialEntries={['/execution?tab=list&view=table&asOf=2026-09-13']}>
        <ExecutionHub />
      </MemoryRouter>
    );

    await screen.findByText('Program poprawy OEE linii montazowej');

    // POMIAR STAGINGU: bank pokazywał 1 wiersz (sama realizacja), a portfel
    // miał 2 inicjatywy w toku. Teraz widać wszystkie trzy rodowody.
    expect(screen.getByText('Automatyzacja magazynu WIP')).toBeInTheDocument();
    expect(screen.getByText('Transformacja DevOps')).toBeInTheDocument();
    // ...ale NIE inicjatywę dopiero zatwierdzoną (APPROVED to nie „w toku").
    expect(screen.queryByText('Wdrozenie RPA')).not.toBeInTheDocument();
    expect(screen.getAllByText('No execution case yet').length).toBeGreaterThanOrEqual(2);
  });

  it('nie wypuszcza identyfikatora kierownika realizacji na ekran', async () => {
    render(
      <MemoryRouter initialEntries={['/execution?tab=list&view=table&asOf=2026-09-13']}>
        <ExecutionHub />
      </MemoryRouter>
    );
    await screen.findByText('Program poprawy OEE linii montazowej');

    expect(document.body.textContent).not.toContain('d2b6a316-08c5-47cf-9bf7-4ba50311d5a2');
    expect(screen.getAllByText('Unknown user').length).toBeGreaterThan(0);
  });
});

describe('K5-R3/R4 — podgląd banku: jeden nagłówek i właściwości klucz–wartość', () => {
  beforeEach(() => {
    mutationFetch.mockClear();
    getInitiatives.mockReset().mockResolvedValue(initiatives);
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ data: [] }), { status: 200 })));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  const openPreview = async (name: string) => {
    render(
      <MemoryRouter initialEntries={['/execution?tab=list&view=table&asOf=2026-09-13']}>
        <ExecutionHub />
      </MemoryRouter>
    );
    fireEvent.click(await screen.findByText(name));
    return screen.findByTestId('execution-bank-preview');
  };

  it('nagłówek panelu niesie nazwę inicjatywy, nie generyczne „Record", i jeden „×"', async () => {
    await openPreview('Automatyzacja magazynu WIP');

    const aside = document.querySelector('[data-right-panel]');
    expect(aside).not.toBeNull();
    expect(within(aside as HTMLElement).queryByText('Record')).toBeNull();
    expect(
      within(aside as HTMLElement).getAllByRole('button', { name: /close panel/i })
    ).toHaveLength(1);
  });

  it('właściwości stoją w tabeli klucz–wartość, bez licznika słów nad prozą pól', async () => {
    await openPreview('Automatyzacja magazynu WIP');
    const aside = document.querySelector('[data-right-panel]') as HTMLElement;

    expect(within(aside).getByText('Property')).toBeInTheDocument();
    expect(within(aside).getByText('Value')).toBeInTheDocument();
    expect(within(aside).getByText('Baseline finish')).toBeInTheDocument();
    // BYŁO: siedem pól sklejonych `join('\n')` w jeden akapit.
    expect(within(aside).queryByText(/Lifecycle: /)).toBeNull();
    expect(within(aside).queryByText(/Execution state: /)).toBeNull();
    expect(within(aside).queryByText(/Baseline: Baseline not set/)).toBeNull();
  });

  it('licznik słów znika, gdy nad tabelą nie ma prozy do policzenia', async () => {
    /*
     * BYŁO: „~32 words" wisiało nad ZRZUTEM PÓL — licznik liczył słowa etykiet
     * („Lifecycle", „Baseline", „Forecast"). Po przeniesieniu pól do tabeli
     * klucz–wartość licznik pokazuje się tylko wtedy, gdy realnie jest opis.
     */
    await openPreview('Program poprawy OEE linii montazowej');
    const aside = document.querySelector('[data-right-panel]') as HTMLElement;

    expect(within(aside).getByText('Property')).toBeInTheDocument();
    expect(within(aside).queryByText(/words/)).toBeNull();
  });

  it('„Open" jest wyłączone z powodem, gdy rekordu inicjatywy nie ma w portfelu', async () => {
    await openPreview('Program poprawy OEE linii montazowej');
    const aside = document.querySelector('[data-right-panel]') as HTMLElement;

    const open = within(aside).getByRole('button', { name: 'Open' });
    expect(open).toBeDisabled();
    expect(open.getAttribute('title')).toContain('not available');
  });
});
