/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../src/components/shared/ModuleHub/ModuleHub', () => ({
  ModuleHub: ({ tabs, activeTab, onTabChange, onNewItem, commandRowContent, children }: any) => (
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
      <div data-testid="command-row">{commandRowContent}</div>
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
  ResultsKpiReportsView: () => <div>results-kpi-reports-view</div>,
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
    getDashboard: vi.fn(),
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
  });

  it('shows governed runtime pills in summary and keeps them after switching tabs', async () => {
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

    expect(screen.getByText('Governed KPIs')).toBeInTheDocument();
    expect(screen.getByText('480,000')).toBeInTheDocument();

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
    fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('results_kpi');
      expect(screen.getByTestId('results-kpi-count')).toHaveTextContent('0');
    });

    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpis');
    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpi-mappings');
  });

  it('opens KPI as overview-first cockpit and switches to queue/catalog surfaces', async () => {
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
      expect(screen.getByText('kpi-overview-view')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Queue' }));
    expect(screen.getByText('kpi-queue-view')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));
    expect(screen.getByText('results-kpis-table')).toBeInTheDocument();
  });

  it('switches KPI workspace to scorecards surface', async () => {
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
      expect(screen.getByText('kpi-overview-view')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Scorecards' }));
    expect(screen.getByText('results-kpi-scorecards-view')).toBeInTheDocument();
  });

  it('switches reporting workspace between reports, schedules, wallboards and connectors', async () => {
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
      expect(screen.getByText('results-kpi-reports-view')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Schedules' }));
    expect(screen.getByText('results-report-schedules-view')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Wallboards' }));
    expect(screen.getByText('results-wallboards-view')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Connectors' }));
    expect(screen.getByText('results-kpi-connectors-view')).toBeInTheDocument();
  });

  it('deletes KPI from the hub through the governed V8 seam first', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));

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

  it('falls back to legacy KPI delete from the hub only for bounded compatibility errors', async () => {
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
    fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));

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
      expect(V8ResultsApi.getDashboard).toHaveBeenCalledTimes(1);
      expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getAllByRole('button', { name: 'KPI' })[0]);
    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('results_kpi');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Catalog' }));

    fireEvent.click(screen.getByRole('button', { name: 'add-action' }));
    fireEvent.click(screen.getByRole('button', { name: 'create-kpi-success' }));

    await waitFor(() => {
      expect(V8ResultsApi.getDashboard).toHaveBeenCalledTimes(2);
      expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole('button', { name: 'open-first-kpi' }));
    fireEvent.click(screen.getByRole('button', { name: 'record-kpi-value' }));

    await waitFor(() => {
      expect(V8ResultsApi.getDashboard).toHaveBeenCalledTimes(3);
      expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalledTimes(3);
    });
  });
});
