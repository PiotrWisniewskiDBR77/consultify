/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) => (typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key)),
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../src/components/Results/ROIAssumptionEditor', () => ({
  ROIAssumptionEditor: ({ onSave }: { onSave: () => Promise<void> }) => (
    <button type="button" onClick={() => void onSave()}>
      save-roi-assumptions
    </button>
  ),
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: vi.fn(),
    put: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../../src/services/api/v8/results', () => ({
  V8ResultsApi: {
    getRoiInitiativeDetail: vi.fn(),
    updateRoiInitiativeAssumptions: vi.fn(),
    createRoiInitiativeRealizedEntry: vi.fn(),
  },
  shouldFallbackToLegacyResults: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { ROIDetailDrawer } from '../../../src/components/Results/ROIDetailDrawer';
import { Api } from '../../../src/services/api';
import { V8ResultsApi } from '../../../src/services/api/v8/results';

const detailPayload = {
  organizationId: 'org-1',
  initiativeId: 'init-1',
  variance: {
    hasAssumptions: true,
    projected: { totalBenefit: 300 },
    realized: { revenueDelta: 0, costDelta: 0, savings: 120, totalBenefit: 120, dataPoints: 1 },
    variance: { absolute: -180, percent: -60, status: 'below_plan' },
  },
  assumptions: {
    expectedRevenueDelta: 200,
    expectedCostDelta: 100,
    capex: 50,
    opexAnnual: 20,
    horizonMonths: 24,
    confidence: 'medium',
    assumptionsOwner: 'owner-1',
    assumptionsText: 'Updated from drawer',
  },
  realized: [
    {
      id: 'real-1',
      periodMonth: '2026-03-01',
      realizedSavings: 120,
      varianceNotes: 'note',
      createdAt: '2026-03-05T00:00:00.000Z',
    },
  ],
} as any;

describe('ROIDetailDrawer V8 assumptions write seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V8ResultsApi.getRoiInitiativeDetail).mockResolvedValue(detailPayload);
  });

  it('saves ROI assumptions through the governed V8 route before legacy write fallback', async () => {
    vi.mocked(V8ResultsApi.updateRoiInitiativeAssumptions).mockResolvedValue({ success: true } as any);

    render(
      <ROIDetailDrawer initiativeId="init-1" initiativeName="Initiative Alpha" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('save-roi-assumptions')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('save-roi-assumptions'));

    await waitFor(() => {
      expect(V8ResultsApi.updateRoiInitiativeAssumptions).toHaveBeenCalledWith('init-1', {
        expectedRevenueDelta: 200,
        expectedCostDelta: 100,
        capex: 50,
        opexAnnual: 20,
        horizonMonths: 24,
        effectStartDate: undefined,
        confidence: 'medium',
        assumptionsOwner: 'owner-1',
        assumptionsText: 'Updated from drawer',
      });
    });

    expect(Api.put).not.toHaveBeenCalled();
  });

  it('falls back to the legacy assumptions write only for bounded compatibility errors', async () => {
    vi.mocked(V8ResultsApi.updateRoiInitiativeAssumptions).mockRejectedValue({ status: 404 });
    vi.mocked(Api.put).mockResolvedValue({ success: true } as any);

    render(
      <ROIDetailDrawer initiativeId="init-1" initiativeName="Initiative Alpha" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('save-roi-assumptions')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('save-roi-assumptions'));

    await waitFor(() => {
      expect(Api.put).toHaveBeenCalledWith('/benefits/roi/init-1/assumptions', {
        expectedRevenueDelta: 200,
        expectedCostDelta: 100,
        capex: 50,
        opexAnnual: 20,
        horizonMonths: 24,
        effectStartDate: undefined,
        confidence: 'medium',
        assumptionsOwner: 'owner-1',
        assumptionsText: 'Updated from drawer',
      });
    });
  });

  it('creates ROI realized entry through the governed V8 route before legacy write fallback', async () => {
    vi.mocked(V8ResultsApi.createRoiInitiativeRealizedEntry).mockResolvedValue({ id: 'real-2' } as any);

    const { container } = render(
      <ROIDetailDrawer initiativeId="init-1" initiativeName="Initiative Alpha" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('save-roi-assumptions')).toBeInTheDocument();
    });

    const monthInput = container.querySelector('input[type="month"]') as HTMLInputElement | null;
    const amountInput = container.querySelector('input[placeholder="0"]') as HTMLInputElement | null;
    expect(monthInput).toBeTruthy();
    expect(amountInput).toBeTruthy();

    fireEvent.change(monthInput!, { target: { value: '2026-04' } });
    fireEvent.change(amountInput!, { target: { value: '250' } });
    fireEvent.change(screen.getByPlaceholderText('Notes (optional)'), {
      target: { value: 'April realized' },
    });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(V8ResultsApi.createRoiInitiativeRealizedEntry).toHaveBeenCalledWith('init-1', {
        periodMonth: '2026-04-01',
        realizedSavings: 250,
        varianceNotes: 'April realized',
        source: 'manual',
      });
    });

    expect(Api.post).not.toHaveBeenCalledWith('/benefits/roi/init-1/realized', expect.anything());
  });

  it('falls back to the legacy realized-entry write only for bounded compatibility errors', async () => {
    vi.mocked(V8ResultsApi.createRoiInitiativeRealizedEntry).mockRejectedValue({ status: 404 });
    vi.mocked(Api.post).mockResolvedValue({ success: true, data: { id: 'real-2' } } as any);

    const { container } = render(
      <ROIDetailDrawer initiativeId="init-1" initiativeName="Initiative Alpha" onClose={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('save-roi-assumptions')).toBeInTheDocument();
    });

    const monthInput = container.querySelector('input[type="month"]') as HTMLInputElement | null;
    const amountInput = container.querySelector('input[placeholder="0"]') as HTMLInputElement | null;
    expect(monthInput).toBeTruthy();
    expect(amountInput).toBeTruthy();

    fireEvent.change(monthInput!, { target: { value: '2026-04' } });
    fireEvent.change(amountInput!, { target: { value: '250' } });
    fireEvent.change(screen.getByPlaceholderText('Notes (optional)'), {
      target: { value: 'April realized' },
    });
    fireEvent.click(screen.getByText('Submit'));

    await waitFor(() => {
      expect(Api.post).toHaveBeenCalledWith('/benefits/roi/init-1/realized', {
        periodMonth: '2026-04-01',
        realizedSavings: 250,
        varianceNotes: 'April realized',
        source: 'manual',
      });
    });
  });
});
