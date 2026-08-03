/**
 * @vitest-environment jsdom
 *
 * FIN-007 — proof that the ACTIVE ROIDetailDrawer (not the form in
 * isolation) actually mounts PostInvestmentActualForm/PostInvestmentReviewPanel
 * behind the `fin007PostInvestmentReview` flag, and that a created review
 * refreshes the read panel through the drawer's own state — not just that
 * the two components individually behave correctly.
 *
 * Only the network boundary is mocked (V8ResultsApi for the drawer's own
 * initiative-detail fetch, the financeValue/execution-control clients the
 * REAL child components call) — PostInvestmentActualForm and
 * PostInvestmentReviewPanel themselves are NOT mocked; they render for real
 * inside the real drawer.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, optsOrDefault?: any) => {
      const def = typeof optsOrDefault === 'string' ? optsOrDefault : optsOrDefault?.defaultValue;
      let out = def ?? k;
      if (optsOrDefault && typeof optsOrDefault === 'object' && typeof out === 'string') {
        out = out.replace(/\{\{(\w+)\}\}/g, (_m: string, key: string) =>
          optsOrDefault[key] != null ? String(optsOrDefault[key]) : ''
        );
      }
      return out;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

const { isFinanceFlagEnabled } = vi.hoisted(() => ({ isFinanceFlagEnabled: vi.fn() }));
vi.mock('@/components/Economics/financeFeatureFlags', () => ({ isFinanceFlagEnabled }));

const { getRoiInitiativeDetail } = vi.hoisted(() => ({ getRoiInitiativeDetail: vi.fn() }));
vi.mock('@/services/api/v8/results', () => ({
  V8ResultsApi: { getRoiInitiativeDetail },
  shouldFallbackToLegacyResults: () => false,
}));
vi.mock('@/services/api', () => ({ Api: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));

const { getApprovedBaselines, createPostInvestmentReview, listPostInvestmentReviews } = vi.hoisted(
  () => ({
    getApprovedBaselines: vi.fn(),
    createPostInvestmentReview: vi.fn(),
    listPostInvestmentReviews: vi.fn(),
  })
);
vi.mock('@/services/api/v8/financeValue', () => ({
  getApprovedBaselines,
  createPostInvestmentReview,
  listPostInvestmentReviews,
}));

const { recordBaselineRealization } = vi.hoisted(() => ({ recordBaselineRealization: vi.fn() }));
vi.mock('@/services/api/v8/execution-control', () => ({
  V8ExecutionControlApi: { recordBaselineRealization },
}));

// ROIAssumptionEditor pulls in a chunk of unrelated form UI not relevant
// here — stubbed to keep this test focused on the FIN-007 mount question,
// exactly like the pre-existing ROIDetailDrawer.v8-assumptions-write.test.tsx
// stubs it.
vi.mock('../ROIAssumptionEditor', () => ({
  ROIAssumptionEditor: () => null,
}));

import { ROIDetailDrawer } from '../ROIDetailDrawer';

const ROI_DETAIL = {
  organizationId: 'org-1',
  initiativeId: 'init-fin007-mount',
  variance: { hasAssumptions: false },
  assumptions: null,
  realized: [],
};

const BASELINE = {
  modelId: 'model-mount-1',
  name: 'Mount Test Baseline',
  version: 1,
  approvedAt: '2026-01-01T00:00:00.000Z',
  startDate: '2026-01-01',
};

describe('ROIDetailDrawer — FIN-007 flag-gated mount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRoiInitiativeDetail.mockResolvedValue(ROI_DETAIL);
  });

  it('flag OFF: neither PostInvestmentActualForm nor PostInvestmentReviewPanel mount, and neither fires its own network call', async () => {
    isFinanceFlagEnabled.mockReturnValue(false);
    listPostInvestmentReviews.mockResolvedValue([]);
    getApprovedBaselines.mockResolvedValue([]);

    render(
      <ROIDetailDrawer
        initiativeId="init-fin007-mount"
        initiativeName="Mount Test Initiative"
        onClose={vi.fn()}
      />
    );

    await waitFor(() => expect(getRoiInitiativeDetail).toHaveBeenCalledTimes(1));
    // Give any (incorrect) mount attempt a tick to fire its fetch.
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByTestId('post-investment-actual-form')).toBeNull();
    expect(screen.queryByTestId('post-investment-actual-form-no-baseline')).toBeNull();
    expect(screen.queryByTestId('post-investment-review-panel')).toBeNull();
    expect(screen.queryByTestId('post-investment-review-empty')).toBeNull();
    expect(getApprovedBaselines).not.toHaveBeenCalled();
    expect(listPostInvestmentReviews).not.toHaveBeenCalled();
  });

  it('flag ON: the real drawer mounts the form with the right initiativeId, requests approved baselines, and creating a review refreshes the panel via a fresh GET', async () => {
    isFinanceFlagEnabled.mockReturnValue(true);
    getApprovedBaselines.mockResolvedValue([BASELINE]);
    listPostInvestmentReviews.mockResolvedValueOnce([]); // panel's initial fetch

    render(
      <ROIDetailDrawer
        initiativeId="init-fin007-mount"
        initiativeName="Mount Test Initiative"
        onClose={vi.fn()}
      />
    );

    // Both real children mounted.
    await waitFor(() => expect(screen.getByTestId('post-investment-actual-form')).toBeTruthy());
    await waitFor(() => expect(screen.getByTestId('post-investment-review-empty')).toBeTruthy());

    // The form requested approved baselines for THIS initiative.
    expect(getApprovedBaselines).toHaveBeenCalledWith('init-fin007-mount');
    // The panel's own initial fetch also used the same initiativeId.
    expect(listPostInvestmentReviews).toHaveBeenCalledWith('init-fin007-mount');
    expect(listPostInvestmentReviews).toHaveBeenCalledTimes(1);

    // Record an actual, then create the review.
    recordBaselineRealization.mockResolvedValueOnce({ entry: { id: 'roi-actual-mount-1' } });
    fireEvent.change(screen.getByTestId('post-investment-revenue-delta'), {
      target: { value: '1000' },
    });
    fireEvent.submit(screen.getByTestId('post-investment-actual-form').querySelector('form')!);
    await waitFor(() => expect(screen.getByTestId('post-investment-actual-success')).toBeTruthy());

    expect(recordBaselineRealization).toHaveBeenCalledWith(
      expect.objectContaining({ initiativeId: 'init-fin007-mount' }),
      expect.any(String)
    );

    createPostInvestmentReview.mockResolvedValueOnce({ id: 'fpir-mount-1' });
    listPostInvestmentReviews.mockResolvedValueOnce([
      {
        id: 'fpir-mount-1',
        organizationId: 'org-1',
        initiativeId: 'init-fin007-mount',
        baselineModelId: BASELINE.modelId,
        baselineVersion: BASELINE.version,
        baselineStatementType: 'P&L',
        baselineLineCode: 'REVENUE',
        baselinePeriodDate: '2026-01-01',
        projectedValue: 1000,
        actualIds: ['roi-actual-mount-1'],
        actualPeriodMonth: '2026-01-01',
        realizedValue: 1000,
        variance: 0,
        variancePct: 0,
        reconciliationStatus: 'matched',
        evidence: null,
        status: 'completed',
        createdBy: 'user-1',
        createdAt: '2026-01-01T00:00:00.000Z',
        completedAt: '2026-01-01T00:00:00.000Z',
      },
    ]); // the panel's post-refresh fetch

    fireEvent.submit(screen.getByTestId('post-investment-create-review-form'));

    // The refresh is a fresh GET, not a client-side merge: listPostInvestmentReviews
    // is called a SECOND time, driven by the drawer's own refreshNonce bump.
    await waitFor(() => expect(listPostInvestmentReviews).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.getByTestId('post-investment-review-panel')).toBeTruthy());
    expect(screen.getByText(/Matched/i)).toBeTruthy();
  });
});
