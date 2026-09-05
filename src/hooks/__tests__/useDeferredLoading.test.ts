import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useDeferredLoading } from '../useDeferredLoading';

describe('useDeferredLoading', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps a fast load quiet, then advances at the three contract thresholds', () => {
    const { result } = renderHook(() => useDeferredLoading(true));

    expect(result.current).toBe('idle');
    act(() => vi.advanceTimersByTime(299));
    expect(result.current).toBe('idle');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('pending');
    act(() => vi.advanceTimersByTime(7_699));
    expect(result.current).toBe('pending');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('slow');
    act(() => vi.advanceTimersByTime(6_999));
    expect(result.current).toBe('slow');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('timeout');
  });

  it('returns to idle and cancels pending transitions when loading completes', () => {
    const { result, rerender } = renderHook(
      ({ loading }) => useDeferredLoading(loading),
      { initialProps: { loading: true } },
    );

    act(() => vi.advanceTimersByTime(300));
    expect(result.current).toBe('pending');
    rerender({ loading: false });
    expect(result.current).toBe('idle');
    act(() => vi.advanceTimersByTime(20_000));
    expect(result.current).toBe('idle');
  });

  it('honours explicit thresholds', () => {
    const { result } = renderHook(() =>
      useDeferredLoading(true, { skeletonAfterMs: 10, slowAfterMs: 20, timeoutAfterMs: 30 }),
    );

    act(() => vi.advanceTimersByTime(10));
    expect(result.current).toBe('pending');
    act(() => vi.advanceTimersByTime(10));
    expect(result.current).toBe('slow');
    act(() => vi.advanceTimersByTime(10));
    expect(result.current).toBe('timeout');
  });
});
