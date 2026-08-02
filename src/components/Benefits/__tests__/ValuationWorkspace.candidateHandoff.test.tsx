/**
 * @vitest-environment jsdom
 *
 * FIN-06 — "Send as Initiative Candidate" action on a valuation advisory
 * recommendation (`ValuationWorkspace.tsx`). The action used to `fetch`
 * a direct-create endpoint and toast "Initiative created"; it now goes
 * through the shared Finance Candidate Pack handoff (preview → confirm) and
 * must be honest that only a Candidate was created, never an Initiative.
 *
 * Covers:
 *  - ineligible preview shows the REAL backend reason, no confirm option
 *  - eligible preview → confirm success shows candidate-driven messaging
 *    ("Utworzono kandydata na Initiative"), never "Initiative created"
 *  - a 409/4xx from confirm surfaces as a real error, never a false success
 *  - an idempotent replay (`created: false`) is distinguishable in the
 *    toast text from a fresh creation (`created: true`)
 *
 * The component's own bootstrap fetches (valuations list / sources / selected
 * valuation) are stubbed via global `fetch`; the new Candidate-handoff API
 * client (`@/services/api/v8/financeCandidateHandoffValuation`) is mocked
 * directly so each scenario can control preview/confirm deterministically
 * without needing a live backend route (the parallel backend agent's route
 * adapter may not exist yet in this worktree).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // Handles both call shapes used across this component tree: a plain
    // string fallback (`t('key', 'Fallback')`, ValuationWorkspace's own
    // style) and i18next's `{ defaultValue }` object form (used by the
    // shared EmptyState/LoadingState components it renders).
    t: (key: string, fallback?: string | { defaultValue?: string }) => {
      if (typeof fallback === 'string') return fallback;
      if (fallback && typeof fallback === 'object' && fallback.defaultValue !== undefined) {
        return fallback.defaultValue;
      }
      return key;
    },
    i18n: { language: 'en' },
  }),
  initReactI18next: { type: '3rdParty', init: vi.fn() },
}));

// vi.mock factories are hoisted above module-level declarations, so the
// mocks they reference must come from vi.hoisted (plain `const` here would
// throw "Cannot access before initialization").
const { toastFn, previewMock, confirmMock, getHandoffMock, navigateMock } = vi.hoisted(() => ({
  // Capture the render-prop function toast(fn) invocations get called with,
  // so tests can render its returned JSX (the "Otwórz" link) and assert on
  // it, the same way react-hot-toast would when it actually renders.
  toastFn: vi.fn((_arg: unknown) => 'toast-id'),
  previewMock: vi.fn(),
  confirmMock: vi.fn(),
  // The shared FinanceCandidateHandoffModal's best-effort fresh read-back
  // after a successful confirm. Defaults to "no receipt yet" so existing
  // scenarios (which don't care about it) aren't forced to stub it.
  getHandoffMock: vi.fn().mockResolvedValue(null),
  navigateMock: vi.fn(),
}));

vi.mock('react-hot-toast', () => {
  const fn = Object.assign(toastFn, {
    success: vi.fn(),
    error: vi.fn(),
    dismiss: vi.fn(),
  });
  return { default: fn };
});

vi.mock('@/services/api/v8/financeCandidateHandoffValuation', () => ({
  previewValuationRecommendationCandidateHandoff: (...args: unknown[]) => previewMock(...args),
  confirmValuationRecommendationCandidateHandoff: (...args: unknown[]) => confirmMock(...args),
  getValuationRecommendationCandidateHandoff: (...args: unknown[]) => getHandoffMock(...args),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

import { ValuationWorkspace } from '../ValuationWorkspace';

const VALUATION_ID = 'val-1';
const RECOMMENDATION_ID = 'rec-1';

const mockValuationDetail = {
  id: VALUATION_ID,
  title: 'Fundraising valuation — base case',
  status: 'APPROVED',
  currency: 'PLN',
  assumptions: {},
  peers: {},
  results: {},
  advisory: {
    recommendations: [
      {
        id: RECOMMENDATION_ID,
        title: 'Reduce net debt before close',
        category: 'capital_structure',
        impactTier: 'high',
        effort: 'medium',
        mechanism: 'Pay down revolver ahead of the valuation date.',
      },
    ],
  },
};

function mockFetchImplementation(url: string) {
  if (url.endsWith('/economics/valuations/sources')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ sources: { budgets: [], financialModels: [] } }),
    });
  }
  if (url.endsWith('/economics/valuations')) {
    return Promise.resolve({
      ok: true,
      json: async () => ({
        valuations: [
          {
            id: VALUATION_ID,
            title: mockValuationDetail.title,
            status: 'APPROVED',
            sourceType: 'manual',
            horizonYears: 5,
            currency: 'PLN',
          },
        ],
      }),
    });
  }
  if (url.endsWith(`/economics/valuations/${VALUATION_ID}`)) {
    return Promise.resolve({
      ok: true,
      json: async () => ({ valuation: mockValuationDetail }),
    });
  }
  return Promise.resolve({ ok: true, json: async () => ({}) });
}

const renderWorkspace = () =>
  render(
    <MemoryRouter initialEntries={['/finance']}>
      <ValuationWorkspace initialValuationId={VALUATION_ID} />
    </MemoryRouter>
  );

/** Selects the "results" step tab (where the advisory recommendations render) and
 * waits for the recommendation card + its "send as candidate" button to appear. */
async function openResultsTabWithRecommendation() {
  const resultsTab = await screen.findByRole('tab', { name: 'results' });
  fireEvent.click(resultsTab);
  return screen.findByRole('button', { name: /Wyślij jako kandydata na Initiative/i });
}

beforeEach(() => {
  previewMock.mockReset();
  confirmMock.mockReset();
  getHandoffMock.mockReset();
  getHandoffMock.mockResolvedValue(null);
  toastFn.mockClear();
  navigateMock.mockClear();
  global.fetch = vi.fn(mockFetchImplementation) as unknown as typeof fetch;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('ValuationWorkspace — Send as Initiative Candidate', () => {
  it('shows the real ineligible reason from the backend and offers no confirm action', async () => {
    previewMock.mockResolvedValue({
      eligible: false,
      reason: 'This recommendation has already been dismissed and cannot be handed off.',
    });

    renderWorkspace();
    const convertButton = await openResultsTabWithRecommendation();
    fireEvent.click(convertButton);

    expect(
      await screen.findByText(
        'This recommendation has already been dismissed and cannot be handed off.'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Wyślij' })
    ).not.toBeInTheDocument();
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it('shows candidate-driven success messaging (not "Initiative created") on a fresh confirm', async () => {
    previewMock.mockResolvedValue({
      eligible: true,
      preview: {
        title: 'Reduce net debt before close',
        rationale: 'Improves EV multiple ahead of the raise.',
        fitScore: 0.82,
        sourceType: 'finance_valuation_recommendation',
        sourceId: RECOMMENDATION_ID,
      },
    });
    let resolveConfirm: (v: unknown) => void = () => {};
    confirmMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveConfirm = resolve;
        })
    );

    renderWorkspace();
    const convertButton = await openResultsTabWithRecommendation();
    fireEvent.click(convertButton);

    // Preview resolved eligible — the modal shows the preview and a real
    // confirm button, not an immediate success. The rationale text is
    // unique to the modal (the recommendation card behind it shows
    // `mechanism`, not `rationale`), so it disambiguates from the card.
    const confirmButton = await screen.findByRole('button', { name: 'Wyślij' });
    expect(screen.getByText('Improves EV multiple ahead of the raise.')).toBeInTheDocument();

    fireEvent.click(confirmButton);

    // Never show success before confirm's response has resolved. The button
    // itself swaps its label for a spinner while 'confirming', so re-query
    // by name would fail — assert on the same element reference instead.
    expect(toastFn).not.toHaveBeenCalled();
    expect(confirmButton).toBeDisabled();

    resolveConfirm({ created: true, candidateId: 'cand-999' });

    await waitFor(() => expect(toastFn).toHaveBeenCalledTimes(1));
    // Render whatever toast(renderFn) was called with — mirrors what
    // react-hot-toast does when it actually paints the toast.
    const toastArg = toastFn.mock.calls[0][0];
    const node = typeof toastArg === 'function' ? toastArg({ id: 't1' }) : toastArg;
    render(node as React.ReactElement);

    expect(screen.getByText('Utworzono kandydata na Initiative')).toBeInTheDocument();
    expect(screen.queryByText('Initiative created')).not.toBeInTheDocument();

    // Modal closed after a resolved confirm.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Wyślij' })).not.toBeInTheDocument()
    );
  });

  it('surfaces a 409 from confirm as a real error, never as a false success', async () => {
    previewMock.mockResolvedValue({
      eligible: true,
      preview: {
        title: 'Reduce net debt before close',
        rationale: 'Improves EV multiple ahead of the raise.',
        sourceType: 'finance_valuation_recommendation',
        sourceId: RECOMMENDATION_ID,
      },
    });
    const conflictError: any = new Error(
      'Finance source is not eligible for candidate handoff: no longer eligible'
    );
    conflictError.status = 409;
    conflictError.data = { error: conflictError.message, code: 'SOURCE_NOT_ELIGIBLE' };
    confirmMock.mockRejectedValue(conflictError);

    renderWorkspace();
    const convertButton = await openResultsTabWithRecommendation();
    fireEvent.click(convertButton);

    const confirmButton = await screen.findByRole('button', { name: 'Wyślij' });
    fireEvent.click(confirmButton);

    expect(
      await screen.findByText(
        'Finance source is not eligible for candidate handoff: no longer eligible'
      )
    ).toBeInTheDocument();
    expect(toastFn).not.toHaveBeenCalled();
  });

  it('distinguishes an idempotent replay (created: false) from a fresh creation', async () => {
    previewMock.mockResolvedValue({
      eligible: true,
      preview: {
        title: 'Reduce net debt before close',
        rationale: 'Improves EV multiple ahead of the raise.',
        sourceType: 'finance_valuation_recommendation',
        sourceId: RECOMMENDATION_ID,
      },
    });
    confirmMock.mockResolvedValue({ created: false, candidateId: 'cand-existing-1' });

    renderWorkspace();
    const convertButton = await openResultsTabWithRecommendation();
    fireEvent.click(convertButton);

    const confirmButton = await screen.findByRole('button', { name: 'Wyślij' });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(toastFn).toHaveBeenCalledTimes(1));
    const toastArg = toastFn.mock.calls[0][0];
    const node = typeof toastArg === 'function' ? toastArg({ id: 't1' }) : toastArg;
    render(node as React.ReactElement);

    expect(
      screen.getByText('To zalecenie zostało już wcześniej wysłane jako kandydat na Initiative')
    ).toBeInTheDocument();
    expect(screen.queryByText('Utworzono kandydata na Initiative')).not.toBeInTheDocument();
  });

  it('attempts a fresh read-back of the handoff receipt after a successful confirm (FinanceCandidateHandoffModal.fetchHandoff wiring)', async () => {
    previewMock.mockResolvedValue({
      eligible: true,
      preview: {
        title: 'Reduce net debt before close',
        rationale: 'Improves EV multiple ahead of the raise.',
        sourceType: 'finance_valuation_recommendation',
        sourceId: RECOMMENDATION_ID,
      },
    });
    confirmMock.mockResolvedValue({ created: true, candidateId: 'cand-999' });
    getHandoffMock.mockResolvedValue({
      id: 'handoff-1',
      organizationId: 'org-1',
      sourceType: 'finance_valuation_recommendation',
      sourceId: RECOMMENDATION_ID,
      candidateId: 'cand-999',
      createdBy: 'user-1',
      createdAt: '2026-08-01T00:00:00.000Z',
    });

    renderWorkspace();
    const convertButton = await openResultsTabWithRecommendation();
    fireEvent.click(convertButton);

    const confirmButton = await screen.findByRole('button', { name: 'Wyślij' });
    fireEvent.click(confirmButton);

    await waitFor(() => expect(getHandoffMock).toHaveBeenCalledWith(RECOMMENDATION_ID));
    // The success toast still fires after the read-back settles — a failed
    // or slow read-back never blocks the honest, backend-confirmed success.
    await waitFor(() => expect(toastFn).toHaveBeenCalledTimes(1));
  });
});
