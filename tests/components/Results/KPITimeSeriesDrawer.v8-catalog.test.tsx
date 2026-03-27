/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback || _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock('../../../src/services/api/v8/results', () => ({
  V8ResultsApi: {
    getKpiCatalog: vi.fn(),
    getKpiDrawerDetail: vi.fn(),
  },
  shouldFallbackToLegacyResults: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { KPITimeSeriesDrawer } from '../../../src/components/Results/KPITimeSeriesDrawer';
import { Api } from '../../../src/services/api';
import { V8ResultsApi } from '../../../src/services/api/v8/results';

describe('KPITimeSeriesDrawer V8 KPI catalog seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/initiatives') {
        return { data: [{ id: 'init-1', name: 'Initiative Alpha' }] } as any;
      }
      if (url === '/benefits/kpis/kpi-1/time-series') {
        return {
          data: [{ id: 'm-1', value: 12, periodStart: '2026-03-01', notes: null }],
        } as any;
      }
      if (url === '/benefits/kpis/kpi-1/deviation-cases?openOnly=1') {
        return { data: [] } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });
  });

  it('hydrates KPI identity and mappings from the V8 catalog before legacy KPI reads', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [
        {
          id: 'kpi-1',
          name: 'KPI Alpha',
          unit: '%',
          latestValue: 12,
          targetValue: 20,
          isOnTarget: false,
          baselineValue: 8,
          measurementFrequency: 'MONTHLY',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      mappings: [
        {
          id: 'map-1',
          kpiId: 'kpi-1',
          initiativeId: 'init-1',
          initiativeName: 'Initiative Alpha',
        },
      ],
    } as any);
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockResolvedValue({
      organizationId: 'org-1',
      kpiId: 'kpi-1',
      measurements: [
        {
          id: 'm-1',
          kpiId: 'kpi-1',
          value: 12,
          measuredAt: '2026-03-01',
          periodStart: '2026-03-01',
          periodKey: '2026-03',
          createdAt: '2026-03-02T00:00:00.000Z',
        },
      ],
      openCase: {
        id: 'case-1',
        kpiId: 'kpi-1',
        organizationId: 'org-1',
        severity: 'RED',
        status: 'OPEN',
        deviationSummary: 'Below target',
        actions: [],
      },
    } as any);

    render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('KPI Alpha')).toBeInTheDocument();
      expect(screen.getByText('Initiative Alpha')).toBeInTheDocument();
    });

    expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalledWith({ kpiId: 'kpi-1' });
    expect(V8ResultsApi.getKpiDrawerDetail).toHaveBeenCalledWith('kpi-1');
    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpis');
    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpi-mappings?kpiId=kpi-1');
    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpis/kpi-1/time-series');
    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpis/kpi-1/deviation-cases?openOnly=1');
  });

  it('falls back to legacy KPI drawer reads only for bounded compatibility errors', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [],
      mappings: [],
    } as any);
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockRejectedValue({ status: 404 });

    render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(Api.get).toHaveBeenCalledWith('/benefits/kpis/kpi-1/time-series');
      expect(Api.get).toHaveBeenCalledWith('/benefits/kpis/kpi-1/deviation-cases?openOnly=1');
    });
  });
});
