/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? _key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../src/components/Results/ROIAssumptionEditor', () => ({
  ROIAssumptionEditor: () => <div>roi-assumption-editor</div>,
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
  },
  shouldFallbackToLegacyResults: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { ROIDetailDrawer } from '../../../src/components/Results/ROIDetailDrawer';
import { Api } from '../../../src/services/api';
import { V8ResultsApi } from '../../../src/services/api/v8/results';

describe('ROIDetailDrawer V8 detail seam', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads ROI detail from the governed V8 route before touching legacy drawer reads', async () => {
    vi.mocked(V8ResultsApi.getRoiInitiativeDetail).mockResolvedValue({
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
        confidence: 'medium',
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
    } as any);

    render(
      <ROIDetailDrawer initiativeId="init-1" initiativeName="Initiative Alpha" onClose={vi.fn()} />
    );

    await waitFor(() => {
      expect(screen.getByText('Initiative Alpha')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
    });

    expect(V8ResultsApi.getRoiInitiativeDetail).toHaveBeenCalledWith('init-1');
    expect(Api.get).not.toHaveBeenCalled();
  });

  it('falls back to bounded legacy drawer reads only for compatibility errors', async () => {
    vi.mocked(V8ResultsApi.getRoiInitiativeDetail).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockImplementation(async (url: string) => {
      if (url.endsWith('/variance')) {
        return {
          data: {
            hasAssumptions: false,
            variance: null,
          },
        } as any;
      }
      if (url.endsWith('/assumptions')) {
        return { data: null } as any;
      }
      if (url.endsWith('/realized')) {
        return { data: [] } as any;
      }
      throw new Error(`Unexpected GET ${url}`);
    });

    render(
      <ROIDetailDrawer initiativeId="init-2" initiativeName="Initiative Beta" onClose={vi.fn()} />
    );

    await waitFor(() => {
      expect(V8ResultsApi.getRoiInitiativeDetail).toHaveBeenCalledWith('init-2');
      expect(Api.get).toHaveBeenCalledWith('/benefits/roi/init-2/variance');
      expect(Api.get).toHaveBeenCalledWith('/benefits/roi/init-2/assumptions');
      expect(Api.get).toHaveBeenCalledWith('/benefits/roi/init-2/realized');
    });
  });
});
