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

  it('clears unsynced when readback has content-identical but REORDERED object keys (FAZA 2 JSONB key-order fix)', async () => {
    // PostgreSQL JSONB storage does not guarantee an object's key order
    // survives a write+read round trip. A naive JSON.stringify comparison
    // would treat this readback as a mismatch even though the content is
    // identical — reproduced on live Postgres with zero duplicate writers.
    const goalsSentInOrder = { ...useContextBuilderStore.getState().goals, primaryObjective: 'Grow' };
    const goalsReadBackReordered = Object.fromEntries(
      Object.entries(goalsSentInOrder).reverse()
    );
    const version = '2026-08-24T21:30:00.000Z';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(empty), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, version }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            goals: goalsReadBackReordered,
            challenges: useContextBuilderStore.getState().challenges,
            synthesis: useContextBuilderStore.getState().synthesis,
            version,
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useOrgContextSync(true));
    await act(async () => Promise.resolve());

    act(() => useContextBuilderStore.getState().setGoals({ primaryObjective: 'Grow' }));
    await act(async () => vi.advanceTimersByTimeAsync(1500));
    await waitFor(() => expect(result.current.isUnsynced).toBe(false));

    expect(result.current.error).toBeNull();
    expect(result.current.persistedVersion).toBe(version);
  });

  it('saveNow() cancels the pending debounce and runs exactly one PUT+readback pair (FAZA 2 race fix)', async () => {
    const persisted = {
      goals: { ...useContextBuilderStore.getState().goals, primaryObjective: 'Grow now' },
      challenges: useContextBuilderStore.getState().challenges,
      synthesis: useContextBuilderStore.getState().synthesis,
      version: '2026-08-24T21:00:00.000Z',
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(empty), { status: 200 })) // initial load
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, version: persisted.version }), { status: 200 })
      ) // PUT from saveNow()
      .mockResolvedValueOnce(new Response(JSON.stringify(persisted), { status: 200 })); // readback
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useOrgContextSync(true));
    await act(async () => Promise.resolve());

    act(() => useContextBuilderStore.getState().setGoals({ primaryObjective: 'Grow now' }));
    // Debounce (1500ms) has NOT fired yet — saveNow() must cancel it, not race it.
    let saveResult: boolean | undefined;
    await act(async () => {
      saveResult = await result.current.saveNow();
    });

    expect(saveResult).toBe(true);
    expect(result.current.isUnsynced).toBe(false);
    expect(result.current.persistedVersion).toBe(persisted.version);
    // Exactly 3 fetches total (load + PUT + readback) — NOT 5, which is what a
    // second, independent debounce-triggered sync racing saveNow() would produce.
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Advancing past the original debounce window must NOT trigger a further,
    // now-orphaned auto-save — saveNow() already cleared that timer.
    await act(async () => vi.advanceTimersByTimeAsync(2000));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('two overlapping saveNow() calls are serialized, never producing two concurrent PUT+GET pairs', async () => {
    const versionA = '2026-08-24T21:05:00.000Z';
    const versionB = '2026-08-24T21:05:01.000Z';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(empty), { status: 200 })) // initial load
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, version: versionA }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            goals: useContextBuilderStore.getState().goals,
            challenges: useContextBuilderStore.getState().challenges,
            synthesis: useContextBuilderStore.getState().synthesis,
            version: versionA,
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, version: versionB }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            goals: useContextBuilderStore.getState().goals,
            challenges: useContextBuilderStore.getState().challenges,
            synthesis: useContextBuilderStore.getState().synthesis,
            version: versionB,
          }),
          { status: 200 }
        )
      );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useOrgContextSync(true));
    await act(async () => Promise.resolve());

    let first: Promise<boolean>;
    let second: Promise<boolean>;
    await act(async () => {
      first = result.current.saveNow();
      second = result.current.saveNow();
      await Promise.all([first, second]);
    });

    // 1 load + 2×(PUT+readback), run one after another — never interleaved.
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(result.current.persistedVersion).toBe(versionB);
    expect(result.current.isUnsynced).toBe(false);
  });
});
