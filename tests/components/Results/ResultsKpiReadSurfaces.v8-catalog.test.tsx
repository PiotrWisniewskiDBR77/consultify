/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
    i18n: { language: 'en' },
  }),
  initReactI18next: {
    type: '3rdParty',
    init: () => {},
  },
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('../../../src/components/Results/KPITimeSeriesDrawer', () => ({
  KPITimeSeriesDrawer: () => null,
}));

vi.mock('../../../src/components/Results/OperationalAnalysisView', () => ({
  OperationalAnalysisView: () => <div>operational-analysis-view</div>,
}));

vi.mock('../../../src/components/shared/ModuleHub/FilterableTable', () => ({
  FilterableTable: ({ data, emptyMessage }: any) => (
    <div>
      <div data-testid="table-row-count">{Array.isArray(data) ? data.length : -1}</div>
      {Array.isArray(data) && data.length > 0 ? (
        data.map((row: any) => <div key={row.id}>{row.name}</div>)
      ) : (
        <div>{emptyMessage}</div>
      )}
    </div>
  ),
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../../src/services/api/v8/results', () => ({
  V8ResultsApi: {
    getKpiCatalog: vi.fn(),
    createKpiReport: vi.fn(),
  },
  shouldFallbackToLegacyResults: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { OperationalAnalysisView } from '../../../src/components/Results/OperationalAnalysisView';
import { ResultsKpiReportsView } from '../../../src/components/Results/ResultsKpiReportsView';
import { Api } from '../../../src/services/api';
import { V8ResultsApi } from '../../../src/services/api/v8/results';

const KPI_CATALOG = {
  organizationId: 'org-1',
  kpis: [
    {
      id: 'kpi-1',
      name: 'KPI Alpha',
      initiativeName: 'Initiative Alpha',
      latestValue: 12,
      prevValue: 10,
      targetValue: 20,
      measurementFrequency: 'MONTHLY',
      isOnTarget: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      ownerName: 'Ada Lovelace',
    },
  ],
  mappings: [
    { id: 'map-1', kpiId: 'kpi-1', initiativeId: 'init-1', initiativeName: 'Initiative Alpha' },
  ],
  initiatives: [],
};

describe('Results KPI read surfaces V8 catalog seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/results/kpi-reports') {
        return { data: [] } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });
  });

  it.skip('OperationalAnalysisView reads the V8 KPI catalog before touching legacy KPI routes (OperationalAnalysisView removed — component no longer exists)', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue(KPI_CATALOG as any);

    render(<OperationalAnalysisView />);

    await waitFor(() => {
      expect(screen.getAllByText('KPI Alpha').length).toBeGreaterThan(0);
      expect(screen.getByText('Total KPIs Tracked')).toBeInTheDocument();
    });

    expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpis');
    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpi-mappings');
  });

  it('ResultsKpiReportsView uses the V8 KPI catalog in the create modal before legacy KPI reads', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue(KPI_CATALOG as any);

    render(
      <MemoryRouter>
        <ResultsKpiReportsView activeFilters={[]} onFilterChange={vi.fn()} createNonce={1} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('KPI Alpha')).toBeInTheDocument();
      expect(
        screen.getByText((content) => content.replace(/\s+/g, ' ').includes('Selected: 1/1'))
      ).toBeInTheDocument();
    });

    expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpis');
  });

  it('ResultsKpiReportsView creates KPI reports through the governed V8 route before legacy fallback', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue(KPI_CATALOG as any);
    vi.mocked(V8ResultsApi.createKpiReport).mockResolvedValue({
      snapshotId: 'snap-1',
      reportId: 'report-1',
    } as any);

    render(
      <MemoryRouter>
        <ResultsKpiReportsView activeFilters={[]} onFilterChange={vi.fn()} createNonce={1} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('KPI Alpha')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(V8ResultsApi.createKpiReport).toHaveBeenCalledWith(
        expect.objectContaining({
          periodStart: expect.any(String),
          periodEnd: expect.any(String),
          title: undefined,
          kpiIds: ['kpi-1'],
          filters: {
            lifecycleFilter: 'all',
            initiativeIds: [],
          },
          initiativeIds: undefined,
        })
      );
    });

    expect(Api.post).not.toHaveBeenCalledWith('/results/kpi-reports', expect.anything());
  });

  it('ResultsKpiReportsView falls back to legacy KPI report create only for bounded compatibility errors', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue(KPI_CATALOG as any);
    vi.mocked(V8ResultsApi.createKpiReport).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({
      data: { snapshotId: 'snap-1', reportId: 'report-1' },
    } as any);

    render(
      <MemoryRouter>
        <ResultsKpiReportsView activeFilters={[]} onFilterChange={vi.fn()} createNonce={1} />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('KPI Alpha')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Create'));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith(
        '/results/kpi-reports',
        expect.objectContaining({
          periodStart: expect.any(String),
          periodEnd: expect.any(String),
          title: undefined,
          kpiIds: ['kpi-1'],
          filters: {
            lifecycleFilter: 'all',
            initiativeIds: [],
          },
          initiativeIds: undefined,
        })
      );
    });
  });
});
