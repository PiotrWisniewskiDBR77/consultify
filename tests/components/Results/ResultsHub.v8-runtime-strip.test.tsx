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
  ModuleHub: ({ tabs, activeTab, onTabChange, commandRowContent, children }: any) => (
    <div>
      <div data-testid="active-tab">{activeTab}</div>
      <div>
        {tabs.map((tab: any) => (
          <button key={tab.id} type="button" onClick={() => onTabChange(tab.id)}>
            {tab.label}
          </button>
        ))}
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

vi.mock('../../../src/components/Results/ResultsSummaryView', () => ({
  ResultsSummaryView: () => <div>results-summary-view</div>,
}));

vi.mock('../../../src/components/Results/OperationalAnalysisView', () => ({
  OperationalAnalysisView: () => <div>operational-analysis-view</div>,
}));

vi.mock('../../../src/components/Results/ResultsKpiReportsView', () => ({
  ResultsKpiReportsView: () => <div>results-kpi-reports-view</div>,
}));

vi.mock('../../../src/components/Results/ResultsKpisTableV3', () => ({
  ResultsKpisTableV3: ({ kpis }: any) => (
    <div>
      <div>results-kpis-table</div>
      <div data-testid="results-kpi-count">{Array.isArray(kpis) ? kpis.length : -1}</div>
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
  KPICreateModal: () => null,
}));

vi.mock('../../../src/components/Results/KPITimeSeriesDrawer', () => ({
  KPITimeSeriesDrawer: () => null,
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
      expect(screen.getByTestId('active-tab')).toHaveTextContent('kpis');
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

    await waitFor(() => {
      expect(screen.getByTestId('active-tab')).toHaveTextContent('kpis');
      expect(screen.getByTestId('results-kpi-count')).toHaveTextContent('0');
    });

    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpis');
    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpi-mappings');
  });
});
