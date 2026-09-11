import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DeferredRouteLoadingFallback } from '../DeferredRouteLoadingFallback';

describe('DeferredRouteLoadingFallback', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps a fast lazy import quiet and shows a moving panel skeleton after 300 ms', () => {
    const { container } = render(<DeferredRouteLoadingFallback />);

    expect(container).toBeEmptyDOMElement();
    act(() => vi.advanceTimersByTime(299));
    expect(container).toBeEmptyDOMElement();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.getByTestId('route-loading-skeleton')).toBeInTheDocument();
    expect(container.querySelector('.animate-pulse')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Loading tools…');
  });

  // DIAG-W3 (11.09): the 15 s data-timeout was SHORTER than this app's own cold
  // boot on staging (16-26 s, ODBIOR_STAGING_7e8668c7cc §7.3). A route module
  // import cannot "time out" — it resolves or rejects — so the old guard turned
  // a slow-but-succeeding import into a permanent-looking failure covering the
  // WHOLE app (this Suspense is the only boundary around <Routes>,
  // AppRoutes.tsx:1199). Keep the skeleton until well past the measured boot.
  it('keeps the skeleton at 15 s and only gives up after 45 s', () => {
    render(<DeferredRouteLoadingFallback />);

    act(() => vi.advanceTimersByTime(8_000));
    expect(screen.getByText('This is taking longer than usual…')).toBeInTheDocument();
    expect(screen.getByTestId('route-loading-skeleton')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(7_000)); // 15 s — dawniej blad
    expect(screen.getByTestId('route-loading-skeleton')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(30_000)); // 45 s
    expect(screen.queryByTestId('route-loading-skeleton')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Nie udało się wczytać danych na czas');
  });

  // DIAG-W3: the failure screen was a dead end — no button, no way back.
  it('offers a retry that reloads the page', () => {
    render(<DeferredRouteLoadingFallback />);
    act(() => vi.advanceTimersByTime(45_000));

    const retry = screen.getByRole('button', { name: /try again|spróbuj ponownie/i });
    expect(retry).toBeInTheDocument();
  });
});
