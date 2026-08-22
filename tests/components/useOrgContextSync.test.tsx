import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useOrgContextSync } from '../../src/hooks/useOrgContextSync';
import { useContextBuilderStore } from '../../src/store/useContextBuilderStore';

vi.mock('../../src/services/api', () => ({ getHeaders: () => ({ Authorization: 'Bearer test' }) }));

const empty = { goals: {}, challenges: {}, synthesis: {}, version: null };

describe('useOrgContextSync', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useContextBuilderStore.getState().reset();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('treats a non-2xx PUT as unsynced instead of a successful best-effort save', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(empty), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'no' }), { status: 500 }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useOrgContextSync(true));
    await act(async () => Promise.resolve());

    act(() => useContextBuilderStore.getState().setGoals({ primaryObjective: 'Grow' }));
    await act(async () => vi.advanceTimersByTimeAsync(1500));

    await waitFor(() => expect(result.current.isUnsynced).toBe(true));
    expect(result.current.error).toContain('(500)');
    expect(result.current.persistedVersion).toBeNull();
  });

  it('clears unsynced only after the persisted version and cold readback match', async () => {
    const persisted = {
      goals: { ...useContextBuilderStore.getState().goals, primaryObjective: 'Grow' },
      challenges: useContextBuilderStore.getState().challenges,
      synthesis: useContextBuilderStore.getState().synthesis,
      version: '2026-08-21T08:00:00.000Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(empty), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, version: persisted.version }), { status: 200 })
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(persisted), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useOrgContextSync(true));
    await act(async () => Promise.resolve());

    act(() => useContextBuilderStore.getState().setGoals({ primaryObjective: 'Grow' }));
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    await waitFor(() => expect(result.current.isUnsynced).toBe(false));

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(result.current.persistedVersion).toBe(persisted.version);
    expect(result.current.error).toBeNull();
  });
});
