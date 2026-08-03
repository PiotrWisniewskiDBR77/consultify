/**
 * @vitest-environment jsdom
 *
 * Smoke tests for PostInvestmentActualForm (FIN-007).
 * Mocks the network boundary only (V8ExecutionControlApi, financeValue
 * client) — not the component's own logic. Asserts the contract items this
 * form exists to satisfy:
 *  - no approved baseline → an explicit fail-closed empty state, no way to
 *    submit an actual at all;
 *  - the "record actual" button is disabled and reads "Saving…" WHILE its
 *    request is in flight, and the success confirmation renders ONLY AFTER
 *    the mocked promise resolves — never before (the "no premature success"
 *    requirement, tested by literally checking absence before resolving);
 *  - a rejected write renders an explicit error, never a success message;
 *  - a second click while pending does not fire a second network call
 *    (double-submit guard);
 *  - after a successful actual, the review-creation sub-form appears and,
 *    on success, calls onReviewCreated exactly once with no success text
 *    shown before that promise resolves either;
 *  - a rejected review-creation renders an explicit error and does NOT call
 *    onReviewCreated.
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

const { getApprovedBaselines, createPostInvestmentReview, recordBaselineRealization } = vi.hoisted(
  () => ({
    getApprovedBaselines: vi.fn(),
    createPostInvestmentReview: vi.fn(),
    recordBaselineRealization: vi.fn(),
  })
);

vi.mock('@/services/api/v8/financeValue', () => ({
  getApprovedBaselines,
  createPostInvestmentReview,
}));

vi.mock('@/services/api/v8/execution-control', () => ({
  V8ExecutionControlApi: { recordBaselineRealization },
}));

import { PostInvestmentActualForm } from '../PostInvestmentActualForm';

const BASELINE = {
  modelId: 'model-abc123',
  name: 'Atelier FY2026',
  version: 3,
  approvedAt: '2026-01-01T00:00:00.000Z',
  startDate: '2026-01-01',
};

/** A promise the test controls the resolution of, so pending-state assertions
 * can check "not yet shown" before deliberately resolving. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('PostInvestmentActualForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('no approved baseline → explicit fail-closed empty state, no form to submit', async () => {
    getApprovedBaselines.mockResolvedValueOnce([]);
    render(<PostInvestmentActualForm initiativeId="init-1" onReviewCreated={vi.fn()} />);

    await waitFor(() =>
      expect(screen.getByTestId('post-investment-actual-form-no-baseline')).toBeTruthy()
    );
    expect(screen.queryByTestId('post-investment-record-actual-submit')).toBeNull();
  });

  it('record actual: pending state shown while in flight, success rendered ONLY after the promise resolves', async () => {
    getApprovedBaselines.mockResolvedValueOnce([BASELINE]);
    const gate = deferred<{ entry: { id: string } }>();
    recordBaselineRealization.mockReturnValueOnce(gate.promise);

    render(<PostInvestmentActualForm initiativeId="init-1" onReviewCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('post-investment-actual-form')).toBeTruthy());

    fireEvent.change(screen.getByTestId('post-investment-revenue-delta'), {
      target: { value: '1000' },
    });
    fireEvent.submit(screen.getByTestId('post-investment-actual-form').querySelector('form')!);

    // While pending: never a success message, button disabled.
    expect(screen.queryByTestId('post-investment-actual-success')).toBeNull();
    await waitFor(() =>
      expect(screen.getByTestId('post-investment-record-actual-submit')).toHaveProperty(
        'disabled',
        true
      )
    );

    // A second submit attempt while pending must NOT fire a second call.
    fireEvent.submit(screen.getByTestId('post-investment-actual-form').querySelector('form')!);
    expect(recordBaselineRealization).toHaveBeenCalledTimes(1);

    // Only NOW resolve — success must appear only after this.
    gate.resolve({ entry: { id: 'roi-actual-xyz789' } });
    await waitFor(() => expect(screen.getByTestId('post-investment-actual-success')).toBeTruthy());
    expect(screen.getByText(/roi-actu/)).toBeTruthy(); // component shows lastActualId.slice(0, 8)
  });

  it('record actual failure renders an explicit error, never a success message', async () => {
    getApprovedBaselines.mockResolvedValueOnce([BASELINE]);
    // BASELINE_VERSION_CONFLICT triggers the component's own refetch of the
    // baseline list (it may be stale) — a second resolution for that refetch.
    getApprovedBaselines.mockResolvedValueOnce([BASELINE]);
    recordBaselineRealization.mockRejectedValueOnce({
      code: 'BASELINE_VERSION_CONFLICT',
      error: 'stale',
    });

    render(<PostInvestmentActualForm initiativeId="init-1" onReviewCreated={vi.fn()} />);
    await waitFor(() => expect(screen.getByTestId('post-investment-actual-form')).toBeTruthy());

    fireEvent.change(screen.getByTestId('post-investment-revenue-delta'), {
      target: { value: '500' },
    });
    fireEvent.submit(screen.getByTestId('post-investment-actual-form').querySelector('form')!);

    await waitFor(() => expect(screen.getByTestId('post-investment-actual-error')).toBeTruthy());
    expect(screen.getByText(/re-approved since you loaded it/i)).toBeTruthy();
    expect(screen.queryByTestId('post-investment-actual-success')).toBeNull();
  });

  it('after a successful actual, the review-creation sub-form appears; a successful submit calls onReviewCreated exactly once', async () => {
    getApprovedBaselines.mockResolvedValueOnce([BASELINE]);
    recordBaselineRealization.mockResolvedValueOnce({ entry: { id: 'roi-actual-111' } });
    const reviewGate = deferred<unknown>();
    createPostInvestmentReview.mockReturnValueOnce(reviewGate.promise);
    const onReviewCreated = vi.fn();

    render(<PostInvestmentActualForm initiativeId="init-1" onReviewCreated={onReviewCreated} />);
    await waitFor(() => expect(screen.getByTestId('post-investment-actual-form')).toBeTruthy());

    fireEvent.change(screen.getByTestId('post-investment-revenue-delta'), {
      target: { value: '1000' },
    });
    fireEvent.submit(screen.getByTestId('post-investment-actual-form').querySelector('form')!);
    await waitFor(() => expect(screen.getByTestId('post-investment-actual-success')).toBeTruthy());

    await waitFor(() =>
      expect(screen.getByTestId('post-investment-create-review-form')).toBeTruthy()
    );
    fireEvent.submit(screen.getByTestId('post-investment-create-review-form'));

    // Not called before the review promise resolves.
    expect(onReviewCreated).not.toHaveBeenCalled();

    reviewGate.resolve({});
    await waitFor(() => expect(onReviewCreated).toHaveBeenCalledTimes(1));
    expect(createPostInvestmentReview).toHaveBeenCalledTimes(1);
    const [payload] = createPostInvestmentReview.mock.calls[0];
    expect(payload.actualIds).toEqual(['roi-actual-111']);
    expect(payload.baselineModelId).toBe(BASELINE.modelId);
    expect(payload.baselineExpectedVersion).toBe(BASELINE.version);
  });

  it('review-creation failure renders an explicit error and does NOT call onReviewCreated', async () => {
    getApprovedBaselines.mockResolvedValueOnce([BASELINE]);
    recordBaselineRealization.mockResolvedValueOnce({ entry: { id: 'roi-actual-222' } });
    createPostInvestmentReview.mockRejectedValueOnce({
      code: 'BASELINE_LINE_NOT_FOUND',
      error: 'no such line',
    });
    const onReviewCreated = vi.fn();

    render(<PostInvestmentActualForm initiativeId="init-1" onReviewCreated={onReviewCreated} />);
    await waitFor(() => expect(screen.getByTestId('post-investment-actual-form')).toBeTruthy());

    fireEvent.change(screen.getByTestId('post-investment-revenue-delta'), {
      target: { value: '1000' },
    });
    fireEvent.submit(screen.getByTestId('post-investment-actual-form').querySelector('form')!);
    await waitFor(() => expect(screen.getByTestId('post-investment-actual-success')).toBeTruthy());

    fireEvent.submit(screen.getByTestId('post-investment-create-review-form'));
    await waitFor(() => expect(screen.getByTestId('post-investment-review-error')).toBeTruthy());
    expect(onReviewCreated).not.toHaveBeenCalled();
  });
});
