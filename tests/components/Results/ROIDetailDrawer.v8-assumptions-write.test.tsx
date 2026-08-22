/**
 * @vitest-environment jsdom
 * Historical initiative-shaped ROI is read-only. New writes belong to the
 * canonical ROI Case workspace with CAS, idempotency and audit.
 */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: any) =>
      typeof fallback === 'string' ? fallback : (fallback?.defaultValue ?? key),
    i18n: { language: 'en' },
  }),
}));

vi.mock('../../../src/services/api', () => ({
  Api: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));

vi.mock('../../../src/services/api/v8/results', () => ({
  V8ResultsApi: {
    getRoiInitiativeDetail: vi.fn(),
    updateRoiInitiativeAssumptions: vi.fn(),
    createRoiInitiativeRealizedEntry: vi.fn(),
  },
  shouldFallbackToLegacyResults: (error: any) =>
    [400, 404, 405, 501].includes(Number(error?.status)),
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
    realized: { savings: 120, totalBenefit: 120, dataPoints: 1 },
    variance: { absolute: -180, percent: -60, status: 'below_plan' },
  },
  assumptions: { expectedRevenueDelta: 200, confidence: 'medium' },
  realized: [{ id: 'real-1', periodMonth: '2026-03-01', realizedSavings: 120 }],
} as any;

describe('ROIDetailDrawer canonical write cutover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(V8ResultsApi.getRoiInitiativeDetail).mockResolvedValue(detailPayload);
  });

  it('reads canonical V8 detail and presents the historical surface as read-only', async () => {
    render(
      <ROIDetailDrawer initiativeId="init-1" initiativeName="Initiative Alpha" onClose={vi.fn()} />
    );

    expect(await screen.findByTestId('legacy-roi-archive-notice')).toHaveTextContent(
      'Historical ROI is read-only here'
    );
    expect(screen.getByRole('link', { name: /Open ROI Case workspace/ })).toHaveAttribute(
      'href',
      '/results/roi'
    );
    expect(V8ResultsApi.getRoiInitiativeDetail).toHaveBeenCalledWith('init-1');
    expect(V8ResultsApi.updateRoiInitiativeAssumptions).not.toHaveBeenCalled();
    expect(V8ResultsApi.createRoiInitiativeRealizedEntry).not.toHaveBeenCalled();
    expect(Api.put).not.toHaveBeenCalled();
    expect(Api.post).not.toHaveBeenCalled();
  });

  it('uses bounded legacy reads only when the canonical detail capability is unavailable', async () => {
    vi.mocked(V8ResultsApi.getRoiInitiativeDetail).mockRejectedValue({ status: 404 });
    vi.mocked(Api.get).mockResolvedValue({ data: [] } as any);

    render(
      <ROIDetailDrawer initiativeId="init-1" initiativeName="Initiative Alpha" onClose={vi.fn()} />
    );

    await waitFor(() => {
      expect(Api.get).toHaveBeenCalledWith('/benefits/roi/init-1/variance');
      expect(Api.get).toHaveBeenCalledWith('/benefits/roi/init-1/assumptions');
      expect(Api.get).toHaveBeenCalledWith('/benefits/roi/init-1/realized');
    });
    expect(await screen.findByTestId('legacy-roi-archive-notice')).toBeInTheDocument();
    expect(Api.put).not.toHaveBeenCalled();
    expect(Api.post).not.toHaveBeenCalled();
  });

  it('fails closed on authorization errors instead of reading legacy data', async () => {
    vi.mocked(V8ResultsApi.getRoiInitiativeDetail).mockRejectedValue({ status: 403 });

    render(
      <ROIDetailDrawer initiativeId="init-1" initiativeName="Initiative Alpha" onClose={vi.fn()} />
    );

    await waitFor(() => expect(V8ResultsApi.getRoiInitiativeDetail).toHaveBeenCalled());
    expect(Api.get).not.toHaveBeenCalled();
    expect(Api.put).not.toHaveBeenCalled();
    expect(Api.post).not.toHaveBeenCalled();
  });
});
