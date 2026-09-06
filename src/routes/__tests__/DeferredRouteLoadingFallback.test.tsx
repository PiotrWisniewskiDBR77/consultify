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
    expect(screen.getByRole('status')).toHaveTextContent('Ładowanie narzędzi…');
  });

  it('adds the slow-load message at 8 seconds and replaces loading with timeout at 15 seconds', () => {
    render(<DeferredRouteLoadingFallback />);

    act(() => vi.advanceTimersByTime(8_000));
    expect(screen.getByText('Ładowanie trwa dłużej niż zwykle…')).toBeInTheDocument();
    expect(screen.getByTestId('route-loading-skeleton')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(7_000));
    expect(screen.queryByTestId('route-loading-skeleton')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Nie udało się wczytać danych na czas');
  });
});
