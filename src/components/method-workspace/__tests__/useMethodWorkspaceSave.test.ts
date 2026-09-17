/**
 * @vitest-environment jsdom
 *
 * TOOL_SESSION_WORKSPACE_STANDARD.md §6.3: CLEAN → DIRTY → SAVING → SAVED |
 * SAVE_FAILED | OFFLINE_PENDING. `Saved` only after backend confirmation;
 * SAVE_FAILED blocks a silent leave.
 */
import { act, renderHook } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useMethodWorkspaceSave } from '../useMethodWorkspaceSave';

describe('useMethodWorkspaceSave', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts CLEAN and markDirty transitions to DIRTY immediately', () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useMethodWorkspaceSave({ save, debounceMs: 1000 }));
    expect(result.current.state).toBe('CLEAN');

    act(() => result.current.markDirty());
    expect(result.current.state).toBe('DIRTY');
  });

  it('SAVED renders only after the save promise resolves ok — not optimistically', async () => {
    let resolveSave: (v: { ok: true }) => void = () => {};
    const save = vi.fn(
      () =>
        new Promise<{ ok: true }>((resolve) => {
          resolveSave = resolve;
        })
    );
    const { result } = renderHook(() => useMethodWorkspaceSave({ save, debounceMs: 100 }));

    act(() => result.current.markDirty());
    await act(async () => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current.state).toBe('SAVING');
    expect(result.current.state).not.toBe('SAVED');

    await act(async () => {
      resolveSave({ ok: true });
      await Promise.resolve();
    });
    expect(result.current.state).toBe('SAVED');
    expect(result.current.lastSavedAt).not.toBeNull();
  });

  it('a failed save moves to SAVE_FAILED and attemptLeave refuses a silent exit', async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, error: 'network down' });
    const { result } = renderHook(() => useMethodWorkspaceSave({ save, debounceMs: 10 }));

    await act(async () => {
      await result.current.saveNow();
    });
    expect(result.current.state).toBe('SAVE_FAILED');
    expect(result.current.errorMessage).toBe('network down');

    // Leave guard: SAVE_FAILED is not a state attemptLeave can wave through silently.
    let canLeave = true;
    act(() => {
      canLeave = result.current.attemptLeave();
    });
    expect(canLeave).toBe(false);
  });

  it('saveNow bypasses the debounce and saves immediately', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useMethodWorkspaceSave({ save, debounceMs: 10_000 }));

    act(() => result.current.markDirty());
    await act(async () => {
      await result.current.saveNow();
    });
    expect(save).toHaveBeenCalledWith('manual');
    expect(result.current.state).toBe('SAVED');
  });

  it('offline edits queue as OFFLINE_PENDING instead of erroring', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useMethodWorkspaceSave({ save, debounceMs: 10, isOnline: false }));

    await act(async () => {
      await result.current.saveNow();
    });
    expect(result.current.state).toBe('OFFLINE_PENDING');
    expect(save).not.toHaveBeenCalled();
  });

  it('attemptLeave on CLEAN/SAVED allows a silent exit', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true });
    const { result } = renderHook(() => useMethodWorkspaceSave({ save, debounceMs: 10 }));
    expect(result.current.attemptLeave()).toBe(true);

    await act(async () => {
      await result.current.saveNow();
    });
    expect(result.current.state).toBe('SAVED');
    expect(result.current.attemptLeave()).toBe(true);
  });

  it('a single markDirty persists the newest payload committed by the following render', async () => {
    const persisted: string[] = [];
    const { result } = renderHook(() => {
      const [payload, setPayload] = useState('old');
      const save = useCallback(async () => {
        persisted.push(payload);
        return { ok: true as const };
      }, [payload]);
      const workspaceSave = useMethodWorkspaceSave({ save, debounceMs: 100 });
      return {
        ...workspaceSave,
        edit(next: string) {
          setPayload(next);
          workspaceSave.markDirty();
        },
      };
    });

    act(() => result.current.edit('newest answer'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    expect(persisted).toEqual(['newest answer']);
    expect(result.current.state).toBe('SAVED');
  });

  it('queues a second save for an edit made while the first payload is in flight', async () => {
    let resolveFirst: (value: { ok: true }) => void = () => {};
    let resolveSecond: (value: { ok: true }) => void = () => {};
    const calls: string[] = [];

    const { result } = renderHook(() => {
      const [payload, setPayload] = useState('A');
      const save = useCallback(() => {
        calls.push(payload);
        return new Promise<{ ok: true }>((resolve) => {
          if (calls.length === 1) resolveFirst = resolve;
          else resolveSecond = resolve;
        });
      }, [payload]);
      const workspaceSave = useMethodWorkspaceSave({ save, debounceMs: 100 });
      return {
        ...workspaceSave,
        edit(next: string) {
          setPayload(next);
          workspaceSave.markDirty();
        },
      };
    });

    act(() => result.current.edit('A'));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(calls).toEqual(['A']);
    expect(result.current.state).toBe('SAVING');

    act(() => result.current.edit('B'));
    expect(result.current.state).toBe('DIRTY');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    await act(async () => {
      resolveFirst({ ok: true });
      await Promise.resolve();
    });
    expect(calls).toEqual(['A', 'B']);
    expect(result.current.state).toBe('SAVING');
    expect(result.current.state).not.toBe('SAVED');

    await act(async () => {
      resolveSecond({ ok: true });
      await Promise.resolve();
    });
    expect(result.current.state).toBe('SAVED');
  });
});
