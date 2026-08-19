/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      (typeof fallback === 'string' ? fallback : fallback?.defaultValue) || _key,
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('../../../src/components/shared/ModuleHub/ModuleHub', () => ({
  ModuleHub: ({
    tabs,
    activeTab,
    onTabChange,
    onNewItem,
    commandRowContent,
    commandRowRightContent,
    children,
  }: any) => (
    <div>
      <div data-testid="active-tab">{activeTab}</div>
      <div>
        {tabs.map((tab: any) => (
          <button key={tab.id} type="button" onClick={() => onTabChange(tab.id)}>
            {tab.label}
          </button>
        ))}
        {onNewItem ? (
          <button type="button" onClick={onNewItem}>
            add-action
          </button>
        ) : null}
      </div>
      <div data-testid="command-row">
        {commandRowContent}
        {commandRowRightContent}
      </div>
      <div>{children}</div>
    </div>
  ),
}));

vi.mock('../../../src/components/shared/ModuleHub/useModuleOpenDocuments', () => ({
  useModuleOpenDocuments: () => ({
    openDocuments: [],
    setOpenDocuments: vi.fn(),
    activeDocumentId: null,
    setActiveDocumentId: vi.fn(),
  }),
}));

vi.mock('../../../src/components/Results/ResultsKpiReportsView', () => ({
  ResultsKpiReportsView: ({ activeFilters }: any) => (
    <div>
      <div>results-kpi-reports-view</div>
      <div data-testid="results-kpi-reports-initiative-filter">
        {Array.isArray(activeFilters)
          ? activeFilters.find((f: any) => f.column === 'initiativeName')?.value || ''
          : ''}
      </div>
    </div>
  ),
}));

vi.mock('../../../src/components/Results/ResultsKpiScorecardsView', () => ({
  ResultsKpiScorecardsView: () => <div>results-kpi-scorecards-view</div>,
}));

vi.mock('../../../src/components/Results/ResultsReportingEnterpriseViews', () => ({
  ResultsReportSchedulesView: () => <div>results-report-schedules-view</div>,
  ResultsWallboardsView: () => <div>results-wallboards-view</div>,
  ResultsKpiConnectorsView: () => <div>results-kpi-connectors-view</div>,
}));

vi.mock('../../../src/components/Results/KpiOverviewView', () => ({
  KpiOverviewView: () => <div>kpi-overview-view</div>,
}));

vi.mock('../../../src/components/Results/KpiQueueView', () => ({
  KpiQueueView: () => <div>kpi-queue-view</div>,
}));

vi.mock('../../../src/components/Results/ResultsKpisTableV3', () => ({
  ResultsKpisTableV3: ({ kpis, onDeleteKpi, onOpenKpi }: any) => (
    <div>
      <div>results-kpis-table</div>
      <div data-testid="results-kpi-count">{Array.isArray(kpis) ? kpis.length : -1}</div>
      {Array.isArray(kpis) && kpis[0] ? (
        <>
          <button type="button" onClick={() => onDeleteKpi?.(kpis[0].id)}>
            delete-first-kpi
          </button>
          <button type="button" onClick={() => onOpenKpi?.(kpis[0].id)}>
            open-first-kpi
          </button>
        </>
      ) : null}
    </div>
  ),
}));

vi.mock('../../../src/components/Results/ResultsKPITable', () => ({
  ResultsGridView: () => <div>results-grid-view</div>,
}));

vi.mock('../../../src/components/Results/ROITrackingView', () => ({
  ROITrackingView: () => <div>roi-tracking-view</div>,
}));

vi.mock('../../../src/components/Results/ROIAnalysisView', () => ({
  ROIAnalysisView: () => <div>roi-analysis-view</div>,
}));

vi.mock('../../../src/components/Results/KPICreateModal', () => ({
  KPICreateModal: ({ onSuccess }: any) => (
    <button type="button" onClick={() => onSuccess?.()}>
      create-kpi-success
    </button>
  ),
}));

vi.mock('../../../src/components/Results/KPITimeSeriesDrawer', () => ({
  KPITimeSeriesDrawer: ({ onValueRecorded }: any) => (
    <button type="button" onClick={() => onValueRecorded?.()}>
      record-kpi-value
    </button>
  ),
}));

vi.mock('../../../src/components/Results/ROIOpenModal', () => ({
  ROIOpenModal: () => null,
}));

vi.mock('../../../src/components/Results/ROIDetailDrawer', () => ({
  ROIDetailDrawer: () => null,
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../src/services/api/v8/results', () => ({
  V8ResultsApi: {
    getRoiPortfolioSummary: vi.fn(),
    getDashboard: vi.fn(),
    getScorecards: vi.fn(),
    getKpiCatalog: vi.fn(),
    deleteKpi: vi.fn(),
  },
  shouldFallbackToLegacyResults: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { ResultsHub } from '../../../src/components/Results/ResultsHub';
import { Api } from '../../../src/services/api';
import { V8ResultsApi } from '../../../src/services/api/v8/results';

describe('ResultsHub V8 runtime strip', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/benefits/kpis') {
        return { data: [] } as any;
      }
      if (url === '/benefits/kpi-mappings') {
        return { data: [] } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    vi.mocked(V8ResultsApi.getDashboard).mockResolvedValue({
      snapshot: {
        organizationId: 'dbr77',
        kpiScorecard: {
          organizationId: 'dbr77',
          totalKpis: 12,
          byStatus: { onTarget: 8, below: 4 },
          byCategory: {},
          averageTargetAchievementRate: 0.78,
        },
        activeDeviationsCount: 3,
        roiDashboard: {
          organizationId: 'dbr77',
          totalEntries: 5,
          totalRealized: 480000,
          projectedFromKpiTargets: 900000,
          overallRealizationRate: 0.53,
          byInitiative: [],
        },
        reconciliationHealth: {
          organizationId: 'dbr77',
          total: 7,
          byStatus: { unresolved: 2 },
          unresolvedCount: 2,
          averageResolutionHours: 16,
        },
        recentReviewPacks: [],
      },
    } as any);
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'dbr77',
      kpis: [],
      mappings: [],
      initiatives: [],
    } as any);
    vi.mocked(V8ResultsApi.getRoiPortfolioSummary).mockResolvedValue({
      organizationId: 'dbr77',
      items: [],
      summary: {
        totalProjected: 0,
        totalRealized: 0,
        totalCapex: 0,
        totalVariance: 0,
        initiativeCount: 0,
        coveragePercent: 0,
      },
    } as any);
    vi.mocked(V8ResultsApi.getScorecards).mockResolvedValue({
      organizationId: 'dbr77',
      scorecards: [],
      count: 0,
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows governed runtime pills in summary and does not duplicate them in the KPI command row', async () => {
    render(
      <MemoryRouter>
        <ResultsHub />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(V8ResultsApi.getDashboard).toHaveBeenCalled();
      expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalled();
      expect(screen.getByText('Governed KPIs')).toBeInTheDocument();
    });

    expect(screen.getByText('Deviations')).toBeInTheDocument();
    expect(screen.getByText('Realized ROI')).toBeInTheDocument();
    expect(screen.getByText('Reconciliation')).toBeInTheDocument();
    expect(screen.getByText('480,000')).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'KPI' })[0]);

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('results_kpi');
    });

    expect(screen.queryByText('Governed KPIs')).not.toBeInTheDocument();
    expect(screen.queryByText('480,000')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'ROI' })[0]);

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('roi');
    });

    expect(screen.getByText('Realized ROI')).toBeInTheDocument();
    expect(screen.getByText('Reconciliation')).toBeInTheDocument();
  });

  it('does not backfill demo KPI rows when governed strip is present but KPI payload is empty', async () => {
    render(
      <MemoryRouter>
        <ResultsHub />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(V8ResultsApi.getDashboard).toHaveBeenCalled();
      expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'KPI' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'KPI List' }));

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('results_kpi');
      expect(screen.getByTestId('results-kpi-count')).toHaveTextContent('0');
    });

    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpis');
    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpi-mappings');
  });

  it('opens KPI on catalog first and switches to data-signals and overview surfaces', async () => {
    render(
      <MemoryRouter>
        <ResultsHub />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(V8ResultsApi.getDashboard).toHaveBeenCalled();
      expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'KPI' })[0]);

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('results_kpi');
      expect(screen.getByText('results-kpis-table')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Data / Signals' }));
    expect(screen.getByText('kpi-queue-view')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Overview' }));
    expect(screen.getByText('kpi-overview-view')).toBeInTheDocument();
  });

  it('keeps KPI command row focused on catalog-first, data-signals, overview and record flow', async () => {
    render(
      <MemoryRouter>
        <ResultsHub />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(V8ResultsApi.getDashboard).toHaveBeenCalled();
      expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'KPI' })[0]);

    await waitFor(() => {
      expect(screen.getByText('results-kpis-table')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'KPI List' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Data / Signals' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Overview' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Record value' })).toBeInTheDocument();

    expect(screen.queryByRole('button', { name: 'Scorecards' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'My KPI' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Watched only' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Missing entries' })).not.toBeInTheDocument();
  });

  it('opens reports on tracked KPI list and switches reporting workspace surfaces', async () => {
    render(
      <MemoryRouter>
        <ResultsHub />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(V8ResultsApi.getDashboard).toHaveBeenCalled();
      expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Reports' })[0]);

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('results_reports');
      expect(screen.getByRole('button', { name: 'Tracked KPI' })).toBeInTheDocument();
      expect(screen.getByText('results-kpis-table')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'Reports' })[1]);

    await waitFor(() => {
      expect(screen.getByText('results-kpi-reports-view')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Schedules' }));
    expect(screen.getByText('results-report-schedules-view')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Wallboards' }));
    expect(screen.getByText('results-wallboards-view')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Connectors' }));
    expect(screen.getByText('results-kpi-connectors-view')).toBeInTheDocument();
  });

  it('opens initiative document from deep link and clears deep-link params', async () => {
    render(
      <MemoryRouter initialEntries={['/results?open=ini-123&mode=initiative']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('results_initiatives');
    });
  });

  it('applies initiative scope when reports lane is opened from initiative context', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'dbr77',
      kpis: [],
      mappings: [],
      initiatives: [
        {
          initiativeId: 'ini-1',
          initiativeName: 'Growth Program',
          initiativeStatus: 'TRACKING',
          trackedKpiCount: 2,
          realizationKpiCount: 1,
          postImplementationKpiCount: 1,
          belowTargetCount: 0,
          needsEntryCount: 0,
          openDeviationCount: 0,
          openReportCount: 0,
          lastReportTitle: null,
          ownerName: 'Alex',
          lifecycleBucket: 'realized',
        },
      ],
    } as any);

    render(
      <MemoryRouter initialEntries={['/benefits?tab=results_reports&rmode=reports&initiativeId=ini-1']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('results_reports');
      expect(screen.getByText('results-kpi-reports-view')).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText('results-kpi-reports-view')).toBeInTheDocument();
      expect(screen.getByTestId('results-kpi-reports-initiative-filter')).toHaveTextContent(
        'Growth Program'
      );
    });
    expect(V8ResultsApi.getDashboard).toHaveBeenCalledWith({ initiativeId: 'ini-1' });

    fireEvent.click(screen.getByRole('button', { name: 'Open in Execution' }));
    expect(mockNavigate).toHaveBeenCalledWith(
      '/implementation?initiativeId=ini-1&open=ini-1&mode=doc&tab=list&view=table'
    );
  });

  it('shows Open in Execution in KPI lane when initiative scope is present', async () => {
    render(
      <MemoryRouter initialEntries={['/benefits?tab=results_kpi&initiativeId=ini-1']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('results_kpi');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open in Execution' }));
    expect(mockNavigate).toHaveBeenCalledWith(
      '/implementation?initiativeId=ini-1&open=ini-1&mode=doc&tab=list&view=table'
    );
  });

  it('shows Open in Execution in ROI lane when initiative scope is present', async () => {
    render(
      <MemoryRouter initialEntries={['/benefits?tab=roi&initiativeId=ini-1']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('roi');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Open in Execution' }));
    expect(mockNavigate).toHaveBeenCalledWith(
      '/implementation?initiativeId=ini-1&open=ini-1&mode=doc&tab=list&view=table'
    );
  });

  it('keeps unscoped dashboard call when initiativeId is absent', async () => {
    render(
      <MemoryRouter initialEntries={['/benefits?tab=results_reports&rmode=reports']}>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('results_reports');
      expect(V8ResultsApi.getDashboard).toHaveBeenCalled();
    });
    expect(V8ResultsApi.getDashboard).toHaveBeenCalledWith({ initiativeId: undefined });
  });

  it('shows KPI catalog error panel and retries load', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog)
      .mockRejectedValueOnce({
        status: 500,
        message: 'Failed to load KPI catalog.',
        data: { error: 'Results unavailable', code: 'RESULTS_UNAVAILABLE' },
      } as any)
      .mockResolvedValueOnce({
        organizationId: 'dbr77',
        kpis: [],
        mappings: [],
        initiatives: [],
      } as any);

    render(
      <MemoryRouter>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Failed to load KPI catalog.').length).toBeGreaterThan(0);
      expect(screen.getByText('code: RESULTS_UNAVAILABLE')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => {
      expect(V8ResultsApi.getKpiCatalog.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(screen.queryByText('code: RESULTS_UNAVAILABLE')).not.toBeInTheDocument();
    });
  });

  it('dismisses KPI catalog error without triggering another fetch', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockRejectedValueOnce({
      status: 500,
      message: 'Failed to load KPI catalog.',
      data: { error: 'Results unavailable', code: 'RESULTS_UNAVAILABLE' },
    } as any);

    render(
      <MemoryRouter>
        <ResultsHub />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getAllByText('Failed to load KPI catalog.').length).toBeGreaterThan(0);
      expect(screen.getByText('code: RESULTS_UNAVAILABLE')).toBeInTheDocument();
    });

    const callsBeforeDismiss = vi.mocked(V8ResultsApi.getKpiCatalog).mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

    expect(screen.queryByText('code: RESULTS_UNAVAILABLE')).not.toBeInTheDocument();
    expect(vi.mocked(V8ResultsApi.getKpiCatalog).mock.calls.length).toBe(callsBeforeDismiss);
  });

  it.skip('deletes KPI from the hub through the governed V8 seam first', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'dbr77',
      kpis: [
        {
          id: 'kpi-1',
          name: 'North Star KPI',
          owner: 'Ops',
          category: 'delivery',
          unit: '%',
          targetValue: 90,
          currentValue: 82,
          linkedInitiatives: [],
        },
      ],
      mappings: [],
      initiatives: [],
    } as any);
    vi.mocked(V8ResultsApi.deleteKpi).mockResolvedValue({ success: true } as any);

    render(
      <MemoryRouter>
        <ResultsHub />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'KPI' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'KPI List' }));

    await waitFor(() => {
      expect(screen.getByText('delete-first-kpi')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('delete-first-kpi'));

    await waitFor(() => {
      expect(V8ResultsApi.deleteKpi).toHaveBeenCalledWith('kpi-1');
    });

    expect(Api.delete).not.toHaveBeenCalledWith('/benefits/kpis/kpi-1');
    confirmSpy.mockRestore();
  });

  it.skip('falls back to legacy KPI delete from the hub only for bounded compatibility errors', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'dbr77',
      kpis: [
        {
          id: 'kpi-1',
          name: 'North Star KPI',
          owner: 'Ops',
          category: 'delivery',
          unit: '%',
          targetValue: 90,
          currentValue: 82,
          linkedInitiatives: [],
        },
      ],
      mappings: [],
      initiatives: [],
    } as any);
    vi.mocked(V8ResultsApi.deleteKpi).mockRejectedValue({ status: 404 });
    vi.mocked(Api.delete).mockResolvedValue({ success: true } as any);

    render(
      <MemoryRouter>
        <ResultsHub />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalled();
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'KPI' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'KPI List' }));

    await waitFor(() => {
      expect(screen.getByText('delete-first-kpi')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('delete-first-kpi'));

    await waitFor(() => {
      expect(V8ResultsApi.deleteKpi).toHaveBeenCalledWith('kpi-1');
      expect(Api.delete).toHaveBeenCalledWith('/benefits/kpis/kpi-1');
    });

    confirmSpy.mockRestore();
  });

  it('refreshes KPI truth after create success and drawer value updates', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'dbr77',
      kpis: [
        {
          id: 'kpi-1',
          name: 'North Star KPI',
          unit: '%',
          targetValue: 90,
          latestValue: 70,
          latestMeasurementDate: '2026-03-20T00:00:00Z',
          measurementFrequency: 'MONTHLY',
          isOnTarget: false,
          createdAt: '2026-03-01T00:00:00Z',
        },
      ],
      mappings: [],
      initiatives: [],
    } as any);

    render(
      <MemoryRouter>
        <ResultsHub />
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(V8ResultsApi.getDashboard).toHaveBeenCalled();
      expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalled();
    });

    const baselineDashboardCalls = V8ResultsApi.getDashboard.mock.calls.length;
    const baselineCatalogCalls = V8ResultsApi.getKpiCatalog.mock.calls.length;

    fireEvent.click(screen.getAllByRole('button', { name: 'KPI' })[0]);
    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('results_kpi');
    });

    fireEvent.click(screen.getByRole('button', { name: 'KPI List' }));

    fireEvent.click(screen.getByRole('button', { name: 'add-action' }));
    fireEvent.click(screen.getByRole('button', { name: 'create-kpi-success' }));

    await waitFor(() => {
      expect(V8ResultsApi.getDashboard.mock.calls.length).toBeGreaterThan(baselineDashboardCalls);
      expect(V8ResultsApi.getKpiCatalog.mock.calls.length).toBeGreaterThan(baselineCatalogCalls);
    });

    const afterCreateDashboardCalls = V8ResultsApi.getDashboard.mock.calls.length;
    const afterCreateCatalogCalls = V8ResultsApi.getKpiCatalog.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: 'open-first-kpi' }));
    fireEvent.click(screen.getByRole('button', { name: 'record-kpi-value' }));

    await waitFor(() => {
      expect(V8ResultsApi.getDashboard.mock.calls.length).toBeGreaterThan(afterCreateDashboardCalls);
      expect(V8ResultsApi.getKpiCatalog.mock.calls.length).toBeGreaterThan(afterCreateCatalogCalls);
    });
  });
});
