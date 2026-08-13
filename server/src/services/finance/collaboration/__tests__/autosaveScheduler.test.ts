/**
 * Pure unit tests for `AutosaveScheduler` — no database, fake timers only.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AutosaveScheduler, DEFAULT_AUTOSAVE_DEBOUNCE_MS, DEFAULT_AUTOSAVE_MAX_WAIT_MS } from '../autosaveScheduler.js';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('AutosaveScheduler — debounce', () => {
  it('flushes once, debounceMs after the LAST edit', async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const scheduler = new AutosaveScheduler(flush, { debounceMs: 100, maxWaitMs: 10_000 });

    scheduler.notifyEdit();
    await vi.advanceTimersByTimeAsync(50);
    scheduler.notifyEdit(); // resets the debounce window
    await vi.advanceTimersByTimeAsync(50);
    expect(flush).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(50);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('flushes at maxWaitMs even under continuous edits (hard cap, prevents unbounded postponement)', async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const scheduler = new AutosaveScheduler(flush, { debounceMs: 100, maxWaitMs: 300 });

    // Keep resetting the debounce window every 80ms — would never fire on
    // its own, but maxWaitMs must still force a flush.
    for (let i = 0; i < 5; i++) {
      scheduler.notifyEdit();
      await vi.advanceTimersByTimeAsync(80);
    }
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('flushNow bypasses the debounce window immediately', async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const scheduler = new AutosaveScheduler(flush, { debounceMs: 10_000, maxWaitMs: 60_000 });

    scheduler.notifyEdit();
    await scheduler.flushNow();
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('coalesces a trigger that fires while a flush is already in-flight into one re-run', async () => {
    let resolveFlush: (() => void) | null = null;
    const flush = vi.fn().mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveFlush = resolve;
        })
    );
    const scheduler = new AutosaveScheduler(flush, { debounceMs: 10, maxWaitMs: 1000 });

    scheduler.notifyEdit();
    await vi.advanceTimersByTimeAsync(10);
    expect(flush).toHaveBeenCalledTimes(1);

    // A second edit arrives while the first flush is still pending.
    scheduler.notifyEdit();
    await vi.advanceTimersByTimeAsync(10);
    // Still only one flush in flight — the second trigger is queued, not concurrent.
    expect(flush).toHaveBeenCalledTimes(1);

    resolveFlush?.();
    await vi.waitFor(() => expect(flush).toHaveBeenCalledTimes(2));
  });

  it('defaults are sane (debounce shorter than max wait, both positive)', () => {
    expect(DEFAULT_AUTOSAVE_DEBOUNCE_MS).toBeGreaterThan(0);
    expect(DEFAULT_AUTOSAVE_MAX_WAIT_MS).toBeGreaterThan(DEFAULT_AUTOSAVE_DEBOUNCE_MS);
  });

  it('rejects non-positive debounceMs/maxWaitMs', () => {
    expect(() => new AutosaveScheduler(vi.fn(), { debounceMs: 0 })).toThrow();
    expect(() => new AutosaveScheduler(vi.fn(), { maxWaitMs: -1 })).toThrow();
  });

  it('dispose() cancels pending timers and stops future notifyEdit from scheduling', async () => {
    const flush = vi.fn().mockResolvedValue(undefined);
    const scheduler = new AutosaveScheduler(flush, { debounceMs: 50, maxWaitMs: 1000 });

    scheduler.notifyEdit();
    scheduler.dispose();
    await vi.advanceTimersByTimeAsync(100);
    expect(flush).not.toHaveBeenCalled();

    scheduler.notifyEdit(); // no-op after dispose
    await vi.advanceTimersByTimeAsync(100);
    expect(flush).not.toHaveBeenCalled();
  });
});
