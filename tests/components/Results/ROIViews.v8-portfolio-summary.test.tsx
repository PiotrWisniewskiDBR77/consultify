/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string | { defaultValue?: string }) =>
      (typeof fallback === 'string' ? fallback : fallback?.defaultValue) || _key,
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../src/components/Results/ROIDetailDrawer', () => ({
  ROIDetailDrawer: () => null,
}));

vi.mock('../../../src/services/funnelAnalytics', () => ({
  trackFunnelEvent: vi.fn(),
}));

vi.mock('../../../src/services/api', () => ({
  Api: {
    get: vi.fn(),
  },
}));

vi.mock('../../../src/services/api/v8/results', () => ({
  V8ResultsApi: {
    getRoiPortfolioSummary: vi.fn(),
  },
  shouldFallbackToLegacyResults: (error: any) => {
    const status = Number(error?.status);
    return [400, 404, 405, 501].includes(status);
  },
}));

import { ROIAnalysisView } from '../../../src/components/Results/ROIAnalysisView';
import { ROITrackingView } from '../../../src/components/Results/ROITrackingView';
import { Api } from '../../../src/services/api';
import { V8ResultsApi } from '../../../src/services/api/v8/results';

describe('Results ROI views V8 portfolio summary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('ROITrackingView reads the V8 portfolio summary before touching legacy benefits routes', async () => {
    vi.mocked(V8ResultsApi.getRoiPortfolioSummary).mockResolvedValue({
      organizationId: 'org-1',
      items: [
        {
          initiativeId: 'init-1',
          initiativeName: 'Initiative Alpha',
          status: 'DONE',
          priority: 'HIGH',
          capex: 100,
          opexAnnual: 20,
          projectedBenefit: 300,
          realizedBenefit: 120,
          variance: -180,
          confidence: 'medium',
          hasRealized: true,
        },
      ],
      summary: {
        totalProjected: 300,
        totalRealized: 120,
        totalCapex: 100,
        totalVariance: -180,
        initiativeCount: 1,
        coveragePercent: 100,
      },
    } as any);

    render(<ROITrackingView />);

    await waitFor(() => {
      expect(screen.getByText('Initiative Alpha')).toBeInTheDocument();
    });

    expect(V8ResultsApi.getRoiPortfolioSummary).toHaveBeenCalled();
    expect(Api.get).not.toHaveBeenCalled();
  });

  it('ROIAnalysisView falls back to the legacy portfolio summary only for bounded compatibility errors', async () => {
    vi.mocked(V8ResultsApi.getRoiPortfolioSummary).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockResolvedValue({
      data: {
        items: [
          {
            initiativeId: 'init-2',
            initiativeName: 'Initiative Beta',
            status: 'DONE',
            priority: 'MEDIUM',
            projectedBenefit: 200,
            realizedBenefit: 150,
            variance: -50,
            hasRealized: true,
          },
        ],
        summary: {
          totalProjected: 200,
          totalRealized: 150,
          totalCapex: 0,
          totalVariance: -50,
          initiativeCount: 1,
          coveragePercent: 100,
        },
      },
    } as any);

    render(<ROIAnalysisView />);

    await waitFor(() => {
      expect(screen.getByText('Initiative Beta')).toBeInTheDocument();
    });

    expect(V8ResultsApi.getRoiPortfolioSummary).toHaveBeenCalled();
    expect(Api.get).toHaveBeenCalledWith('/benefits/roi/portfolio/summary');
  });
});
