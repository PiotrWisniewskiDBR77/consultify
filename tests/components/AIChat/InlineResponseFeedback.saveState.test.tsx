/**
 * M01-P03B (coordinator fix-required, 2026-08-05) — closes a confirmed
 * false-success (P1): before this fix, `InlineResponseFeedback` called
 * `setSubmitted(true)` SYNCHRONOUSLY, before the POST to
 * `/api/ai-feedback/response` even started, and
 * `feedbackLearningService.submitFeedback()` swallowed that POST's
 * rejection internally — so a save that failed (500) or was rejected as
 * forbidden (403) rendered IDENTICALLY to a real, persisted success
 * ("Thank you for your feedback!"). The user was told their rating was
 * saved when it was not.
 *
 * This file exercises the REAL `feedbackLearningService.ts` (not mocked —
 * that is exactly the module whose error-swallowing caused the bug), only
 * mocking the network boundary (`Api.aiFeedback` / `Api.updateUserMemory`)
 * so the test controls success/failure deterministically.
 */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const aiFeedback = vi.fn();
const updateUserMemory = vi.fn();
const getUserMemory = vi.fn();

vi.mock('../../../src/services/api', () => ({
  Api: {
    aiFeedback: (...args: unknown[]) => aiFeedback(...args),
    updateUserMemory: (...args: unknown[]) => updateUserMemory(...args),
    getUserMemory: (...args: unknown[]) => getUserMemory(...args),
  },
  api: {
    aiFeedback: (...args: unknown[]) => aiFeedback(...args),
  },
  getHeaders: () => ({}),
  API_URL: '/api',
  default: {
    aiFeedback: (...args: unknown[]) => aiFeedback(...args),
  },
}));

import { InlineResponseFeedback } from '../../../src/components/AIChat/InlineResponseFeedback';

/** A promise the test controls the resolution/rejection timing of. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function renderFeedback(onFeedback = vi.fn()) {
  render(
    <InlineResponseFeedback
      messageId="m-ai-1"
      conversationId="conv-1"
      onFeedback={onFeedback}
      compact
      thumbsOnly
    />
  );
  return { onFeedback };
}

describe('InlineResponseFeedback save-state (M01-P03B, no false-success)', () => {
  beforeEach(() => {
    aiFeedback.mockReset();
    updateUserMemory.mockReset();
    getUserMemory.mockReset();
    updateUserMemory.mockResolvedValue({});
    getUserMemory.mockResolvedValue({ entries: [], lastUpdated: new Date() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it(
    'NEGATIVE CONTROL — does NOT show "already rated" while the save is still ' +
      'in flight (this is exactly the false-success the fix closes)',
    async () => {
      const gate = deferred<void>();
      aiFeedback.mockReturnValue(gate.promise);
      renderFeedback();

      fireEvent.click(screen.getByTitle('Pomocne'));

      // Immediately after the click, BEFORE the mocked network call
      // resolves: must NOT already claim success.
      expect(screen.queryByText('Thank you for your feedback!')).not.toBeInTheDocument();
      expect(screen.getByText('Zapisywanie…')).toBeInTheDocument();

      // Now let the network call resolve, and only THEN does "saved" appear.
      await act(async () => {
        gate.resolve();
        await gate.promise;
      });
      await waitFor(() => {
        expect(screen.getByText('Thank you for your feedback!')).toBeInTheDocument();
      });
    }
  );

  it('shows a real success only after Api.aiFeedback actually resolves', async () => {
    aiFeedback.mockResolvedValue(undefined);
    renderFeedback();

    fireEvent.click(screen.getByTitle('Pomocne'));

    await waitFor(() => {
      expect(screen.getByText('Thank you for your feedback!')).toBeInTheDocument();
    });
    expect(aiFeedback).toHaveBeenCalledTimes(1);
    expect(aiFeedback.mock.calls[0][0]).toMatchObject({ messageId: 'm-ai-1', rating: 'positive' });
  });

  it('save failure (500) shows an honest error state with retry — NOT "Thank you"', async () => {
    aiFeedback.mockRejectedValueOnce(Object.assign(new Error('Failed to submit feedback'), { status: 500 }));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderFeedback();
    fireEvent.click(screen.getByTitle('Niepomocne'));

    await waitFor(() => {
      expect(screen.getByTestId('feedback-error-state')).toBeInTheDocument();
    });
    expect(screen.getByText('Nie udało się zapisać oceny.')).toBeInTheDocument();
    expect(screen.queryByText('Thank you for your feedback!')).not.toBeInTheDocument();

    // Retry is offered and actually resubmits.
    const retryButton = screen.getByTestId('feedback-retry');
    aiFeedback.mockResolvedValueOnce(undefined);
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('Thank you for your feedback!')).toBeInTheDocument();
    });
    expect(aiFeedback).toHaveBeenCalledTimes(2);

    consoleSpy.mockRestore();
  });

  it('forbidden (403) shows a distinct "access denied" state, with NO retry offered', async () => {
    aiFeedback.mockRejectedValueOnce(Object.assign(new Error('Message not found'), { status: 403 }));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderFeedback();
    fireEvent.click(screen.getByTitle('Pomocne'));

    await waitFor(() => {
      expect(screen.getByTestId('feedback-error-state')).toBeInTheDocument();
    });
    expect(screen.getByText('Nie można zapisać oceny dla tej wiadomości.')).toBeInTheDocument();
    expect(screen.queryByText('Nie udało się zapisać oceny.')).not.toBeInTheDocument();
    expect(screen.queryByText('Thank you for your feedback!')).not.toBeInTheDocument();
    // 403 is not transient — retrying the identical request would fail
    // identically, so no retry button (unlike the 500 case above).
    expect(screen.queryByTestId('feedback-retry')).not.toBeInTheDocument();

    consoleSpy.mockRestore();
  });

  it(
    'a 404 from POST /api/ai-feedback/response (the REAL status the ownership ' +
      'check on this route returns — see ai-feedback.routes.ts, a deliberate ' +
      'no-existence-oracle: "not yours" and "does not exist" both come back ' +
      '404) is treated the SAME as 403: denied, no retry',
    async () => {
      aiFeedback.mockRejectedValueOnce(Object.assign(new Error('Message not found'), { status: 404 }));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      renderFeedback();
      fireEvent.click(screen.getByTitle('Niepomocne'));

      await waitFor(() => {
        expect(screen.getByTestId('feedback-error-state')).toBeInTheDocument();
      });
      expect(screen.getByText('Nie można zapisać oceny dla tej wiadomości.')).toBeInTheDocument();
      expect(screen.queryByText('Thank you for your feedback!')).not.toBeInTheDocument();
      expect(screen.queryByTestId('feedback-retry')).not.toBeInTheDocument();

      consoleSpy.mockRestore();
  });

  it('a network-level rejection with no HTTP status is treated as a generic save error, not forbidden', async () => {
    aiFeedback.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderFeedback();
    fireEvent.click(screen.getByTitle('Pomocne'));

    await waitFor(() => {
      expect(screen.getByTestId('feedback-error-state')).toBeInTheDocument();
    });
    expect(screen.getByText('Nie udało się zapisać oceny.')).toBeInTheDocument();
    expect(screen.getByTestId('feedback-retry')).toBeInTheDocument();

    consoleSpy.mockRestore();
  });
});
