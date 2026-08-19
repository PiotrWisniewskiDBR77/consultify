/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

vi.mock('@/components/Economics/financeFeatureFlags', () => ({
  isFinanceFlagEnabled: () => false,
}));

const { getRoiInitiativeDetail } = vi.hoisted(() => ({ getRoiInitiativeDetail: vi.fn() }));
vi.mock('@/services/api/v8/results', () => ({
  V8ResultsApi: { getRoiInitiativeDetail },
  shouldFallbackToLegacyResults: () => false,
}));
vi.mock('@/services/api', () => ({ Api: { get: vi.fn() } }));
vi.mock('../ROIAssumptionEditor', () => ({
  ROIAssumptionEditor: ({ disabled }: { disabled?: boolean }) => (
    <div data-testid="roi-assumptions-archive" data-disabled={String(disabled)} />
  ),
}));

import { ROIDetailDrawer } from '../ROIDetailDrawer';

describe('ROIDetailDrawer — RESULTS-W48/W49 cutover', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRoiInitiativeDetail.mockResolvedValue({
      organizationId: 'org-1',
      initiativeId: 'initiative-1',
      variance: { hasAssumptions: true, projected: { totalBenefit: 1200 } },
      assumptions: { expectedRevenueDelta: 1200, confidence: 'medium' },
      realized: [],
    });
  });

  it('renders historical data read-only and routes all new ROI work to the canonical workspace', async () => {
    render(
      <ROIDetailDrawer
        initiativeId="initiative-1"
        initiativeName="Legacy initiative"
        onClose={vi.fn()}
        lockState="open"
      />
    );

    await waitFor(() => expect(getRoiInitiativeDetail).toHaveBeenCalledWith('initiative-1'));
    expect(screen.getByTestId('legacy-roi-archive-notice')).toBeInTheDocument();
    expect(screen.getByTestId('roi-assumptions-archive')).toHaveAttribute('data-disabled', 'true');
    expect(screen.getByRole('link', { name: 'Open ROI Case workspace' })).toHaveAttribute(
      'href',
      '/results/roi'
    );
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Submit' })).not.toBeInTheDocument();
  });
});
