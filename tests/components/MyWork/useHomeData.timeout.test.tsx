import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useHomeData } from '../../../src/components/MyWork/Home/useHomeData';

const { apiGetCachedMock } = vi.hoisted(() => ({
  apiGetCachedMock: vi.fn(),
}));

vi.mock('@/services/api/baseClient', () => ({
  apiGetCached: (...args: unknown[]) => apiGetCachedMock(...args),
}));

vi.mock('@/services/api', () => ({
  default: {
    put: vi.fn(),
  },
}));

describe('useHomeData runtime recovery', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    apiGetCachedMock.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('leaves the initial loader when the home endpoint never resolves', async () => {
    apiGetCachedMock.mockImplementation((endpoint: string) => {
      if (endpoint === '/my-work/home/v2') return new Promise(() => {});
      if (endpoint === '/preferences') return Promise.resolve({ data: { home_layout: null } });
      return Promise.resolve({});
    });

    const { result } = renderHook(() => useHomeData());

    expect(result.current.loading).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(12_000);
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Home V2 unavailable. Please try again in a moment.');
    expect(result.current.blocks).toEqual([]);
  });
});
