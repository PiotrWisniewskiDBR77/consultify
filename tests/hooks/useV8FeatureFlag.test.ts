/**
 * @vitest-environment jsdom
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getFlagsMock = vi.fn();

vi.mock('@/services/api/v8', () => ({
  V8AdminApi: {
    getFlags: (...args: unknown[]) => getFlagsMock(...args),
  },
}));

import { useV8FeatureFlag } from '@/hooks/useV8FeatureFlag';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe('useV8FeatureFlag', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when the requested module flag is enabled', async () => {
    getFlagsMock.mockResolvedValue({
      prompt_os_enabled: true,
      kb_enabled: false,
    });

    const { result } = renderHook(() => useV8FeatureFlag('prompt_os_enabled'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isEnabled).toBe(true);
    expect(result.current.flags).toEqual({
      prompt_os_enabled: true,
      kb_enabled: false,
    });
  });

  it('returns true for the aggregate check when any V8 flag is enabled', async () => {
    getFlagsMock.mockResolvedValue({
      prompt_os_enabled: false,
      kb_enabled: true,
    });

    const { result } = renderHook(() => useV8FeatureFlag(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isEnabled).toBe(true);
  });

  it('mirrors the backend implicit tenant fallback for an empty local flag set', async () => {
    getFlagsMock.mockResolvedValue({});

    const { result } = renderHook(() => useV8FeatureFlag(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.flags).toEqual({ v8_enabled: true });
    expect(result.current.isEnabled).toBe(true);
  });

  it('degrades safely to disabled flags when the admin route fails', async () => {
    getFlagsMock.mockRejectedValue(new Error('network down'));

    const { result } = renderHook(() => useV8FeatureFlag('prompt_os_enabled'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.flags).toEqual({});
    expect(result.current.isEnabled).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('does not fetch flags when the hook is disabled', () => {
    const { result } = renderHook(() => useV8FeatureFlag('prompt_os_enabled', false), {
      wrapper: createWrapper(),
    });

    expect(getFlagsMock).not.toHaveBeenCalled();
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isEnabled).toBe(false);
  });
});
