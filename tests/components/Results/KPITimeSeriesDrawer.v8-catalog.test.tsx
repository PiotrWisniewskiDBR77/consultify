/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    createKpiTimeSeriesValue: vi.fn(),
    updateKpi: vi.fn(),
    deleteKpi: vi.fn(),
    createKpiMapping: vi.fn(),
    deleteKpiMapping: vi.fn(),
    acknowledgeDeviationCase: vi.fn(),
    updateDeviationCaseRca: vi.fn(),
    createDeviationAction: vi.fn(),
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

  it('records KPI time-series through the governed V8 route before legacy fallback', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [{ id: 'kpi-1', name: 'KPI Alpha', measurementFrequency: 'MONTHLY', createdAt: '2026-01-01T00:00:00.000Z' }],
      mappings: [],
    } as any);
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockResolvedValue({
      organizationId: 'org-1',
      kpiId: 'kpi-1',
      measurements: [],
      openCase: null,
    } as any);
    vi.mocked(V8ResultsApi.createKpiTimeSeriesValue).mockResolvedValue({
      id: 'ts-1',
      kpiId: 'kpi-1',
      value: 24,
      measuredAt: '2026-03-01',
      periodStart: '2026-03-01',
      periodKey: '2026-03',
    } as any);

    render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('KPI Alpha')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Value'), { target: { value: '24' } });
    fireEvent.change(screen.getByDisplayValue(/\d{4}-\d{2}-\d{2}/), {
      target: { value: '2026-03-01' },
    });
    fireEvent.change(screen.getByPlaceholderText('Notes (optional)'), {
      target: { value: 'March value' },
    });
    fireEvent.click(screen.getByText('Record'));

    await waitFor(() => {
      expect(V8ResultsApi.createKpiTimeSeriesValue).toHaveBeenCalledWith('kpi-1', {
        value: 24,
        periodStart: '2026-03-01',
        notes: 'March value',
      });
    });

    expect(Api.post).not.toHaveBeenCalledWith('/benefits/kpis/kpi-1/time-series', expect.anything());
  });

  it('falls back to legacy KPI time-series record only for bounded compatibility errors', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [{ id: 'kpi-1', name: 'KPI Alpha', measurementFrequency: 'MONTHLY', createdAt: '2026-01-01T00:00:00.000Z' }],
      mappings: [],
    } as any);
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockResolvedValue({
      organizationId: 'org-1',
      kpiId: 'kpi-1',
      measurements: [],
      openCase: null,
    } as any);
    vi.mocked(V8ResultsApi.createKpiTimeSeriesValue).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({ success: true, data: { id: 'ts-1' } } as any);

    render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('KPI Alpha')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Value'), { target: { value: '24' } });
    fireEvent.change(screen.getByDisplayValue(/\d{4}-\d{2}-\d{2}/), {
      target: { value: '2026-03-01' },
    });
    fireEvent.change(screen.getByPlaceholderText('Notes (optional)'), {
      target: { value: 'March value' },
    });
    fireEvent.click(screen.getByText('Record'));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/benefits/kpis/kpi-1/time-series', {
        value: 24,
        periodStart: '2026-03-01',
        notes: 'March value',
      });
    });
  });

  it('saves KPI settings through the governed V8 route before legacy fallback', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [
        {
          id: 'kpi-1',
          name: 'KPI Alpha',
          description: 'Current description',
          unit: '%',
          latestValue: 12,
          targetValue: 20,
          baselineValue: 8,
          measurementFrequency: 'MONTHLY',
          direction: 'HIGHER_IS_BETTER',
          thresholdMode: 'PERCENT_FROM_TARGET',
          amberThresholdPct: 5,
          redThresholdPct: 10,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      mappings: [],
    } as any);
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockResolvedValue({
      organizationId: 'org-1',
      kpiId: 'kpi-1',
      measurements: [],
      openCase: null,
    } as any);
    vi.mocked(V8ResultsApi.updateKpi).mockResolvedValue({ success: true } as any);

    render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('KPI Alpha')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByDisplayValue('KPI Alpha'), {
      target: { value: 'KPI Alpha Updated' },
    });
    fireEvent.change(screen.getByDisplayValue('Current description'), {
      target: { value: 'Updated description' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(V8ResultsApi.updateKpi).toHaveBeenCalledWith('kpi-1', {
        name: 'KPI Alpha Updated',
        description: 'Updated description',
        unit: '%',
        baselineValue: 8,
        targetValue: 20,
        measurementFrequency: 'MONTHLY',
        direction: 'HIGHER_IS_BETTER',
        thresholdMode: 'PERCENT_FROM_TARGET',
        amberThresholdPct: 5,
        redThresholdPct: 10,
        amberThresholdAbs: null,
        redThresholdAbs: null,
      });
    });

    expect(Api.put).not.toHaveBeenCalledWith('/benefits/kpis/kpi-1', expect.anything());
  });

  it('falls back to legacy KPI settings save only for bounded compatibility errors', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [
        {
          id: 'kpi-1',
          name: 'KPI Alpha',
          description: 'Current description',
          unit: '%',
          latestValue: 12,
          targetValue: 20,
          baselineValue: 8,
          measurementFrequency: 'MONTHLY',
          direction: 'HIGHER_IS_BETTER',
          thresholdMode: 'PERCENT_FROM_TARGET',
          amberThresholdPct: 5,
          redThresholdPct: 10,
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      mappings: [],
    } as any);
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockResolvedValue({
      organizationId: 'org-1',
      kpiId: 'kpi-1',
      measurements: [],
      openCase: null,
    } as any);
    vi.mocked(V8ResultsApi.updateKpi).mockRejectedValue({ status: 404 });
    vi.mocked(Api.put).mockResolvedValue({ success: true } as any);

    render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('KPI Alpha')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Edit'));
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(Api.put).toHaveBeenCalledWith('/benefits/kpis/kpi-1', {
        name: 'KPI Alpha',
        description: 'Current description',
        unit: '%',
        baselineValue: 8,
        targetValue: 20,
        measurementFrequency: 'MONTHLY',
        direction: 'HIGHER_IS_BETTER',
        thresholdMode: 'PERCENT_FROM_TARGET',
        amberThresholdPct: 5,
        redThresholdPct: 10,
        amberThresholdAbs: null,
        redThresholdAbs: null,
      });
    });
  });

  it('links initiatives through the governed V8 route before legacy fallback', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [
        {
          id: 'kpi-1',
          name: 'KPI Alpha',
          measurementFrequency: 'MONTHLY',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      mappings: [],
    } as any);
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockResolvedValue({
      organizationId: 'org-1',
      kpiId: 'kpi-1',
      measurements: [],
      openCase: null,
    } as any);
    vi.mocked(V8ResultsApi.createKpiMapping).mockResolvedValue({
      id: 'map-1',
      kpiId: 'kpi-1',
      initiativeId: 'init-1',
    } as any);

    render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('KPI Alpha')).toBeInTheDocument();
      expect(screen.getByText('Initiative Alpha')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Initiative Alpha'));

    await waitFor(() => {
      expect(V8ResultsApi.createKpiMapping).toHaveBeenCalledWith({
        initiativeId: 'init-1',
        kpiId: 'kpi-1',
        impactWeight: 1,
        impactDirection: 'increase',
        confidence: 'medium',
      });
    });

    expect(Api.post).not.toHaveBeenCalledWith('/benefits/kpi-mappings', expect.anything());
  });

  it('falls back to legacy initiative link only for bounded compatibility errors', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [
        {
          id: 'kpi-1',
          name: 'KPI Alpha',
          measurementFrequency: 'MONTHLY',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      mappings: [],
    } as any);
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockResolvedValue({
      organizationId: 'org-1',
      kpiId: 'kpi-1',
      measurements: [],
      openCase: null,
    } as any);
    vi.mocked(V8ResultsApi.createKpiMapping).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({ success: true, data: { id: 'map-1' } } as any);

    render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Initiative Alpha')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Initiative Alpha'));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/benefits/kpi-mappings', {
        initiativeId: 'init-1',
        kpiId: 'kpi-1',
        impactWeight: 1,
        impactDirection: 'increase',
        confidence: 'medium',
      });
    });
  });

  it('unlinks initiatives through the governed V8 route before legacy fallback', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [
        {
          id: 'kpi-1',
          name: 'KPI Alpha',
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
      measurements: [],
      openCase: null,
    } as any);
    vi.mocked(V8ResultsApi.deleteKpiMapping).mockResolvedValue({ success: true } as any);

    render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Initiative Alpha')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Remove'));

    await waitFor(() => {
      expect(V8ResultsApi.deleteKpiMapping).toHaveBeenCalledWith('map-1');
    });

    expect(Api.delete).not.toHaveBeenCalledWith('/benefits/kpi-mappings/map-1');
  });

  it('falls back to legacy initiative unlink only for bounded compatibility errors', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [
        {
          id: 'kpi-1',
          name: 'KPI Alpha',
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
      measurements: [],
      openCase: null,
    } as any);
    vi.mocked(V8ResultsApi.deleteKpiMapping).mockRejectedValue({ status: 404 });
    vi.mocked(Api.delete).mockResolvedValue({ success: true } as any);

    render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Initiative Alpha')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTitle('Remove'));

    await waitFor(() => {
      expect(Api.delete).toHaveBeenCalledWith('/benefits/kpi-mappings/map-1');
    });
  });

  it('deletes KPI through the governed V8 route before legacy fallback', async () => {
    const onClose = vi.fn();
    const onValueRecorded = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [
        {
          id: 'kpi-1',
          name: 'KPI Alpha',
          measurementFrequency: 'MONTHLY',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      mappings: [],
    } as any);
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockResolvedValue({
      organizationId: 'org-1',
      kpiId: 'kpi-1',
      measurements: [],
      openCase: null,
    } as any);
    vi.mocked(V8ResultsApi.deleteKpi).mockResolvedValue({ success: true } as any);

    render(
      <KPITimeSeriesDrawer kpiId="kpi-1" onClose={onClose} onValueRecorded={onValueRecorded} />
    );

    await waitFor(() => {
      expect(screen.getByText('KPI Alpha')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(V8ResultsApi.deleteKpi).toHaveBeenCalledWith('kpi-1');
      expect(onValueRecorded).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    expect(Api.delete).not.toHaveBeenCalledWith('/benefits/kpis/kpi-1');
    confirmSpy.mockRestore();
  });

  it('falls back to legacy KPI delete only for bounded compatibility errors', async () => {
    const onClose = vi.fn();
    const onValueRecorded = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [
        {
          id: 'kpi-1',
          name: 'KPI Alpha',
          measurementFrequency: 'MONTHLY',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      mappings: [],
    } as any);
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockResolvedValue({
      organizationId: 'org-1',
      kpiId: 'kpi-1',
      measurements: [],
      openCase: null,
    } as any);
    vi.mocked(V8ResultsApi.deleteKpi).mockRejectedValue({ status: 404 });
    vi.mocked(Api.delete).mockResolvedValue({ success: true } as any);

    render(
      <KPITimeSeriesDrawer kpiId="kpi-1" onClose={onClose} onValueRecorded={onValueRecorded} />
    );

    await waitFor(() => {
      expect(screen.getByText('KPI Alpha')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Delete'));

    await waitFor(() => {
      expect(Api.delete).toHaveBeenCalledWith('/benefits/kpis/kpi-1');
      expect(onValueRecorded).toHaveBeenCalled();
      expect(onClose).toHaveBeenCalled();
    });

    confirmSpy.mockRestore();
  });

  it('acknowledges deviation cases through the governed V8 route before legacy fallback', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [
        {
          id: 'kpi-1',
          name: 'KPI Alpha',
          measurementFrequency: 'MONTHLY',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      mappings: [],
    } as any);
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockResolvedValue({
      organizationId: 'org-1',
      kpiId: 'kpi-1',
      measurements: [],
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
    vi.mocked(V8ResultsApi.acknowledgeDeviationCase).mockResolvedValue({ success: true } as any);

    render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Acknowledge')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Acknowledge'));

    await waitFor(() => {
      expect(V8ResultsApi.acknowledgeDeviationCase).toHaveBeenCalledWith('case-1');
    });

    expect(Api.post).not.toHaveBeenCalledWith('/benefits/deviation-cases/case-1/acknowledge', {});
  });

  it('falls back to legacy deviation acknowledge only for bounded compatibility errors', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [
        {
          id: 'kpi-1',
          name: 'KPI Alpha',
          measurementFrequency: 'MONTHLY',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      mappings: [],
    } as any);
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockResolvedValue({
      organizationId: 'org-1',
      kpiId: 'kpi-1',
      measurements: [],
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
    vi.mocked(V8ResultsApi.acknowledgeDeviationCase).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({ success: true } as any);

    render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Acknowledge')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Acknowledge'));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/benefits/deviation-cases/case-1/acknowledge', {});
    });
  });

  it('saves deviation RCA through the governed V8 route before legacy fallback', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [
        {
          id: 'kpi-1',
          name: 'KPI Alpha',
          measurementFrequency: 'MONTHLY',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      mappings: [],
    } as any);
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockResolvedValue({
      organizationId: 'org-1',
      kpiId: 'kpi-1',
      measurements: [],
      openCase: {
        id: 'case-1',
        kpiId: 'kpi-1',
        organizationId: 'org-1',
        severity: 'RED',
        status: 'OPEN',
        deviationSummary: 'Below target',
        rcaText: '',
        actions: [],
      },
    } as any);
    vi.mocked(V8ResultsApi.updateDeviationCaseRca).mockResolvedValue({ success: true } as any);

    render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Acknowledge')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Explain the root cause...'), {
      target: { value: 'Root cause analysis details' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(V8ResultsApi.updateDeviationCaseRca).toHaveBeenCalledWith('case-1', {
        rcaText: 'Root cause analysis details',
      });
    });

    expect(Api.put).not.toHaveBeenCalledWith('/benefits/deviation-cases/case-1/rca', expect.anything());
  });

  it('falls back to legacy deviation RCA save only for bounded compatibility errors', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [
        {
          id: 'kpi-1',
          name: 'KPI Alpha',
          measurementFrequency: 'MONTHLY',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      mappings: [],
    } as any);
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockResolvedValue({
      organizationId: 'org-1',
      kpiId: 'kpi-1',
      measurements: [],
      openCase: {
        id: 'case-1',
        kpiId: 'kpi-1',
        organizationId: 'org-1',
        severity: 'RED',
        status: 'OPEN',
        deviationSummary: 'Below target',
        rcaText: '',
        actions: [],
      },
    } as any);
    vi.mocked(V8ResultsApi.updateDeviationCaseRca).mockRejectedValue({ status: 404 });
    vi.mocked(Api.put).mockResolvedValue({ success: true } as any);

    render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Acknowledge')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('Explain the root cause...'), {
      target: { value: 'Root cause analysis details' },
    });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(Api.put).toHaveBeenCalledWith('/benefits/deviation-cases/case-1/rca', {
        rcaText: 'Root cause analysis details',
      });
    });
  });

  it('adds deviation actions through the governed V8 route before legacy fallback', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [
        {
          id: 'kpi-1',
          name: 'KPI Alpha',
          measurementFrequency: 'MONTHLY',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      mappings: [],
    } as any);
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockResolvedValue({
      organizationId: 'org-1',
      kpiId: 'kpi-1',
      measurements: [],
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
    vi.mocked(V8ResultsApi.createDeviationAction).mockResolvedValue({
      id: 'action-1',
      caseId: 'case-1',
    } as any);

    const { container } = render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Add action')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('New action'), {
      target: { value: 'Create mitigation plan' },
    });
    fireEvent.change(container.querySelector('input[type="date"]') as HTMLInputElement, {
      target: { value: '2026-03-31' },
    });
    fireEvent.click(screen.getByText('Add action'));

    await waitFor(() => {
      expect(V8ResultsApi.createDeviationAction).toHaveBeenCalledWith('case-1', {
        title: 'Create mitigation plan',
        dueDate: '2026-03-31',
      });
    });

    expect(Api.post).not.toHaveBeenCalledWith('/benefits/deviation-cases/case-1/actions', expect.anything());
  });

  it('falls back to legacy deviation action create only for bounded compatibility errors', async () => {
    vi.mocked(V8ResultsApi.getKpiCatalog).mockResolvedValue({
      organizationId: 'org-1',
      kpis: [
        {
          id: 'kpi-1',
          name: 'KPI Alpha',
          measurementFrequency: 'MONTHLY',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
      mappings: [],
    } as any);
    vi.mocked(V8ResultsApi.getKpiDrawerDetail).mockResolvedValue({
      organizationId: 'org-1',
      kpiId: 'kpi-1',
      measurements: [],
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
    vi.mocked(V8ResultsApi.createDeviationAction).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({ success: true, data: { id: 'action-1' } } as any);

    const { container } = render(<KPITimeSeriesDrawer kpiId="kpi-1" onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Add action')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByPlaceholderText('New action'), {
      target: { value: 'Create mitigation plan' },
    });
    fireEvent.change(container.querySelector('input[type="date"]') as HTMLInputElement, {
      target: { value: '2026-03-31' },
    });
    fireEvent.click(screen.getByText('Add action'));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/benefits/deviation-cases/case-1/actions', {
        title: 'Create mitigation plan',
        dueDate: '2026-03-31',
      });
    });
  });
});
