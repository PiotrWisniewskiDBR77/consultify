import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDebouncedLocalStorage } from '../debouncedLocalStorage';

/**
 * F3a (pomiar A2, POMIAR_S1_5_JEDEN_PANEL_20260910.md §4 defekt 2): closing
 * the one global Teresa dock (MainLayout.tsx's own X, or Menu 1's icon) calls
 * `toggleChatCollapse()`, which zustand's `persist` middleware writes to
 * localStorage through this debounced storage adapter (300ms default). Before
 * this fix, a reload inside that 300ms window discarded the pending write —
 * localStorage still held the OLD `isChatCollapsed:false`, so after reload
 * the dock silently reopened, looking exactly like "closed the panel, it came
 * back on refresh".
 *
 * NOTE: this targets `debouncedLocalStorage.ts` directly rather than
 * `useAppStore.ts` because `tests/setup.ts` globally mocks
 * `@/store/useAppStore` (and its relative-path equivalent) for every test
 * file in the suite — importing the real store there always returns the
 * shared stub, never the real persistence layer. Extracting the debounce/
 * flush logic into its own module (used by useAppStore.ts) is what makes it
 * testable at all — see useAppStore.ts's `appStoreStorage`.
 *
 * These tests reproduce the race deterministically with fake timers: write,
 * then simulate the page disappearing (pagehide / visibilitychange:hidden)
 * BEFORE the debounce would have fired, and assert the persisted value is
 * already correct — "zamknięcie → reload stanu → nadal zamknięte".
 */
describe('createDebouncedLocalStorage — flush pending write before reload (F3a)', () => {
  const KEY = 'f3a-test-key';

  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not lose a just-written value on pagehide fired inside the debounce window', () => {
    const storage = createDebouncedLocalStorage(300);

    // Baseline: dock was already open (isChatCollapsed:false) and that write
    // has settled to disk.
    storage.setItem(KEY, JSON.stringify({ isChatCollapsed: false }));
    vi.advanceTimersByTime(400);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ isChatCollapsed: false });

    // User clicks the dock's X (MainLayout.tsx toggleChatCollapse()).
    storage.setItem(KEY, JSON.stringify({ isChatCollapsed: true }));

    // Reload happens IMMEDIATELY, well inside the 300ms debounce window —
    // without the flush-on-hide fix, localStorage would still say `false` here.
    window.dispatchEvent(new Event('pagehide'));

    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ isChatCollapsed: true });
  });

  it('also flushes on visibilitychange:hidden (mobile backgrounding, where pagehide may not fire)', () => {
    const storage = createDebouncedLocalStorage(300);
    storage.setItem(KEY, JSON.stringify({ isChatCollapsed: false }));
    vi.advanceTimersByTime(400);

    storage.setItem(KEY, JSON.stringify({ isChatCollapsed: true }));
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ isChatCollapsed: true });
  });

  it('does NOT flush on visibilitychange while the page is still visible', () => {
    const storage = createDebouncedLocalStorage(300);
    storage.setItem(KEY, JSON.stringify({ isChatCollapsed: false }));
    vi.advanceTimersByTime(400);

    storage.setItem(KEY, JSON.stringify({ isChatCollapsed: true }));
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));

    // Still pending — no flush trigger fired and the debounce hasn't elapsed.
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ isChatCollapsed: false });
  });

  it('still debounces ordinary writes when nothing forces a flush (perf behavior unchanged)', () => {
    const storage = createDebouncedLocalStorage(300);
    storage.setItem(KEY, JSON.stringify({ isChatCollapsed: false }));
    vi.advanceTimersByTime(400);

    storage.setItem(KEY, JSON.stringify({ isChatCollapsed: true }));
    vi.advanceTimersByTime(100);
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ isChatCollapsed: false }); // still old

    vi.advanceTimersByTime(250); // crosses the 300ms mark
    expect(JSON.parse(localStorage.getItem(KEY)!)).toEqual({ isChatCollapsed: true });
  });

  it('skips a no-op write (same value already on disk) without touching localStorage again', () => {
    const storage = createDebouncedLocalStorage(300);
    storage.setItem(KEY, JSON.stringify({ isChatCollapsed: false }));
    vi.advanceTimersByTime(400);

    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');
    storage.setItem(KEY, JSON.stringify({ isChatCollapsed: false }));
    vi.advanceTimersByTime(400);

    expect(setItemSpy).not.toHaveBeenCalled();
    setItemSpy.mockRestore();
  });
});
