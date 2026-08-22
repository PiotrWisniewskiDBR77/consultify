/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KPICreateModal } from '../../../src/components/Results/KPICreateModal';
import { Api } from '../../../src/services/api';
import { V8ResultsApi } from '../../../src/services/api/v8/results';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../../src/services/api/v8/results', () => ({
  V8ResultsApi: {
    createKpi: vi.fn(),
    createKpiMapping: vi.fn(),
  },
  shouldFallbackToLegacyResults: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

describe('KPICreateModal V8 write seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Api.get).mockResolvedValue({
      data: [{ id: 'init-1', name: 'Initiative Alpha' }],
    } as any);
  });

  it('creates KPI and mappings through the governed V8 results namespace before legacy writes', async () => {
    const onSuccess = vi.fn();
    vi.mocked(V8ResultsApi.createKpi).mockResolvedValue({ id: 'kpi-v8-1' } as any);
    vi.mocked(V8ResultsApi.createKpiMapping).mockResolvedValue({
      id: 'map-v8-1',
      initiativeId: 'init-1',
      kpiId: 'kpi-v8-1',
    } as any);

    render(<KPICreateModal onClose={vi.fn()} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Revenue Growth %'), {
      target: { value: 'Revenue Growth' },
    });

    const initiativeCheckbox = await screen.findByRole('checkbox');
    fireEvent.click(initiativeCheckbox);
    fireEvent.click(screen.getByRole('button', { name: 'Create KPI' }));

    await waitFor(() => {
      expect(V8ResultsApi.createKpi).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Revenue Growth',
          measurementFrequency: 'MONTHLY',
          direction: 'HIGHER_IS_BETTER',
          thresholdMode: 'PERCENT_FROM_TARGET',
          amberThresholdPct: 0.1,
          redThresholdPct: 0.2,
        })
      );
    });

    expect(V8ResultsApi.createKpiMapping).toHaveBeenCalledWith(
      expect.objectContaining({
        initiativeId: 'init-1',
        kpiId: 'kpi-v8-1',
        impactDirection: 'increase',
      })
    );
    expect(Api.post).not.toHaveBeenCalledWith('/benefits/kpis', expect.anything());
    expect(Api.post).not.toHaveBeenCalledWith('/benefits/kpi-mappings', expect.anything());
    expect(onSuccess).toHaveBeenCalled();
  });

  it('falls back to legacy write routes only for bounded compatibility errors', async () => {
    const onSuccess = vi.fn();
    vi.mocked(V8ResultsApi.createKpi).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post)
      .mockResolvedValueOnce({ data: { id: 'kpi-legacy-1' } } as any)
      .mockResolvedValueOnce({ data: { id: 'map-legacy-1' } } as any);
    vi.mocked(V8ResultsApi.createKpiMapping).mockRejectedValue({ status: 404 });

    render(<KPICreateModal onClose={vi.fn()} onSuccess={onSuccess} />);

    fireEvent.change(screen.getByPlaceholderText('e.g. Revenue Growth %'), {
      target: { value: 'Revenue Growth' },
    });

    const initiativeCheckbox = await screen.findByRole('checkbox');
    fireEvent.click(initiativeCheckbox);
    fireEvent.click(screen.getByRole('button', { name: 'Create KPI' }));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith(
        '/benefits/kpis',
        expect.objectContaining({ name: 'Revenue Growth' })
      );
    });

    expect(Api.post).toHaveBeenCalledWith(
      '/benefits/kpi-mappings',
      expect.objectContaining({
        initiativeId: 'init-1',
        kpiId: 'kpi-legacy-1',
      })
    );
    expect(onSuccess).toHaveBeenCalled();
  });
});
