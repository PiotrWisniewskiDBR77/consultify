/**
 * @vitest-environment jsdom
 * Current Results entry contract: the default three-pairs surface reads the
 * canonical V8 dashboard/catalog and routes mutations to Results VNext.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? key),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('../../../src/hooks/useOpenChatWithContext', () => ({
  useOpenChatWithContext: () => vi.fn(),
}));

vi.mock('../../../src/store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({
      currentUser: { id: 'owner-1', firstName: 'Piotr', lastName: 'Wiśniewski' },
      currentOrganization: { id: 'org-1' },
    }),
}));

vi.mock('../../../src/components/shared/ModuleHub/useModuleOpenDocuments', () => ({
  useModuleOpenDocuments: () => ({
    openDocuments: [],
    setOpenDocuments: vi.fn(),
    activeDocumentId: null,
    setActiveDocumentId: vi.fn(),
  }),
}));

vi.mock('../../../src/components/Results/resultsFeatureFlags', () => ({
  isResultsFlagEnabled: (flag: string) => flag === 'threePairs',
}));

vi.mock('../../../src/services/api', () => ({
  Api: { get: vi.fn(), delete: vi.fn() },
}));

vi.mock('../../../src/services/api/v8/results', () => ({
  V8ResultsApi: {
    getDashboard: vi.fn(),
    getKpiCatalog: vi.fn(),
    getRoiPortfolioSummary: vi.fn(),
    deleteKpi: vi.fn(),
  },
  shouldFallbackToLegacyResults: (error: any) =>
    [400, 404, 405, 501].includes(Number(error?.status)),
}));

import { ResultsHub } from '../../../src/components/Results/ResultsHub';
import { Api } from '../../../src/services/api';
import { V8ResultsApi } from '../../../src/services/api/v8/results';

const dashboard = {
  snapshot: {
    organizationId: 'org-1',
    kpiScorecard: {
      organizationId: 'org-1',
      totalKpis: 1,
      byStatus: { onTarget: 0, below: 1 },
      byCategory: {},
      averageTargetAchievementRate: 0.78,
    },
    activeDeviationsCount: 1,
    roiDashboard: {
      organizationId: 'org-1',
      totalEntries: 0,
      totalRealized: 0,
      projectedFromKpiTargets: 0,
      overallRealizationRate: 0,
      byInitiative: [],
    },
    reconciliationHealth: {
      organizationId: 'org-1',
      total: 0,
      byStatus: {},
      unresolvedCount: 0,
      averageResolutionHours: 0,
    },
    recentReviewPacks: [],
  },
} as any;

const catalog = {
  organizationId: 'org-1',
  initiatives: [],
  mappings: [],
  kpis: [
    {
      id: 'kpi-1',
      name: 'North Star KPI',
      unit: '%',
      latestValue: 70,
      targetValue: 90,
      isOnTarget: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
} as any;

describe('ResultsHub current canonical entry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V8ResultsApi.getDashboard).mockResolvedValue(dashboard);
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue(catalog);
    vi.mocked(V8ResultsApi.getRoiPortfolioSummary).mockResolvedValue({ items: [] } as any);
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/results-strategic/all/okr') return { data: { objectives: [] } } as any;
      throw new Error(`Unexpected GET ${url}`);
    });
  });

  it('loads the unscoped canonical dashboard and KPI catalog', async () => {
    render(
      <MemoryRouter initialEntries={['/results']}>
        <ResultsHub />
      </MemoryRouter>
    );

    expect(await screen.findByText('North Star KPI')).toBeInTheDocument();
    expect(V8ResultsApi.getDashboard).toHaveBeenCalledWith();
    expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalledWith();
    expect(screen.getByTestId('results-pair-tab-kpi')).toHaveAttribute('aria-pressed', 'true');
  });

  it('keeps a canonical 200-empty catalog empty instead of injecting demo rows', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      initiatives: [],
      mappings: [],
      kpis: [],
    } as any);

    render(
      <MemoryRouter initialEntries={['/results']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalled());
    expect(screen.queryByText('North Star KPI')).not.toBeInTheDocument();
    expect(screen.getByText('0 KPI')).toBeInTheDocument();
  });

  it('pins an initiative-scoped dashboard request from the URL', async () => {
    render(
      <MemoryRouter initialEntries={['/results?initiativeId=init-1']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(V8ResultsApi.getDashboard).toHaveBeenCalledWith({ initiativeId: 'init-1' });
    });
  });

  it('routes Add KPI to the canonical KPI registry', async () => {
    render(
      <MemoryRouter initialEntries={['/results']}>
        <ResultsHub />
      </MemoryRouter>
    );

    expect(await screen.findByText('North Star KPI')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Add KPI' }));
    expect(mockNavigate).toHaveBeenCalledWith('/results/kpi');
  });
});
