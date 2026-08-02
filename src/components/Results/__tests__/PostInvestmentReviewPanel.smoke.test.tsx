/**
 * @vitest-environment jsdom
 *
 * Smoke tests for PostInvestmentReviewPanel (FIN-007).
 * Mocks the V8 finance-value API client (network only — not the component's
 * own logic) so the panel renders deterministically offline. Asserts:
 *  - no reviews yet renders the honest empty state, never a fabricated verdict;
 *  - a completed review renders projected vs realized, the period, and the
 *    reconciliation status;
 *  - the evidence toggle opens to reveal the actual id(s) and recorder — the
 *    "může otworzyć evidence" requirement;
 *  - a second, independent render of the SAME data (simulating a hard reload,
 *    since this component has no client-side cache — every mount is a fresh
 *    GET) shows the identical review.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';

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

const { listPostInvestmentReviews } = vi.hoisted(() => ({
  listPostInvestmentReviews: vi.fn(),
}));

vi.mock('@/services/api/v8/financeValue', () => ({ listPostInvestmentReviews }));

import { PostInvestmentReviewPanel } from '../PostInvestmentReviewPanel';

const SAMPLE_REVIEW = {
  id: 'fpir-sample-1',
  organizationId: 'org-1',
  initiativeId: 'init-1',
  baselineModelId: 'model-abcdef123456',
  baselineVersion: 2,
  baselineStatementType: 'P&L',
  baselineLineCode: 'REVENUE',
  baselinePeriodDate: '2026-01-01',
  projectedValue: 100_000,
  actualIds: ['actual-1'],
  actualPeriodMonth: '2026-01-01',
  realizedValue: 97_000,
  variance: -3_000,
  variancePct: 3,
  reconciliationStatus: 'matched' as const,
  evidence: { tolerancePct: 5, resolvedAt: '2026-01-15T00:00:00.000Z' },
  status: 'completed' as const,
  createdBy: 'user-1',
  createdAt: '2026-01-15T00:00:00.000Z',
  completedAt: '2026-01-15T00:00:00.000Z',
};

describe('PostInvestmentReviewPanel', () => {
  it('renders an honest empty state when there is no review yet — never a fabricated verdict', async () => {
    listPostInvestmentReviews.mockResolvedValueOnce([]);
    render(<PostInvestmentReviewPanel initiativeId="init-1" />);

    await waitFor(() => expect(screen.getByTestId('post-investment-review-empty')).toBeTruthy());
    expect(screen.getByText(/No post-investment review yet/i)).toBeTruthy();
    expect(screen.queryByText(/Matched/i)).toBeNull();
    expect(screen.queryByText(/Variance/i)).toBeNull();
  });

  it('shows projected vs realized, the period, and the reconciliation status for a completed review', async () => {
    listPostInvestmentReviews.mockResolvedValueOnce([SAMPLE_REVIEW]);
    render(<PostInvestmentReviewPanel initiativeId="init-1" />);

    await waitFor(() => expect(screen.getByTestId('post-investment-review-panel')).toBeTruthy());
    expect(screen.getByText('100,000')).toBeTruthy(); // projected
    expect(screen.getByText('97,000')).toBeTruthy(); // realized
    expect(screen.getByText(/January 2026/i)).toBeTruthy(); // period
    expect(screen.getByText(/Matched/i)).toBeTruthy(); // reconciliation status
  });

  it('opens the evidence toggle to reveal the actual id(s) and who recorded it', async () => {
    listPostInvestmentReviews.mockResolvedValueOnce([SAMPLE_REVIEW]);
    render(<PostInvestmentReviewPanel initiativeId="init-1" />);

    await waitFor(() => expect(screen.getByTestId('post-investment-review-panel')).toBeTruthy());
    expect(screen.queryByTestId('post-investment-review-evidence')).toBeNull();

    fireEvent.click(screen.getByTestId('post-investment-review-evidence-toggle'));

    await waitFor(() => expect(screen.getByTestId('post-investment-review-evidence')).toBeTruthy());
    expect(screen.getByText(/actual-1/)).toBeTruthy();
    expect(screen.getByText(/user-1/)).toBeTruthy();
  });

  it('a fresh mount (simulating a hard reload — no client cache, always a new GET) shows the SAME review', async () => {
    listPostInvestmentReviews.mockResolvedValueOnce([SAMPLE_REVIEW]);
    const first = render(<PostInvestmentReviewPanel initiativeId="init-1" />);
    await waitFor(() => expect(screen.getByTestId('post-investment-review-panel')).toBeTruthy());
    first.unmount();

    listPostInvestmentReviews.mockResolvedValueOnce([SAMPLE_REVIEW]);
    render(<PostInvestmentReviewPanel initiativeId="init-1" />);
    await waitFor(() => expect(screen.getByTestId('post-investment-review-panel')).toBeTruthy());

    expect(screen.getByText('100,000')).toBeTruthy();
    expect(screen.getByText('97,000')).toBeTruthy();
    expect(listPostInvestmentReviews).toHaveBeenCalledTimes(2);
    expect(listPostInvestmentReviews).toHaveBeenNthCalledWith(2, 'init-1');
  });
});
