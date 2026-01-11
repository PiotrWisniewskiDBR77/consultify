/**
 * useScreenContext Hook Integration Tests
 *
 * Tests the screen context management for AI features.
 */
import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';

// Mock AIContext
const mockSetScreenContext = vi.fn();

vi.mock('@/contexts/AIContext', () => ({
  useAIContext: () => ({
    setScreenContext: mockSetScreenContext,
  }),
}));

import { useScreenContext } from '@/hooks/useScreenContext';

describe('useScreenContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should set screen context with debounce', async () => {
    renderHook(() =>
      useScreenContext(
        'test-screen',
        'Test Screen',
        { field: 'value' },
        'Test description',
        'consultant'
      )
    );

    // Should not be called immediately (debounced)
    expect(mockSetScreenContext).not.toHaveBeenCalled();

    // Advance timers past debounce
    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(mockSetScreenContext).toHaveBeenCalledWith(
      expect.objectContaining({
        version: '1.0',
        screenId: 'test-screen',
        persona: 'consultant',
        data: expect.objectContaining({
          field: 'value',
          _meta: { title: 'Test Screen', description: 'Test description' },
        }),
        intent: 'Test description',
      })
    );
  });

  it('should include timestamp and sequenceId', async () => {
    renderHook(() => useScreenContext('screen-1', 'Title', {}));

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(mockSetScreenContext).toHaveBeenCalledWith(
      expect.objectContaining({
        timestamp: expect.any(Number),
        sequenceId: expect.any(Number),
      })
    );
  });

  it('should update context when data changes', async () => {
    const { rerender } = renderHook(({ data }) => useScreenContext('screen', 'Title', data), {
      initialProps: { data: { a: 1 } },
    });

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(mockSetScreenContext).toHaveBeenCalledTimes(1);

    // Update data
    rerender({ data: { a: 2 } });

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(mockSetScreenContext).toHaveBeenCalledTimes(2);
  });

  it('should use default persona when not specified', async () => {
    renderHook(() => useScreenContext('screen', 'Title', {}));

    act(() => {
      vi.advanceTimersByTime(350);
    });

    expect(mockSetScreenContext).toHaveBeenCalledWith(
      expect.objectContaining({
        persona: 'consultant', // default
      })
    );
  });

  it('should debounce rapid updates', async () => {
    const { rerender } = renderHook(({ data }) => useScreenContext('screen', 'Title', data), {
      initialProps: { data: { value: 1 } },
    });

    // Rapid updates
    rerender({ data: { value: 2 } });
    rerender({ data: { value: 3 } });
    rerender({ data: { value: 4 } });

    // Advance less than debounce time
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(mockSetScreenContext).not.toHaveBeenCalled();

    // Advance past debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should only be called once with final value
    expect(mockSetScreenContext).toHaveBeenCalledTimes(1);
    expect(mockSetScreenContext).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ value: 4 }),
      })
    );
  });

  it('should cleanup timeout on unmount', async () => {
    const { unmount } = renderHook(() => useScreenContext('screen', 'Title', {}));

    // Unmount before debounce fires
    unmount();

    act(() => {
      vi.advanceTimersByTime(350);
    });

    // Should not have been called
    expect(mockSetScreenContext).not.toHaveBeenCalled();
  });
});
