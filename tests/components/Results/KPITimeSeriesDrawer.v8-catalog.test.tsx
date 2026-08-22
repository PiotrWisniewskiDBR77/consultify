/**
 * @vitest-environment jsdom
 * The initiative-shaped KPI drawer is a read-only compatibility surface.
 * Canonical definition, measurement and impact writes live in Results VNext.
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? key),
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    organizationContextGet: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../../../src/services/api/v8/results', () => ({
  V8ResultsApi: {
    getKpiCatalog: vi.fn(),
    getKpiDrawerDetail: vi.fn(),
    createKpiTimeSeriesValue: vi.fn(),
    updateKpi: vi.fn(),
    deleteKpi: vi.fn(),
    createKpiMapping: vi.fn(),
    deleteKpiMapping: vi.fn(),
  },
  shouldFallbackToLegacyResults: (error: any) =>
    [400, 404, 405, 501].includes(Number(error?.status)),
}));

import { KPITimeSeriesDrawer } from '../../../src/components/Results/KPITimeSeriesDrawer';
import { Api } from '../../../src/services/api';
import { V8ResultsApi } from '../../../src/services/api/v8/results';

const catalog = {
  organizationId: 'org-1',
  kpis: [
    {
      id: 'kpi-1',
      name: 'KPI Alpha',
      unit: '%',
      latestValue: 12,
      targetValue: 20,
      baselineValue: 8,
      measurementFrequency: 'MONTHLY',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  mappings: [],
} as any;

const detail = {
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
  openCase: null,
} as any;

function renderDrawer() {
  return render(
    <MemoryRouter>
      <KPITimeSeriesDrawer kpiId="kpi-1" onClose={vi.fn()} />
    </MemoryRouter>
  );
}

describe('KPITimeSeriesDrawer canonical cutover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue(catalog);
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockResolvedValue(detail);
  });

  it('hydrates identity and measurements from canonical V8 without legacy reads', async () => {
    renderDrawer();
    expect(await screen.findByText('KPI Alpha')).toBeInTheDocument();
    expect(V8ResultsApi.getKpiCatalog).toHaveBeenCalledWith({ kpiId: 'kpi-1' });
    expect(V8ResultsApi.getKpiDrawerDetail).toHaveBeenCalledWith('kpi-1');
    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpis/kpi-1/time-series');
    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpis/kpi-1/deviation-cases?openOnly=1');
  });

  it('keeps legacy measurement and definition mutations unavailable', async () => {
    renderDrawer();
    expect(await screen.findByText('KPI Alpha')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Record New Value' }));
    expect(screen.getByText(/This legacy KPI is read-only/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open canonical measurements' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Definition' }));
    expect(screen.getByRole('button', { name: /Edit governed definition/ })).toBeInTheDocument();
    expect(V8ResultsApi.createKpiTimeSeriesValue).not.toHaveBeenCalled();
    expect(V8ResultsApi.updateKpi).not.toHaveBeenCalled();
    expect(V8ResultsApi.deleteKpi).not.toHaveBeenCalled();
    expect(Api.post).not.toHaveBeenCalled();
    expect(Api.put).not.toHaveBeenCalled();
    expect(Api.delete).not.toHaveBeenCalled();
  });

  it('uses bounded legacy reads only for an unavailable canonical detail capability', async () => {
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url === '/benefits/kpis/kpi-1/time-series') return { data: [] } as any;
      if (url === '/benefits/kpis/kpi-1/deviation-cases?openOnly=1') return { data: [] } as any;
      throw new Error(`Unexpected GET ${url}`);
    });

    renderDrawer();
    await waitFor(() => {
      expect(Api.get).toHaveBeenCalledWith('/benefits/kpis/kpi-1/time-series');
      expect(Api.get).toHaveBeenCalledWith('/benefits/kpis/kpi-1/deviation-cases?openOnly=1');
    });
  });

  it('fails closed on authorization errors instead of falling back to legacy', async () => {
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockRejectedValue({ status: 403 });
    renderDrawer();
    await waitFor(() => expect(V8ResultsApi.getKpiDrawerDetail).toHaveBeenCalled());
    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpis/kpi-1/time-series');
    expect(Api.get).not.toHaveBeenCalledWith('/benefits/kpis/kpi-1/deviation-cases?openOnly=1');
  });
});
