/**
 * @vitest-environment jsdom
 *
 * useToolSessionSync — unit tests.
 *
 * Mocks `toolSessionApi` (the HTTP boundary — see toolSessionApi.ts's file
 * header on why `Api` methods, not `window.fetch`, are the seam to mock)
 * while keeping the REAL error classifiers and the REAL
 * toolSessionRecoveryDraft module (jsdom localStorage) so the recovery-draft
 * behavior is exercised end-to-end, not just asserted against a mock.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { create, get, update } = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
}));

vi.mock('@/services/toolSessionApi', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/toolSessionApi')>();
  return {
    ...actual,
    toolSessionApi: { create, get, update },
  };
});

import { readRecoveryDraft, writeRecoveryDraft } from '@/services/toolSessionRecoveryDraft';

import { useToolSessionSync } from '../useToolSessionSync';

const record = (overrides: Record<string, unknown> = {}) => ({
  id: 'tool-1',
  toolType: 'dynamic-swot',
  status: 'DRAFT',
  answers: { mission: 'grow' },
  updatedAt: '2026-08-13T00:00:00.000Z',
  ...overrides,
});

beforeEach(() => {
  window.localStorage.clear();
  create.mockReset();
  get.mockReset();
  update.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('load()', () => {
  it('populates session/data from the server and returns the record', async () => {
    get.mockResolvedValueOnce(record());
    const { result } = renderHook(() => useToolSessionSync({ toolId: 'tool-1' }));

    const loaded = await act(() => result.current.load());

    expect(loaded?.id).toBe('tool-1');
    expect(result.current.data).toEqual({ mission: 'grow' });
    expect(result.current.status).toBe('ready');
    expect(result.current.lastSyncedAt).toBe('2026-08-13T00:00:00.000Z');
  });

  it('surfaces a generic load error as status "error"', async () => {
    get.mockRejectedValueOnce(Object.assign(new Error('boom'), { status: 500 }));
    const { result } = renderHook(() => useToolSessionSync({ toolId: 'tool-1' }));

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.status).toBe('error');
    expect(result.current.error).toBe('boom');
  });

  it('surfaces an unreachable network as status "offline"', async () => {
    get.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useToolSessionSync({ toolId: 'tool-1' }));

    await act(async () => {
      await result.current.load();
    });

    expect(result.current.status).toBe('offline');
    expect(result.current.isOffline).toBe(true);
  });

  it('discards a stale local draft (server moved on) and calls onRecoveryDiscarded', async () => {
    writeRecoveryDraft('tool-1', {
      baseUpdatedAt: '2026-08-12T00:00:00.000Z', // older than the server's updatedAt below
      data: { mission: 'stale-local-edit' },
    });
    get.mockResolvedValueOnce(record({ updatedAt: '2026-08-13T00:00:00.000Z' }));
    const onRecoveryDiscarded = vi.fn();
    const { result } = renderHook(() =>
      useToolSessionSync({ toolId: 'tool-1', onRecoveryDiscarded })
    );

    await act(async () => {
      await result.current.load();
    });

    expect(onRecoveryDiscarded).toHaveBeenCalledTimes(1);
    expect(result.current.recoveryAvailable).toBe(false);
    // Server state wins -- the discarded draft did NOT get applied.
    expect(result.current.data).toEqual({ mission: 'grow' });
    expect(readRecoveryDraft('tool-1')).toBeNull();
  });

  it('offers a genuinely unsynced local draft for recovery instead of discarding it', async () => {
    writeRecoveryDraft('tool-1', {
      baseUpdatedAt: '2026-08-13T00:00:00.000Z', // == server's updatedAt: server has not moved on
      data: { mission: 'unsynced-local-edit' },
    });
    get.mockResolvedValueOnce(record({ updatedAt: '2026-08-13T00:00:00.000Z' }));
    const onRecoveryAvailable = vi.fn();
    const { result } = renderHook(() =>
      useToolSessionSync({ toolId: 'tool-1', onRecoveryAvailable })
    );

    await act(async () => {
      await result.current.load();
    });

    expect(onRecoveryAvailable).toHaveBeenCalledWith(
      { mission: 'unsynced-local-edit' },
      expect.any(String)
    );
    expect(result.current.recoveryAvailable).toBe(true);
    // Not applied automatically -- server data is still what's loaded.
    expect(result.current.data).toEqual({ mission: 'grow' });

    update.mockResolvedValueOnce({ id: 'tool-1', status: 'DRAFT', updatedAt: 'later' });
    act(() => {
      result.current.applyRecoveryDraft();
    });
    expect(result.current.data).toEqual({ mission: 'unsynced-local-edit' });
    expect(result.current.recoveryAvailable).toBe(false);
  });
});

describe('setData() -> debounced autosave', () => {
  it('does not save before the debounce elapses, then saves once after', async () => {
    get.mockResolvedValueOnce(record());
    update.mockResolvedValueOnce({ id: 'tool-1', status: 'DRAFT', updatedAt: 'saved-at' });
    vi.useFakeTimers();

    const { result } = renderHook(() => useToolSessionSync({ toolId: 'tool-1', debounceMs: 1000 }));
    await act(async () => {
      await result.current.load();
    });

    act(() => {
      result.current.setData({ mission: 'edited' });
    });
    expect(result.current.status).toBe('dirty');
    expect(update).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(999);
    });
    expect(update).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      'tool-1',
      expect.objectContaining({ answers: { mission: 'edited' } })
    );
    await waitFor(() => expect(result.current.status).toBe('saved'));
  });

  it('collapses several rapid edits into a single save (real debounce, not per-keystroke)', async () => {
    get.mockResolvedValueOnce(record());
    update.mockResolvedValueOnce({ id: 'tool-1', status: 'DRAFT', updatedAt: 'saved-at' });
    vi.useFakeTimers();

    const { result } = renderHook(() => useToolSessionSync({ toolId: 'tool-1', debounceMs: 200 }));
    await act(async () => {
      await result.current.load();
    });

    act(() => {
      result.current.setData({ mission: 'v1' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    act(() => {
      result.current.setData({ mission: 'v2' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    act(() => {
      result.current.setData({ mission: 'v3' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(
      'tool-1',
      expect.objectContaining({ answers: { mission: 'v3' } })
    );
  });

  it('does not schedule a save for a no-op edit (deep-equal to current data)', async () => {
    get.mockResolvedValueOnce(record());
    vi.useFakeTimers();
    const { result } = renderHook(() => useToolSessionSync({ toolId: 'tool-1', debounceMs: 50 }));
    await act(async () => {
      await result.current.load();
    });

    act(() => {
      result.current.setData({ mission: 'grow' }); // identical to loaded data
    });
    expect(result.current.status).toBe('ready');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(50);
    });
    expect(update).not.toHaveBeenCalled();
  });
});

describe('409 conflict handling', () => {
  it('flush() surfaces a 409 as status "conflict" and stops further autosaves', async () => {
    get.mockResolvedValueOnce(record());
    update.mockRejectedValueOnce(Object.assign(new Error('locked'), { status: 409 }));
    vi.useFakeTimers();

    const { result } = renderHook(() => useToolSessionSync({ toolId: 'tool-1', debounceMs: 50 }));
    await act(async () => {
      await result.current.load();
    });

    act(() => {
      result.current.setData({ mission: 'edited' });
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.flush();
    });
    expect(outcome).toBe('conflict');
    expect(result.current.status).toBe('conflict');

    // A further edit must NOT thrash back into the same 409 automatically.
    update.mockClear();
    act(() => {
      result.current.setData({ mission: 'edited-again' });
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });
    expect(update).not.toHaveBeenCalled();
  });

  it('reconcile() discards local state, clears the conflict, and refetches from the server', async () => {
    get.mockResolvedValueOnce(record());
    update.mockRejectedValueOnce(Object.assign(new Error('locked'), { status: 409 }));
    const { result } = renderHook(() => useToolSessionSync({ toolId: 'tool-1' }));
    await act(async () => {
      await result.current.load();
    });
    act(() => {
      result.current.setData({ mission: 'edited' });
    });
    await act(async () => {
      await result.current.flush();
    });
    expect(result.current.status).toBe('conflict');

    get.mockResolvedValueOnce(record({ answers: { mission: 'server-latest' } }));
    await act(async () => {
      await result.current.reconcile();
    });

    expect(result.current.status).toBe('ready');
    expect(result.current.data).toEqual({ mission: 'server-latest' });
  });
});

describe('offline handling', () => {
  it('flush() surfaces an unreachable network as status "offline" and retries once back online', async () => {
    get.mockResolvedValueOnce(record());
    update.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    const { result } = renderHook(() => useToolSessionSync({ toolId: 'tool-1' }));
    await act(async () => {
      await result.current.load();
    });
    act(() => {
      result.current.setData({ mission: 'edited-offline' });
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.flush();
    });
    expect(outcome).toBe('offline');
    expect(result.current.status).toBe('offline');
    expect(result.current.isOffline).toBe(true);

    // Back online -- the queued edit must be retried automatically, with
    // no further action from the caller.
    update.mockResolvedValueOnce({ id: 'tool-1', status: 'DRAFT', updatedAt: 'now-online' });
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.status).toBe('saved'));
    expect(update).toHaveBeenLastCalledWith(
      'tool-1',
      expect.objectContaining({ answers: { mission: 'edited-offline' } })
    );
  });
});

describe('flush() / unmount', () => {
  it('flush() bypasses the debounce and saves immediately', async () => {
    get.mockResolvedValueOnce(record());
    update.mockResolvedValueOnce({ id: 'tool-1', status: 'DRAFT', updatedAt: 'now' });
    vi.useFakeTimers();

    const { result } = renderHook(() =>
      useToolSessionSync({ toolId: 'tool-1', debounceMs: 60_000 })
    );
    await act(async () => {
      await result.current.load();
    });
    act(() => {
      result.current.setData({ mission: 'edited' });
    });

    let outcome: string | undefined;
    await act(async () => {
      outcome = await result.current.flush();
    });
    expect(outcome).toBe('saved');
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('flushes a still-pending debounced save on unmount (no edit is silently lost)', async () => {
    get.mockResolvedValueOnce(record());
    update.mockResolvedValueOnce({ id: 'tool-1', status: 'DRAFT', updatedAt: 'now' });

    const { result, unmount } = renderHook(() =>
      useToolSessionSync({ toolId: 'tool-1', debounceMs: 60_000 })
    );
    await act(async () => {
      await result.current.load();
    });
    act(() => {
      result.current.setData({ mission: 'edited-just-before-close' });
    });
    expect(update).not.toHaveBeenCalled();

    unmount();
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(update).toHaveBeenCalledWith(
      'tool-1',
      expect.objectContaining({ answers: { mission: 'edited-just-before-close' } })
    );
  });
});

describe('create()', () => {
  it('forwards to toolSessionApi.create and returns the new id', async () => {
    create.mockResolvedValueOnce({ id: 'new-tool-1', status: 'DRAFT' });
    const { result } = renderHook(() => useToolSessionSync({ toolId: null }));

    let id = '';
    await act(async () => {
      id = await result.current.create({ toolType: 'dynamic-swot', name: 'New' });
    });
    expect(id).toBe('new-tool-1');
    expect(create).toHaveBeenCalledWith({ toolType: 'dynamic-swot', name: 'New' });
  });
});
