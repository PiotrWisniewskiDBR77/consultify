/**
 * @vitest-environment jsdom
 *
 * FAZA C modelu ról PM — KRYTYCZNY KONTRAKT FAIL-OPEN hooka useEffectiveAccess.
 *
 * `can()` MUSI zwracać true przy: (1) mode='shadow', (2) trwającym ładowaniu,
 * (3) błędzie fetch — inaczej wpięcie CapabilityGate zmieniłoby dzisiejsze UI
 * zanim telemetria shadow potwierdzi bezpieczeństwo enforce.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { capabilityMatches, useEffectiveAccess } from '@/hooks/useEffectiveAccess';
import { Api } from '@/services/api';

vi.mock('@/services/api', () => ({
  Api: { get: vi.fn() },
}));

vi.mock('@/store/useAppStore', () => ({
  useAppStore: () => ({ currentUser: { id: 'user-1' } }),
}));

const apiGet = vi.mocked(Api.get);

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

const shadowPayload = {
  capabilities: ['initiative.view'],
  projectRole: 'TEAM_MEMBER',
  applicationRole: 'MEMBER',
  platformRole: null,
  projectId: 'proj-1',
  mode: 'shadow',
};

describe('useEffectiveAccess — kontrakt FAIL-OPEN', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('(1) SHADOW: can() zwraca true nawet dla capability spoza listy', async () => {
    apiGet.mockResolvedValue(shadowPayload);
    const { result } = renderHook(() => useEffectiveAccess('proj-1'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.mode).toBe('shadow');
    // capability NIE jest na liście — mimo to can()===true (shadow nie filtruje)
    expect(result.current.capabilities).not.toContain('initiative.start');
    expect(result.current.can('initiative.start')).toBe(true);
    // ale diagnostyczny wouldAllow mówi prawdę
    expect(result.current.wouldAllow('initiative.start')).toBe(false);
    expect(result.current.wouldAllow('initiative.view')).toBe(true);
  });

  it('(2) LOADING: can() zwraca true zanim fetch się rozstrzygnie (też w enforce)', () => {
    // fetch nigdy się nie kończy w trakcie tego testu
    apiGet.mockReturnValue(new Promise(() => {}) as never);
    const { result } = renderHook(() => useEffectiveAccess('proj-1'), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.can('initiative.start')).toBe(true);
    expect(result.current.can('decision.approve')).toBe(true);
  });

  it('(3) ERROR: can() zwraca true gdy fetch sie wywali', async () => {
    apiGet.mockRejectedValue(new Error('network down'));
    const { result } = renderHook(() => useEffectiveAccess('proj-1'), {
      wrapper: createWrapper(),
    });
    // hook ma retry:1 (backoff ~1s), więc dłuższy timeout na rozstrzygnięcie błędu
    await waitFor(() => expect(result.current.error).not.toBeNull(), { timeout: 8000 });

    expect(result.current.can('initiative.start')).toBe(true);
    expect(result.current.can('task.reassign')).toBe(true);
  });

  it('ENFORCE: can() realnie filtruje dopiero z mode=enforce i danymi', async () => {
    apiGet.mockResolvedValue({ ...shadowPayload, mode: 'enforce' });
    const { result } = renderHook(() => useEffectiveAccess('proj-1'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.mode).toBe('enforce');
    expect(result.current.can('initiative.view')).toBe(true);
    expect(result.current.can('initiative.start')).toBe(false);
  });

  it('ENFORCE + SUPERADMIN: platformRole omija filtr', async () => {
    apiGet.mockResolvedValue({
      ...shadowPayload,
      mode: 'enforce',
      capabilities: [],
      platformRole: 'SUPERADMIN',
    });
    const { result } = renderHook(() => useEffectiveAccess('proj-1'), {
      wrapper: createWrapper(),
    });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.can('initiative.start')).toBe(true);
  });
});

describe('capabilityMatches — semantyka sufiksów jak backend hasEffectiveCapability', () => {
  it("dopasowuje dokładnie, '*' i sufiksy zakresu", () => {
    expect(capabilityMatches(['task.assign'], 'task.assign')).toBe(true);
    expect(capabilityMatches(['*'], 'cokolwiek')).toBe(true);
    expect(capabilityMatches(['task.assign.scoped'], 'task.assign')).toBe(true);
    expect(capabilityMatches(['task.assign.own'], 'task.assign')).toBe(true);
    expect(capabilityMatches(['task.update'], 'task.assign')).toBe(false);
  });
});
